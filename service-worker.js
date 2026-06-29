var CACHE='perf777-v54';
var ASSETS=['./','./index.html','./manifest.json','./apple-touch-icon.png','./icon-192.png','./icon-512.png'];
self.addEventListener('install',function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS).catch(function(){}); }));
});
self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){ return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);})); })
    .then(function(){ return self.clients.claim(); })
  );
});
self.addEventListener('fetch',function(e){
  var url=e.request.url;
  if(url.indexOf('api.anthropic.com')>-1 || url.indexOf('aviationweather')>-1){ return; }
  e.respondWith(
    caches.open(CACHE).then(function(c){
      return c.match(e.request).then(function(hit){
        var net=fetch(e.request).then(function(resp){ if(resp&&resp.status===200&&e.request.method==='GET'){ c.put(e.request,resp.clone()); } return resp; }).catch(function(){ return hit; });
        return hit || net;
      });
    })
  );
});
