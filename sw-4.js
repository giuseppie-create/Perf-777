/* Perf 777 — Service Worker
   Strategy: STALE-WHILE-REVALIDATE (offline-first with background update)
   - On install: pre-cache the app immediately
   - On fetch: serve cache instantly (works offline), update cache in background
   - On activate: delete old caches so updates propagate on next load
*/
const CACHE = 'perf777-v77';
const PAGE  = '/Perf-777/';          /* GitHub Pages base path */
const URLS  = [PAGE, PAGE + 'index.html'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      /* Try both URLs; if one fails the other succeeds */
      return c.addAll(URLS).catch(function() {
        return c.add(PAGE).catch(function() {
          return c.add(PAGE + 'index.html');
        });
      });
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      /* Background network update */
      var network = fetch(e.request).then(function(res) {
        if (res && res.status === 200) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function() { return null; });

      /* Serve cache immediately (offline-first).
         If not cached yet, wait for network (first load must be online). */
      if (cached) return cached;
      return network.then(function(r) {
        return r || caches.match(PAGE) || caches.match(PAGE + 'index.html');
      });
    }).catch(function() {
      return caches.match(PAGE) || caches.match(PAGE + 'index.html');
    })
  );
});
