/* Real update from the previous release, on the same origin and browser profile.
   BASELINE_DIR points to a checkout of commit 8d3b6f9457d5a8dbc36538cc1b7895531a242384. */
const {chromium,webkit,devices}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const current=path.resolve(__dirname,'..'),baseline=process.env.BASELINE_DIR&&path.resolve(process.env.BASELINE_DIR);
if(!baseline||!fs.existsSync(path.join(baseline,'sw.js')))throw Error('BASELINE_DIR debe apuntar a la versión publicada anterior.');
let release=baseline,blocked=false,networkDown=false,staleAssets=false;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{
 if(networkDown){req.socket.destroy();return}
 const parsed=new URL(req.url,'http://localhost');let name=decodeURIComponent(parsed.pathname).replace(/^\/monemy\//,'');if(!name||name.endsWith('/'))name+='index.html';
 if(process.env.DEBUG_UPDATE)console.log('GET',name,parsed.search,blocked?'blocked':'ok');
 const resourceRoot=staleAssets&&name!=='sw.js'&&!parsed.searchParams.has('monemy-release')?baseline:release;const file=path.resolve(resourceRoot,name);if(!file.startsWith(resourceRoot+path.sep)){res.writeHead(404).end();return}
 if(blocked&&name==='features.js'){res.writeHead(503).end();return}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'text/plain','Cache-Control':'no-store'}).end(data)});
});
const finances=s=>Object.fromEntries(['categories','transactions','rules','goals','occurrences'].map(k=>[k,s[k]]));
const shots=process.env.SCREENSHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'monemy-update-'));fs.mkdirSync(shots,{recursive:true});
let active;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/monemy/`;
 const cases=[{name:'Android-Chromium',engine:chromium,device:'Pixel 7',executable:process.env.CHROMIUM_PATH},{name:'iPhone-WebKit',engine:webkit,device:'iPhone 13',executable:process.env.WEBKIT_PATH}];
 for(const spec of cases.filter(s=>!process.env.ONLY_ENGINE||s.name===process.env.ONLY_ENGINE)){
  release=baseline;blocked=false;staleAssets=false;const profile=fs.mkdtempSync(path.join(os.tmpdir(),'monemy-'+spec.name+'-'));
  const {defaultBrowserType,...device}=devices[spec.device];const options={...device,headless:true,timezoneId:'Europe/Madrid',...(spec.executable?{executablePath:spec.executable}:{}),...(spec.engine===chromium?{args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']}:{}),serviceWorkers:'allow'};
  active=await spec.engine.launchPersistentContext(profile,options);let page=await active.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('#category-strip button').length>1);assert.equal(await page.title(),'Mi dinero');
  await page.locator('#entry-amount').fill('610,25');await page.locator('[data-action=register]').click();await page.waitForFunction(()=>document.querySelector('#entry-amount').value==='');
  const before=await page.evaluate(async()=>{
   const legacy={id:'legacy-custom',kind:'expense',name:'Anterior',icon:'food',color:'#123456',bg:hslBg('#123456')};state.categories.push(legacy);state.transactions[0].catId=legacy.id;state.transactions[0].note='Pago anterior a la actualización';
   state.goals=[{id:'monthly-budget',kind:'expense',catId:null,limit:50000}];
   const today=dateNow(),r={id:'monthly-rule',kind:'expense',catId:legacy.id,amount:1399,note:'Periódico anterior',freq:'month',weekday:dateObj(today).getDay(),monthDay:dateObj(today).getDate(),annualDay:dateObj(today).getDate(),annualMonth:dateObj(today).getMonth()+1,startDate:today,paused:false};r.nextDate=nextMatchingAfter(today,r);state.rules=[r];state.occurrences=['rec:retired:2026-09-24'];await save();renderAll();return JSON.parse(JSON.stringify(state));
  });
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  assert.deepEqual(finances(await page.evaluate(()=>JSON.parse(JSON.stringify(state)))),finances(before));
  // Old installed worker remains usable if the incoming release cannot finish caching.
  release=current;blocked=true;staleAssets=true;
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready;await registration.update();const installing=registration.installing;if(installing)await new Promise((resolve,reject)=>{const deadline=setTimeout(()=>reject(Error('Update did not fail: '+installing.state)),8000);const inspect=()=>{if(installing.state==='redundant'){clearTimeout(deadline);resolve()}};inspect();installing.addEventListener('statechange',inspect)})});
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#category-strip button').length>1);assert.equal(await page.title(),'Mi dinero');assert.deepEqual(finances(await page.evaluate(()=>JSON.parse(JSON.stringify(state)))),finances(before));
  blocked=false;await page.evaluate(async()=>{await(await navigator.serviceWorker.ready).update()});
  await page.waitForFunction(()=>document.querySelector('#toast-action').textContent==='Actualizar'&&!document.querySelector('#toast-action').classList.contains('hidden'));
  await page.locator('#toast-action').click();await page.waitForFunction(()=>document.title==='monemy'&&typeof appReady!=='undefined'&&appReady);
  assert.deepEqual(finances(await page.evaluate(()=>JSON.parse(JSON.stringify(state)))),finances(before));
  const backup=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=db.transaction('state','readonly').objectStore('state').get('backup:before-'+APP_VERSION);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}));assert.deepEqual(backup.data,before);
  assert.equal(await page.locator('#alert-badge').innerText(),'1');await page.locator('#inbox-toggle').click();assert.equal(await page.locator('.alert-card.critical').count(),1);await page.locator('#read-all-alerts').click();await page.locator('#alert-badge').waitFor({state:'hidden'});
  await page.reload();await page.waitForFunction(()=>typeof appReady!=='undefined'&&appReady);assert.equal(await page.locator('#alert-badge').isVisible(),false);
  await page.locator('[data-action=toggle-categories]').click();await page.locator('[data-action=toggle-category-maker]').click();assert.equal(await page.locator('[data-pick-color]').count(),8);assert.equal(await page.locator('input[type=color]').count(),0);
  await page.locator('#new-cat-name').fill('Prueba de paleta');await page.locator('[data-pick-color="#4f98db"]').click();await page.locator('[data-pick-icon=gift]').click();assert.equal(await page.locator('#new-cat-name').inputValue(),'Prueba de paleta');assert.equal(await page.locator('#new-cat-color').inputValue(),'#4f98db');await page.locator('[data-action=cancel-category]').click();
  await page.locator('[data-nav=proyeccion]').click();assert.equal(await page.locator('.saving-amount').count(),12);assert.equal(await page.locator('#month-heatmap button').count(),await page.evaluate(()=>daysIn(new Date().getFullYear(),new Date().getMonth()+1)));assert.equal(await page.locator('#weekday-heatmap button').count(),7);
  const today=await page.evaluate(()=>dateNow());await page.locator(`[data-calendar-date="${today}"]`).click();assert.match(await page.locator('#activity-detail').innerText(),/610,25/);await page.locator('[data-weekday="0"]').click();assert.match(await page.locator('#weekday-detail').innerText(),/Lunes/);
  await page.screenshot({path:path.join(shots,spec.name+'-projection.png'),fullPage:true});
  await page.locator('[data-forecast-mode=all]').click();assert.equal(await page.locator('#forecast-series-legend').isVisible(),true);assert.ok(await page.locator('.all-scroll').evaluate(el=>el.scrollWidth>el.clientWidth));await page.screenshot({path:path.join(shots,spec.name+'-all.png'),fullPage:true});await page.locator('[data-forecast-mode=savings]').click();assert.equal(await page.locator('#screen-proyeccion .topbar #forecast-year').count(),1);assert.equal(await page.getByText('Evolución y ahorro',{exact:true}).count(),0);assert.equal(await page.locator('#forecast-chart-title').count(),0);assert.equal(await page.locator('.weekday-caption').count(),0);
  // WebKit Linux's setOffline reload returns an engine internal error even with a controlled, fully cached page.
  // Test real network unavailability there by refusing server connections; Chromium also uses its offline flag.
  if(spec.engine===webkit)networkDown=true;else await active.setOffline(true);
  await page.reload();await page.waitForFunction(()=>typeof appReady!=='undefined'&&appReady);assert.deepEqual(finances(await page.evaluate(()=>JSON.parse(JSON.stringify(state)))),finances(before));
  networkDown=false;if(spec.engine===chromium)await active.setOffline(false);
  assert.deepEqual(errors,[]);await active.close();active=null;
  // Closing/reopening the same profile models continuing to use the same phone.
  active=await spec.engine.launchPersistentContext(profile,options);page=await active.newPage();await page.goto(url);await page.waitForFunction(()=>typeof appReady!=='undefined'&&appReady);assert.equal(await page.title(),'monemy');assert.deepEqual(finances(await page.evaluate(()=>JSON.parse(JSON.stringify(state)))),finances(before));await active.close();active=null;
  console.log(`PASS ${spec.name}: failed update, stale CDN assets, accepted update, full financial state, backup, alerts, palette, activity, offline and reopen`);
 }
 console.log('Screenshots:',shots);
})().catch(err=>{console.error(err);process.exitCode=1}).finally(async()=>{if(active)await active.close();server.close()});
