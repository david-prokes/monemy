const {test}=require('node:test');
const assert=require('node:assert/strict');
const MD=require('../core.js');
const empty=()=>({schema:2,revision:0,categories:[],transactions:[],rules:[],goals:[],occurrences:[]});
const rule=(extra={})=>({id:'rent',kind:'expense',catId:null,amount:62000,note:'',freq:'month',weekday:1,monthDay:31,annualDay:29,annualMonth:2,startDate:'2024-01-31',nextDate:'2024-01-31',paused:false,...extra});
const tx=(date,kind,amount,extra={})=>({id:`tx-${date}-${kind}`,date,kind,amount,catId:null,note:'',...extra});
test('money parses Spanish and decimal input into exact cents',()=>{
 for(const [value,cents] of [['0,10',10],['0.20',20],['1.234,56',123456],['12 €',1200],['13,99',1399]])assert.equal(MD.parseCents(value),cents);
 assert.equal(MD.parseCents('0,10')+MD.parseCents('0,20'),30);
 for(const value of ['-1','1e3','1,2345','1.2.3','Infinity',''])assert.ok(Number.isNaN(MD.parseCents(value)));
});
test('month-end, leap-year and weekly schedules preserve their intended day',()=>{
 const r=rule();assert.equal(MD.next('2024-01-31',r),'2024-02-29');assert.equal(MD.next('2024-02-29',r),'2024-03-31');
 assert.equal(MD.next('2025-01-31',r),'2025-02-28');
 const annual=rule({freq:'year'});assert.equal(MD.next('2024-02-29',annual),'2025-02-28');assert.equal(MD.next('2027-02-28',annual),'2028-02-29');
 assert.equal(MD.first('2026-10-24',rule({freq:'week',weekday:1})),'2026-10-26');
 assert.equal(MD.validDate('2025-02-29'),false);assert.equal(MD.validDate('2024-02-29'),true);
});
test('catch-up is idempotent and does not restore a deleted occurrence',()=>{
 const s=empty();s.rules=[rule()];assert.equal(MD.reconcile(s,'2024-03-31'),true);assert.equal(s.transactions.length,3);
 MD.reconcile(s,'2024-03-31');assert.equal(s.transactions.length,3);
 s.transactions.splice(1,1);s.rules[0].nextDate='2024-02-29';MD.reconcile(s,'2024-03-31');assert.equal(s.transactions.length,2);
});
test('pause and rule edits preserve historical values',()=>{
 const s=empty();s.rules=[rule()];MD.reconcile(s,'2024-01-31');s.rules[0].paused=true;MD.reconcile(s,'2024-04-30');assert.equal(s.transactions.length,1);
 s.rules[0].paused=false;s.rules[0].nextDate='2024-04-30';s.rules[0].amount=70000;MD.reconcile(s,'2024-04-30');
 assert.deepEqual(s.transactions.map(t=>t.amount),[62000,70000]);
});
test('forecast keeps EMA fixed across future months and adds recurring income once',()=>{
 const s=empty();s.transactions=[tx('2026-08-02','expense',10000),tx('2026-09-02','expense',20000),tx('2026-09-01','income',100000,{ruleId:'salary'})];
 s.rules=[rule({id:'salary',kind:'income',amount:100000,monthDay:1,startDate:'2026-09-01',nextDate:'2026-11-01'})];
 const f=MD.forecast(s,2026,'2026-10-24');assert.equal(f[10].inc,100000);assert.equal(f[11].inc,100000);assert.equal(f[10].exp,12857);assert.equal(f[11].exp,12857);
 assert.equal(f[11].acc,f.reduce((sum,m)=>sum+m.net,0));assert.ok(f.every(m=>Number.isInteger(m.inc)&&Number.isInteger(m.exp)));
});
test('little history uses current pace for future months; known future items are not counted twice',()=>{
 const s=empty();s.transactions=[tx('2026-10-05','expense',10000),tx('2026-11-05','expense',5000)];
 const f=MD.forecast(s,2026,'2026-10-10');assert.equal(f[10].exp,31000);assert.equal(f[11].exp,31000);
 s.transactions.push(tx('2026-11-01','income',200000,{id:'rec:salary:2026-11-01',ruleId:'salary'}));
 s.rules=[rule({id:'salary',kind:'income',amount:200000,nextDate:'2026-11-01',monthDay:1})];
 assert.equal(MD.forecast(s,2026,'2026-10-10')[10].inc,200000);
});
test('past year is actual only and empty state yields zero',()=>{
 const s=empty();s.transactions=[tx('2025-01-01','expense',10000)];assert.ok(MD.forecast(s,2025,'2026-10-24').every(m=>!m.estimated));assert.equal(MD.forecast(s,2025,'2026-10-24')[11].acc,-10000);
 assert.ok(MD.forecast(empty(),2026,'2026-10-24').every(m=>m.net===0));
});
test('legacy data migrates once and malformed imports are rejected',()=>{
 const s=empty();s.schema=1;s.transactions=[tx('2026-10-01','expense',13.99)];const m=MD.migrate(s);assert.equal(m.transactions[0].amount,1399);assert.equal(MD.migrate(m).transactions[0].amount,1399);MD.validate(m);
 m.transactions[0].amount=13.99;assert.throws(()=>MD.validate(m));m.transactions[0].amount=1399;m.transactions[0].date='2026-02-30';assert.throws(()=>MD.validate(m));
});
test('budget alerts cover early pace, exact limit and overspend without duplicated unread items',()=>{
 const s=empty();s.goals=[{id:'budget',kind:'expense',catId:null,limit:100000}];s.transactions=[tx('2026-10-03','expense',25000)];
 MD.collectAlerts(s,'2026-10-03');assert.equal(s.alertHistory.length,1);assert.equal(s.alertHistory[0].severity,'warning');assert.match(s.alertHistory[0].detail,/25%.*3 días/);
 s.alertHistory[0].read=true;assert.equal(MD.collectAlerts(s,'2026-10-03'),false);assert.equal(s.alertHistory[0].read,true);
 s.transactions.push(tx('2026-10-04','expense',50000));MD.collectAlerts(s,'2026-10-04');assert.equal(s.alertHistory.length,1);assert.equal(s.alertHistory[0].severity,'critical');assert.equal(s.alertHistory[0].read,false);
 s.transactions.push(tx('2026-10-08','expense',25000));MD.collectAlerts(s,'2026-10-08');const limit=s.alertHistory.find(a=>a.id.endsWith(':limit'));assert.equal(limit.severity,'warning');
 s.transactions.push(tx('2026-10-09','expense',1));MD.collectAlerts(s,'2026-10-09');assert.equal(limit.severity,'critical');assert.equal(s.alertHistory.filter(a=>a.id.endsWith(':limit')).length,1);
});
test('alerts distinguish category budgets, income goals and three full previous months',()=>{
 const s=empty();s.categories=[{id:'food',name:'Comida'}];s.goals=[{id:'foodgoal',kind:'expense',catId:'food',limit:10000},{id:'salarygoal',kind:'income',catId:null,limit:1}];
 s.transactions=[tx('2026-07-02','expense',20000),tx('2026-08-02','expense',20000),tx('2026-09-02','expense',20000),tx('2026-10-03','expense',21000,{catId:'food'}),tx('2026-10-03','income',100000)];
 const alerts=MD.alertCandidates(s,'2026-10-10');assert.ok(alerts.some(a=>a.title.includes('Comida')));assert.ok(!alerts.some(a=>a.id.includes('salarygoal')));assert.equal(alerts.find(a=>a.id.endsWith(':average')).severity,'warning');
 s.transactions.push(tx('2026-10-04','expense',4000));assert.equal(MD.alertCandidates(s,'2026-10-10').find(a=>a.id.endsWith(':average')).severity,'critical');
 s.transactions=s.transactions.filter(t=>!t.date.startsWith('2026-08'));assert.ok(!MD.alertCandidates(s,'2026-10-10').some(a=>a.id.endsWith(':average')));
});
test('activity aligns Monday-first, skips future entries and averages zero-activity days',()=>{
 const s=empty();s.transactions=[tx('2026-10-01','expense',10000),tx('2026-10-05','income',10000),tx('2026-10-12','income',20000),tx('2026-10-19','income',30000),tx('2026-10-26','income',999999)];
 const a=MD.activity(s,'2026-10-24');assert.equal(a.offset,3);assert.equal(a.daily.length,31);assert.equal(a.daily[25].income,0);assert.equal(a.daily[25].future,true);
 assert.equal(a.weekdays[0].count,3);assert.equal(a.weekdays[0].income,20000);assert.equal(a.weekdays[3].count,4);assert.equal(a.weekdays[3].expense,2500);
 const feb=MD.activity(empty(),'2024-02-29');assert.equal(feb.daily.length,29);assert.ok(feb.weekdays.every(d=>d.net===0&&d.count===0));
});
test('chart scale follows small and negative savings; unknown versions never multiply money',()=>{
 const small=MD.chartDomain([10,30,50]),mixed=MD.chartDomain([-50000,12000]);assert.ok(small.max>=50&&small.max<200);assert.ok(mixed.min<=-50000&&mixed.max>=12000);
 assert.equal(MD.PALETTE.length,8);assert.equal(new Set(MD.PALETTE.map(p=>p.color)).size,8);assert.throws(()=>MD.migrate({...empty(),schema:3}));
 const s=empty();s.transactions=[tx('2026-10-03','expense',1001)];const migrated=MD.migrate(s);assert.equal(migrated.transactions[0].amount,1001);assert.deepEqual(migrated.alertHistory,[]);
});
