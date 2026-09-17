"""Test the separate viewer bundle in the minimal independent host."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,time
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'embed-example.html').read_text()
html=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(ROOT/m[1]).read_text().replace('</script','<\\/script')+'</script>',html)
checks=[]
def check(name,value):
 assert value,name
 checks.append(name)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1280,'height':900});errs=[];logs=[];requests=[]
 page.on('pageerror',lambda e:errs.append(str(e)));page.on('console',lambda m:logs.append({'type':m.type,'text':m.text}));page.on('request',lambda r:requests.append(r.url))
 page.set_content(html,wait_until='load');page.wait_for_timeout(300)
 def wait(expr):
  for _ in range(200):
   if page.evaluate(expr):return
   page.wait_for_timeout(50)
  raise AssertionError(expr)
 wait('viewer && viewer.pending===0')
 check('Independent host starts the bundled Three.js r184 viewer',page.evaluate("viewer.stats().revision==='184' && viewer.renderer.getContext() instanceof WebGL2RenderingContext"))
 check('Supplied fixture and edges produce 144 buildings / 11 routes',page.evaluate('viewer.stats().buildings===144 && viewer.stats().displayedLinks===11'))
 before=page.evaluate('JSON.stringify(state.camera)');page.evaluate("viewer.onSelect('f072')");wait('viewer.pending===0')
 check('Host callback handles selection without camera jump',page.evaluate('state.selectedId')=='f072' and page.evaluate('JSON.stringify(state.camera)')==before)
 page.locator('#focus').click();wait('viewer.pending===0');check('Host focus button uses public file position',page.evaluate('state.camera.zoom')==2.1)
 page.locator('#fit').click();wait('viewer.pending===0');check('Host fit button resets camera',page.evaluate('state.camera.zoom')==1)
 page.screenshot(path=str(ROOT/'captures/12-independent-viewer.png'))
 check('Independent host makes no network requests and has no errors',not requests and not errs and not [m for m in logs if m['type'] in ('warning','error')])
 page.evaluate('viewer.dispose()');page.wait_for_timeout(100);check('Host can dispose the viewer without warnings',page.evaluate('viewer.disposed') and not [m for m in logs if m['type'] in ('warning','error')])
 result={'passed':len(checks),'checks':checks,'pageErrors':errs,'console':logs,'requests':requests,'environment':'Chromium 144 / Xvfb / ANGLE SwiftShader / WebGL2; locally linked script files injected in the unchanged independent host'}
 (ROOT/'validation/embed-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));b.close()
