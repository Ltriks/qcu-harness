import base64,subprocess,sys
from pathlib import Path
script=Path(sys.argv[1]).read_text()
r=subprocess.run(['/usr/local/bin/prlctl','exec','{2ea2c08f-dcbd-4f23-8b6a-3f4e155cf15e}','--current-user','powershell.exe','-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(script.encode('utf-16le')).decode()],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=120)
text=r.stdout.decode('utf8',errors='replace');print(text);Path(sys.argv[1]).with_suffix('.log').write_text(text);raise SystemExit(r.returncode)
