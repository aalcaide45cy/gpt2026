export const defaults = [
  ['nombre','Nombre','dni','Nombre'], ['apellidos','Apellidos','dni','Apellidos'],
  ['documento','DNI / NIE','dni',''], ['domicilio','Domicilio del DNI','dni','Domicilio'],
  ['caducidad','Caducidad del DNI','dni','Validez|Caducidad|Válido hasta'],
  ['domicilio_pedido','Domicilio del pedido','pedido','Domicilio|Dirección'],
  ['pedido','Número de pedido','pedido','Número de pedido'], ['fecha','Fecha del pedido','pedido','Fecha'],
  ['matricula','Matrícula','pedido','Matrícula'], ['vehiculo','Vehículo','pedido','Vehículo'],
  ['importe','Importe','pedido','Total'], ['telefono','Teléfono','pedido','Teléfono'], ['email','Correo electrónico','pedido','Email'],
  ['forma_pago','Forma de pago','pedido','Forma de pago'], ['combustible','Combustible','pedido','Combustible']
].map(([id,title,doc,label]) => ({id,title,doc,label}));
export const builtins = [['@documentType','Tipo de documento (DNI / NIE verificado)'],['@documentStatus','Estado del DNI (En vigor / Caducado)'],['@addressMatch','Comparación de domicilios'],['@text:pedido','Texto completo del pedido'],['@text:dni','Texto completo del DNI']];
export const operations = [['equals','Es igual a'],['contains','Contiene'],['not_contains','No contiene'],['equals_source','Coincide con otro dato'],['diff_source','Es distinto de otro dato'],['before_today','Fecha anterior a hoy'],['on_after_today','Fecha de hoy o posterior']];
export const normalize = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function parseDate(text) {
  const s = String(text || '').trim(); let year, month, day;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) [,year,month,day] = m;
  else { m = s.match(/^(\d{1,2})[\s./-]+(\d{1,2})[\s./-]+(\d{4})$/); if (!m) return null; [,day,month,year] = m; }
  const d = new Date(Number(year),Number(month)-1,Number(day));
  if (d.getFullYear()!==Number(year) || d.getMonth()!==Number(month)-1 || d.getDate()!==Number(day) || Number(year)<1900) return null;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
