import {readDocument} from './reader.mjs?v=0.3.0';
import {profileSources,analyzeDocuments,autoMapping,mappingKey,matchProfileOption} from './autocarpe.mjs?v=0.3.0';
import {defaults,builtins,operations,normalize,resolve,extractValues,documentType,applyDependencies} from './rules.mjs?v=0.3.0';

const $=s=>document.querySelector(s), storageKey='ocrtrabajo-template-v1';
let config={version:3,sources:structuredClone(defaults),mappings:{},overwrite:false,policy:{}},capture=null,connected=false,values={},busy=false,documents={},analysisReport=null;
for(const source of profileSources)if(!config.sources.some(s=>s.id===source.id))config.sources.push(source);
function validate(x){
  if(!x||!Array.isArray(x.sources)||x.sources.length>100||!x.mappings||typeof x.mappings!=='object'||Array.isArray(x.mappings))throw Error('Configuración no válida.');
  const short=v=>typeof v==='string'&&v.length<=10000;
  const sources=x.sources.map(s=>{if(!s||!['pedido','dni'].includes(s.doc)||['id','title','label'].some(k=>!short(s[k])||s[k].length>180))throw Error('Dato no válido.');return {id:s.id,title:s.title,doc:s.doc,label:s.label};});
  if(x.version!==3)for(const source of [...defaults,...profileSources])if(!sources.some(s=>s.id===source.id))sources.push({...source});
  if(new Set(sources.map(s=>s.id)).size!==sources.length)throw Error('Identificadores duplicados.');
  const mappings=Object.create(null);if(Object.keys(x.mappings).length>1500)throw Error('Demasiados campos.');
  for(const [key,m]of Object.entries(x.mappings)){
    if(!m||typeof m!=='object'||!short(key))throw Error('Asignación no válida.');
    const next={enabled:m.enabled===true};
    for(const prop of ['source','fixed','fallback','unknown']){if(m[prop]!==undefined&&!short(m[prop]))throw Error('Regla no válida.');next[prop]=m[prop]||'';}
    if(m.rules!==undefined&&(!Array.isArray(m.rules)||m.rules.length>30))throw Error('Demasiadas reglas.');
    next.rules=(m.rules||[]).map(r=>{if(!r||['left','op','right','output'].some(k=>!short(r[k])))throw Error('Condición no válida.');return {left:r.left,op:r.op,right:r.right,output:r.output};});mappings[key]=next;
  }
  // Templates retain field structure, never current form values or OCR values.
  let sections=[];
  if(Array.isArray(x.sections)&&x.sections.length<100){sections=x.sections.map(s=>{if(!short(s.section)||!Array.isArray(s.fields)||s.fields.length>500)throw Error('Esquema no válido.');return s;});}
  return {version:3,sources,mappings,sections,overwrite:x.overwrite===true,policy:{tribridFuel:['GLP','Híbrido','Mild hybrid'].includes(x.policy?.tribridFuel)?x.policy.tribridFuel:'',deliveryDate:['first','last','manual'].includes(x.policy?.deliveryDate)?x.policy.deliveryDate:''}};
}
try{const raw=localStorage.getItem(storageKey);if(raw)config=validate(JSON.parse(raw));}catch{}
if(config.sections?.length)capture={version:2,sections:config.sections,warnings:[]};
function texts(){return {pedido:$('#pedido-text').value,dni:$('#dni-text').value};}
function el(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
function input(value,onChange,label){const e=el('input');e.value=value||'';if(label)e.setAttribute('aria-label',label);e.addEventListener('input',()=>onChange(e.value));return e;}
function select(options,value,onChange,label){const e=el('select');for(const [v,t]of options){const o=el('option',t);o.value=v;e.append(o);}e.value=value||'';if(label)e.setAttribute('aria-label',label);e.onchange=()=>onChange(e.value);return e;}
function cell(row,child){const td=el('td');td.append(child);row.append(td);}
function sources(){return [...config.sources.map(s=>[s.id,s.title+' · '+(s.doc==='dni'?'DNI':'Pedido')]),...builtins];}
function renderSources(){
  const body=$('#sources');body.replaceChildren();
  for(const s of config.sources){const row=el('tr');row.dataset.sourceId=s.id;
    cell(row,input(s.title,v=>{s.title=v;},'Nombre del dato'));
    cell(row,select([['dni','DNI'],['pedido','Pedido']],s.doc,v=>s.doc=v,'Documento de origen'));
    cell(row,input(s.label,v=>s.label=v,'Etiqueta para '+s.title));
    cell(row,input(values[s.id],v=>{values[s.id]=v;updatePreview();},'Valor de '+s.title));
    const remove=el('button','×');remove.className='secondary remove';remove.setAttribute('aria-label','Eliminar '+s.title);remove.onclick=()=>{config.sources=config.sources.filter(x=>x!==s);delete values[s.id];renderSources();renderMapping();};cell(row,remove);body.append(row);
  }
}
function key(s,f){return mappingKey(s,f);}
function oldKey(s,f){return JSON.stringify([s.section,f.selector||f.label]);}
function mapping(s,f){const k=key(s,f);if(!config.mappings[k])config.mappings[k]=config.mappings[oldKey(s,f)]||autoMapping(f);return config.mappings[k];}
function suggest(f){
  const label=normalize(f.label);let source='';const result={enabled:false,source:'',fixed:'',rules:[],fallback:'',unknown:''};
  if(f.type==='file')source=/\bdni\b|identidad/.test(label)?'@file:dni':/pedido/.test(label)?'@file:pedido':'';
  else if(/tipo.*documento/.test(label))source='@documentType';
  else if(/dni.*vigor/.test(label)&&f.options){
    const vigente=f.options.find(o=>/^(fecha en vigor|en vigor|vigente)/.test(normalize(o.label)));
    const caducado=f.options.find(o=>/^caducado/.test(normalize(o.label)));
    if(vigente&&caducado)return {...result,source:'@rules',rules:[{left:'@documentStatus',op:'equals',right:'En vigor',output:vigente.value},{left:'@documentStatus',op:'equals',right:'Caducado',output:caducado.value}]};
  } else if(/numero.*(personal|documento)|^(dni|nie|nif)$/.test(label))source='documento';
  else {const exact=config.sources.find(s=>normalize(s.title)===label.replace(/\s*\(\*\)|\s*\*/g,''));if(exact)source=exact.id;}
  return {...result,source};
}
function valueEditor(f,value,change,label){
  if(f.options)return select([['','Pendiente / no rellenar'],...f.options.filter(o=>!o.disabled&&o.value!=='').map(o=>[o.value,o.label])],value,change,label);
  return input(value,change,label);
}
function labelledControl(title,control){const label=el('label');label.append(el('span',title),control);return label;}
function ruleEditor(f,m){
  const box=el('div');box.className='rules-editor';
  (m.rules||=[]).forEach((r,index)=>{
    const row=el('div');row.className='rule-row';row.append(el('strong','Si… '+(index+1)));
    row.append(select([['','Elige un dato'],...sources()],r.left,v=>{r.left=v;updatePreview();},'Dato de la condición'));
    row.append(select(operations,r.op,v=>{r.op=v;renderMapping();},'Comparación'));
    if(!['before_today','on_after_today'].includes(r.op))row.append(['equals_source','diff_source'].includes(r.op)?select([['','Otro dato'],...sources()],r.right,v=>{r.right=v;updatePreview();},'Dato con el que comparar'):input(r.right,v=>{r.right=v;updatePreview();},'Texto con el que comparar'));
    row.append(labelledControl('Entonces seleccionar / escribir',valueEditor(f,r.output,v=>{r.output=v;updatePreview();},'Resultado de la condición')));
    const remove=el('button','Quitar regla');remove.className='secondary';remove.onclick=()=>{m.rules.splice(index,1);renderMapping();};row.append(remove);box.append(row);
  });
  const add=el('button','Añadir condición');add.className='secondary';add.onclick=()=>{m.rules.push({left:'',op:'equals',right:'',output:''});renderMapping();};box.append(add);
  box.append(labelledControl('Si ninguna condición coincide',valueEditor(f,m.fallback,v=>{m.fallback=v;updatePreview();},'Valor si ninguna condición coincide')));
  box.append(labelledControl('Si falta un dato para decidir',valueEditor(f,m.unknown,v=>{m.unknown=v;updatePreview();},'Valor si falta un dato')));
  return box;
}
function renderMapping(){
  const box=$('#mapping');box.replaceChildren();
  if(!capture){box.append(el('p','Importa los campos del expediente para configurar las asignaciones.'));updatePreview();return;}
  for(const s of capture.sections){const section=el('div');section.className='mapping-section';section.append(el('h3',s.section));
    for(const f of s.fields){const k=key(s,f);const m=mapping(s,f);
      const card=el('article');card.className='field-card';card.dataset.fieldKey=k;
      const top=el('div');top.className='field-heading';const check=el('input');check.type='checkbox';check.checked=m.enabled;check.disabled=!f.selector||f.supported===false||f.readonly||f.disabled;check.setAttribute('aria-label','Rellenar '+f.label);check.onchange=()=>{m.enabled=check.checked;updatePreview();};
      const title=el('label');title.append(check,el('strong',f.label+(f.required?' *':'')));top.append(title,el('small',({radio:'Una opción',checkbox:'Casilla / conmutador','select-one':'Desplegable',file:'Adjunto',date:'Fecha'}[f.type]||'Texto')));card.append(top);
      if(check.disabled){card.append(el('p','Detectado, pero necesita adaptación o es de solo lectura.'));section.append(card);continue;}
      const choices=f.type==='file'?[['','Selecciona documento'],['@file:dni','Adjuntar archivo(s) del DNI'],['@file:pedido','Adjuntar archivo(s) del pedido']]:[['','Selecciona cómo rellenar'],['@fixed','Valor predeterminado · usar siempre'],['@rules','Reglas según los documentos'],...sources()];
      card.append(select(choices,m.source,v=>{m.source=v;if(v==='@rules'&&!m.rules?.length)m.rules=[{left:'',op:'equals',right:'',output:''}];renderMapping();},'Cómo rellenar '+f.label));
      if(m.source==='@fixed')card.append(labelledControl('Valor que se aplicará en cada expediente',valueEditor(f,m.fixed,v=>{m.fixed=v;updatePreview();},'Valor predeterminado de '+f.label)));
      else if(m.source==='@rules')card.append(ruleEditor(f,m));
      else if(m.source&&!m.source.startsWith('@file:'))card.append(labelledControl('Si el dato no aparece, usar',valueEditor(f,m.unknown,v=>{m.unknown=v;updatePreview();},'Valor si falta '+f.label)));
      const preview=el('p');preview.className='field-preview';preview.dataset.previewKey=k;card.append(preview);section.append(card);
    }box.append(section);
  }updatePreview();
}
function previewRows(){
  if(!capture)return [];
  return applyDependencies(capture.sections.flatMap(s=>s.fields.map(f=>{
    const k=key(s,f),m=mapping(s,f);let result=resolve(m,f,values,texts());
    if(!result.ready&&m.enabled&&m.source&&!m.source.startsWith('@fixed')){const option=matchProfileOption(f,values[m.source]||'');if(option)result={ready:true,value:option.value,display:option.label,reason:'Coincidencia única en el catálogo de Autocarpe'};}
    if(!result.ready&&m?.enabled&&m.source&&!['@fixed','@rules'].includes(m.source)&&m.unknown?.trim()&&result.reason==='Dato no disponible')result=resolve({...m,source:'@fixed',fixed:m.unknown},f,values,texts());
    if(result.fileSource){const files=[...$('#'+result.fileSource).files];result=files.length?{...result,files,display:files.map(x=>x.name).join(', ')}:{ready:false,reason:'No has elegido este documento'};if(files.length>1&&!f.multiple)result={ready:false,reason:'Solo admite un archivo: une las páginas en un PDF'};}
    return {s,f,k,m,result};
  })));
}
function updatePreview(){
  const rows=previewRows();let selected=0,ready=0,pending=0,inactive=0;
  for(const {k,m,result}of rows){if(m?.enabled){selected++;result.inactive?inactive++:result.ready?ready++:pending++;}
    const target=[...document.querySelectorAll('[data-preview-key]')].find(e=>e.dataset.previewKey===k);if(target){target.textContent=result.excluded?'No se rellenará':result.ready?'Resultado: '+result.display+' · '+result.reason:(result.inactive?'No aplica: ':'Pendiente: ')+result.reason;target.classList.toggle('pending',!result.ready&&!result.excluded&&!result.inactive);}
  }
  $('#preview-summary').textContent=selected?`${ready} campos listos · ${pending} pendientes · ${inactive} no aplican · ${rows.length-selected} sin seleccionar`:'Elige los campos que quieras rellenar.';
  const table=$('#fill-preview');table.replaceChildren();
  for(const {s,f,m,result}of rows.filter(r=>r.m?.enabled)){const row=el('tr');cell(row,el('span',s.section+' · '+f.label));cell(row,el('span',result.ready?result.display||result.value||'Sin selección':result.inactive?'No aplica':'Pendiente'));cell(row,el('span',result.reason));table.append(row);}
  $('#data-warnings').textContent=values.documento&&!documentType(values.documento)?'El número de DNI/NIE no supera la comprobación de formato y letra. Revísalo antes de usarlo.':'';
}
function bridge(action,items){return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();const listener=e=>{if(e.source!==window||e.origin!==location.origin||e.data?.source!=='ocrtrabajo-extension'||e.data.id!==id)return;clearTimeout(timer);window.removeEventListener('message',listener);if(e.data.result?.error)reject(Error(e.data.result.error));else resolve(e.data.result);};
  const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(Error(action==='fill'?'La operación no ha respondido. Comprueba la intranet antes de volver a enviar.':'No se ha podido conectar con la extensión. Actualízala y recarga esta página.'));},action==='fill'?240000:5000);
  window.addEventListener('message',listener);window.postMessage({source:'ocrtrabajo-page',id,action,items,overwrite:config.overwrite},location.origin);
});}
$('#import').onclick=async()=>{try{const next=await bridge('getScan');if(next.version!==3)throw Error('Necesitas la extensión 0.3. Descárgala de nuevo y recarga la intranet.');capture=next;connected=true;config.sections=capture.sections;
  $('#capture-status').textContent=capture.sections.reduce((n,s)=>n+s.fields.length,0)+' campos reconocidos en '+capture.sections.length+' secciones.';
  $('#capture-warnings').replaceChildren(...(capture.warnings||[]).map(w=>el('li',w)));renderMapping();renderHabits();
}catch(e){$('#capture-status').textContent=e.message;}};
$('#add-source').onclick=()=>{config.sources.push({id:crypto.randomUUID(),title:'Nuevo dato',doc:'pedido',label:''});renderSources();renderMapping();};
$('#select-all').onclick=()=>{if(!capture)return;for(const s of capture.sections)for(const f of s.fields)if(f.selector&&f.supported!==false&&!f.readonly&&!f.disabled)config.mappings[key(s,f)].enabled=true;renderMapping();};
$('#select-none').onclick=()=>{for(const m of Object.values(config.mappings))m.enabled=false;renderMapping();};
function extract(){const raw=texts();const data={dni:{...(documents.dni||{}),text:raw.dni},pedido:{...(documents.pedido||{}),text:raw.pedido}};if(documents.pedido&&raw.pedido!==documents.pedido.text)data.pedido.pages=raw.pedido.split('\f').map((text,i)=>({text,page:i+1}));analysisReport=analyzeDocuments(data,config.policy);values={...extractValues(config.sources,raw),...analysisReport.values};renderSources();renderDocumentPreview();updatePreview();}
$('#extract').onclick=extract;
$('#process').onclick=async()=>{
 if(busy)return;const docs=['pedido','dni'].flatMap(doc=>[...$('#'+doc).files].map(file=>({doc,file})));if(!docs.length){$('#status').textContent='Selecciona un pedido y un DNI.';return;}
 if(docs.some(({file})=>file.size>30*1024*1024)){$('#status').textContent='Cada archivo debe ocupar menos de 30 MB.';return;}
 busy=true;$('#status').textContent='Preparando la lectura local…';for(const id of ['process','clear','fill'])$('#'+id).disabled=true;$('#progress').hidden=false;values={};documents={};analysisReport=null;for(const doc of ['pedido','dni'])$('#'+doc+'-text').value='';renderSources();renderDocumentPreview();let worker;
 try{
  worker=await Tesseract.createWorker('spa',1,{workerPath:'/assets/ocrtrabajo/vendor/worker.min.js',corePath:'/assets/ocrtrabajo/vendor/core',langPath:'/assets/ocr-models',gzip:false,cacheMethod:'none',workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')$('#progress').value=m.progress;}});
  for(const {doc,file}of docs){const result=await readDocument(file,doc,worker,message=>$('#status').textContent=message);if(!documents[doc])documents[doc]={pages:[],text:''};documents[doc].pages.push(...result.pages);documents[doc].text+=(documents[doc].text?'\n\f\n':'')+result.text;$('#'+doc+'-text').value=documents[doc].text;}
  extract();$('#status').textContent='Previo preparado. Revisa los datos y los campos pendientes antes de rellenar.';
 }catch(e){$('#status').textContent='No se pudo completar la lectura: '+e.message;}
 finally{if(worker)await worker.terminate();busy=false;for(const id of ['process','clear','fill'])$('#'+id).disabled=false;$('#progress').hidden=true;}
};
$('#clear').onclick=()=>{for(const doc of ['pedido','dni']){$('#'+doc).value='';$('#'+doc+'-text').value='';}values={};documents={};analysisReport=null;renderSources();renderDocumentPreview();updatePreview();$('#status').textContent='Documentos y datos borrados de esta página. Tus reglas siguen guardadas.';$('#fill-status').textContent='';};
$('#overwrite').checked=config.overwrite;$('#overwrite').onchange=e=>config.overwrite=e.target.checked;
$('#save').onclick=()=>{try{if(capture)config.sections=capture.sections;localStorage.setItem(storageKey,JSON.stringify(config));$('#fill-status').textContent='Guardado en localStorage: campos, reglas y valores predeterminados. No se guardan archivos ni valores extraídos.';}catch{$('#fill-status').textContent='El navegador no permite guardar esta configuración.';}};
function downloadJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export-config').onclick=()=>downloadJSON(config,'ocrtrabajo-config.json');
$('#export-schema').onclick=()=>{if(!capture){$('#capture-status').textContent='Importa primero los campos.';return;}downloadJSON({version:3,sections:capture.sections,warnings:capture.warnings||[]},'ocrtrabajo-campos.json');};
$('#config-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>3*1024*1024)throw Error('Configuración demasiado grande.');config=validate(JSON.parse(await file.text()));values={};if(!connected&&config.sections?.length)capture={version:2,sections:config.sections,warnings:[]};$('#overwrite').checked=config.overwrite;analysisReport=null;renderSources();renderMapping();renderHabits();renderDocumentPreview();$('#fuel-policy').value=config.policy.tribridFuel;$('#delivery-policy').value=config.policy.deliveryDate;$('#fill-status').textContent='Configuración importada. Pulsa Guardar para conservarla.';}catch(err){$('#fill-status').textContent=err.message;}e.target.value='';};
for(const doc of ['pedido','dni']){$('#'+doc).addEventListener('change',()=>{values={};documents={};analysisReport=null;$('#pedido-text').value='';$('#dni-text').value='';renderSources();renderDocumentPreview();updatePreview();$('#status').textContent='Documentos cambiados: pulsa Leer documentos para extraer sus datos.';});$('#'+doc+'-text').addEventListener('input',updatePreview);}
async function serializeFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('No se pudo leer '+file.name));reader.onload=()=>resolve({name:file.name,type:file.type,lastModified:file.lastModified,data:String(reader.result).split(',')[1]});reader.readAsDataURL(file);});}
$('#fill').onclick=async()=>{
  if(busy)return;
  try{
    if(values.documento&&values.documento_pedido&&values.documento!==values.documento_pedido)throw Error('El DNI y el pedido no coinciden. Revisa los documentos o corrige la lectura antes de rellenar.');
    if(!capture||!connected)throw Error('Importa los campos del expediente actual antes de rellenar.');
    const rows=previewRows().filter(row=>row.m?.enabled);const ready=rows.filter(row=>row.result.ready);const pending=rows.filter(row=>!row.result.ready&&!row.result.inactive);
    if(!ready.length)throw Error('No hay campos listos. Elige sus datos, reglas o valores predeterminados.');
    const total=ready.flatMap(r=>r.result.files||[]).reduce((n,f)=>n+f.size,0);if(total>20*1024*1024)throw Error('Los adjuntos seleccionados superan 20 MB. Reduce su tamaño o adjúntalos en la intranet.');
    if(pending.length&&!confirm(pending.length+' campos siguen pendientes. ¿Rellenar los '+ready.length+' campos que están listos?'))return;
    busy=true;$('#fill').disabled=true;$('#process').disabled=true;$('#clear').disabled=true;
    const items=[];for(const {s,f,result}of ready)items.push({selector:f.selector,sectionId:s.id,value:result.value,files:result.files?await Promise.all(result.files.map(serializeFile)):undefined});
    $('#fill-status').textContent='Confirma en la intranet para aplicar los '+items.length+' campos seleccionados.';
    const result=await bridge('fill',items);$('#fill-status').textContent=result.cancelled?'Rellenado cancelado.':result.count+' campos rellenados. '+(result.errors?.length?result.errors.join(' · '):'Revisa el expediente y guárdalo en la intranet.')+(pending.length?' Quedan '+pending.length+' campos pendientes.':'');
  }catch(e){$('#fill-status').textContent=e.message;}finally{busy=false;$('#fill').disabled=false;$('#process').disabled=false;$('#clear').disabled=false;}
};
function renderDocumentPreview(){
 const box=$('#document-preview');box.replaceChildren();$('#analysis-notes').replaceChildren();$('#analysis-facts').replaceChildren();if(!analysisReport){box.append(el('p','Carga los documentos y pulsa Leer documentos para preparar el previo.'));return;}
 const groups=[['Comprador · DNI', ['nombre','apellidos','documento','nacimiento','caducidad','domicilio','ciudad','provincia']],['Contacto · pedido', ['documento_pedido','email','movil','cp']],['Vehículo solicitado', ['marca','modelo','version','motor','combustible','color','tapiceria','equipamiento']],['Importes y entrega', ['pff','transporte','matriculacion','total_pedido','senal','tasacion','saldo_pendiente','forma_pago','plazo_desde','plazo_hasta','fecha_cliente']]];
 for(const [title,ids]of groups){const group=el('section');group.className='review-group';group.append(el('h3',title));const grid=el('div');grid.className='review-grid';for(const id of ids){const source=config.sources.find(s=>s.id===id);if(!source)continue;const control=input(values[id],v=>{values[id]=v;updatePreview();},source.title);control.dataset.reviewSource=id;const label=labelledControl(source.title,control);const e=analysisReport.evidence[id];label.append(el('small',e?(e.doc==='dni'?'DNI':'Pedido')+' · página '+e.page+' · '+e.detail:'No confirmado: revisa o completa'));grid.append(label);}group.append(grid);box.append(group);}
 const notes=$('#analysis-notes');notes.replaceChildren(...analysisReport.warnings.map(w=>el('li',w)));
 const facts=$('#analysis-facts');facts.replaceChildren(...analysisReport.facts.map(f=>el('p',f.label+': '+f.detail+' = '+f.value+' €')));
}
function renderHabits(){
 const box=$('#habit-fields');box.replaceChildren();if(!capture){box.append(el('p','Importa los campos para elegir tus respuestas habituales.'));return;}
 const known=new Set(['matricula el cliente mandato no obligatorio','portaplacas sin publicidad','tiene servicios conectados','prueba vehiculo','solicitar padron','familia numerosa','exento de im 0%','plan de ayuda estatal moves u otros','otros planes que requieran achatarramiento','plan de ayuda autonomico cambia madrid u otros','declara minusvalia','instalacion de entrega','tipo de matriculacion','tipo de servicio']);
 for(const section of capture.sections)for(const f of section.fields){const name=normalize(f.label).replace(/[¿?*()]/g,'').replace(/\s+/g,' ').trim();if(!known.has(name)||f.disabled||!f.options)continue;const m=mapping(section,f),opts=[['','Sin definir / revisar en cada expediente'],...f.options.filter(o=>!o.disabled&&o.value!=='').map(o=>[o.value,o.label])];if(f.selector==='#sale-personaldisability-id')opts.push(['@empty','Sin declaración de minusvalía']);
  const control=select(opts,m.source==='@fixed'?m.fixed:'',v=>{m.source=v?'@fixed':'';m.fixed=v;m.enabled=!!v;renderMapping();saveQuietly();},'Habitual: '+f.label);box.append(labelledControl(f.label,control));
 }
}
function saveQuietly(){try{config.sections=capture?.sections||config.sections;localStorage.setItem(storageKey,JSON.stringify(config));$('#habit-status').textContent='Valores habituales guardados en este navegador.';}catch{$('#habit-status').textContent='No se pudieron guardar los valores habituales.';}}
function adoptSchema(next,isConnected=false){if(!next||!Array.isArray(next.sections)||next.sections.length>100)throw Error('Estructura no válida.');capture=next;connected=isConnected;config.sections=capture.sections;for(const section of capture.sections)for(const f of section.fields)mapping(section,f);renderMapping();renderHabits();}
$('#schema-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>3*1024*1024)throw Error('La estructura es demasiado grande.');adoptSchema(JSON.parse(await file.text()));$('#capture-status').textContent='Estructura importada: puedes preparar el previo. Para volcar datos, reconoce el expediente actual con la extensión 0.3 e impórtalo.';}catch(err){$('#capture-status').textContent=err.message;}e.target.value='';};
$('#autoconfigure').onclick=()=>{if(!capture){$('#capture-status').textContent='Importa antes la estructura del expediente.';return;}let count=0;for(const s of capture.sections)for(const f of s.fields){const proposed=autoMapping(f),current=mapping(s,f);if(proposed.enabled&&!(current.source==='@fixed'&&current.fixed)){config.mappings[key(s,f)]=proposed;count++;}}renderMapping();renderHabits();saveQuietly();$('#capture-status').textContent=count+' campos configurados con el perfil Autocarpe. Revisa los valores habituales y el previo.';};
for(const [id,key]of [['fuel-policy','tribridFuel'],['delivery-policy','deliveryDate']]){$('#'+id).value=config.policy?.[key]||'';$('#'+id).onchange=e=>{config.policy[key]=e.target.value;saveQuietly();if(analysisReport)extract();};}
renderSources();renderMapping();renderHabits();renderDocumentPreview();
if(capture&&!connected)$('#capture-status').textContent='Plantilla local recuperada. Reconoce e importa el expediente actual para poder rellenarlo.';
