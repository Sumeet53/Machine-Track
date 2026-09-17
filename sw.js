// MachineTrack — service worker
// Caches the app shell so the app opens instantly and works offline.
// Firebase Auth/Firestore requests are left untouched — Firestore's own
// offline persistence (enabled in index.html) handles data sync.

var CACHE_NAME = "machinetrack-shell-v2";
var SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(SHELL_FILES); })
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
  if(url.hostname.indexOf("googleapis.com") !== -1 ||
     url.hostname.indexOf("google.com") !== -1 ||
     url.hostname.indexOf("gstatic.com") !== -1 ||
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
