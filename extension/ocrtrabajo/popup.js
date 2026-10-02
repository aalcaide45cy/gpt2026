const status = document.querySelector('#status');
function show(capture) {
  if (!capture?.sections) return;
  const fields = capture.sections.flatMap(s => s.fields);
  status.textContent = fields.length + ' campos en ' + capture.sections.length + ' secciones. ' + (capture.tabsVisited || 0) + ' pestañas recorridas.';
  const list = document.querySelector('#fields'); list.replaceChildren();
  for (const section of capture.sections) { const li = document.createElement('li'); li.textContent = section.section + ': ' + section.fields.length + ' campos'; list.append(li); }
}
async function scan(action) {
  status.textContent = 'Reconociendo pestañas y campos… Puedes cerrar este panel; la captura quedará disponible al terminar.';
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const result = await chrome.runtime.sendMessage({ action, tabId: tab.id });
    if (result.error) throw Error(result.error); if(result.cancelled){status.textContent='Exploración cancelada.';return;}show(result);
  } catch (e) { status.textContent = e.message.includes('Receiving end') ? 'Recarga la intranet después de actualizar la extensión.' : e.message; }
  finally { document.querySelectorAll('button').forEach(b => b.disabled = false); }
}
document.querySelector('#scan').onclick = () => scan('scanAll');
document.querySelector('#scan-current').onclick = () => scan('scan');
chrome.storage.session.get(['capture', 'scanState']).then(({ capture, scanState }) => {
  show(capture);
  if (scanState?.busy) status.textContent = 'El reconocimiento sigue en marcha. Vuelve a abrir este panel dentro de unos segundos.';
  else if (scanState?.error) status.textContent = scanState.error;
});

document.querySelector('#explore').onclick = () => scan('scanVariants');
