/* Development only: npm install --no-save playwright, then node tests/browser.cjs.
   Set CHROMIUM_PATH when using a system Chromium executable. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),shots=process.env.SCREENSHOT_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'mi-dinero-qa-'));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png'};
const server=http.createServer((req,res)=>{let file=decodeURIComponent(req.url.split('?')[0]).replace(/^\/mi-dinero\//,'');if(!file||file.endsWith('/'))file+='index.html';file=path.resolve(root,file);if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain','Cache-Control':'no-cache'}).end(data)})});
fs.mkdirSync(shots,{recursive:true});
let browser,activePage;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/mi-dinero/`;
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Madrid'}),page=await ctx.newPage(),errors=[];
 activePage=page;page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 await page.goto(url);await page.waitForFunction(()=>document.querySelectorAll('#category-strip button').length>1);
 const data=()=>page.evaluate(()=>JSON.parse(JSON.stringify(state)));
 const click=action=>page.locator(`[data-action="${action}"]`).first().click();
 const waitCount=n=>page.waitForFunction(n=>state.transactions.length===n,n);
 const register=async(amount,kind='expense',note='')=>{
  await page.locator(`[data-entry-kind="${kind}"]`).click();await page.locator('#entry-amount').fill(amount);
  if(note){await click('entry-note');await page.locator('#entry-note').fill(note)}
  await click('register');await page.waitForFunction(()=>document.querySelector('#entry-amount').value==='');
 };
 assert.equal((await data()).transactions.length,0);assert.equal(await page.locator('.screen').count(),3);
 await register('0,10');await register('0,20');await register('2000','income','Nómina');
 assert.equal((await data()).transactions.filter(t=>t.kind==='expense').reduce((sum,t)=>sum+t.amount,0),30);
 assert.match(await page.locator('#balance-value').innerText(),/1\.?999,70/);
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#category-strip button').length>1);await waitCount(3);
 console.log('PASS registration, exact totals and IndexedDB after reload');
 await page.locator('[data-entry-kind="expense"]').click();await click('toggle-categories');assert.equal(await page.locator('#category-expanded').isVisible(),true);assert.equal(await page.locator('#category-strip').isVisible(),false);
 await click('toggle-category-maker');await page.locator('#new-cat-name').fill('Café');await page.locator('[data-pick-icon="food"]').click();await click('save-category');
 await page.waitForFunction(()=>state.categories.some(c=>c.name==='Café'));await page.locator('#category-maker').waitFor({state:'hidden'});
 await page.locator('#entry-amount').fill('4,50');await click('entry-note');await page.locator('#entry-note').fill('Café — MALLORCA!!');await click('register');await waitCount(4);
 await click('toggle-categories');await page.screenshot({path:path.join(shots,'resumen.png'),fullPage:true});
 await page.locator('[data-nav="movimientos"]').click();assert.equal(await page.locator('#screen-movimientos [data-action=register]').count(),0);
 await click('toggle-search');await page.locator('#mov-query').fill('cafe mallorca');assert.equal(await page.locator('#mov-list .swipe-wrap').count(),1);
 await page.locator('#mov-list [data-toggle-row]').click();await page.locator('[data-edit-tx]').click();await page.locator('#tx-edit-amount').fill('5,50');await click('save-tx-edit');
 await page.waitForFunction(()=>state.transactions.some(t=>t.amount===550));
 await page.locator('#mov-list [data-toggle-row]').click();await page.locator('[data-del-tx]').click();await waitCount(3);await page.locator('#toast-action').click();await waitCount(4);
 console.log('PASS inline categories, normalized search, accessible edit/delete/undo');
 await page.locator('#mov-query').fill('');await page.screenshot({path:path.join(shots,'movimientos.png'),fullPage:true});
 // Synthetic touch stream exercises the application's swipe handler.
 await page.locator('#mov-list .swipe-body').first().dispatchEvent('touchstart',{touches:[{identifier:1,clientX:290,clientY:400}]});
 await page.locator('#mov-list .swipe-body').first().dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:170,clientY:402}]});
 assert.equal(await page.locator('#mov-list .swipe-wrap.open').count(),1);
 await page.locator('[data-nav="resumen"]').click();await click('toggle-goals');await click('new-goal');await page.locator('#goal-limit').fill('1000');await click('save-goal');
 await page.waitForFunction(()=>state.goals.length===1);await page.locator('#goal-list [data-toggle-row]').click();await page.locator('[data-edit-goal]').click();assert.equal(await page.locator('#goal-limit').inputValue(),'1000,00');await page.locator('#goal-limit').fill('1200');await click('save-goal');await page.waitForFunction(()=>state.goals[0].limit===120000);
 console.log('PASS swipe handler and editable monthly budgets');
 await page.locator('#entry-amount').fill('13,99');await click('entry-recur');await click('register');await page.waitForFunction(()=>document.querySelector('#entry-amount').value==='');await waitCount(5);
 const before=(await data()).transactions.length;await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#category-strip button').length>1);await waitCount(before);
 await click('toggle-rules');await page.locator('#rule-list [data-toggle-rule]').click();await page.waitForFunction(()=>state.rules[0].paused);await page.locator('#rule-list [data-toggle-rule]').click();await page.waitForFunction(()=>!state.rules[0].paused);
 await page.locator('#rule-list [data-toggle-row]').click();await page.locator('[data-edit-rule]').click();await page.locator('#rule-amount').fill('15,99');await click('save-rule-edit');await page.waitForFunction(()=>state.rules[0].amount===1599);assert.equal((await data()).transactions.find(t=>t.ruleId).amount,1399);
 console.log('PASS periodic creation, no duplicates on reload, pause/resume, edit preserving history');
 await page.locator('[data-nav="proyeccion"]').click();assert.equal(await page.locator('#forecast-chart svg').count(),1);assert.equal(await page.locator('#forecast-chart [data-chart-index]').count(),12);
 assert.equal(await page.locator('#screen-proyeccion').innerText().then(t=>/EMA|exponencial/i.test(t)),false);
 await page.locator('[data-chart-index="11"]').click();assert.match(await page.locator('#chart-tip').innerText(),/diciembre/);await page.screenshot({path:path.join(shots,'proyeccion.png'),fullPage:true});
 // No document-wide horizontal overflow at common phone and desktop widths.
 for(const width of [320,375,390,430,768,1280]){
  await page.setViewportSize({width,height:900});for(const tab of ['resumen','movimientos','proyeccion']){await page.locator(`[data-nav="${tab}"]`).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),`${tab} overflow at ${width}`)}
 }
 console.log('PASS projection interactions and responsive widths 320–1280');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await ctx.setOffline(true);await page.reload();await page.waitForSelector('#category-strip button');await waitCount(before);
 await register('1,23');await waitCount(before+1);await page.reload();await page.waitForSelector('#category-strip button');await waitCount(before+1);await ctx.setOffline(false);
 console.log('PASS offline reload, offline writes and persistence in a GitHub Pages style subdirectory');
 // A rejected write must never be announced as saved or left in the visible totals.
 const countBeforeFailure=(await data()).transactions.length;
 await page.evaluate(()=>db.close());await page.locator('#entry-amount').fill('9,99');await click('register');
 await page.waitForFunction(()=>!registerBusy);assert.equal((await data()).transactions.length,countBeforeFailure);assert.match(await page.locator('#toast-text').innerText(),/almacenamiento/);
 console.log('PASS storage failure rolls back and reports the failure');
 assert.deepEqual(errors,[]);await ctx.close();
 // Separate storage simulates closing and reopening the app in a persistent browser profile.
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'mi-dinero-profile-'));
 const options={headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-gpu']};
 let persistent=await chromium.launchPersistentContext(profile,options),p=await persistent.newPage();await p.goto(url);await p.waitForSelector('#category-strip button');await p.locator('#entry-amount').fill('8,88');await p.locator('[data-action=register]').click();await p.waitForFunction(()=>state.transactions.length===1&&document.querySelector('#entry-amount').value==='');await persistent.close();
 persistent=await chromium.launchPersistentContext(profile,options);p=await persistent.newPage();await p.goto(url);await p.waitForFunction(()=>state.transactions.length===1);assert.equal(await p.evaluate(()=>state.transactions[0].amount),888);await persistent.close();
 console.log('PASS persistence after closing and reopening the browser');console.log('Screenshots:',shots);
})().catch(async err=>{console.error(err);if(activePage){console.log(await activePage.evaluate(()=>({count:state.transactions.length,rules:state.rules,toast:document.querySelector('#toast-text').textContent})).catch(()=>null));await activePage.screenshot({path:path.join(shots,'failure.png'),fullPage:true}).catch(()=>{})}process.exitCode=1}).finally(async()=>{if(browser)await browser.close();server.close()});
