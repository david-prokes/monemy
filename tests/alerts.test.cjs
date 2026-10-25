const {test}=require('node:test'),assert=require('node:assert/strict'),MD=require('../core.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const empty=()=>({schema:2,revision:1,categories:[{id:'food',name:'Comida',kind:'expense'},{id:'sales',name:'Ventas',kind:'income'},{id:'extras',name:'Extras',kind:'income'}],transactions:[],rules:[],goals:[],occurrences:[],alertHistory:[]});
const tx=(id,date,kind,amount,catId=null)=>({id,date,kind,amount,catId,note:''});
const finances=s=>copy(Object.fromEntries(['categories','transactions','rules','goals','occurrences'].map(k=>[k,s[k]])));
const established=(today='2026-10-25')=>{const s=empty();s.transactions=[tx('old-expense','2026-10-20','expense',100),tx('old-income','2026-10-20','income',100)];MD.collectAlerts(s,today,{visit:true});return s};
const enter=(s,t,today=t.date)=>{const previous=copy(s);s.transactions.push(t);MD.collectAlerts(s,today,{transaction:t.id,previous});return s.alertHistory};
const playful=s=>s.alertHistory.filter(a=>a.severity==='playful');
test('budget warning at 80%, highest early threshold, and exact limit/overspend keep their IDs',()=>{
 const s=empty();s.goals=[{id:'budget',kind:'expense',catId:'food',limit:10000}];s.transactions=[tx('expense','2026-10-25','expense',8000,'food')];
 let a=MD.alertCandidates(s,'2026-10-25');assert.equal(a.length,1);assert.equal(a[0].id,'2026-10:budget:near');assert.equal(a[0].severity,'warning');assert.match(a[0].detail,/Comida.*80,00/);
 s.transactions[0].date='2026-10-03';a=MD.alertCandidates(s,'2026-10-03');assert.equal(a.length,1);assert.equal(a[0].milestone,75);assert.equal(a[0].severity,'critical');
 s.transactions[0].amount=10000;a=MD.alertCandidates(s,'2026-10-03');assert.equal(a[0].id,'2026-10:budget:limit');assert.equal(a[0].severity,'warning');
 s.transactions[0].amount=10001;assert.equal(MD.alertCandidates(s,'2026-10-03')[0].severity,'critical');
});
test('daily warning requires fourteen prior days, thirty euros and more than twice the prior daily mean',()=>{
 const s=empty();s.transactions=[tx('start','2026-10-11','expense',14000),tx('today','2026-10-25','expense',3000)];
 assert.ok(MD.alertCandidates(s,'2026-10-25').some(a=>a.id.endsWith(':daily-spend')));
 s.transactions[0].date='2026-10-12';assert.ok(!MD.alertCandidates(s,'2026-10-25').some(a=>a.id.endsWith(':daily-spend')));
 s.transactions[0].date='2026-10-11';s.transactions[1].amount=2999;assert.ok(!MD.alertCandidates(s,'2026-10-25').some(a=>a.id.endsWith(':daily-spend')));
 s.transactions[0].amount=21000;s.transactions[1].amount=3000;assert.ok(!MD.alertCandidates(s,'2026-10-25').some(a=>a.id.endsWith(':daily-spend')));
});
test('tomorrow reminders exclude paused rules and income, and forecasts need three complete months',()=>{
 const s=empty(),base={id:'rent',kind:'expense',catId:null,amount:10000,note:'Alquiler',paused:false,nextDate:'2026-10-26',startDate:'2026-01-01',freq:'month',monthDay:26,weekday:1,annualDay:26,annualMonth:10};s.rules=[base,{...base,id:'paused',paused:true},{...base,id:'income',kind:'income'}];
 const due=MD.alertCandidates(s,'2026-10-25').filter(a=>a.id.startsWith('due:'));assert.equal(due.length,1);assert.match(due[0].detail,/Mañana: Alquiler/);
 s.rules=[];for(const month of ['07','08','09'])s.transactions.push(tx('inc'+month,`2026-${month}-01`,'income',10000),tx('exp'+month,`2026-${month}-02`,'expense',20000));
 assert.equal(MD.alertCandidates(s,'2026-10-25').find(a=>a.id.endsWith(':forecast')).severity,'critical');
 s.transactions=s.transactions.filter(t=>!t.id.endsWith('07'));assert.ok(!MD.alertCandidates(s,'2026-10-25').some(a=>a.id.endsWith(':forecast')));
});
test('welcome and first entries are lilac, persistent and do not alter financial data',()=>{
 const s=empty(),before=finances(s);MD.collectAlerts(s,'2026-10-25',{visit:true});assert.deepEqual(finances(s),before);assert.equal(playful(s).length,1);assert.match(playful(s)[0].title,/más vacío que tu futuro/);
 playful(s)[0].read=true;assert.equal(MD.collectAlerts(s,'2026-10-25',{visit:true}),false);assert.equal(playful(s)[0].read,true);
 enter(s,tx('first-expense','2026-10-25','expense',500));enter(s,tx('first-income','2026-10-25','income',10000));assert.equal(playful(s).length,3);assert.ok(playful(s).some(a=>a.id==='social:first-expense'));assert.ok(playful(s).some(a=>a.id==='social:first-income'));
 const restored=MD.migrate(s);assert.deepEqual(restored.alertHistory,s.alertHistory);assert.deepEqual(restored.alertMeta,s.alertMeta);
});
test('upgrading existing data creates no historical jokes and preserves old read alerts exactly',()=>{
 const s=empty();s.transactions=[tx('meal','2026-10-25','expense',8000,'food'),tx('old-income','2026-10-25','income',20000)];s.alertHistory=[{id:'2026-10:old:limit',date:'2026-10-20',severity:'critical',title:'Presupuesto superado',detail:'Aviso antiguo',milestone:100,read:true}];
 const before=finances(s),old=copy(s.alertHistory[0]);MD.collectAlerts(s,'2026-10-25',{visit:true});assert.equal(playful(s).length,0);assert.deepEqual(finances(s),before);assert.deepEqual(s.alertHistory.find(a=>a.id===old.id),old);
 MD.collectAlerts(s,'2026-10-25',{visit:true});assert.equal(playful(s).length,0);
 enter(s,tx('backdated','2026-10-01','expense',9000,'food'),'2026-10-25');assert.equal(playful(s).length,0);
 const imported=copy(s);delete imported.alertMeta;MD.collectAlerts(imported,'2026-10-25',{baseline:true,transaction:'meal',previous:s});assert.equal(playful(imported).length,0);
});
test('meal jokes rotate and ordinary lilac messages are limited to one per day',()=>{
 const s=established();enter(s,tx('meal-one','2026-10-25','expense',4001,'food'));assert.equal(playful(s).length,1);assert.match(playful(s)[0].title,/mujer/);const first=playful(s)[0].title;
 enter(s,tx('meal-two','2026-10-25','expense',5000,'food'));assert.equal(playful(s).length,1);
 MD.collectAlerts(s,'2026-10-26',{visit:true});enter(s,tx('meal-three','2026-10-26','expense',5000,'food'));assert.equal(playful(s).length,2);assert.notEqual(playful(s)[0].title,first);assert.match(playful(s)[0].title,/restaurante/);
 const edge=established();enter(edge,tx('exactly-forty','2026-10-25','expense',4000,'food'));assert.equal(playful(edge).length,0);
});
test('five expenses, small expenses, sales and extras each have their contextual lilac message',()=>{
 const cases=[{key:'five',rows:[1100,1100,1100,1100,1100],kind:'expense',cat:null},{key:'small',rows:[400,400,400,400],kind:'expense',cat:null},{key:'sale',rows:[10000],kind:'income',cat:'sales'},{key:'extra',rows:[10000],kind:'income',cat:'extras'}];
 for(const c of cases){const s=established();c.rows.forEach((amount,i)=>enter(s,tx(c.key+i,'2026-10-25',c.kind,amount,c.cat)));assert.equal(playful(s).length,1,c.key);assert.ok(playful(s)[0].id.endsWith(':'+c.key),c.key)}
});
test('new financial warnings suppress jokes for the same movement',()=>{
 const s=established();s.goals=[{id:'food-budget',kind:'expense',catId:'food',limit:1000}];enter(s,tx('expensive-meal','2026-10-25','expense',5000,'food'));assert.equal(playful(s).length,0);assert.equal(s.alertHistory.find(a=>a.id.endsWith(':limit')).severity,'critical');
});
test('income goals celebrate actual new crossings, not past income or edited targets',()=>{
 const s=established();s.goals=[{id:'income-target',kind:'income',catId:null,limit:10000}];enter(s,tx('earned','2026-10-25','income',10000));assert.ok(playful(s).some(a=>a.id==='2026-10:income-target:income'));
 const count=playful(s).length;MD.collectAlerts(s,'2026-10-25',{visit:true});assert.equal(playful(s).length,count);
 const prior=established();prior.goals=[{id:'old-target',kind:'income',catId:null,limit:50}];delete prior.alertMeta;MD.collectAlerts(prior,'2026-10-25',{visit:true});assert.equal(playful(prior).length,0);
});
test('month closing celebrates savings and respected budgets only after activation',()=>{
 const s=established('2026-10-31');s.transactions.push(tx('salary','2026-10-30','income',100000));s.goals=[{id:'budget',kind:'expense',catId:null,limit:100000}];MD.collectAlerts(s,'2026-10-31');MD.collectAlerts(s,'2026-11-01',{visit:true});
 assert.ok(playful(s).some(a=>a.id==='2026-10:saved'));assert.ok(playful(s).some(a=>a.id==='2026-10:budget:kept'));const count=playful(s).length;MD.collectAlerts(s,'2026-11-01',{visit:true});assert.equal(playful(s).length,count);
 const old=empty();old.transactions=copy(s.transactions);MD.collectAlerts(old,'2026-11-01',{visit:true});assert.equal(playful(old).length,0);
});
test('return jokes require four days after activation and malformed alert metadata cannot block money',()=>{
 const s=established();MD.collectAlerts(s,'2026-10-28',{visit:true});assert.equal(playful(s).length,0);MD.collectAlerts(s,'2026-11-01',{visit:true});assert.ok(playful(s).some(a=>a.id.endsWith(':social:back')));
 const malformed=established();malformed.alertMeta.budgets=[null];const before=finances(malformed);assert.doesNotThrow(()=>MD.collectAlerts(malformed,'2026-10-25',{visit:true}));assert.deepEqual(finances(malformed),before);
});
