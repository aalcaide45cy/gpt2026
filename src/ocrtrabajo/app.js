import * as pdfjs from './vendor/pdf.min.mjs';
import {defaults,builtins,operations,normalize,resolve,extractValues,documentType,applyDependencies} from './rules.mjs';
pdfjs.GlobalWorkerOptions.workerSrc='/assets/ocrtrabajo/vendor/pdf.worker.min.mjs';
const $=s=>document.querySelector(s), storageKey='ocrtrabajo-template-v1';
let config={version:2,sources:structuredClone(defaults),mappings:{},overwrite:false},capture=null,connected=false,values={},busy=false;
function validate(x){
  if(!x||!Array.isArray(x.sources)||x.sources.length>100||!x.mappings||typeof x.mappings!=='object'||Array.isArray(x.mappings))throw Error('Configuración no válida.');
  const short=v=>typeof v==='string'&&v.length<=10000;
  const sources=x.sources.map(s=>{if(!s||!['pedido','dni'].includes(s.doc)||['id','title','label'].some(k=>!short(s[k])||s[k].length>180))throw Error('Dato no válido.');return {id:s.id,title:s.title,doc:s.doc,label:s.label};});
  if(x.version!==2)for(const source of defaults)if(!sources.some(s=>s.id===source.id))sources.push({...source});
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
  return {version:2,sources,mappings,sections,overwrite:x.overwrite===true};
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
function key(s,f){return JSON.stringify([s.section,f.selector||f.label]);}
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
    for(const f of s.fields){const k=key(s,f);const m=config.mappings[k]||suggest(f);config.mappings[k]=m;
      const card=el('article');card.className='field-card';card.dataset.fieldKey=k;
      const top=el('div');top.className='field-heading';const check=el('input');check.type='checkbox';check.checked=m.enabled;check.disabled=!f.selector||f.supported===false||f.readonly;check.setAttribute('aria-label','Rellenar '+f.label);check.onchange=()=>{m.enabled=check.checked;updatePreview();};
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
    const k=key(s,f),m=config.mappings[k];let result=resolve(m,f,values,texts());
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
  $('#data-warnings').textContent=values.documento&&!documentType(values.documento)?'El número de DNI/NIE no supera la comprobación de formato y letra. Revísalo antes de usarlo.':'';
}
function bridge(action,items){return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID();const listener=e=>{if(e.source!==window||e.origin!==location.origin||e.data?.source!=='ocrtrabajo-extension'||e.data.id!==id)return;clearTimeout(timer);window.removeEventListener('message',listener);if(e.data.result?.error)reject(Error(e.data.result.error));else resolve(e.data.result);};
  const timer=setTimeout(()=>{window.removeEventListener('message',listener);reject(Error(action==='fill'?'La operación no ha respondido. Comprueba la intranet antes de volver a enviar.':'No se ha podido conectar con la extensión. Actualízala y recarga esta página.'));},action==='fill'?240000:5000);
  window.addEventListener('message',listener);window.postMessage({source:'ocrtrabajo-page',id,action,items,overwrite:config.overwrite},location.origin);
});}
$('#import').onclick=async()=>{try{const next=await bridge('getScan');if(next.version!==2)throw Error('Necesitas la extensión 0.2. Descárgala de nuevo y recarga la intranet.');capture=next;connected=true;config.sections=capture.sections;
  $('#capture-status').textContent=capture.sections.reduce((n,s)=>n+s.fields.length,0)+' campos reconocidos en '+capture.sections.length+' secciones.';
  $('#capture-warnings').replaceChildren(...(capture.warnings||[]).map(w=>el('li',w)));renderMapping();
}catch(e){$('#capture-status').textContent=e.message;}};
$('#add-source').onclick=()=>{config.sources.push({id:crypto.randomUUID(),title:'Nuevo dato',doc:'pedido',label:''});renderSources();renderMapping();};
$('#select-all').onclick=()=>{if(!capture)return;for(const s of capture.sections)for(const f of s.fields)if(f.selector&&f.supported!==false&&!f.readonly)config.mappings[key(s,f)].enabled=true;renderMapping();};
$('#select-none').onclick=()=>{for(const m of Object.values(config.mappings))m.enabled=false;renderMapping();};
function extract(){values=extractValues(config.sources,texts());renderSources();updatePreview();}
$('#extract').onclick=extract;
async function imageOCR(file,worker){const bitmap=await createImageBitmap(file);try{const canvas=document.createElement('canvas');const scale=Math.min(1,3000/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);return (await worker.recognize(canvas)).data.text;}finally{bitmap.close();}}
async function readPDF(file,worker){const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,cMapUrl:"/assets/ocrtrabajo/vendor/cmaps/",cMapPacked:true,standardFontDataUrl:"/assets/ocrtrabajo/vendor/standard_fonts/"}).promise;try{let text='';if(pdf.numPages>50)throw Error('El PDF supera 50 páginas. Divide el documento.');for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();const embedded=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('');$('#status').textContent='Leyendo PDF · página '+n+' de '+pdf.numPages;if(embedded.trim().length>30)text+=embedded+'\n';else{const base=page.getViewport({scale:1});const view=page.getViewport({scale:Math.min(2,3000/Math.max(base.width,base.height))});const canvas=document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);await page.render({canvasContext:canvas.getContext('2d'),viewport:view}).promise;text+=(await worker.recognize(canvas)).data.text+'\n';}page.cleanup();}return text;}finally{await pdf.destroy();}}
$('#process').onclick=async()=>{if(busy)return;const docs=['pedido','dni'].flatMap(doc=>[...$('#'+doc).files].map(file=>({doc,file})));if(!docs.length){$('#status').textContent='Selecciona un pedido o un DNI.';return;}if(docs.some(({file})=>file.size>30*1024*1024)){ $('#status').textContent='Cada archivo debe ocupar menos de 30 MB.';return;}
 busy=true;$('#status').textContent='Preparando el OCR local…';$('#process').disabled=true;$('#clear').disabled=true;$('#fill').disabled=true;$('#progress').hidden=false;$('#pedido-text').value='';$('#dni-text').value='';values={};renderSources();let worker;
 try{worker=await Tesseract.createWorker('spa',1,{workerPath:'/assets/ocrtrabajo/vendor/worker.min.js',corePath:'/assets/ocrtrabajo/vendor/core',langPath:'/assets/ocr-models',gzip:false,cacheMethod:'none',workerBlobURL:false,logger:m=>{if(m.status==='recognizing text'){$('#progress').value=m.progress;}}});for(const {doc,file}of docs){$('#status').textContent='Leyendo '+file.name;const text=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')?await readPDF(file,worker):await imageOCR(file,worker);$('#'+doc+'-text').value+=text+'\n';}extract();$('#status').textContent='Lectura terminada. Revisa los datos extraídos, especialmente el DNI y los importes.';}catch(e){$('#status').textContent='No se pudo completar la lectura: '+e.message;}finally{if(worker)await worker.terminate();busy=false;$('#process').disabled=false;$('#clear').disabled=false;$('#fill').disabled=false;$('#progress').hidden=true;}};
$('#clear').onclick=()=>{for(const doc of ['pedido','dni']){$('#'+doc).value='';$('#'+doc+'-text').value='';}values={};renderSources();updatePreview();$('#status').textContent='Documentos y datos borrados de esta página. Tus reglas siguen guardadas.';$('#fill-status').textContent='';};
$('#overwrite').checked=config.overwrite;$('#overwrite').onchange=e=>config.overwrite=e.target.checked;
$('#save').onclick=()=>{try{if(capture)config.sections=capture.sections;localStorage.setItem(storageKey,JSON.stringify(config));$('#fill-status').textContent='Guardado en localStorage: campos, reglas y valores predeterminados. No se guardan archivos ni valores extraídos.';}catch{$('#fill-status').textContent='El navegador no permite guardar esta configuración.';}};
function downloadJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export-config').onclick=()=>downloadJSON(config,'ocrtrabajo-config.json');
$('#export-schema').onclick=()=>{if(!capture){$('#capture-status').textContent='Importa primero los campos.';return;}downloadJSON({version:2,sections:capture.sections,warnings:capture.warnings||[]},'ocrtrabajo-campos.json');};
$('#config-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>3*1024*1024)throw Error('Configuración demasiado grande.');config=validate(JSON.parse(await file.text()));values={};if(!connected&&config.sections?.length)capture={version:2,sections:config.sections,warnings:[]};$('#overwrite').checked=config.overwrite;renderSources();renderMapping();$('#fill-status').textContent='Configuración importada. Pulsa Guardar para conservarla.';}catch(err){$('#fill-status').textContent=err.message;}e.target.value='';};
for(const doc of ['pedido','dni']){$('#'+doc).addEventListener('change',()=>{values={};$('#pedido-text').value='';$('#dni-text').value='';renderSources();updatePreview();$('#status').textContent='Documentos cambiados: pulsa Leer documentos para extraer sus datos.';});$('#'+doc+'-text').addEventListener('input',updatePreview);}
async function serializeFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(Error('No se pudo leer '+file.name));reader.onload=()=>resolve({name:file.name,type:file.type,lastModified:file.lastModified,data:String(reader.result).split(',')[1]});reader.readAsDataURL(file);});}
$('#fill').onclick=async()=>{
  if(busy)return;
  try{
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
renderSources();renderMapping();
if(capture&&!connected)$('#capture-status').textContent='Plantilla local recuperada. Reconoce e importa el expediente actual para poder rellenarlo.';
