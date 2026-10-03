import assert from 'node:assert/strict';
import {analyzeDocuments,autoMapping,matchProfileOption} from '../src/ocrtrabajo/autocarpe.mjs';
const summary=`PEDIDO DE VEHÍCULO
CLIENTE
Sr. CLIENTE DE PRUEBA
12345678Z
cliente@example.test
612345678
RESUMEN
Modelo: DACIA DUSTER extreme tribrid 150 4x4PD 4 N6G 6XB 10.000,00 €
Color: blanco glaciar 369 100,00 €
Tapicería: TEP SIMI01 200,00 €
Opciones: pack parking PCV92 300,00 €
pack invierno PCV96 400,00 €
Transporte: 250,00 €
Dto. Preference -500,00 €
Matriculación y Pre-entrega 600,00 €
BASE IMPONIBLE 10.750,00 €
IVA (21%) 2.257,50 €
Imp. Matriculación (0%) 0,00 €
TOTAL A PAGAR 13.607,50 €`;
function analyze(text=summary,extra=[]){return analyzeDocuments({dni:{text:'12345678Z\nAVDA. EJEMPLO 12\nMADRID\nMADRID'},pedido:{text,pages:[{text,left:text,right:'Vendedor: comercial@example.test',page:1},...extra]}});}
let {values:v}=analyze(summary,[{page:2,text:'PEDIDO DE VEHÍCULO\nSeñal -1.000,00 €\nValoración VO coche usado Matrícula 0000BBB -2.000,00 €\nTotal a pagar 10.607,50 €'}]);
assert.equal(v.pff,'11000,00');assert.equal(v.transporte,'250,00');assert.equal(v.total_pedido,'13607,50');assert.equal(v.saldo_pendiente,'10607,50');
assert.equal(v.marca,'DACIA');assert.equal(v.modelo,'DUSTER');assert.equal(v.version,'extreme');assert.equal(v.motor,'tribrid 150 4x4PD 4 N6G 6XB');
assert.equal(v.equipamiento,'pack parking PCV92 + pack invierno PCV96');assert.equal(v.forma_pago,'Financiado');assert.equal(v.email,'cliente@example.test');
assert.equal(v.domicilio,'AVDA. EJEMPLO 12');assert.equal(v.documento,'12345678Z');
assert.equal(analyze(summary.replace('Preference','Crédito')).values.forma_pago,'Financiado');
assert.equal(analyze(summary.replace('Dto. Preference -500,00 €',''),[{page:3,text:'PEDIDO DE VEHÍCULO\nCONDICIONES GENERALES\nDescuento Preference crédito'}]).values.forma_pago,undefined);
assert.equal(analyze(summary.replace('DACIA DUSTER extreme','RENAULT AUSTRAL esprit Alpine')).values.version,'esprit Alpine');
assert.equal(analyze('PEDIDO DE VEHÍCULO\nBASE IMPONIBLE\n'+summary.replace('DACIA DUSTER extreme','RENAULT AUSTRAL techno')).values.modelo,'AUSTRAL');
const broken=analyzeDocuments({dni:{text:'Validez 16 07 2024\nCBB12345'},pedido:{text:''}});assert.equal(broken.values.documento,undefined,'Never construct a DNI across unrelated lines');
assert.equal(autoMapping({selector:'#sale-economicfinal-price'}).source,'total_pedido');
assert.equal(autoMapping({selector:'#vehicle-desiredequipment'}).source,'equipamiento');
assert.equal(autoMapping({selector:'#sale-economicpff',disabled:true}).enabled,false);
assert.equal(matchProfileOption({selector:'#vehicle-desiredvehicle-brand-id',options:[{label:'DA - DACIA',value:'30'}]},'DACIA').value,'30');
assert.equal(matchProfileOption({selector:'#vehicle-desiredvehicle-model-id',options:[{label:'DUSTER - DU3',value:'52'}]},'DUSTER').value,'52');
console.log('Autocarpe: buyer isolation, DNI priority, economic totals, brand/model/version/engine, extras, finance discounts and catalogue matching passed.');

assert.equal(autoMapping({type:'radio',options:[{value:'true',label:'Introducir características para que distribución busque un vehículo'}]}).fixed,'true');

const control=s=>[...s].reduce((n,c,i)=>n+(c>='0'&&c<='9'?Number(c):c.charCodeAt(0)-55)*[7,3,1][i%3],0)%10;
const support='AAA123456';
const repaired=analyzeDocuments({dni:{text:'IDESP'+support+control(support)+'123456782<<<<<<'},pedido:{text:''}});
assert.equal(repaired.values.documento,'12345678Z');
assert.ok(repaired.warnings.some(w=>w.includes('confusión')));
const badControl=analyzeDocuments({dni:{text:'IDESP'+support+((control(support)+1)%10)+'123456782<<<<<<'},pedido:{text:''}});
assert.equal(badControl.values.documento,undefined);
