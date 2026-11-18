(function () {
  const { esc, toast, applyTheme } = ui;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $('#view');
  let S = null; // settings

  const SECTIONS = {
    dashboard: { label: 'Panel', ic: '◈' },
    pos: { label: 'Punto de venta', ic: '⌁' },
    products: { label: 'Productos', ic: '❖' },
    inventory: { label: 'Inventario', ic: '▤' },
    loyalty: { label: 'Tarjetas de lealtad', ic: '♦' },
    sales: { label: 'Ventas', ic: '$' },
    appearance: { label: 'Apariencia', ic: '✦' },
    users: { label: 'Usuarios', ic: '☺' },
    settings: { label: 'Configuración', ic: '⚙' },
  };

  // ---------- Modal genérico ----------
  function modal({ title, body, actions = [], wide = false, onMount, locked = false }) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${wide ? 'wide' : ''}"><h2>${title}</h2><div class="m-body" style="margin-top:14px">${body}</div><div class="modal-actions"></div></div>`;
    const act = $('.modal-actions', back);
    const api_ = { el: back, close() { back.classList.remove('open'); setTimeout(() => back.remove(), 300); } };
    for (const a of actions) {
      const b = document.createElement('button');
      b.className = 'btn ' + (a.cls || ''); b.textContent = a.label; b.type = 'button';
      b.onclick = async () => {
        if (!a.onClick) return api_.close();
        b.disabled = true;
        try { const r = await a.onClick(api_); if (r !== false) api_.close(); }
        catch (e) { toast(e.message, 'err'); }
        finally { b.disabled = false; }
      };
      act.appendChild(b);
    }
    if (!locked) back.addEventListener('mousedown', e => { if (e.target === back) api_.close(); });
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('open'));
    onMount && onMount(back, api_);
    return api_;
  }
  const confirmBox = (title, text, label = 'Confirmar', cls = 'danger') => new Promise(res => {
    modal({ title, body: `<p class="muted">${text}</p>`, actions: [{ label: 'Cancelar', onClick: () => res(false) }, { label, cls, onClick: () => res(true) }] });
  });
  const formData = root => {
    const o = {};
    for (const el of $$('[name]', root)) {
      const k = el.name;
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.num !== undefined) v = Number(v || 0);
      if (k.includes('.')) { const [a, b] = k.split('.'); (o[a] = o[a] || {})[b] = v; } else o[k] = v;
    }
    return o;
  };
  const thumb = p => `<div class="thumb">${ui.media(p)}</div>`;

  // ---------- Arranque ----------
  async function boot() {
    if (!api.token) return showLogin();
    try {
      await api.me();
      S = await api.get('/settings');
      applyTheme(S);
      showShell();
    } catch { showLogin(); }
  }
  function showLogin() {
    $('#shell').classList.add('hidden');
    $('#login').classList.remove('hidden');
  }
  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = formData(e.target);
    $('#loginErr').classList.add('hidden');
    try {
      await api.login(f.username, f.password);
      const next = new URLSearchParams(location.search).get('next');
      if (next && /^\/(?![/\\])/.test(next)) { location.href = next; return; }
      e.target.reset();
      boot();
    } catch (err) { $('#loginErr').textContent = err.message; $('#loginErr').classList.remove('hidden'); }
  });
  window.addEventListener('parra:logout', showLogin);
  $('#logout').onclick = async () => { await api.logout(); location.hash = ''; showLogin(); };
  $('#menuBtn').onclick = () => $('#side').classList.toggle('open');

  function showShell() {
    $('#login').classList.add('hidden');
    $('#shell').classList.remove('hidden');
    const u = api.user;
    $('#who').textContent = `${u.name} · ${u.role === 'admin' ? 'Administrador' : 'Personal'}`;
    if (S.logo) $('.side-logo img').src = S.logo;
    $('#nav').innerHTML = Object.entries(SECTIONS).filter(([k]) => api.can(k))
      .map(([k, v]) => `<a href="${k === 'pos' ? '/pos' : '#/' + k}" data-sec="${k}"><span class="ic">${v.ic}</span>${v.label}</a>`).join('');
    if (u.mustChangePassword) { view.innerHTML = '<div class="card">Cambia la contraseña inicial para continuar.</div>'; forcePassword(); }
    else route();
  }
  window.addEventListener('hashchange', route);

  // La contraseña inicial (admin123) debe cambiarse en el primer acceso
  function forcePassword() {
    modal({
      title: 'Cambia tu contraseña',
      body: `<p class="muted" style="margin-top:0">Estás usando la contraseña inicial. Crea una nueva para proteger tu tienda.</p>
        <form class="form-grid" id="fp" onsubmit="return false">
          <label class="field full"><span>Contraseña actual</span><input class="input" type="password" name="current" autocomplete="current-password"></label>
          <label class="field"><span>Nueva contraseña (mín. 6)</span><input class="input" type="password" name="next" autocomplete="new-password"></label>
          <label class="field"><span>Repite la nueva</span><input class="input" type="password" name="again" autocomplete="new-password"></label>
        </form>`,
      locked: true,
      actions: [{ label: 'Salir', onClick: async () => { await api.logout(); showLogin(); } }, { label: 'Guardar contraseña', cls: 'primary', onClick: async m => {
        const d = formData($('#fp', m.el));
        if (d.next !== d.again) throw new Error('Las contraseñas no coinciden');
        await api.post('/me/password', { current: d.current, next: d.next });
        await api.me(); toast('Contraseña actualizada'); route();
      } }],
    });
  }

  function route() {
    if ($('#shell').classList.contains('hidden')) return;
    const allowed = Object.keys(SECTIONS).filter(k => k !== 'pos' && api.can(k));
    let sec = (location.hash.match(/^#\/(\w+)/) || [])[1];
    if (!allowed.includes(sec)) {
      if (!allowed.length && api.can('pos')) { location.href = '/pos'; return; }
      sec = allowed[0];
      if (!sec) { view.innerHTML = '<div class="card">Tu usuario no tiene secciones asignadas. Pide acceso a un administrador.</div>'; return; }
    }
    $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.sec === sec));
    $('#side').classList.remove('open');
    $('#title').textContent = SECTIONS[sec].label;
    view.innerHTML = '<p class="muted">Cargando…</p>';
    Views[sec]().catch(e => { view.innerHTML = `<div class="card">Error: ${esc(e.message)}</div>`; });
  }

  // =====================================================================
  const Views = {};

  // ---------- Panel ----------
  Views.dashboard = async () => {
    const [sales, products] = await Promise.all([api.get('/sales'), api.get('/products')]);
    const ok = sales.filter(s => s.status !== 'cancelada');
    const today = new Date().toDateString();
    const now = new Date();
    const tSales = ok.filter(s => new Date(s.date).toDateString() === today);
    const mSales = ok.filter(s => { const d = new Date(s.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const sum = a => a.reduce((x, s) => x + s.total, 0);
    const low = products.filter(p => p.active && p.stock <= (p.minStock || 0));
    const invValue = products.reduce((a, p) => a + (p.cost || 0) * p.stock, 0);
    const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return d; });
    const perDay = days.map(d => sum(ok.filter(s => new Date(s.date).toDateString() === d.toDateString())));
    const max = Math.max(1, ...perDay);
    const top = {};
    for (const s of mSales) for (const it of s.items) { top[it.name] = top[it.name] || { q: 0, t: 0 }; top[it.name].q += it.qty; top[it.name].t += it.total; }
    const topList = Object.entries(top).sort((a, b) => b[1].q - a[1].q).slice(0, 6);

    view.innerHTML = `
      <div class="kpis">
        <div class="card kpi"><div class="label">Ventas de hoy</div><div class="value num">${fmt.money(sum(tSales))}</div><div class="sub">${tSales.length} tickets</div></div>
        <div class="card kpi"><div class="label">Ventas del mes</div><div class="value num">${fmt.money(sum(mSales))}</div><div class="sub">${mSales.length} tickets · prom. ${fmt.money(mSales.length ? sum(mSales) / mSales.length : 0)}</div></div>
        <div class="card kpi"><div class="label">Productos</div><div class="value num">${products.filter(p => p.active).length}</div><div class="sub">${products.reduce((a, p) => a + p.stock, 0)} piezas en existencia</div></div>
        <div class="card kpi"><div class="label">Stock bajo</div><div class="value num ${low.length ? 'gold' : ''}">${low.length}</div><div class="sub">Valor inventario (costo) ${fmt.money(invValue)}</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>Últimos 14 días</h3>
          <div class="bars">${perDay.map((v, i) => `<div class="b" title="${fmt.money(v)}"><i style="height:${(v / max) * 100}%"></i><span>${days[i].getDate()}</span></div>`).join('')}</div>
        </div>
        <div class="card"><h3>Más vendidos del mes</h3>
          ${topList.length ? `<table class="t">${topList.map(([n, v]) => `<tr><td>${esc(n)}</td><td class="r num">${v.q} pzas</td><td class="r num">${fmt.money(v.t)}</td></tr>`).join('')}</table>` : '<p class="muted">Aún no hay ventas este mes.</p>'}
        </div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>Ventas recientes</h3>
          ${ok.length ? `<table class="t">${ok.slice(0, 8).map(s => `<tr><td>#${s.folio}</td><td class="muted small">${fmt.date(s.date)}</td><td>${esc(s.userName)}</td><td class="r num">${fmt.money(s.total)}</td></tr>`).join('')}</table>` : '<p class="muted">Sin ventas registradas.</p>'}
        </div>
        <div class="card"><h3>Reabastecer</h3>
          ${low.length ? `<table class="t">${low.map(p => `<tr><td>${esc(p.name)}</td><td class="r"><span class="badge ${p.stock ? 'warn' : 'bad'}">${p.stock} / mín ${p.minStock}</span></td></tr>`).join('')}</table>` : '<p class="muted">Todo el inventario está en orden.</p>'}
        </div>
      </div>`;
  };

  // ---------- Productos ----------
  Views.products = async () => {
    let products = await api.get('/products');
    view.innerHTML = `
      <div class="toolbar">
        <input class="input" id="pq" type="search" placeholder="Buscar por nombre, marca o código…">
        <select class="input" id="pf"><option value="">Todos</option><option value="active">Visibles</option><option value="hidden">Ocultos</option><option value="featured">Destacados</option></select>
        <button class="btn" id="pScan">⌁ Escanear</button>
        <button class="btn primary" id="pNew">+ Nuevo perfume</button>
      </div>
      <div class="table-wrap"><table class="t"><thead><tr><th></th><th>Perfume</th><th>Código</th><th class="r">Precio</th><th class="r">Stock</th><th>Catálogo</th><th></th></tr></thead><tbody id="pt"></tbody></table></div>`;
    const draw = () => {
      const q = $('#pq').value.toLowerCase(), f = $('#pf').value;
      const list = products.filter(p => (!q || [p.name, p.brand, p.barcode, p.sku].join(' ').toLowerCase().includes(q))
        && (!f || (f === 'active' && p.active) || (f === 'hidden' && !p.active) || (f === 'featured' && p.featured)));
      $('#pt').innerHTML = list.map(p => `<tr>
        <td>${thumb(p)}</td>
        <td class="pname">${esc(p.name)}<small>${esc([p.brand, p.category, p.ml ? p.ml + ' ml' : ''].filter(Boolean).join(' · '))}</small></td>
        <td class="num small">${esc(p.barcode)}</td>
        <td class="r num">${p.offerPrice > 0 ? `<s class="muted small">${fmt.money(p.price)}</s><br>${fmt.money(p.offerPrice)}` : fmt.money(p.price)}</td>
        <td class="r"><span class="badge ${p.stock <= 0 ? 'bad' : p.stock <= p.minStock ? 'warn' : 'ok'}">${p.stock}</span></td>
        <td><label class="check"><input type="checkbox" data-vis="${p.id}" ${p.active ? 'checked' : ''}> ${p.featured ? '<span class="badge">★</span>' : ''}</label></td>
        <td class="actions">
          <button class="btn sm" data-label="${p.id}" title="Imprimir etiqueta">Etiqueta</button>
          <button class="btn sm" data-edit="${p.id}">Editar</button>
          <button class="btn sm danger" data-del="${p.id}" title="Quitar perfume">✕</button>
        </td></tr>`).join('') || '<tr><td colspan="7" class="empty-row">No hay perfumes. Agrega el primero.</td></tr>';
    };
    draw();
    $('#pq').oninput = draw; $('#pf').onchange = draw;
    $('#pNew').onclick = () => productForm(null, async () => { products = await api.get('/products'); draw(); });
    $('#pScan').onclick = async () => {
      const code = await scanOnce('Buscar producto');
      if (!code) return;
      const p = products.find(x => x.barcode === code || x.sku === code);
      if (p) productForm(p, async () => { products = await api.get('/products'); draw(); });
      else if (await confirmBox('Código nuevo', `No existe un producto con el código <b>${esc(code)}</b>. ¿Deseas crearlo?`, 'Crear producto', 'primary'))
        productForm({ barcode: code }, async () => { products = await api.get('/products'); draw(); });
    };
    $('#pt').onclick = async e => {
      const t = e.target.closest('button'); if (!t) return;
      const p = products.find(x => x.id === (t.dataset.edit || t.dataset.del || t.dataset.label));
      if (t.dataset.edit) productForm(p, async () => { products = await api.get('/products'); draw(); });
      if (t.dataset.label) printLabel(p);
      if (t.dataset.del && await confirmBox('Quitar perfume', `¿Eliminar <b>${esc(p.name)}</b> del sistema? Si solo quieres ocultarlo del catálogo, desmarca la casilla “Catálogo”.`, 'Eliminar')) {
        await api.del('/products/' + p.id); toast('Perfume eliminado'); products = products.filter(x => x.id !== p.id); draw();
      }
    };
    $('#pt').onchange = async e => {
      const id = e.target.dataset.vis; if (!id) return;
      try { const r = await api.put('/products/' + id, { active: e.target.checked }); Object.assign(products.find(x => x.id === id), r); toast(r.active ? 'Visible en catálogo' : 'Oculto del catálogo'); }
      catch (err) { toast(err.message, 'err'); e.target.checked = !e.target.checked; }
    };
  };

  function productForm(p, onSaved) {
    const isNew = !p || !p.id;
    p = p || {};
    const n = p.notes || {};
    let image = p.image || '';
    const cats = ['Dama', 'Caballero', 'Unisex', 'Niños', 'Sets', 'Body mist'];
    modal({
      title: isNew ? 'Nuevo perfume' : 'Editar perfume', wide: true,
      body: `<form class="form-grid" id="pform" onsubmit="return false">
        <div class="full img-drop">
          <div class="img-prev" id="imgPrev">${ui.media({ image, name: p.name }, { lazy: false })}</div>
          <div class="field"><span>Foto del perfume</span>
            <input type="file" accept="image/*" id="imgFile" class="input">
            <small class="muted">Foto JPG/WEBP: llena la vitrina. PNG sin fondo: el frasco se ve flotando en la repisa.</small>
            <input class="input small" name="imageCredit" value="${esc(p.imageCredit)}" placeholder="Crédito de la foto (opcional)">
            ${image ? '<button type="button" class="btn sm" id="imgClear" style="align-self:flex-start">Quitar foto</button>' : ''}
          </div>
        </div>
        <label class="field"><span>Nombre *</span><input class="input" name="name" value="${esc(p.name)}" required></label>
        <label class="field"><span>Marca</span><input class="input" name="brand" value="${esc(p.brand)}" list="brandList"></label>
        <label class="field"><span>Categoría</span><input class="input" name="category" value="${esc(p.category || 'Unisex')}" list="catList"></label>
        <label class="field"><span>Familia olfativa</span><input class="input" name="family" value="${esc(p.family)}" placeholder="Oriental, floral, amaderada…"></label>
        <label class="field"><span>Código de barras</span><div class="input-group"><input class="input" name="barcode" value="${esc(p.barcode)}" placeholder="Vacío = se genera"><button type="button" class="btn" id="bScan" title="Escanear con cámara">⌁</button></div></label>
        <label class="field"><span>SKU</span><input class="input" name="sku" value="${esc(p.sku)}"></label>
        <label class="field"><span>Precio</span><input class="input" name="price" data-num type="number" step="0.01" min="0" value="${p.price ?? ''}"></label>
        <label class="field"><span>Precio de oferta (opcional)</span><input class="input" name="offerPrice" data-num type="number" step="0.01" min="0" value="${p.offerPrice || ''}"></label>
        <label class="field"><span>Costo</span><input class="input" name="cost" data-num type="number" step="0.01" min="0" value="${p.cost ?? ''}"></label>
        <label class="field"><span>Contenido (ml)</span><input class="input" name="ml" data-num type="number" min="0" value="${p.ml ?? ''}"></label>
        ${isNew ? `<label class="field"><span>Existencia inicial</span><input class="input" name="stock" data-num type="number" min="0" value="0"></label>` : `<div class="field"><span>Existencia</span><div class="input" style="opacity:.7">${p.stock} pzas · se ajusta en Inventario</div></div>`}
        <label class="field"><span>Stock mínimo (alerta)</span><input class="input" name="minStock" data-num type="number" min="0" value="${p.minStock ?? 3}"></label>
        <label class="field"><span>Notas de salida</span><input class="input" name="notes.top" value="${esc(n.top)}"></label>
        <label class="field"><span>Notas de corazón</span><input class="input" name="notes.heart" value="${esc(n.heart)}"></label>
        <label class="field full"><span>Notas de fondo</span><input class="input" name="notes.base" value="${esc(n.base)}"></label>
        <label class="field full"><span>Descripción</span><textarea class="input" name="description">${esc(p.description)}</textarea></label>
        <div class="full toolbar">
          <label class="check"><input type="checkbox" name="active" ${p.active !== false ? 'checked' : ''}> Visible en catálogo</label>
          <label class="check"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}> Destacado</label>
        </div>
        <datalist id="catList">${cats.map(c => `<option>${c}</option>`).join('')}</datalist>
        <datalist id="brandList"></datalist>
      </form>`,
      onMount: el => {
        api.get('/products').then(ps => { $('#brandList', el).innerHTML = [...new Set(ps.map(x => x.brand).filter(Boolean))].map(b => `<option>${esc(b)}</option>`).join(''); }).catch(() => {});
        $('#imgFile', el).onchange = async e => {
          const f = e.target.files[0]; if (!f) return;
          $('#imgPrev', el).innerHTML = '<span class="muted small">Subiendo…</span>';
          try { image = await api.uploadImage(f, 1000); $('#imgPrev', el).innerHTML = ui.media({ image, name: p.name }, { lazy: false }); $('[name=imageCredit]', el).value = ''; }
          catch (err) { toast(err.message, 'err'); $('#imgPrev', el).innerHTML = ui.media({ image, name: p.name }, { lazy: false }); }
        };
        const clr = $('#imgClear', el); if (clr) clr.onclick = () => { image = ''; $('#imgPrev', el).innerHTML = ui.media(null); };
        $('#bScan', el).onclick = async () => { const c = await scanOnce('Escanear código del perfume'); if (c) $('[name=barcode]', el).value = c; };
      },
      actions: [
        { label: 'Cancelar' },
        { label: isNew ? 'Crear perfume' : 'Guardar cambios', cls: 'primary', onClick: async m => {
          const d = formData($('#pform', m.el)); d.image = image;
          if (!d.name.trim()) throw new Error('El nombre es obligatorio');
          if (isNew) await api.post('/products', d); else await api.put('/products/' + p.id, d);
          toast(isNew ? 'Perfume creado' : 'Cambios guardados');
          await onSaved();
        } },
      ],
    });
  }

  function barcodeSvg(code, opts = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const fmt_ = /^\d{13}$/.test(code) ? 'EAN13' : /^\d{8}$/.test(code) ? 'EAN8' : 'CODE128';
    try { JsBarcode(svg, code, { format: fmt_, height: 50, displayValue: true, fontSize: 14, margin: 6, ...opts }); }
    catch { JsBarcode(svg, code, { format: 'CODE128', height: 50, displayValue: true, fontSize: 14, margin: 6, ...opts }); }
    return svg.outerHTML;
  }

  function printWindow(title, html, css = '') {
    const w = window.open('', '_blank', 'width=480,height=640');
    if (!w) return toast('Permite ventanas emergentes para imprimir', 'err');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;500&family=Montserrat:wght@400;500&display=swap" rel="stylesheet">
      <style>body{margin:0;padding:16px;font-family:Montserrat,sans-serif;display:flex;flex-wrap:wrap;gap:12px;justify-content:center}${css}
      @media print{body{padding:0}}</style></head><body>${html}<script>setTimeout(()=>{window.print()},600)<\/script></body></html>`);
    w.document.close();
  }

  function printLabel(p) {
    const qty = Math.max(1, Number(prompt('¿Cuántas etiquetas imprimir?', '1')) || 0);
    if (!qty) return;
    const one = `<div class="lbl"><b>${esc(p.name)}</b><span>${esc([p.brand, p.ml ? p.ml + ' ml' : ''].filter(Boolean).join(' · '))}</span>${barcodeSvg(p.barcode, { height: 38, fontSize: 12 })}<strong>${fmt.money(p.offerPrice > 0 ? p.offerPrice : p.price)}</strong></div>`;
    printWindow('Etiquetas ' + p.name, one.repeat(Math.min(qty, 100)),
      `.lbl{width:58mm;border:1px dashed #bbb;padding:6px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:2px;page-break-inside:avoid}
       .lbl b{font-family:'Bodoni Moda',serif;font-size:15px}.lbl span{font-size:10px;color:#555}.lbl svg{max-width:100%}.lbl strong{font-size:14px}`);
  }

  // ---------- Inventario ----------
  Views.inventory = async () => {
    let [products, moves] = await Promise.all([api.get('/products'), api.get('/movements')]);
    view.innerHTML = `
      <div class="toolbar">
        <input class="input" id="iq" type="search" placeholder="Buscar producto…">
        <select class="input" id="if"><option value="">Todos</option><option value="low">Stock bajo</option><option value="out">Agotados</option></select>
        <button class="btn primary" id="iScan">⌁ Escanear y ajustar</button>
      </div>
      <div class="table-wrap"><table class="t"><thead><tr><th></th><th>Producto</th><th>Código</th><th class="r">Existencia</th><th class="r">Mínimo</th><th class="r">Valor (costo)</th><th></th></tr></thead><tbody id="it"></tbody></table></div>
      <div class="card"><h3>Movimientos recientes</h3><div class="table-wrap" style="border:0"><table class="t"><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th class="r">Cantidad</th><th>Nota</th><th>Usuario</th></tr></thead><tbody id="im"></tbody></table></div></div>`;
    const pname = id => products.find(p => p.id === id)?.name || '(eliminado)';
    const draw = () => {
      const q = $('#iq').value.toLowerCase(), f = $('#if').value;
      const list = products.filter(p => (!q || [p.name, p.brand, p.barcode].join(' ').toLowerCase().includes(q)) && (!f || (f === 'low' && p.stock <= p.minStock) || (f === 'out' && p.stock <= 0)));
      $('#it').innerHTML = list.map(p => `<tr><td>${thumb(p)}</td><td class="pname">${esc(p.name)}<small>${esc(p.brand || '')}</small></td><td class="num small">${esc(p.barcode)}</td>
        <td class="r"><span class="badge ${p.stock <= 0 ? 'bad' : p.stock <= p.minStock ? 'warn' : 'ok'}">${p.stock}</span></td><td class="r num">${p.minStock}</td><td class="r num">${fmt.money((p.cost || 0) * p.stock)}</td>
        <td class="actions"><button class="btn sm" data-in="${p.id}">+ Entrada</button><button class="btn sm" data-out="${p.id}">− Salida</button><button class="btn sm" data-adj="${p.id}">Ajustar</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-row">Sin resultados</td></tr>';
      $('#im').innerHTML = moves.slice(0, 80).map(m => `<tr><td class="small muted">${fmt.date(m.date)}</td><td>${esc(pname(m.productId))}</td><td><span class="badge ${m.qty < 0 ? 'warn' : 'ok'}">${esc(m.type)}</span></td><td class="r num">${m.qty > 0 ? '+' : ''}${m.qty}</td><td class="small">${esc(m.note)}</td><td class="small muted">${esc(m.userName || '')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty-row">Sin movimientos</td></tr>';
    };
    const reload = async () => { [products, moves] = await Promise.all([api.get('/products'), api.get('/movements')]); draw(); };
    const stockModal = (p, type) => modal({
      title: { entrada: 'Entrada de mercancía', salida: 'Salida de inventario', ajuste: 'Ajuste de inventario' }[type],
      body: `<p class="muted" style="margin-top:0">${esc(p.name)} · existencia actual <b class="gold">${p.stock}</b></p>
        <div class="form-grid"><label class="field"><span>${type === 'ajuste' ? 'Nueva existencia (conteo físico)' : 'Cantidad'}</span><input class="input" id="sq" type="number" min="0" value="${type === 'ajuste' ? p.stock : 1}"></label>
        <label class="field"><span>Nota</span><input class="input" id="sn" placeholder="${type === 'entrada' ? 'Proveedor, factura…' : type === 'salida' ? 'Merma, tester, regalo…' : 'Conteo físico'}"></label></div>`,
      onMount: el => setTimeout(() => $('#sq', el).select(), 50),
      actions: [{ label: 'Cancelar' }, { label: 'Guardar', cls: 'primary', onClick: async m => {
        await api.post(`/products/${p.id}/stock`, { type, qty: Number($('#sq', m.el).value), note: $('#sn', m.el).value }); toast('Inventario actualizado'); await reload();
      } }],
    });
    draw();
    $('#iq').oninput = draw; $('#if').onchange = draw;
    $('#it').onclick = e => { const b = e.target.closest('button'); if (!b) return; const id = b.dataset.in || b.dataset.out || b.dataset.adj; const p = products.find(x => x.id === id); stockModal(p, b.dataset.in ? 'entrada' : b.dataset.out ? 'salida' : 'ajuste'); };
    $('#iScan').onclick = async () => {
      const code = await scanOnce('Escanear producto'); if (!code) return;
      const p = products.find(x => x.barcode === code || x.sku === code);
      if (!p) return toast('No existe un producto con el código ' + code, 'err');
      stockModal(p, 'entrada');
    };
  };

  // ---------- Lealtad ----------
  const isStamps = () => S.loyalty.mode === 'stamps';
  const balanceOf = c => isStamps() ? `${c.stamps}/${S.loyalty.stamps.goal} sellos` : fmt.money(c.cashback);
  const histAmount = h => h.kind === 'stamps' ? `${h.amount > 0 ? '+' : ''}${h.amount} sello${Math.abs(h.amount) === 1 ? '' : 's'}` : `${h.amount > 0 ? '+' : '−'}${fmt.money(Math.abs(h.amount))}`;
  let serverInfo = null;
  const getServerInfo = async () => (serverInfo = serverInfo || await api.get('/server-info'));

  Views.loyalty = async () => {
    S = await api.get('/settings');
    let customers = await api.get('/customers');
    const L = S.loyalty;
    const totalCash = customers.reduce((a, c) => a + c.cashback, 0);
    const ready = customers.filter(c => c.stamps >= L.stamps.goal).length;
    const earnTxt = { item: 'por cada perfume', purchase: 'por cada compra', amount: `por cada ${fmt.money(L.stamps.amount)}` }[L.stamps.earnBy];
    view.innerHTML = `
      <div class="toolbar">
        <input class="input" id="cq" type="search" placeholder="Buscar por nombre, teléfono o tarjeta…">
        <button class="btn" id="cScan">⌁ Escanear tarjeta</button>
        <button class="btn" id="cRules">Configurar programa</button>
        <button class="btn primary" id="cNew">+ Nueva tarjeta</button>
      </div>
      <div class="kpis">
        <div class="card kpi"><div class="label">Programa</div><div class="value" style="font-size:20px">${L.enabled ? (isStamps() ? 'Tarjeta de sellos' : 'Monedero cashback') : 'Desactivado'}</div><div class="sub">${esc(L.programName)} · ${isStamps() ? `1 sello ${earnTxt} · premio a los ${L.stamps.goal}` : `${L.cashback.percent}% de regreso`}</div></div>
        <div class="card kpi"><div class="label">Clientes</div><div class="value num">${customers.length}</div></div>
        ${isStamps()
          ? `<div class="card kpi"><div class="label">Listos para canjear</div><div class="value num gold">${ready}</div><div class="sub">${esc(L.stamps.rewardText)}</div></div>`
          : `<div class="card kpi"><div class="label">Saldo en monederos</div><div class="value num gold">${fmt.money(totalCash)}</div><div class="sub">Pasivo pendiente de canjear</div></div>`}
        <div class="card kpi"><div class="label">Apple Wallet</div><div class="value" style="font-size:20px">${S.walletStatus ? 'Activo' : 'Sin certificado'}</div><div class="sub">${S.walletStatus ? esc(S.walletStatus.passTypeId) : 'Se configura en Configuración'}</div></div>
      </div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Tarjeta</th><th>Cliente</th><th>Teléfono</th><th>Nivel</th><th class="r">${isStamps() ? 'Sellos' : 'Saldo'}</th><th class="r">Compras</th><th></th></tr></thead><tbody id="ct"></tbody></table></div>`;
    const draw = () => {
      const q = $('#cq').value.toLowerCase();
      $('#ct').innerHTML = customers.filter(c => !q || [c.name, c.phone, c.cardNumber, c.email].join(' ').toLowerCase().includes(q)).map(c => `<tr>
        <td class="num">${esc(c.cardNumber)}</td><td class="pname">${esc(c.name)}<small>${esc(c.email || '')}</small></td><td class="small">${esc(c.phone)}</td>
        <td><span class="badge">${esc(c.tier)}</span></td>
        <td class="r num gold">${balanceOf(c)}${isStamps() && c.stamps >= L.stamps.goal ? '<br><span class="badge ok">¡Premio!</span>' : ''}</td>
        <td class="r num small">${fmt.money(c.totalSpent)}<br><span class="muted">${c.visits} visitas</span></td>
        <td class="actions"><button class="btn sm" data-card="${c.id}">Tarjeta</button><button class="btn sm" data-adj="${c.id}">Ajustar</button><button class="btn sm" data-edit="${c.id}">Editar</button><button class="btn sm danger" data-del="${c.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty-row">Sin clientes registrados.</td></tr>';
    };
    // Recarga toda la sección para que los indicadores (clientes, saldos) también se actualicen
    const reload = async () => { const q = $('#cq')?.value || ''; await Views.loyalty(); if (q) { $('#cq').value = q; $('#cq').oninput(); } };
    draw();
    $('#cq').oninput = draw;
    $('#cNew').onclick = () => customerForm(null, reload);
    $('#cScan').onclick = async () => {
      const code = await scanOnce('Escanear tarjeta de lealtad'); if (!code) return;
      try { customerDetail(await api.get('/customers/card/' + encodeURIComponent(code)), reload); } catch { toast('Tarjeta no encontrada: ' + code, 'err'); }
    };
    $('#cRules').onclick = () => programForm();
    $('#ct').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const c = customers.find(x => x.id === (b.dataset.card || b.dataset.adj || b.dataset.edit || b.dataset.del));
      if (b.dataset.card) customerDetail(c, reload);
      if (b.dataset.edit) customerForm(c, reload);
      if (b.dataset.adj) adjustForm(c, reload);
      if (b.dataset.del && await confirmBox('Eliminar tarjeta', `¿Eliminar la tarjeta de <b>${esc(c.name)}</b>? Se pierde su saldo (${balanceOf(c)}) y deja de funcionar en Apple Wallet.`, 'Eliminar')) { await api.del('/customers/' + c.id); toast('Tarjeta eliminada'); await reload(); }
    };
  };

  function programForm() {
    const L = S.loyalty;
    const draft = JSON.parse(JSON.stringify(L));
    const iconPick = () => Object.entries(Stamps.ICONS).map(([k, v]) => `<button type="button" class="icon-opt ${draft.stamps.icon === k ? 'on' : ''}" data-icon="${k}" title="${v.label}">${Stamps.icon(k, S.colors.gold, S.colors.bg, 30)}<span>${v.label}</span></button>`).join('');
    modal({
      title: 'Programa de lealtad', wide: true,
      body: `<form class="form-grid" id="lf" onsubmit="return false">
        <label class="check"><input type="checkbox" name="enabled" ${L.enabled ? 'checked' : ''}> Programa activo</label>
        <label class="field"><span>Nombre del programa</span><input class="input" name="programName" value="${esc(L.programName)}"></label>
        <div class="field full"><span>Tipo de tarjeta</span>
          <div class="mode-pick">
            <button type="button" data-mode="cashback" class="${L.mode === 'cashback' ? 'on' : ''}"><b>💰 Monedero cashback</b><small>Un % de cada compra regresa como saldo en dinero que el cliente usa en su siguiente compra.</small></button>
            <button type="button" data-mode="stamps" class="${L.mode === 'stamps' ? 'on' : ''}"><b>🧴 Tarjeta de sellos</b><small>Cada compra suma un ícono de perfume. Al completar la tarjeta, el cliente recibe su premio.</small></button>
          </div>
        </div>
        <div class="full form-grid three mode-cashback">
          <label class="field"><span>% de cashback</span><input class="input" name="cashback.percent" data-num type="number" min="0" max="100" step="0.5" value="${esc(L.cashback.percent)}"></label>
          <label class="field"><span>Saldo mínimo para usar</span><input class="input" name="cashback.minRedeem" data-num type="number" min="0" value="${esc(L.cashback.minRedeem)}"></label>
          <label class="field"><span>Regalo de bienvenida ($)</span><input class="input" name="cashback.welcome" data-num type="number" min="0" value="${esc(L.cashback.welcome)}"></label>
        </div>
        <div class="full form-grid mode-stamps">
          <label class="field"><span>Sellos para completar la tarjeta</span><input class="input" name="stamps.goal" data-num type="number" min="1" max="20" value="${esc(L.stamps.goal)}"></label>
          <label class="field"><span>Se gana un sello…</span><select class="input" name="stamps.earnBy">
            <option value="item" ${L.stamps.earnBy === 'item' ? 'selected' : ''}>Por cada perfume comprado</option>
            <option value="purchase" ${L.stamps.earnBy === 'purchase' ? 'selected' : ''}>Por cada compra (visita)</option>
            <option value="amount" ${L.stamps.earnBy === 'amount' ? 'selected' : ''}>Por cada cierto monto</option></select></label>
          <label class="field"><span>Monto por sello (si aplica)</span><input class="input" name="stamps.amount" data-num type="number" min="1" value="${esc(L.stamps.amount)}"></label>
          <label class="field"><span>Compra mínima por visita (si aplica)</span><input class="input" name="stamps.minPurchase" data-num type="number" min="0" value="${esc(L.stamps.minPurchase)}"></label>
          <label class="field"><span>Premio (texto para el cliente)</span><input class="input" name="stamps.rewardText" value="${esc(L.stamps.rewardText)}"></label>
          <label class="field"><span>Valor del premio en caja ($ de descuento)</span><input class="input" name="stamps.rewardValue" data-num type="number" min="0" value="${esc(L.stamps.rewardValue)}"></label>
          <label class="field"><span>Sellos de bienvenida</span><input class="input" name="stamps.welcome" data-num type="number" min="0" value="${esc(L.stamps.welcome)}"></label>
          <div class="field full"><span>Ícono del sello</span><div class="icon-pick" id="iconPick">${iconPick()}</div></div>
          <div class="full stamp-preview" id="stampPrev"></div>
        </div>
        <div class="field full"><span>Niveles (nombre : compra acumulada mínima)</span><textarea class="input" id="tiers" style="min-height:70px">${esc((L.tiers || []).map(t => `${t.name}: ${t.min}`).join('\n'))}</textarea></div>
      </form>`,
      onMount: el => {
        const sync = () => {
          $('.mode-cashback', el).classList.toggle('hidden', draft.mode !== 'cashback');
          $('.mode-stamps', el).classList.toggle('hidden', draft.mode !== 'stamps');
          const goal = Math.min(20, Math.max(1, Number($('[name="stamps.goal"]', el).value) || 8));
          $('#stampPrev', el).innerHTML = `<span class="muted small">Vista previa (cliente con ${Math.ceil(goal / 2)} sellos)</span>` + Stamps.grid(Math.ceil(goal / 2), goal, draft.stamps.icon, { gold: S.colors.gold, bg: S.colors.surface, width: 420, height: goal > 6 ? 110 : 64, transparent: true });
        };
        $$('.mode-pick button', el).forEach(b => b.onclick = () => { draft.mode = b.dataset.mode; $$('.mode-pick button', el).forEach(x => x.classList.toggle('on', x === b)); sync(); });
        $('#iconPick', el).onclick = e => { const b = e.target.closest('[data-icon]'); if (!b) return; draft.stamps.icon = b.dataset.icon; $('#iconPick', el).innerHTML = iconPick(); sync(); };
        $('[name="stamps.goal"]', el).oninput = sync;
        sync();
      },
      actions: [{ label: 'Cancelar' }, { label: 'Guardar programa', cls: 'primary', onClick: async m => {
        const d = formData($('#lf', m.el));
        d.mode = draft.mode; d.stamps.icon = draft.stamps.icon;
        d.tiers = $('#tiers', m.el).value.split('\n').map(l => l.split(':')).filter(x => x[0].trim()).map(([n, v]) => ({ name: n.trim(), min: Number(v) || 0 }));
        if (d.mode !== L.mode && !await confirmBox('Cambiar tipo de tarjeta', 'Los saldos actuales se conservan, pero los clientes verán y acumularán con el nuevo tipo de tarjeta. Las tarjetas en Apple Wallet se actualizan solas.', 'Cambiar', 'primary')) return false;
        S = await api.put('/settings', { loyalty: d }); toast('Programa guardado'); Views.loyalty();
      } }],
    });
  }

  function adjustForm(c, onSaved) {
    const st = isStamps();
    modal({
      title: st ? 'Ajustar sellos' : 'Ajustar saldo',
      body: `<p class="muted" style="margin-top:0">${esc(c.name)} · actual <b class="gold">${balanceOf(c)}</b></p>
        <div class="form-grid"><label class="field"><span>${st ? 'Sellos' : 'Monto $'} (+ suma / − resta)</span><input class="input" id="aq" type="number" step="${st ? 1 : 0.01}" value=""></label>
        <label class="field"><span>Motivo</span><input class="input" id="an" placeholder="Promoción, cumpleaños, corrección…"></label></div>`,
      onMount: el => setTimeout(() => $('#aq', el).focus(), 60),
      actions: [{ label: 'Cancelar' }, { label: 'Aplicar', cls: 'primary', onClick: async m => {
        const v = Number($('#aq', m.el).value);
        if (!v) throw new Error('Escribe una cantidad distinta de 0');
        await api.post(`/customers/${c.id}/adjust`, { [st ? 'stamps' : 'cashback']: v, note: $('#an', m.el).value }); toast('Tarjeta actualizada'); await onSaved();
      } }],
    });
  }

  function customerForm(c, onSaved) {
    const isNew = !c;
    c = c || {};
    modal({
      title: isNew ? 'Nueva tarjeta de lealtad' : 'Editar cliente',
      body: `<form class="form-grid" id="cf" onsubmit="return false">
        <label class="field full"><span>Nombre completo *</span><input class="input" name="name" value="${esc(c.name)}" required></label>
        <label class="field"><span>Teléfono (WhatsApp)</span><input class="input" name="phone" type="tel" value="${esc(c.phone)}" placeholder="10 dígitos"></label>
        <label class="field"><span>Correo</span><input class="input" name="email" type="email" value="${esc(c.email)}"></label>
        <label class="field"><span>Cumpleaños</span><input class="input" name="birthday" type="date" value="${esc(c.birthday)}"></label>
        ${isNew ? `<label class="field"><span>Número de tarjeta</span><div class="input-group"><input class="input" name="cardNumber" placeholder="Vacío = automático"><button type="button" class="btn" id="cfScan">⌁</button></div></label>` : ''}
      </form>`,
      onMount: el => { const b = $('#cfScan', el); if (b) b.onclick = async () => { const code = await scanOnce('Escanear tarjeta física'); if (code) $('[name=cardNumber]', el).value = code; }; },
      actions: [{ label: 'Cancelar' }, { label: isNew ? 'Crear tarjeta' : 'Guardar', cls: 'primary', onClick: async m => {
        const d = formData($('#cf', m.el));
        if (!d.cardNumber) delete d.cardNumber;
        const r = isNew ? await api.post('/customers', d) : await api.put('/customers/' + c.id, d);
        toast(isNew ? 'Tarjeta creada' : 'Cliente actualizado');
        await onSaved();
        if (isNew) customerDetail(r, onSaved);
      } }],
    });
  }

  function cardHtml(c) {
    const L = S.loyalty;
    return `<div class="loyal-card">
      <div class="top"><div><div class="eyebrow">${esc(L.programName)}</div><div class="serif" style="font-size:20px">${esc(c.name)}</div></div><img src="${esc(S.logoIcon || '/assets/logo-icon.jpg')}" alt=""></div>
      ${isStamps() ? `<div class="lc-st">${Stamps.grid(Math.min(c.stamps, L.stamps.goal), L.stamps.goal, L.stamps.icon, { gold: S.colors.gold, bg: '#0b0a08', width: 300, height: L.stamps.goal > 6 ? 76 : 44, transparent: true })}</div>`
        : `<div class="lc-bal"><small>SALDO</small> ${fmt.money(c.cashback)}</div>`}
      ${barcodeSvg(c.cardNumber, { height: 30, fontSize: 11, margin: 4 })}
    </div>`;
  }
  async function customerDetail(c, onChange) {
    const info = await getServerInfo().catch(() => ({ cardBase: location.origin }));
    const link = `${info.cardBase}/t/${c.token}`;
    const local = /^https:\/\/(\d+\.){3}\d+|localhost/.test(info.cardBase);
    const waText = `Hola ${c.name.split(' ')[0]}, esta es tu tarjeta ${S.loyalty.programName} de ${S.storeName}. Guárdala en tu celular${S.walletStatus ? ' o en Apple Wallet' : ''}: ${link}`;
    const waHref = `https://wa.me/${(c.phone || '').replace(/\D/g, '').replace(/^(\d{10})$/, '52$1')}?text=${encodeURIComponent(waText)}`;
    modal({
      title: esc(c.name), wide: true,
      body: `<div class="cd-grid">
        <div class="cd-left">
          ${cardHtml(c)}
          <div class="kpis" style="margin-top:14px"><div class="card kpi"><div class="label">${isStamps() ? 'Sellos' : 'Saldo'}</div><div class="value gold num">${balanceOf(c)}</div></div><div class="card kpi"><div class="label">Nivel</div><div class="value" style="font-size:20px">${esc(c.tier || '')}</div></div></div>
        </div>
        <div class="cd-right">
          <h3 class="serif" style="font-weight:500;margin:0 0 6px">Tarjeta digital del cliente</h3>
          <p class="muted small" style="margin:0 0 10px">El cliente escanea este QR o abre el enlace en su celular. Ahí ve su saldo en vivo y la guarda ${S.walletStatus ? 'en Apple Wallet' : 'en su pantalla de inicio'}.</p>
          <div class="cd-qr">${ui.qrSvg(link, { size: 170 })}</div>
          <div class="input-group" style="margin-top:10px"><input class="input small" value="${esc(link)}" readonly id="cdLink"><button type="button" class="btn" id="cdCopy">Copiar</button></div>
          ${local ? `<p class="small" style="color:var(--warn);margin:8px 0 0">Este enlace solo abre conectado al WiFi de la tienda. Configura una URL pública en Configuración para que funcione desde cualquier lugar.</p>` : ''}
          <div class="toolbar" style="margin-top:12px">
            <a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Abrir tarjeta ↗</a>
            ${c.phone ? `<a class="btn" href="${esc(waHref)}" target="_blank" rel="noopener">Enviar por WhatsApp</a>` : ''}
            ${S.walletStatus ? `<a class="btn" href="/api/public/wallet/${esc(c.token)}/pass">Descargar .pkpass</a>` : ''}
          </div>
        </div>
      </div>
      <h3 class="serif" style="font-weight:500;margin:18px 0 8px">Historial</h3>
      <table class="t">${(c.history || []).slice(0, 20).map(h => `<tr><td class="small muted">${fmt.day(h.date)}</td><td class="small">${esc(h.note)}${h.user ? ` <span class="muted">· ${esc(h.user)}</span>` : ''}</td><td class="r num ${h.amount < 0 ? '' : 'gold'}">${histAmount(h)}</td></tr>`).join('') || '<tr><td class="empty-row">Sin movimientos</td></tr>'}</table>`,
      onMount: el => {
        $('#cdCopy', el).onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Enlace copiado'); } catch { $('#cdLink', el).select(); document.execCommand('copy'); toast('Enlace copiado'); } };
      },
      actions: [{ label: 'Cerrar' }, { label: 'Imprimir tarjeta', cls: 'primary', onClick: () => {
        printWindow('Tarjeta ' + c.name, cardHtml(c) + `<div class="qr">${ui.qrSvg(link, { size: 120 })}<span>Escanea para ver tu tarjeta digital</span></div>`, `.loyal-card{width:85.6mm;height:54mm;border-radius:4mm;padding:4mm;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;background:#0b0a08;color:#efe8da;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:Montserrat}
          .eyebrow{font-size:8px;letter-spacing:.3em;text-transform:uppercase;color:#c9a75e}.serif{font-family:'Bodoni Moda',serif}.top{display:flex;justify-content:space-between;align-items:center}.top img{width:38px;border-radius:50%}.loyal-card>svg{background:#fff;border-radius:4px;width:100%;height:13mm}.lc-st svg{width:100%;height:auto}.lc-bal{font-size:18px;font-weight:600;color:#c9a75e}.lc-bal small{font-size:8px;letter-spacing:.2em;color:#efe8da}
          .qr{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10px;width:85.6mm}`);
        return false;
      } }],
    });
  }

  // ---------- Ventas ----------
  const localDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Evita que Excel ejecute fórmulas escritas en nombres (=, +, -, @)
  const csvCell = v => { let t = String(v ?? ""); if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = "\x27" + t; return "\"" + t.replace(/"/g, "\"\"") + "\""; };
  Views.sales = async () => {
    let sales = await api.get('/sales');
    const d0 = new Date(); d0.setDate(1);
    view.innerHTML = `
      <div class="toolbar">
        <label class="field"><span>Desde</span><input class="input" type="date" id="sf" value="${localDate(d0)}"></label>
        <label class="field"><span>Hasta</span><input class="input" type="date" id="st" value="${localDate(new Date())}"></label>
        <label class="field" style="flex:1"><span>Buscar</span><input class="input" id="sq" placeholder="Folio, cliente, vendedor…"></label>
        <button class="btn" id="sCsv" style="align-self:flex-end">Exportar CSV</button>
      </div>
      <div class="kpis" id="sk"></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Folio</th><th>Fecha</th><th>Artículos</th><th>Cliente</th><th>Vendedor</th><th>Pago</th><th class="r">Total</th><th></th></tr></thead><tbody id="stb"></tbody></table></div>`;
    const filtered = () => {
      const f = new Date($('#sf').value + 'T00:00'), t = new Date($('#st').value + 'T23:59:59'), q = $('#sq').value.toLowerCase();
      return sales.filter(s => { const d = new Date(s.date); return d >= f && d <= t && (!q || [s.folio, s.customerName, s.userName].join(' ').toLowerCase().includes(q)); });
    };
    const draw = () => {
      const list = filtered(), ok = list.filter(s => s.status !== 'cancelada');
      const tot = ok.reduce((a, s) => a + s.total, 0);
      const by = m => ok.filter(s => s.method === m).reduce((a, s) => a + s.total, 0);
      $('#sk').innerHTML = `<div class="card kpi"><div class="label">Total</div><div class="value num">${fmt.money(tot)}</div><div class="sub">${ok.length} ventas</div></div>
        <div class="card kpi"><div class="label">Efectivo</div><div class="value num">${fmt.money(by('efectivo'))}</div></div>
        <div class="card kpi"><div class="label">Tarjeta</div><div class="value num">${fmt.money(by('tarjeta'))}</div></div>
        <div class="card kpi"><div class="label">Transferencia</div><div class="value num">${fmt.money(by('transferencia'))}</div></div>`;
      $('#stb').innerHTML = list.map(s => `<tr style="${s.status === 'cancelada' ? 'opacity:.5' : ''}"><td class="num">#${s.folio}</td><td class="small">${fmt.date(s.date)}</td><td class="small">${s.items.map(i => `${i.qty}× ${esc(i.name)}`).join('<br>')}</td>
        <td class="small">${esc(s.customerName || '—')}</td><td class="small">${esc(s.userName)}</td><td class="small">${esc(s.method)}</td><td class="r num">${fmt.money(s.total)}${s.status === 'cancelada' ? '<br><span class="badge bad">cancelada</span>' : ''}</td>
        <td class="actions"><button class="btn sm" data-t="${s.id}">Ticket</button>${s.status !== 'cancelada' ? `<button class="btn sm danger" data-c="${s.id}">Cancelar</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="8" class="empty-row">Sin ventas en este periodo</td></tr>';
    };
    draw();
    ['#sf', '#st', '#sq'].forEach(s => $(s).addEventListener('input', draw));
    $('#stb').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const s = sales.find(x => x.id === (b.dataset.t || b.dataset.c));
      if (b.dataset.t) modal({ title: 'Venta #' + s.folio, body: ticketHtml(s, S), actions: [{ label: 'Cerrar' }, { label: 'Imprimir', cls: 'primary', onClick: () => { printTicket(s, S); return false; } }] });
      if (b.dataset.c && await confirmBox('Cancelar venta', `Se regresará el inventario y se revertirán los puntos de la venta <b>#${s.folio}</b>.`, 'Cancelar venta')) {
        await api.post(`/sales/${s.id}/cancel`); toast('Venta cancelada'); sales = await api.get('/sales'); draw();
      }
    };
    $('#sCsv').onclick = () => {
      const rows = [['Folio', 'Fecha', 'Estado', 'Cliente', 'Tarjeta', 'Vendedor', 'Pago', 'Artículos', 'Subtotal', 'Descuento', 'Cashback usado', 'Recompensa', 'Total', 'Cashback ganado', 'Sellos ganados']].concat(
        filtered().map(s => [s.folio, new Date(s.date).toLocaleString('es-MX'), s.status, s.customerName, s.cardNumber || '', s.userName, s.method, s.items.map(i => `${i.qty}x ${i.name}`).join(' | '), s.subtotal, s.discount, s.cashbackUsed || 0, s.rewardDiscount || 0, s.total, s.cashbackEarned || 0, s.stampsEarned || 0]));
      const csv = '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `ventas-${$('#sf').value}-a-${$('#st').value}.csv`; a.click();
    };
  };

  // ---------- Apariencia ----------
  const PRESETS = [
    { name: 'Negro y oro', colors: { bg: '#0b0b0b', surface: '#141414', gold: '#c9a75e', text: '#efe8da', muted: '#9b9384' }, logo: '/assets/logo-horizontal.jpg' },
    { name: 'Marfil', colors: { bg: '#f3eee5', surface: '#fbf8f2', gold: '#9c7a3c', text: '#1b1712', muted: '#6f675b' }, logo: '/assets/logo-light.jpg' },
    { name: 'Noche esmeralda', colors: { bg: '#07110e', surface: '#0d1a16', gold: '#c9a75e', text: '#e9efe9', muted: '#8fa198' }, logo: '/assets/logo-horizontal.jpg' },
    { name: 'Borgoña', colors: { bg: '#12070a', surface: '#1c0d11', gold: '#d2a968', text: '#f2e6e0', muted: '#a68f8b' }, logo: '/assets/logo-horizontal.jpg' },
    { name: 'Champagne rosé', colors: { bg: '#100c0c', surface: '#1a1414', gold: '#e2b8a0', text: '#f4e9e4', muted: '#a3918a' }, logo: '/assets/logo-horizontal.jpg' },
  ];
  const LOGOS = ['/assets/logo-horizontal.jpg', '/assets/logo-vertical.jpg', '/assets/logo-light.jpg', '/assets/logo-icon.jpg', '/assets/logo-emblem.jpg'];

  Views.appearance = async () => {
    S = await api.get('/settings');
    const d = JSON.parse(JSON.stringify(S));
    const v = d.vitrina;
    const segBtns = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([val, lab]) => `<button type="button" data-v="${val}" class="${String(v[key]) === String(val) ? 'on' : ''}">${lab}</button>`).join('')}</div>`;
    const logoPick = (key) => `<div class="logo-pick" data-key="${key}">${[...new Set([...LOGOS, d[key]].filter(Boolean))].map(l => `<button type="button" data-v="${esc(l)}" class="${d[key] === l ? 'on' : ''}"><img src="${esc(l)}" alt=""></button>`).join('')}<label class="btn sm" style="align-self:center">Subir…<input type="file" accept="image/*" hidden data-up="${key}"></label></div>`;
    view.innerHTML = `
      <div class="grid-2">
        <div style="display:flex;flex-direction:column;gap:20px">
          <div class="card"><h3>Paleta de colores</h3>
            <div class="swatches" id="presets">${PRESETS.map((p, i) => `<button class="swatch" data-i="${i}"><i style="background:linear-gradient(135deg,${p.colors.bg} 50%,${p.colors.gold} 50%)"></i>${p.name}</button>`).join('')}</div>
            <div class="color-row" style="margin-top:16px">
              ${[['bg', 'Fondo'], ['surface', 'Paneles'], ['gold', 'Dorado / acento'], ['text', 'Texto'], ['muted', 'Texto secundario']].map(([k, l]) => `<label class="field"><span>${l}</span><input type="color" data-color="${k}" value="${esc(d.colors[k])}"></label>`).join('')}
            </div>
          </div>
          <div class="card"><h3>Vitrinas</h3>
            <div class="field"><span>Tipo de apertura</span>${segBtns('doors', [['double', 'Dos puertas'], ['single', 'Una puerta'], ['lift', 'Campana que sube']])}</div><br>
            <div class="field"><span>Iluminación interior</span>${segBtns('light', [['warm', 'Cálida'], ['white', 'Blanca'], ['cool', 'Fría']])}</div><br>
            <label class="field"><span>Velocidad de apertura: <b id="animV">${v.animation} ms</b></span><input type="range" min="400" max="1800" step="100" value="${v.animation}" id="anim" style="accent-color:var(--gold)"></label>
            <div class="toolbar" style="margin-top:14px">
              <label class="check"><input type="checkbox" id="showPrices" ${d.showPrices ? 'checked' : ''}> Mostrar precios</label>
              <label class="check"><input type="checkbox" id="showStock" ${d.showStock ? 'checked' : ''}> Mostrar existencias</label>
            </div>
          </div>
          <div class="card"><h3>Logos</h3>
            <div class="field"><span>Logo del encabezado</span>${logoPick('logo')}</div><br>
            <div class="field"><span>Imagen principal (portada)</span>${logoPick('heroImage')}</div><br>
            <div class="field"><span>Ícono (tarjetas y tickets)</span>${logoPick('logoIcon')}</div>
          </div>
          <div class="card"><h3>Textos y contacto</h3>
            <form class="form-grid" id="af">
              <label class="field"><span>Nombre de la tienda</span><input class="input" name="storeName" value="${esc(d.storeName)}"></label>
              <label class="field"><span>Frase corta</span><input class="input" name="tagline" value="${esc(d.tagline)}"></label>
              <label class="field full"><span>Título de portada</span><input class="input" name="heroTitle" value="${esc(d.heroTitle)}"></label>
              <label class="field full"><span>Subtítulo de portada</span><input class="input" name="heroSubtitle" value="${esc(d.heroSubtitle)}"></label>
              <label class="field"><span>WhatsApp (con lada)</span><input class="input" name="whatsapp" value="${esc(d.whatsapp)}" placeholder="52 55 1234 5678"></label>
              <label class="field"><span>Instagram</span><input class="input" name="instagram" value="${esc(d.instagram)}" placeholder="@parraperfumeria"></label>
              <label class="field full"><span>Dirección</span><input class="input" name="address" value="${esc(d.address)}"></label>
              <label class="field full"><span>Pie de página</span><input class="input" name="footer" value="${esc(d.footer)}"></label>
            </form>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;position:sticky;top:80px;align-self:start">
          <div class="toolbar"><span class="muted small">Vista previa del catálogo</span><span class="spacer"></span><button class="btn primary" id="aSave">Guardar y publicar</button></div>
          <iframe class="preview-frame" id="pv" src="/"></iframe>
          <p class="muted small">Los cambios se ven en la vista previa al guardar. Las pantallas con el catálogo abierto se actualizan solas en menos de 30 s.</p>
        </div>
      </div>`;

    const syncColors = () => $$('[data-color]').forEach(i => { i.value = d.colors[i.dataset.color]; });
    $('#presets').onclick = e => { const b = e.target.closest('.swatch'); if (!b) return; const p = PRESETS[b.dataset.i]; d.colors = { ...p.colors }; d.logo = p.logo; syncColors(); applyTheme(d); $$('[data-key=logo] button').forEach(x => x.classList.toggle('on', x.dataset.v === d.logo)); };
    $$('[data-color]').forEach(i => i.oninput = () => { d.colors[i.dataset.color] = i.value; applyTheme(d); });
    $$('.seg').forEach(s => s.onclick = e => { const b = e.target.closest('button'); if (!b) return; v[s.dataset.key] = b.dataset.v; $$('button', s).forEach(x => x.classList.toggle('on', x === b)); });
    $('#anim').oninput = e => { v.animation = Number(e.target.value); $('#animV').textContent = v.animation + ' ms'; };
    $$('.logo-pick').forEach(lp => {
      lp.onclick = e => { const b = e.target.closest('button'); if (!b) return; d[lp.dataset.key] = b.dataset.v; $$('button', lp).forEach(x => x.classList.toggle('on', x === b)); };
      $('input[type=file]', lp).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const url = await api.uploadImage(f, 1600); d[lp.dataset.key] = url;
          const b = document.createElement('button'); b.type = 'button'; b.dataset.v = url; b.innerHTML = `<img src="${url}">`;
          lp.insertBefore(b, lp.lastElementChild); $$('button', lp).forEach(x => x.classList.toggle('on', x === b));
          toast('Imagen subida');
        } catch (err) { toast(err.message, 'err'); }
      };
    });
    $('#aSave').onclick = async () => {
      Object.assign(d, formData($('#af')));
      d.showPrices = $('#showPrices').checked; d.showStock = $('#showStock').checked;
      const { storeName, tagline, heroTitle, heroSubtitle, logo, logoIcon, heroImage, colors, vitrina, showPrices, showStock, whatsapp, instagram, address, footer } = d;
      S = await api.put('/settings', { storeName, tagline, heroTitle, heroSubtitle, logo, logoIcon, heroImage, colors, vitrina, showPrices, showStock, whatsapp, instagram, address, footer });
      applyTheme(S); $('.side-logo img').src = S.logo;
      $('#pv').contentWindow.location.reload();
      toast('Apariencia publicada');
    };
  };

  // ---------- Usuarios ----------
  Views.users = async () => {
    let users = await api.get('/users');
    view.innerHTML = `
      <div class="toolbar"><p class="muted" style="margin:0;flex:1">Crea cuentas para tu equipo y elige qué secciones puede ver cada quien.</p><button class="btn primary" id="uNew">+ Nuevo usuario</button></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Secciones</th><th>Estado</th><th></th></tr></thead><tbody id="ut"></tbody></table></div>`;
    const draw = () => {
      $('#ut').innerHTML = users.map(u => `<tr><td class="pname">${esc(u.name)}</td><td class="num">${esc(u.username)}</td>
        <td><span class="badge">${u.role === 'admin' ? 'Administrador' : 'Personal'}</span></td>
        <td class="small">${u.role === 'admin' ? '<span class="muted">Todas</span>' : (u.sections || []).map(s => SECTIONS[s]?.label).filter(Boolean).join(', ') || '<span class="muted">Ninguna</span>'}</td>
        <td><span class="badge ${u.active ? 'ok' : 'bad'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
        <td class="actions"><button class="btn sm" data-e="${u.id}">Editar</button>${u.id !== api.user.id ? `<button class="btn sm danger" data-d="${u.id}">✕</button>` : ''}</td></tr>`).join('');
    };
    const reload = async () => { users = await api.get('/users'); draw(); };
    draw();
    $('#uNew').onclick = () => userForm(null, reload);
    $('#ut').onclick = async e => {
      const b = e.target.closest('button'); if (!b) return;
      const u = users.find(x => x.id === (b.dataset.e || b.dataset.d));
      if (b.dataset.e) userForm(u, reload);
      if (b.dataset.d && await confirmBox('Eliminar usuario', `¿Eliminar a <b>${esc(u.name)}</b>? Sus ventas registradas se conservan.`, 'Eliminar')) { await api.del('/users/' + u.id); toast('Usuario eliminado'); await reload(); }
    };
  };

  function userForm(u, onSaved) {
    const isNew = !u;
    u = u || { role: 'staff', sections: ['pos'], active: true };
    modal({
      title: isNew ? 'Nuevo usuario' : 'Editar usuario', wide: true,
      body: `<form class="form-grid" id="uf">
        <label class="field"><span>Nombre</span><input class="input" name="name" value="${esc(u.name)}" required></label>
        <label class="field"><span>Usuario (para entrar)</span><input class="input" name="username" value="${esc(u.username)}" autocomplete="off" required></label>
        <label class="field"><span>${isNew ? 'Contraseña (mín. 6)' : 'Nueva contraseña (opcional)'}</span><input class="input" name="password" type="password" autocomplete="new-password" ${isNew ? 'required' : ''}></label>
        <label class="field"><span>Rol</span><select class="input" name="role" id="urole"><option value="staff" ${u.role !== 'admin' ? 'selected' : ''}>Personal (secciones elegidas)</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Administrador (todo)</option></select></label>
        <div class="field full" id="usecs"><span>Secciones que puede ver</span>
          <div class="sections-pick">${Object.entries(SECTIONS).map(([k, s]) => `<label class="check"><input type="checkbox" value="${k}" ${(u.sections || []).includes(k) ? 'checked' : ''}> ${s.ic} ${s.label}</label>`).join('')}</div>
        </div>
        <label class="check full"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> Usuario activo</label>
      </form>`,
      onMount: el => { const t = () => $('#usecs', el).style.opacity = $('#urole', el).value === 'admin' ? .4 : 1; $('#urole', el).onchange = t; t(); },
      actions: [{ label: 'Cancelar' }, { label: isNew ? 'Crear usuario' : 'Guardar', cls: 'primary', onClick: async m => {
        const f = $('#uf', m.el);
        const d = { name: $('[name=name]', f).value, username: $('[name=username]', f).value, password: $('[name=password]', f).value, role: $('[name=role]', f).value, active: $('[name=active]', f).checked,
          sections: $$('#usecs input:checked', f).map(i => i.value) };
        if (!d.password) delete d.password;
        if (isNew) await api.post('/users', d); else await api.put('/users/' + u.id, d);
        toast(isNew ? 'Usuario creado' : 'Usuario actualizado');
        if (!isNew && u.id === api.user.id) await api.me();
        await onSaved();
      } }],
    });
  }

  // ---------- Configuración ----------
  Views.settings = async () => {
    S = await api.get('/settings');
    view.innerHTML = `
      <div class="grid-2">
        <div class="card"><h3>General y ticket</h3>
          <form class="form-grid" id="gf">
            <label class="field"><span>Moneda</span><select class="input" name="currency">${['MXN', 'USD', 'EUR', 'COP', 'GTQ'].map(c => `<option ${S.currency === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
            <span></span>
            <label class="field full"><span>Encabezado del ticket</span><input class="input" name="ticket.header" value="${esc(S.ticket?.header)}"></label>
            <label class="field full"><span>Pie del ticket</span><input class="input" name="ticket.footer" value="${esc(S.ticket?.footer)}"></label>
          </form>
          <div class="modal-actions"><button class="btn primary" id="gSave">Guardar</button></div>
        </div>
        <div class="card"><h3>Mi contraseña</h3>
          <form class="form-grid" id="mp">
            <label class="field full"><span>Contraseña actual</span><input class="input" type="password" name="current" autocomplete="current-password"></label>
            <label class="field full"><span>Nueva contraseña</span><input class="input" type="password" name="next" autocomplete="new-password"></label>
          </form>
          <div class="modal-actions"><button class="btn primary" id="mpSave">Cambiar contraseña</button></div>
        </div>
      </div>
      <div class="grid-2">
        <div class="card"><h3>Base de datos en la nube (Firebase)</h3>
          <div id="dbBox">${storageHtml(S.storage)}</div>
        </div>
        <div class="card"><h3>Respaldo de datos</h3>
          <p class="muted">Además de Firebase, siempre se guarda una copia local en <code>data/db.json</code>. Puedes descargar un respaldo completo cuando quieras.</p>
          <div class="toolbar"><button class="btn primary" id="bk">Descargar respaldo</button><label class="btn">Restaurar respaldo…<input type="file" accept=".json" hidden id="rs"></label></div>
        </div>
      </div>
      <div class="card"><h3>Apple Wallet</h3>
        ${S.walletStatus
          ? `<p><span class="badge ok">Activo</span> <span class="num">${esc(S.walletStatus.passTypeId)}</span> · Equipo <span class="num">${esc(S.walletStatus.teamId)}</span> · vence ${fmt.day(S.walletStatus.expires)}</p>`
          : `<p><span class="badge warn">Sin certificado</span> Mientras tanto, los clientes guardan su tarjeta digital en la pantalla de inicio del iPhone.</p>`}
        <div class="grid-2" style="gap:24px">
          <div>
            <p class="muted small" style="margin-top:0">Para que la tarjeta se guarde en Apple Wallet necesitas una cuenta de <b>Apple Developer</b> (99 USD al año):</p>
            <ol class="muted small steps">
              <li>En developer.apple.com → Certificates, IDs &amp; Profiles → <b>Identifiers</b>, crea un <b>Pass Type ID</b> (ej. <code>pass.mx.parra.club</code>).</li>
              <li>Crea su <b>certificado</b>, ábrelo en una Mac y expórtalo desde Llavero como <b>.p12</b> con contraseña.</li>
              <li>Descarga el certificado intermedio <b>Apple WWDR G4</b> (AppleWWDRCAG4.cer) de apple.com/certificateauthority.</li>
              <li>Súbelos aquí. Para que el saldo se actualice solo en el iPhone, la tienda necesita una <b>URL pública con HTTPS</b> (por ejemplo, al publicar en Firebase).</li>
            </ol>
          </div>
          <form class="form-grid" id="wf" onsubmit="return false">
            <label class="field full"><span>Certificado del pase (.p12)</span><input class="input" type="file" accept=".p12,.pfx" id="wP12"></label>
            <label class="field"><span>Contraseña del .p12</span><input class="input" type="password" id="wPass" autocomplete="off"></label>
            <label class="field"><span>Certificado WWDR (.cer o .pem)</span><input class="input" type="file" accept=".cer,.pem,.crt" id="wWwdr"></label>
            <label class="field full"><span>URL pública de la tienda (https)</span><input class="input" id="wUrl" value="${esc(S.wallet?.publicUrl || '')}" placeholder="https://tienda.parra.mx"></label>
            <div class="full toolbar">
              <button class="btn primary" id="wSave">Guardar Apple Wallet</button>
              ${S.walletStatus ? '<button class="btn danger" id="wDel">Quitar certificado</button>' : ''}
            </div>
          </form>
        </div>
      </div>`;
    const fileB64 = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
    $('#wSave').onclick = async () => {
      try {
        S = await api.put('/settings', { wallet: { publicUrl: $('#wUrl').value.trim() } });
        const p12 = $('#wP12').files[0], wwdr = $('#wWwdr').files[0];
        if (p12 || wwdr) {
          if (!p12 || !wwdr) throw new Error('Sube el .p12 y el certificado WWDR juntos');
          const info = await api.post('/wallet/cert', { p12Base64: await fileB64(p12), password: $('#wPass').value, wwdrBase64: await fileB64(wwdr) });
          toast('Apple Wallet activado: ' + info.passTypeId);
        } else toast('URL guardada');
        serverInfo = null;
        Views.settings();
      } catch (e) { toast(e.message, 'err'); }
    };
    const wDel = $('#wDel');
    if (wDel) wDel.onclick = async () => { if (await confirmBox('Quitar certificado', 'Los clientes ya no podrán agregar la tarjeta a Apple Wallet hasta que subas otro certificado.', 'Quitar')) { await api.del('/wallet/cert'); toast('Certificado eliminado'); Views.settings(); } };
    $('#gSave').onclick = async () => { const d = formData($('#gf')); S = await api.put('/settings', d); fmt.currency = S.currency; toast('Configuración guardada'); };
    $('#mpSave').onclick = async () => { try { await api.post('/me/password', formData($('#mp'))); $('#mp').reset(); toast('Contraseña actualizada'); } catch (e) { toast(e.message, 'err'); } };
    $('#bk').onclick = async () => {
      const data = await api.get('/backup');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
      a.download = `parra-respaldo-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    };
    $('#rs').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (!await confirmBox('Restaurar respaldo', 'Esto reemplazará TODOS los datos actuales (productos, ventas, clientes y usuarios) por los del archivo.', 'Restaurar')) return;
      try { await api.post('/restore', JSON.parse(await f.text())); toast('Respaldo restaurado'); setTimeout(() => location.reload(), 800); } catch (err) { toast(err.message, 'err'); }
    };
    bindStorage();
  };

  // ---------- Firebase: estado y conexión ----------
  function storageHtml(st) {
    st = st || { mode: 'local' };
    const project = S.firebase?.projectId || 'tu proyecto';
    if (st.mode === 'firebase') {
      return `<p><span class="badge ok">Conectado</span> <span class="num">${esc(st.projectId)}</span></p>
        <p class="muted small" style="margin:0 0 4px">Cada venta, producto, cliente y ajuste se guarda en Firestore automáticamente.</p>
        <p class="small" style="margin:0 0 12px">${st.pending ? '<span class="badge warn">Subiendo cambios…</span>' : `Última sincronización: <b>${st.lastSync ? fmt.date(st.lastSync) : '—'}</b>`} · ${st.docs || 0} documentos</p>
        ${st.error ? `<p class="small" style="color:var(--warn)">${esc(st.error)}</p>` : ''}
        <div class="toolbar"><button class="btn" id="dbSync">Sincronizar ahora</button>${api.user.role === 'admin' ? '<button class="btn danger" id="dbOff">Desconectar</button>' : ''}</div>`;
    }
    return `<p><span class="badge warn">Solo local</span> ${st.hasKey ? '' : 'Falta conectar Firebase.'}</p>
      ${st.error ? `<p class="small" style="color:var(--warn);margin-top:0">${esc(st.error)}</p>` : ''}
      <ol class="muted small steps">
        <li>En <b>console.firebase.google.com</b> abre <b>${esc(project)}</b> → <b>Firestore Database</b> → <b>Crear base de datos</b> (modo producción, región <code>nam5</code> o la más cercana).</li>
        <li>Ve a ⚙ <b>Configuración del proyecto</b> → <b>Cuentas de servicio</b> → <b>Generar nueva clave privada</b>. Se descarga un archivo <code>.json</code>.</li>
        <li>Súbelo aquí. La primera vez se copian todos tus datos a Firebase.</li>
      </ol>
      <p class="small muted">Esa llave da acceso total a tu base de datos: guárdala en un lugar seguro y no la compartas.</p>
      ${api.user.role === 'admin'
        ? `<div class="toolbar"><label class="btn">Elegir llave .json…<input type="file" accept=".json,application/json" hidden id="dbKey"></label><span class="muted small" id="dbKeyName"></span><button class="btn primary" id="dbConnect" disabled>Conectar</button></div>`
        : '<p class="small">Pide a un administrador que conecte Firebase.</p>'}`;
  }
  function bindStorage() {
    const box = $('#dbBox'); if (!box) return;
    const refresh = st => { S.storage = st; box.innerHTML = storageHtml(st); bindStorage(); };
    const sync = $('#dbSync', box);
    if (sync) sync.onclick = async () => {
      sync.disabled = true;
      try { const r = await api.post('/storage/sync'); toast(r.writes ? `Sincronizado (${r.writes} cambios)` : 'Todo está al día'); refresh(r); }
      catch (e) { toast(e.message, 'err'); sync.disabled = false; }
    };
    const off = $('#dbOff', box);
    if (off) off.onclick = async () => {
      if (!await confirmBox('Desconectar Firebase', 'La tienda seguirá funcionando con la copia local. Los datos que ya están en Firebase no se borran.', 'Desconectar')) return;
      refresh(await api.del('/storage/key')); toast('Firebase desconectado');
    };
    const input = $('#dbKey', box);
    let keyText = null;
    if (input) input.onchange = async () => {
      const f = input.files[0]; if (!f) return;
      keyText = await f.text();
      try { const k = JSON.parse(keyText); if (k.type !== 'service_account') throw 0; $('#dbKeyName', box).textContent = `${f.name} · ${k.project_id}`; $('#dbConnect', box).disabled = false; }
      catch { keyText = null; toast('Ese archivo no es una llave de cuenta de servicio de Firebase', 'err'); }
    };
    const connect = $('#dbConnect', box);
    if (connect) connect.onclick = async () => {
      connect.disabled = true; connect.textContent = 'Conectando…';
      try {
        const r = await api.post('/storage/key', { key: keyText });
        keyText = null;
        toast('Firebase conectado: ' + r.projectId);
        if (r.reload) { toast('Se cargaron los datos que ya había en Firebase'); setTimeout(() => location.reload(), 900); }
        else refresh(r);
      } catch (e) { toast(e.message, 'err'); connect.disabled = false; connect.textContent = 'Conectar'; }
    };
  }

  const { ticketHtml, printTicket } = window.Tickets;


  boot();
})();
