import io, json, sys, tempfile, threading, unittest, zipfile
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
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
            hdr={'X-QCU-Bridge':self.server.bridge['token']}
            if not allowed:
                with self.assertRaises(HTTPError):self.req('/bridge/run',args,hdr)
                continue
            raw,_=self.req('/bridge/run',args,hdr);self.assertNotIn(b'CANARY',raw)
            result=json.loads(raw);local=json.loads(self.req('/api/run',args)[0]);self.assertEqual(result['counts'],local['counts'])
            html,headers=self.req('/reports/'+result['report_id']+'/download');self.assertIn('attachment',headers['Content-Disposition'])
            self.assertIn(b'QCU',html)
    def test_rules_copy(self):
        saved=json.loads(self.req('/api/rules',RULE)[0]);self.assertEqual(saved['source'],'personal');self.assertNotEqual(saved['id'],RULE['id'])
        self.assertEqual(self.server.store.rule(RULE['id']),RULE)
    def test_host_and_traversal(self):
        with self.assertRaises(HTTPError):self.req('/api/rules',headers={'Host':'evil.example'})
        with self.assertRaises(InputError):self.server.store.path('documents','../../bad','.docx')
if __name__=='__main__':unittest.main()
