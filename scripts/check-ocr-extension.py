from playwright.sync_api import sync_playwright
from pathlib import Path
import tempfile, json, base64
root=Path(__file__).resolve().parent.parent
with sync_playwright() as p:
 ext=str(root/'extension/ocrtrabajo')
 with tempfile.TemporaryDirectory() as profile:
  ctx=p.chromium.launch_persistent_context(profile,channel='chromium',headless=True,args=['--no-sandbox','--disable-extensions-except='+ext,'--load-extension='+ext])
  ctx.set_default_timeout(180000)
  worker=ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
  def serve(route):
   rel=route.request.url.split('https://gpt2026.vercel.app/',1)[1].split('?')[0]
   file=root/'dist'/rel
   if file.is_dir():file=file/'index.html'
   route.fulfill(path=str(file))
  ctx.route('https://gpt2026.vercel.app/**',serve)
  ctx.route('https://intranet.autocarpe.com/**',lambda r:r.fulfill(path=str(root/'scripts/fixtures/ocr-expediente.html'),content_type='text/html'))
  intranet=ctx.new_page();intranet.on('dialog',lambda d:d.accept());intranet.goto('https://intranet.autocarpe.com/expedientes/create')
  popup=ctx.new_page();popup.goto(worker.url.replace('background.js','popup.html'))
  def scan(action):
   return popup.evaluate("""async action=>{const tabs=await chrome.tabs.query({});const tab=tabs.find(t=>t.url?.startsWith('https://intranet.autocarpe.com/'));return await chrome.runtime.sendMessage({action,tabId:tab.id});}""",action)
  result=scan('scanAll');assert 'error' not in result,result
  assert len(result['sections'])==3,result
  fields=[f for s in result['sections'] for f in s['fields']]
  assert any(f['selector']=='#matricula' for f in fields),fields
  assert not any(f['selector']=='#modal-field' or f['type']=='combobox' for f in fields)
  assert next(f for f in fields if f['selector']=='#pedido-file')['label']=='Pedido (*)'
  assert all(f['selector'] not in ['#password','#token'] for f in fields)
  assert any(f['type']=='radio' and len(f['options'])==2 for f in fields)
  assert any(f['selector']=='#switch' and f['type']=='checkbox' for f in fields)
  assert intranet.locator('#tab-cliente').get_attribute('class')=='active'
  print('All-tab scan: Bootstrap tabs, lazy panel, radios, checkboxes, switches and file inputs passed.',flush=True)
  result=scan('scanVariants');assert 'error' not in result,result
  fields=[f for s in result['sections'] for f in s['fields']]
  bank=next(f for f in fields if f['selector']=='#banco');assert any(any(a['value']=='loan' for a in path) for path in bank['paths']),bank
  aval=next((f for f in fields if f['selector']=='#avalista'),None);assert aval and aval['paths'],result
  assert intranet.locator('#contado').is_checked()
  assert intranet.locator('#nombre').input_value()=='Original'
  assert intranet.locator('#switch').get_attribute('aria-checked')=='false'
  assert intranet.evaluate('window.saves===0 && window.cancels===0')
  assert 'Original' not in json.dumps(result)
  print('Variant exploration: discovers conditional/lazy branches, records prerequisites, restores initial choices, never submits.',flush=True)
  site=ctx.new_page();site.on('dialog',lambda d:d.accept());site.goto('https://gpt2026.vercel.app/ocrtrabajo/');site.wait_for_selector('#sources tr',state='attached');site.locator('#import').click();site.wait_for_selector('.field-card',state='attached');site.locator('details').filter(has=site.locator('#mapping')).evaluate('(e)=>e.open=true')
  def card_for(selector):
   return site.locator('.field-card').filter(has=site.locator('select[aria-label="Cómo rellenar '+selector+'"]'))
  def fixed(label,value):
   card=card_for(label);card.locator('input[type=checkbox]').check();card.locator('select').first.select_option('@fixed');card.locator('select').nth(1).select_option(value)
  fixed('Ayuda configurable','yes');fixed('Catálogo','dacia');fixed('Forma de pago','loan');fixed('DNI en vigor','0');fixed('Familia numerosa','false');fixed('Servicios conectados','true')
  card=card_for('Banco');card.locator('input[type=checkbox]').check();card.locator('select').first.select_option('@fixed');card.locator('input[type=text],input:not([type])').fill('Banco ficticio')
  intranet.evaluate("()=>{const original=document.querySelector('#__BVID__10').closest('.form-group');const copy=original.cloneNode(true);copy.querySelector('label').textContent='Otra ayuda';original.querySelectorAll('input').forEach((e,i)=>{e.id='__BVID__'+(100+i);e.name='__BVID__200'});original.before(copy)}")
  site.locator('#overwrite').check();site.locator('#save').click()
  saved=json.loads(site.evaluate("localStorage.getItem('ocrtrabajo-template-v1')"));assert any(m['fixed']=='false' for m in saved['mappings'].values())
  site.locator('#fill').click();intranet.wait_for_function("document.querySelector('#banco').value==='Banco ficticio'")
  assert intranet.locator('#__BVID__100').is_checked();assert not intranet.locator('#__BVID__10').is_checked();assert intranet.locator('#catalogo').input_value()=='dacia'
  assert intranet.locator('#financiado').is_checked();assert intranet.locator('#caducado').is_checked();assert not intranet.locator('#numerosa').is_checked()
  assert intranet.locator('#switch').get_attribute('aria-checked')=='true'
  assert intranet.evaluate('window.saves===0 && window.cancels===0')
  site.wait_for_function("document.querySelector('#fill-status').textContent.includes('campos rellenados')")
  print('Actual extension: import -> local defaults -> conditional fill -> radios/switches verified.',flush=True)
  # Native hidden file controls receive only the selected local document after confirmation.
  site.locator('#dni').set_input_files({'name':'dni-prueba.png','mimeType':'image/png','buffer':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jr1cAAAAASUVORK5CYII=')})
  attachment=card_for('DNI adjunto');attachment.locator('input[type=checkbox]').check();attachment.locator('select').select_option('@file:dni')
  site.locator('#fill').click();intranet.wait_for_function("document.querySelector('#dni-file').files.length===1")
  assert intranet.locator('#dni-file').evaluate('(e)=>e.files[0].name')=='dni-prueba.png'
  assert intranet.evaluate('window.saves===0 && window.cancels===0')
  print('Native file attachment: local file delivered to the correct input after confirmation.',flush=True)
  ctx.close()
