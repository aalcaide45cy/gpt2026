const siteAllowed = value => { try { const u = new URL(value); return u.origin === 'https://gpt2026.vercel.app' && /^\/ocrtrabajo\/?$/.test(u.pathname); } catch { return false; } };
const isIntranet = value => { try { return new URL(value).origin === 'https://intranet.autocarpe.com'; } catch { return false; } };
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    if (['scan', 'scanAll', 'scanVariants'].includes(msg.action)) {
      if (!sender.url?.startsWith(chrome.runtime.getURL('popup.html'))) throw Error('Usa el botón de la extensión para reconocer el expediente.');
      const tab = await chrome.tabs.get(msg.tabId);
      if (!isIntranet(tab.url)) throw Error('Abre Crear expediente en la intranet antes de reconocer los campos.');
      await chrome.storage.session.set({ scanState: { busy: true } });
      try {
        const scan = await chrome.tabs.sendMessage(tab.id, { action: msg.action });
        if (scan.error) throw Error(scan.error);
        if(scan.cancelled){await chrome.storage.session.set({scanState:{busy:false}});return scan;}
        const capture = { ...scan, tabId: tab.id };
        await chrome.storage.session.set({ capture, scanState: { busy: false } });
        return capture;
      } catch (e) { await chrome.storage.session.set({ scanState: { busy: false, error: e.message } }); throw e; }
    }
    if (!siteAllowed(sender.url)) throw Error('Origen no permitido.');
    const { capture } = await chrome.storage.session.get('capture');
    if (!capture || capture.version !== 3) throw Error('Actualiza la extensión y pulsa Reconocer expediente completo en la intranet.');
    if (msg.action === 'getScan') return capture;
    if (msg.action === 'fill') {
      const allowed = capture.sections.flatMap(s => s.fields.filter(f => f.selector && f.supported).map(f => ({ ...f, sectionId: s.id, tabTrail: s.tabTrail, tabSelector: s.tabSelector })));
      if (!Array.isArray(msg.items) || msg.items.length > 500) throw Error('Solicitud no válida.');
      const used = new Set(); let bytes = 0;
      const items = msg.items.map(i => {
        const field = allowed.find(f => f.selector === i.selector && f.sectionId === i.sectionId);
        const key = JSON.stringify([i.sectionId, i.selector]);
        if (!field || used.has(key)) throw Error('Campo no reconocido o duplicado.'); used.add(key);
        if (field.type === 'file') {
          if (!Array.isArray(i.files) || !i.files.length || i.files.length > 10) throw Error('Adjuntos no válidos.');
          const files = i.files.map(file => {
            if (typeof file.name !== 'string' || file.name.length > 250 || typeof file.type !== 'string' || typeof file.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) throw Error('Archivo no válido.');
            bytes += file.data.length; if (bytes > 28 * 1024 * 1024) throw Error('Adjunta como máximo 20 MB en cada operación.');
            return { name: file.name, type: file.type, data: file.data, lastModified: Number(file.lastModified) || 0 };
          });
          return { ...field, files };
        }
        if (typeof i.value !== 'string' || i.value.length > 10000) throw Error('Valor no válido.');
        if (field.options && !field.options.some(o => o.value === i.value && !o.disabled)) throw Error('La opción no pertenece al campo.');
        return { ...field, value: i.value };
      });
      const tab = await chrome.tabs.get(capture.tabId);
      if (!isIntranet(tab.url)) throw Error('La pestaña de la intranet ya no está abierta.');
      return await chrome.tabs.sendMessage(capture.tabId, { action: 'fill', url: capture.url, items, overwrite: msg.overwrite === true });
    }
    throw Error('Acción no disponible.');
  })().then(reply).catch(e => reply({ error: e.message }));
  return true;
});
