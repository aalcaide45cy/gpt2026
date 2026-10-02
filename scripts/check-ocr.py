from playwright.sync_api import sync_playwright
import json, pathlib
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
 page=browser.new_page()
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:3000/ocrtrabajo/')
 page.wait_for_selector('#sources tr')
 assert page.locator('#sources tr').count()==11
 page.get_by_text('Texto reconocido · puedes corregirlo',exact=True).click()
 page.locator('#dni-text').fill('Nombre: ANA\nApellidos: PRUEBA\n12345678Z')
 page.locator('#pedido-text').fill('Número de pedido: P-123\nTotal: 12000')
 page.locator('#extract').click()
 assert page.locator('#sources tr').nth(0).locator('input').nth(2).input_value()=='ANA'
 assert page.locator('#sources tr').nth(2).locator('input').nth(2).input_value()=='12345678Z'
 page.locator('#save').click()
 saved=page.evaluate("localStorage.getItem('ocrtrabajo-template-v1')")
 assert 'ANA' not in saved and '12345678Z' not in saved and '12000' not in saved
 page.evaluate("""window.addEventListener('message', e=>{if(e.data.source==='ocrtrabajo-page'){window.postMessage({source:'ocrtrabajo-extension',id:e.data.id,result:{url:'https://intranet.autocarpe.com/expedientes/create',sections:[{section:'Cliente',tabSelector:'#cliente-tab',fields:[{selector:'#nombre',label:'Nombre',required:true,type:'text',options:null},{selector:'#tipo',label:'Tipo',type:'select-one',options:[{label:'Particular',value:'P'}]}]}]}},location.origin)}})""")
 page.locator('#import').click()
 page.wait_for_selector('#mapping input[type=checkbox]')
 page.locator('#mapping input[type=checkbox]').first.check()
 page.locator('#mapping select').first.select_option('nombre')
 page.locator('#mapping select').nth(1).select_option('@fixed')
 page.locator('#mapping select').nth(2).select_option('P')
 page.locator('#save').click()
 assert json.loads(page.evaluate("localStorage.getItem('ocrtrabajo-template-v1')"))['mappings']['["Cliente","#nombre"]']['source']=='nombre'
 page.locator('#clear').click()
 assert page.locator('#dni-text').input_value()==''
 assert page.locator('#sources tr').nth(0).locator('input').nth(2).input_value()==''
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors, errors
 # Exercise the actual extension form script against a representative tabbed form.
 form=browser.new_page()
 form.set_content('<button id="tab" role="tab" aria-selected="true">Cliente</button><label for="nombre">Nombre</label><input id="nombre"><label for="existing">Apellidos</label><input id="existing" value="Conservar"><input type="password" id="password"><input type="hidden" id="hidden"><button type="submit" id="save">Guardar</button><select id="tipo"><option value="P">Particular</option></select>')
 form.evaluate("window.listener=null;window.chrome={runtime:{onMessage:{addListener:f=>window.listener=f}}};window.confirm=()=>true")
 form.add_script_tag(path='extension/ocrtrabajo/form.js')
 scan=form.evaluate("new Promise(r=>window.listener({action:'scan'},{},r))")
 assert len(scan['fields'])==3, scan
 assert all(f['selector'] not in ['#password','#hidden'] for f in scan['fields'])
 result=form.evaluate("""new Promise(r=>window.listener({action:'fill',url:location.href,items:[{selector:'#nombre',label:'Nombre',value:'ANA',tabSelector:'#tab'},{selector:'#existing',label:'Apellidos',value:'OTRO'},{selector:'#tipo',label:'Tipo',value:'P'},{selector:'#password',label:'Password',value:'forbidden'}]},{},r))""")
 assert result['count']==2 and len(result['errors'])==2, result
 assert form.locator('#nombre').input_value()=='ANA'
 assert form.locator('#existing').input_value()=='Conservar'
 assert form.locator('#password').input_value()==''
 browser.close()
print('OCR UI: extraction, local template without personal values, mapping, clearing, mobile layout. Extension: scan, tabs, fill, existing values and passwords. Passed.')
