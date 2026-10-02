from playwright.sync_api import sync_playwright
from pathlib import Path
import tempfile
root=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
 ext=str(root/'extension/ocrtrabajo')
 with tempfile.TemporaryDirectory() as profile:
  ctx=p.chromium.launch_persistent_context(profile,channel='chromium',headless=True,args=['--no-sandbox','--disable-extensions-except='+ext,'--load-extension='+ext])
  worker=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
  def serve(route):
   rel=route.request.url.split('https://gpt2026.vercel.app/',1)[1].split('?')[0]
   file=root/'dist'/rel
   if file.is_dir():file=file/'index.html'
   route.fulfill(path=str(file))
  ctx.route('https://gpt2026.vercel.app/**',serve)
  ctx.route('https://intranet.autocarpe.com/**',lambda r:r.fulfill(content_type='text/html',body='<html><body><button role="tab" id="cliente-tab" aria-selected="true">Cliente</button><label for="nombre">Nombre</label><input id="nombre"><input type="password" id="secret"><button type="submit">Guardar</button></body></html>'))
  intranet=ctx.new_page();intranet.goto('https://intranet.autocarpe.com/expedientes/create');intranet.on('dialog',lambda d:d.accept())
  popup=ctx.new_page();popup.goto(worker.url.replace('background.js','popup.html'))
  result=popup.evaluate("""async()=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url?.startsWith('https://intranet.autocarpe.com/'));return await chrome.runtime.sendMessage({action:'scan',tabId:tab.id});}""")
  assert 'error' not in result,result
  assert len(result['sections'][0]['fields'])==1,result
  site=ctx.new_page();site.goto('https://gpt2026.vercel.app/ocrtrabajo/')
  site.wait_for_selector('#sources tr');site.locator('#import').click()
  site.wait_for_selector('#mapping input[type=checkbox]')
  site.locator('#mapping input[type=checkbox]').check();site.locator('#mapping select').select_option('nombre')
  site.locator('#sources tr').first.locator('input').nth(2).fill('ANA')
  site.locator('#fill').click()
  intranet.wait_for_function("document.querySelector('#nombre').value==='ANA'")
  site.wait_for_function("document.querySelector('#fill-status').textContent.includes('1 campos rellenados')")
  assert intranet.locator('#secret').input_value()==''
  print('Actual MV3 extension: scan -> background -> website import -> mapping -> confirmed fill passed.')
  ctx.close()
