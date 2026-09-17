"""Smoke-test the supplied embedding example using real software WebGL2.
The environment blocks URL navigation, so local script bytes are inlined for this check.
Run with the same Xvfb/Playwright environment as tests/browser.py.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,os
R=Path(__file__).resolve().parents[1]
html=(R/'embed.html').read_text()
for name in ['viewer.bundle.js','src/fixture.js']:
    js=(R/name).read_text().replace('</script','<\\/script')
    html=html.replace(f'<script src="{name}"></script>', '<script>'+js+'</script>')
checks=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=False,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=b.new_page(viewport={'width':1200,'height':850});errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='load');page.wait_for_function('city && city.frameCount > 0')
    assert page.evaluate('city.renderer.getContext() instanceof WebGL2RenderingContext && city.getDiagnostics().files === 144');checks.append('Independent viewer bundle renders 144 files in WebGL2')
    hit=page.evaluate("""() => {for(const f of CI_DEMO_SNAPSHOT.files){const p=city.projectFile(f.id||f.path);if(p&&city.pick(p.x,p.y)?.id===(f.id||f.path))return {...p,id:f.id||f.path};}return null;}""")
    assert hit;before=page.evaluate('city.getCameraState()');page.mouse.click(hit['x'],hit['y']);assert page.evaluate('selected')==hit['id'];assert page.evaluate('city.getCameraState()')==before;checks.append('Embedding selection callback updates state without moving camera')
    page.locator('#focus').click();assert page.evaluate('city.getCameraState()')!=before;checks.append('Embedding Focus control frames selected file')
    before=page.evaluate('city.getCameraState()');page.locator('#top').click();page.locator('#top').click();assert page.evaluate('city.getCameraState()')==before;checks.append('Embedding Top / 3D restores bookmark')
    assert page.evaluate("city.capture().startsWith('data:image/png;base64,')");checks.append('Embedding canvas capture returns PNG')
    page.screenshot(path=str(R/'captures/11-embedding-example.png'),full_page=True)
    assert not errors;checks.append('No embedding script errors')
    b.close()
(R/'validation/embed-results.json').write_text(json.dumps({'environment':'Headed Chromium144 / Xvfb / ANGLE SwiftShader','execution':'Embedding HTML with local script references inlined for managed-browser navigation restriction','passed':len(checks),'failed':0,'checks':checks,'errors':errors},indent=2))
print('Embedding:',len(checks),'passed')
