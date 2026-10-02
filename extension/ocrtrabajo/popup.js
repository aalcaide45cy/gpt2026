document.querySelector('#scan').onclick=async()=>{
 const status=document.querySelector('#status');status.textContent='Reconociendo…';
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const result=await chrome.runtime.sendMessage({action:'scan',tabId:tab.id});if(result.error)throw new Error(result.error);
  const fields=result.sections.flatMap(s=>s.fields.map(f=>({...f,section:s.section})));status.textContent=fields.length+' campos en '+result.sections.length+' secciones reconocidas.';
  const list=document.querySelector('#fields');list.replaceChildren();for(const f of fields){const li=document.createElement('li');li.textContent=f.section+' · '+f.label+(f.selector?'':' (sin identificador estable)');list.append(li);}
 }catch(e){status.textContent=e.message.includes('Receiving end')?'Recarga la intranet después de instalar la extensión.':e.message;}
};
