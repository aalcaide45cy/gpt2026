chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
 (async()=>{
  if(msg.action==='scan'){
   const tab=await chrome.tabs.get(msg.tabId);
   if(!tab.url?.startsWith('https://intranet.autocarpe.com/'))throw new Error('Abre Crear expediente en la intranet antes de reconocer campos.');
   const scan=await chrome.tabs.sendMessage(tab.id,{action:'scan'});
   const {capture}=await chrome.storage.session.get('capture');
   const same=capture?.tabId===tab.id && capture?.url===scan.url;
   const sections=same?capture.sections.filter(s=>s.section!==scan.section):[];
   sections.push(scan);
   const next={tabId:tab.id,url:scan.url,sections};await chrome.storage.session.set({capture:next});return next;
  }
  if(!sender.url?.startsWith('https://gpt2026.vercel.app/ocrtrabajo'))throw new Error('Origen no permitido.');
  const {capture}=await chrome.storage.session.get('capture');
  if(!capture)throw new Error('Abre el expediente y pulsa Reconocer campos en la extensión.');
  if(msg.action==='getScan')return capture;
  if(msg.action==='fill'){
   const allowed=capture.sections.flatMap(s=>s.fields.filter(f=>f.selector).map(f=>({...f,tabSelector:s.tabSelector})));
   if(!Array.isArray(msg.items)||msg.items.length>300)throw new Error('Solicitud no válida.');
   const items=msg.items.map(i=>{
    const field=allowed.find(f=>f.selector===i.selector&&f.tabSelector===i.tabSelector);
    if(!field||typeof i.value!=='string'||i.value.length>10000)throw new Error('Campo no reconocido.');return {...field,value:i.value};
   });
   return await chrome.tabs.sendMessage(capture.tabId,{action:'fill',url:capture.url,items});
  }
  throw new Error('Acción no disponible.');
 })().then(reply).catch(e=>reply({error:e.message}));return true;
});
