/* Pure money, calendar and forecast calculations. Amounts are integer cents. */
(function(root){
'use strict';
const MAX=10000000000;
const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const date=s=>new Date(s+'T12:00:00');
const days=(y,m)=>new Date(y,m,0).getDate();
const add=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return fmt(d)};
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='1900-01-01'&&s<='9998-12-31'&&fmt(date(s))===s;
function parseCents(value){
 let s=String(value??'').trim().replace(/\s|€/g,'');
 if(/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s))s=s.replace(/\./g,'');
 if(!/^\d+([.,]\d{1,2})?$/.test(s))return NaN;
 const [whole,fraction='']=s.replace(',','.').split('.'),n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(n)&&n<=MAX?n:NaN;
}
const input=n=>(n/100).toFixed(2).replace('.',',');
const total=(arr,kind)=>arr.reduce((sum,t)=>sum+(t.kind===kind?t.amount:0),0);
function first(from,r){
 const d=date(from),y=d.getFullYear(),m=d.getMonth();
 if(r.freq==='week')return add(from,(r.weekday-d.getDay()+7)%7);
 if(r.freq==='month'){
  const target=fmt(new Date(y,m,Math.min(r.monthDay,days(y,m+1)),12));
  if(target>=from)return target;
  const next=new Date(y,m+1,1,12);return fmt(new Date(next.getFullYear(),next.getMonth(),Math.min(r.monthDay,days(next.getFullYear(),next.getMonth()+1)),12));
 }
 const target=fmt(new Date(y,r.annualMonth-1,Math.min(r.annualDay,days(y,r.annualMonth)),12));
 return target>=from?target:fmt(new Date(y+1,r.annualMonth-1,Math.min(r.annualDay,days(y+1,r.annualMonth)),12));
}
const next=(from,r)=>first(add(from,1),r);
function reconcile(state,today){
 const seen=new Set(state.occurrences||[]);let changed=false;
 for(const r of state.rules){
  if(r.paused)continue;
  let iterations=0;
  while(r.nextDate&&r.nextDate<=today){
   if(++iterations>60000)throw Error('Demasiados pagos pendientes. Revisa las fechas.');
   const id=`rec:${r.id}:${r.nextDate}`;
   if(!seen.has(id)&&!state.transactions.some(t=>t.id===id))state.transactions.push({id,kind:r.kind,catId:r.catId,amount:r.amount,note:r.note||'',date:r.nextDate,ruleId:r.id});
   seen.add(id);r.nextDate=next(r.nextDate,r);changed=true;
  }
 }
 state.occurrences=[...seen];return changed;
}
function migrate(data){
 const d=JSON.parse(JSON.stringify(data));
 if(d.schema!==undefined&&d.schema!==1&&d.schema!==2)throw Error('Estos datos pertenecen a una versión más reciente. Actualiza monemy.');
 if(d.schema===undefined||d.schema===1){
  for(const key of ['transactions','rules'])for(const x of d[key]||[])x.amount=Math.round(x.amount*100);
  for(const x of d.goals||[])x.limit=Math.round(x.limit*100);
 }
 d.schema=2;d.revision=Number.isSafeInteger(d.revision)?d.revision:0;
 d.occurrences=[...new Set([...(d.occurrences||[]),...(d.transactions||[]).filter(t=>t.ruleId).map(t=>`rec:${t.ruleId}:${t.date}`)])];
 d.alertHistory=(Array.isArray(d.alertHistory)?d.alertHistory:[]).filter(a=>a&&typeof a.id==='string'&&/^[a-zA-Z0-9:_-]{1,200}$/.test(a.id)&&['warning','critical'].includes(a.severity)&&validDate(a.date)&&typeof a.title==='string'&&a.title.length<=200&&typeof a.detail==='string'&&a.detail.length<=300).map(a=>({id:a.id,severity:a.severity,date:a.date,title:a.title,detail:a.detail,milestone:Number(a.milestone)||0,read:a.read===true}));
 return d;
}
function validate(data){
 if(!data||data.schema!==2)throw Error('Formato no válido');
 const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,180}$/.test(x);
 const text=(s,n)=>typeof s==='string'&&s.length<=n;
 const money=n=>Number.isSafeInteger(n)&&n>0&&n<=MAX;
 const kind=x=>['income','expense'].includes(x);
 for(const k of ['categories','transactions','rules','goals','occurrences'])if(!Array.isArray(data[k])||data[k].length>100000)throw Error('Formato no válido');
 for(const k of ['categories','transactions','rules','goals'])if(new Set(data[k].map(x=>x.id)).size!==data[k].length)throw Error('Identificadores duplicados');
 for(const c of data.categories)if(!id(c.id)||!kind(c.kind)||!text(c.name,24)||!c.name.trim()||!['food','car','home','game','bag','health','bill','repeat','plane','briefcase','gift','tag','trend','spark','more','help'].includes(c.icon)||!/^#[0-9a-f]{6}$/i.test(c.color))throw Error('Categoría no válida');
 const cat=(catId,k)=>catId===null||data.categories.some(c=>c.id===catId&&c.kind===k);
 for(const t of data.transactions)if(!id(t.id)||!kind(t.kind)||!money(t.amount)||!validDate(t.date)||!text(t.note||'',120)||!cat(t.catId,t.kind)||(t.ruleId&&!id(t.ruleId)))throw Error('Movimiento no válido');
 for(const r of data.rules)if(!id(r.id)||!kind(r.kind)||!money(r.amount)||!cat(r.catId,r.kind)||!text(r.note||'',120)||!validDate(r.nextDate)||!validDate(r.startDate)||typeof r.paused!=='boolean'||!['week','month','year'].includes(r.freq)||!Number.isInteger(r.weekday)||r.weekday<0||r.weekday>6||!Number.isInteger(r.monthDay)||r.monthDay<1||r.monthDay>31||!Number.isInteger(r.annualDay)||r.annualDay<1||r.annualDay>31||!Number.isInteger(r.annualMonth)||r.annualMonth<1||r.annualMonth>12)throw Error('Pago periódico no válido');
 for(const g of data.goals)if(!id(g.id)||!kind(g.kind)||!money(g.limit)||!cat(g.catId,g.kind))throw Error('Objetivo no válido');
 if(data.occurrences.some(x=>!id(x)))throw Error('Historial no válido');
 return data;
}
function monthlyBaseline(state,kind,today){
 const current=today.slice(0,7),all=state.transactions.filter(t=>t.kind===kind&&!t.ruleId&&t.date<=today);
 const earliest=state.transactions.filter(t=>t.date<=today).map(t=>t.date.slice(0,7)).sort()[0];
 if(!earliest)return 0;
 const d=date(current+'-01'),values=[];
 for(let back=6;back>=1;back--){const m=fmt(new Date(d.getFullYear(),d.getMonth()-back,1,12)).slice(0,7);if(m>=earliest)values.push(total(all.filter(t=>t.date.startsWith(m)),kind));}
 if(!values.length){const elapsed=date(today).getDate();return Math.round(total(all.filter(t=>t.date.startsWith(current)),kind)/elapsed*days(d.getFullYear(),d.getMonth()+1));}
 return Math.round(values.slice(1).reduce((e,v)=>(2*v+5*e)/7,values[0]));
}
function recurringMonth(state,r,y,m,from){
 if(r.paused)return 0;
 const start=`${y}-${String(m).padStart(2,'0')}-01`,end=`${y}-${String(m).padStart(2,'0')}-${days(y,m)}`;
 const floor=[start,from,r.startDate,r.nextDate].sort().at(-1);let cursor=first(floor,r),sum=0;
 const seen=new Set(state.occurrences||[]);
 while(cursor<=end){const id=`rec:${r.id}:${cursor}`;if(!seen.has(id)&&!state.transactions.some(t=>t.id===id))sum+=r.amount;cursor=next(cursor,r);}
 return sum;
}
function forecast(state,y,today){
 const current=today.slice(0,7),baseline={income:monthlyBaseline(state,'income',today),expense:monthlyBaseline(state,'expense',today)};
 let acc=0;
 return Array.from({length:12},(_,i)=>{
  const m=i+1,month=`${y}-${String(m).padStart(2,'0')}`,estimated=month>=current;
  const actual=state.transactions.filter(t=>t.date.startsWith(month)&&t.date<=today),planned=state.transactions.filter(t=>t.date.startsWith(month)&&t.date>today);
  const out={month,estimated};
  for(const kind of ['income','expense']){
   let value=total(actual,kind);
   if(estimated){
    const part=month===current?(days(y,m)-date(today).getDate())/days(y,m):1;
    const knownVariable=total(planned.filter(t=>!t.ruleId),kind),knownFixed=total(planned.filter(t=>t.ruleId),kind);
    value+=Math.max(Math.round(baseline[kind]*part),knownVariable)+knownFixed;
    value+=state.rules.filter(r=>r.kind===kind).reduce((sum,r)=>sum+recurringMonth(state,r,y,m,add(today,1)),0);
   }
   out[kind==='income'?'inc':'exp']=value;
  }
  out.net=out.inc-out.exp;out.acc=acc+=out.net;return out;
 });
}
const PALETTE=[{color:'#e47554',name:'Coral'},{color:'#4f98db',name:'Azul'},{color:'#906dce',name:'Violeta'},{color:'#c99432',name:'Ocre'},{color:'#cb7b9b',name:'Rosa'},{color:'#158d70',name:'Verde'},{color:'#589aaf',name:'Turquesa'},{color:'#838f96',name:'Gris'}];
const money=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(n/100);
function alertCandidates(state,today){
 const month=today.slice(0,7),day=date(today).getDate(),length=days(date(today).getFullYear(),date(today).getMonth()+1);
 const expenses=state.transactions.filter(t=>t.kind==='expense'&&t.date.startsWith(month)&&t.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
 const out=[];
 for(const goal of state.goals.filter(g=>g.kind==='expense')){
  const rows=expenses.filter(t=>goal.catId===null||t.catId===goal.catId),spent=total(rows,'expense');
  const label=goal.catId?(state.categories.find(c=>c.id===goal.catId)?.name||'Sin definir'):'total mensual';
  const id=`${month}:${goal.id}`;
  if(spent>=goal.limit){
   out.push({id:id+':limit',date:today,severity:spent>goal.limit?'critical':'warning',title:spent>goal.limit?`Presupuesto superado · ${label}`:`Presupuesto alcanzado · ${label}`,detail:`${money(spent)} de ${money(goal.limit)}.`,milestone:100});continue;
  }
  let pace=null;
  for(const threshold of [25,50,75]){
   let accumulated=0,crossed=null;
   for(const row of rows){accumulated+=row.amount;if(accumulated*100>=goal.limit*threshold){crossed=row.date;break}}
   if(crossed){const elapsed=date(crossed).getDate();if(elapsed<=Math.max(3,Math.floor(length*threshold/200)))pace={id:id+':pace',date:crossed,severity:threshold>=75?'critical':'warning',title:`Gasto rápido · ${label}`,detail:`Has alcanzado el ${threshold}% del presupuesto en solo ${elapsed} ${elapsed===1?'día':'días'}.`,milestone:threshold}}
  }
  if(pace)out.push(pace);
 }
 const now=date(month+'-01'),previous=Array.from({length:3},(_,i)=>fmt(new Date(now.getFullYear(),now.getMonth()-i-1,1,12)).slice(0,7));
 const sums=previous.map(m=>total(state.transactions.filter(t=>t.date.startsWith(m)),'expense'));
 if(previous.every(m=>state.transactions.some(t=>t.kind==='expense'&&t.date.startsWith(m)))){
  const avg=Math.round(sums.reduce((a,b)=>a+b,0)/3),spent=total(expenses,'expense');
  if(avg>0&&spent>avg)out.push({id:`${month}:average`,date:today,severity:spent>=avg*1.25?'critical':'warning',title:'Gasto por encima de tu media',detail:`Llevas ${money(spent)}. La media mensual de los últimos 3 meses es ${money(avg)}.`,milestone:0});
 }
 return out;
}
function collectAlerts(state,today){
 const before=JSON.stringify(state.alertHistory||[]),history=state.alertHistory||(state.alertHistory=[]);
 for(const candidate of alertCandidates(state,today)){
  const existing=history.find(a=>a.id===candidate.id);
  if(!existing)history.push({...candidate,read:false});
  else if((candidate.severity==='critical'&&existing.severity!=='critical')||candidate.milestone>existing.milestone)Object.assign(existing,candidate,{read:false});
 }
 history.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));state.alertHistory=history.slice(0,200);
 return before!==JSON.stringify(state.alertHistory);
}
function activity(state,today){
 const now=date(today),y=now.getFullYear(),m=now.getMonth(),month=today.slice(0,7),length=days(y,m+1);
 const daily=Array.from({length},(_,i)=>({date:`${month}-${String(i+1).padStart(2,'0')}`,income:0,expense:0,net:0,future:i+1>now.getDate()}));
 const anchor=new Date(y,m-3,1,12),windowStart=add(fmt(new Date(anchor.getFullYear(),anchor.getMonth(),Math.min(now.getDate(),days(anchor.getFullYear(),anchor.getMonth()+1)),12)),1);
 const known=state.transactions.filter(t=>t.date<=today),firstDate=known.map(t=>t.date).sort()[0],start=firstDate&&firstDate>windowStart?firstDate:windowStart;
 const byDate=new Map();
 for(const tx of known){
  if(!byDate.has(tx.date))byDate.set(tx.date,{income:0,expense:0});byDate.get(tx.date)[tx.kind]+=tx.amount;
  if(tx.date.startsWith(month)){const cell=daily[date(tx.date).getDate()-1];cell[tx.kind]+=tx.amount;cell.net=cell.income-cell.expense}
 }
 const weekdays=Array.from({length:7},(_,i)=>({weekday:i,income:0,expense:0,net:0,count:0}));
 if(firstDate)for(let cursor=start;cursor<=today;cursor=add(cursor,1)){
  const d=weekdays[(date(cursor).getDay()+6)%7],values=byDate.get(cursor)||{income:0,expense:0};d.income+=values.income;d.expense+=values.expense;d.count++;
 }
 for(const d of weekdays){d.income=d.count?Math.round(d.income/d.count):0;d.expense=d.count?Math.round(d.expense/d.count):0;d.net=d.income-d.expense}
 return {month,offset:(date(month+'-01').getDay()+6)%7,daily,weekdays,start,hasHistory:!!firstDate};
}
function chartDomain(values){
 const min=Math.min(0,...values),max=Math.max(0,...values),span=max-min||100,raw=span/4,power=10**Math.floor(Math.log10(raw)),fraction=raw/power;
 const step=(fraction<=1?1:fraction<=2?2:fraction<=2.5?2.5:fraction<=5?5:10)*power;
 const lo=min<0?Math.floor((min-span*.12)/step)*step:0,hi=max>0?Math.ceil((max+span*.18)/step)*step:0;
 return {min:lo,max:hi===lo?lo+step*4:hi,step};
}
const api={MAX,PALETTE,fmt,date,days,add,validDate,parseCents,input,total,first,next,reconcile,migrate,validate,monthlyBaseline,forecast,alertCandidates,collectAlerts,activity,chartDomain};
root.MD=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
