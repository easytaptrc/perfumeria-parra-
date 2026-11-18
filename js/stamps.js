// Íconos de sellos para la tarjeta de lealtad.
// Se usa en el navegador (window.Stamps) y en el servidor (require) para la imagen del pase de Apple Wallet.
(function (root) {
  const ICONS = {
    bottle: { label: 'Frasco', svg: (fg, bg) => `<rect x="9" y="2" width="6" height="4" rx="1" fill="${fg}"/><rect x="7.5" y="6" width="9" height="1.4" rx=".5" fill="${fg}"/><rect x="10.5" y="7.4" width="3" height="1.8" fill="${fg}"/><rect x="5" y="9" width="14" height="13" rx="3" fill="${fg}"/><rect x="8.2" y="12.4" width="7.6" height="6.2" rx="1" fill="none" stroke="${bg}" stroke-width="1"/>` },
    drop: { label: 'Gota', svg: (fg, bg) => `<path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z" fill="${fg}"/><path d="M9 15a3 3 0 0 0 3 3" fill="none" stroke="${bg}" stroke-width="1.2" stroke-linecap="round"/>` },
    flower: { label: 'Flor', svg: (fg, bg) => `<circle cx="12" cy="6.6" r="3.6" fill="${fg}"/><circle cx="17.2" cy="10.4" r="3.6" fill="${fg}"/><circle cx="15.2" cy="16.5" r="3.6" fill="${fg}"/><circle cx="8.8" cy="16.5" r="3.6" fill="${fg}"/><circle cx="6.8" cy="10.4" r="3.6" fill="${fg}"/><circle cx="12" cy="12.2" r="2.4" fill="${bg}"/>` },
    diamond: { label: 'Diamante', svg: (fg, bg) => `<path d="M6 3.5h12l4 5.5-10 12-10-12z" fill="${fg}"/><path d="M2 9h20M9 3.5 12 9l3-5.5M7.5 9 12 21l4.5-12" fill="none" stroke="${bg}" stroke-width=".9" stroke-linejoin="round"/>` },
    star: { label: 'Estrella', svg: fg => `<path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" fill="${fg}"/>` },
    crown: { label: 'Corona', svg: (fg, bg) => `<path d="M3 17.5 2 7l5.5 4.5L12 4l4.5 7.5L22 7l-1 10.5z" fill="${fg}"/><rect x="3" y="18.8" width="18" height="2.4" rx=".7" fill="${fg}"/><circle cx="12" cy="13.5" r="1.4" fill="${bg}"/>` },
  };

  function icon(name, fg, bg, size = 24) {
    const ic = ICONS[name] || ICONS.bottle;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">${ic.svg(fg, bg)}</svg>`;
  }

  // Tarjeta de sellos: círculos llenos (ganados) y vacíos (pendientes)
  function grid(count, goal, name, opts = {}) {
    const gold = opts.gold || '#c9a75e', bg = opts.bg || '#0b0b0b';
    const W = opts.width || 375, H = opts.height || 123;
    goal = Math.max(1, Math.min(20, goal | 0));
    count = Math.max(0, count | 0);
    const rows = goal <= 6 ? 1 : 2;
    const cols = Math.ceil(goal / rows);
    const cell = Math.min((W - 24) / cols, (H - 16) / rows);
    const r = cell * 0.40;
    const offX = (W - cols * cell) / 2, offY = (H - rows * cell) / 2;
    const ic = ICONS[name] || ICONS.bottle;
    let out = '';
    for (let i = 0; i < goal; i++) {
      const row = Math.floor(i / cols), col = i % cols;
      const cx = offX + col * cell + cell / 2, cy = offY + row * cell + cell / 2;
      const on = i < count;
      const s = r * 1.15 / 12; // escala del ícono 24px
      const last = i === goal - 1;
      out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${on ? gold : 'none'}" stroke="${gold}" stroke-width="${on ? 0 : 1.4}" stroke-opacity="${on ? 1 : 0.55}" ${!on && last ? `stroke-dasharray="3 3"` : ''}/>`;
      out += `<g transform="translate(${cx - 12 * s} ${cy - 12 * s}) scale(${s})" opacity="${on ? 1 : 0.28}">${ic.svg(on ? bg : gold, on ? gold : bg)}</g>`;
    }
    const bgRect = opts.transparent ? '' : `<rect width="${W}" height="${H}" fill="${bg}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${bgRect}${out}</svg>`;
  }

  const api = { ICONS, icon, grid };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Stamps = api;
})(typeof window !== 'undefined' ? window : globalThis);
