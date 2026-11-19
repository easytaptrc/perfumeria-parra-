// Registro de clientes al club de lealtad (se abre con el QR de la tienda)
(function () {
  const { esc, applyTheme } = ui;
  const $ = s => document.querySelector(s);
  let S = null;

  async function load() {
    try {
      const res = await fetch('api/public/catalog', { cache: 'no-store' }).catch(() => null);
      if (!res || !res.ok) {
        // Sin servidor (GitHub Pages): no hay dónde guardar el registro
        $('.club-join').innerHTML = '<h1 class="serif">Únete al club</h1><p class="muted">Pide tu tarjeta de lealtad en la tienda. Ahí te registramos y la recibes en tu celular.</p><a class="btn" href="./">Ver catálogo</a>';
        return;
      }
      S = (await res.json()).settings;
    } catch { $('#pitch').textContent = 'No se pudo cargar. Revisa tu conexión.'; return; }
    applyTheme(S);
    if (S.logo) $('#logo').src = S.logo;
    const lo = S.loyalty || {};
    document.title = `${lo.programName || 'Club'} · ${S.storeName}`;
    if (!lo.enabled || !lo.signup) {
      $('.club-join').innerHTML = `<h1 class="serif">${esc(lo.programName || 'Club')}</h1><p class="muted">El registro en línea no está disponible por ahora. Pide tu tarjeta en la tienda.</p><a class="btn" href="./">Ver catálogo</a>`;
      return;
    }
    $('#title').textContent = `Únete a ${lo.programName}`;
    const earn = { item: 'por cada perfume', purchase: 'en cada compra', amount: `por cada ${fmt.money(lo.amount)}` }[lo.earnBy] || '';
    $('#pitch').textContent = lo.mode === 'stamps'
      ? `Gana un sello ${earn}. Al juntar ${lo.goal} te llevas: ${lo.rewardText}. Tu tarjeta vive en tu celular${lo.appleWallet || lo.googleWallet ? ' y se guarda en tu Wallet' : ''}.`
      : `Recibe ${lo.percent}% de regreso en cada compra como saldo para tu siguiente perfume. Tu tarjeta vive en tu celular${lo.appleWallet || lo.googleWallet ? ' y se guarda en tu Wallet' : ''}.`;
    $('#preview').innerHTML = LoyaltyCard.html({ name: 'Tu nombre', cardNumber: 'PP ••••••', cashback: 0, stamps: lo.mode === 'stamps' ? Math.ceil(lo.goal / 3) : 0 }, lo, { logoIcon: S.logoIcon });
  }

  $('#f').addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    $('#err').classList.add('hidden');
    $('#go').disabled = true; $('#go').textContent = 'Creando tu tarjeta…';
    try {
      const r = await fetch('api/public/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fd) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo registrar');
      location.href = 't/' + d.token;
    } catch (err) {
      $('#err').textContent = err.message; $('#err').classList.remove('hidden');
      $('#go').disabled = false; $('#go').textContent = 'Obtener mi tarjeta';
    }
  });
  load();
})();
