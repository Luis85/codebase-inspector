"""Browser checks for the design reference, not for Obsidian or Three.js.
Requires playwright and an installed Chromium. No test server or network needed.
Use CHROMIUM_PATH to override the Chromium executable.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os, platform, time
ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text()
RESULTS=[]

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1440,'height':960},device_scale_factor=1)
        page=context.new_page()
        errors=[];requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url))
        def fresh(width=1440,height=960):
            page.evaluate('window.__CI_REVIEW__?.dispose()')
            page.set_viewport_size({'width':width,'height':height})
            page.set_content(HTML,wait_until='load');page.wait_for_timeout(180)
        def s(): return page.evaluate('window.__CI_REVIEW__.state()')
        def select(): page.locator('button.file-row[data-file-id="f072"]').click()
        def shot(name): page.screenshot(path=str(ROOT/'captures'/name))
        def check(name,fn):
            start=time.time()
            try:
                fresh();fn();RESULTS.append({'name':name,'status':'passed','durationMs':round((time.time()-start)*1000)})
            except Exception as e:
                RESULTS.append({'name':name,'status':'failed','error':str(e),'durationMs':round((time.time()-start)*1000)})
                shot('FAILED-'+str(len(RESULTS))+'.png')
        def assert_equal(a,b):
            assert a==b,(a,b)
        check('B01 Offline initial inventory has 144 files and no selected file',lambda:(assert_equal(page.locator('#table-body tr').count(),144),assert_equal(s()['selectedId'],None),shot('01-city.png')))
        def b02():
            before=s()['camera'];select();assert_equal(s()['camera'],before)
            assert_equal(page.evaluate('document.activeElement.dataset.fileId'),'f072')
            assert_equal(page.locator('#inspector-title').inner_text(),'city-layout.ts');shot('02-selected.png')
        check('B02 Selection preserves camera and keyboard focus',b02)
        def b03():
            select();page.locator('#close-inspector').click();assert_equal(s()['selectedId'],'f072')
            assert_equal(page.locator('#inspector').is_visible(),False)
            assert_equal(page.evaluate('document.activeElement.id'),'details-toggle')
            page.locator('#details-toggle').click();assert_equal(page.locator('#inspector').is_visible(),True)
        check('B03 Closing and reopening inspector preserves selection',b03)
        def b04():
            select();before=s()['camera'];page.locator('#file-search').fill('snapshot')
            assert_equal(s()['selectedId'],'f072');assert_equal(s()['camera'],before)
            assert page.locator('#filter-warning').is_visible();shot('03-selection-outside-search.png')
        check('B04 Search keeps selected nonmatch and exact camera state',b04)
        def b05():
            select();page.locator('#file-search').fill('layout');page.locator('#file-search').press('Escape')
            assert_equal(s()['query'],'');assert_equal(s()['selectedId'],'f072')
            assert_equal(page.evaluate('document.activeElement.id'),'file-search')
        check('B05 Search Escape clears only the query',b05)
        def b06():
            select();page.locator('#file-search').fill('layout');before=s()
            page.locator('#host-note-toggle').click();page.locator('#host-editor').fill('Host text')
            page.locator('#host-editor').press('Escape');page.locator('#host-editor').press('/')
            assert_equal(s(),before);assert_equal(page.evaluate('document.activeElement.id'),'host-editor')
            assert page.locator('#host-editor').input_value().endswith('/');shot('04-sibling-note.png')
        check('B06 Sibling note owns its typing, slash, and Escape',b06)
        def b07():
            page.locator('#zoom-in').click();before=s()['camera'];page.locator('#top-toggle').click()
            page.locator('#city-canvas').focus();page.keyboard.press('ArrowLeft')
            page.locator('#top-toggle').click();assert_equal(s()['camera'],before)
            page.locator('#top-toggle').click();shot('05-top-down.png')
        check('B07 Top-to-3D round trip restores prior camera',b07)
        def b08():
            select();page.locator('#city-canvas').focus();before=s()['camera']
            page.keyboard.press('Enter');assert s()['camera']!=before
            page.keyboard.press('f');assert_equal(s()['camera']['zoom'],1)
            assert_equal(s()['selectedId'],'f072')
        check('B08 Canvas Enter focuses and F fits without clearing selection',b08)
        def b09():
            select();c=page.locator('#city-canvas').bounding_box();before=s()['camera']
            page.mouse.move(c['x']+c['width']*.6,c['y']+c['height']*.5)
            page.mouse.down();page.mouse.move(c['x']+c['width']*.6+65,c['y']+c['height']*.5+20,steps=6);page.mouse.up()
            assert_equal(s()['selectedId'],'f072');assert s()['camera']!=before
        check('B09 Drag changes camera but never selects on release',b09)
        def b10():
            page.locator('#top-toggle').click();page.wait_for_timeout(120)
            p=page.evaluate('window.__CI_REVIEW__.projectedCenter("f084")')
            page.mouse.click(p['x'],p['y']);assert_equal(s()['selectedId'],'f084')
        check('B10 Pointer picking selects the visible file identity',b10)
        def b11():
            select();page.locator('#simulate-fallback').click();assert_equal(s()['selectedId'],'f072')
            assert_equal(page.locator('#table-body tr').count(),144);assert page.locator('#list-panel').is_visible()
            shot('06-html-fallback.png');page.locator('#simulate-fallback').click();assert_equal(s()['mode'],'3d')
        check('B11 Simulated rendering failure preserves complete HTML inventory',b11)
        def b12():
            page.set_viewport_size({'width':740,'height':900});page.wait_for_timeout(150)
            page.locator('#files-toggle').click();page.locator('#table-body button[data-file-id="f072"]').click()
            page.locator('#close-inspector').focus();shot('07-narrow-drawer.png')
            page.keyboard.press('Escape');assert_equal(s()['inspectorOpen'],False);assert_equal(s()['selectedId'],'f072')
            assert_equal(page.evaluate('document.activeElement.id'),'details-toggle')
        check('B12 Narrow drawer Escape closes only inspector and restores focus',b12)
        def b13():
            select();page.locator('#file-search').fill('layout');before=s()
            page.locator('#scan-trigger').click();assert page.locator('#scope-dialog').is_visible()
            for _ in range(14):
                page.keyboard.press('Tab');assert page.evaluate('document.getElementById("scope-dialog").contains(document.activeElement)')
            shot('08-scope-review.png');page.keyboard.press('Escape');assert_equal(s(),before)
            assert_equal(page.evaluate('document.activeElement.id'),'scan-trigger')
        check('B13 Modal traps focus and Escape returns without losing context',b13)
        def b14():
            page.locator('#scan-trigger').click();page.locator('#scope-consent').check();assert page.locator('#start-scan').is_enabled()
            page.keyboard.press('Escape');page.locator('#scan-trigger').click();assert not page.locator('#scope-consent').is_checked()
            assert page.locator('#start-scan').is_disabled()
        check('B14 Scan consent is reset for every new scope review',b14)
        def b15():
            select();page.locator('#file-search').fill('layout');before=s()
            page.locator('#scan-trigger').click();page.locator('#scope-consent').check();page.locator('#start-scan').click()
            page.wait_for_timeout(650);page.locator('#cancel-scan').click();page.wait_for_timeout(3200)
            assert_equal(s()['snapshotId'],before['snapshotId']);assert_equal(s()['selectedId'],'f072')
            assert_equal(s()['query'],'layout');assert_equal(s()['run']['status'],'cancelled');shot('09-cancelled-retains-snapshot.png')
        check('B15 Cancellation rejects late completion and retains the snapshot',b15)
        def b16():
            page.locator('#scan-trigger').click();page.locator('#scan-outcome').select_option('failed')
            page.locator('#scope-consent').check();page.locator('#start-scan').click();page.wait_for_timeout(3550)
            assert_equal(s()['run']['status'],'failed');assert_equal(s()['snapshotId'],'fixture-v1')
            assert 'previous snapshot' in page.locator('#banner-text').inner_text();shot('10-failed-refresh.png')
        check('B16 Failed refresh never replaces the last valid snapshot',b16)
        def b17():
            select();page.locator('#scan-trigger').click();page.locator('#scope-consent').check();page.locator('#start-scan').click();page.wait_for_timeout(3550)
            assert_equal(s()['snapshotId'],'fixture-v2');assert_equal(s()['selectedId'],'f072');assert_equal(s()['revision'],2)
        check('B17 Valid simulated refresh publishes exactly one new revision',b17)
        def b18():
            select();before=s()['camera'];page.locator('#file-search').fill('does-not-exist');page.locator('#file-search').press('Enter')
            assert_equal(page.locator('#table-body tr').count(),0);assert_equal(s()['selectedId'],'f072');assert_equal(s()['camera'],before)
        check('B18 Zero results never clear selection or move the camera',b18)
        def b19():
            page.locator('#file-search').fill('ÜBER');assert_equal(page.locator('#table-body tr').count(),1)
            page.locator('#file-search').press('Enter');assert 'überblick' in page.locator('#inspector-title').inner_text()
        check('B19 Non-ASCII path lookup and selection work',b19)
        def b20():
            page.wait_for_timeout(250);count=page.evaluate('window.__CI_REVIEW__.frames()');page.wait_for_timeout(600)
            assert_equal(page.evaluate('window.__CI_REVIEW__.frames()'),count)
        check('B20 Simulator does not continuously render while idle',b20)
        def b21():
            select();before=s();page.locator('#theme-select').select_option('light');page.wait_for_timeout(100)
            assert_equal(s(),before);shot('11-light-theme.png')
        check('B21 Theme preview preserves every interaction state field',b21)
        def b22():
            missing=page.locator('button').evaluate_all('(els)=>els.filter(e=>!e.textContent.trim()&&!e.getAttribute("aria-label")).length')
            assert_equal(missing,0)
        check('B22 Every button has visible text or an accessible label',b22)
        def b23():
            select();page.evaluate('Object.defineProperty(navigator,"clipboard",{value:undefined,configurable:true})')
            page.locator('#copy-path').click();assert page.locator('#copy-fallback').is_visible()
            assert_equal(page.locator('#copy-path-text').input_value(),'src/visualization/layout/city-layout.ts')
        check('B23 Clipboard failure exposes selectable relative path',b23)
        def b24():
            select();before=s()['selectedId'];page.set_viewport_size({'width':460,'height':900});page.wait_for_timeout(180)
            assert_equal(s()['selectedId'],before)
            assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
            shot('12-constrained-leaf.png')
        check('B24 Narrow review preserves selection without document overflow',b24)
        def b25():
            before=page.evaluate('window.__CI_REVIEW__.positions()');page.locator('#file-search').fill('layout')
            assert_equal(page.evaluate('window.__CI_REVIEW__.positions()'),before)
        check('B25 Search does not re-layout file coordinates',b25)
        def b26():
            select();page.locator('#file-search').fill('layout');before=s()
            page.locator('#file-search').dispatch_event('keydown',{'key':'Escape','code':'Escape','isComposing':True})
            assert_equal(s(),before)
        check('B26 IME composition does not dispatch Escape',b26)
        check('B27 No external network requests are made',lambda:assert_equal(requests,[]))
        check('B28 No browser script errors occurred',lambda:assert_equal(errors,[]))
        report={'scope':'Offline browser interaction reference only; not Obsidian, Three.js, or filesystem analysis',
                'browser':browser.version,'platform':platform.platform(),'rendering':'dependency-free Canvas 2D projection simulator',
                'passed':sum(x['status']=='passed' for x in RESULTS),'failed':sum(x['status']=='failed' for x in RESULTS),
                'pageErrors':errors,'networkRequests':requests,'tests':RESULTS}
        (ROOT/'validation/browser-results.json').write_text(json.dumps(report,indent=2))
        browser.close()
        print(json.dumps({'passed':report['passed'],'failed':report['failed'],'errors':errors},indent=2))
        for t in RESULTS:
            if t['status']=='failed': print(t['name'],t['error'])
        if report['failed']: raise SystemExit(1)
if __name__=='__main__':run()
