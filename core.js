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
 d.alertHistory=(Array.isArray(d.alertHistory)?d.alertHistory:[]).filter(a=>a&&typeof a.id==='string'&&/^[a-zA-Z0-9:_-]{1,200}$/.test(a.id)&&['warning','critical','playful'].includes(a.severity)&&validDate(a.date)&&typeof a.title==='string'&&a.title.length<=200&&typeof a.detail==='string'&&a.detail.length<=300).map(a=>({id:a.id,severity:a.severity,date:a.date,title:a.title,detail:a.detail,milestone:Number(a.milestone)||0,read:a.read===true}));
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
const ALERT_PHRASES={
 near:['Quillo, afloja un poquito que todavía queda mes.','Chacho, ese presupuesto ya está pidiendo descanso.'],
 limit:['Chacho, te lo ventilaste todo. Y sin despeinarte.','¿Pa qué pusimos un límite? ¿Pa qué?'],
 over:['Tú el presupuesto lo pusiste de decoración, ¿no?','Chacho, el límite se quedó bastante atrás.'],
 pace:['Vete otra vez a la tiendita, que todavía te queda algo.','Chacho, ¿estás haciendo un speedrun del presupuesto?'],
 fast:['Chacho, que no te mueres mañana. Deja algo pal resto de días.','Chacho, ¿estás haciendo un speedrun del presupuesto?'],
 average:['Arriba España, pero tus gastos más todavía.','Quillo, este mes te estás viniendo arriba con las compras.'],
 averageHigh:['Fleje de gasto llevas este mes. ¿Estás manteniendo tú solo la economía?','Chacho, tus gastos van por libre este mes.'],
 daily:['Fleje de mierda te compraste hoy, ¿no?','Quillo, hoy saliste con ganas de financiar comercios.'],
 due:['No te emociones con lo que queda, que mañana viene el sablazo.','Quillo, mañana toca pasar por caja.'],
 forecast:['Vete abriendo OnlyFans, que este mes las cuentas vienen creativas.','Chacho, afloja, que este mes las cuentas no cuadran.'],
 welcome:['Chacho, esto está más vacío que tu futuro. Empieza por meter algo.'],
 firstExpense:['Ya era hora. Ahora vamos a descubrir por dónde se te escapa la pasta.'],
 firstIncome:['Por fin entra algo, mi niño. Ya me estaba preocupando.'],
 meal:['¿Invitaste a la pesada de tu mujer o te comiste también la mesa?','Quillo, ¿fuiste a comer o compraste el restaurante?'],
 five:['Chacho, ¿saliste a dar una vuelta o a financiar comercios?','Chacho, ¿estás haciendo un speedrun del presupuesto?'],
 small:['Dos euritos por aquí, tres por allá… así también se hunde un barco, mi niño.','Quillo, esos gastos chicos ya están haciendo una montaña.'],
 sale:['La tiendita funciona, ¿eh? Tú calladito, pero facturando.','La tienda funciona bien, ¿eh? Hoy sí se factura.'],
 extra:['¿Y esta alegría? No te la gastes antes de terminar de registrarla.','Ni tan mal, mi niño. Hoy no hay bronca.'],
 back:['Hombre, apareció. ¿Estos días viviste del aire o qué?','Chacho, ya se te echaba de menos por aquí. ¿Nos ponemos al día?'],
 incomeGoal:['La tienda funciona bien, ¿eh? Hoy sí se factura.','Por fin haces algo de provecho. Hasta da gusto abrir esto.','Ni tan mal, mi niño. Hoy no hay bronca.'],
 saved:['Por fin haces algo de provecho. Este mes guardaste algo.','Arriba España, porque tus ahorros por fin también.'],
 budgetKept:['Mira tú, sobró presupuesto. ¿Te encontrabas bien?','Ni tan mal, mi niño. Hoy no hay bronca.']
};
const alertRank=severity=>({critical:2,warning:1,playful:0}[severity]??0);
const alertMonth=s=>s.slice(0,7);
const previousMonth=today=>{const d=date(today);return fmt(new Date(d.getFullYear(),d.getMonth()-1,1,12)).slice(0,7)};
const alertLabel=(state,catId)=>catId?(state.categories.find(c=>c.id===catId)?.name||'Sin definir'):'Total mensual';
const monthlyRows=(state,month,today)=>state.transactions.filter(t=>t.date.startsWith(month)&&t.date<=today);
function makeAlert(id,day,severity,phrase,detail,milestone=0){return {id,date:day,severity,phrase,title:ALERT_PHRASES[phrase][0],detail,milestone}}
function alertCandidates(state,today){
 const month=alertMonth(today),length=days(date(today).getFullYear(),date(today).getMonth()+1);
 const expenses=state.transactions.filter(t=>t.kind==='expense'&&t.date.startsWith(month)&&t.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
 const out=[];
 for(const goal of state.goals.filter(g=>g.kind==='expense')){
  const rows=expenses.filter(t=>goal.catId===null||t.catId===goal.catId),spent=total(rows,'expense'),label=alertLabel(state,goal.catId),id=`${month}:${goal.id}`;
  if(spent>=goal.limit){out.push(makeAlert(id+':limit',today,spent>goal.limit?'critical':'warning',spent>goal.limit?'over':'limit',`${label}: ${money(spent)} de ${money(goal.limit)}.`,100));continue}
  let pace=null;
  for(const threshold of [25,50,75]){
   let accumulated=0,crossed=null;
   for(const row of rows){accumulated+=row.amount;if(accumulated*100>=goal.limit*threshold){crossed=row.date;break}}
   if(crossed){const elapsed=date(crossed).getDate();if(elapsed<=Math.max(3,Math.floor(length*threshold/200)))pace=makeAlert(id+':pace',crossed,threshold>=75?'critical':'warning',threshold>=75?'fast':'pace',`${label}: has alcanzado el ${threshold}% del presupuesto en solo ${elapsed} ${elapsed===1?'día':'días'}.`,threshold)}
  }
  if(pace?.severity==='critical')out.push(pace);
  else if(spent*100>=goal.limit*80)out.push(makeAlert(id+':near',today,'warning','near',`${label}: ${money(spent)} de ${money(goal.limit)}.`,80));
  else if(pace)out.push(pace);
 }
 const now=date(month+'-01'),previous=Array.from({length:3},(_,i)=>fmt(new Date(now.getFullYear(),now.getMonth()-i-1,1,12)).slice(0,7));
 const sums=previous.map(m=>total(monthlyRows(state,m,today),'expense'));
 if(sums.every(n=>n>0)){
  const avg=Math.round(sums.reduce((a,b)=>a+b,0)/3),spent=total(expenses,'expense');
  if(avg>0&&spent>avg)out.push(makeAlert(`${month}:average`,today,spent>=avg*1.25?'critical':'warning',spent>=avg*1.25?'averageHigh':'average',`Llevas ${money(spent)}. La media mensual de los últimos 3 meses es ${money(avg)}.`));
 }
 const earlier=state.transactions.filter(t=>t.date<today),firstDate=earlier.map(t=>t.date).sort()[0],floor=add(today,-30),start=firstDate&&firstDate>floor?firstDate:floor;
 const span=Math.round((date(today)-date(start))/86400000),dailyMean=span?Math.round(total(earlier.filter(t=>t.date>=start),'expense')/span):0,spentToday=total(expenses.filter(t=>t.date===today),'expense');
 if(firstDate&&span>=14&&spentToday>=3000&&spentToday>dailyMean*2)out.push(makeAlert(`${today}:daily-spend`,today,'warning','daily',`Hoy: ${money(spentToday)}. Tu media diaria anterior: ${money(dailyMean)}.`));
 const tomorrow=add(today,1);
 for(const rule of state.rules.filter(r=>r.kind==='expense'&&!r.paused&&r.nextDate===tomorrow))out.push(makeAlert(`due:${tomorrow}:${rule.id}`,today,'warning','due',`Mañana: ${rule.note||alertLabel(state,rule.catId)} · ${money(rule.amount)}.`));
 if(previous.every(m=>{const rows=monthlyRows(state,m,today);return total(rows,'income')>0&&total(rows,'expense')>0})){
  const projection=forecast(state,date(today).getFullYear(),today)[date(today).getMonth()];
  if(projection.exp>projection.inc)out.push(makeAlert(`${month}:forecast`,today,'critical','forecast',`Previsión del mes: ingresos ${money(projection.inc)} · gastos ${money(projection.exp)} · neto −${money(projection.exp-projection.inc)}.`));
 }
 return out;
}
function collectAlerts(state,today,options={}){
 const before=JSON.stringify([state.alertHistory||[],state.alertMeta]),history=state.alertHistory||(state.alertHistory=[]),month=alertMonth(today),old=state.alertMeta;
 const fresh=options.baseline||!old||old.version!==1||!validDate(old.since)||!validDate(old.lastVisit)||!validDate(old.month+'-01')||!Array.isArray(old.budgets)||!old.budgets.every(g=>g&&typeof g.id==='string'&&(g.catId===null||typeof g.catId==='string')&&Number.isSafeInteger(g.limit)&&g.limit>0)||typeof old.firstExpense!=='boolean'||typeof old.firstIncome!=='boolean'||!old.phrases||typeof old.phrases!=='object'||Array.isArray(old.phrases);
 const meta=fresh?{version:1,since:today,lastVisit:today,month,budgets:[],firstExpense:state.transactions.some(t=>t.kind==='expense'),firstIncome:state.transactions.some(t=>t.kind==='income'),lastFunDay:null,lastPhrase:'',phrases:{}}:old;
 state.alertMeta=meta;
 const append=candidate=>{
  const existing=history.find(a=>a.id===candidate.id);
  if(existing&&!(alertRank(candidate.severity)>alertRank(existing.severity)||candidate.milestone>existing.milestone))return false;
  const choices=ALERT_PHRASES[candidate.phrase],count=Number.isSafeInteger(meta.phrases[candidate.phrase])?meta.phrases[candidate.phrase]:0;let index=count%choices.length;
  if(choices.length>1&&choices[index]===meta.lastPhrase)index=(index+1)%choices.length;
  const {phrase,...value}=candidate;value.title=choices[index];meta.phrases[phrase]=index+1;meta.lastPhrase=value.title;
  if(existing)Object.assign(existing,value,{read:false});else history.push({...value,read:false});return true;
 };
 let attention=false;for(const candidate of alertCandidates(state,today))if(append(candidate))attention=true;
 const fun=(key,phrase,detail,exception=false)=>{
  if(attention||options.baseline||(!exception&&meta.lastFunDay===today))return false;
  if(append(makeAlert(key,today,'playful',phrase,detail))){meta.lastFunDay=today;return true}return false;
 };
 if(!fresh&&meta.month!==month){
  if(meta.month===previousMonth(today)){
   const rows=monthlyRows(state,meta.month,today),net=total(rows,'income')-total(rows,'expense'),label=new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(date(meta.month+'-01'));
   if(rows.length&&net>0)fun(`${meta.month}:saved`,'saved',`${label}: ${money(net)} de ahorro.`,true);
   for(const goal of meta.budgets){const spent=total(rows.filter(t=>goal.catId===null||t.catId===goal.catId),'expense');if(rows.length&&spent<goal.limit)fun(`${meta.month}:${goal.id}:kept`,'budgetKept',`${label} · ${alertLabel(state,goal.catId)}: ${money(spent)} de ${money(goal.limit)}.`,true)}
  }
 }
 if(!fresh&&options.previous?.alertMeta){
  for(const goal of state.goals.filter(g=>g.kind==='income')){
   const previousGoal=options.previous.goals.find(g=>g.id===goal.id&&g.limit===goal.limit&&g.catId===goal.catId&&g.kind===goal.kind);if(!previousGoal)continue;
   const selected=s=>monthlyRows(s,month,today).filter(t=>goal.catId===null||t.catId===goal.catId),current=total(selected(state),'income'),previous=total(selected(options.previous),'income');
   if(current>=goal.limit&&previous<goal.limit)fun(`${month}:${goal.id}:income`,'incomeGoal',`${alertLabel(state,goal.catId)}: ${money(current)} de ${money(goal.limit)} de ingreso objetivo.`,true);
  }
 }
 const transaction=options.transaction&&state.transactions.find(t=>t.id===options.transaction),newEntry=transaction&&!fresh&&transaction.date>=meta.since&&transaction.date<=today&&!options.previous?.transactions.some(t=>t.id===transaction.id);
 if(newEntry){
  const isFirst=transaction.kind==='expense'?!meta.firstExpense:!meta.firstIncome;
  if(transaction.kind==='expense')meta.firstExpense=true;else meta.firstIncome=true;
  if(isFirst)fun(`social:first-${transaction.kind}`,transaction.kind==='expense'?'firstExpense':'firstIncome',`${transaction.kind==='expense'?'Gasto':'Ingreso'} · ${money(transaction.amount)}.`,true);
  else if(transaction.date===today){
   const cat=state.categories.find(c=>c.id===transaction.catId),name=(cat?.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),label=`${cat?.name||'Sin definir'} · ${money(transaction.amount)}.`,rows=state.transactions.filter(t=>t.date===today&&t.kind==='expense'&&!t.ruleId),small=rows.filter(t=>t.amount<=1000);
   if(transaction.kind==='expense'&&transaction.amount>4000&&(cat?.id==='food'||['comida','restaurantes','alimentacion'].includes(name)))fun(`${today}:social:meal`,'meal',label);
   else if(transaction.kind==='expense'&&rows.length>=5)fun(`${today}:social:five`,'five',`${rows.length} gastos registrados hoy.`);
   else if(transaction.kind==='expense'&&small.length>=4&&total(small,'expense')>=1500)fun(`${today}:social:small`,'small',`${small.length} gastos de hasta 10 € · ${money(total(small,'expense'))} en total.`);
   else if(transaction.kind==='income'&&(cat?.id==='sales'||name==='ventas'))fun(`${today}:social:sale`,'sale',label);
   else if(transaction.kind==='income'&&(cat?.id==='extras'||name==='extras'))fun(`${today}:social:extra`,'extra',label);
  }
 }
 if(!state.transactions.length)fun('social:welcome','welcome','');
 if(options.visit){const absent=Math.round((date(today)-date(meta.lastVisit))/86400000);if(!fresh&&absent>=4)fun(`${today}:social:back`,'back',`${absent} días desde tu última visita.`);meta.lastVisit=today}
 meta.month=month;meta.budgets=state.goals.filter(g=>g.kind==='expense').map(({id,catId,limit})=>({id,catId,limit}));
 history.sort((a,b)=>b.date.localeCompare(a.date)||alertRank(b.severity)-alertRank(a.severity)||a.id.localeCompare(b.id));state.alertHistory=history.slice(0,200);
 return before!==JSON.stringify([state.alertHistory,state.alertMeta]);
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
