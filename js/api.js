// Cliente de datos. Toda la app habla con el backend a través de este archivo.
// Cuando se conecte Firebase, se reemplaza la implementación de `api.*` aquí.
(function () {
  const TOKEN_KEY = 'parra_token';
  const USER_KEY = 'parra_user';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  async function request(method, url, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = store.get(TOKEN_KEY);
    if (t) headers.Authorization = 'Bearer ' + t;
    const res = await fetch('/api' + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch {}
    if (res.status === 401 && url !== '/login') { store.del(TOKEN_KEY); window.dispatchEvent(new Event('parra:logout')); }
    if (!res.ok) throw new Error((data && data.error) || 'Error ' + res.status);
    return data;
  }

  const api = {
    get: u => request('GET', u),
    post: (u, b) => request('POST', u, b || {}),
    put: (u, b) => request('PUT', u, b || {}),
    del: u => request('DELETE', u),
    get token() { return store.get(TOKEN_KEY); },
    get user() { try { return JSON.parse(store.get(USER_KEY) || 'null'); } catch { return null; } },
    async login(username, password) {
      const r = await request('POST', '/login', { username, password });
      store.set(TOKEN_KEY, r.token); store.set(USER_KEY, JSON.stringify(r.user));
      return r.user;
    },
    async me() { const u = await request('GET', '/me'); store.set(USER_KEY, JSON.stringify(u)); return u; },
    async logout() { try { await request('POST', '/logout'); } catch {} store.del(TOKEN_KEY); store.del(USER_KEY); },
    can(sec) { const u = api.user; return !!u && (u.role === 'admin' || (u.sections || []).includes(sec)); },
    // Redimensiona en el navegador y sube al servidor
    async uploadImage(file, maxSize = 1200) {
      const dataUrl = await resizeImage(file, maxSize);
      const r = await request('POST', '/upload', { dataUrl });
      return r.url;
    },
  };

  function resizeImage(file, max) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onerror = reject;
      fr.onload = () => {
        if (file.type === 'image/svg+xml') return resolve(fr.result);
        const img = new Image();
        img.onerror = () => reject(new Error('No se pudo leer la imagen'));
        img.onload = () => {
          const s = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          // PNG conserva transparencia (ideal para fotos de frascos sin fondo)
          resolve(file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/webp', 0.88));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  // ---------- utilidades de UI compartidas ----------
  const fmt = {
    currency: 'MXN',
    money(n) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: fmt.currency || 'MXN' }).format(Number(n) || 0); },
    date(d) { return new Date(d).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }); },
    day(d) { return new Date(d).toLocaleDateString('es-MX', { dateStyle: 'medium' }); },
  };

  function applyTheme(s) {
    if (!s) return;
    const c = s.colors || {};
    const r = document.documentElement.style;
    if (c.bg) r.setProperty('--bg', c.bg);
    if (c.surface) r.setProperty('--surface', c.surface);
    if (c.gold) r.setProperty('--gold', c.gold);
    if (c.text) r.setProperty('--text', c.text);
    if (c.muted) r.setProperty('--muted', c.muted);
    if (s.currency) fmt.currency = s.currency;
    if (s.logoIcon) logoFallback = s.logoIcon;
    // Tono claro/oscuro según el fondo (para mezclar logos correctamente)
    const hex = (c.bg || '#000').replace('#', '');
    const [R, G, B] = [0, 2, 4].map(i => parseInt(hex.length === 3 ? hex[i / 2].repeat(2) : hex.slice(i, i + 2), 16) || 0);
    const light = (0.299 * R + 0.587 * G + 0.114 * B) > 150;
    document.documentElement.dataset.tone = light ? 'light' : 'dark';
    document.documentElement.style.colorScheme = light ? 'light' : 'dark';
  }

  function toast(msg, type = 'ok') {
    let box = document.querySelector('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Foto del producto. PNG (frasco recortado, sin fondo) se muestra completo;
  // JPG/WEBP (foto con fondo) llena el espacio. Sin foto: el logo de la tienda.
  const isCutout = url => /\.png(\?|$)/i.test(url || '');
  let logoFallback = "/assets/logo-icon.jpg";
  function media(p, { lazy = true } = {}) {
    if (!p || !p.image) return `<img class="pm pm-empty" src="${esc(logoFallback)}" alt="" ${lazy ? 'loading="lazy"' : ""}>`;
    // Si la foto no carga, se cambia por el logo de la tienda
    return `<img class="pm ${isCutout(p.image) ? "pm-cut" : "pm-photo"}" src="${esc(p.image)}" alt="${esc(p.name)}" ${lazy ? 'loading="lazy"' : ""}>`;
  }
  const setLogoFallback = u => { if (u) logoFallback = u; };
  document.addEventListener('error', e => {
    const im = e.target;
    if (im && im.tagName === 'IMG' && im.classList.contains('pm') && !im.dataset.failed) { im.dataset.failed = '1'; im.className = 'pm pm-empty'; im.src = logoFallback; }
  }, true);

  // Utilidades para la tarjeta de lealtad
  function qrSvg(text, { size = 200, fg = "#000", bg = "#fff" } = {}) {
    if (!window.qrcode) return "";
    const q = qrcode(0, "M"); q.addData(String(text)); q.make();
    const n = q.getModuleCount(), m = 2, total = n + m * 2;
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m},${r + m}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
  }

  window.api = api;
  window.fmt = fmt;
  window.ui = { applyTheme, toast, esc, media, isCutout, setLogoFallback, qrSvg };
})();
