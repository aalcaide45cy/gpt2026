window.addEventListener('message', async e=>{
 if(e.source!==window || e.origin!==location.origin || e.data?.source!=='ocrtrabajo-page' || !['getScan','fill'].includes(e.data.action))return;
 try{const result=await chrome.runtime.sendMessage({action:e.data.action,items:e.data.items});window.postMessage({source:'ocrtrabajo-extension',id:e.data.id,result},location.origin);}
 catch{window.postMessage({source:'ocrtrabajo-extension',id:e.data.id,result:{error:'Recarga la página tras instalar la extensión.'}},location.origin);}
});
