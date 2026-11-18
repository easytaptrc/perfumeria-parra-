// Ticket de venta (compartido entre admin y punto de venta)
(function () {
  const { esc } = ui;
  function ticketHtml(s, st) {
    return `<div class="ticket">
      <h4>${esc(st.ticket?.header || st.storeName)}</h4>
      <div class="c">${esc(st.address || '')}</div>
      <hr><div class="row"><span>Folio #${s.folio}</span><span>${new Date(s.date).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
      <div>Atendió: ${esc(s.userName)}</div>${s.customerName ? `<div>Cliente: ${esc(s.customerName)}</div>` : ''}<hr>
      ${s.items.map(i => `<div>${esc(i.name)}</div><div class="row"><span>${i.qty} × ${fmt.money(i.price)}</span><span>${fmt.money(i.total)}</span></div>`).join('')}
      <hr><div class="row"><span>Subtotal</span><span>${fmt.money(s.subtotal)}</span></div>
      ${s.discount ? `<div class="row"><span>Descuento</span><span>-${fmt.money(s.discount)}</span></div>` : ''}
      ${s.rewardDiscount ? `<div class="row"><span>Recompensa (${s.stampsRedeemed} sellos)</span><span>-${fmt.money(s.rewardDiscount)}</span></div>` : ''}
      ${s.cashbackUsed ? `<div class="row"><span>Saldo cashback usado</span><span>-${fmt.money(s.cashbackUsed)}</span></div>` : ''}
      <div class="row tot"><span>TOTAL</span><span>${fmt.money(s.total)}</span></div>
      <div class="row"><span>Pago (${esc(s.method)})</span><span>${fmt.money(s.method === 'efectivo' ? s.received : s.total)}</span></div>
      ${s.method === 'efectivo' ? `<div class="row"><span>Cambio</span><span>${fmt.money(s.change)}</span></div>` : ''}
      ${s.customerName ? `<hr><div>Tarjeta ${esc(s.cardNumber || '')}</div>${s.loyaltyMode === 'stamps'
        ? `<div class="row"><span>Sellos ganados</span><span>+${s.stampsEarned}</span></div><div class="row"><span>Tus sellos</span><span>${s.customerStamps}/${s.stampsGoal}</span></div>`
        : `<div class="row"><span>Cashback ganado</span><span>+${fmt.money(s.cashbackEarned)}</span></div><div class="row"><span>Saldo en monedero</span><span>${fmt.money(s.customerCashback)}</span></div>`}` : ''}
      <hr><div class="c">${esc(st.ticket?.footer || '')}</div>${s.status === 'cancelada' ? '<div class="c"><b>*** CANCELADA ***</b></div>' : ''}
    </div>`;
  }
  function printTicket(s, st) {
    let pa = document.getElementById('printArea');
    if (!pa) { pa = document.createElement('div'); pa.id = 'printArea'; document.body.appendChild(pa); }
    pa.innerHTML = ticketHtml(s, st);
    window.print();
  }
  window.Tickets = { ticketHtml, printTicket };
})();
