(() => {
  const VERSION = 2;
  const controls = 'input,select,textarea,[role="switch"],[role="checkbox"],[role="radio"],[role="combobox"],[contenteditable="true"]';
  const tabQuery = '[role="tab"],[data-toggle="tab"],[data-bs-toggle="tab"],.nav-tabs a[href],.nav-pills a[href]';
  const excluded = new Set(['hidden', 'password', 'submit', 'button', 'reset', 'image']);
  const clean = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 180);
  const canonical = () => location.origin + location.pathname + location.search;
  const unique = s => { try { const list = document.querySelectorAll(s); return list.length === 1 ? list[0] : null; } catch { return null; } };
  const visible = e => !!(e?.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let running = false;

  function locate(e) {
    if (!e || e === document.body) return e === document.body ? 'body' : null;
    if (e.id) { const s = '#' + CSS.escape(e.id); if (unique(s) === e) return s; }
    for (const attr of ['name', 'data-testid', 'aria-controls']) {
      const v = e.getAttribute(attr);
      if (v) { const s = e.tagName.toLowerCase() + '[' + attr + '=' + JSON.stringify(v) + ']'; if (unique(s) === e) return s; }
    }
    if (e.matches('input[type=radio]') && e.name) {
      const s = 'input[type="radio"][name=' + JSON.stringify(e.name) + '][value=' + JSON.stringify(e.value) + ']';
      if (unique(s) === e) return s;
    }
    const parts = []; let node = e;
    while (node && node !== document.documentElement) {
      if (node !== e && node.id && unique('#' + CSS.escape(node.id)) === node) { parts.unshift('#' + CSS.escape(node.id)); break; }
      const siblings = [...node.parentElement?.children || []].filter(x => x.tagName === node.tagName);
      parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')');
      node = node.parentElement;
    }
    const result = parts.join(' > '); return unique(result) === e ? result : null;
  }
  function labelled(e) {
    const refs = (e.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.textContent).join(' ');
    return clean([...e.labels || []].map(l => l.textContent).join(' ') || refs || e.getAttribute('aria-label') || (e.matches('[role]') ? e.textContent : '') || e.placeholder || e.name || e.id);
  }
  function groupLabel(e) {
    const fieldset = e.closest('fieldset,[role=radiogroup]');
    if (fieldset) {
      const title = fieldset.querySelector(':scope > legend')?.textContent || fieldset.getAttribute('aria-label') || (fieldset.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent).join(' ');
      if (clean(title)) return clean(title);
    }
    const group = e.closest('.form-group,.form-row,.mb-3,.row,[data-field]');
    if (group) {
      const label = [...group.querySelectorAll('label,.control-label,.col-form-label')].find(l => !l.contains(e) && !l.querySelector('input') && (!l.htmlFor || !document.getElementById(l.htmlFor)?.matches('input[type=radio],input[type=checkbox]')));
      if (label) return clean(label.textContent);
    }
    return clean(e.name || labelled(e));
  }
  function safeTab(e) {
    if (!e?.matches(tabQuery) || e.disabled || e.getAttribute('aria-disabled') === 'true') return false;
    if (e.tagName === 'BUTTON' && e.form && e.type === 'submit') return false;
    if (e.tagName === 'A' && e.getAttribute('href')) {
      const u = new URL(e.href, location.href);
      if (u.origin + u.pathname + u.search !== canonical() || !u.hash) return false;
    }
    return true;
  }
  function panelFor(e) {
    const aria = e.getAttribute('aria-controls');
    if (aria && document.getElementById(aria)) return document.getElementById(aria);
    const target = e.getAttribute('data-bs-target') || e.getAttribute('data-target') || (e.tagName === 'A' ? new URL(e.href, location.href).hash : '');
    return target?.startsWith('#') ? unique(target) : null;
  }
  function tabs() {
    return [...document.querySelectorAll(tabQuery)].filter(safeTab).map(e => ({ selector: locate(e), label: clean(e.textContent || e.getAttribute('aria-label')), panelSelector: locate(panelFor(e)) })).filter(t => t.selector);
  }
  function active(e) { return e?.getAttribute('aria-selected') === 'true' || e?.classList.contains('active') || e?.parentElement?.classList.contains('active'); }
  function trailFor(e, known) {
    return known.filter(t => { const panel = unique(t.panelSelector); return panel && panel.contains(e); }).sort((a, b) => unique(a.panelSelector).contains(unique(b.panelSelector)) ? -1 : 1).map(t => t.selector);
  }
  async function openTrail(trail) {
    for (const selector of trail || []) {
      const tab = unique(selector);
      if (!safeTab(tab)) throw Error('Pestaña no disponible; vuelve a reconocer el expediente.');
      if (!active(tab)) { tab.click(); await sleep(250); }
    }
  }
  async function settled() {
    // Allow lazy panels to render; stop even if a page has continuous animations.
    await sleep(150);
    await new Promise(resolve => {
      let quiet; const finish = () => { clearTimeout(quiet); clearTimeout(max); observer.disconnect(); resolve(); };
      const observer = new MutationObserver(() => { clearTimeout(quiet); quiet = setTimeout(finish, 180); });
      const max = setTimeout(finish, 1800); quiet = setTimeout(finish, 180);
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
  function contextFor(e, known) {
    const trail = trailFor(e, known);
    const names = trail.map(selector => known.find(t => t.selector === selector)?.label).filter(Boolean);
    return { id: trail.join('|') || 'general', section: names.join(' › ') || 'General', tabTrail: trail, tabSelector: trail.at(-1) || null };
  }
  function eligible(e) {
    return (!excluded.has(e.type) || (e.type === 'button' && e.matches('[role=switch],[role=checkbox],[role=radio],[role=combobox]'))) && !e.closest('[data-ocr-ignore]') && !(e.matches('[role]') && !e.matches('input,select,textarea') && e.querySelector('input,select,textarea'));
  }
  function shownInSection(e, known) {
    const panels = new Set(known.map(t => unique(t.panelSelector)).filter(Boolean));
    for (let node = e; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if ((style.display === 'none' || style.visibility === 'hidden' || node.hidden) && !panels.has(node)) {
        if (node === e && e.matches('input[type=file],input[type=radio],input[type=checkbox]')) continue;
        return false;
      }
    }
    return true;
  }
  function mergeSections(saved, sections, actions = []) {
    const path = actions.map(a => ({ selector: a.selector, sectionId: a.sectionId, value: a.value }));
    for (const section of sections) {
      if (!saved.has(section.id)) saved.set(section.id, { ...section, fields: [] });
      const target = saved.get(section.id);
      for (const field of section.fields) {
        const at = target.fields.findIndex(x => x.selector === field.selector);
        const old = at < 0 ? null : target.fields[at];
        let paths = old?.paths || [];
        if (field.branchVisible) {
          const contains = (a,b) => b.every(step => a.some(other => other.selector === step.selector && other.sectionId === step.sectionId && other.value === step.value));
          if (!paths.some(p => contains(path,p))) paths = [...paths.filter(p => !contains(p,path)),path];
        }
        const options = old?.options && field.options ? [...new Map([...old.options,...field.options].map(o => [JSON.stringify([o.value,o.selector]),o])).values()] : field.options;
        const next = { ...field, paths, options, disabled: old ? old.disabled && field.disabled : field.disabled };
        if (at < 0) target.fields.push(next); else target.fields[at] = next;
      }
    }
  }
  function snapshot(known) {
    const sections = new Map(); const seen = new Set();
    for (const e of document.querySelectorAll(controls)) {
      if (!eligible(e)) continue;
      const context = contextFor(e, known);
      const role = e.getAttribute('role');
      const type = e.type === 'radio' || role === 'radio' ? 'radio' : e.type === 'checkbox' || ['switch', 'checkbox'].includes(role) ? 'checkbox' : e.type === 'file' ? 'file' : e.matches('input,select,textarea') ? e.type : role || 'contenteditable';
      let members = [e];
      if (type === 'radio') {
        members = [...document.querySelectorAll('input[type=radio],[role=radio]')].filter(other => {
          if (e.type === 'radio') return other.type === 'radio' && !!e.name && e.name === other.name && e.form === other.form && contextFor(other, known).id === context.id;
          return e.closest('[role=radiogroup]') && e.closest('[role=radiogroup]') === other.closest('[role=radiogroup]');
        });
        if (!members.length) members = [e];
      }
      const selector = locate(members[0]); const key = context.id + '|' + selector;
      if (seen.has(key)) continue; seen.add(key);
      const options = type === 'radio' ? members.map((r, i) => ({ label: labelled(r), value: r.type === 'radio' ? r.value : r.getAttribute('data-value') || String(i), selector: locate(r), disabled: r.disabled || r.getAttribute('aria-disabled') === 'true' })) : type === 'checkbox' ? [{ label: 'Sí / activado', value: 'true' }, { label: 'No / desactivado', value: 'false' }] : e.tagName === 'SELECT' ? [...e.options].map(o => ({ label: clean(o.textContent), value: o.value, disabled: o.disabled })) : null;
      const supported = !!selector && !['combobox', 'contenteditable', 'select-multiple'].includes(type) && !e.readOnly;
      const field = { selector, label: type === 'radio' ? groupLabel(e) : labelled(e), type, options, required: members.some(x => x.required || x.getAttribute('aria-required') === 'true'), supported, disabled: members.every(x => x.disabled || x.getAttribute('aria-disabled') === 'true'), readonly: !!e.readOnly, visible: members.some(visible), branchVisible: members.some(x => shownInSection(x, known)), paths: [], accept: type === 'file' ? e.accept : undefined, multiple: type === 'file' ? e.multiple : undefined };
      if (!field.label) field.label = type === 'file' ? clean(e.closest('section,.form-group')?.querySelector('h2,h3,h4,label')?.textContent) || 'Adjunto' : 'Campo sin etiqueta';
      if (!sections.has(context.id)) sections.set(context.id, { ...context, fields: [] });
      sections.get(context.id).fields.push(field);
    }
    return [...sections.values()];
  }
  async function scan(all) {
    const start = canonical(); const warnings = []; const saved = new Map();
    const scroll = { x: scrollX, y: scrollY }; const originalHash = location.hash;
    const original = tabs().filter(t => active(unique(t.selector))).map(t => t.selector);
    const merge = () => mergeSections(saved, snapshot(tabs()));
    merge(); const visited = new Set();
    try {
      if (all) for (let n = 0; n < 60; n++) {
        const known = tabs(); const next = known.find(t => !visited.has(t.selector)); if (!next) break;
        visited.add(next.selector);
        await openTrail([...trailFor(unique(next.selector), known), next.selector]); await settled();
        if (canonical() !== start) throw Error('La pantalla ha cambiado de dirección; vuelve al expediente antes de reconocerlo.');
        merge();
      }
      if (tabs().some(t => !visited.has(t.selector)) && all) warnings.push('Hay pestañas que no se han recorrido: se ha alcanzado el límite de 60.');
      const unsafe = [...document.querySelectorAll(tabQuery)].filter(t => !safeTab(t));
      if (unsafe.length) warnings.push(unsafe.length + ' pestañas cambian de página, están desactivadas o no pueden abrirse automáticamente.');
      if (document.querySelector('iframe')) warnings.push('Los campos dentro de marcos incrustados necesitan adaptación.');
      warnings.push('Los campos que la intranet crea solo después de elegir una respuesta se detectarán cuando existan. No se cambian respuestas durante el reconocimiento.');
      return { version: VERSION, url: start, title: document.title, sections: [...saved.values()], warnings, tabsVisited: visited.size };
    } finally {
      if (canonical() === start) { try { await openTrail(original); if (location.hash !== originalHash) history.replaceState(history.state, '', start + originalHash); window.scrollTo(scroll.x, scroll.y); } catch {} }
    }
  }
  function editable(e, file = false) { return e && !e.disabled && !e.readOnly && e.getAttribute('aria-disabled') !== 'true' && eligible(e) && (file || visible(e) || visible(e.closest('label')) || [...e.labels || []].some(visible) || visible(e.closest('[role=radiogroup],.form-check,.custom-control,.radio,.checkbox'))); }
  function fire(e) { e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
  function verifyType(e, field) {
    if (field.type === 'radio') return e.matches('input[type=radio],[role=radio]');
    if (field.type === 'checkbox') return e.matches('input[type=checkbox],[role=checkbox],[role=switch]');
    return e.matches('input,select,textarea') && e.type === field.type;
  }
  async function apply(item, overwrite) {
    await openTrail(item.tabTrail || (item.tabSelector ? [item.tabSelector] : []));
    let e = unique(item.selector);
    for (let i = 0; i < 8 && !editable(e, item.type === 'file'); i++) { await sleep(150); e = unique(item.selector); }
    if (!editable(e, item.type === 'file') || !verifyType(e, item)) return 'Campo no disponible o cambió de tipo.';
    if (item.type === 'file') {
      if (e.files.length && !overwrite) return 'Ya contiene un archivo; activa reemplazar si corresponde.';
      if (!e.multiple && item.files.length > 1) return 'Este campo solo admite un archivo. Une las páginas en un PDF.';
      const transfer = new DataTransfer();
      for (const file of item.files) {
        if (e.accept) { const accepted = e.accept.split(',').map(x => x.trim().toLowerCase()).some(ext => ext.startsWith('.') ? file.name.toLowerCase().endsWith(ext) : ext.endsWith('/*') ? file.type.startsWith(ext.slice(0, -1)) : ext === file.type); if (!accepted) return 'El tipo de archivo no está admitido.'; }
        const raw = atob(file.data); const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
        transfer.items.add(new File([bytes], file.name, { type: file.type, lastModified: file.lastModified }));
      }
      e.files = transfer.files; fire(e); return null;
    }
    if (item.type === 'radio') {
      const option = item.options.find(o => o.value === item.value && !o.disabled);
      const target = option && unique(option.selector); if (!editable(target) || !verifyType(target, item)) return 'Opción no disponible.';
      const isChecked = el => el.checked === true || el.getAttribute('aria-checked') === 'true';
      const existing = item.options.map(o => unique(o.selector)).find(el => el && isChecked(el));
      if (existing && existing !== target && !overwrite) return 'Ya tiene una opción seleccionada; activa reemplazar si corresponde.';
      if (!isChecked(target)) target.click(); await sleep(120);
      return isChecked(target) ? null : 'La intranet no confirmó la selección.';
    }
    if (item.type === 'checkbox') {
      const desired = item.value === 'true'; const current = e.checked === true || e.getAttribute('aria-checked') === 'true';
      if (current !== desired && current && !overwrite) return 'Ya está activado; activa reemplazar si corresponde.';
      if (current !== desired) e.click(); await sleep(100);
      return (e.checked === true || e.getAttribute('aria-checked') === 'true') === desired ? null : 'La intranet no confirmó el conmutador.';
    }
    if (e.value && e.value !== item.value && !overwrite) return 'Ya contiene un valor; activa reemplazar si corresponde.';
    if (e.tagName === 'SELECT' && ![...e.options].some(o => o.value === item.value && !o.disabled)) return 'Opción no disponible en el desplegable.';
    const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, item.value); fire(e); await sleep(80);
    const current = unique(item.selector);
    return current?.value === item.value && current.validity?.valid !== false ? null : 'Comprueba el formato: la intranet no aceptó el valor.';
  }
  async function fill(msg) {
    if (canonical() !== msg.url) throw Error('La dirección ha cambiado. Vuelve a reconocer este expediente.');
    const attachments = msg.items.filter(i => i.type === 'file').length;
    if (!confirm('OCR Trabajo rellenará ' + msg.items.length + ' campos' + (attachments ? ' y entregará los adjuntos seleccionados a la intranet' : '') + '. ' + (msg.overwrite ? 'Reemplazará los valores de los campos seleccionados. ' : '') + 'Revisa el expediente antes de guardarlo. ¿Continuar?')) return { cancelled: true };
    const original = tabs().filter(t => active(unique(t.selector))).map(t => t.selector);
    const errors = []; let count = 0;
    // Controls that reveal dependent fields are processed first. Retry unavailable fields once.
    const pending = [...msg.items].sort((a, b) => Number(['radio', 'checkbox', 'select-one'].includes(b.type)) - Number(['radio', 'checkbox', 'select-one'].includes(a.type)));
    const retry = [];
    for (const item of pending) {
      if (canonical() !== msg.url) { errors.push('El expediente ha cambiado de dirección; se detuvo el rellenado.'); break; }
      try { const error = await apply(item, msg.overwrite); if (error) retry.push({ item, error }); else count++; } catch (e) { retry.push({ item, error: e.message }); }
    }
    for (const { item, error } of retry) {
      if (canonical() !== msg.url) { errors.push(item.label + ': ' + error); continue; }
      try { const again = await apply(item, msg.overwrite); if (again) errors.push(item.label + ': ' + again); else count++; } catch (e) { errors.push(item.label + ': ' + e.message); }
    }
    if (canonical() === msg.url) { try { await openTrail(original); } catch {} }
    return { count, errors };
  }
  function saveFormState() {
    return [...document.querySelectorAll('input,select,textarea,[role=switch],[role=checkbox],[role=radio]')].filter(e => eligible(e) && !e.disabled && !e.readOnly).map(e => ({
      selector: locate(e), type: e.type || e.getAttribute('role'), value: e.value, checked: e.checked, ariaChecked: e.getAttribute('aria-checked'), files: e.type === 'file' ? e.files : null
    }));
  }
  async function restoreFormState(state) {
    // Restore choices before dependent text fields. No original values leave this content script.
    const ordered = [...state].sort((a,b) => Number(['radio','checkbox','select-one','switch'].includes(b.type)) - Number(['radio','checkbox','select-one','switch'].includes(a.type)));
    for (let pass = 0; pass < 2; pass++) for (const item of ordered) {
      const e = unique(item.selector); if (!e || e.disabled || e.readOnly) continue;
      if (['radio','checkbox'].includes(e.type)) {
        if (e.checked !== item.checked) { if (item.checked) e.click(); else { e.checked = false; fire(e); } }
      } else if (e.matches('[role=switch],[role=checkbox],[role=radio]') && item.ariaChecked !== null) {
        if (e.getAttribute('aria-checked') !== item.ariaChecked) e.click();
      } else if (e.type === 'file') { if (item.files && e.files !== item.files) e.files = item.files; }
      else if (e.value !== item.value && item.value !== undefined) {
        const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto,'value')?.set.call(e,item.value);fire(e);
      }
    }
    await settled();
  }
  async function exploreVariants() {
    if (!confirm('Explorar variantes cambia temporalmente desplegables y opciones. Hazlo en un expediente vacío o de prueba: la intranet podría guardar cambios al seleccionar. Se intentará restaurar el estado inicial y no se pulsará Guardar ni Anular. ¿Explorar?')) return { cancelled: true };
    const start=canonical(),original=saveFormState(),originalTabs=tabs().filter(t=>active(unique(t.selector))).map(t=>t.selector);
    const base=await scan(true),saved=new Map(base.sections.map(s=>[s.id,s]));
    const warnings=[...base.warnings];let explored=0,limited=false;const started=Date.now();
    const seen=new Set(),queue=[];
    const choices=()=>[...saved.values()].flatMap(s=>s.fields.filter(f=>f.supported&&f.branchVisible&&!f.disabled&&['radio','checkbox','select-one'].includes(f.type)).map(f=>({...f,sectionId:s.id,tabTrail:s.tabTrail})));
    const enqueue=(actions,priority=false)=>{
      const key=JSON.stringify(actions.map(a=>[a.sectionId,a.selector,a.value]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
      if(seen.has(key))return;seen.add(key);if(queue.length<3000){if(priority)queue.unshift(actions);else queue.push(actions);}else limited=true;
    };
    const variants=field=>{const options=(field.options||[]).filter(o=>!o.disabled&&o.value!=='');if(options.length>25)limited=true;return options.slice(0,25).map(o=>({...field,value:o.value}));};
    for(const field of choices())for(const action of variants(field))enqueue([action]);
    try {
      while(queue.length&&explored<120&&Date.now()-started<75000){
        const actions=queue.shift();await restoreFormState(original);let usable=true;
        for(const action of actions){
          if(canonical()!==start)throw Error('Cambió la dirección del expediente durante la exploración.');
          const error=await apply(action,true);if(error){usable=false;break;}await settled();
        }
        explored++;if(!usable)continue;
        const previous=new Set(choices().map(f=>f.selector));
        // Visit panels after each choice so lazy conditional controls can be discovered.
        for(const tab of tabs()) {await openTrail([...trailFor(unique(tab.selector),tabs()),tab.selector]);await sleep(80);mergeSections(saved,snapshot(tabs()),actions);}
        mergeSections(saved,snapshot(tabs()),actions);
        const restoredSelectors=new Set(original.map(x=>x.selector));
        for(const item of saveFormState())if(!restoredSelectors.has(item.selector))original.push(item);
        if(actions.length<3)for(const field of choices()){
          if(actions.some(a=>a.selector===field.selector))continue;
          if(actions.length===1||!previous.has(field.selector))for(const action of variants(field))enqueue([...actions,action],!previous.has(field.selector));
        }
      }
      if(queue.length)limited=true;
      const sections=[...saved.values()];
      const unresolved=sections.flatMap(s=>s.fields).filter(f=>!f.paths.length&&!f.readonly).length;
      warnings.push('Exploradas '+explored+' combinaciones de opciones. '+(limited?'Se alcanzó un límite de tiempo, opciones o combinaciones; no es un inventario exhaustivo.':'Se recorrieron las variantes previstas por este reconocimiento; otras dependencias pueden requerir adaptación.'));
      if(unresolved)warnings.push(unresolved+' campos se detectaron ocultos pero no se pudo determinar qué opción los muestra.');
      return {...base,sections,warnings,exploration:{explored,limited,unresolved}};
    } finally {
      if(canonical()===start){await restoreFormState(original);try{await openTrail(originalTabs);}catch{}
        const mismatch=original.filter(item=>{const e=unique(item.selector);if(!e)return false;if(['radio','checkbox'].includes(e.type))return e.checked!==item.checked;if(e.type==='file')return false;return item.value!==undefined&&e.value!==item.value;});
        if(mismatch.length)warnings.push('No se pudieron restaurar '+mismatch.length+' controles. Revisa el expediente o recarga antes de continuar.');
      }
    }
  }
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (!['scan', 'scanAll', 'scanVariants', 'fill'].includes(msg.action)) return;
    if (running) { reply({ error: 'Ya hay una operación en marcha en este expediente.' }); return; }
    running = true;
    (msg.action === 'fill' ? fill(msg) : msg.action === 'scanVariants' ? exploreVariants() : scan(msg.action === 'scanAll')).then(reply).catch(e => reply({ error: e.message })).finally(() => { running = false; });
    return true;
  });
})();
