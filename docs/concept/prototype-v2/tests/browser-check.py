"""Actual browser/WebGL interaction checks for the concept-city revision.
Run: xvfb-run -a -s '-screen 0 1920x1200x24' python3 tests/browser-check.py
The environment blocks file://, so we inject the unchanged standalone HTML.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, time
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def check(name,result):
 assert result,name
 checks.append(name)
 print('PASS',len(checks),name,flush=True)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=browser.new_page(viewport={'width':1680,'height':1050},device_scale_factor=1)
 errors=[];console=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:console.append({'type':m.type,'text':m.text[:1200]}))
 page.on('request',lambda r:requests.append(r.url))
 page.set_content((ROOT/'index.html').read_text(),wait_until='load');page.wait_for_timeout(700)
 def until(expression,timeout=15):
  deadline=time.monotonic()+timeout
  while time.monotonic()<deadline:
   if page.evaluate(expression): return
   page.wait_for_timeout(50)
  raise AssertionError('Timed out: '+expression)
 settle=lambda:until('__CI_REVIEW__.renderer().pending===0')
 state=lambda:page.evaluate('__CI_REVIEW__.state()')
 stats=lambda:page.evaluate('__CI_REVIEW__.stats()')
 check('Real Three.js r184 / WebGL2 starts',stats()['revision']=='184' and page.evaluate('__CI_REVIEW__.renderer().renderer.getContext() instanceof WebGL2RenderingContext'))
 check('144 file records render as 144 pickable buildings',stats()['buildings']==144 and page.locator('#table-body tr').count()==144)
 check('Overview totals derive from fixture',page.locator('#stat-lines').inner_text()=='42,608' and page.locator('#stat-files').inner_text()=='144')
 check('All 30 sample connections aggregate into 11 district routes',stats()['displayedLinks']==11)
 page.screenshot(path=str(ROOT/'captures/01-concept-city-dark.png'))
 before=state()['camera'];page.locator('.file-row[data-file-id="f072"]').click();page.wait_for_timeout(180);settle()
 check('Selecting a file does not move camera',state()['camera']==before and state()['selectedId']=='f072')
 check('Inspector shows exact selected measurements',page.locator('#inspector-lines').inner_text()=='342' and page.locator('#inspector-title').inner_text()=='city-layout.ts')
 check('Selection switches route overlay to its five connections',stats()['displayedLinks']==5)
 page.screenshot(path=str(ROOT/'captures/02-selected-dark.png'))
 page.locator('#tab-connections').click()
 check('Connection inspector shows linked endpoints',page.locator('#connection-list .connection-row').count()==5 and page.locator('#file-connections').is_visible())
 page.screenshot(path=str(ROOT/'captures/04-connections.png'))
 before=state()['camera'];page.locator('#connection-list .connection-row').first.click()
 check('Following a connection changes selection without camera jump',state()['selectedId']=='f000' and state()['camera']==before)
 page.locator('#tab-overview').click();page.evaluate("__CI_REVIEW__.select('f072')")
 page.locator('#focus-file').click();page.wait_for_timeout(180);settle()
 check('Explicit focus changes camera target and zoom',state()['camera']['zoom']==2.1 and state()['camera']!=before)
 page.screenshot(path=str(ROOT/'captures/05-focused-file.png'))
 page.locator('#fit-city').click();before=state()['camera'];page.locator('#top-toggle').click();page.wait_for_timeout(180);settle()
 check('Top-down mode uses top camera',state()['mode']=='top')
 page.screenshot(path=str(ROOT/'captures/06-top-view.png'))
 page.locator('#top-toggle').click();check('Returning to 3D restores prior camera',state()['camera']==before)
 positions=page.evaluate('__CI_REVIEW__.positions()');geometry=stats()['geometries']
 page.locator('#file-search').fill('snapshot');page.wait_for_timeout(180);settle()
 check('Search preserves selection and explains hidden match',state()['selectedId']=='f072' and page.locator('#filter-warning').is_visible())
 check('Filtering does not rearrange buildings',page.evaluate('__CI_REVIEW__.positions()')==positions)
 page.screenshot(path=str(ROOT/'captures/07-search.png'))
 page.locator('#file-search').press('Escape');check('Escape in search clears only the query',state()['query']=='' and state()['selectedId']=='f072')
 page.locator('#links-toggle').uncheck();page.wait_for_timeout(130);settle()
 check('Connections toggle clears actual arc geometry',page.evaluate('__CI_REVIEW__.renderer().linkGroup.children.length')==0)
 page.locator('#links-toggle').check();page.wait_for_timeout(130);settle()
 check('Connections restore without changing file selection',stats()['displayedLinks']==5 and state()['selectedId']=='f072')
 page.locator('#detail-toggle').uncheck();page.wait_for_timeout(130);settle()
 check('Detail toggle disables facade uniform and rooftop detail',page.evaluate('__CI_REVIEW__.renderer().facadeUniforms.uDetail.value')==0 and not page.evaluate('__CI_REVIEW__.renderer().roofTops.visible'))
 page.locator('#detail-toggle').check();page.locator('#labels-toggle').uncheck();page.wait_for_timeout(100);settle()
 check('Label toggle hides projected HTML labels',page.evaluate('__CI_REVIEW__.renderer().labels.hidden'))
 page.locator('#labels-toggle').check();page.locator('#lens-select').select_option('category');page.wait_for_timeout(100);settle()
 check('Category lens recolors without changing geometry count',page.evaluate('__CI_REVIEW__.renderer().lens')=='category' and stats()['geometries']==geometry)
 page.locator('#lens-select').select_option('directory');page.locator('#theme-select').select_option('light');page.wait_for_timeout(200);settle()
 check('Light theme updates both UI and shader',page.evaluate('document.body.dataset.theme')=='light' and page.evaluate('__CI_REVIEW__.renderer().facadeUniforms.uNight.value')==.1)
 page.screenshot(path=str(ROOT/'captures/03-selected-light.png'));page.locator('#theme-select').select_option('dark');page.wait_for_timeout(130);settle()
 before=state()['selectedId'];page.locator('#close-inspector').click();check('Closing inspector preserves selected file and reveals overview',state()['selectedId']==before and page.locator('#overview-panel').is_visible())
 page.locator('[data-district="src/adapters"]').click();check('District list focuses the corresponding district',state()['camera']['x']==21 and state()['camera']['z']==-10.5)
 page.locator('#fit-city').click();box=page.locator('#minimap').bounding_box();page.mouse.click(box['x']+box['width']*.2,box['y']+box['height']*.7)
 check('Mini-map click focuses a district',state()['camera']['zoom']==1.8)
 page.locator('#fit-city').click();page.locator('#details-toggle').click();check('Details reopens the same selected file',page.locator('#inspector').is_visible() and state()['selectedId']==before)
 page.locator('#files-toggle').click();check('HTML inventory preserves selected file',page.locator('#list-panel').is_visible() and state()['selectedId']==before)
 page.screenshot(path=str(ROOT/'captures/08-file-inventory.png'));page.locator('#return-city').click()
 # Keyboard focus ownership, including a sibling editor and ARIA tab navigation.
 page.locator('#host-note-toggle').click();before=state();page.locator('#host-editor').fill('f / t +');page.locator('#host-editor').press('Escape')
 check('Sibling note input does not trigger city shortcuts',state()==before);page.locator('#host-note-toggle').click()
 page.locator('#tab-overview').focus();page.locator('#tab-overview').press('ArrowRight')
 check('Inspector tabs support keyboard arrow navigation',page.locator('#tab-connections').get_attribute('aria-selected')=='true' and page.locator('#tab-connections').evaluate('(e)=>e===document.activeElement'))
 page.locator('#tab-overview').click();page.locator('#close-inspector').click();page.wait_for_timeout(100);settle()
 c=page.locator('#city-canvas');rect=c.bounding_box();x=rect['x']+rect['width']*.5;y=rect['y']+rect['height']*.5
 before=state()['camera'];page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+80,y+20,steps=6);page.mouse.up()
 check('Pointer drag orbits the actual camera',state()['camera']['yaw']!=before['yaw'])
 page.mouse.move(x,y);page.keyboard.down('Shift');page.mouse.down();page.mouse.move(x+60,y+20,steps=5);page.mouse.up();page.keyboard.up('Shift')
 check('Shift-drag pans camera target',state()['camera']['x']!=before['x'])
 before=state()['camera']['zoom'];c.focus();page.mouse.wheel(0,-100);page.wait_for_timeout(100);settle()
 check('Focused wheel zoom changes camera scale',state()['camera']['zoom']>before)
 page.locator('#fit-city').click();page.evaluate("__CI_REVIEW__.dispatch({type:'CAMERA_CHANGED',camera:{yaw:.44,pitch:.71}})");page.wait_for_timeout(200);settle()
 hit=page.evaluate('''()=>{const v=__CI_REVIEW__.renderer(),r=v.canvas.getBoundingClientRect();for(let y=90;y<r.height-35;y+=12)for(let x=50;x<r.width-170;x+=12){const id=v.pick(x,y);if(id)return{x:x+r.left,y:y+r.top,id};}return null}''')
 check('Raycaster finds a real building instance',bool(hit));page.mouse.click(hit['x'],hit['y']);check('Clicking a raycast hit selects that file',state()['selectedId']==hit['id'])
 page.mouse.move(8,8);page.wait_for_timeout(200);settle();frame=stats()['frames'];page.wait_for_timeout(250);settle()
 check('Renderer stops drawing while idle',stats()['frames']==frame)
 png=page.evaluate('__CI_REVIEW__.renderer().capture()');check('PNG export comes from the rendered canvas',png.startswith('data:image/png;base64,') and len(png)>20000)
 # Modal / refreshed state: the fixture is never replaced by a stale partial result.
 def refresh(outcome):
  page.locator('#scan-trigger').click();page.locator('#scan-outcome').select_option(outcome);page.locator('#scope-consent').check();page.locator('#start-scan').click()
 before=state()['snapshotId'];refresh('complete');page.wait_for_timeout(500);settle();page.locator('#cancel-scan').click();page.wait_for_timeout(3150)
 check('Cancelled refresh rejects late completion callbacks',state()['snapshotId']==before and state()['run']['status']=='cancelled')
 refresh('failed');page.wait_for_timeout(3500);check('Failed refresh preserves prior snapshot',state()['snapshotId']==before and state()['run']['status']=='failed')
 refresh('complete');page.wait_for_timeout(3500);check('Successful simulated refresh advances only the snapshot revision',state()['snapshotId']!=before and state()['run']['status']=='complete')
 page.locator('#dismiss-banner').click()
 # Actual graphics loss, not just the demo fallback switch.
 page.evaluate("window.testLoss=__CI_REVIEW__.renderer().renderer.getContext().getExtension('WEBGL_lose_context');testLoss.loseContext()")
 until("__CI_REVIEW__.state().mode==='list'")
 check('Real context loss retains inventory and disables blank-city return',page.locator('#list-panel').is_visible() and page.locator('#files-toggle').is_disabled())
 page.wait_for_timeout(250);settle();page.evaluate('testLoss.restoreContext()');until("!__CI_REVIEW__.renderer().contextLost");page.wait_for_timeout(600);settle()
 check('Real context restore returns to the working 3D view',page.locator('#city-panel').is_visible() and not page.locator('#files-toggle').is_disabled())
 # Resources: repeated selected/overview overlays must return to the same count.
 page.evaluate("__CI_REVIEW__.dispatch({type:'SELECTION_CLEARED'})");page.wait_for_timeout(150);settle();base=stats()['geometries']
 for i in range(5):
  page.evaluate("__CI_REVIEW__.select('f072')");page.wait_for_timeout(35);settle();page.evaluate("__CI_REVIEW__.dispatch({type:'SELECTION_CLEARED'})");page.wait_for_timeout(35);settle()
 check('Repeated arc rebuilds do not accumulate geometries',stats()['geometries']==base)
 page.set_viewport_size({'width':700,'height':900});page.evaluate("__CI_REVIEW__.select('f072')");page.wait_for_timeout(300);settle()
 check('Narrow leaf exposes a usable inspector drawer',page.locator('#inspector').is_visible() and page.locator('#context-panel').bounding_box()['width']<=295)
 page.screenshot(path=str(ROOT/'captures/09-narrow-leaf.png'));page.locator('#close-inspector').click();page.wait_for_timeout(150);settle()
 check('Narrow city has no document horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 page.screenshot(path=str(ROOT/'captures/10-narrow-city.png'))
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200);settle()
 check('Small viewport retains toolbar and avoids horizontal overflow',page.locator('#file-search').is_visible() and page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
 page.screenshot(path=str(ROOT/'captures/11-small-viewport.png'))
 check('No runtime network requests',not requests)
 check('No JavaScript page errors or shader compile errors',not errors and not [m for m in console if m['type']=='error'])
 check('No graphics warnings after context recovery and repeated disposal',not [m for m in console if m['type']=='warning'])
 page.evaluate('__CI_REVIEW__.dispose()');check('Dispose stops the renderer and releases owned resources',page.evaluate('__CI_REVIEW__.renderer().disposed') and page.evaluate('__CI_REVIEW__.renderer().resources.size')==0)
 result={'passed':len(checks),'checks':checks,'pageErrors':errors,'console':console,'requests':requests,'browser':browser.version,'environment':'Linux / Xvfb / ANGLE SwiftShader / WebGL2; unchanged HTML loaded with set_content; file:// blocked by environment policy','screenshots':'captures/','limitations':['Not tested inside Obsidian','Native file opening and OS download completion not empirically tested','Physical GPUs and touch hardware not tested','Screen-reader and custom theme testing outstanding','Fixture-limited layout; no live scanner']}
 (ROOT/'validation/browser-results.json').write_text(json.dumps(result,indent=2))
 print('TOTAL',len(checks),flush=True);browser.close()
