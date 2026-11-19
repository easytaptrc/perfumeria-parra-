// Tarjeta de lealtad visual (admin, tarjeta digital del cliente y registro) + vistas previas de Apple/Google Wallet.
(function () {
  const { esc } = ui;
  const DEF = { bg: '#0b0a08', text: '#efe8da', accent: '#c9a75e', bgImage: '', codeType: 'qr' };
  const style = card => {
    const c = { ...DEF, ...(card || {}) };
    return `--lc-bg:${c.bg};--lc-text:${c.text};--lc-accent:${c.accent};${c.bgImage ? `--lc-img:url('${encodeURI(c.bgImage)}');` : ''}`;
  };

  // lo: { programName, mode, goal, percent, stampIcon, card }  ·  c: { name, cardNumber, cashback, stamps, tier }
  function html(c, lo, { logoIcon = 'assets/logo-icon.jpg', hello = false, extra = '' } = {}) {
    const card = { ...DEF, ...(lo.card || {}) };
    const st = lo.mode === 'stamps';
    const body = st
      ? `<div class="lc-stamps">${Stamps.grid(Math.min(c.stamps || 0, lo.goal), lo.goal, lo.stampIcon || 'bottle', { gold: card.accent, bg: card.bg, width: 360, height: lo.goal > 6 ? 128 : 72, transparent: true })}</div>`
      : `<div class="lc-balance"><div class="lbl">Saldo en tu monedero</div><div class="amt num">${fmt.money(c.cashback || 0)}</div></div>`;
    return `<div class="lcard ${card.bgImage ? 'has-img' : ''}" style="${style(card)}">
      <div class="lc-top"><img src="${esc(logoIcon)}" alt=""><div class="prog">${hello ? `<span class="eyebrow">Hola, ${esc(String(c.name || '').split(' ')[0])}</span>` : ''}<b>${esc(lo.programName || 'Club')}</b></div>${c.tier ? `<span class="tier">${esc(c.tier)}</span>` : ''}</div>
      ${body}${extra}
      <div class="lc-name"><span>${esc(c.name || '')}</span><span class="num">${st ? `${c.stamps || 0}/${lo.goal}` : esc(c.cardNumber || '')}</span></div>
    </div>`;
  }

  // Código para caja (QR o código de barras) — necesita qrcode.js / JsBarcode
  function code(value, codeType, size = 200) {
    if (codeType === 'code128' && window.JsBarcode) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      try { JsBarcode(svg, value, { format: 'CODE128', height: 70, displayValue: false, margin: 8 }); } catch {}
      return svg.outerHTML;
    }
    return ui.qrSvg(value, { size });
  }

  // Vista previa aproximada del pase de Apple Wallet
  function appleMock(c, lo, { storeName = '', logo = '' } = {}) {
    const card = { ...DEF, ...(lo.card || {}) }, st = lo.mode === 'stamps';
    const left = Math.max(0, lo.goal - (c.stamps || 0));
    const strip = st
      ? Stamps.grid(Math.min(c.stamps || 0, lo.goal), lo.goal, lo.stampIcon || 'bottle', { gold: card.accent, bg: card.bg, width: 375, height: 123, transparent: true })
      : `<div class="am-bal"><small style="color:${card.accent}">SALDO CASHBACK</small><b>${fmt.money(c.cashback || 0)}</b></div>`;
    return `<div class="wmock apple" style="${style(card)}">
      <div class="am-head"><img src="${esc(logo)}" alt=""><div class="am-hf"><small style="color:${card.accent}">${st ? 'SELLOS' : 'NIVEL'}</small><b>${st ? `${c.stamps || 0}/${lo.goal}` : esc(c.tier || '')}</b></div></div>
      <div class="am-strip ${card.bgImage ? 'img' : ''}">${strip}</div>
      <div class="am-fields"><div><small style="color:${card.accent}">CLIENTE</small><b>${esc(c.name || '')}</b></div><div><small style="color:${card.accent}">${st ? (left ? 'TE FALTAN' : 'RECOMPENSA') : 'GANAS'}</small><b>${st ? (left ? `${left} sellos` : '¡Lista!') : `${lo.percent}%`}</b></div></div>
      <div class="am-code">${code(c.cardNumber || 'PP100001', card.codeType, 110)}<small>${esc(c.cardNumber || '')}</small></div>
      <div class="wm-label">Apple Wallet · ${esc(storeName)}</div>
    </div>`;
  }

  // Vista previa aproximada de la tarjeta en Google Wallet
  function googleMock(c, lo, { storeName = '', logoIcon = '' } = {}) {
    const card = { ...DEF, ...(lo.card || {}) }, st = lo.mode === 'stamps';
    const hero = st
      ? Stamps.grid(Math.min(c.stamps || 0, lo.goal), lo.goal, lo.stampIcon || 'bottle', { gold: card.accent, bg: card.bg, width: 375, height: 123, transparent: true })
      : '';
    return `<div class="wmock google" style="${style(card)}">
      <div class="gm-head"><img src="${esc(logoIcon)}" alt=""><span>${esc(storeName)}</span></div>
      <div class="gm-prog">${esc(lo.programName || '')}</div>
      <div class="gm-fields"><div><small>${st ? 'Sellos' : 'Saldo cashback'}</small><b>${st ? `${c.stamps || 0}/${lo.goal}` : fmt.money(c.cashback || 0)}</b></div><div><small>${st ? 'Te faltan' : 'Nivel'}</small><b>${st ? Math.max(0, lo.goal - (c.stamps || 0)) : esc(c.tier || '—')}</b></div></div>
      <div class="gm-code">${code(c.cardNumber || 'PP100001', card.codeType, 110)}<small>${esc(c.cardNumber || '')}</small></div>
      <div class="gm-hero ${card.bgImage ? 'img' : ''}">${hero}</div>
      <div class="wm-label">Google Wallet</div>
    </div>`;
  }

  window.LoyaltyCard = { html, code, appleMock, googleMock, style, DEF };
})();