export function documentType(value) {
  const s = String(value || '').toUpperCase().replace(/[\s-]/g,'');
  if (!/^(?:\d{8}|[XYZ]\d{7})[A-Z]$/.test(s)) return '';
  const n = s.slice(0,-1).replace(/^[XYZ]/, c => ({X:'0',Y:'1',Z:'2'}[c]));
  if ('TRWAGMYFPDXBNJZSQVHLCKE'[Number(n)%23]!==s.at(-1)) return '';
  return /^[XYZ]/.test(s)?'NIE':'DNI';
}
export function sourceValue(id, values, texts, today = new Date()) {
  if (id === '@text:dni') return texts.dni || '';
  if (id === '@text:pedido') return texts.pedido || '';
  if (id === '@documentType') return documentType(values.documento);
  if (id === '@documentStatus') {
    if (normalize(values.caducidad)==='permanente') return 'En vigor';
    const date=parseDate(values.caducidad); if(!date)return '';
    const current=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    return date>=current?'En vigor':'Caducado';
  }
  if (id === '@addressMatch') {
    if(!values.domicilio?.trim()||!values.domicilio_pedido?.trim())return '';
    const address=s=>normalize(s).replace(/[.,]/g,'').replace(/\s+/g,' ');
    return address(values.domicilio)===address(values.domicilio_pedido)?'Coinciden':'Revisar diferencias';
  }
  return String(values[id] ?? '');
}
function condition(rule, values, texts, today) {
  const left = sourceValue(rule.left,values,texts,today); if(!left.trim())return null;
  if(['before_today','on_after_today'].includes(rule.op)) {
    const date=parseDate(left); if(!date)return null;
    const current=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    return rule.op==='before_today'?date<current:date>=current;
  }
  const right=['equals_source','diff_source'].includes(rule.op)?sourceValue(rule.right,values,texts,today):String(rule.right||'');
  if(!right.trim())return null;
  const a=normalize(left),b=normalize(right);
  if(rule.op==='equals'||rule.op==='equals_source')return a===b;
  if(rule.op==='diff_source')return a!==b;
  if(rule.op==='contains')return a.includes(b);
  if(rule.op==='not_contains')return !a.includes(b);
  return null;
}
export function resolve(mapping, field, values, texts, today = new Date()) {
  const pending = reason => ({ready:false,reason});
  if(!mapping?.enabled)return {ready:false,excluded:true,reason:'No seleccionado'};
  if(!field.selector || field.supported===false || field.readonly)return pending('Necesita adaptación o es de solo lectura');
  if(field.type==='file')return ['@file:dni','@file:pedido'].includes(mapping.source)?{ready:true,fileSource:mapping.source.slice(6),reason:'Adjuntar documento'}:pending('Elige qué documento adjuntar');
  let value='',reason='';
  if(mapping.source==='@fixed') {value=mapping.fixed||'';reason='Valor predeterminado';}
  else if(mapping.source==='@rules') {
    if(!mapping.rules?.length)return pending('Añade al menos una regla');
    let chosen=false;
    for(const rule of mapping.rules) {
      const result=condition(rule,values,texts,today);
      if(result===null){value=mapping.unknown||'';reason='Falta un dato; valor predeterminado explícito';chosen=true;break;}
      if(result){value=rule.output||'';reason='Regla cumplida';chosen=true;break;}
    }
    if(!chosen){value=mapping.fallback||'';reason='Ninguna regla coincide';}
    if(!value.trim())return pending(chosen?'La regla necesita un dato o resultado: revisar':'Ninguna regla coincide: revisar');
  } else {value=sourceValue(mapping.source,values,texts,today);reason='Dato del documento';}
  if(!value.trim())return pending('Dato no disponible');
  if(field.options) {
    const matches=field.options.filter(o=>!o.disabled&&(o.value===value||normalize(o.label)===normalize(value)));
    const exact=matches.find(o=>o.value===value);
    if(!exact&&matches.length!==1)return pending('El dato no coincide con una opción única');
    const option=exact||matches[0];return {ready:true,value:option.value,display:option.label,reason};
  }
  if(field.type==='date') {value=parseDate(value);if(!value)return pending('Fecha no válida; usa DD/MM/AAAA');}
  if(field.type==='number') {
    value=value.trim().replace(/\s|€/g,'');
    if(value.includes(','))value=value.replace(/\./g,'').replace(',','.');
    if(!/^-?\d+(\.\d+)?$/.test(value))return pending('Importe o número no válido');
  }
  return {ready:true,value,display:value,reason};
}
export function extractValues(sources,texts) {
  const values={};
  for(const source of sources){
    const text=texts[source.doc]||'';
    if(source.id==='documento'){
      const candidates=[...text.toUpperCase().matchAll(/\b(?:\d{8}|[XYZ]\d{7})[A-Z]\b/g)].map(m=>m[0]);
      const valid=[...new Set(candidates.filter(documentType))];
      values[source.id]=valid.length===1?valid[0]:valid.length===0&&new Set(candidates).size===1?candidates[0]:'';continue;
    }
    const labels=source.label.split('|').map(s=>s.trim()).filter(Boolean);if(!labels.length)continue;
    const lines=text.split('\n').map(s=>s.trim());
    for(let i=0;i<lines.length;i++){
      // A label is matched at the start of a line, avoiding "Nombre" inside "Nombre del vendedor".
      const tag=labels.find(label=>normalize(lines[i]).startsWith(normalize(label)) && /^(?:\s|[:=\-]|$)/.test(lines[i].slice(label.length)));
      if(!tag)continue;
      let value=lines[i].slice(tag.length).replace(/^\s*[:=\-]?\s*/,'').trim();
      if(!value)value=lines[i+1]||'';
      const allLabels=sources.filter(s=>s.doc===source.doc).flatMap(s=>s.label.split('|')).filter(Boolean);
      if(allLabels.some(l=>normalize(value).startsWith(normalize(l)+':')))value='';
      if(source.id==='caducidad'){
        const dates=value.match(/\b\d{1,2}[\s./-]\d{1,2}[\s./-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g)||[];
        value=dates.length===1&&parseDate(dates[0])?dates[0]:normalize(value)==='permanente'?'Permanente':'';
      }
      values[source.id]=value;break;
    }
  }
  return values;
}
export function applyDependencies(rows) {
  const result=rows.map(row=>({...row,result:{...row.result}}));
  for(let pass=0;pass<8;pass++){
    let changed=false;
    for(const row of result){
      if(!row.m?.enabled||!row.f.paths||row.f.paths.some(path=>path.length===0))continue;
      let state;
      if(!row.f.paths.length)state='unknown';
      else {
        const paths=row.f.paths.map(path=>{
          let unknown=false;
          for(const step of path){
            const parent=result.find(r=>r.f.selector===step.selector&&r.s.id===step.sectionId);
            if(parent?.result.inactive)return false;
            if(!parent?.m?.enabled||!parent.result.ready){unknown=true;continue;}
            if(parent.result.value!==step.value)return false;
          }
          return unknown?null:true;
        });
        state=paths.includes(true)?'active':paths.includes(null)?'unknown':'inactive';
      }
      if(state==='inactive'&&!row.result.inactive){row.result={ready:false,inactive:true,reason:'No aplica con las opciones configuradas'};changed=true;}
      if(state==='unknown'&&row.result.ready){row.result={ready:false,reason:'Configura la opción que muestra este campo o vuelve a explorar'};changed=true;}
    }
    if(!changed)break;
  }
  return result;
}
