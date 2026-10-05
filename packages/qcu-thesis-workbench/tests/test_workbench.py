import io, json, sys, tempfile, threading, unittest, zipfile
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'runtime'))
from engine import Document, InputError, check, report_html
from server import create_server
NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
def fixture(text='机密CANARY&lt;script&gt;',extra='',style='Normal',rpr=''):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        z.writestr('word/document.xml',f'<w:document xmlns:w="{NS}"><w:body><w:p><w:pPr><w:pStyle w:val="{style}"/></w:pPr><w:r>{rpr}<w:t>{text}</w:t></w:r></w:p>{extra}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:bottom="1440" w:left="1440" w:right="1440"/></w:sectPr></w:body></w:document>')
        z.writestr('word/styles.xml',f'<w:styles xmlns:w="{NS}"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:ind w:firstLine="0"/></w:pPr><w:rPr><w:rFonts w:eastAsia="宋体" w:ascii="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:style></w:styles>')
    return out.getvalue()
RULE=json.loads((Path(__file__).resolve().parents[1]/'rules/demo.json').read_text())
class EngineTests(unittest.TestCase):
    def test_inheritance_pass(self):
        self.assertEqual(check(fixture(),RULE)['counts'],{'passed':11,'failed':0,'unknown':0})
    def test_direct_override(self):
        result=check(fixture(rpr='<w:rPr><w:sz w:val="28"/></w:rPr>'),RULE)
        self.assertEqual(result['counts']['failed'],1)
        self.assertIn('&lt;script&gt;',report_html(result));self.assertNotIn('<script>',report_html(result))
    def test_unknown_style_and_theme(self):
        self.assertGreater(check(fixture(style='Missing'),RULE)['counts']['unknown'],0)
        self.assertEqual(check(fixture(rpr='<w:rPr><w:rFonts w:asciiTheme="minorHAnsi"/></w:rPr>'),RULE)['counts']['unknown'],1)
    def test_table_is_unknown(self):
        self.assertEqual(check(fixture(extra='<w:tbl><w:tr><w:tc><w:p><w:r><w:t>表格</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'),RULE)['counts']['unknown'],1)
    def test_reject_bad_and_revision(self):
        for data in [b'not zip',fixture(extra='<w:ins/>')]:
            with self.assertRaises(InputError):Document(data)
    def test_direct_indent_overrides_inherited_hanging(self):
        doc=Document(fixture());p=doc.paragraphs[0]
        from engine import W, ET
        inherited=doc.styles['Normal'].find('./'+W+'pPr/'+W+'ind')
        inherited.attrib.clear();inherited.set(W+'hanging','720')
        ET.SubElement(p['node'].find(W+'pPr'),W+'ind',{W+'firstLine':'0'})
        self.assertEqual(doc.prop(p,'first_line_mm'),0)
    def test_no_mutation(self):
        data=fixture();before=bytes(data);check(data,RULE);self.assertEqual(data,before)
