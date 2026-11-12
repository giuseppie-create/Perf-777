/* Perf 777 — Service Worker (v84)
   - Page (index.html): NETWORK-FIRST with a 3 s timeout, then cache.
     With internet you always get the latest version on the first open;
     offline (or slow network) the cached copy is served immediately after the timeout.
   - Other files (pdf.js, icons…): cache-first, refreshed in the background.
   - All network fetches bypass the browser HTTP cache (GitHub Pages caches 10 min),
     so a new release is picked up straight away.
*/
const CACHE = 'perf777-v92';
const PAGE  = '/Perf-777/';          /* GitHub Pages base path */
const URLS  = [PAGE, PAGE + 'index.html'];
const LIBS  = [PAGE + 'pdf.min.js', PAGE + 'pdf.worker.min.js'];

function fresh(url) { return fetch(url, { cache: 'no-store' }); }

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      LIBS.forEach(function(u) { fresh(u).then(function(r) { if (r.ok) c.put(u, r); }).catch(function() {}); });
      return Promise.all(URLS.map(function(u) {
        return fresh(u).then(function(r) { if (r.ok) return c.put(u, r); }).catch(function() {});
      }));
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; })
                             .map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

function isPage(req) {
  if (req.mode === 'navigate') return true;
  var u = new URL(req.url);
  return u.pathname === PAGE || u.pathname === PAGE + 'index.html';
}

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;   /* API calls etc.: untouched */

  if (isPage(req)) {
    /* network-first, 3 s timeout, fallback to cache */
    e.respondWith(new Promise(function(resolve) {
      var done = false;
      function fromCache(final) {
        caches.match(req)
          .then(function(c) { return c || caches.match(PAGE + 'index.html'); })
          .then(function(c) { return c || caches.match(PAGE); })
          .then(function(c) {
            if (done) return;
            if (c) { done = true; resolve(c); }
            else if (final) { done = true; resolve(Response.error()); }
          });
      }
      var t = setTimeout(fromCache, 3000);
      fresh(req.url).then(function(res) {
        if (res && res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(PAGE + 'index.html', clone.clone()); c.put(PAGE, clone); });
          if (!done) { done = true; clearTimeout(t); resolve(res); }
        } else { clearTimeout(t); fromCache(true); }
      }).catch(function() { clearTimeout(t); fromCache(true); });
    }));
    return;
  }

  /* other files: cache-first, background refresh */
  e.respondWith(
    caches.match(req).then(function(cached) {
      var net = fresh(req.url).then(function(res) {
        if (res && res.ok) { var cl = res.clone(); caches.open(CACHE).then(function(c) { c.put(req, cl); }); }
        return res;
      }).catch(function() { return null; });
      return cached || net.then(function(r) { return r || caches.match(PAGE + 'index.html'); });
    })
  );
});
