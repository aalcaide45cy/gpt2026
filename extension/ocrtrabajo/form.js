const available = e => !e.disabled && !e.readOnly && e.getClientRects().length && !['hidden','password','file','submit','button','reset','checkbox','radio','image'].includes(e.type);
const clean = s => (s || '').replace(/\s+/g,' ').trim().slice(0,180);
function label(e) { return clean([...e.labels || []].map(l=>l.textContent).join(' ') || e.getAttribute('aria-label') || e.placeholder || e.name || e.id); }
function locate(e) {
 if(e.id && document.querySelectorAll('#'+CSS.escape(e.id)).length===1) return '#'+CSS.escape(e.id);
 if(e.name) { const selector=e.tagName.toLowerCase()+'[name='+JSON.stringify(e.name)+']'; if(document.querySelectorAll(selector).length===1)return selector; }
 return null;
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 if(msg.action==='scan') {
  const selected=document.querySelector('[role=tab][aria-selected=true]');
  const tabs=[...document.querySelectorAll('[role=tab]')].map(e=>({label:clean(e.textContent),selector:locate(e)})).filter(t=>t.selector);
  const fields=[...document.querySelectorAll('input,select,textarea')].filter(available).map(e=>({label:label(e),selector:locate(e),type:e.type,required:e.required,options:e.tagName==='SELECT'?[...e.options].map(o=>({label:clean(o.textContent),value:o.value,disabled:o.disabled})):null}));
  reply({url:location.href,title:document.title,section:clean(selected?.textContent)||'Formulario visible',tabSelector:selected?locate(selected):null,tabs,fields});
 }
 if(msg.action==='fill') {
  (async()=>{
   if(location.href!==msg.url)throw new Error('La dirección ha cambiado. Vuelve a reconocer los campos.');
   if(!confirm('OCR Trabajo va a rellenar '+msg.items.length+' campos. Revisa el expediente antes de guardarlo. ¿Continuar?'))return {cancelled:true};
   let count=0;const errors=[];
   for(const item of msg.items) {
    if(item.tabSelector){const tab=document.querySelector(item.tabSelector);if(!tab || tab.getAttribute('role')!=='tab') {errors.push(item.label+': abre esta pestaña y vuelve a reconocerla');continue;}if(tab.getAttribute('aria-selected')!=='true'){tab.click();await new Promise(r=>setTimeout(r,450));}}
    const nodes=document.querySelectorAll(item.selector);const e=nodes.length===1?nodes[0]:null;
    if(!e || !['INPUT','TEXTAREA','SELECT'].includes(e.tagName) || !available(e) || (item.type && e.type!==item.type)){errors.push(item.label+': campo no disponible');continue;}
    if(e.value && e.value!==item.value){errors.push(item.label+': ya contiene un valor; no se sobrescribe');continue;}
    if(e.tagName==='SELECT' && ![...e.options].some(o=>o.value===item.value&&!o.disabled)){errors.push(item.label+': opción no encontrada');continue;}
    const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(e,item.value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));count++;
   }
   return {count,errors};
  })().then(reply).catch(e=>reply({error:e.message}));return true;
 }
});
