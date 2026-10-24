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
