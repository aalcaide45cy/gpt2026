import json, sys, time, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:3002'
sectors=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {verticals} from './src/verticals.mjs';console.log(JSON.stringify(verticals.map(({id,kind})=>({id,kind}))))"],text=True))
failures=[];passed=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':900})
 context.add_init_script("localStorage.clear()")
 page=context.new_page();page.set_default_timeout(6000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def checkout():
  page.locator('#checkout-dialog').wait_for(state='visible')
  page.locator('#checkout-form [name=name]').fill('Prueba de recorrido')
  specific=page.locator('#checkout-form [name=specific]')
  if specific.count():specific.fill('Demo')
  page.locator('#demo-accept').check()
  page.locator('#checkout-form button[type=submit]').click()
  page.locator('#confirmation').wait_for(state='visible')
  assert 'DEMO-' in page.locator('#confirmation-id').inner_text()
  with page.expect_download():page.locator('#download-confirmation').click()
  page.locator('#checkout-dialog [data-close]').click()
  page.locator('[data-history]').click()
  assert page.locator('.x-history-item').count()==1
  page.locator('[data-cancel-record]').click()
  assert 'Cancelada' in page.locator('.x-history-item').inner_text()
  page.locator('#history-dialog [data-close]').click()
 for sector in sectors:
  for variant in [1,2,3]:
   route=f"/demos/{sector['id']}/{variant}/";kind=sector['kind'];errors.clear()
   try:
    page.goto(base+route,wait_until='load')
    assert page.locator('h1').count()==1
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'), 'horizontal overflow'
    if kind in ['appointment','classes','courses']:
     page.locator('[data-choose]').nth(1).click()
     page.locator('[data-slot]').first.click()
     page.locator('#book-selected').click();checkout()
    elif kind=='estimate':
     page.locator('[data-estimate-item]').nth(1).click()
     before=page.locator('#estimate-total').inner_text();page.locator('[data-extra]').first.check();assert before!=page.locator('#estimate-total').inner_text()
     with page.expect_download():page.locator('#download-estimate').click()
     page.locator('#save-estimate').click();checkout()
    elif kind in ['vehicle','property']:
     page.locator('[data-favorite]').first.click();page.locator('#only-favorites').check();assert page.locator('[data-item]:visible').count()==1
     page.locator('#only-favorites').uncheck()
     page.locator('[data-compare]').nth(0).check();page.locator('[data-compare]').nth(1).check();page.locator('#compare-button').click()
     assert page.locator('#compare-content table').count()==1;page.locator('#compare-dialog [data-close]').click()
     page.locator('[data-detail]').first.click();page.locator('#detail-action').click();checkout()
    elif kind=='order':
     page.locator('[data-add]').first.click();page.locator('[data-add]').nth(1).click();assert page.locator('.x-cart-line').count()==2
     page.locator('#delivery').select_option('Entrega a domicilio');page.locator('#address').fill('Calle de prueba 1')
     page.locator('#checkout-order').click();checkout()
    elif kind=='restaurant':
     page.locator('[data-add]').first.click();assert page.locator('.x-cart-line').count()==1
     page.locator('[data-table-slot]').first.click();page.locator('#book-table').click();checkout()
    elif kind in ['stay','rental']:
     page.locator('#check-dates').click();assert 'opciones disponibles' in page.locator('#date-result').inner_text()
     page.locator('[data-detail]').first.click();before=page.locator('#stay-detail-total').inner_text();page.locator('#booking-extra').check();assert before!=page.locator('#stay-detail-total').inner_text()
     page.locator('#detail-action').click();checkout()
    elif kind=='trip':
     page.locator('[data-detail]').first.click();before=page.locator('#trip-total').inner_text();page.locator('#trip-people').fill('3');assert before!=page.locator('#trip-total').inner_text();page.locator('#detail-action').click();checkout()
    elif kind=='investment':
     before=page.locator('#invest-result').inner_text();page.locator('#invest-rate').fill('-2');assert before!=page.locator('#invest-result').inner_text();page.locator('#save-investment').click();checkout()
    elif kind=='portfolio':
     page.locator('[data-detail]').first.click();assert 'Entregables' in page.locator('#detail-content').inner_text();page.locator('#detail-dialog [data-close]').click()
     page.locator('#brief-idea').fill('Identidad para un negocio local.');page.locator('#brief-form button[type=submit]').click();checkout()
    else:raise Exception('unhandled engine '+kind)
    assert not errors,errors
    passed.append(route);print('PASS',route,flush=True)
   except Exception as err:
    failures.append({'route':route,'error':str(err),'js':errors.copy()});print('FAIL',route,str(err)[:250],flush=True)
    for dialog in page.locator('dialog[open]').all():dialog.evaluate('x=>x.close()')
 browser.close()
Path('/tmp/gpt2026-browser-results.json').write_text(json.dumps({'passed':passed,'failures':failures},indent=2))
print('RESULT',len(passed),'passed;',len(failures),'failed',flush=True)
sys.exit(1 if failures else 0)
