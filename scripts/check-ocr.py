from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:3000/ocrtrabajo/');page.wait_for_selector('#sources tr');assert page.locator('#sources tr').count()==15
 page.get_by_text('Texto reconocido · puedes corregirlo',exact=True).click()
 page.locator('#dni-text').fill('Nombre: ANA\nApellidos: PRUEBA\n12345678Z\nValidez: 02/10/2030')
 page.locator('#pedido-text').fill('Número de pedido: P-123\nTotal: 12000')
 page.locator('#extract').click()
 assert page.locator('[data-source-id=nombre] input').nth(2).input_value()=='ANA'
 assert page.locator('[data-source-id=documento] input').nth(2).input_value()=='12345678Z'
 page.evaluate("""window.addEventListener('message', e=>{if(e.data.source==='ocrtrabajo-page'){window.postMessage({source:'ocrtrabajo-extension',id:e.data.id,result:{version:2,url:'https://intranet.autocarpe.com/expedientes/create',sections:[{id:'pedido',section:'Pedido',tabTrail:['#tab'],fields:[{selector:'#nombre',label:'Nombre',supported:true,type:'text',paths:[[]]},{selector:'#pago',label:'Forma de pago',supported:true,type:'radio',paths:[[]],options:[{label:'Contado',value:'cash'},{label:'Financiado',value:'loan'}]},{selector:'#banco',label:'Banco',supported:true,type:'text',paths:[[{selector:'#pago',sectionId:'pedido',value:'loan'}]]},{selector:'#switch',label:'Familia numerosa',supported:true,type:'checkbox',paths:[[]],options:[{label:'Sí',value:'true'},{label:'No',value:'false'}]}]}]}},location.origin)}})""")
 page.locator('#import').click();page.wait_for_selector('.field-card')
 def card(label):return page.locator('.field-card').filter(has=page.locator('select[aria-label="Cómo rellenar '+label+'"]'))
 card('Nombre').locator('input[type=checkbox]').check();card('Nombre').locator('select').select_option('nombre')
 for label,value in [('Forma de pago','cash'),('Familia numerosa','false')]:
  c=card(label);c.locator('input[type=checkbox]').check();c.locator('select').first.select_option('@fixed');c.locator('select').nth(1).select_option(value)
 c=card('Banco');c.locator('input[type=checkbox]').check();c.locator('select').select_option('@fixed');c.locator('input:not([type=checkbox])').fill('Banco ficticio')
 assert 'No aplica' in card('Banco').inner_text()
 card('Forma de pago').locator('select').nth(1).select_option('loan');assert 'Resultado: Banco ficticio' in card('Banco').inner_text()
 page.locator('#save').click();saved=page.evaluate("localStorage.getItem('ocrtrabajo-template-v1')")
 assert 'ANA' not in saved and '12345678Z' not in saved and '12000' not in saved
 assert any(m['fixed']=='false' for m in json.loads(saved)['mappings'].values())
 page.reload();page.wait_for_selector('.field-card');assert card('Familia numerosa').locator('select').nth(1).input_value()=='false'
 assert page.locator('[data-source-id=nombre] input').nth(2).input_value()==''
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 browser.close()
print('UI: extraction, defaults/false persisted without OCR values, conditional branch preview, reload and mobile layout passed.')
