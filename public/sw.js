/* Kare servis çalışanı: kabuğu önbelleğe alır, veri her zaman ağdan gelir. */
var V = 'kare-v11';
var SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== V; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin !== location.origin) return; // Supabase, yazı tipleri, CDN: ağa bırak
  e.respondWith(
    fetch(r, { cache: 'no-cache' }).then(function (res) {
      if (res.ok) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); }
      return res;
    }).catch(function () {
      return caches.match(r).then(function (m) { return m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()); });
    })
  );
});

/* ---- telefona bildirim (push) ---- */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data.json(); } catch (x) {}
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    if (list.some(function (c) { return c.visibilityState === 'visible'; })) return; // uygulama açıkken canlı bildirim zaten var
    return self.registration.showNotification(d.title || 'Kare', {
      body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || './' }
    });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.location.origin) === 0 && 'focus' in c) {
        return c.focus().then(function (cc) { return (cc || c).navigate ? (cc || c).navigate(url) : null; });
      }
    }
    return self.clients.openWindow(url);
  }));
});
