from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
ROUTES=['city','overview','architecture','hotspots','quality','tests','dependencies','security','evolution','ownership','workbench','report','sources','settings','file']
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':1600,'height':1050},device_scale_factor=1,accept_downloads=True)
 page=ctx.new_page();errors=[];requests=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.on('request',lambda r: requests.append(r.url) if r.url.startswith('http') else None)
 page.set_content((ROOT/'index.html').read_text(encoding='utf-8'),wait_until='load');page.wait_for_timeout(300)
 for route in ROUTES:
  page.evaluate('(r)=>window.CIPrototype.navigate(r)',route);page.wait_for_timeout(130)
  title=page.locator('main h1').inner_text()
  page.screenshot(path=str(ROOT/'screenshots'/f'{route}-dark.png'),full_page=False)
  unknown=page.locator('[data-action]').evaluate_all('(els)=>[...new Set(els.map(e=>e.dataset.action))].filter(a=>!window.CIPrototype.actions[a])')
  overflow=page.evaluate('document.documentElement.scrollWidth>window.innerWidth')
  results.append({'route':route,'title':title,'unknownActions':unknown,'horizontalOverflow':overflow})
 print(json.dumps({'screens':results,'jsErrors':errors,'networkRequests':requests},indent=2))
 (ROOT/'tests'/'smoke-results.json').write_text(json.dumps({'screens':results,'jsErrors':errors,'networkRequests':requests},indent=2))
 browser.close()
