import {normalize,parseDate,documentType} from './rules.mjs?v=0.3.0';
export const profileSources=[
 ['nacimiento','Fecha de nacimiento','dni'],['nombre_completo','Nombre completo del cliente','pedido'],['documento_pedido','DNI que figura en el pedido','pedido'],['ciudad','Municipio del DNI','dni'],['provincia','Provincia del DNI','dni'],['pais','País del domicilio','dni'],['cp','Código postal del pedido','pedido'],['movil','Móvil del comprador','pedido'],['marca','Marca','pedido'],['modelo','Modelo','pedido'],['version','Versión','pedido'],['motor','Motor','pedido'],['color','Color','pedido'],['tapiceria','Tapicería','pedido'],['equipamiento','Opciones / equipamiento','pedido'],['tipo_dossier','Tipo de dossier','pedido'],['instalacion_comercial','Instalación comercial','pedido'],['pff','PFF: modelo + color + tapicería + opciones','pedido'],['transporte','TTE: transporte','pedido'],['matriculacion','Matriculación y preentrega','pedido'],['base_imponible','Base imponible tras descuentos','pedido'],['iva_pct','IVA (%)','pedido'],['im_pct','Impuesto de matriculación (%)','pedido'],['total_pedido','Total del pedido / a cobrar','pedido'],['senal','Señal','pedido'],['tasacion','Valoración vehículo entregado','pedido'],['saldo_pendiente','Saldo después de señal y vehículo','pedido'],['vehiculo_entregado','Vehículo entregado','pedido'],['matricula_entregado','Matrícula del vehículo entregado','pedido'],['pago_otro_vehiculo','Entrega otro vehículo','pedido'],['plazo_desde','Inicio del plazo de entrega','pedido'],['plazo_hasta','Fin del plazo de entrega','pedido'],['fecha_cliente','Fecha informada al cliente','pedido'],['domicilio_pedido','Domicilio del pedido','pedido']
].map(([id,title,doc])=>({id,title,doc,label:''}));
const moneyRE=/-?\s*\d[\d.]*,\d{2}\s*€/g;
export const cents=s=>Math.round(Number(String(s).replace(/\s|€/g,'').replace(/\./g,'').replace(',','.'))*100);
const euros=n=>(n/100).toFixed(2).replace('.',',');
const trim=s=>String(s||'').replace(/\s+/g,' ').trim();
function checksum(s){return [...s].reduce((n,c,i)=>n+(/[0-9]/.test(c)?Number(c):/[A-Z]/.test(c)?c.charCodeAt(0)-55:0)*[7,3,1][i%3],0)%10;}
function mrzDate(s,kind,today){const yy=Number(s.slice(0,2));let year=2000+yy;if(kind==='birth'&&year>today.getFullYear())year-=100;return parseDate(`${year}-${s.slice(2,4)}-${s.slice(4,6)}`);}
function dniData(text,today){
 const out={},evidence={},warnings=[];const lines=text.toUpperCase().split('\n').map(trim).filter(Boolean);
 const put=(key,value,detail)=>{if(value){out[key]=value;evidence[key]={doc:'dni',page:1,detail};}};
 const mrzNumbers=[...text.toUpperCase().replace(/\s/g,'').matchAll(/IDESP[A-Z0-9]{9}[0-9]((?:[0-9]{8}|[XYZ][0-9]{7})[A-Z])</g)].map(m=>m[1]);
 const numbers=[...new Set([...mrzNumbers,...lines.flatMap(line=>[...line.replace(/[ \t]/g,'').matchAll(/(?:\d{8}|[XYZ]\d{7})[A-Z]/g)].map(m=>m[0]))].filter(documentType))];
 if(!numbers.length){
  const repaired=[];
  for(const m of text.toUpperCase().replace(/\s/g,'').matchAll(/IDESP([A-Z0-9]{9})([0-9])([0-9]{8})([0-9])</g)){
   const letter='TRWAGMYFPDXBNJZSQVHLCKE'[Number(m[3])%23],confusions={'0':'CDOQ','1':'IL','2':'Z','5':'S','6':'G','8':'B'};
   if(checksum(m[1])===Number(m[2])&&confusions[m[4]]?.includes(letter))repaired.push(m[3]+letter);
  }
  const unique=[...new Set(repaired)];
  if(unique.length===1){numbers.push(unique[0]);warnings.push('La letra del DNI se ha recuperado de una confusión del OCR usando el número MRZ y su control. Contrástala en el previo.');}
 }
 if(numbers.length===1)put('documento',numbers[0],'DNI/NIE de la zona MRZ o texto; letra de control verificada');else warnings.push('No se ha leído un número de DNI/NIE único con letra válida.');
 for(const line of lines){
  const m=line.replace(/\s/g,'').match(/([0-9O]{6})(\d)[MF<]([0-9O]{6})(\d)ESP/);
  if(m){const birth=m[1].replace(/O/g,'0'),expiry=m[3].replace(/O/g,'0');if(checksum(birth)===Number(m[2]))put('nacimiento',mrzDate(birth,'birth',today),'Fecha MRZ con dígito de control verificado');if(checksum(expiry)===Number(m[4]))put('caducidad',mrzDate(expiry,'expiry',today),'Caducidad MRZ con dígito de control verificado');}
  const name=line.replace(/\s/g,'').replace(/[«‹]/g,'<').match(/^([A-ZÑ]+(?:<[A-ZÑ]+)*)<<([A-ZÑ]+(?:<[A-ZÑ]+)*)(?:<{2,}|$)/);
  if(name&&!/^IDESP/.test(name[1])){put('apellidos',name[1].replace(/</g,' '),'Apellidos de la zona MRZ');put('nombre',name[2].replace(/</g,' '),'Nombre de la zona MRZ');}
 }
 const addresses=lines.filter(line=>/(?:AVDA\.?|AVENIDA|CALLE|C\/|PASEO|PLAZA|\bVIA\b)/.test(line)&&/\d/.test(line));
 addresses.sort((a,b)=>addressScore(b)-addressScore(a));
 if(addresses.length){let address=addresses[0];const house=address.match(/\b0*(\d+)\s+P[O0]?/);if(house){const same=addresses.find(a=>new RegExp('\\b0*'+house[1]+'\\s+P[O0]?\\d+[\\s_]+[A-Z]\\b').test(a));if(same){const tail=same.match(/\b0*(\d+)\s+P[O0]?(\d+)[\s_]+([A-Z])\b/);if(tail)address=address.replace(/\b\d+\s+P.*$/,'')+`${Number(tail[1])}, ${Number(tail[2])}, ${tail[3]}`;}}
  put('domicilio',address,'Domicilio del DNI; prevalece sobre el pedido');
  const position=lines.indexOf(addresses[0]);const next=lines.slice(position+1,position+5).map(s=>s.replace(/^[^)]*\)\s*/, '')).filter(s=>/^[A-ZÁÉÍÓÚÜÑ ]{3,35}$/.test(s)&&!/LUGAR|NACIMIENTO|DOMICILIO/.test(s));
  if(next.length>=2&&next[0]===next[1]){put('ciudad',next[0],'Municipio del bloque domicilio del DNI');put('provincia',next[1],'Provincia del bloque domicilio del DNI');}
 }
 if(!out.nacimiento||!out.caducidad)warnings.push('No se han verificado todas las fechas del DNI: revisa nacimiento y caducidad.');
 return {values:out,evidence,warnings};
}
function addressScore(line){return (/^(AVDA|AVENIDA|CALLE|PASEO|PLAZA|C\/)/.test(line)?60:0)+(/\bP[O0]?\d+[\s_]+[A-Z]\b/.test(line)?20:0)+Math.min(20,line.length/4);}
const months={ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12};
function writtenDates(text){return [...text.matchAll(/\b(\d{1,2})\s+(?:de\s+)?([A-Za-záéíóú]+)\s+(?:de\s+)?(20\d{2})\b/g)].map(m=>months[normalize(m[2]).slice(0,3)]?parseDate(`${m[1]}/${months[normalize(m[2]).slice(0,3)]}/${m[3]}`):null).filter(Boolean);}
function plainDescription(line){return trim(line.replace(moneyRE,'').replace(/^(Modelo|Color|Tapicer[ií]a|Opciones|Transporte|Gastos|Otros)\s*:/i,''));}
export function analyzeDocuments(documents,policy={},today=new Date()){
 const dni=documents.dni?.text||'',order=documents.pedido?.text||'';const identity=dniData(dni,today);const values={...identity.values},evidence={...identity.evidence},warnings=[...identity.warnings],facts=[];
 const pages=documents.pedido?.pages?.length?documents.pedido.pages:[{text:order,left:'',right:'',page:1}];const first=pages.find(p=>/PEDIDO DE VEH[IÍ]CULO/i.test(p.text)&&/BASE IMPONIBLE/i.test(p.text))||pages[0];
 const put=(key,value,page=first?.page||1,detail='Pedido Renault / Dacia')=>{if(value!==undefined&&value!==null&&String(value).trim()!==''){values[key]=String(value);evidence[key]={doc:'pedido',page,detail};}};
 if(first){const lines=first.text.split('\n').map(trim).filter(Boolean),clientText=(first.left||first.text).split(/^\s*CLIENTE\s*$/im)[1]?.split(/^\s*RESUMEN\b/im)[0]||'',clientLines=clientText.split('\n').map(trim).filter(Boolean);
  const nameLine=clientLines.find(l=>/^(Sr\.?|Sra\.?|Don\b|Doña\b)/i.test(l));if(nameLine)put('nombre_completo',nameLine.replace(/^(?:(?:Sr|Sra)\.?\s*|Don\s+|Doña\s+)+/gi,''),first.page,'Bloque CLIENTE, sin datos del concesionario');
  const number=clientLines.join(' ').match(/\b(?:\d{8}|[XYZ]\d{7})[A-Z]\b/);if(number)put('documento_pedido',number[0],first.page,'Identificador del bloque CLIENTE');
  const email=clientLines.join(' ').match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);if(email)put('email',email[0],first.page,'Email del cliente, columna izquierda');
  const phone=clientLines.find(l=>/^(?:\+34\s*)?[6789][\d ]{8,12}$/.test(l));if(phone){const n=phone.replace(/\s/g,'').replace(/^\+34/,'');put(/^[67]/.test(n)?'movil':'telefono',n,first.page,'Teléfono del cliente, columna izquierda');}
  const address=clientLines.find(l=>/^(Avenida|Avda|Calle|C\/|Plaza|Paseo|Carretera)/i.test(l));if(address)put('domicilio_pedido',address,first.page,'Domicilio del pedido, solo para contrastar');
  const place=clientLines.find(l=>/\(\d{5}\)/.test(l));if(place){const m=place.match(/^(.+?),\s*(.+?)\s*\((\d{5})\)/);if(m){put('ciudad_pedido',m[1]);put('provincia_pedido',m[2]);put('cp',m[3],first.page,'El DNI no contiene código postal; tomado del pedido para revisión');if(!values.ciudad)warnings.push('Revisa el municipio del DNI: no se sustituye automáticamente por el del pedido.');}}
  const numberLine=lines.find(l=>/^N[uú]mero Pedido/i.test(l));if(numberLine)put('pedido',numberLine.replace(/^N[uú]mero Pedido\s*/i,''));
  const emitted=lines.find(l=>/^Emitido:/i.test(l));if(emitted)put('fecha',writtenDates(emitted)[0]);
  const modelIndex=lines.findIndex(l=>/^Modelo\s*:/i.test(l)),transportIndex=lines.findIndex(l=>/^Transporte\s*:/i.test(l));
  if(modelIndex>=0&&transportIndex>modelIndex){const block=lines.slice(modelIndex,transportIndex),amounts=block.map(l=>[...l.matchAll(moneyRE)].at(-1)?.[0]).filter(Boolean);if(amounts.length>=1){put('pff',euros(amounts.reduce((n,a)=>n+cents(a),0)),first.page,'Suma de modelo, color, tapicería y opciones; transporte excluido');facts.push({label:'PFF',detail:amounts.map(a=>a.trim()).join(' + '),value:values.pff});}
   const model=plainDescription(block[0]);put('vehiculo',model);const brand=model.match(/^(DACIA|RENAULT|MOBILIZE)\s+(.+)$/i);if(brand){put('marca',brand[1].toUpperCase());put('tipo_dossier','VN '+brand[1][0].toUpperCase()+brand[1].slice(1).toLowerCase());const variant=brand[2].match(/^([A-Z0-9 -]+?)\s+(extreme|expression|essential|journey|evolution|techno|esprit Alpine|iconic)\b\s*(.*)$/i);if(variant){put('modelo',variant[1].toUpperCase());put('version',variant[2]);put('motor',variant[3]);}else put('modelo',brand[2]);}
   for(const [label,key]of [['Color','color'],['Tapicería','tapiceria']]){const row=block.find(l=>normalize(l).startsWith(normalize(label)+':'));if(row)put(key,plainDescription(row));}
   const op=block.findIndex(l=>/^Opciones\s*:/i.test(l));if(op>=0)put('equipamiento',block.slice(op).map(plainDescription).filter(Boolean).join(' + '));
  }
  for(const [pattern,key]of [[/^Transporte\s*:/i,'transporte'],[/^BASE IMPONIBLE/i,'base_imponible'],[/^TOTAL A PAGAR/i,'total_pedido'],[/Matriculaci[oó]n y Pre[- ]entrega/i,'matriculacion']]){const row=lines.find(l=>pattern.test(l));const amount=row&&[...row.matchAll(moneyRE)].at(-1)?.[0];if(amount)put(key,euros(cents(amount)),first.page,row);}
  for(const [pattern,key]of [[/^IVA\b/i,'iva_pct'],[/^Imp\. Matriculaci[oó]n/i,'im_pct']]){const row=lines.find(l=>pattern.test(l));const p=row?.match(/\(([\d.,]+)%\)/);if(p)put(key,p[1].replace(',','.'));}
  const delivery=lines.find(l=>/^Plazo de Entrega/i.test(l));if(delivery){const dates=writtenDates(delivery);if(dates.length){put('plazo_desde',dates[0]);put('plazo_hasta',dates.at(-1));if(policy.deliveryDate==='last')put('fecha_cliente',dates.at(-1));else if(policy.deliveryDate==='first')put('fecha_cliente',dates[0]);else warnings.push('El pedido indica un intervalo de entrega: elige qué fecha informar al cliente.');}}
  if(/tribrid/i.test(values.motor||'')){if(policy.tribridFuel)put('combustible',policy.tribridFuel,first.page,'Clasificación tribrid configurada por el usuario');else warnings.push('El motor es tribrid: confirma su categoría de combustible en Autocarpe.');}
  else if(/GLP|ECO-G/i.test(values.motor||''))put('combustible','GLP');else if(/mild hybrid/i.test(values.motor||''))put('combustible','Mild hybrid');else if(/full hybrid/i.test(values.motor||''))put('combustible','Híbrido');else if(/dci|di[eé]sel/i.test(values.motor||''))put('combustible','Diésel');
  const seller=first.right||'';if(/Rivas\s*-\s*Vaciamadrid/i.test(seller))put('instalacion_comercial','RIVAS',first.page,'Establecimiento vendedor del pedido');
 }
 // Commercial pages only. Boilerplate mentioning finance, trials or exemptions is not evidence of a choice.
 const commercial=pages.filter(p=>/PEDIDO DE VEH[IÍ]CULO/i.test(p.text)&&!/ESTIPULACIONES GENERALES|CONDICIONES GENERALES|INFORMACI[OÓ]N B[ÁA]SICA SOBRE PROTECCI[OÓ]N/i.test(p.text));
 for(const page of commercial){const lines=page.text.split('\n').map(trim).filter(Boolean);for(const [pattern,key]of [[/^Se[nñ]al\b/i,'senal'],[/^Valoraci[oó]n VO\b/i,'tasacion']]){const row=lines.find(l=>pattern.test(l));const amount=row&&[...row.matchAll(moneyRE)].at(-1)?.[0];if(amount)put(key,euros(Math.abs(cents(amount))),page.page,row);}
  const trade=lines.find(l=>/^Valoraci[oó]n VO\b/i.test(l));if(trade){put('pago_otro_vehiculo','true',page.page,'Valoración VO explícita');put('vehiculo_entregado',plainDescription(trade).replace(/^Valoraci[oó]n VO\s*/i,''),page.page);const plate=trade.match(/Matr[ií]cula\s+(\d{4}\s*[A-Z]{3})/i);if(plate)put('matricula_entregado',plate[1].replace(/\s/g,''),page.page);}
  const note=lines.slice(lines.findIndex(l=>/^Observaciones$/i.test(l))+1).join(' ');
  const financeLine=lines.find((line,i)=>/(credito|preference|financiacion)/.test(normalize(line))&&/(dto|descuent|promocion)/.test(normalize(line+' '+(lines[i-1]||''))));
  if(financeLine)put('forma_pago','Financiado',page.page,'Financiación según descuento: '+financeLine);
  if(/forma de pago\s*:?\s*contado/i.test(page.text))put('forma_pago','Contado',page.page,'Forma de pago explícita');
  if(page!==first){const row=lines.find(l=>/^Total a pagar/i.test(l));const amount=row&&[...row.matchAll(moneyRE)].at(-1)?.[0];if(amount)put('saldo_pendiente',euros(cents(amount)),page.page,'Saldo tras señal y vehículo entregado; no es Total a cobrar');}
 }
 if(values.total_pedido)values.importe=values.total_pedido;
 if(values.provincia&&normalize(values.provincia)===normalize(values.provincia_pedido)&&values.cp?.length===5)values.pais='España';
 if(values.documento&&values.documento_pedido&&values.documento!==values.documento_pedido)warnings.unshift('BLOQUEO: el DNI y el pedido pertenecen a identificadores diferentes.');
 if(values.domicilio&&values.domicilio_pedido&&normalize(values.domicilio)!==normalize(values.domicilio_pedido))warnings.push('El domicilio se toma del DNI. El pedido contiene una redacción distinta; revisa el contraste, el código postal y la solicitud de padrón.');
 if(values.im_pct==='0'||values.im_pct==='0.00')warnings.push('Un tipo de matriculación del 0% no demuestra una exención personal. «Exento de IM» se configura por separado.');
 if(/PRUEBA SIN COMPROMISO/i.test(order))warnings.push('«Prueba sin compromiso» es un texto comercial: no prueba que el cliente haya realizado una prueba del vehículo.');
 if(/Servicios Conectados/i.test(order))warnings.push('El PDF incluye condiciones de servicios conectados; confirma la casilla correspondiente como valor habitual.');
 return {values,evidence,warnings,facts,recognizedOrder:!!first&&/PEDIDO DE VEH[IÍ]CULO/i.test(first.text)};
}
const selectorSources={
 '#customername':'nombre','#customersurname':'apellidos','#customeremail':'email','#customercountry-id':'pais','#customerprovince-id':'provincia','#customertown':'ciudad','#customeraddress':'domicilio','#customerzipcode':'cp','#customerphone':'telefono','#customercellphone':'movil','#customerbirthdate':'nacimiento','#customerpersonal-document-type-id':'@documentType','#customerpersonal-document-number':'documento','#sale-personalratio-delivery-date':'fecha_cliente',
 '#sale-dossierdossier-type-id':'tipo_dossier','#sale-dossiercombustible-id':'combustible','#sale-dossierdealership-id':'instalacion_comercial','#vehicle-desiredvehicle-brand-id':'marca','#vehicle-desiredvehicle-model-id':'modelo','#vehicle-desiredvehicle-version':'version','#vehicle-desiredvehicle-engine':'motor','#vehicle-desiredcolour-id':'color','#vehicle-desiredambience':'tapiceria','#vehicle-desiredequipment':'equipamiento',
 '#sale-economicpff':'pff','#sale-economictte':'transporte','#sale-economicregistration-price':'matriculacion','#sale-economicfinal-price':'total_pedido','#sale-taxestax-mat':'im_pct'
};
export function autoMapping(field){
 const base={enabled:false,source:'',fixed:'',rules:[],fallback:'',unknown:''};if(field.disabled||field.readonly||field.supported===false)return base;
 if(selectorSources[field.selector])return {...base,enabled:true,source:selectorSources[field.selector]};
 const desired=field.type==='radio'&&field.options?.find(o=>/^introducir caracteristicas para que distribucion/.test(normalize(o.label)));
 if(desired)return {...base,enabled:true,source:'@fixed',fixed:desired.value};
 const label=normalize(field.label).replace(/[¿?*()]/g,'').trim();
 if(label==='forma de pago')return {...base,enabled:true,source:'forma_pago'};
 if(label==='desea pagar con otro vehiculo')return {...base,enabled:true,source:'pago_otro_vehiculo'};
 if(label==='dni en vigor')return {...base,enabled:true,source:'@rules',rules:['En vigor','Caducado'].map((value,i)=>({left:'@documentStatus',op:'equals',right:value,output:field.options?.find(o=>i?/^caducado/i.test(o.label):/^fecha en vigor|^en vigor/i.test(o.label))?.value||''}))};
 if(field.type==='file'&&/^(dni|pedido)\b/.test(label)&&!/(ratio|sin firmar|prueba)/.test(label))return {...base,enabled:true,source:label.startsWith('dni')?'@file:dni':'@file:pedido'};
 return base;
}
export function mappingKey(section,field){const id=field.selector||'';if(/^#[a-z][a-z0-9_-]*$/i.test(id)&&!/^#__BVID__/i.test(id))return 'autocarpe:'+id;return JSON.stringify([section.section,field.type,normalize(field.label)]);}
export function matchProfileOption(field,value){
 if(!field.options)return null;const n=normalize(value);let candidates=[];
 if(field.selector==='#vehicle-desiredvehicle-brand-id')candidates=field.options.filter(o=>normalize(o.label.split(' - ').at(-1))===n);
 if(field.selector==='#vehicle-desiredvehicle-model-id')candidates=field.options.filter(o=>normalize(o.label.split(' - ')[0])===n);
 if(field.selector==='#vehicle-desiredcolour-id'){const code=value.match(/\b[A-Z0-9]{3}\b/gi)?.at(-1);if(code)candidates=field.options.filter(o=>normalize(o.label).endsWith('('+normalize(code)+')'));}
 if(field.selector==='#sale-taxestax-mat')candidates=field.options.filter(o=>{const pct=o.label.match(/([\d,.]+)%/);return pct&&Number(pct[1].replace(',','.'))===Number(value.replace(',','.'));});
 const valid=candidates.filter(o=>!o.disabled&&o.value!=='');return valid.length===1?valid[0]:null;
}
