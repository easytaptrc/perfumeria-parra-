// Escáner de códigos de barras / QR con la cámara (usa BarcodeDetector nativo si existe).
(function () {
  let audioCtx;
  function beep(ok = true) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = ok ? 1320 : 260;
      g.gain.setValueAtTime(0.12, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (ok ? 0.12 : 0.3));
      o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.3);
    } catch {}
    if (navigator.vibrate) navigator.vibrate(ok ? 60 : [80, 60, 80]);
  }

  function formats() {
    const F = window.Html5QrcodeSupportedFormats;
    return F ? [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.QR_CODE] : undefined;
  }

  function cameraHelp() {
    if (!window.isSecureContext) {
      return `La cámara solo funciona en conexión segura. Abre esta página con https://${location.hostname}:3443${location.pathname} (o en localhost).`;
    }
    return 'No se pudo acceder a la cámara. Revisa que hayas dado permiso al navegador.';
  }

  class Scanner {
    constructor(elementId) { this.id = elementId; this.inst = null; this.running = false; this.cancelled = false; this.last = ''; this.lastAt = 0; }
    async start(onCode, { cooldown = 1500 } = {}) {
      if (this.running) return;
      this.cancelled = false;
      if (!window.Html5Qrcode) throw new Error('No se cargó la librería del escáner');
      if (!window.isSecureContext || !navigator.mediaDevices) throw new Error(cameraHelp());
      this.inst = this.inst || new Html5Qrcode(this.id, { formatsToSupport: formats(), experimentalFeatures: { useBarCodeDetectorIfSupported: true }, verbose: false });
      const box = (w, h) => ({ width: Math.floor(Math.min(w * 0.88, 420)), height: Math.floor(Math.min(h * 0.55, 220)) });
      try {
        await this.inst.start({ facingMode: 'environment' }, { fps: 12, qrbox: box, disableFlip: true }, text => {
          const now = Date.now();
          if (text === this.last && now - this.lastAt < cooldown) return;
          this.last = text; this.lastAt = now;
          onCode(String(text).trim());
        }, () => {});
        this.running = true;
        if (this.cancelled) await this.stop();
      } catch (e) {
        throw new Error(cameraHelp() + (e && e.message ? ` (${e.message})` : ''));
      }
    }
    async stop() {
      this.cancelled = true;
      if (this.inst && this.running) { try { await this.inst.stop(); } catch {} try { this.inst.clear(); } catch {} }
      this.running = false;
    }
    async toggleTorch(on) {
      try { await this.inst.applyVideoConstraints({ advanced: [{ torch: !!on }] }); return true; } catch { return false; }
    }
  }

  // Modal de un solo escaneo: devuelve el código leído (o null si se cancela)
  function scanOnce(title = 'Escanear código') {
    return new Promise(resolve => {
      const back = document.createElement('div');
      back.className = 'modal-back';
      const id = 'scan-' + Math.random().toString(36).slice(2);
      back.innerHTML = `<div class="modal scan-modal">
        <h2>${title}</h2>
        <p class="muted" style="margin:0 0 14px">Apunta la cámara al código de barras.</p>
        <div id="${id}" class="scan-view"></div>
        <p class="scan-err muted hidden"></p>
        <form class="scan-manual"><input class="input" placeholder="…o escríbelo aquí" autocomplete="off"><button class="btn">Usar</button></form>
        <div class="modal-actions"><button type="button" class="btn" data-x>Cancelar</button></div>
      </div>`;
      document.body.appendChild(back);
      requestAnimationFrame(() => back.classList.add('open'));
      const sc = new Scanner(id);
      const done = async code => { await sc.stop(); back.classList.remove('open'); setTimeout(() => back.remove(), 300); resolve(code); };
      back.querySelector('[data-x]').onclick = () => done(null);
      back.addEventListener('click', e => { if (e.target === back) done(null); });
      back.querySelector('.scan-manual').onsubmit = e => { e.preventDefault(); const v = e.target.querySelector('input').value.trim(); if (v) done(v); };
      sc.start(code => { beep(true); done(code); }).catch(err => {
        const p = back.querySelector('.scan-err'); p.textContent = err.message; p.classList.remove('hidden');
        back.querySelector(`#${id}`).classList.add('hidden');
      });
    });
  }

  window.Scanner = Scanner;
  window.scanOnce = scanOnce;
  window.beep = beep;
})();
