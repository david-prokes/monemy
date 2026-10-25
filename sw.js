'use strict';
const RELEASE='2.2.0',PREFIX='mi-dinero:'+self.registration.scope+':',CACHE=PREFIX+'v'+RELEASE;
const RESOURCES=['./','./index.html','./styles.css','./core.js','./features.js','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // Fetch a distinct CDN URL for every release, but keep the canonical offline keys.
 // An older response cached by the CDN must never be pinned into the new shell.
 const responses=await Promise.all(RESOURCES.map(async resource=>{
  const canonical=new URL(resource,self.registration.scope),fresh=new URL(canonical);fresh.searchParams.set('monemy-release',RELEASE);
  const response=await fetch(fresh,{cache:'reload'});if(!response.ok)throw Error('Incomplete release');
  const bytes=await response.arrayBuffer();
  if(resource==='./app.js'&&!new TextDecoder().decode(bytes).includes("APP_VERSION='"+RELEASE+"'"))throw Error('Mismatched application release');
  if(resource==='./index.html'&&!new TextDecoder().decode(bytes).includes('name="monemy-version" content="'+RELEASE+'"'))throw Error('Mismatched document release');
  const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
  return {canonical,response:new Response(bytes,{status:200,headers})};
 }));
 const cache=await caches.open(CACHE);await Promise.all(responses.map(({canonical,response})=>cache.put(canonical,response)));
})()));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(PREFIX)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 if(request.mode==='navigate'){
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('./index.html'))||fetch(request)));return;
 }
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(request,{ignoreSearch:true}))||fetch(request)));
});
