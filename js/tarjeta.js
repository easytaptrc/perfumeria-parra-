// Tarjeta digital del cliente: saldo/sellos en vivo, QR para caja y botón de Apple Wallet.
(function () {
  const { esc, applyTheme, qrSvg } = ui;
  const app = document.getElementById('app');
  const tok = (location.pathname.match(/^\/t\/([a-f0-9]{24})/) || [])[1];
  let last = '';

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const walletIcon = `<svg viewBox="0 0 30 22" aria-hidden="true"><rect x="1" y="1" width="28" height="20" rx="4" fill="#fff"/><rect x="1" y="5" width="28" height="4" fill="#ff9f0a"/><rect x="1" y="9" width="28" height="4" fill="#30d158"/><rect x="1" y="13" width="28" height="4" fill="#0a84ff"/><path d="M1 15h9c1.5 0 2 2.5 5 2.5s3.5-2.5 5-2.5h9v4a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" fill="#1c1c1e"/></svg>`;

  async function load() {
    if (!tok) { app.innerHTML = '<p class="loading">Enlace de tarjeta inválido.</p>'; return; }
    let d;
    try {
      const r = await fetch('/api/public/wallet/' + tok, { cache: 'no-store' });
      d = await r.json();
      if (!r.ok) throw new Error(d.error);
    } catch (e) { if (!last) app.innerHTML = `<p class="loading">${esc(e.message || 'No se pudo cargar tu tarjeta')}</p>`; return; }
    const json = JSON.stringify(d);
    if (json === last) return;
    const changed = !!last;
    last = json;
    render(d, changed);
  }

  function render(d, changed) {
    const { customer: c, store: s, loyalty: lo } = d;
    applyTheme(s);
    document.title = `${lo.programName} · ${s.storeName}`;
    document.getElementById('manifest').href = `/t/${tok}/manifest.webmanifest`;
    const gold = s.colors?.gold || '#c9a75e';
    const first = esc(c.name.split(' ')[0]);
    let body;
    if (lo.mode === 'stamps') {
      const left = Math.max(0, lo.goal - c.stamps);
      body = `<div class="lc-stamps">${Stamps.grid(Math.min(c.stamps, lo.goal), lo.goal, lo.icon, { gold, bg: '#0b0a08', width: 360, height: lo.goal > 6 ? 130 : 74, transparent: true })}</div>
        <div class="lc-next">${left ? `Te ${left === 1 ? 'falta' : 'faltan'} <b>${left} sello${left === 1 ? '' : 's'}</b> para: ${esc(lo.rewardText)}` : `<b>¡Completaste tu tarjeta!</b> Canjea en caja: ${esc(lo.rewardText)}`}</div>
        <div class="lc-name"><span>${esc(c.name)}</span><span class="num">${c.stamps}/${lo.goal}</span></div>`;
    } else {
      body = `<div class="lc-balance"><div class="lbl">Saldo en tu monedero</div><div class="amt num">${fmt.money(c.cashback)}</div></div>
        <div class="lc-next">Ganas <b>${lo.percent}%</b> de regreso en cada compra${lo.minRedeem ? ` · úsalo desde ${fmt.money(lo.minRedeem)}` : ''}</div>
        <div class="lc-name"><span>${esc(c.name)}</span><span class="num">${esc(c.cardNumber)}</span></div>`;
    }
    const walletBlock = d.appleWallet
      ? `<a class="wallet-btn" href="/api/public/wallet/${tok}/pass">${walletIcon} Agregar a Apple Wallet</a>`
      : (isIOS && !standalone ? `<div class="hint"><b>Guárdala en tu iPhone:</b> toca <b>Compartir</b> <span aria-hidden="true">⎋</span> y luego <b>“Agregar a pantalla de inicio”</b>. Tu saldo se actualiza solo cada vez que la abres.</div>` : '');
    const hist = (c.history || []).map(h => {
      const isCash = h.kind === 'cashback';
      const v = isCash ? fmt.money(Math.abs(h.amount)) : `${Math.abs(h.amount)} sello${Math.abs(h.amount) === 1 ? '' : 's'}`;
      return `<div><span>${esc(h.note)}<small>${fmt.day(h.date)}</small></span><span class="${h.amount >= 0 ? 'plus' : 'minus'}">${h.amount >= 0 ? '+' : '−'}${v}</span></div>`;
    }).join('');
    app.innerHTML = `
      <div class="store"><img src="${esc(s.logo)}" alt="${esc(s.storeName)}"></div>
      <section class="lcard ${changed ? 'pulse' : ''}">
        <div class="lc-top"><img src="${esc(s.logoIcon)}" alt=""><div class="prog"><span class="eyebrow">Hola, ${first}</span><b>${esc(lo.programName)}</b></div>${c.tier ? `<span class="tier">${esc(c.tier)}</span>` : ''}</div>
        ${body}
      </section>
      <section class="qr-box">
        ${qrSvg(c.cardNumber, { size: 210 })}
        <span class="code">${esc(c.cardNumber)}</span>
        <small>Muestra este código en caja para ${lo.mode === 'stamps' ? 'sumar sellos' : 'ganar y usar tu saldo'}</small>
      </section>
      ${walletBlock}
      ${hist ? `<h3 class="section-t">Movimientos</h3><div class="hist">${hist}</div>` : ''}
      <p class="updated">Actualizado ${new Date(c.updatedAt).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      <div class="foot">
        <div class="row">
          ${s.whatsapp ? `<a class="btn sm" href="https://wa.me/${esc(s.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
          ${s.instagram ? `<a class="btn sm" href="https://instagram.com/${esc(s.instagram.replace('@', ''))}" target="_blank" rel="noopener">Instagram</a>` : ''}
          <a class="btn sm" href="/">Ver catálogo</a>
        </div>
        ${s.address ? `<span>${esc(s.address)}</span>` : ''}
      </div>`;
  }

  load();
  setInterval(() => { if (!document.hidden) load(); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
})();
