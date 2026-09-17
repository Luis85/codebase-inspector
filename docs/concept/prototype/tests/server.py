"""Verify the optional server's read-only loopback responses (not browser navigation)."""
from pathlib import Path
import subprocess, os, time, urllib.request, urllib.error, json, socket
R=Path(__file__).resolve().parents[1]
s=socket.socket();s.bind(('127.0.0.1',0));port=s.getsockname()[1];s.close()
p=subprocess.Popen(['node','serve.mjs'],cwd=R,env={**os.environ,'PORT':str(port)},stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
checks=[]
def request(path='/',method='GET',host=None):
    req=urllib.request.Request(f'http://127.0.0.1:{port}{path}',method=method,headers={'Host':host} if host else {})
    try:
        with urllib.request.urlopen(req,timeout=3) as r:return r.status,dict(r.headers),r.read()
    except urllib.error.HTTPError as e:return e.code,dict(e.headers),e.read()
try:
    for _ in range(30):
        try:
            code,headers,data=request();break
        except (urllib.error.URLError,ConnectionError):time.sleep(.1)
    assert code==200 and b'Codebase Inspector' in data;checks.append('GET / serves demo HTML')
    code,headers,data=request('/viewer.bundle.js');assert code==200 and b'WebGLRenderer' in data;checks.append('Local bundled viewer served with JavaScript media type')
    assert 'javascript' in headers['Content-Type']
    code,headers,data=request('/standalone.html','HEAD');assert code==200 and not data;checks.append('HEAD returns metadata without response body')
    assert request('/','POST')[0]==405;checks.append('Writes/methods rejected')
    assert request('/',host='untrusted.invalid')[0]==403;checks.append('Non-loopback Host rejected')
    assert request('/%2e%2e%2f%2e%2e%2fetc/passwd')[0]==403;checks.append('Encoded traversal rejected')
    assert request('/not-a-demo-file')[0]==404;checks.append('Missing resource returns 404')
finally:
    p.terminate();p.communicate(timeout=3)
(R/'validation/server-results.json').write_text(json.dumps({'passed':len(checks),'failed':0,'checks':checks,'note':'Requests from Python local HTTP client; not a browser-navigation test.'},indent=2))
print('Optional server:',len(checks),'passed')
