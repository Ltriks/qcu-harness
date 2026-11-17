import copy
from datetime import datetime, timezone
import hashlib
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
import uuid
from server import Server, Store

def sample():
    value=dict(schemaVersion=1,incidentId=str(uuid.uuid4()),createdAt=datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'),errorCode='QCU-ST-1204',stage='profile',buildId='rc43-maintenance.2',suiteVersion='0.1.0-rc.4.3',runtimeVersion='v24.18.1',platform='darwin',arch='arm64',osMajor='24',uploadState='local-only',sourceKind='self-test')
    value['fingerprint']=hashlib.sha256(json.dumps([1,value['errorCode'],value['stage'],value['buildId'],value['suiteVersion']],separators=(',',':')).encode()).hexdigest()
    return value

class Tests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.store=Store(Path(self.temp.name).resolve()/'store')
        self.server=Server(('127.0.0.1',0),self.store,'127.0.0.0/8')
        self.thread=threading.Thread(target=lambda:self.server.serve_forever(poll_interval=0.01),daemon=True)
        self.thread.start()
    def tearDown(self):
        self.server.shutdown();self.server.server_close();self.thread.join();self.temp.cleanup()
    def request(self, method, path, value=None, headers=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=3)
        try:
            conn.request(method,path,None if value is None else json.dumps(value),headers or ({'Content-Type':'application/json'} if value is not None else {}))
            response=conn.getresponse();return response.status,json.loads(response.read())
        finally:conn.close()
    def count(self):
        with self.store.connect() as conn:return conn.execute('SELECT count(*) FROM incidents').fetchone()[0]
    def test_receive_query_and_idempotence(self):
        value=sample();status,receipt=self.request('POST','/v1/incidents',value);self.assertEqual(status,201)
        self.assertEqual(self.request('POST','/v1/incidents',value),(200,receipt))
        self.assertEqual(self.request('GET','/v1/incidents/'+value['incidentId']+'/receipt'),(200,receipt));self.assertEqual(self.count(),1)
    def test_conflicting_reuse_refused(self):
        value=sample();self.request('POST','/v1/incidents',value)
        changed=copy.deepcopy(value);changed['sourceKind']='startup'
        self.assertEqual(self.request('POST','/v1/incidents',changed)[0],409);self.assertEqual(self.count(),1)
    def test_extra_private_data_refused(self):
        value=sample();value['rawConfig']='SYNTHETIC_PRIVATE_NEVER_STORE'
        self.assertEqual(self.request('POST','/v1/incidents',value)[0],400);self.assertEqual(self.count(),0)
    def test_invalid_fields_cannot_smuggle_text(self):
        for key,value in [('errorCode','/Users/private/key'),('buildId','sk-SYNTHETIC_PRIVATE'),('runtimeVersion','SYNTHETIC_PRIVATE'),('fingerprint','invalid')]:
            with self.subTest(key=key):
                report=sample();report[key]=value
                self.assertEqual(self.request('POST','/v1/incidents',report)[0],400)
        self.assertEqual(self.count(),0)
    def test_no_browser_cross_origin_or_public_listing(self):
        self.assertEqual(self.request('POST','/v1/incidents',sample(),{'Content-Type':'application/json','Origin':'http://untrusted.invalid'})[0],403)
        self.assertEqual(self.request('GET','/v1/incidents')[0],404)
    def test_per_fingerprint_limit_and_duplicates_still_work(self):
        reports=[sample() for _ in range(6)]
        for value in reports[:5]:self.assertEqual(self.request('POST','/v1/incidents',value)[0],201)
        self.assertEqual(self.request('POST','/v1/incidents',reports[5])[0],429)
        self.assertEqual(self.request('POST','/v1/incidents',reports[0])[0],200)
        self.assertEqual(self.count(),5)
    def test_rc45_schema_and_redaction_are_accepted(self):
        value=sample();value.update(buildId='rc45.1',suiteVersion='0.1.0-rc.4.5')
        value['fingerprint']=hashlib.sha256(json.dumps([1,value['errorCode'],value['stage'],value['buildId'],value['suiteVersion']],separators=(',',':')).encode()).hexdigest()
        self.assertEqual(self.request('POST','/v1/incidents',value)[0],201)
        value['privateText']='must never be stored'
        self.assertEqual(self.request('POST','/v1/incidents',value)[0],400)
    def test_health_does_not_reveal_reports(self):
        status,value=self.request('GET','/health');self.assertEqual(status,200);self.assertEqual(set(value),{'ok','service','schemaVersion'})
        self.assertEqual(self.store.path.stat().st_mode&0o777,0o600)

if __name__=='__main__':unittest.main()
