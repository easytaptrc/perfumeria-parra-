(function () {
  const { esc, applyTheme, toast, isCutout } = ui;
  const $ = s => document.querySelector(s);
  let S = {}, products = [], lastJson = '';
  const state = { cat: 'Todos', brand: '', q: '', sort: 'featured', avail: false, shown: 24 };
  const PAGE = 24;
  let openCard = null, openTimer = null;

  // Con el servidor de la tienda se leen los datos en vivo; publicado en GitHub Pages se usa catalogo.json
  let isStatic = false;
  async function loadCatalog() {
    if (!isStatic) {
      try { const r = await fetch('api/public/catalog', { cache: 'no-store' }); if (r.ok) return await r.json(); } catch {}
    }
    isStatic = true;
    const r = await fetch('catalogo.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('Sin catálogo');
    return r.json();
  }

  async function load(silent) {
    try {
      const r = await loadCatalog();
      const json = JSON.stringify(r);
      if (json === lastJson) return;
      lastJson = json;
      S = r.settings; products = r.products;
      applySettings();
      buildFilters();
      if (!document.querySelector('.vitrina.open')) render();
    } catch (e) { if (!silent) toast('No se pudo cargar el catálogo', 'err'); }
  }

  function applySettings() {
    applyTheme(S);
    document.title = `${S.storeName} · Catálogo`;
    $('#tagline').textContent = S.tagline || '';
    $('#heroTitle').textContent = S.heroTitle || '';
    $('#heroSubtitle').textContent = S.heroSubtitle || '';
    if (S.logo) $('#logo').src = S.logo;
    if (S.heroImage) $('#heroImg').src = S.heroImage;
    $('#footer').textContent = S.footer || '';
    const v = S.vitrina || {};
    document.body.className = `doors-${v.doors || 'double'} light-${v.light || 'warm'}`;
    document.documentElement.style.setProperty('--door-ms', (v.animation || 900) + 'ms');
    renderClub();
    const c = [];
    if (S.whatsapp) c.push(`<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${S.whatsapp.replace(/\D/g, '')}">WhatsApp</a>`);
    if (S.instagram) c.push(`<a class="btn" target="_blank" rel="noopener" href="https://instagram.com/${esc(S.instagram.replace('@', ''))}">Instagram</a>`);
    if (S.address) c.push(`<span class="btn" style="cursor:default">${esc(S.address)}</span>`);
    $('#contact').innerHTML = c.join('');
  }

  function buildFilters() {
    const cats = ['Todos', ...new Set(products.map(p => p.category).filter(Boolean))];
    $('#chips').innerHTML = cats.map(c => `<button class="chip ${c === state.cat ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    const brands = [...new Set(products.map(p => p.brand).filter(Boolean))].sort();
    $('#brand').innerHTML = `<option value="">Todas las marcas</option>` + brands.map(b => `<option ${b === state.brand ? 'selected' : ''}>${esc(b)}</option>`).join('');
  }

  const priceOf = p => (p.offerPrice > 0 ? p.offerPrice : p.price);
  function priceHtml(p) {
    if (!S.showPrices) return '';
    if (!(priceOf(p) > 0)) return '<span class="ask">Precio a consultar</span>';
    return p.offerPrice > 0 ? `<s>${fmt.money(p.price)}</s>${fmt.money(p.offerPrice)}` : fmt.money(p.price);
  }
  // Sin foto: una placa grabada con la marca y el nombre (en lugar de repetir el logo)
  const plate = p => `<div class="plate"><img src="${esc(S.logoIcon || 'assets/logo-icon.jpg')}" alt=""><span class="pl-brand">${esc(p.brand || S.storeName || '')}</span><span class="pl-name">${esc(p.name)}</span><i></i></div>`;
  const media = (p, o) => (p.image ? ui.media(p, o) : plate(p));
  const isPhoto = p => p.image && !isCutout(p.image);

  function filtered() {
    const q = state.q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let list = products.filter(p => {
      if (state.cat !== 'Todos' && p.category !== state.cat) return false;
      if (state.brand && p.brand !== state.brand) return false;
      if (state.avail && !p.available) return false;
      if (q) {
        const hay = [p.name, p.brand, p.family, p.category, p.notes?.top, p.notes?.heart, p.notes?.base].join(' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const by = {
      featured: (a, b) => (b.featured - a.featured) || (b.available - a.available) || a.name.localeCompare(b.name),
      // Sin precio al final al ordenar por precio
      'price-asc': (a, b) => (!(priceOf(a) > 0) - !(priceOf(b) > 0)) || priceOf(a) - priceOf(b),
      'price-desc': (a, b) => (!(priceOf(a) > 0) - !(priceOf(b) > 0)) || priceOf(b) - priceOf(a),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[state.sort]);
  }

  function render() {
    const all = filtered();
    const list = all.slice(0, state.shown);
    $('#empty').classList.toggle('hidden', all.length > 0);
    $('#count').textContent = all.length ? `${all.length} perfume${all.length === 1 ? '' : 's'}${state.avail ? ' disponibles' : ''}` : '';
    $('#more').classList.toggle('hidden', all.length <= state.shown);
    $('#more').textContent = `Ver más perfumes (${all.length - list.length})`;
    $('#gallery').innerHTML = list.map((p, i) => `
      <article class="vitrina" tabindex="0" role="button" aria-label="Abrir vitrina de ${esc(p.name)}" data-id="${p.id}" style="--i:${i % PAGE}">
        ${!p.available ? '<span class="ribbon out">Agotado</span>' : p.offerPrice > 0 ? '<span class="ribbon offer">Oferta</span>' : p.featured ? '<span class="ribbon">Destacado</span>' : ''}
        <div class="v-crown">${esc(p.brand || S.storeName)}</div>
        <div class="v-case">
          <div class="v-interior">
            <div class="v-floor"></div>
            <div class="v-shelf"></div>
            <div class="v-product ${isPhoto(p) ? 'photo' : ''}">${media(p)}</div>
          </div>
          <div class="v-door left"><i class="handle"></i></div>
          <div class="v-door right"><i class="handle"></i></div>
          <span class="v-lock"></span>
        </div>
        <div class="v-base">
          <h3>${esc(p.name)}</h3>
          <div class="meta">${esc([p.category, p.ml ? p.ml + ' ml' : ''].filter(Boolean).join(' · '))}</div>
          <div class="price num">${priceHtml(p)}</div>
        </div>
      </article>`).join('');
  }

  // ----- Abrir vitrina -----
  function toggle(card) {
    if (card.classList.contains('open')) { close(); return; }
    if (openCard && openCard !== card) openCard.classList.remove('open');
    card.classList.add('open');
    openCard = card;
    clearTimeout(openTimer);
    const ms = Math.min(1400, (S.vitrina?.animation || 900) * 0.85);
    openTimer = setTimeout(() => showDetail(card.dataset.id), ms);
  }
  function close() {
    clearTimeout(openTimer);
    $('#detail').classList.remove('open');
    if (openCard) { const c = openCard; setTimeout(() => c.classList.remove('open'), 180); openCard = null; }
  }

  function showDetail(id) {
    const p = products.find(x => x.id === id); if (!p) return;
    $('#dMedia').innerHTML = media(p, { lazy: false }) + (p.imageCredit ? `<span class="credit">${esc(p.imageCredit)}</span>` : '');
    $('#dMedia').classList.toggle('photo', !!isPhoto(p));
    $('#dBrand').textContent = p.brand || '';
    $('#dName').textContent = p.name;
    $('#dMeta').textContent = [p.family, p.category, p.ml ? p.ml + ' ml' : ''].filter(Boolean).join(' · ');
    $('#dPrice').innerHTML = S.showPrices ? priceHtml(p) : '';
    $('#dDesc').textContent = p.description || '';
    const n = p.notes || {};
    $('#dNotes').innerHTML = [['Salida', n.top], ['Corazón', n.heart], ['Fondo', n.base]].filter(x => x[1]).map(([k, v]) => `<div><b>${k}</b><span>${esc(v)}</span></div>`).join('');
    const avail = p.available ? `<span class="badge ok">Disponible${p.stock !== undefined ? ' · ' + p.stock + ' pzas' : ''}</span>` : '<span class="badge bad">Agotado</span>';
    const wa = S.whatsapp ? `<a class="btn primary" target="_blank" rel="noopener" href="https://wa.me/${S.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa el perfume ${p.name}${p.brand ? ' de ' + p.brand : ''}.`)}">Lo quiero · WhatsApp</a>` : '';
    $('#dActions').innerHTML = avail + wa;
    $('#detail').classList.add('open');
    $('#dClose').focus({ preventScroll: true });
  }

  // ----- Eventos -----
  $('#gallery').addEventListener('click', e => { const c = e.target.closest('.vitrina'); if (c) toggle(c); });
  $('#gallery').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.vitrina')) { e.preventDefault(); toggle(e.target); } });
  $('#dClose').addEventListener('click', close);
  $('#detail').addEventListener('click', e => { if (e.target.id === 'detail') close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  const reset = () => { state.shown = PAGE; render(); };
  $('#chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; state.cat = b.dataset.cat; buildFilters(); reset(); });
  $('#brand').addEventListener('change', e => { state.brand = e.target.value; reset(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; reset(); });
  $('#avail').addEventListener('change', e => { state.avail = e.target.checked; reset(); });
  $('#more').addEventListener('click', () => { state.shown += PAGE; render(); });
  let qt; $('#q').addEventListener('input', e => { clearTimeout(qt); qt = setTimeout(() => { state.q = e.target.value.trim(); reset(); }, 150); });

  // ----- Club de lealtad -----
  function renderClub() {
    const lo = S.loyalty || {};
    $('#club').classList.toggle('hidden', !lo.enabled);
    $('#navClub').classList.toggle('hidden', !lo.enabled);
    if (!lo.enabled) return;
    $('#navClub').textContent = lo.programName || 'Club';
    $$('.club-name').forEach(el => { el.textContent = lo.programName || 'Club Parra'; });
    const earn = { item: 'por cada perfume que compras', purchase: 'en cada compra', amount: `por cada ${fmt.money(lo.amount)} de compra` }[lo.earnBy] || '';
    const walletTxt = lo.appleWallet && lo.googleWallet ? ' y se guarda en Apple Wallet o Google Wallet' : lo.appleWallet ? ' y se guarda en Apple Wallet' : lo.googleWallet ? ' y se guarda en Google Wallet' : '';
    // Publicado sin servidor (GitHub Pages) no se puede consultar saldo ni registrarse en línea
    $('#clubJoin').classList.toggle('hidden', !lo.signup || isStatic);
    $('#cardForm').classList.toggle('hidden', isStatic);
    $('#cardHelp').textContent = isStatic ? 'Pide tu tarjeta en la tienda; ahí te registramos y la recibes en tu celular.' : 'Consulta tu saldo con tu número de tarjeta y los últimos 4 dígitos de tu teléfono.';
    $('#clubTitle').textContent = lo.mode === 'stamps' ? 'Junta sellos, gana perfumes' : `${lo.percent}% de regreso en cada compra`;
    $('#clubText').textContent = lo.mode === 'stamps'
      ? `Recibe un sello ${earn}. Al completar ${lo.goal} sellos te llevas: ${lo.rewardText}. Tu tarjeta vive en tu celular${walletTxt}.`
      : `Cada compra te regresa ${lo.percent}% como saldo en tu monedero para tu siguiente fragancia. Tu tarjeta vive en tu celular${walletTxt}.`;
    $('#clubVisual').innerHTML = lo.mode === 'stamps'
      ? Stamps.grid(Math.ceil(lo.goal * 0.6), lo.goal, lo.stampIcon || lo.icon, { gold: lo.card?.accent || S.colors?.gold, bg: lo.card?.bg || '#0b0a08', width: 300, height: lo.goal > 6 ? 110 : 60, transparent: true })
      : `<span class="club-balance num">${fmt.money(1250)}</span><span class="muted small">Saldo de ejemplo</span>`;
  }
  const $$ = s => [...document.querySelectorAll(s)];

  $('#cardForm').addEventListener('submit', async e => {
    e.preventDefault();
    const box = $('#cardResult');
    box.classList.remove('hidden');
    try {
      const r = await fetch('api/public/card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardNumber: $('#cardInput').value, phone4: $('#phone4').value }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const lo = d.loyalty;
      box.innerHTML = `<div class="muted">Hola, ${esc(d.name)} · Nivel <b class="gold">${esc(d.tier)}</b></div>` + (lo.mode === 'stamps'
        ? `<div class="pts num">${d.stamps} de ${lo.goal} sellos</div>${Stamps.grid(Math.min(d.stamps, lo.goal), lo.goal, lo.stampIcon || lo.icon, { gold: S.colors?.gold, bg: '#0b0a08', width: 300, height: lo.goal > 6 ? 100 : 56, transparent: true })}`
        : `<div class="pts num">${fmt.money(d.cashback)}</div><div class="muted small">Saldo disponible en tu monedero</div>`);
    } catch (err) { box.innerHTML = `<span class="muted">${esc(err.message || 'Tarjeta no encontrada')}</span>`; }
  });

  load();
  setInterval(() => load(true), 30000); // refleja cambios del admin sin recargar
})();
