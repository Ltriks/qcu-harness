"""Import a fixed-field, read-only export from the legacy receiver; never overwrite conflicts."""
import argparse,json,hashlib
from server import Store,validate,canonical
p=argparse.ArgumentParser();p.add_argument('file');p.add_argument('--root',required=True);a=p.parse_args()
rows=json.load(open(a.file));store=Store(a.root);added=0
with store.connect() as c:
 c.execute('BEGIN IMMEDIATE')
 for row in rows:
  if not isinstance(row,list) or len(row)!=5:raise ValueError('invalid export')
  key,digest,payload,received,fingerprint=row;report=validate(json.loads(payload))
  if key!=report['incidentId'] or fingerprint!=report['fingerprint'] or hashlib.sha256(canonical(report).encode()).hexdigest()!=digest:raise ValueError('invalid history integrity')
  prior=c.execute('SELECT digest FROM incidents WHERE id=?',(key,)).fetchone()
  if prior and prior[0]!=digest:raise ValueError('conflicting history')
  if not prior:c.execute('INSERT INTO incidents VALUES(?,?,?,?,?)',row);added+=1
print(json.dumps({'exported':len(rows),'imported':added,'idsAndTimestampsPreserved':True}))
