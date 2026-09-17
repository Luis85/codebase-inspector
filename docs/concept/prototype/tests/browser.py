"""Exercise the unmodified single-file artifact in Chromium with real WebGL2.
Run: xvfb-run -a -s '-screen 0 1600x1000x24' python tests/browser.py
This environment blocks URL navigation; set_content injects the actual local HTML.
No renderer or WebGL calls are mocked. Software rendering is not a GPU benchmark.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time,os
ROOT=Path(__file__).resolve().parents[1]
results=[]
def check(name, action):
    start=time.time()
    try:
        action()
        results.append({'name':name,'status':'passed','seconds':round(time.time()-start,3)})
        print('PASS',name,flush=True)
    except Exception as exc:
        results.append({'name':name,'status':'failed','error':str(exc),'seconds':round(time.time()-start,3)})
        print('FAIL',name,str(exc),flush=True)
def expect(value,message='Assertion failed'):
    if not value: raise AssertionError(message)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=False,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1540,'height':980},device_scale_factor=1)
    page.set_default_timeout(5000)
    errors=[];messages=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:messages.append({'type':m.type,'text':m.text}))
    page.on('request',lambda r:requests.append(r.url))
    page.set_content((ROOT/'standalone.html').read_text(),wait_until='load')
    page.wait_for_function('window.CIDemo && window.CIDemo.viewer && window.CIDemo.viewer.frameCount > 0')
    camera=lambda:page.evaluate('CIDemo.viewer.getCameraState()')
    current=lambda:page.evaluate('CIDemo.getState().selected')
    def shot(name): page.screenshot(path=str(ROOT/'captures'/name),full_page=True)
    check('Actual WebGL2 renderer and exact Three.js r140 runtime',lambda:expect(page.evaluate("CIDemo.viewer.renderer.getContext() instanceof WebGL2RenderingContext && THREE.REVISION === '140'")))
    check('144 file buildings rendered as an InstancedMesh',lambda:expect(page.evaluate('CIDemo.viewer.buildings.isInstancedMesh && CIDemo.viewer.buildings.count === 144')))
    check('Unselected city uses 16 scene draw calls',lambda:expect(page.evaluate('CIDemo.viewer.getDiagnostics().drawCalls === 16')))
    shot('01-city-dark.png')
    def idle():
        page.wait_for_timeout(200);before=page.evaluate('CIDemo.viewer.frameCount');page.wait_for_timeout(400);expect(page.evaluate('CIDemo.viewer.frameCount')==before)
    check('On-demand renderer is idle without input',idle)
    target=page.evaluate("CIDemo.getState().snapshot.files.find(f=>f.name==='city-layout.ts')")
    def select_list():
        before=camera();page.get_by_role('button',name=target['path'],exact=True).click();expect(current()==target['id']);expect(camera()==before,'Selection moved the camera')
    check('File-list selection does not move camera',select_list)
    page.wait_for_timeout(100);shot('02-selected-file.png')
    def explicit_focus():
        before=camera();page.locator('#focus-file').click();expect(camera()!=before)
    check('Explicit Focus in city changes the camera',explicit_focus)
    def close_details():
        before=camera();page.locator('#close-inspector').click();expect(current()==target['id']);expect(camera()==before);page.locator('#details-button').click();expect(page.locator('#inspector h2').inner_text()==target['name'])
    check('Closing and reopening Details preserves selection and pose',close_details)
    def search_dim():
        before=page.evaluate('JSON.stringify([...CIDemo.viewer.layout.positions])');page.locator('#search').fill('snapshot');expect(current()==target['id']);expect(page.locator('#selection-filter-warning').is_visible());expect(page.evaluate('JSON.stringify([...CIDemo.viewer.layout.positions])')==before);expect(page.evaluate('CIDemo.viewer.buildings.count')==144)
    check('Search dims in place and retains out-of-filter selection',search_dim)
    page.locator('#fit-button').click();shot('03-search-context.png')
    def no_results():
        page.locator('#search').fill('no-match-89272');expect(page.locator('#file-count').inner_text()=='0 / 144');expect(page.evaluate('CIDemo.viewer.buildings.count')==144)
    check('Zero matches does not erase geometry or the snapshot',no_results)
    def search_escape():
        page.locator('#search').press('Escape');expect(page.locator('#search').input_value()=='');expect(current()==target['id'])
    check('Escape in search clears only the query',search_escape)
    def search_enter():
        page.locator('#search').fill('snapshot');before=camera();first=page.evaluate('CIDemo.matching()[0].id');page.locator('#search').press('Enter');expect(current()==first);expect(camera()==before)
    check('Enter in search selects the first match without focus movement',search_enter)
    page.locator('#search').fill('')
    def category():
        page.locator('#category-filter').select_option('Vue');expect(page.evaluate('CIDemo.matching().length')==24);expect(page.locator('#selection-filter-warning').is_visible());page.locator('#category-filter').select_option('all')
    check('File-kind filter synchronizes list, city, and selection warning',category)
    def top_restore():
        page.locator('#fit-button').click();before=camera();page.locator('#mode-top').click();page.locator('#zoom-in').click();page.evaluate('CIDemo.viewer.pan(30,20)');shot('04-top-view.png');page.locator('#mode-3d').click();expect(camera()==before,'Top view did not restore the exact 3D bookmark')
    check('Top view restores the full prior 3D camera bookmark',top_restore)
    def ray_pick():
        page.evaluate('CIDemo.clearSelection()');page.locator('#fit-button').click()
        hit=page.evaluate("""() => {const v=CIDemo.viewer;for(const f of CIDemo.getState().snapshot.files){const p=v.projectFile(f.id);if(p?.visible&&v.pick(p.x,p.y)?.id===f.id)return {...p,id:f.id};}return null;}""")
        expect(hit is not None,'No raycast target found');before=camera();page.mouse.click(hit['x'],hit['y']);expect(current()==hit['id']);expect(camera()==before)
    check('Pointer selection is driven by actual Three.js raycasting',ray_pick)
    def orbit_drag():
        b=page.locator('#city-canvas').bounding_box();x=b['x']+b['width']*.6;y=b['y']+b['height']*.55;before=camera();s=current();page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+70,y+25,steps=6);page.mouse.up();expect(camera()!=before);expect(current()==s,'Drag accidentally selected a file')
    check('Primary drag orbits without accidental selection',orbit_drag)
    def pan_drag():
        b=page.locator('#city-canvas').bounding_box();x=b['x']+b['width']*.6;y=b['y']+b['height']*.55;before=camera();page.keyboard.down('Shift');page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+35,y+20,steps=4);page.mouse.up();page.keyboard.up('Shift');expect(camera()['target']!=before['target']);expect(camera()['theta']==before['theta'])
    check('Shift-drag pans instead of orbiting',pan_drag)
    def wheel():
        page.locator('#city-canvas').focus();before=camera()['zoom'];page.mouse.wheel(0,-120);page.wait_for_timeout(80);expect(camera()['zoom']>before)
    check('Wheel zoom works over the focused canvas',wheel)
    def keys():
        page.locator('#city-canvas').focus();page.keyboard.press('f');before=camera();page.keyboard.press('t');expect(camera()['mode']=='top');page.keyboard.press('t');expect(camera()==before);page.keyboard.press('/');expect(page.locator('#search').evaluate('(e)=>e===document.activeElement'))
    check('Canvas shortcuts and scoped search shortcut work',keys)
    def editable():
        page.locator('#search').fill('');page.locator('#search').press('t');expect(page.locator('#search').input_value()=='t');expect(camera()['mode']=='3d');page.locator('#search').fill('')
    check('Typing into search does not trigger camera shortcuts',editable)
    def metric():
        before=camera();page.locator('#height-metric').select_option('bytes');expect(page.evaluate('CIDemo.viewer.metric')=='bytes');expect(camera()==before);page.locator('#height-metric').select_option('lines')
    check('Changing height metric preserves camera state',metric)
    def labels_shadows():
        page.locator('#labels-button').click();expect(page.locator('#district-labels').is_hidden());page.locator('#labels-button').click();page.locator('#shadows-button').click();expect(not page.evaluate('CIDemo.viewer.renderer.shadowMap.enabled'));page.locator('#shadows-button').click()
    check('Label and shadow switches control real scene state',labels_shadows)
    def html_view():
        before=current();page.locator('#mode-list').click();expect(page.locator('#inventory-body tr').count()==144);expect(current()==before);n=page.evaluate('CIDemo.viewer.frameCount');page.wait_for_timeout(180);expect(page.evaluate('CIDemo.viewer.frameCount')==n);shot('05-html-inventory.png');page.locator('#restore-3d').click();expect(current()==before)
    check('HTML inventory shares selection and suspends drawing',html_view)
    def theme():
        page.locator('#fit-button').click();page.locator('#theme-button').click();expect(page.locator('html').get_attribute('data-theme')=='light');expect(page.evaluate('CIDemo.viewer.theme')=='light');page.wait_for_timeout(100);shot('06-city-light.png');page.locator('#theme-button').click()
    check('Light and dark themes update both UI and WebGL scene',theme)
    def invalid():
        before=page.evaluate('CIDemo.getState().snapshot.files.length');page.locator('#snapshot-input').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{bad'});page.locator('#error-dialog').wait_for(state='visible');expect(page.evaluate('CIDemo.getState().snapshot.files.length')==before);page.locator('#error-done').click()
    check('Malformed JSON import retains the previous snapshot',invalid)
    def raw_fallow():
        page.locator('#snapshot-input').set_input_files({'name':'fallow.json','mimeType':'application/json','buffer':b'{"unusedFiles":[]}'});page.locator('#error-dialog').wait_for(state='visible');expect('adapter' in page.locator('#error-description').inner_text());page.locator('#error-done').click()
    check('Raw fallow output is explicitly rejected without an adapter',raw_fallow)
    sample={'schemaVersion':1,'name':'Imported example','files':[{'path':'src/énergie/Öffnung.ts','lines':0,'bytes':0},{'path':'src/domain/unknown.ts','lines':None,'bytes':None},{'path':'src/domain/<img onerror=alert(1)>.ts','lines':2,'bytes':90}]}
    def imported():
        page.locator('#snapshot-input').set_input_files({'name':'sample.json','mimeType':'application/json','buffer':json.dumps(sample).encode()});page.wait_for_function('CIDemo.getState().snapshot.files.length===3');expect(page.evaluate('CIDemo.viewer.buildings.count')==3);expect('Imported' in page.locator('#source-description').inner_text())
    check('JSON file input imports actual custom snapshot data',imported)
    def unicode():
        page.locator('#search').fill('öffnung');expect(page.evaluate('CIDemo.matching().length')==1);page.locator('#search').press('Enter');expect('0' in page.locator('#inspector-content').inner_text());page.locator('#search').fill('unknown');page.locator('#search').press('Enter');expect('Unavailable' in page.locator('#inspector-content').inner_text());expect('does not mean zero' in page.locator('#inspector-content').inner_text())
    check('Unicode search and unknown-versus-zero measurements are distinct',unicode)
    def escaped():
        page.locator('#search').fill('<img');page.locator('#search').press('Enter');expect(page.locator('#inspector-content img').count()==0);expect('<img onerror=alert(1)>.ts' in page.locator('#inspector-content').inner_text())
    check('Imported markup is displayed as text, not executed',escaped)
    def empty():
        page.evaluate("CIDemo.publishSnapshot({schemaVersion:1,name:'Empty',files:[]})");expect(page.locator('#empty-scene').is_visible());expect(page.evaluate('CIDemo.viewer.buildings.count')==0);page.locator('#reset-demo').click()
    check('Empty snapshot renders an explicit empty state',empty)
    def resources():
        page.wait_for_timeout(60);base=page.evaluate('CIDemo.viewer.getDiagnostics().geometries')
        for _ in range(5):page.locator('#reset-demo').click();page.wait_for_timeout(45)
        expect(page.evaluate('CIDemo.viewer.getDiagnostics().geometries')==base,'Geometry count grew across repeated snapshot loads')
    check('Repeated snapshot loads do not grow geometry allocations',resources)
    def lose_context():
        page.evaluate('CIDemo.selectFile(CIDemo.getState().snapshot.files[10].id)');s=current();page.locator('#help-button').click();page.locator('#context-test-button').click();page.wait_for_function('CIDemo.viewer.contextLost');expect(page.locator('#inventory-panel').is_visible());expect(current()==s);shot('07-context-loss.png');page.wait_for_timeout(200);page.locator('#restore-3d').click();page.wait_for_function('!CIDemo.viewer.contextLost && CIDemo.getState().view === "3d"');expect(current()==s)
    check('Actual WebGL context loss and restoration preserve data and selection',lose_context)
    def narrow():
        page.set_viewport_size({'width':430,'height':900});page.locator('#close-inspector').click();page.locator('#fit-button').click();page.wait_for_timeout(100);expect(page.evaluate('document.documentElement.scrollWidth <= innerWidth'));shot('08-narrow-city.png');page.locator('#details-button').click();shot('09-narrow-details.png');expect(page.locator('#close-inspector').is_visible());page.locator('#close-inspector').click();page.set_viewport_size({'width':1540,'height':980});page.locator('#details-button').click();page.locator('#fit-button').click()
    check('Narrow layout retains controls without document overflow',narrow)
    def stress():
        page.evaluate("CIDemo.publishSnapshot({schemaVersion:1,name:'5,000-file synthetic stress fixture',source:'synthetic',files:Array.from({length:5000},(_,i)=>({path:`src/group-${i%12}/file-${String(i).padStart(5,'0')}.ts`,lines:20+(i%800),bytes:40*(20+(i%800))}))})")
        page.wait_for_function('CIDemo.viewer.instanceFiles.length===5000 && CIDemo.viewer.frameCount>0');page.wait_for_timeout(400);expect(page.evaluate('CIDemo.viewer.buildings.count')==5000);expect(page.locator('.file-row').count()<=600);shot('10-large-inventory.png');page.locator('#reset-demo').click()
    check('5,000 files render with bounded HTML list population',stress)
    def png():
        data=page.evaluate('CIDemo.viewer.capture()');expect(data.startswith('data:image/png;base64,'));expect(len(data)>5000)
    check('Real scene capture returns PNG image data',png)
    check('No script errors during interaction checks',lambda:expect(not errors,str(errors)))
    check('Standalone artifact makes no network requests',lambda:expect(not requests,str(requests)))
    info=page.evaluate("""() => {const gl=CIDemo.viewer.renderer.getContext();return {version:gl.getParameter(gl.VERSION),shading:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),runtime:THREE.REVISION,diagnostics:CIDemo.viewer.getDiagnostics()};}""")
    check('Viewer disposal stops work and removes labels',lambda:(page.evaluate('CIDemo.dispose()'),expect(page.locator('#district-labels').inner_html()=='')))
    report={'environment':'Chromium 144, headed under Xvfb, ANGLE SwiftShader software WebGL2','execution':'Actual standalone HTML injected with Playwright set_content; URL and file navigation are blocked by environment policy. No WebGL mocking.','results':results,'errors':errors,'console':messages,'networkRequests':requests,'engine':info,'passed':sum(r['status']=='passed' for r in results),'failed':sum(r['status']=='failed' for r in results),'limitations':['Not tested inside Obsidian','No hardware GPU performance claim','Direct file:// navigation is not verified in this managed browser','Touch behavior still requires real-device testing']}
    (ROOT/'validation/browser-results.json').write_text(json.dumps(report,indent=2))
    print('TOTAL',report['passed'],'passed',report['failed'],'failed',flush=True)
    browser.close()
    if report['failed']:raise SystemExit(1)
