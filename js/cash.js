// Caja: apertura, entradas/salidas de efectivo y corte. Compartido por el admin y el punto de venta.
// Cada pantalla pasa su propia función modal({ title, body, actions, onMount }).
(function () {
  const { esc, toast } = ui;
  const $ = (s, r = document) => r.querySelector(s);
  const M = n => fmt.money(n);

  function summaryRows(cs) {
    const s = cs.summary;
    const rows = [
      ['Fondo inicial', M(cs.openingCash)],
      ['Ventas en efectivo', M(s.cash)],
      ['Entradas de efectivo', M(s.ins)],
      ['Salidas de efectivo', '−' + M(s.outs)],
    ];
    return `<table class="t cash-t">${rows.map(([a, b]) => `<tr><td>${a}</td><td class="r num">${b}</td></tr>`).join('')}
      <tr class="tot"><td><b>Efectivo esperado en caja</b></td><td class="r num gold"><b>${M(s.expectedCash)}</b></td></tr>
      ${s.counted !== undefined ? `<tr><td>Efectivo contado</td><td class="r num">${M(s.counted)}</td></tr>
        <tr><td><b>Diferencia</b></td><td class="r num"><b class="${s.difference < 0 ? 'dneg' : s.difference > 0 ? 'dpos' : ''}">${s.difference > 0 ? '+' : ''}${M(s.difference)}</b>${s.difference ? ` <span class="badge ${s.difference < 0 ? 'bad' : 'warn'}">${s.difference < 0 ? 'faltante' : 'sobrante'}</span>` : ' <span class="badge ok">cuadra</span>'}</td></tr>` : ''}
    </table>
    <div class="cash-kpis">
      <div><span>Ventas</span><b class="num">${s.sales}</b></div>
      <div><span>Total vendido</span><b class="num">${M(s.total)}</b></div>
      <div><span>Tarjeta</span><b class="num">${M(s.card)}</b></div>
      <div><span>Transferencia</span><b class="num">${M(s.transfer)}</b></div>
    </div>`;
  }

  function movementsHtml(cs) {
    if (!cs.movements?.length) return '';
    return `<h4 class="cash-h">Entradas y salidas</h4><table class="t">${cs.movements.map(m => `<tr><td class="small muted">${fmt.date(m.date)}</td><td class="small">${esc(m.note)} <span class="muted">· ${esc(m.user)}</span></td><td class="r num ${m.type === 'out' ? '' : 'gold'}">${m.type === 'out' ? '−' : '+'}${M(m.amount)}</td></tr>`).join('')}</table>`;
  }

  // Ticket del corte (80 mm)
  function corteHtml(cs, S) {
    const s = cs.summary;
    return `<div class="ticket">
      <h4>${esc(S.ticket?.header || S.storeName)}</h4>
      <div class="c"><b>${cs.closedAt ? 'CORTE DE CAJA' : 'CORTE PARCIAL (caja abierta)'} #${cs.number}</b></div><hr>
      <div class="row"><span>Apertura</span><span>${new Date(cs.openedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
      <div>Abrió: ${esc(cs.openedBy)}</div>
      ${cs.closedAt ? `<div class="row"><span>Cierre</span><span>${new Date(cs.closedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</span></div><div>Cerró: ${esc(cs.closedBy)}</div>` : ''}
      <hr>
      <div class="row"><span>Ventas (${s.sales})</span><span>${M(s.total)}</span></div>
      <div class="row"><span>  Efectivo</span><span>${M(s.cash)}</span></div>
      <div class="row"><span>  Tarjeta</span><span>${M(s.card)}</span></div>
      <div class="row"><span>  Transferencia</span><span>${M(s.transfer)}</span></div>
      ${s.cancelled ? `<div class="row"><span>Canceladas</span><span>${s.cancelled}</span></div>` : ''}
      ${s.discounts ? `<div class="row"><span>Descuentos y canjes</span><span>${M(s.discounts)}</span></div>` : ''}
      <hr>
      <div class="row"><span>Fondo inicial</span><span>${M(cs.openingCash)}</span></div>
      <div class="row"><span>+ Ventas efectivo</span><span>${M(s.cash)}</span></div>
      <div class="row"><span>+ Entradas</span><span>${M(s.ins)}</span></div>
      <div class="row"><span>− Salidas</span><span>${M(s.outs)}</span></div>
      <div class="row tot"><span>ESPERADO</span><span>${M(s.expectedCash)}</span></div>
      ${s.counted !== undefined ? `<div class="row"><span>Contado</span><span>${M(s.counted)}</span></div><div class="row tot"><span>DIFERENCIA</span><span>${M(s.difference)}</span></div>` : ''}
      ${(cs.movements || []).length ? '<hr>' + cs.movements.map(m => `<div class="row"><span>${m.type === 'out' ? 'Salida' : 'Entrada'}: ${esc(m.note)}</span><span>${M(m.amount)}</span></div>`).join('') : ''}
      ${cs.closeNote ? `<hr><div>Nota: ${esc(cs.closeNote)}</div>` : ''}
      <br><br><div class="c">______________________</div><div class="c">Firma</div>
    </div>`;
  }
  function printCorte(cs, S) {
    let pa = document.getElementById('printArea');
    if (!pa) { pa = document.createElement('div'); pa.id = 'printArea'; document.body.appendChild(pa); }
    pa.innerHTML = corteHtml(cs, S);
    window.print();
  }

  // ---------- Formularios ----------
  function openForm(modal, onDone) {
    modal({
      title: 'Abrir caja',
      body: `<p class="muted" style="margin-top:0">Cuenta el efectivo con el que inicias el día (fondo para dar cambio).</p>
        <label class="field"><span>Fondo inicial en efectivo</span><input class="input num" id="cOpen" type="number" min="0" step="0.5" inputmode="decimal" placeholder="0.00" style="font-size:22px;text-align:center"></label>
        <label class="field" style="margin-top:10px"><span>Nota (opcional)</span><input class="input" id="cOpenNote" placeholder="Turno, cajero…"></label>`,
      onMount: el => setTimeout(() => $('#cOpen', el).focus(), 60),
      actions: [{ label: 'Cancelar' }, { label: 'Abrir caja', cls: 'primary', onClick: async m => {
        const v = $('#cOpen', m.el).value;
        if (v === '' || Number(v) < 0) throw new Error('Escribe el fondo inicial (puede ser 0)');
        const cs = await api.post('/cash/open', { openingCash: Number(v), note: $('#cOpenNote', m.el).value });
        toast(`Caja #${cs.number} abierta`); await onDone(cs);
      } }],
    });
  }
  function moveForm(modal, type, onDone) {
    modal({
      title: type === 'in' ? 'Entrada de efectivo' : 'Salida de efectivo',
      body: `<p class="muted" style="margin-top:0">${type === 'in' ? 'Dinero que entra a la caja sin ser venta (más cambio, fondo extra…).' : 'Dinero que sale de la caja (pago a proveedor, gasto, retiro…).'}</p>
        <div class="form-grid"><label class="field"><span>Monto</span><input class="input num" id="cmA" type="number" min="0" step="0.5" inputmode="decimal"></label>
        <label class="field"><span>Motivo *</span><input class="input" id="cmN" placeholder="${type === 'in' ? 'Cambio extra' : 'Pago de paquetería'}"></label></div>`,
      onMount: el => setTimeout(() => $('#cmA', el).focus(), 60),
      actions: [{ label: 'Cancelar' }, { label: 'Registrar', cls: 'primary', onClick: async m => {
        const cs = await api.post('/cash/move', { type, amount: Number($('#cmA', m.el).value), note: $('#cmN', m.el).value });
        toast(type === 'in' ? 'Entrada registrada' : 'Salida registrada'); await onDone(cs);
      } }],
    });
  }
  function closeForm(modal, cs, S, onDone) {
    modal({
      title: `Corte de caja #${cs.number}`,
      body: `${summaryRows(cs)}
        <div class="form-grid" style="margin-top:14px">
          <label class="field"><span>Efectivo contado en caja *</span><input class="input num" id="ccC" type="number" min="0" step="0.5" inputmode="decimal" style="font-size:20px;text-align:center"></label>
          <label class="field"><span>Nota (opcional)</span><input class="input" id="ccN" placeholder="Observaciones del corte"></label>
        </div>
        <p class="change" id="ccD" style="margin:10px 0 0"></p>`,
      onMount: el => {
        const upd = () => { const v = $('#ccC', el).value; if (v === '') { $('#ccD', el).textContent = ''; return; } const d = Math.round((Number(v) - cs.summary.expectedCash) * 100) / 100; $('#ccD', el).innerHTML = d === 0 ? 'La caja <b>cuadra</b> ✓' : d < 0 ? `<span style="color:var(--bad)">Faltan <b>${M(-d)}</b></span>` : `Sobran <b>${M(d)}</b>`; };
        $('#ccC', el).oninput = upd; setTimeout(() => $('#ccC', el).focus(), 60);
      },
      actions: [{ label: 'Cancelar' }, { label: 'Imprimir parcial', onClick: () => { printCorte(cs, S); return false; } }, { label: 'Cerrar caja', cls: 'primary', onClick: async m => {
        const v = $('#ccC', m.el).value;
        if (v === '') throw new Error('Escribe el efectivo que contaste');
        const done = await api.post('/cash/close', { countedCash: Number(v), note: $('#ccN', m.el).value });
        toast('Caja cerrada'); await onDone(done);
        modal({ title: `Corte #${done.number} ✓`, body: corteHtml(done, S), actions: [{ label: 'Cerrar' }, { label: 'Imprimir corte', cls: 'primary', onClick: () => { printCorte(done, S); return false; } }] });
      } }],
    });
  }

  window.CashUI = { summaryRows, movementsHtml, corteHtml, printCorte, openForm, moveForm, closeForm };
})();