class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();cls.server=create_server(cls.tmp.name)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.base=cls.server.bridge['base_url']
        with urlopen(cls.base) as r:cls.cookie=r.headers['Set-Cookie'].split(';')[0]
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.tmp.cleanup()
    def req(self,path,data=None,headers=None):
        hdr={'Cookie':self.cookie,'Origin':self.base,'Content-Type':'application/json'};hdr.update(headers or {})
        raw=json.dumps(data).encode() if isinstance(data,dict) else data
        with urlopen(Request(self.base+path,data=raw,headers=hdr)) as r:return r.read(),r.headers
    def test_origin_and_bridge_auth(self):
        for path,hdr in [('/api/run',{'Origin':'https://evil.example'}),('/bridge/run',{})]:
            with self.assertRaises(HTTPError) as e:self.req(path,{},hdr)
            self.assertEqual(e.exception.code,403)
    def test_grant_and_projection(self):
        for allowed in [False,True]:
            doc=json.loads(self.req('/api/upload',fixture(),{'Content-Type':'application/octet-stream','X-QCU-Chat-Allowed':str(allowed).lower()})[0])
            args={'document_id':doc['document_id'],'rule_id':RULE['id']}
            hdr={'X-QCU-Bridge':self.server.bridge['token'],'X-QCU-Task-Session':'a'*64}
            if not allowed:
                with self.assertRaises(HTTPError):self.req('/bridge/run',{**args,'session_tag':'a'*64},hdr)
                continue
            raw,_=self.req('/bridge/run',{**args,'session_tag':'a'*64},hdr);self.assertNotIn(b'CANARY',raw)
            result=json.loads(raw);local=json.loads(self.req('/api/run',args)[0]);self.assertEqual(result['counts'],local['counts'])
            html,headers=self.req('/reports/'+result['report_id']+'/download',headers={'X-QCU-Task-Session':'a'*64});self.assertIn('attachment',headers['Content-Disposition'])
            self.assertIn(b'QCU',html)
    def test_report_save_route_is_present_and_repeatable(self):
        doc=json.loads(self.req("/api/task/upload",fixture(),{"Content-Type":"application/octet-stream"})[0])
        result=json.loads(self.req("/api/task/run",{"document_id":doc["document_id"],"rule_id":RULE["id"],"local_authorized":True})[0])
        route="/reports/"+result["report_id"]
        page,_=self.req(route)
        self.assertIn(('href="'+route+'/download"').encode(),page)
        self.assertIn("保存 HTML 报告".encode(),page)
        first,hdr=self.req(route+"/download")
        second,_=self.req(route+"/download")
        self.assertEqual(first,page);self.assertEqual(second,page)
        self.assertIn("attachment",hdr["Content-Disposition"])
        self.assertIn(b".report-actions{display:none}",page)
        old_id='c'*32
        old=report_html(check(fixture(),RULE)).encode()
        self.server.store.path('reports',old_id,'.html').write_bytes(old)
        viewed,_=self.req('/reports/'+old_id)
        self.assertIn((f'href="/reports/{old_id}/download"').encode(),viewed)
        exported,_=self.req('/reports/'+old_id+'/download')
        self.assertEqual(exported,old)
        self.assertEqual(self.server.store.path('reports',old_id,'.html').read_bytes(),old)
        with self.assertRaises(InputError):report_html(check(fixture(),RULE),'../invalid')

    def test_repeat_bridge_keeps_existing_report_available_during_concurrent_http(self):
        doc=json.loads(self.req('/api/upload',fixture(),{'Content-Type':'application/octet-stream','X-QCU-Chat-Allowed':'true'})[0])
        args={'document_id':doc['document_id'],'rule_id':RULE['id'],'session_tag':'a'*64}
        bridge_headers={'X-QCU-Bridge':self.server.bridge['token']}
        view_headers={'X-QCU-Task-Session':'a'*64}
        first=json.loads(self.req('/bridge/run',args,bridge_headers)[0])
        route='/reports/'+first['report_id']
        expected=self.req(route,headers=view_headers)[0]
        grant_path=self.server.store.path('documents',doc['document_id'],'.json')
        in_flight=threading.Event();release=threading.Event();outcome=[]
        original_write=Path.write_text

        def wait_for_reader():
            in_flight.set()
            if not release.wait(3):raise RuntimeError('Concurrent regression did not release request')

        def slow_check(data,rule):
            wait_for_reader()
            return check(data,rule)

        def slow_grant_write(path,*values,**options):
            if path==grant_path:
                # Pause exactly in the former write_text truncation window.
                # Fixed repeated checks reach slow_check without rewriting this file.
                with path.open('w',encoding='utf-8'):pass
                wait_for_reader()
            return original_write(path,*values,**options)

        def repeat():
            try:outcome.append(json.loads(self.req('/bridge/run',args,bridge_headers)[0]))
            except Exception as error:outcome.append(error)

        with patch('server.check',slow_check),patch.object(Path,'write_text',slow_grant_write):
            worker=threading.Thread(target=repeat);worker.start()
            try:
                self.assertTrue(in_flight.wait(3),'Repeat request did not enter the bounded overlap')
                self.assertEqual(self.req(route,headers=view_headers)[0],expected)
                downloaded,headers=self.req(route+'/download',headers=view_headers)
                self.assertEqual(downloaded,expected)
                self.assertIn('attachment',headers['Content-Disposition'])
                with self.assertRaises(HTTPError) as denied:self.req(route,headers={'X-QCU-Task-Session':'b'*64})
                self.assertEqual(denied.exception.code,403)
            finally:
                release.set();worker.join(4)
            self.assertFalse(worker.is_alive())
        self.assertEqual(len(outcome),1)
        self.assertIsInstance(outcome[0],dict)
        self.assertEqual(outcome[0]['status'],'completed')
        self.assertEqual(self.req(route,headers=view_headers)[0],expected)
        grant=json.loads(grant_path.read_text());grant['expires']=0
        grant_path.write_text(json.dumps(grant),encoding='utf-8')
        for suffix in ['', '/download']:
            with self.assertRaises(HTTPError) as denied:self.req(route+suffix,headers=view_headers)
            self.assertEqual(denied.exception.code,403)

    def test_rules_copy(self):
        saved=json.loads(self.req('/api/rules',RULE)[0]);self.assertEqual(saved['source'],'personal');self.assertNotEqual(saved['id'],RULE['id'])
        self.assertEqual(self.server.store.rule(RULE['id']),RULE)
    def test_host_and_traversal(self):
        with self.assertRaises(HTTPError):self.req('/api/rules',headers={'Host':'evil.example'})
        with self.assertRaises(InputError):self.server.store.path('documents','../../bad','.docx')
if __name__=='__main__':unittest.main()
