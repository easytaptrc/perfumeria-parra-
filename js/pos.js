(function () {
  const { esc, toast, applyTheme } = ui;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CART_KEY = 'parra_pos_cart';

  let S = null, products = [], customers = null;
  let mode = 'sell';
  const st = { cart: [], customer: null, discount: 0, cashUse: 0, redeem: false };
  const scanner = new Scanner('cam');
  const isTouch = matchMedia('(pointer: coarse)').matches;

  // ---------- Utilidades ----------
  const priceOf = p => (p.offerPrice > 0 ? p.offerPrice : p.price);
  const thumb = p => `<div class="thumb">${ui.media(p)}</div>`;
  const findByCode = c => products.find(p => p.barcode === c || (p.sku && p.sku === c));

  function modal({ title, body, actions = [], onMount }) {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal">${title ? `<h2>${title}</h2>` : ''}<div style="margin-top:12px">${body}</div><div class="modal-actions"></div></div>`;
    const m = { el: back, close() { back.classList.remove('open'); setTimeout(() => back.remove(), 300); } };
    for (const a of actions) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ' + (a.cls || ''); b.textContent = a.label;
      if (a.id) b.id = a.id;
      b.onclick = async () => {
        if (!a.onClick) return m.close();
        b.disabled = true;
        try { if ((await a.onClick(m)) !== false) m.close(); } catch (e) { toast(e.message, 'err'); } finally { b.disabled = false; }
      };
      $('.modal-actions', back).appendChild(b);
    }
    back.addEventListener('mousedown', e => { if (e.target === back) m.close(); });
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add('open'));
    onMount && onMount(back, m);
    return m;
  }

  // ---------- Arranque ----------
  async function boot() {
    if (!api.token) { location.href = '/admin?next=/pos'; return; }
    let me;
    try { me = await api.me(); } catch { location.href = '/admin?next=/pos'; return; }
    if (me.mustChangePassword) { location.href = '/admin?next=/pos'; return; }
    if (!api.can('pos')) { document.body.innerHTML = '<div class="login"><div class="login-card"><p>Tu usuario no tiene acceso al punto de venta.</p><a class="btn" href="/admin">Ir al panel</a></div></div>'; return; }
    S = await api.get('/settings');
    applyTheme(S);
    if (S.logoIcon) $('.pos-logo').src = S.logoIcon;
    $('#who').textContent = api.user.name;
    const other = ['dashboard', 'products', 'inventory', 'loyalty', 'sales', 'appearance', 'users', 'settings'].some(s => api.can(s));
    $('#toAdmin').classList.toggle('hidden', !other);
    await loadProducts();
    restoreCart();
    render();
    if (!isTouch) $('#code').focus();
  }
  async function loadProducts() { products = await api.get('/products'); renderQuick(); }
  window.addEventListener('parra:logout', () => { location.href = '/admin?next=/pos'; });
  $('#logout').onclick = async () => { await scanner.stop(); await api.logout(); location.href = '/admin?next=/pos'; };

  // ---------- Modo ----------
  $('#mode').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    mode = b.dataset.m;
    $$('#mode button').forEach(x => x.classList.toggle('on', x === b));
    toast(mode === 'sell' ? 'Modo venta: lo escaneado se agrega al carrito' : 'Modo consulta: solo muestra nombre y precio');
  };

  // ---------- Cámara ----------
  $('#camStart').onclick = async () => {
    $('#camErr').textContent = '';
    try {
      await scanner.start(handleCode, { cooldown: 1600 });
      $('#camOff').classList.add('hidden');
      $('#camCtrl').classList.remove('hidden');
    } catch (e) { $('#camErr').textContent = e.message; }
  };
  $('#camStop').onclick = async () => { await scanner.stop(); $('#camOff').classList.remove('hidden'); $('#camCtrl').classList.add('hidden'); };
  let torch = false;
  $('#torch').onclick = async () => { torch = !torch; if (!(await scanner.toggleTorch(torch))) { torch = false; toast('Este dispositivo no permite controlar la linterna', 'err'); } };
  document.addEventListener('visibilitychange', () => { if (document.hidden && scanner.running) $('#camStop').click(); });

  let flashT;
  function flash(html, err = false) {
    const f = $('#flash');
    f.className = 'flash' + (err ? ' err' : '');
    f.innerHTML = html;
    clearTimeout(flashT);
    flashT = setTimeout(() => f.classList.add('hidden'), 2600);
  }

  // ---------- Lectura de códigos ----------
  async function handleCode(code) {
    code = String(code).trim();
    if (!code) return;
    let p = findByCode(code);
    if (!p) { try { p = await api.get('/products/barcode/' + encodeURIComponent(code)); products.push(p); } catch {} }
    if (p) {
      beep(true);
      flash(`${thumb(p)}<div><div class="f-name">${esc(p.name)}</div><div class="muted small">${esc([p.brand, p.ml ? p.ml + ' ml' : ''].filter(Boolean).join(' · '))} · stock ${p.stock}</div></div><div class="f-price num">${fmt.money(priceOf(p))}</div>`);
      if (mode === 'sell') addToCart(p); else priceCheck(p);
      return;
    }
    // ¿Es una tarjeta de lealtad?
    try {
      const c = await api.get('/customers/card/' + encodeURIComponent(code));
      beep(true); setCustomer(c); flash(`<div class="cust-card"><div class="av">${esc(c.name[0])}</div><div class="info"><b>${esc(c.name)}</b><span class="muted small">Tarjeta ${esc(c.cardNumber)}</span></div></div><div class="f-price num">${balanceText(c)}</div>`);
      return;
    } catch {}
    beep(false);
    flash(`<div><div class="f-name">Código no registrado</div><div class="muted small num">${esc(code)}</div></div>`, true);
  }

  function priceCheck(p) {
    modal({
      body: `<div class="price-check"><div class="img">${ui.media(p, { lazy: false })}</div>
        <p class="eyebrow">${esc(p.brand || '')}</p><h2 style="margin:4px 0">${esc(p.name)}</h2>
        <p class="muted">${esc([p.category, p.family, p.ml ? p.ml + ' ml' : ''].filter(Boolean).join(' · '))}</p>
        ${p.offerPrice > 0 ? `<s class="muted">${fmt.money(p.price)}</s>` : ''}<div class="pc-price num">${fmt.money(priceOf(p))}</div>
        <p><span class="badge ${p.stock > 0 ? 'ok' : 'bad'}">${p.stock > 0 ? p.stock + ' en existencia' : 'Agotado'}</span> <span class="muted small num">${esc(p.barcode)}</span></p></div>`,
      actions: [{ label: 'Cerrar' }, { label: 'Agregar al carrito', cls: 'primary', onClick: () => addToCart(p) }],
    });
  }

  // ---------- Carrito ----------
  function addToCart(p, qty = 1) {
    const line = st.cart.find(l => l.id === p.id);
    const inCart = line ? line.qty : 0;
    if (inCart + qty > p.stock) { toast(p.stock <= 0 ? `${p.name} está agotado` : `Solo hay ${p.stock} de ${p.name}`, 'err'); return; }
    if (line) line.qty += qty; else st.cart.push({ id: p.id, qty });
    render();
    if (matchMedia('(min-width: 901px)').matches) $('#cart').scrollTop = $('#cart').scrollHeight;
  }
  function setCustomer(c) { st.customer = c; st.cashUse = 0; st.redeem = false; render(); }
  const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
  const LO = () => S.loyalty || {};
  // Texto corto del saldo del cliente según el modo de lealtad
  const balanceText = c => LO().mode === 'stamps' ? `${c.stamps}/${LO().stamps.goal} sellos` : fmt.money(c.cashback);

  // Mismo cálculo que hace el servidor (server.js → POST /sales)
  function totals() {
    const lo = LO(), c = st.customer, on = !!(c && lo.enabled);
    const lines = st.cart.map(l => ({ ...l, p: products.find(p => p.id === l.id) })).filter(l => l.p);
    const subtotal = r2(lines.reduce((a, l) => a + r2(priceOf(l.p) * l.qty), 0)); // igual que el servidor: redondeo por línea
    const discount = r2(Math.min(subtotal, Math.max(0, Number(st.discount) || 0)));
    const canRedeem = on && lo.mode === 'stamps' && c.stamps >= lo.stamps.goal;
    const rewardDiscount = canRedeem && st.redeem ? r2(Math.min(subtotal - discount, lo.stamps.rewardValue)) : 0;
    const canCash = on && lo.mode === 'cashback' && c.cashback > 0 && c.cashback >= (lo.cashback.minRedeem || 0);
    const maxCash = canCash ? r2(Math.min(c.cashback, subtotal - discount - rewardDiscount)) : 0;
    const cashbackUsed = r2(Math.min(maxCash, Math.max(0, Number(st.cashUse) || 0)));
    const total = r2(Math.max(0, subtotal - discount - rewardDiscount - cashbackUsed));
    const count = lines.reduce((a, l) => a + l.qty, 0);
    let earnText = '';
    if (on && lo.mode === 'cashback') { const e = r2(total * lo.cashback.percent / 100); if (e) earnText = `+${fmt.money(e)} cashback`; }
    if (on && lo.mode === 'stamps') {
      const s = lo.stamps;
      const n = s.earnBy === 'purchase' ? (total > 0 && total >= (s.minPurchase || 0) ? 1 : 0) : s.earnBy === 'amount' ? Math.floor(total / Math.max(1, s.amount)) : count;
      if (n) earnText = `+${n} sello${n === 1 ? '' : 's'}`;
    }
    return { lines, subtotal, discount, canRedeem, rewardDiscount, canCash, maxCash, cashbackUsed, total, earnText, count };
  }

  function render() {
    const t = totals();
    const lo = LO();
    // Cliente
    const c = st.customer;
    $('#cust').innerHTML = c
      ? `<div class="cust-card"><div class="av">${esc(c.name[0])}</div><div class="info"><b>${esc(c.name)}</b><span class="muted small">${esc(c.cardNumber)} · ${esc(c.tier || '')} · <span class="gold">${balanceText(c)}</span></span></div><button class="btn sm" id="custX">Quitar</button></div>`
        + (lo.mode === 'stamps' && lo.enabled ? `<div class="pos-stamps">${Stamps.grid(Math.min(c.stamps, lo.stamps.goal), lo.stamps.goal, lo.stamps.icon, { gold: S.colors?.gold, bg: '#141414', width: 360, height: lo.stamps.goal > 6 ? 80 : 46, transparent: true })}</div>` : '')
      : `<button class="btn sm block" id="custBtn">♦ Agregar tarjeta de lealtad</button>`;
    // Líneas
    $('#cart').innerHTML = t.lines.length ? t.lines.map(l => `<div class="line">${thumb(l.p)}
        <div><div class="l-name">${esc(l.p.name)}</div><div class="l-sub">${fmt.money(priceOf(l.p))} c/u${l.p.offerPrice > 0 ? ' · oferta' : ''}</div></div>
        <div class="l-right"><b class="num">${fmt.money(priceOf(l.p) * l.qty)}</b><div class="qty"><button data-dec="${l.id}" aria-label="Menos">−</button><span>${l.qty}</span><button data-inc="${l.id}" aria-label="Más">+</button></div></div></div>`).join('')
      : `<div class="cart-empty"><div style="font-size:34px;color:var(--gold)">⌁</div>Escanea un perfume o búscalo para empezar la venta</div>`;
    // Totales
    $('#totals').innerHTML = `
      <div class="row"><span class="muted">Subtotal (${t.count} pzas)</span><span class="num">${fmt.money(t.subtotal)}</span></div>
      <div class="row"><span class="muted">Descuento $</span><input class="input num" id="disc" type="number" min="0" step="1" value="${st.discount || ''}" placeholder="0"></div>
      ${t.canCash ? `<div class="row"><span class="muted">Usar cashback <small>(máx ${fmt.money(t.maxCash)})</small></span><span class="cash-use"><button type="button" class="btn sm" id="cashAll">Todo</button><input class="input num" id="cashUse" type="number" min="0" step="0.01" max="${t.maxCash}" value="${st.cashUse || ''}" placeholder="0"></span></div>` : ''}
      ${t.cashbackUsed ? `<div class="row"><span class="muted">Cashback</span><span class="num">−${fmt.money(t.cashbackUsed)}</span></div>` : ''}
      ${t.canRedeem ? `<label class="row redeem"><span><input type="checkbox" id="redeem" ${st.redeem ? 'checked' : ''}> Canjear recompensa<br><small class="muted">${esc(lo.stamps.rewardText)}</small></span><span class="num">${st.redeem ? '−' + fmt.money(t.rewardDiscount) : ''}</span></label>` : ''}
      <div class="row"><span>Total</span><span class="grand num">${fmt.money(t.total)}</span></div>
      ${c && t.earnText ? `<div class="row small"><span class="muted">El cliente gana</span><span class="gold">${t.earnText}</span></div>` : ''}`;
    $('#charge').disabled = !t.lines.length;
    $('#mbCharge').disabled = !t.lines.length;
    $('#mbCount').textContent = t.count;
    $('#mbTotal').textContent = fmt.money(t.total);
    saveCart();
  }

  // Delegación de eventos del panel derecho
  $('#cartPanel').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'custBtn') return pickCustomer();
    if (b.id === 'custX') return setCustomer(null);
    if (b.id === 'cashAll') { st.cashUse = totals().maxCash; return render(); }
    const id = b.dataset.inc || b.dataset.dec;
    if (!id) return;
    const l = st.cart.find(x => x.id === id);
    if (b.dataset.inc) { const p = products.find(x => x.id === id); return addToCart(p); }
    l.qty--; if (l.qty <= 0) st.cart = st.cart.filter(x => x !== l);
    render();
  });
  $('#cartPanel').addEventListener('change', e => {
    if (e.target.id === 'disc') { st.discount = Number(e.target.value) || 0; render(); }
    if (e.target.id === 'cashUse') { st.cashUse = Number(e.target.value) || 0; render(); }
    if (e.target.id === 'redeem') { st.redeem = e.target.checked; render(); }
  });
  $('#clear').onclick = () => { if (!st.cart.length || confirm('¿Vaciar el carrito?')) { st.cart = []; st.discount = 0; st.cashUse = 0; st.redeem = false; st.customer = null; render(); } };
  $('#mbCart').onclick = () => $('#cartPanel').classList.toggle('open');
  $('#cartClose').onclick = () => $('#cartPanel').classList.remove('open');
  $('#mbCharge').onclick = () => charge();
  $('#charge').onclick = () => charge();

  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify({ cart: st.cart, customerId: st.customer?.id || null, discount: st.discount })); } catch {} }
  async function restoreCart() {
    try {
      const d = JSON.parse(localStorage.getItem(CART_KEY) || 'null'); if (!d) return;
      st.cart = (d.cart || []).filter(l => products.some(p => p.id === l.id)); st.discount = d.discount || 0;
      if (d.customerId) { customers = await api.get('/customers'); st.customer = customers.find(c => c.id === d.customerId) || null; }
      render();
    } catch {}
  }

  // ---------- Búsqueda / lector USB ----------
  let sel = 0, matches = [];
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  $('#code').addEventListener('input', () => {
    const q = norm($('#code').value.trim());
    const box = $('#suggest');
    if (q.length < 2) { box.classList.add('hidden'); matches = []; return; }
    matches = products.filter(p => p.active !== false && norm([p.name, p.brand, p.barcode, p.sku].join(' ')).includes(q)).slice(0, 7);
    sel = 0;
    box.innerHTML = matches.map((p, i) => `<button type="button" data-id="${p.id}" class="${i === 0 ? 'on' : ''}">${thumb(p)}<span><b>${esc(p.name)}</b><br><small class="muted">${esc(p.brand || '')} · stock ${p.stock}</small></span><span class="s-price num">${fmt.money(priceOf(p))}</span></button>`).join('');
    box.classList.toggle('hidden', !matches.length);
  });
  $('#code').addEventListener('keydown', e => {
    if (!matches.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
      $$('#suggest button').forEach((b, i) => b.classList.toggle('on', i === sel));
    }
    if (e.key === 'Escape') $('#suggest').classList.add('hidden');
  });
  $('#suggest').onclick = e => { const b = e.target.closest('button'); if (!b) return; pick(products.find(p => p.id === b.dataset.id)); };
  $('#searchForm').onsubmit = e => {
    e.preventDefault();
    const v = $('#code').value.trim(); if (!v) return;
    const exact = findByCode(v);
    if (exact) { pick(exact, true); return; }
    if (matches.length && !$('#suggest').classList.contains('hidden')) { pick(matches[sel]); return; }
    handleCode(v); clearSearch();
  };
  function pick(p, viaCode) {
    if (viaCode) handleCode(p.barcode);
    else if (mode === 'sell') { addToCart(p); beep(true); } else priceCheck(p);
    clearSearch();
  }
  function clearSearch() { $('#code').value = ''; $('#suggest').classList.add('hidden'); matches = []; if (!isTouch) $('#code').focus(); }
  document.addEventListener('click', e => { if (!e.target.closest('.search')) $('#suggest').classList.add('hidden'); });

  // ---------- Accesos rápidos ----------
  function renderQuick() {
    const list = products.filter(p => p.active !== false).sort((a, b) => (b.featured - a.featured) || a.name.localeCompare(b.name));
    $('#quick').innerHTML = list.map(p => `<button class="q-item ${p.stock <= 0 ? 'out' : ''}" data-id="${p.id}">${thumb(p)}<b>${esc(p.name)}</b><span class="num">${fmt.money(priceOf(p))}</span></button>`).join('');
  }
  $('#quick').onclick = e => { const b = e.target.closest('.q-item'); if (!b) return; const p = products.find(x => x.id === b.dataset.id); mode === 'sell' ? addToCart(p) : priceCheck(p); };

  // ---------- Cliente / lealtad ----------
  async function pickCustomer() {
    customers = await api.get('/customers').catch(() => []);
    const m = modal({
      title: 'Tarjeta de lealtad',
      body: `<div class="toolbar"><button class="btn primary" id="cScan">⌁ Escanear tarjeta</button><button class="btn" id="cNew">+ Nueva tarjeta</button></div>
        <input class="input" id="cq" placeholder="Buscar por nombre, teléfono o número…" style="margin-top:12px">
        <div id="cl" style="margin-top:10px;display:flex;flex-direction:column;gap:6px;max-height:300px;overflow:auto"></div>`,
      actions: [{ label: 'Cerrar' }],
      onMount: el => {
        const draw = () => {
          const q = norm($('#cq', el).value);
          $('#cl', el).innerHTML = customers.filter(c => !q || norm([c.name, c.phone, c.cardNumber].join(' ')).includes(q)).slice(0, 30)
            .map(c => `<button class="btn" style="justify-content:space-between;border-radius:12px" data-id="${c.id}"><span>${esc(c.name)} <small class="muted">${esc(c.cardNumber)}</small></span><span class="gold">${balanceText(c)}</span></button>`).join('') || '<p class="muted">Sin resultados</p>';
        };
        draw();
        $('#cq', el).oninput = draw;
        $('#cl', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; setCustomer(customers.find(c => c.id === b.dataset.id)); m.close(); };
        $('#cScan', el).onclick = async () => {
          const code = await scanOnce('Escanear tarjeta');
          if (!code) return;
          try { setCustomer(await api.get('/customers/card/' + encodeURIComponent(code))); m.close(); toast('Cliente agregado'); } catch (e) { toast(e.message, 'err'); }
        };
        $('#cNew', el).onclick = () => { m.close(); newCustomer(); };
      },
    });
  }
  function newCustomer() {
    modal({
      title: 'Nueva tarjeta',
      body: `<form class="form-grid" id="nc" onsubmit="return false">
        <label class="field full"><span>Nombre *</span><input class="input" name="name" required></label>
        <label class="field"><span>Teléfono</span><input class="input" name="phone" type="tel"></label>
        <label class="field"><span>Tarjeta física (opcional)</span><div class="input-group"><input class="input" name="cardNumber" placeholder="Automático"><button type="button" class="btn" id="ncs">⌁</button></div></label>
      </form>`,
      onMount: el => { $('#ncs', el).onclick = async () => { const c = await scanOnce('Escanear tarjeta física'); if (c) $('[name=cardNumber]', el).value = c; }; },
      actions: [{ label: 'Cancelar' }, { label: 'Crear y usar', cls: 'primary', onClick: async m => {
        const f = $('#nc', m.el);
        const d = { name: $('[name=name]', f).value, phone: $('[name=phone]', f).value, cardNumber: $('[name=cardNumber]', f).value.trim() || undefined };
        const c = await api.post('/customers', d);
        setCustomer(c); toast(`Tarjeta ${c.cardNumber} creada`);
      } }],
    });
  }

  // Si el servidor rechaza por saldo/precio/programa cambiado, se recargan datos para mostrar lo real
  async function refreshState() {
    try {
      S = await api.get('/settings');
      await loadProducts();
      if (st.customer) { st.customer = await api.get('/customers/card/' + encodeURIComponent(st.customer.cardNumber)); st.cashUse = Math.min(st.cashUse, st.customer.cashback); }
      render();
    } catch {}
  }

  // ---------- Cobro ----------
  function charge() {
    const t = totals();
    if (!t.lines.length) return;
    let method = 'efectivo';
    const round = [t.total, Math.ceil(t.total / 50) * 50, Math.ceil(t.total / 100) * 100, Math.ceil(t.total / 500) * 500, Math.ceil(t.total / 1000) * 1000].filter((v, i, a) => a.indexOf(v) === i);
    modal({
      title: 'Cobrar',
      body: `<div class="big-total num">${fmt.money(t.total)}</div>
        <div class="methods" id="pm"><button class="on" data-m="efectivo"><i>💵</i>Efectivo</button><button data-m="tarjeta"><i>💳</i>Tarjeta</button><button data-m="transferencia"><i>⇄</i>Transferencia</button></div>
        <div id="cashBox" style="margin-top:16px">
          <label class="field"><span>Recibido</span><input class="input num" id="rec" type="number" min="0" step="0.5" value="${t.total}" inputmode="decimal" style="font-size:22px;text-align:center"></label>
          <div class="cash-quick" style="margin-top:8px">${round.map(v => `<button type="button" class="btn sm" data-v="${v}">${fmt.money(v)}</button>`).join('')}</div>
          <div class="change" id="chg"></div>
        </div>`,
      onMount: el => {
        const upd = () => { const r = Number($('#rec', el).value) || 0; const c = r - t.total; $('#chg', el).innerHTML = c >= 0 ? `Cambio: <b class="num">${fmt.money(c)}</b>` : `<span style="color:var(--bad)">Faltan ${fmt.money(-c)}</span>`; };
        upd();
        $('#rec', el).oninput = upd;
        $('.cash-quick', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; $('#rec', el).value = b.dataset.v; upd(); };
        $('#pm', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; method = b.dataset.m; $$('#pm button', el).forEach(x => x.classList.toggle('on', x === b)); $('#cashBox', el).classList.toggle('hidden', method !== 'efectivo'); };
        setTimeout(() => $('#rec', el).select(), 80);
      },
      actions: [{ label: 'Cancelar' }, { label: 'Confirmar venta', cls: 'primary', onClick: async m => {
        const received = method === 'efectivo' ? Number($('#rec', m.el).value) || 0 : t.total;
        if (method === 'efectivo' && received < t.total) throw new Error('El efectivo recibido no cubre el total');
        const sale = await api.post('/sales', { items: t.lines.map(l => ({ productId: l.id, qty: l.qty })), customerId: st.customer?.id, discount: t.discount, cashbackUsed: t.cashbackUsed, redeemReward: st.redeem && t.canRedeem, method, received, expectedTotal: t.total })
          .catch(async e => { await refreshState(); throw e; });
        st.cart = []; st.discount = 0; st.cashUse = 0; st.redeem = false; st.customer = null;
        $('#cartPanel').classList.remove('open');
        await loadProducts(); render();
        showTicket(sale);
      } }],
    });
  }
  function showTicket(sale) {
    modal({
      title: `Venta #${sale.folio} ✓`,
      body: `${sale.method === 'efectivo' && sale.change > 0 ? `<div class="change" style="margin:0 0 14px">Cambio: <b class="num">${fmt.money(sale.change)}</b></div>` : ''}${Tickets.ticketHtml(sale, S)}`,
      actions: [{ label: 'Imprimir', onClick: () => { Tickets.printTicket(sale, S); return false; } }, { label: 'Nueva venta', cls: 'primary', onClick: () => { if (!isTouch) $('#code').focus(); } }],
    });
  }

  // refresca existencias cada minuto
  setInterval(() => { if (!document.hidden) loadProducts().then(render).catch(() => {}); }, 60000);
  boot();
})();
