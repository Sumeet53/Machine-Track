// MachineTrack — service worker
// Caches the app shell AND the Firebase SDK files (static, versioned URLs)
// so the app still boots offline. Live Firestore/Auth data calls
// (googleapis.com) are left untouched — Firestore's own offline
// persistence (enabled in index.html) handles those.

var CACHE_NAME = "machinetrack-shell-v3";
var SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
];

self.addEventListener("install", function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      // Cache each file individually (not addAll) so one CDN hiccup
      // during install doesn't block caching of everything else.
      return Promise.all(SHELL_FILES.map(function(url){
        return cache.add(url).catch(function(err){ console.warn("Precache failed for", url, err); });
      }));
    })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return;

  var url = new URL(req.url);
  // Only live Firestore/Auth DATA calls go through googleapis.com —
  // those must always hit the network (or Firestore's own offline cache),
  // never our static cache. Firebase SDK *script* files on gstatic.com
  // and Google Fonts are static and safe to cache-first below.
  if(url.hostname.indexOf("googleapis.com") !== -1 ||
     url.hostname.indexOf("firebaseio.com") !== -1){
    return;
  }

  if(req.mode === "navigate"){
    event.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        return res;
      }).catch(function(){ return caches.match("./index.html"); })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(function(cached){
      if(cached) return cached;
      return fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
        return res;
      }).catch(function(){ /* offline and not cached */ });
    })
  );
});
