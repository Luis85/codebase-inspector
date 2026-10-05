from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
ROUTES=['city','overview','architecture','hotspots','quality','tests','dependencies','security','evolution','ownership','workbench','report','sources','settings','file']
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for theme in ['dark','light']:
  ctx=b.new_context(viewport={'width':1600,'height':1050},device_scale_factor=1,accept_downloads=True)
  page=ctx.new_page();page.set_content((ROOT/'index.html').read_text(encoding='utf-8'),wait_until='load')
  page.evaluate('(t)=>{CIPrototype.state.theme=t;CIPrototype.render()}',theme)
  for r in ROUTES:
   page.evaluate('(r)=>CIPrototype.navigate(r)',r);page.wait_for_timeout(70)
   page.screenshot(path=str(ROOT/'screenshots'/f'{r}-{theme}.png'))
  if theme=='dark':
   for action,name in [('export-fixture','sample-evidence.json'),('export-state','sample-review-state.json')]:
    with page.expect_download() as dl:page.evaluate('(a)=>CIPrototype.actions[a]()',action)
    dl.value.save_as(ROOT/'examples'/name)
  ctx.close()
 b.close()
print('Captured 30 clean primary-screen images and two valid sample exports.')
