'use strict';
let alertsOpen=false,forecastMode='savings',chosenColor='#158d70';
const MONTHS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const WEEKDAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
function nearestPalette(hex){
 const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));const source=rgb(hex);
 return MD.PALETTE.reduce((best,p)=>{const distance=rgb(p.color).reduce((sum,n,i)=>sum+(n-source[i])**2,0);return distance<best.distance?{color:p.color,distance}:best},{color:MD.PALETTE[0].color,distance:Infinity}).color;
}
function colorChoices(){return `<input id="new-cat-color" type="hidden" value="${chosenColor}"><div class="palette" aria-label="Color de categoría">${MD.PALETTE.map(p=>`<button type="button" data-pick-color="${p.color}" class="color-swatch ${chosenColor===p.color?'selected':''}" style="--swatch:${p.color}" aria-label="${p.name}" aria-pressed="${chosenColor===p.color}"><span aria-hidden="true">${chosenColor===p.color?'✓':''}</span></button>`).join('')}</div>`}
function renderAlerts(){
 const history=state.alertHistory||[],unread=history.filter(a=>!a.read),critical=unread.some(a=>a.severity==='critical'),badge=$('#alert-badge');
 badge.textContent=unread.length>99?'99+':unread.length;badge.classList.toggle('hidden',!unread.length);badge.classList.toggle('critical',critical);
 $('#inbox-toggle').setAttribute('aria-label',`Alertas${unread.length?`, ${unread.length} sin leer`:''}`);$('#inbox-toggle').setAttribute('aria-expanded',String(alertsOpen));
 $('#alerts-panel').classList.toggle('hidden',!alertsOpen);if(!alertsOpen)return;
 $('#read-all-alerts').disabled=!unread.length;
 $('#alert-list').innerHTML=history.length?history.map(a=>`<article class="alert-card ${a.severity} ${a.read?'read':''}"><div class="alert-heading"><span class="alert-symbol" aria-label="${a.severity==='critical'?'Importante':'Aviso'}">${a.severity==='critical'?'!':'⚠'}</span><b>${esc(a.title)}</b>${!a.read?'<span class="unread-dot" aria-label="Sin leer"></span>':''}</div><p>${esc(a.detail)}</p><div class="alert-footer"><time datetime="${a.date}">${dateText(a.date)}</time>${!a.read?`<button class="muted-link" data-read-alert="${esc(a.id)}">Marcar como leída</button>`:'<span>Leída</span>'}</div></article>`).join(''):'<div class="empty">Todo en orden. Aquí aparecerán tus avisos.</div>';
}
async function readAlerts(id){for(const a of state.alertHistory||[])if(!id||a.id===id)a.read=true;await save();renderAlerts()}
function savingsChart(data){
 const W=864,H=318,L=56,R=14,T=35,B=42,w=W-L-R,h=H-T-B,domain=MD.chartDomain(data.map(d=>d.net));
 const x=i=>L+(i+.5)*w/12,y=v=>T+h-(v-domain.min)/(domain.max-domain.min)*h;
 const label=n=>Math.abs(n)<10000?euro(n):shortEuro(n);
 let axis='';let svg=`<svg class="savings-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ahorro mensual en euros, con importes por mes">`;
 for(let value=domain.min;value<=domain.max+domain.step*.01;value+=domain.step){const yy=y(value);svg+=`<line x1="${L}" x2="${W-R}" y1="${yy}" y2="${yy}" stroke="${value===0?'#bacdc6':'#e7eeea'}" stroke-dasharray="${value===0?'0':'3 6'}"/><text x="${L-8}" y="${yy+4}" text-anchor="end">${new Intl.NumberFormat('es-ES',{notation:'compact',maximumFractionDigits:1}).format(value/100)}</text>`;axis+=`<text x="${L-8}" y="${yy+4}" text-anchor="end">${new Intl.NumberFormat('es-ES',{notation:'compact',maximumFractionDigits:1}).format(value/100)}</text>`}
 data.forEach((d,i)=>{const xx=x(i),yy=y(d.net),zero=y(0),color=d.net<0?'#d87565':'#168c72',textY=d.net<0?yy+19:yy-10;
  svg+=`<rect x="${xx-17}" y="${Math.min(yy,zero)}" width="34" height="${Math.max(1,Math.abs(yy-zero))}" rx="5" fill="${color}" opacity="${d.estimated?'.35':'.88'}"/>`;
  if(d.estimated)svg+=`<path d="M${xx-17},${zero} V${yy} H${xx+17} V${zero}" fill="none" stroke="${color}" stroke-dasharray="4 3"/>`;
  svg+=`<text class="saving-amount" x="${xx}" y="${textY}" text-anchor="middle" style="fill:${d.net<0?'#b54f43':'#176b5b'}">${label(d.net)}</text><text x="${xx}" y="${H-14}" text-anchor="middle">${MONTHS[i]}</text>`;
  svg+=`<rect tabindex="0" role="button" aria-label="${MONTHS[i]}: ${esc(euro(d.net))}${d.estimated?', previsto':''}" data-chart-index="${i}" x="${L+i*w/12}" y="0" width="${w/12}" height="${H}" fill="transparent"/>`;
 });return `<div class="savings-axis" aria-hidden="true"><svg viewBox="0 0 ${L} ${H}" preserveAspectRatio="none">${axis}</svg></div><div class="savings-scroll">${svg}</svg></div>`;
}
function renderProjectionChart(data){
 $('#forecast-chart-title').textContent=forecastMode==='savings'?'Ahorro mensual':'Evolución mensual';
 $$('[data-forecast-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.forecastMode===forecastMode));
 $('#forecast-series-legend').classList.toggle('hidden',forecastMode==='savings');$('#chart-scroll-hint').classList.toggle('hidden',forecastMode!=='savings');
 $('#forecast-chart').classList.toggle('scroll-chart',forecastMode==='savings');$('#forecast-chart').innerHTML=forecastMode==='savings'?savingsChart(data):svgChart(data);
 if(forecastMode==='savings'){const now=new Date(),focus=forecastYear===now.getFullYear()?now.getMonth():Math.max(0,data.map((d,i)=>(d.inc||d.exp)?i:-1).reduce((a,b)=>Math.max(a,b),0));$('#forecast-chart .savings-scroll').scrollLeft=Math.max(0,(focus-2)*700/12)}
}
function heatColor(net,max){
 if(!net||!max)return '#eef2f0';const intensity=Math.min(4,Math.max(1,Math.ceil(Math.sqrt(Math.abs(net)/max)*4)));
 return (net>0?['#dbf2e7','#a5dcbf','#58b88e','#168c65']:['#fce7e2','#f6bcaf','#e98e7a','#ce5e4d'])[intensity-1];
}
function renderActivity(){
 const model=MD.activity(state,dateNow()),max=Math.max(0,...model.daily.map(d=>Math.abs(d.net))),weekMax=Math.max(0,...model.weekdays.map(d=>Math.abs(d.net)));
 $('#activity-month').textContent=new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(dateObj(model.month+'-01'));
 $('#month-heatmap').innerHTML=Array.from({length:model.offset},()=>'<span class="heat-spacer" aria-hidden="true"></span>').join('')+model.daily.map((d,i)=>`<button class="heat-cell ${d.future?'future':''} ${d.date===dateNow()?'today':''}" data-calendar-date="${d.date}" style="--heat:${d.future?'#f7f9f8':heatColor(d.net,max)};--heat-text:${Math.abs(d.net)>=max*.45&&d.net?'white':'#314e45'}" aria-label="${i+1}: ${d.future?'sin datos todavía':esc(euro(d.net))}" ${d.future?'disabled':''}>${i+1}</button>`).join('');
 $('#weekday-heatmap').innerHTML=model.weekdays.map((d,i)=>`<button class="heat-cell weekday-cell" data-weekday="${i}" style="--heat:${heatColor(d.net,weekMax)};--heat-text:${Math.abs(d.net)>=weekMax*.45&&d.net?'white':'#314e45'}" aria-label="${WEEKDAYS[i]}, promedio ${esc(euro(d.net))}"><span>${['L','M','X','J','V','S','D'][i]}</span><b>${d.count?shortEuro(d.net):'—'}</b></button>`).join('');
 $('#activity-detail').classList.add('hidden');$('#weekday-detail').classList.add('hidden');
}
function showActivityDetail(dateValue,weekday){
 const model=MD.activity(state,dateNow()),cell=dateValue?model.daily.find(d=>d.date===dateValue):model.weekdays[weekday];if(!cell)return;
 const el=$(dateValue?'#activity-detail':'#weekday-detail');
 const label=dateValue?new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long'}).format(dateObj(dateValue)):WEEKDAYS[weekday];
 el.innerHTML=`<b>${esc(label)}</b><span>Ingresos ${euro(cell.income)} · Gastos ${euro(cell.expense)}</span><strong class="${cell.net<0?'negative':''}">${cell.net>0?'+':''}${euro(cell.net)}${dateValue?'':' de media'}</strong>`;el.classList.remove('hidden');
}
