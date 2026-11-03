(function () {
  'use strict';

  /* ================= kurulum ================= */
  var CFG = window.KARE_CONFIG;
  var BUCKET = 'media';
  var PAGE = 12;
  var MAX_VIDEO = 50 * 1024 * 1024;
  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
  var state = { session: null, me: null, following: new Set() };
  var routeTok = 0;
  var lastUid = undefined;
  var feedIO = null, chPosts = null, chUser = null;
  var badges = { notif: 0, msg: 0 };
  function badgeEl(key) {
    return h('span', { class: 'dot', 'data-b': key, hidden: !badges[key] }, badges[key] > 99 ? '99+' : String(badges[key] || ''));
  }
  function setBadge(key, n) {
    badges[key] = Math.max(0, n);
    document.querySelectorAll('[data-b="' + key + '"]').forEach(function (el) {
      el.textContent = badges[key] > 99 ? '99+' : String(badges[key]);
      el.hidden = !badges[key];
    });
  }
  function bumpBadge(key, d) { setBadge(key, badges[key] + d); }

  /* ================= küçük yardımcılar ================= */
  function $(s, r) { return (r || document).querySelector(s); }
  function h(tag, props) {
    var el = document.createElement(tag);
    var p = props || {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') {
        Object.keys(v).forEach(function (sk) {
          if (sk.indexOf('--') === 0) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk];
        });
      }
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).flat(Infinity).forEach(function (c) {
        if (c == null || c === false) return;
        el.append(c instanceof Node ? c : document.createTextNode(String(c)));
      });
    }
    return el;
  }

  var ICONS = {
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
    comment: '<path d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-5.5A8 8 0 1 1 21 12z"/>',
    repeat: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
    moon: '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
    volume: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'
  };
  function icon(name, cls) {
    var w = document.createElement('span');
    w.className = 'ico' + (name === 'more' || name === 'play' ? ' fill' : '') + (cls ? ' ' + cls : '');
    w.setAttribute('aria-hidden', 'true');
    w.innerHTML = '<svg viewBox="0 0 24 24">' + ICONS[name] + '</svg>';
    return w;
  }

  var nf = new Intl.NumberFormat('tr', { notation: 'compact' });
  function fmt(n) { return nf.format(n || 0); }
  function cnt(rel) { return rel && rel[0] ? rel[0].count || 0 : 0; }
  function timeAgo(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 45) return 'şimdi';
    var m = s / 60; if (m < 60) return Math.round(m) + ' dk';
    var hr = m / 60; if (hr < 24) return Math.round(hr) + ' sa';
    var d = hr / 24; if (d < 7) return Math.round(d) + ' g';
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }
  function mediaUrl(path) {
    return CFG.supabaseUrl + '/storage/v1/object/public/' + BUCKET + '/' + path.split('/').map(encodeURIComponent).join('/');
  }
  function clamp(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function arOf(p) { return p.width && p.height ? clamp(p.width / p.height, 0.8, 1.5) : 1; }
  function nameOf(pr) { return (pr && (pr.display_name || pr.username)) || 'Biri'; }

  function toast(msg, isErr) {
    var t = h('div', { class: 'toast' + (isErr ? ' err' : '') }, msg);
    $('#toasts').append(t);
    setTimeout(function () { t.remove(); }, 3600);
  }
  function friendlyError(e) {
    var m = (e && (e.message || e.error_description || e.msg)) || '';
    if (/Invalid login credentials/i.test(m)) return 'E-posta veya şifre hatalı.';
    if (/Email not confirmed/i.test(m)) return 'E-postanı henüz doğrulamadın. Gelen kutunu kontrol et.';
    if (/already registered|already been registered/i.test(m)) return 'Bu e-posta zaten kayıtlı.';
    if (/at least \d+ characters/i.test(m)) return 'Şifre en az 6 karakter olmalı.';
    if (/rate limit|too many/i.test(m)) return 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.';
    if (/Database error saving new user/i.test(m)) return 'Kayıt tamamlanamadı. Kullanıcı adını değiştirip tekrar dene.';
    if (/exceeded the maximum allowed size|too large|Payload too large/i.test(m)) return 'Dosya çok büyük (en fazla 50 MB).';
    if (/mime type|not supported/i.test(m)) return 'Bu dosya türü desteklenmiyor.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Bağlantı kurulamadı. İnternetini kontrol et.';
    return m && m.length < 140 ? m : 'Bir sorun oluştu. Tekrar dene.';
  }

  /* ---- kaydırma kilidi ve pencereler ---- */
  var locks = 0;
  function lock() { if (locks++ === 0) document.body.classList.add('locked'); }
  function unlock() { if (--locks <= 0) { locks = 0; document.body.classList.remove('locked'); } }
  var modals = [];
  function modal(content, label) {
    var back = h('div', { class: 'modal-back', role: 'dialog', 'aria-modal': 'true', 'aria-label': label || 'Pencere' });
    var box = h('div', { class: 'modal' }, content);
    back.append(box);
    var prev = document.activeElement;
    var closed = false;
    function close() {
      if (closed) return;
      closed = true;
      modals = modals.filter(function (m) { return m !== api; });
      back.classList.add('out');
      setTimeout(function () { back.remove(); }, 180);
      unlock();
      if (prev && prev.focus) { try { prev.focus(); } catch (e) {} }
    }
    var api = { close: close, el: box };
    back.addEventListener('mousedown', function (ev) { if (ev.target === back) close(); });
    document.body.append(back);
    lock();
    modals.push(api);
    var first = box.querySelector('input, textarea, button');
    if (first) setTimeout(function () { try { first.focus(); } catch (e) {} }, 30);
    return api;
  }
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && modals.length && !document.querySelector('.sv')) modals[modals.length - 1].close();
  });
  function confirmModal(text, okLabel, danger) {
    return new Promise(function (resolve) {
      var done = false;
      var m;
      function fin(v) { if (done) return; done = true; m.close(); resolve(v); }
      m = modal(h('div', { style: { display: 'contents' } },
        h('h2', null, text),
        h('div', { class: 'row' },
          h('button', { class: 'btn quiet', type: 'button', onclick: function () { fin(false); } }, 'Vazgeç'),
          h('button', { class: 'btn' + (danger ? ' danger' : ''), type: 'button', onclick: function () { fin(true); } }, okLabel || 'Tamam'))), text);
      var back = m.el.parentNode;
      new MutationObserver(function (_, obs) { if (!document.body.contains(back)) { obs.disconnect(); fin(false); } }).observe(document.body, { childList: true });
    });
  }

  /* ================= oturum ================= */
  async function loadMe() {
    var s = state.session;
    state.me = null; state.following = new Set();
    if (!s) return;
    var r = await sb.from('profiles').select('id,username,display_name,bio,avatar_path,banner_path').eq('id', s.user.id).maybeSingle();
    state.me = r.data || null;
    var f = await sb.from('follows').select('following_id').eq('follower_id', s.user.id);
    (f.data || []).forEach(function (x) { state.following.add(x.following_id); });
  }
  sb.auth.onAuthStateChange(function (ev, session) {
    state.session = session;
    var uid = session ? session.user.id : null;
    if (uid === lastUid) return;
    lastUid = uid;
    // onAuthStateChange içinde doğrudan Supabase çağrısı yapmamak için erteliyoruz
    setTimeout(function () {
      loadMe().then(function () { renderHeader(); route(); afterAuth(); });
    }, 0);
  });

  function requireLogin() {
    if (state.me) return true;
    authModal('in');
    return false;
  }

  function authModal(startMode) {
    var mode = startMode || 'in';
    var host = h('div', { style: { display: 'contents' } });
    var m = modal(host, 'Giriş');
    function draw() {
      var err = h('div', { class: 'hint bad', role: 'alert' });
      var email = h('input', { class: 'input', id: 'a-email', type: 'email', autocomplete: 'email', required: true, placeholder: 'ornek@mail.com' });
      var pass = h('input', { class: 'input', id: 'a-pass', type: 'password', autocomplete: mode === 'in' ? 'current-password' : 'new-password', required: true, minlength: '6', placeholder: 'En az 6 karakter' });
      var uname = null, uhint = null;
      var submit = h('button', { class: 'btn', type: 'submit' }, mode === 'in' ? 'Giriş yap' : 'Hesap oluştur');
      var fields = [
        h('div', { class: 'field' }, h('label', { for: 'a-email' }, 'E-posta'), email)
      ];
      var unameOk = mode === 'in';
      if (mode === 'up') {
        uname = h('input', { class: 'input', id: 'a-user', type: 'text', autocomplete: 'username', required: true, maxlength: '24', placeholder: 'kullanici_adi', autocapitalize: 'none', spellcheck: 'false' });
        uhint = h('div', { class: 'hint' }, '3-24 karakter: küçük harf, rakam ve alt çizgi.');
        var timer = null;
        uname.addEventListener('input', function () {
          unameOk = false;
          var v = uname.value.trim().toLowerCase();
          clearTimeout(timer);
          if (!/^[a-z0-9_]{3,24}$/.test(v)) { uhint.className = 'hint bad'; uhint.textContent = '3-24 karakter: küçük harf, rakam ve alt çizgi.'; return; }
          uhint.className = 'hint'; uhint.textContent = 'Kontrol ediliyor';
          timer = setTimeout(async function () {
            var r = await sb.rpc('username_available', { name: v });
            if (uname.value.trim().toLowerCase() !== v) return;
            if (r.error) { uhint.className = 'hint'; uhint.textContent = ''; unameOk = true; return; }
            unameOk = !!r.data;
            uhint.className = 'hint ' + (r.data ? 'ok' : 'bad');
            uhint.textContent = r.data ? 'Bu kullanıcı adı boş.' : 'Bu kullanıcı adı alınmış.';
          }, 400);
        });
        fields.push(h('div', { class: 'field' }, h('label', { for: 'a-user' }, 'Kullanıcı adı'), uname, uhint));
      }
      fields.push(h('div', { class: 'field' }, h('label', { for: 'a-pass' }, 'Şifre'), pass));
      var form = h('form', { style: { display: 'flex', flexDirection: 'column', gap: '14px' }, novalidate: true }, fields, err, submit);
      form.addEventListener('submit', async function (ev) {
        ev.preventDefault();
        err.textContent = '';
        var em = email.value.trim(), pw = pass.value;
        if (!em || !/.+@.+\..+/.test(em)) { err.textContent = 'Geçerli bir e-posta yaz.'; return; }
        if (pw.length < 6) { err.textContent = 'Şifre en az 6 karakter olmalı.'; return; }
        submit.disabled = true;
        try {
          if (mode === 'in') {
            var r = await sb.auth.signInWithPassword({ email: em, password: pw });
            if (r.error) throw r.error;
            m.close();
            toast('Hoş geldin!');
          } else {
            var un = uname.value.trim().toLowerCase();
            if (!/^[a-z0-9_]{3,24}$/.test(un)) { err.textContent = 'Kullanıcı adı 3-24 karakter olmalı: küçük harf, rakam, alt çizgi.'; submit.disabled = false; return; }
            if (!unameOk) { err.textContent = 'Bu kullanıcı adı alınmış ya da henüz kontrol edilmedi.'; submit.disabled = false; return; }
            var r2 = await sb.auth.signUp({ email: em, password: pw, options: { data: { username: un } } });
            if (r2.error) throw r2.error;
            if (r2.data.session) { m.close(); toast('Hesabın hazır, hoş geldin!'); }
            else {
              host.replaceChildren(h('h2', null, 'E-postanı kontrol et'),
                h('p', { style: { margin: 0 } }, em + ' adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra giriş yapabilirsin.'),
                h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: function () { m.close(); } }, 'Tamam')));
              return;
            }
          }
        } catch (e) { err.textContent = friendlyError(e); submit.disabled = false; }
      });
      host.replaceChildren(
        h('h2', null, mode === 'in' ? 'Giriş yap' : 'Kare\'ye katıl'),
        form,
        h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } },
          h('span', { class: 'hint' }, mode === 'in' ? 'Hesabın yok mu?' : 'Zaten hesabın var mı?'),
          h('button', { class: 'btn quiet small', type: 'button', onclick: function () { mode = mode === 'in' ? 'up' : 'in'; draw(); } }, mode === 'in' ? 'Kayıt ol' : 'Giriş yap')));
    }
    draw();
  }

  /* ================= üst çubuk ================= */
  function effectiveTheme() {
    return document.documentElement.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function avatarEl(pr, size, cls) {
    var el = h('span', { class: 'av' + (cls ? ' ' + cls : ''), style: { '--s': (size || 40) + 'px' } });
    if (pr && pr.avatar_path) {
      var img = h('img', { src: mediaUrl(pr.avatar_path), alt: '', loading: 'lazy', decoding: 'async' });
      img.addEventListener('error', function () { img.remove(); el.textContent = (nameOf(pr)[0] || '?'); });
      el.append(img);
    } else el.textContent = (nameOf(pr)[0] || '?');
    return el;
  }
  function currentSection() {
    var p = location.hash.replace(/^#\/?/, '').split('/')[0];
    return p || 'home';
  }
  function renderHeader() {
    var sec = currentSection();
    var themeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Temayı değiştir', onclick: function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('kare_theme', next); } catch (e) {}
      renderHeader();
    } }, icon(effectiveTheme() === 'dark' ? 'sun' : 'moon'));
    var nav = h('nav', { class: 'nav', 'aria-label': 'Ana menü' });
    var bottom = $('#bottom');
    bottom.replaceChildren();
    function lnk(ico, href, label, active, key, cls) {
      var a = h('a', { class: 'icon-btn' + (active ? ' active' : '') + (cls ? ' ' + cls : ''), href: href, 'aria-label': label }, icon(ico));
      if (key) a.append(badgeEl(key));
      return a;
    }
    function addBtn(cls) {
      return h('button', { class: 'icon-btn add' + (cls ? ' ' + cls : ''), type: 'button', 'aria-label': 'Paylaş', onclick: function () { uploadModal('post'); } }, icon('plus'));
    }
    if (state.me) {
      var mine = state.me;
      nav.append(
        lnk('home', '#/', 'Ana sayfa', sec === 'home', null, 'only-desktop'),
        lnk('search', '#/ara', 'Ara', sec === 'ara', null, 'only-desktop'),
        addBtn('only-desktop'),
        lnk('bell', '#/bildirimler', 'Bildirimler', sec === 'bildirimler', 'notif', 'only-desktop'),
        lnk('bookmark', '#/favoriler', 'Favoriler', sec === 'favoriler'),
        lnk('mail', '#/mesajlar', 'Mesajlar', sec === 'mesajlar', 'msg'),
        themeBtn,
        h('a', { class: 'icon-btn only-desktop', href: '#/u/' + encodeURIComponent(mine.username), 'aria-label': 'Profilim' }, avatarEl(mine, 30))
      );
      bottom.append(
        lnk('home', '#/', 'Ana sayfa', sec === 'home'),
        lnk('search', '#/ara', 'Ara', sec === 'ara'),
        addBtn(),
        lnk('bell', '#/bildirimler', 'Bildirimler', sec === 'bildirimler', 'notif'),
        h('a', { class: 'icon-btn' + (sec === 'u' ? ' active' : ''), href: '#/u/' + encodeURIComponent(mine.username), 'aria-label': 'Profilim' }, avatarEl(mine, 28))
      );
      bottom.hidden = false;
    } else {
      nav.append(lnk('search', '#/ara', 'Ara', sec === 'ara'), themeBtn,
        h('button', { class: 'btn small', type: 'button', onclick: function () { authModal('in'); } }, 'Giriş yap'),
        h('button', { class: 'btn quiet small', type: 'button', onclick: function () { authModal('up'); } }, 'Kayıt ol'));
      bottom.hidden = true;
    }
    $('#top').replaceChildren(
      h('a', { class: 'logo', href: '#/', 'aria-label': 'Kare ana sayfa' }, h('span', { class: 'film', 'aria-hidden': 'true' }), 'kare'),
      nav);
  }

  /* ================= medya hazırlama ve yükleme ================= */
  function videoDims(file) {
    return new Promise(function (resolve) {
      var v = document.createElement('video');
      var url = URL.createObjectURL(file);
      var t = setTimeout(function () { fin({ w: 0, h: 0 }); }, 4000);
      function fin(d) { clearTimeout(t); URL.revokeObjectURL(url); resolve(d); }
      v.preload = 'metadata'; v.muted = true;
      v.onloadedmetadata = function () { fin({ w: v.videoWidth, h: v.videoHeight }); };
      v.onerror = function () { fin({ w: 0, h: 0 }); };
      v.src = url;
    });
  }
  async function prepareMedia(file, opts) {
    opts = opts || {};
    var max = opts.max || 1600;
    if (file.type.indexOf('video/') === 0) {
      if (opts.imageOnly) throw new Error('Burada sadece fotoğraf seçebilirsin.');
      if (['video/mp4', 'video/webm', 'video/quicktime'].indexOf(file.type) < 0) throw new Error('Video MP4, WebM veya MOV olmalı.');
      if (file.size > MAX_VIDEO) throw new Error('Video en fazla 50 MB olabilir.');
      var d = await videoDims(file);
      return { blob: file, type: 'video', contentType: file.type, ext: file.type === 'video/webm' ? 'webm' : file.type === 'video/quicktime' ? 'mov' : 'mp4', w: d.w, h: d.h };
    }
    if (file.type.indexOf('image/') !== 0) throw new Error('Lütfen fotoğraf ya da video seç.');
    var bmp;
    try { bmp = await createImageBitmap(file); } catch (e) { throw new Error('Bu fotoğraf açılamadı. JPG, PNG veya WebP dene.'); }
    var w = bmp.width, hh = bmp.height;
    if (file.type === 'image/gif' && !opts.square && file.size <= 15 * 1024 * 1024) {
      if (bmp.close) bmp.close();
      return { blob: file, type: 'image', contentType: 'image/gif', ext: 'gif', w: w, h: hh };
    }
    var sx = 0, sy = 0, sw = w, sh = hh, cw, ch;
    if (opts.banner) { var th = Math.min(hh, w / 3); sh = th; sy = (hh - th) / 2; max = 1500; }
    if (opts.square) { var side = Math.min(w, hh); sx = (w - side) / 2; sy = (hh - side) / 2; sw = side; sh = side; }
    var scale = Math.min(1, max / Math.max(sw, sh));
    cw = Math.round(sw * scale); ch = Math.round(sh * scale);
    var cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, cw, ch);
    if (bmp.close) bmp.close();
    var blob = await new Promise(function (res) { cv.toBlob(res, 'image/jpeg', 0.86); });
    if (!blob) throw new Error('Fotoğraf işlenemedi.');
    return { blob: blob, type: 'image', contentType: 'image/jpeg', ext: 'jpg', w: cw, h: ch };
  }
  async function uploadPrepared(prep, prefix) {
    var path = state.me.id + '/' + (prefix || '') + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.' + prep.ext;
    var r = await sb.storage.from(BUCKET).upload(path, prep.blob, { contentType: prep.contentType, cacheControl: '31536000', upsert: false });
    if (r.error) throw r.error;
    return path;
  }
  function removeFile(path) { if (path) sb.storage.from(BUCKET).remove([path]).then(function () {}, function () {}); }

  var MAX_ITEMS = 10;
  function uploadModal(startKind) {
    if (!requireLogin()) return;
    var kind = startKind || 'post';
    var items = [], busy = false;
    var host = h('div', { style: { display: 'contents' } });
    var m = modal(host, 'Paylaş');
    var fileInput = h('input', { class: 'sr', id: 'u-file', type: 'file', multiple: true, accept: 'image/*,video/mp4,video/webm,video/quicktime' });
    var err = h('div', { class: 'hint bad', role: 'alert' });
    var caption = h('textarea', { class: 'textarea', id: 'u-cap', maxlength: '2000', placeholder: 'Bir şeyler yaz (isteğe bağlı)' });
    var capLabel = h('label', { for: 'u-cap' }, 'Açıklama');
    var thumbs = h('div', { class: 'thumbs', hidden: true });
    var dropEl = h('label', { class: 'drop', for: 'u-file' }, icon('image'), h('b', null, 'Fotoğraf veya video seç'), h('span', { class: 'hint' }, 'En fazla ' + MAX_ITEMS + ' dosya, hepsini birden seçebilirsin. Video en fazla 50 MB.'));
    var capField = h('div', { class: 'field' }, capLabel, caption);
    var bar = h('i', { style: { width: '0%' } });
    var prog = h('div', { class: 'progress', hidden: true }, bar);
    var submit = h('button', { class: 'btn', type: 'button', disabled: true }, 'Paylaş');
    var segPost = h('button', { type: 'button', 'aria-pressed': 'true', onclick: function () { setKind('post'); } }, 'Paylaşım');
    var segStory = h('button', { type: 'button', 'aria-pressed': 'false', onclick: function () { setKind('story'); } }, 'Hikaye (24 saat)');
    function setKind(k) {
      kind = k;
      segPost.setAttribute('aria-pressed', k === 'post' ? 'true' : 'false');
      segStory.setAttribute('aria-pressed', k === 'story' ? 'true' : 'false');
      capLabel.textContent = k === 'story' ? 'Hikaye yazısı' : 'Açıklama';
      caption.maxLength = k === 'story' ? 140 : 2000;
      caption.placeholder = k === 'story' ? 'Kısa bir yazı (isteğe bağlı)' : 'Bir şeyler yaz (isteğe bağlı)';
      render();
    }
    function render() {
      var n = items.length;
      dropEl.hidden = n > 0;
      thumbs.hidden = n === 0;
      submit.disabled = n === 0 || busy;
      submit.textContent = n > 1 ? (kind === 'story' ? n + ' hikaye paylaş' : n + ' kareyi paylaş') : 'Paylaş';
      var nodes = items.map(function (it, i) {
        var el = it.prep.type === 'video'
          ? h('video', { src: it.url + '#t=0.1', muted: true, playsinline: true, preload: 'metadata' })
          : h('img', { src: it.url, alt: 'Seçilen ' + (i + 1) });
        return h('div', { class: 'thumb enter', style: { '--i': String(Math.min(i, 9)) } }, el,
          it.prep.type === 'video' ? h('span', { class: 'tb-vid' }, icon('play')) : null,
          n > 1 ? h('span', { class: 'tb-n mono' }, String(i + 1)) : null,
          h('button', { type: 'button', class: 'tb-x', 'aria-label': 'Kaldır', disabled: busy, onclick: function () {
            URL.revokeObjectURL(it.url); items.splice(items.indexOf(it), 1); render();
          } }, icon('x')));
      });
      if (n && n < MAX_ITEMS) nodes.push(h('label', { class: 'thumb add', for: 'u-file', 'aria-label': 'Daha fazla ekle' }, icon('plus'), h('span', { class: 'mono' }, n + '/' + MAX_ITEMS)));
      thumbs.replaceChildren.apply(thumbs, nodes);
    }
    async function addFiles(list) {
      err.textContent = '';
      var files = Array.prototype.slice.call(list || []);
      if (!files.length) return;
      var room = MAX_ITEMS - items.length;
      var msgs = [];
      if (files.length > room) { msgs.push('En fazla ' + MAX_ITEMS + ' dosya eklenebilir.'); files = files.slice(0, Math.max(0, room)); }
      submit.disabled = true;
      for (var i = 0; i < files.length; i++) {
        try {
          var prep = await prepareMedia(files[i]);
          items.push({ prep: prep, url: URL.createObjectURL(prep.blob) });
          render();
        } catch (e) { msgs.push(files[i].name + ': ' + friendlyError(e)); }
      }
      err.textContent = msgs.join(' ');
      render();
    }
    fileInput.addEventListener('change', function () { addFiles(fileInput.files); fileInput.value = ''; });
    [dropEl, thumbs].forEach(function (el) {
      ['dragenter', 'dragover'].forEach(function (n) { el.addEventListener(n, function (ev) { ev.preventDefault(); el.classList.add('over'); }); });
      ['dragleave', 'drop'].forEach(function (n) { el.addEventListener(n, function (ev) { ev.preventDefault(); el.classList.remove('over'); }); });
      el.addEventListener('drop', function (ev) { if (ev.dataTransfer && ev.dataTransfer.files.length) addFiles(ev.dataTransfer.files); });
    });
    var cancel = h('button', { class: 'btn quiet', type: 'button', onclick: function () { if (!busy) m.close(); } }, 'Vazgeç');
    submit.addEventListener('click', async function () {
      if (!items.length || busy) return;
      busy = true; submit.disabled = true; cancel.disabled = true; prog.hidden = false; err.textContent = ''; render();
      var paths = [], total = items.length;
      try {
        for (var i = 0; i < total; i++) {
          paths.push(await uploadPrepared(items[i].prep, kind === 'story' ? 's-' : ''));
          bar.style.width = Math.round(((i + 1) / total) * 90) + '%';
          submit.textContent = 'Yükleniyor ' + (i + 1) + '/' + total;
        }
        var cap = caption.value.trim() || null;
        if (kind === 'story') {
          var base = Date.now();
          var rows = items.map(function (it, i) {
            return { user_id: state.me.id, media_path: paths[i], media_type: it.prep.type, caption: cap, created_at: new Date(base + i * 1000).toISOString() };
          });
          var sr = await sb.from('stories').insert(rows);
          if (sr.error) throw sr.error;
        } else {
          var f = items[0].prep;
          var pr = await sb.from('posts').insert({ user_id: state.me.id, caption: cap, media_path: paths[0], media_type: f.type, width: f.w || null, height: f.h || null }).select('id').single();
          if (pr.error) throw pr.error;
          var mr = await sb.from('post_media').insert(items.map(function (it, i) {
            return { post_id: pr.data.id, position: i, media_path: paths[i], media_type: it.prep.type, width: it.prep.w || null, height: it.prep.h || null };
          }));
          if (mr.error) { await sb.from('posts').delete().eq('id', pr.data.id); throw mr.error; }
        }
        bar.style.width = '100%';
        items.forEach(function (it) { URL.revokeObjectURL(it.url); });
        m.close();
        toast(kind === 'story' ? (total > 1 ? total + ' hikayen yayında.' : 'Hikayen yayında.') : (total > 1 ? total + ' karelik paylaşım yayında!' : 'Paylaşıldı!'));
        if (location.hash === '' || location.hash === '#/' || location.hash === '#') route(); else location.hash = '#/';
      } catch (e) {
        paths.forEach(removeFile);
        err.textContent = friendlyError(e);
        busy = false; cancel.disabled = false; prog.hidden = true; bar.style.width = '0%'; render();
      }
    });
    host.append(
      h('h2', null, 'Paylaş'),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Ne paylaşacaksın' }, segPost, segStory),
      fileInput, dropEl, thumbs, capField, prog, err,
      h('p', { class: 'hint', style: { margin: 0 } }, 'Başkalarına ait ya da uygunsuz içerik paylaşma.'),
      h('div', { class: 'row' }, cancel, submit));
    setKind(kind);
  }

  /* ================= veri katmanı ================= */
  var PROFILE_SEL = 'id,username,display_name,avatar_path';
  var POST_SEL = 'id,user_id,caption,media_path,media_type,width,height,created_at,media:post_media(position,media_path,media_type,width,height),author:profiles!posts_user_id_fkey(' + PROFILE_SEL + '),likes(count),comments(count),reposts(count)';
  var GRID_SEL = 'id,media_path,media_type,media:post_media(position),likes(count),comments(count)';
  function ms(iso) { return new Date(iso).getTime(); }

  async function attachMine(items) {
    var ids = Array.from(new Set(items.map(function (i) { return i.post.id; })));
    var sets = { likes: new Set(), favorites: new Set(), reposts: new Set() };
    if (state.me && ids.length) {
      var uid = state.me.id;
      var res = await Promise.all(['likes', 'favorites', 'reposts'].map(function (t) {
        return sb.from(t).select('post_id').eq('user_id', uid).in('post_id', ids);
      }));
      ['likes', 'favorites', 'reposts'].forEach(function (t, i) {
        (res[i].data || []).forEach(function (r) { sets[t].add(r.post_id); });
      });
    }
    items.forEach(function (i) {
      i.mine = { liked: sets.likes.has(i.post.id), fav: sets.favorites.has(i.post.id), rep: sets.reposts.has(i.post.id) };
    });
    return items;
  }

  async function fetchFeed(tab, before) {
    var follow = null;
    if (tab === 'follow') {
      follow = Array.from(state.following);
      if (!follow.length) return { items: [], cursor: null };
    }
    var RP = Math.ceil(PAGE / 2);
    var pq = sb.from('posts').select(POST_SEL).order('created_at', { ascending: false }).limit(PAGE);
    var rq = sb.from('reposts').select('created_at,user_id,reposter:profiles!reposts_user_id_fkey(' + PROFILE_SEL + '),post:posts!reposts_post_id_fkey(' + POST_SEL + ')').order('created_at', { ascending: false }).limit(RP);
    if (before) { pq = pq.lt('created_at', before); rq = rq.lt('created_at', before); }
    if (follow) { pq = pq.in('user_id', follow); rq = rq.in('user_id', follow); }
    var res = await Promise.all([pq, rq]);
    if (res[0].error) throw res[0].error;
    if (res[1].error) throw res[1].error;
    var items = [];
    res[0].data.forEach(function (p) { items.push({ key: 'p' + p.id, post: p, sortAt: p.created_at, repostedBy: null }); });
    res[1].data.forEach(function (r) { if (r.post) items.push({ key: 'r' + r.post.id + r.user_id, post: r.post, sortAt: r.created_at, repostedBy: r.reposter }); });
    items.sort(function (a, b) { return ms(b.sortAt) - ms(a.sortAt); });
    var boundary = null;
    if (res[0].data.length === PAGE) boundary = res[0].data[PAGE - 1].created_at;
    if (res[1].data.length === RP) {
      var b = res[1].data[RP - 1].created_at;
      if (!boundary || ms(b) > ms(boundary)) boundary = b;
    }
    if (boundary) items = items.filter(function (i) { return ms(i.sortAt) >= ms(boundary); });
    await attachMine(items);
    return { items: items, cursor: boundary };
  }

  /* ================= paylaşım kartı ================= */
  var vio = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting && e.intersectionRatio >= 0.6) { if (!v._userPaused) v.play().catch(function () {}); }
      else v.pause();
    });
  }, { threshold: [0, 0.6] }) : null;

  function mediaList(p) {
    var l = (p.media || []).slice().sort(function (a, b) { return a.position - b.position; });
    return l.length ? l : [{ media_path: p.media_path, media_type: p.media_type, width: p.width, height: p.height }];
  }
  function singleMedia(it, p, onTap, onDouble) {
    var box = h('div', { class: 'media', style: { '--ar': String(arOf(it)) } });
    var v = null;
    if (it.media_type === 'video') {
      v = h('video', { src: mediaUrl(it.media_path), playsinline: true, loop: true, preload: 'metadata', 'aria-label': 'Video' });
      v.muted = true;
      var mute = h('button', { class: 'mute', type: 'button', 'aria-label': 'Sesi aç/kapat', onclick: function (ev) { ev.stopPropagation(); v.muted = !v.muted; mute.replaceChildren(icon(v.muted ? 'mute' : 'volume')); } }, icon('mute'));
      box.append(v, h('div', { class: 'pp' }, h('span', null, icon('play'))), mute);
      if (vio) vio.observe(v);
    } else {
      box.append(h('img', { src: mediaUrl(it.media_path), alt: p.caption ? p.caption.slice(0, 100) : 'Paylaşım', loading: 'lazy', decoding: 'async' }));
    }
    var last = 0, timer = null;
    box.addEventListener('click', function () {
      var now = Date.now();
      if (now - last < 320) { clearTimeout(timer); last = 0; onDouble(box); return; }
      last = now;
      timer = setTimeout(function () {
        if (v) {
          if (v.paused) { v._userPaused = false; v.play().catch(function () {}); box.classList.remove('paused'); }
          else { v._userPaused = true; v.pause(); box.classList.add('paused'); }
        } else if (onTap) onTap();
      }, 260);
    });
    return box;
  }
  function mediaEl(p, onTap, onDouble) {
    var list = mediaList(p);
    if (list.length < 2) return singleMedia(list[0], p, onTap, onDouble);
    var box = h('div', { class: 'carousel', style: { '--ar': String(arOf(list[0])) } });
    var track = h('div', { class: 'track', tabindex: '0', 'aria-label': 'Fotoğraf albümü, ' + list.length + ' kare' });
    list.forEach(function (it) { var s = singleMedia(it, p, onTap, onDouble); s.classList.add('slide'); track.append(s); });
    var count = h('span', { class: 'count mono' }, '1/' + list.length);
    var dots = h('div', { class: 'dots', 'aria-hidden': 'true' }, list.map(function (_, i) { return h('i', { class: i === 0 ? 'on' : '' }); }));
    var idx = 0;
    function go(i) { track.scrollTo({ left: clamp(i, 0, list.length - 1) * track.clientWidth, behavior: 'smooth' }); }
    var prev = h('button', { class: 'nav l', type: 'button', 'aria-label': 'Önceki kare', onclick: function (ev) { ev.stopPropagation(); go(idx - 1); } }, icon('back'));
    var next = h('button', { class: 'nav r', type: 'button', 'aria-label': 'Sonraki kare', onclick: function (ev) { ev.stopPropagation(); go(idx + 1); } }, icon('back'));
    function paint() {
      count.textContent = (idx + 1) + '/' + list.length;
      Array.prototype.forEach.call(dots.children, function (d, i) { d.className = i === idx ? 'on' : ''; });
      prev.hidden = idx === 0; next.hidden = idx === list.length - 1;
    }
    var raf = 0;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var i = Math.round(track.scrollLeft / (track.clientWidth || 1));
        if (i !== idx) { idx = i; paint(); }
      });
    }, { passive: true });
    track.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); go(idx + 1); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(idx - 1); }
    });
    box.append(track, count, dots, prev, next);
    paint();
    return box;
  }

  function postCard(item, opts) {
    opts = opts || {};
    var p = item.post;
    var st = { liked: !!item.mine.liked, fav: !!item.mine.fav, rep: !!item.mine.rep, likes: cnt(p.likes), comments: cnt(p.comments), reposts: cnt(p.reposts) };
    var author = p.author || {};
    var card = h('article', { class: 'card' + (opts.enter ? ' enter' : ''), style: { '--i': String(opts.i || 0) } });

    if (item.repostedBy) {
      card.append(h('div', { class: 'repost-note' }, icon('repeat'), h('a', { href: '#/u/' + encodeURIComponent(item.repostedBy.username) }, nameOf(item.repostedBy) + ' repost etti')));
    }

    var menu = null;
    var moreBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Daha fazla', 'aria-haspopup': 'menu', onclick: function (ev) {
      ev.stopPropagation();
      if (menu) { menu.remove(); menu = null; return; }
      menu = h('div', { class: 'menu', role: 'menu' });
      menu.append(h('button', { type: 'button', role: 'menuitem', onclick: function () { copyLink(p.id); closeMenu(); } }, icon('link'), 'Bağlantıyı kopyala'));
      if (state.me && state.me.id === p.user_id) {
        menu.append(h('button', { type: 'button', role: 'menuitem', class: 'danger', onclick: function () { closeMenu(); deletePost(p, card, opts); } }, icon('trash'), 'Sil'));
      } else {
        menu.append(h('button', { type: 'button', role: 'menuitem', onclick: function () { closeMenu(); reportModal('post', p.id); } }, icon('flag'), 'Şikayet et'));
      }
      card.append(menu);
      setTimeout(function () { document.addEventListener('click', closeMenu, { once: true }); }, 0);
    } }, icon('more'));
    function closeMenu() { if (menu) { menu.remove(); menu = null; } }

    card.append(h('div', { class: 'card-head' },
      h('a', { href: '#/u/' + encodeURIComponent(author.username || '') }, avatarEl(author, 40)),
      h('div', { class: 'who' },
        h('a', { href: '#/u/' + encodeURIComponent(author.username || '') }, h('b', null, nameOf(author))),
        h('span', { class: 'mono' }, '@' + (author.username || '') + ' · ' + timeAgo(p.created_at))),
      moreBtn));

    function burstHeart(box) {
      var b = h('div', { class: 'burst' }, icon('heart'));
      box.append(b);
      setTimeout(function () { b.remove(); }, 850);
    }
    var media = mediaEl(p, function () { if (!opts.detail) location.hash = '#/p/' + p.id; }, function (box) {
      burstHeart(box);
      if (!st.liked) toggle('likes', likeBtn, 'liked', 'likes');
    });
    card.append(media);

    function mk(kind, ico, label) {
      return h('button', { class: 'act', type: 'button', 'data-k': kind, 'aria-label': label, 'aria-pressed': 'false' }, icon(ico), h('span', { class: 'n' }));
    }
    var likeBtn = mk('like', 'heart', 'Beğen');
    var repBtn = mk('repost', 'repeat', 'Repost');
    var favBtn = mk('fav', 'bookmark', 'Favorilere ekle');
    var comBtn = h('a', { class: 'act', href: '#/p/' + p.id, 'aria-label': 'Yorumlar' }, icon('comment'), h('span', { class: 'n' }));
    function paint() {
      [[likeBtn, st.liked, st.likes], [repBtn, st.rep, st.reposts], [favBtn, st.fav, 0]].forEach(function (x) {
        x[0].classList.toggle('on', x[1]);
        x[0].setAttribute('aria-pressed', x[1] ? 'true' : 'false');
        $('.n', x[0]).textContent = x[2] ? fmt(x[2]) : '';
      });
      $('.n', comBtn).textContent = st.comments ? fmt(st.comments) : '';
    }
    async function toggle(table, btn, key, countKey) {
      if (!requireLogin()) return;
      if (btn._busy) return;
      btn._busy = true;
      var want = !st[key];
      st[key] = want;
      if (countKey) st[countKey] += want ? 1 : -1;
      paint();
      if (want) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
      var q = want ? sb.from(table).insert({ post_id: p.id, user_id: state.me.id }) : sb.from(table).delete().match({ post_id: p.id, user_id: state.me.id });
      var r = await q;
      if (r.error && !(want && r.error.code === '23505')) {
        st[key] = !want;
        if (countKey) st[countKey] += want ? -1 : 1;
        paint();
        toast(friendlyError(r.error), true);
      }
      btn._busy = false;
    }
    likeBtn.addEventListener('click', function () { toggle('likes', likeBtn, 'liked', 'likes'); });
    repBtn.addEventListener('click', function () {
      if (state.me && state.me.id === p.user_id) { toast('Kendi paylaşımını repost edemezsin.'); return; }
      toggle('reposts', repBtn, 'rep', 'reposts').then(function () { if (st.rep) toast('Profiline repost edildi.'); });
    });
    favBtn.addEventListener('click', function () { toggle('favorites', favBtn, 'fav', null).then(function () { if (st.fav) toast('Favorilere eklendi.'); }); });
    card.append(h('div', { class: 'actions' }, likeBtn, comBtn, repBtn, h('span', { class: 'sp' }), favBtn));
    paint();

    var body = h('div', { class: 'card-body' });
    if (p.caption) body.append(h('p', { class: 'caption' }, h('b', null, author.username || ''), rich(p.caption)));
    if (!opts.detail && st.comments > 0) body.append(h('a', { class: 'more-link', href: '#/p/' + p.id }, st.comments === 1 ? '1 yorumu gör' : st.comments + ' yorumun tümünü gör'));
    if (body.childNodes.length) card.append(body);
    card.bumpComments = function (d) { st.comments += d; paint(); };
    return card;
  }

  function copyLink(id) {
    var url = location.origin + location.pathname + '#/p/' + id;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('Bağlantı kopyalandı.'); }, function () { toast(url); });
    } else toast(url);
  }
  async function deletePost(p, card, opts) {
    var ok = await confirmModal('Bu paylaşım silinsin mi?', 'Sil', true);
    if (!ok) return;
    var r = await sb.from('posts').delete().eq('id', p.id);
    if (r.error) { toast(friendlyError(r.error), true); return; }
    mediaList(p).forEach(function (it) { removeFile(it.media_path); });
    toast('Paylaşım silindi.');
    if (opts && opts.detail) location.hash = '#/'; else card.remove();
  }
  function reportModal(type, id) {
    if (!requireLogin()) return;
    var reasons = ['Spam', 'Uygunsuz içerik', 'Taciz veya nefret', 'Başka bir sebep'];
    var chosen = reasons[0];
    var note = h('textarea', { class: 'textarea', maxlength: '300', placeholder: 'İstersen ayrıntı ekle', 'aria-label': 'Ayrıntı' });
    var err = h('div', { class: 'hint bad', role: 'alert' });
    var m;
    var send = h('button', { class: 'btn', type: 'button', onclick: async function () {
      send.disabled = true;
      var reason = chosen + (note.value.trim() ? ': ' + note.value.trim() : '');
      var r = await sb.from('reports').insert({ reporter_id: state.me.id, target_type: type, target_id: id, reason: reason.slice(0, 300) });
      if (r.error) { err.textContent = friendlyError(r.error); send.disabled = false; return; }
      m.close(); toast('Şikayetin alındı, teşekkürler.');
    } }, 'Gönder');
    m = modal(h('div', { style: { display: 'contents' } },
      h('h2', null, 'Şikayet et'),
      reasons.map(function (rs, i) {
        return h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'rs', checked: i === 0, onchange: function () { chosen = rs; } }), rs);
      }),
      note, err,
      h('div', { class: 'row' }, h('button', { class: 'btn quiet', type: 'button', onclick: function () { m.close(); } }, 'Vazgeç'), send)), 'Şikayet');
  }

  /* ================= hikayeler ================= */
  var SEEN_KEY = 'kare_seen';
  function seenSet() { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')); } catch (e) { return new Set(); } }
  function markSeen(id) {
    var s = seenSet(); s.add(id);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s).slice(-400))); } catch (e) {}
  }
  async function fetchStoryGroups() {
    var since = new Date(Date.now() - 864e5).toISOString();
    var r = await sb.from('stories').select('id,user_id,media_path,media_type,caption,created_at,author:profiles!stories_user_id_fkey(' + PROFILE_SEL + ')').gte('created_at', since).order('created_at', { ascending: true }).limit(300);
    if (r.error) return [];
    var map = {}, groups = [];
    r.data.forEach(function (s) {
      if (!map[s.user_id]) { map[s.user_id] = { user: s.author, stories: [] }; groups.push(map[s.user_id]); }
      map[s.user_id].stories.push(s);
    });
    var seen = seenSet();
    groups.forEach(function (g) { g.unseen = g.stories.some(function (s) { return !seen.has(s.id); }); g.latest = ms(g.stories[g.stories.length - 1].created_at); });
    var myId = state.me && state.me.id;
    groups.sort(function (a, b) {
      if (a.user.id === myId) return -1; if (b.user.id === myId) return 1;
      if (a.unseen !== b.unseen) return a.unseen ? -1 : 1;
      return b.latest - a.latest;
    });
    return groups;
  }
  async function renderStoriesBar(host, tok) {
    var groups = await fetchStoryGroups();
    if (tok !== routeTok) return;
    var bar = h('div', { class: 'stories', role: 'list', 'aria-label': 'Hikayeler' });
    var myId = state.me && state.me.id;
    var mine = groups.find(function (g) { return g.user.id === myId; });
    if (state.me && !mine) {
      bar.append(h('button', { class: 'story own-empty', type: 'button', role: 'listitem', 'aria-label': 'Hikaye ekle', onclick: function () { uploadModal('story'); } },
        h('span', { class: 'ringwrap' }, avatarEl(state.me, 58), h('span', { class: 'plus' }, icon('plus'))),
        h('span', { class: 'nm' }, 'Hikayen')));
    }
    groups.forEach(function (g, idx) {
      var own = g.user.id === myId;
      bar.append(h('button', { class: 'story' + (g.unseen ? '' : ' seen'), type: 'button', role: 'listitem', 'aria-label': nameOf(g.user) + ' hikayesi', onclick: function () { openStories(groups, idx, function () { renderStoriesBar(host, routeTok); }); } },
        h('span', { class: 'ringwrap' }, avatarEl(g.user, 58)),
        h('span', { class: 'nm' }, own ? 'Hikayen' : nameOf(g.user))));
    });
    host.replaceChildren(groups.length || state.me ? bar : '');
  }

  function openStories(groups, gi, onClose) {
    var seen = seenSet();
    var g = groups[gi];
    var si = Math.max(0, g.stories.findIndex(function (s) { return !seen.has(s.id); }));
    var raf = 0, running = false, t0 = 0, vid = null, cur = null, fill = null, closed = false, elapsed = 0, anim = '';
    var root = h('div', { class: 'sv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Hikaye' });
    document.body.append(root);
    lock();
    var DUR = 5500;
    function stop() { running = false; cancelAnimationFrame(raf); if (vid) vid.pause(); root.classList.add('held'); }
    function loop(now) {
      if (!running) return;
      var pct;
      if (vid && vid.duration) pct = vid.currentTime / vid.duration;
      else pct = (now - t0) / DUR;
      if (fill) fill.style.transform = 'scaleX(' + Math.min(1, pct) + ')';
      if (pct >= 1 || (vid && vid.ended)) { next(); return; }
      raf = requestAnimationFrame(loop);
    }
    function play() {
      if (running || closed) return;
      running = true; root.classList.remove('held');
      t0 = performance.now() - elapsed;
      if (vid) vid.play().catch(function () { vid.muted = true; vid.play().catch(function () {}); });
      raf = requestAnimationFrame(loop);
    }
    function pause() { if (!running) return; elapsed = performance.now() - t0; stop(); }
    function close() {
      if (closed) return;
      closed = true; stop();
      document.removeEventListener('keydown', key);
      root.classList.add('closing');
      setTimeout(function () { root.remove(); unlock(); if (onClose) onClose(); }, 200);
    }
    function next() {
      if (si < g.stories.length - 1) { si++; anim = 'next'; show(); }
      else nextUser();
    }
    function prev() {
      if (si > 0) { si--; anim = 'prev'; show(); }
      else if (gi > 0) { gi--; g = groups[gi]; si = g.stories.length - 1; anim = 'uprev'; show(); }
      else { elapsed = 0; anim = ''; show(); }
    }
    function nextUser() {
      if (gi < groups.length - 1) { gi++; g = groups[gi]; si = Math.max(0, g.stories.findIndex(function (s) { return !seenSet().has(s.id); })); anim = 'unext'; show(); }
      else close();
    }
    function prevUser() {
      if (gi > 0) { gi--; g = groups[gi]; si = 0; anim = 'uprev'; show(); }
    }
    function key(ev) {
      if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) { if (ev.key === 'Escape') ev.target.blur(); return; }
      if (ev.key === 'Escape') close();
      else if (ev.key === 'ArrowRight') next();
      else if (ev.key === 'ArrowLeft') prev();
      else if (ev.key === ' ') { ev.preventDefault(); running ? pause() : play(); }
    }
    document.addEventListener('keydown', key);

    function sendToOwner(text, thenToast) {
      if (!requireLogin()) return Promise.resolve(false);
      return sb.from('messages').insert({ sender_id: state.me.id, recipient_id: g.user.id, body: text.slice(0, 1000) }).then(function (r) {
        if (r.error) { toast(friendlyError(r.error), true); return false; }
        toast(thenToast); return true;
      });
    }
    function floatEmoji(frame, emo) {
      for (var k = 0; k < 7; k++) {
        (function (k) {
          var e = h('span', { class: 'flo', 'aria-hidden': 'true', style: { '--x': (Math.random() * 120 - 60).toFixed(0) + 'px', '--d': (k * 70) + 'ms', '--r': (Math.random() * 40 - 20).toFixed(0) + 'deg' } }, emo);
          frame.append(e); setTimeout(function () { e.remove(); }, 1700 + k * 70);
        })(k);
      }
    }

    function show() {
      stop(); elapsed = 0;
      var old = root.firstChild;
      cur = g.stories[si];
      markSeen(cur.id);
      var bars = h('div', { class: 'bars' });
      g.stories.forEach(function (s, i) {
        var b = h('b'); if (i < si) b.style.transform = 'scaleX(1)';
        if (i === si) fill = b;
        bars.append(h('i', null, b));
      });
      var own = state.me && cur.user_id === state.me.id;
      var head = h('div', { class: 'shead' },
        h('a', { href: '#/u/' + encodeURIComponent(g.user.username), onclick: function () { close(); } }, avatarEl(g.user, 36)),
        h('div', { class: 'who' }, h('b', null, nameOf(g.user)), h('span', { class: 'mono', style: { color: 'rgba(255,255,255,.8)' } }, timeAgo(cur.created_at))),
        own ? h('button', { type: 'button', 'aria-label': 'Hikayeyi sil', onclick: async function () {
          pause();
          var ok = await confirmModal('Bu hikaye silinsin mi?', 'Sil', true);
          if (!ok) { play(); return; }
          var r = await sb.from('stories').delete().eq('id', cur.id);
          if (r.error) { toast(friendlyError(r.error), true); play(); return; }
          removeFile(cur.media_path);
          g.stories.splice(si, 1);
          toast('Hikaye silindi.');
          anim = '';
          if (!g.stories.length) { groups.splice(gi, 1); if (!groups.length) { close(); return; } if (gi >= groups.length) gi = groups.length - 1; g = groups[gi]; si = 0; }
          else if (si >= g.stories.length) si = g.stories.length - 1;
          show();
        } }, icon('trash')) : null,
        h('button', { type: 'button', 'aria-label': 'Kapat', onclick: close }, icon('x')));
      var frame = h('div', { class: 'frame' + (anim ? ' in-' + anim : '') });
      vid = null;
      if (cur.media_type === 'video') {
        vid = h('video', { src: mediaUrl(cur.media_path), playsinline: true, preload: 'auto' });
        frame.append(vid);
      } else {
        frame.append(h('img', { class: 'kb', src: mediaUrl(cur.media_path), alt: 'Hikaye' }));
      }
      var nx = g.stories[si + 1];
      if (nx && nx.media_type !== 'video') { var pre = new Image(); pre.src = mediaUrl(nx.media_path); }
      if (cur.caption) frame.append(h('div', { class: 'scap' }, h('span', null, cur.caption)));
      var zl = h('button', { class: 'zone l', type: 'button', 'aria-label': 'Önceki', onclick: prev });
      var zr = h('button', { class: 'zone r', type: 'button', 'aria-label': 'Sonraki', onclick: next });
      [zl, zr].forEach(function (z) {
        var down = 0;
        z.addEventListener('pointerdown', function () { down = Date.now(); pause(); });
        z.addEventListener('pointerup', function (ev) { if (Date.now() - down > 220) { ev.preventDefault(); z._skip = true; } if (!frame._typing) play(); });
        z.addEventListener('pointercancel', function () { if (!frame._typing) play(); });
        z.addEventListener('click', function (ev) { if (z._skip) { z._skip = false; ev.stopImmediatePropagation(); } }, true);
      });
      frame.append(bars, head, zl, zr);

      if (!own) {
        var inp = h('input', { class: 'sreply', type: 'text', maxlength: '300', placeholder: nameOf(g.user) + ' kişisine yanıt yaz', 'aria-label': 'Hikayeye yanıt' });
        var sendB = h('button', { class: 'ssend', type: 'submit', 'aria-label': 'Gönder' }, icon('send'));
        var reply = h('form', { class: 'sbar' },
          h('div', { class: 'emos' }, ['❤️', '🔥', '😂', '😮', '👏'].map(function (emo) {
            return h('button', { type: 'button', 'aria-label': 'Tepki ' + emo, onclick: async function () {
              floatEmoji(frame, emo);
              await sendToOwner(emo + ' hikayene tepki verdi', 'Tepkin gönderildi');
            } }, emo);
          })),
          h('div', { class: 'srow' }, inp, sendB));
        inp.addEventListener('focus', function () { frame._typing = true; pause(); });
        inp.addEventListener('blur', function () { frame._typing = false; play(); });
        reply.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var t = inp.value.trim(); if (!t) return;
          if (await sendToOwner('↩️ Hikayene yanıt: ' + t, 'Yanıtın gönderildi')) { inp.value = ''; inp.blur(); }
        });
        frame.append(reply);
      }

      // kaydırma hareketleri: aşağı = kapat, yana = kişi değiştir
      var sx = 0, sy = 0, tracking = false;
      frame.addEventListener('pointerdown', function (ev) { if (ev.target.closest('.sbar')) return; sx = ev.clientX; sy = ev.clientY; tracking = true; });
      frame.addEventListener('pointerup', function (ev) {
        if (!tracking) return; tracking = false;
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.4) { frame._swiped = true; close(); }
        else if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.4) { frame._swiped = true; if (dx < 0) nextUser(); else prevUser(); }
      });

      if (old && anim) {
        old.classList.add('ghost', 'out-' + anim);
        old.querySelectorAll('button, input').forEach(function (b) { b.tabIndex = -1; });
        root.append(frame);
        setTimeout(function () { old.remove(); }, 380);
      } else root.replaceChildren(frame);
      anim = '';
      if (vid) vid.addEventListener('loadeddata', play, { once: true });
      else play();
    }
    show();
  }

  /* ================= sayfalar ================= */
  function skeletons(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(h('div', { class: 'sk sk-card' }));
    return a;
  }
  function emptyState(title, text, btn) {
    return h('div', { class: 'empty' }, h('h2', null, title), text ? h('p', null, text) : null, btn || null);
  }

  async function feedPage(tok) {
    var tab = 'all';
    try { tab = sessionStorage.getItem('kare_tab') === 'follow' && state.me ? 'follow' : 'all'; } catch (e) {}
    var storiesHost = h('div');
    var list = h('div', { class: 'feed' });
    var moreWrap = h('div', { class: 'loadmore', hidden: true });
    var tabAll = h('button', { class: 'tab', role: 'tab', type: 'button', onclick: function () { setTab('all'); } }, 'Keşfet');
    var tabFollow = h('button', { class: 'tab', role: 'tab', type: 'button', onclick: function () { if (!requireLogin()) return; setTab('follow'); } }, 'Takip');
    var tabs = h('div', { class: 'tabs', role: 'tablist' }, tabAll, tabFollow);
    var pendingNew = 0;
    var banner = h('button', { class: 'newposts', type: 'button', hidden: true, onclick: function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      load(true);
    } });
    var wrap = h('div', { class: 'page-in' }, storiesHost, tabs, banner, list, moreWrap);
    $('#view').replaceChildren(wrap);
    var cursor = null, seenKeys = new Set(), loading = false, version = 0;
    state.onNewPost = function () {
      pendingNew++;
      banner.textContent = pendingNew + (pendingNew === 1 ? ' yeni paylaşım' : ' yeni paylaşım var');
      banner.hidden = false;
    };

    function paintTabs() {
      tabAll.setAttribute('aria-selected', tab === 'all' ? 'true' : 'false');
      tabFollow.setAttribute('aria-selected', tab === 'follow' ? 'true' : 'false');
    }
    async function load(reset) {
      if (loading) return;
      loading = true;
      var my = ++version;
      if (reset) { list.replaceChildren.apply(list, skeletons(2)); seenKeys = new Set(); cursor = null; moreWrap.hidden = true; pendingNew = 0; banner.hidden = true; }
      try {
        var r = await fetchFeed(tab, reset ? null : cursor);
        if (tok !== routeTok || my !== version) { loading = false; return; }
        if (reset) list.replaceChildren();
        var added = 0;
        r.items.forEach(function (it, i) {
          if (seenKeys.has(it.key)) return;
          seenKeys.add(it.key);
          list.append(postCard(it, { enter: true, i: added++ }));
        });
        cursor = r.cursor;
        moreWrap.hidden = !cursor;
        if (!list.children.length) {
          list.replaceChildren(tab === 'follow'
            ? emptyState('Takip ettiklerin burada görünür', 'Henüz takip ettiğin kimse paylaşım yapmadı. Keşfet sekmesinden insanları bul.', h('button', { class: 'btn', type: 'button', onclick: function () { setTab('all'); } }, 'Keşfet\'e git'))
            : emptyState('İlk kare senden gelsin', 'Henüz kimse bir şey paylaşmadı.', h('button', { class: 'btn', type: 'button', onclick: function () { if (requireLogin()) uploadModal('post'); } }, 'Paylaş')));
        }
      } catch (e) {
        if (tok === routeTok) list.replaceChildren(emptyState('Akış yüklenemedi', friendlyError(e), h('button', { class: 'btn', type: 'button', onclick: function () { load(true); } }, 'Tekrar dene')));
      }
      loading = false;
    }
    function setTab(t) {
      tab = t; try { sessionStorage.setItem('kare_tab', t); } catch (e) {}
      paintTabs(); load(true);
    }
    moreWrap.append(h('button', { class: 'btn quiet', type: 'button', onclick: function () { load(false); } }, 'Daha fazla göster'));
    if ('IntersectionObserver' in window) {
      if (feedIO) feedIO.disconnect();
      feedIO = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting && cursor && !loading && !moreWrap.hidden) load(false);
      }, { rootMargin: '700px 0px' });
      feedIO.observe(moreWrap);
    }
    paintTabs();
    renderStoriesBar(storiesHost, tok);
    load(true);
  }

  async function postPage(id, tok) {
    var view = $('#view');
    view.replaceChildren(h('div', { class: 'sk sk-card' }));
    var r = await sb.from('posts').select(POST_SEL).eq('id', id).maybeSingle();
    if (tok !== routeTok) return;
    if (r.error || !r.data) { view.replaceChildren(emptyState('Paylaşım bulunamadı', 'Silinmiş ya da bağlantı hatalı olabilir.', h('a', { class: 'btn', href: '#/' }, 'Ana sayfa'))); return; }
    var item = { post: r.data, mine: {} };
    await attachMine([item]);
    if (tok !== routeTok) return;
    var card = postCard(item, { detail: true });
    var cl = h('div', { class: 'comments' });
    var wrap = h('div', { class: 'page-in' },
      h('button', { class: 'back', type: 'button', onclick: function () { if (history.length > 1) history.back(); else location.hash = '#/'; } }, icon('back'), 'Geri'),
      card, cl);
    view.replaceChildren(wrap);

    var postOwner = r.data.user_id;
    function commentRow(c, enter) {
      var row = h('div', { class: 'comment' + (enter ? ' enter' : '') },
        h('a', { href: '#/u/' + encodeURIComponent(c.author.username) }, avatarEl(c.author, 34)),
        h('div', { class: 'txt' }, h('b', null, c.author.username), rich(c.body), h('span', { class: 'mono' }, timeAgo(c.created_at))));
      if (state.me && (state.me.id === c.user_id || state.me.id === postOwner)) {
        row.append(h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Yorumu sil', style: { width: '34px', height: '34px' }, onclick: async function () {
          var d = await sb.from('comments').delete().eq('id', c.id);
          if (d.error) { toast(friendlyError(d.error), true); return; }
          row.remove(); card.bumpComments(-1);
        } }, icon('trash')));
      }
      return row;
    }
    var cr = await sb.from('comments').select('id,body,created_at,user_id,author:profiles!comments_user_id_fkey(' + PROFILE_SEL + ')').eq('post_id', id).order('created_at', { ascending: true }).limit(300);
    if (tok !== routeTok) return;
    var listEl = h('div', { class: 'comments', style: { marginTop: '0' } });
    (cr.data || []).forEach(function (c) { listEl.append(commentRow(c, false)); });
    var input = h('input', { class: 'input', id: 'c-in', type: 'text', maxlength: '500', placeholder: 'Yorum yaz', autocomplete: 'off', 'aria-label': 'Yorum yaz' });
    var send = h('button', { class: 'btn', type: 'submit', 'aria-label': 'Gönder' }, icon('send'));
    var form = h('form', { class: 'cform' }, input, send);
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      if (!requireLogin()) return;
      var body = input.value.trim();
      if (!body) return;
      send.disabled = true;
      var ins = await sb.from('comments').insert({ post_id: id, user_id: state.me.id, body: body }).select('id,body,created_at,user_id,author:profiles!comments_user_id_fkey(' + PROFILE_SEL + ')').single();
      send.disabled = false;
      if (ins.error) { toast(friendlyError(ins.error), true); return; }
      input.value = '';
      listEl.append(commentRow(ins.data, true));
      card.bumpComments(1);
    });
    cl.append(h('h2', { style: { fontSize: '20px' } }, 'Yorumlar'), form, listEl);
    if (!cr.data || !cr.data.length) listEl.append(h('p', { class: 'hint', style: { margin: 0 } }, 'İlk yorumu sen yaz.'));
  }

  function bannerFallback(name, cls) {
    var hue = 0;
    for (var i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360;
    return h('div', { class: 'bn-fallback ' + (cls || ''), style: { '--h1': String(hue), '--h2': String((hue + 55) % 360) } });
  }
  function gridTile(post, i) {
    var t = h('a', { class: 'tile enter', href: '#/p/' + post.id, style: { '--i': String(Math.min(i, 14)) }, 'aria-label': 'Paylaşımı aç' });
    if (post.media_type === 'video') {
      var v = h('video', { src: mediaUrl(post.media_path) + '#t=0.1', preload: 'metadata', playsinline: true });
      v.muted = true;
      t.append(v, h('span', { class: 'badge' }, icon('play')));
    } else t.append(h('img', { src: mediaUrl(post.media_path), alt: '', loading: 'lazy', decoding: 'async' }));
    if (post.media && post.media.length > 1) t.append(h('span', { class: 'badge multi' }, icon('layers')));
    t.append(h('span', { class: 'over' }, h('span', null, icon('heart'), fmt(cnt(post.likes))), h('span', null, icon('comment'), fmt(cnt(post.comments)))));
    return t;
  }

  async function profilePage(username, tok) {
    var view = $('#view');
    view.replaceChildren(h('div', { class: 'sk sk-card', style: { height: '220px' } }));
    var r = await sb.from('profiles').select('id,username,display_name,bio,avatar_path,banner_path,created_at').eq('username', username.toLowerCase()).maybeSingle();
    if (tok !== routeTok) return;
    if (r.error || !r.data) { view.replaceChildren(emptyState('Kullanıcı bulunamadı', '@' + username + ' adında biri yok.', h('a', { class: 'btn', href: '#/' }, 'Ana sayfa'))); return; }
    var pr = r.data;
    var isMe = state.me && state.me.id === pr.id;
    var counts = await Promise.all([
      sb.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', pr.id),
      sb.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', pr.id),
      sb.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', pr.id)
    ]);
    if (tok !== routeTok) return;
    var nPosts = counts[0].count || 0, nFollowers = counts[1].count || 0, nFollowing = counts[2].count || 0;
    var followersEl = h('b', null, fmt(nFollowers));
    var action;
    if (isMe) {
      action = h('a', { class: 'btn quiet small', href: '#/ayarlar' }, 'Profili düzenle');
    } else {
      var f = state.following.has(pr.id);
      action = h('button', { class: f ? 'btn quiet small' : 'btn small', type: 'button' }, f ? 'Takiptesin' : 'Takip et');
      action.addEventListener('click', async function () {
        if (!requireLogin()) return;
        action.disabled = true;
        var now = state.following.has(pr.id);
        var q = now ? sb.from('follows').delete().match({ follower_id: state.me.id, following_id: pr.id }) : sb.from('follows').insert({ follower_id: state.me.id, following_id: pr.id });
        var res = await q;
        action.disabled = false;
        if (res.error && res.error.code !== '23505') { toast(friendlyError(res.error), true); return; }
        if (now) { state.following.delete(pr.id); nFollowers--; } else { state.following.add(pr.id); nFollowers++; }
        followersEl.textContent = fmt(nFollowers);
        action.className = state.following.has(pr.id) ? 'btn quiet small' : 'btn small';
        action.textContent = state.following.has(pr.id) ? 'Takiptesin' : 'Takip et';
      });
    }
    var banner = h('div', { class: 'pbanner' }, pr.banner_path ? h('img', { src: mediaUrl(pr.banner_path), alt: '', decoding: 'async' }) : bannerFallback(pr.username));
    var head = h('div', { class: 'phead' },
      avatarEl(pr, 96),
      h('div', { class: 'info' },
        h('div', null, h('h1', null, nameOf(pr)), h('span', { class: 'mono' }, '@' + pr.username)),
        h('div', { class: 'stats' },
          h('div', null, h('b', null, fmt(nPosts)), h('span', { class: 'mono' }, 'Kare')),
          h('div', null, followersEl, h('span', { class: 'mono' }, 'Takipçi')),
          h('div', null, h('b', null, fmt(nFollowing)), h('span', { class: 'mono' }, 'Takip'))),
        pr.bio ? h('p', { class: 'bio' }, pr.bio) : null,
        h('div', { class: 'prow' }, action, isMe ? null : h('a', { class: 'btn quiet small', href: '#/mesajlar/' + encodeURIComponent(pr.username) }, 'Mesaj'))));
    var gridHost = h('div');
    var tabPosts = h('button', { class: 'tab', role: 'tab', type: 'button', onclick: function () { showTab('posts'); } }, 'Paylaşımlar');
    var tabReposts = h('button', { class: 'tab', role: 'tab', type: 'button', onclick: function () { showTab('reposts'); } }, 'Repostlar');
    var tabs = h('div', { class: 'tabs', role: 'tablist' }, tabPosts, tabReposts);
    var wrap = h('div', { class: 'page-in' }, banner, head, tabs, gridHost);
    view.replaceChildren(wrap);
    async function showTab(t) {
      tabPosts.setAttribute('aria-selected', t === 'posts' ? 'true' : 'false');
      tabReposts.setAttribute('aria-selected', t === 'reposts' ? 'true' : 'false');
      gridHost.replaceChildren(h('div', { class: 'sk', style: { height: '200px' } }));
      var posts = [];
      if (t === 'posts') {
        var pq = await sb.from('posts').select(GRID_SEL).eq('user_id', pr.id).order('created_at', { ascending: false }).limit(60);
        if (pq.error) { if (tok === routeTok) gridHost.replaceChildren(emptyState('Yüklenemedi', friendlyError(pq.error))); return; }
        posts = pq.data;
      } else {
        var rq = await sb.from('reposts').select('created_at,post:posts!reposts_post_id_fkey(' + GRID_SEL + ')').eq('user_id', pr.id).order('created_at', { ascending: false }).limit(60);
        if (rq.error) { if (tok === routeTok) gridHost.replaceChildren(emptyState('Yüklenemedi', friendlyError(rq.error))); return; }
        posts = rq.data.map(function (x) { return x.post; }).filter(Boolean);
      }
      if (tok !== routeTok) return;
      if (!posts.length) {
        gridHost.replaceChildren(emptyState(t === 'posts' ? 'Henüz paylaşım yok' : 'Henüz repost yok', isMe && t === 'posts' ? 'İlk karını paylaşmak için + düğmesine bas.' : null));
        return;
      }
      var grid = h('div', { class: 'grid' });
      posts.forEach(function (p, i) { grid.append(gridTile(p, i)); });
      gridHost.replaceChildren(grid);
    }
    showTab('posts');
  }

  async function favoritesPage(tok) {
    var view = $('#view');
    if (!state.me) {
      view.replaceChildren(emptyState('Favorilerini görmek için giriş yap', 'Beğendiğin paylaşımları kaydet, burada hep yanında olsun.', h('button', { class: 'btn', type: 'button', onclick: function () { authModal('in'); } }, 'Giriş yap')));
      return;
    }
    view.replaceChildren(h('div', { class: 'sk', style: { height: '240px' } }));
    var r = await sb.from('favorites').select('created_at,post:posts!favorites_post_id_fkey(' + GRID_SEL + ')').eq('user_id', state.me.id).order('created_at', { ascending: false }).limit(90);
    if (tok !== routeTok) return;
    var posts = (r.data || []).map(function (x) { return x.post; }).filter(Boolean);
    var wrap = h('div', { class: 'page-in' }, h('h1', { style: { fontSize: '30px', marginBottom: '16px' } }, 'Favoriler'));
    if (!posts.length) wrap.append(emptyState('Henüz favorin yok', 'Bir paylaşımdaki yer imi simgesine bas, burada görünsün.'));
    else { var grid = h('div', { class: 'grid' }); posts.forEach(function (p, i) { grid.append(gridTile(p, i)); }); wrap.append(grid); }
    view.replaceChildren(wrap);
  }

  async function settingsPage(tok) {
    var view = $('#view');
    if (!state.me) { view.replaceChildren(emptyState('Ayarlar için giriş yap', null, h('button', { class: 'btn', type: 'button', onclick: function () { authModal('in'); } }, 'Giriş yap'))); return; }
    var me = state.me;
    var newAvatar = null, previewUrl = null, newBanner = null, bannerUrl = null, removeBanner = false;
    var avHost = h('div', null, avatarEl(me, 96));
    var file = h('input', { class: 'sr', id: 's-av', type: 'file', accept: 'image/*' });
    file.addEventListener('change', async function () {
      var f = file.files[0]; if (!f) return;
      try {
        newAvatar = await prepareMedia(f, { max: 320, square: true, imageOnly: true });
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(newAvatar.blob);
        avHost.replaceChildren(h('span', { class: 'av', style: { '--s': '96px' } }, h('img', { src: previewUrl, alt: '' })));
      } catch (e) { toast(friendlyError(e), true); }
    });
    var bnHost = h('div', { class: 'bn-prev' });
    function paintBanner(src) {
      bnHost.replaceChildren(src ? h('img', { src: src, alt: 'Banner önizleme' }) : bannerFallback(me.username, 'bn-ph'));
    }
    paintBanner(me.banner_path ? mediaUrl(me.banner_path) : null);
    var bnFile = h('input', { class: 'sr', id: 's-bn', type: 'file', accept: 'image/*' });
    bnFile.addEventListener('change', async function () {
      var f = bnFile.files[0]; if (!f) return;
      try {
        newBanner = await prepareMedia(f, { banner: true, imageOnly: true });
        if (bannerUrl) URL.revokeObjectURL(bannerUrl);
        bannerUrl = URL.createObjectURL(newBanner.blob); removeBanner = false;
        paintBanner(bannerUrl);
      } catch (e) { toast(friendlyError(e), true); }
    });
    var bnRemove = h('button', { class: 'btn quiet small', type: 'button', onclick: function () { newBanner = null; removeBanner = true; paintBanner(null); } }, 'Kaldır');
    var dn = h('input', { class: 'input', id: 's-dn', type: 'text', maxlength: '40', value: me.display_name || '' });
    var bio = h('textarea', { class: 'textarea', id: 's-bio', maxlength: '160' });
    bio.value = me.bio || '';
    var err = h('div', { class: 'hint bad', role: 'alert' });
    var save = h('button', { class: 'btn', type: 'submit' }, 'Kaydet');
    var form = h('form', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '16px' } }, avHost, h('label', { class: 'btn quiet small', for: 's-av' }, 'Fotoğrafı değiştir')),
      file, bnFile,
      h('div', { class: 'field' }, h('label', null, 'Profil bannerı'), bnHost,
        h('div', { class: 'prow' }, h('label', { class: 'btn quiet small', for: 's-bn' }, 'Banner seç'), bnRemove), h('span', { class: 'hint' }, 'Geniş (3:1) bir fotoğraf en iyisi. Otomatik kırpılır.')),
      h('div', { class: 'field' }, h('label', { for: 's-dn' }, 'Görünen ad'), dn),
      h('div', { class: 'field' }, h('label', { for: 's-bio' }, 'Hakkında'), bio, h('span', { class: 'hint' }, 'En fazla 160 karakter.')),
      err,
      h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } }, save, h('a', { class: 'btn quiet', href: '#/u/' + encodeURIComponent(me.username) }, 'Profilime dön')));
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault(); err.textContent = ''; save.disabled = true;
      try {
        var patch = { display_name: dn.value.trim() || null, bio: bio.value.trim() || null };
        var oldPath = me.avatar_path, oldBanner = me.banner_path;
        if (newBanner) patch.banner_path = await uploadPrepared(newBanner, 'banner-');
        else if (removeBanner) patch.banner_path = null;
        if (newAvatar) patch.avatar_path = await uploadPrepared(newAvatar, 'avatar-');
        var r = await sb.from('profiles').update(patch).eq('id', me.id).select('id,username,display_name,bio,avatar_path,banner_path').single();
        if (r.error) { if (newAvatar && patch.avatar_path) removeFile(patch.avatar_path); if (newBanner && patch.banner_path) removeFile(patch.banner_path); throw r.error; }
        if ('banner_path' in patch && oldBanner && oldBanner !== patch.banner_path) removeFile(oldBanner);
        if (newAvatar && oldPath && oldPath !== patch.avatar_path) removeFile(oldPath);
        state.me = r.data; me = r.data; newAvatar = null; newBanner = null; removeBanner = false;
        renderHeader();
        toast('Profilin güncellendi.');
      } catch (e) { err.textContent = friendlyError(e); }
      save.disabled = false;
    });
    var out = h('button', { class: 'btn danger', type: 'button', onclick: async function () { await sb.auth.signOut(); toast('Çıkış yapıldı.'); location.hash = '#/'; } }, icon('logout'), 'Çıkış yap');
    if (tok !== routeTok) return;
    view.replaceChildren(h('div', { class: 'page-in' }, h('h1', { style: { fontSize: '30px', marginBottom: '16px' } }, 'Profil ayarları'), form, installBox(), h('div', { style: { marginTop: '34px', paddingTop: '20px', borderTop: '1px solid var(--line)' } }, out)));
  }

  /* ---- uygulama gibi yükleme (PWA) ---- */
  var deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredInstall = e; });
  window.addEventListener('appinstalled', function () { deferredInstall = null; toast('Kare yüklendi'); });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  function installBox() {
    var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
    if (standalone) return h('span');
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var box = h('div', { class: 'install-box', style: { marginTop: '24px' } },
      h('div', null, h('b', null, 'Telefona uygulama gibi ekle'), h('p', { class: 'hint', style: { margin: '2px 0 0' } },
        ios ? 'Safari’de Paylaş düğmesine, sonra “Ana Ekrana Ekle”ye dokun.' : 'Ana ekrandan tek dokunuşla aç, tam ekran çalışır.')));
    if (!ios) box.append(h('button', { class: 'btn small', type: 'button', onclick: async function () {
      if (!deferredInstall) { toast('Tarayıcı menüsünden “Ana ekrana ekle”yi seç.'); return; }
      deferredInstall.prompt(); try { await deferredInstall.userChoice; } catch (e) {} deferredInstall = null;
    } }, icon('download'), 'Yükle'));
    return box;
  }

  /* ================= zengin metin, arama, bildirim, mesaj ================= */
  function rich(text) {
    var frag = document.createDocumentFragment();
    var re = /(#[\p{L}\p{N}_]{2,40}|@[a-z0-9_]{3,24})/gu;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) frag.append(text.slice(last, m.index));
      var tok = m[0];
      frag.append(h('a', { class: 'tag', href: tok[0] === '#' ? '#/ara/' + encodeURIComponent(tok) : '#/u/' + encodeURIComponent(tok.slice(1)) }, tok));
      last = m.index + tok.length;
    }
    if (last < text.length) frag.append(text.slice(last));
    return frag;
  }
  function likeEsc(s) { return s.replace(/[\\%_]/g, '\\$&'); }

  function followButton(pr) {
    var b = h('button', { type: 'button' });
    function paint() {
      var f = state.following.has(pr.id);
      b.className = f ? 'btn quiet small' : 'btn small';
      b.textContent = f ? 'Takiptesin' : 'Takip et';
    }
    b.addEventListener('click', async function () {
      if (!requireLogin()) return;
      b.disabled = true;
      var now = state.following.has(pr.id);
      var res = await (now
        ? sb.from('follows').delete().match({ follower_id: state.me.id, following_id: pr.id })
        : sb.from('follows').insert({ follower_id: state.me.id, following_id: pr.id }));
      b.disabled = false;
      if (res.error && res.error.code !== '23505') { toast(friendlyError(res.error), true); return; }
      if (now) state.following.delete(pr.id); else state.following.add(pr.id);
      paint();
    });
    paint();
    return b;
  }
  function userRow(pr, opts) {
    opts = opts || {};
    var row = h('div', { class: 'urow' },
      h('a', { class: 'ulink', href: opts.href || '#/u/' + encodeURIComponent(pr.username) },
        avatarEl(pr, 46),
        h('span', { class: 'uname' }, h('b', null, nameOf(pr)), h('span', { class: 'mono' }, '@' + pr.username))));
    if (!opts.noFollow && !(state.me && state.me.id === pr.id)) row.append(followButton(pr));
    return row;
  }
  function sectionTitle(t) { return h('h2', { style: { fontSize: '20px', marginBottom: '10px' } }, t); }
  function loginPrompt(title, text) {
    return emptyState(title, text, h('button', { class: 'btn', type: 'button', onclick: function () { authModal('in'); } }, 'Giriş yap'));
  }

  async function searchUsers(term, limit) {
    var esc = likeEsc(term.replace(/^@/, ''));
    var res = await Promise.all([
      sb.from('profiles').select(PROFILE_SEL).ilike('username', '%' + esc + '%').limit(limit),
      sb.from('profiles').select(PROFILE_SEL).ilike('display_name', '%' + esc + '%').limit(limit)
    ]);
    var seen = {}, users = [];
    (res[0].data || []).concat(res[1].data || []).forEach(function (u) { if (!seen[u.id]) { seen[u.id] = 1; users.push(u); } });
    return users.slice(0, limit);
  }

  async function searchPage(q, tok) {
    q = (q || '').trim();
    var view = $('#view');
    var input = h('input', { class: 'input', id: 'q', type: 'search', placeholder: 'Kişi, #etiket veya kelime ara', autocomplete: 'off', value: q, 'aria-label': 'Ara' });
    var out = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '18px' } });
    view.replaceChildren(h('div', { class: 'page-in' }, h('h1', { style: { fontSize: '30px', marginBottom: '14px' } }, 'Ara'), input, out));

    async function discover() {
      var nodes = [];
      var pr = await sb.from('profiles').select(PROFILE_SEL).order('created_at', { ascending: false }).limit(14);
      var ps = (pr.data || []).filter(function (p) { return !(state.me && p.id === state.me.id) && !state.following.has(p.id); }).slice(0, 8);
      var tg = await sb.from('posts').select('caption').not('caption', 'is', null).order('created_at', { ascending: false }).limit(150);
      var counts = {};
      (tg.data || []).forEach(function (r) {
        (r.caption.match(/#[\p{L}\p{N}_]{2,40}/gu) || []).forEach(function (t) { var k = t.toLowerCase(); counts[k] = (counts[k] || 0) + 1; });
      });
      var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 10);
      if (tags.length) {
        nodes.push(h('section', null, sectionTitle('Gündemdeki etiketler'),
          h('div', { class: 'chips' }, tags.map(function (t) { return h('a', { class: 'chip', href: '#/ara/' + encodeURIComponent(t) }, t, h('span', { class: 'mono' }, counts[t])); }))));
      }
      if (ps.length) {
        nodes.push(h('section', null, sectionTitle('Önerilen kişiler'),
          h('div', { class: 'ulist' }, ps.map(function (p) { return userRow(p); }))));
      }
      if (!nodes.length) nodes.push(emptyState('Henüz önerecek bir şey yok', 'Paylaşımlar geldikçe burada etiketler ve kişiler görünecek.'));
      return nodes;
    }
    async function results(term) {
      var nodes = [];
      var isTag = term[0] === '#';
      var esc = likeEsc(term);
      var postsP = sb.from('posts').select(GRID_SEL).ilike('caption', '%' + esc + '%').order('created_at', { ascending: false }).limit(30);
      var users = isTag ? [] : await searchUsers(term, 20);
      var posts = await postsP;
      if (users.length) nodes.push(h('section', null, sectionTitle('Kişiler'), h('div', { class: 'ulist' }, users.map(function (u) { return userRow(u); }))));
      var pdata = posts.data || [];
      if (pdata.length) {
        var grid = h('div', { class: 'grid' });
        pdata.forEach(function (p, i) { grid.append(gridTile(p, i)); });
        nodes.push(h('section', null, sectionTitle(isTag ? term + ' · ' + pdata.length + ' paylaşım' : 'Paylaşımlar'), grid));
      }
      if (!nodes.length) nodes.push(emptyState('Sonuç bulunamadı', '"' + term + '" için kişi ya da paylaşım yok.'));
      return nodes;
    }
    var seq = 0, timer = null;
    async function run(term) {
      var my = ++seq;
      term = term.trim();
      history.replaceState(null, '', '#/ara' + (term ? '/' + encodeURIComponent(term) : ''));
      out.replaceChildren(h('div', { class: 'sk', style: { height: '140px' } }));
      var nodes;
      try { nodes = term ? await results(term) : await discover(); }
      catch (e) { nodes = [emptyState('Arama yapılamadı', friendlyError(e))]; }
      if (tok !== routeTok || my !== seq) return;
      out.replaceChildren.apply(out, nodes);
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { run(input.value); }, 300); });
    run(q);
    if (!q && window.matchMedia && matchMedia('(hover: hover)').matches) input.focus();
  }

  var NOTIF_TEXT = { like: 'gönderini beğendi', comment: 'gönderine yorum yaptı', repost: 'gönderini repost etti', follow: 'seni takip etmeye başladı' };
  async function notificationsPage(tok) {
    var view = $('#view');
    if (!state.me) { view.replaceChildren(loginPrompt('Bildirimler için giriş yap', 'Beğeniler, yorumlar ve yeni takipçiler burada görünür.')); return; }
    var list = h('div', { class: 'ulist' }, h('div', { class: 'sk', style: { height: '120px' } }));
    view.replaceChildren(h('div', { class: 'page-in' }, h('h1', { style: { fontSize: '30px', marginBottom: '14px' } }, 'Bildirimler'), list));
    async function load() {
      var r = await sb.from('notifications').select('id,type,post_id,created_at,read_at,actor:profiles!notifications_actor_id_fkey(' + PROFILE_SEL + '),post:posts!notifications_post_id_fkey(id,media_path,media_type)').eq('user_id', state.me.id).order('created_at', { ascending: false }).limit(60);
      if (tok !== routeTok) return;
      if (r.error) { list.replaceChildren(emptyState('Yüklenemedi', friendlyError(r.error))); return; }
      if (!r.data.length) {
        list.replaceChildren(emptyState('Henüz bildirim yok', 'Biri seni takip edince, gönderini beğenince ya da yorum yapınca burada görünür.'));
        return;
      }
      var hadUnread = r.data.some(function (n) { return !n.read_at; });
      list.replaceChildren.apply(list, r.data.filter(function (n) { return n.actor; }).map(function (n, i) {
        var thumb = null;
        if (n.post) {
          thumb = n.post.media_type === 'image'
            ? h('img', { class: 'nthumb', src: mediaUrl(n.post.media_path), alt: '', loading: 'lazy' })
            : h('span', { class: 'nthumb vid' }, icon('play'));
        }
        return h('a', { class: 'nrow enter' + (n.read_at ? '' : ' unread'), style: { '--i': String(Math.min(i, 12)) }, href: n.post_id ? '#/p/' + n.post_id : '#/u/' + encodeURIComponent(n.actor.username) },
          avatarEl(n.actor, 44),
          h('span', { class: 'ntxt' }, h('span', null, h('b', null, n.actor.username), ' ' + (NOTIF_TEXT[n.type] || '')), h('span', { class: 'mono' }, timeAgo(n.created_at))),
          thumb);
      }));
      if (hadUnread) {
        await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', state.me.id).is('read_at', null);
        setBadge('notif', 0);
      }
    }
    state.onNotif = load;
    load();
  }

  async function messagesPage(tok) {
    var view = $('#view');
    if (!state.me) { view.replaceChildren(loginPrompt('Mesajlar için giriş yap', 'Arkadaşlarınla özel olarak yaz.')); return; }
    var list = h('div', { class: 'ulist' }, h('div', { class: 'sk', style: { height: '120px' } }));
    var found = h('div', { class: 'ulist' });
    var input = h('input', { class: 'input', id: 'nm', type: 'search', placeholder: 'Yeni mesaj için kişi ara', autocomplete: 'off', 'aria-label': 'Kişi ara' });
    view.replaceChildren(h('div', { class: 'page-in' }, h('h1', { style: { fontSize: '30px', marginBottom: '14px' } }, 'Mesajlar'), input, found, h('div', { style: { height: '14px' } }), list));
    var timer = null, seq = 0;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(async function () {
        var my = ++seq, t = input.value.trim();
        if (!t) { found.replaceChildren(); return; }
        var users = (await searchUsers(t, 8)).filter(function (u) { return u.id !== state.me.id; });
        if (tok !== routeTok || my !== seq) return;
        found.replaceChildren.apply(found, users.length
          ? users.map(function (u) { return userRow(u, { href: '#/mesajlar/' + encodeURIComponent(u.username), noFollow: true }); })
          : [h('p', { class: 'hint' }, 'Kimse bulunamadı.')]);
      }, 300);
    });
    async function load() {
      var c = await sb.rpc('my_conversations');
      if (tok !== routeTok) return;
      if (c.error) { list.replaceChildren(emptyState('Yüklenemedi', friendlyError(c.error))); return; }
      var convs = (c.data || []).slice().sort(function (a, b) { return ms(b.last_at) - ms(a.last_at); });
      setBadge('msg', convs.reduce(function (s, x) { return s + (x.unread || 0); }, 0));
      if (!convs.length) { list.replaceChildren(emptyState('Henüz mesajın yok', 'Yukarıdan birini arayıp yazmaya başla.')); return; }
      var ids = convs.map(function (x) { return x.partner_id; });
      var pr = await sb.from('profiles').select(PROFILE_SEL).in('id', ids);
      if (tok !== routeTok) return;
      var profs = {};
      (pr.data || []).forEach(function (p) { profs[p.id] = p; });
      list.replaceChildren.apply(list, convs.filter(function (x) { return profs[x.partner_id]; }).map(function (x, i) {
        var p = profs[x.partner_id];
        return h('a', { class: 'urow convo enter', style: { '--i': String(Math.min(i, 12)) }, href: '#/mesajlar/' + encodeURIComponent(p.username) },
          avatarEl(p, 48),
          h('span', { class: 'uname', style: { flex: '1' } }, h('b', null, nameOf(p)), h('span', { class: 'cprev' }, (x.last_sender === state.me.id ? 'Sen: ' : '') + x.last_body)),
          h('span', { class: 'cmeta' }, h('span', { class: 'mono' }, timeAgo(x.last_at)), x.unread ? h('span', { class: 'pill' }, String(x.unread)) : null));
      }));
    }
    state.onConvUpdate = load;
    load();
  }

  async function chatPage(username, tok) {
    var view = $('#view');
    if (!state.me) { view.replaceChildren(loginPrompt('Mesajlar için giriş yap', 'Arkadaşlarınla özel olarak yaz.')); return; }
    var pr = await sb.from('profiles').select(PROFILE_SEL).eq('username', username.toLowerCase()).maybeSingle();
    if (tok !== routeTok) return;
    if (!pr.data) { view.replaceChildren(emptyState('Kullanıcı bulunamadı', null, h('a', { class: 'btn', href: '#/mesajlar' }, 'Mesajlara dön'))); return; }
    var other = pr.data, me = state.me.id;
    if (other.id === me) { location.hash = '#/mesajlar'; return; }
    var box = h('div', { class: 'msgs', role: 'log', 'aria-live': 'polite' });
    var input = h('input', { class: 'input', id: 'm-in', type: 'text', maxlength: '1000', placeholder: 'Mesaj yaz', autocomplete: 'off', 'aria-label': 'Mesaj yaz' });
    var send = h('button', { class: 'btn', type: 'submit', 'aria-label': 'Gönder' }, icon('send'));
    var form = h('form', { class: 'cform chatform' }, input, send);
    var head = h('div', { class: 'chead' },
      h('a', { class: 'icon-btn', href: '#/mesajlar', 'aria-label': 'Mesajlara dön' }, icon('back')),
      h('a', { href: '#/u/' + encodeURIComponent(other.username) }, avatarEl(other, 40)),
      h('div', { class: 'who' }, h('b', null, nameOf(other)), h('span', { class: 'mono' }, '@' + other.username)));
    view.replaceChildren(h('div', { class: 'chat page-in' }, head, box, form));
    function bubble(m) {
      return h('div', { class: 'bub' + (m.sender_id === me ? ' mine' : '') }, h('span', null, m.body), h('span', { class: 'mono' }, timeAgo(m.created_at)));
    }
    function toBottom() { box.scrollTop = box.scrollHeight; }
    function markRead() {
      sb.from('messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', me).eq('sender_id', other.id).is('read_at', null)
        .then(function () { refreshCounts(); }, function () {});
    }
    var r = await sb.from('messages').select('id,sender_id,recipient_id,body,created_at')
      .or('and(sender_id.eq.' + me + ',recipient_id.eq.' + other.id + '),and(sender_id.eq.' + other.id + ',recipient_id.eq.' + me + ')')
      .order('created_at', { ascending: false }).limit(200);
    if (tok !== routeTok) return;
    var msgs = (r.data || []).slice().reverse();
    if (!msgs.length) box.append(h('p', { class: 'hint', style: { textAlign: 'center', margin: 'auto' } }, 'Konuşmayı başlat. İlk mesajı sen yaz.'));
    msgs.forEach(function (m) { box.append(bubble(m)); });
    toBottom();
    markRead();
    state.chat = {
      partnerId: other.id,
      onMsg: function (m) {
        var empty = box.querySelector('.hint'); if (empty) empty.remove();
        box.append(bubble(m)); toBottom(); markRead();
      }
    };
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var body = input.value.trim();
      if (!body) return;
      send.disabled = true;
      var ins = await sb.from('messages').insert({ sender_id: me, recipient_id: other.id, body: body }).select('id,sender_id,recipient_id,body,created_at').single();
      send.disabled = false;
      if (ins.error) { toast(friendlyError(ins.error), true); return; }
      input.value = '';
      var empty = box.querySelector('.hint'); if (empty) empty.remove();
      box.append(bubble(ins.data)); toBottom(); input.focus();
    });
    if (window.matchMedia && matchMedia('(hover: hover)').matches) input.focus();
  }

  /* ---- sayaçlar ve canlı güncelleme ---- */
  async function refreshCounts() {
    if (!state.me) { setBadge('notif', 0); setBadge('msg', 0); return; }
    var id = state.me.id;
    var res = await Promise.all([
      sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', id).is('read_at', null),
      sb.from('messages').select('id', { count: 'exact', head: true }).eq('recipient_id', id).is('read_at', null)
    ]);
    setBadge('notif', res[0].count || 0);
    setBadge('msg', res[1].count || 0);
  }
  function startRealtime() {
    if (!chPosts) {
      chPosts = sb.channel('posts-feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, function (pl) {
        if (state.me && pl.new && pl.new.user_id === state.me.id) return;
        if (state.onNewPost) state.onNewPost();
      }).subscribe();
    }
    if (chUser) { sb.removeChannel(chUser); chUser = null; }
    if (!state.me) return;
    var id = state.me.id;
    chUser = sb.channel('user-' + id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + id }, function () {
        if (state.onNotif) { state.onNotif(); return; }
        bumpBadge('notif', 1);
        toast('Yeni bildirimin var');
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'recipient_id=eq.' + id }, function (pl) {
        var m = pl.new;
        if (state.chat && m && state.chat.partnerId === m.sender_id) { state.chat.onMsg(m); return; }
        bumpBadge('msg', 1);
        toast('Yeni mesajın var');
        if (state.onConvUpdate) state.onConvUpdate();
      })
      .subscribe();
  }
  function afterAuth() { refreshCounts(); startRealtime(); }

  /* ================= yönlendirme ================= */
  async function route() {
    var tok = ++routeTok;
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    var view = $('#view');
    view.classList.toggle('wide', parts[0] === 'u' || parts[0] === 'favoriler' || parts[0] === 'ara');
    document.body.classList.toggle('in-chat', parts[0] === 'mesajlar' && !!parts[1]);
    if (feedIO) { feedIO.disconnect(); feedIO = null; }
    state.onNewPost = null; state.onNotif = null; state.onConvUpdate = null; state.chat = null;
    renderHeader();
    try {
      if (!parts.length) await feedPage(tok);
      else if (parts[0] === 'u' && parts[1]) await profilePage(parts[1], tok);
      else if (parts[0] === 'p' && parts[1]) await postPage(parts[1], tok);
      else if (parts[0] === 'favoriler') await favoritesPage(tok);
      else if (parts[0] === 'ayarlar') await settingsPage(tok);
      else if (parts[0] === 'ara') await searchPage(parts.slice(1).join('/'), tok);
      else if (parts[0] === 'bildirimler') await notificationsPage(tok);
      else if (parts[0] === 'mesajlar' && parts[1]) await chatPage(parts[1], tok);
      else if (parts[0] === 'mesajlar') await messagesPage(tok);
      else await feedPage(tok);
    } catch (e) {
      if (tok === routeTok) view.replaceChildren(emptyState('Bir sorun oluştu', friendlyError(e), h('button', { class: 'btn', type: 'button', onclick: route }, 'Tekrar dene')));
    }
  }
  var lastHash = null;
  window.addEventListener('hashchange', function () {
    if (location.hash !== lastHash) window.scrollTo(0, 0);
    lastHash = location.hash;
    route();
  });

  /* ================= başlangıç ================= */
  (async function init() {
    renderHeader();
    var r = await sb.auth.getSession();
    state.session = r.data && r.data.session;
    lastUid = state.session ? state.session.user.id : null;
    await loadMe();
    renderHeader();
    lastHash = location.hash;
    route();
    afterAuth();
  })();
})();
