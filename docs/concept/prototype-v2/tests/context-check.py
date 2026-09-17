"""Regression test: resource ownership across actual loss/restoration."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 page=b.new_page(viewport={'width':1200,'height':800});logs=[];errors=[]
 page.on('console',lambda m:logs.append({'type':m.type,'text':m.text}));page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((ROOT/'index.html').read_text());page.wait_for_timeout(500)
 def wait(expr):
  for _ in range(200):
   if page.evaluate(expr):return
   page.wait_for_timeout(50)
  raise AssertionError(expr)
 wait('__CI_REVIEW__.renderer().pending===0')
 page.evaluate("window.loss=__CI_REVIEW__.renderer().renderer.getContext().getExtension('WEBGL_lose_context');loss.loseContext()")
 wait('__CI_REVIEW__.renderer().contextLost');page.wait_for_timeout(250);page.evaluate('loss.restoreContext()');wait('!__CI_REVIEW__.renderer().contextLost');wait('__CI_REVIEW__.renderer().pending===0')
 for i in range(3):
  page.evaluate("__CI_REVIEW__.select('f072')");wait('__CI_REVIEW__.renderer().pending===0');page.evaluate("__CI_REVIEW__.dispatch({type:'SELECTION_CLEARED'})");wait('__CI_REVIEW__.renderer().pending===0')
 page.evaluate('__CI_REVIEW__.dispose()');page.wait_for_timeout(250)
 result={'pageErrors':errors,'console':logs,'passed':not errors and not [x for x in logs if x['type'] in ('warning','error')]}
 (ROOT/'validation/context-results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));b.close()
 assert result['passed']
