'use strict';
const PREFIX='mi-dinero:'+self.registration.scope+':',CACHE=PREFIX+'v2.0.0';
const RESOURCES=['./','./index.html','./styles.css','./core.js','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(RESOURCES))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('./index.html'))||fetch(request)));return;
 }
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(request,{ignoreSearch:true});if(cached)return cached;
  return fetch(request);
 }));
});
