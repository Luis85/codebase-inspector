(function(){
const paths={
 city:'<path d="M3 21V9l6-3v15M9 21V3l6 3v15M15 21V11l6-3v13M1 21h22M5 11v1m0 3v1m6-9v1m0 3v1m0 3v1m6-2v1m0 3v1"/>',
 overview:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 architecture:'<rect x="8" y="2" width="8" height="5" rx="1"/><rect x="2" y="17" width="7" height="5" rx="1"/><rect x="15" y="17" width="7" height="5" rx="1"/><path d="M12 7v5H5v5m7-5h7v5"/>',
 hotspots:'<path d="M13 2c1 5-3 6-1 9 2-1 3-3 3-5 5 4 6 8 3 12-4 5-12 3-13-2-1-4 2-7 4-8 0 3 0 4 1 4 1-5 4-5 3-10Z"/>',
 quality:'<path d="m9 5-7 7 7 7m6-14 7 7-7 7m-2-15-2 20"/>',
 tests:'<path d="M9 3h6m-5 0v6l-6 10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L14 9V3M8 14h8"/>',
 dependencies:'<path d="m12 2 9 5v10l-9 5-9-5V7l9-5ZM3 7l9 5 9-5m-9 5v10M7 4l10 6"/>',
 security:'<path d="M12 2 3 6v6c0 5 6 9 9 10 3-1 9-5 9-10V6l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
 evolution:'<path d="M3 3v18h18M6 15l5-5 4 3 6-8m-5 0h5v5"/>',
 ownership:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4m1-17a3 3 0 0 1 0 6m2 3c3 1 3 4 3 8"/>',
 workbench:'<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M9 6V3h6v3M3 12h18M10 12v3h4v-3"/>',
 report:'<path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 12h8m-8 4h8"/>',
 sources:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
 settings:'<path d="m9 3 1-2h4l1 2 3 1 2-1 2 3-1 2v4l1 2-2 3-2-1-3 1-1 3h-4l-1-3-3-1-2 1-2-3 1-2V8L2 6l2-3 2 1 3-1Z"/><circle cx="12" cy="10" r="3"/>',
 search:'<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 arrowup:'<path d="M12 20V4m-6 6 6-6 6 6"/>',
 chevron:'<path d="m9 5 7 7-7 7"/>',
 chevrondown:'<path d="m6 9 6 6 6-6"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',
 minus:'<path d="M4 12h16"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
 compare:'<path d="M8 3v18M4 7l4-4 4 4M16 21V3m-4 14 4 4 4-4"/>',
 branch:'<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10m0-4h6a6 6 0 0 0 6-6"/>',
 folder:'<path d="M3 6h7l2 2h9v13H3V6Zm0 0V3h7l2 3h7v2"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l1 1m14 14 1 1M4 20l1-1M19 5l1-1"/>',
 moon:'<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.01"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-10v.01"/>',
 warning:'<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3v.01"/>',
 external:'<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>',
 eye:'<path d="M2 12c5-10 15-10 20 0-5 10-15 10-20 0Z"/><circle cx="12" cy="12" r="3"/>',
 filter:'<path d="M3 4h18l-7 8v7l-4 2V12L3 4Z"/>',
 refresh:'<path d="M21 4v6h-6M3 20v-6h6M20 10a8 8 0 0 0-14-5M4 14a8 8 0 0 0 14 5"/>',
 focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="4"/>',
 layers:'<path d="m12 2 10 6-10 6L2 8l10-6ZM2 12l10 6 10-6M2 16l10 6 10-6"/>',
 list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',
 link:'<path d="m9 15 6-6m-6 0 4-4a4 4 0 0 1 6 6l-4 4m0 0-4 4a4 4 0 0 1-6-6l4-4"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
 play:'<path d="m7 3 14 9-14 9V3Z"/>',
 file:'<path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5"/>',
 lock:'<rect x="5" y="10" width="14" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v3"/>',
 dots:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 reset:'<path d="M3 11a9 9 0 1 1 3 8M3 3v8h8"/>',
 print:'<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v8H6v-8Zm11-2h1"/>'
};
const icon=(name,size=16)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.file}</svg>`;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>Number(x).toLocaleString('en-US');
const badge=(text,type='')=>`<span class="badge ${esc(type||text.toLowerCase())}">${esc(text)}</span>`;
const btn=(text,action,ico='',kind='',data='')=>`<button class="btn ${kind}" data-action="${action}" ${data}>${ico?icon(ico,14):''}${text}</button>`;
const iconBtn=(name,action,title,data='')=>`<button class="icon-btn" data-action="${action}" title="${esc(title)}" aria-label="${esc(title)}" ${data}>${icon(name)}</button>`;
const progress=(v,type='')=>`<div class="progress ${type}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v)}" aria-label="${Math.round(v)} percent"><span style="width:${Math.max(0,Math.min(100,v))}%"></span></div>`;
function spark(values,color='var(--accent)',w=100,h=30){let max=Math.max(...values),min=Math.min(...values),range=max-min||1;let pts=values.map((v,i)=>`${i/(values.length-1)*w},${h-3-(v-min)/range*(h-6)}`).join(' ');return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Trend: ${values.join(', ')}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.7" stroke-linejoin="round"/></svg>`;}
function metric(label,value,foot,ico='overview',color='',trend=null){return `<div class="metric-card"><div class="metric-label">${icon(ico,14)} ${label}</div><div class="row"><div class="metric-value ${color}">${value}</div>${trend?`<div class="metric-spark">${spark(trend,'var(--'+(color||'accent')+')',72,26)}</div>`:''}</div><div class="metric-foot">${foot}</div></div>`;}
function panel(title,subtitle,body,actions='',foot=''){return `<section class="panel"><div class="panel-head"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${actions}</div>${body}${foot?`<div class="panel-foot">${foot}</div>`:''}</section>`;}
function lineChart(series,labels,title='History',max=100){const W=700,H=220,left=37,right=13,top=14,bottom=31;const x=i=>left+i/(labels.length-1)*(W-left-right),y=v=>top+(1-v/max)*(H-top-bottom);let chart=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>`;for(let i=0;i<5;i++){let v=max*i/4;chart+=`<line class="gridline" x1="${left}" y1="${y(v)}" x2="${W-right}" y2="${y(v)}"/><text x="${left-9}" y="${y(v)+3}" text-anchor="end">${Math.round(v)}</text>`;}series.forEach((s,si)=>{let pts=s.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ');if(si===0)chart+=`<defs><linearGradient id="area-grad-${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity=".17"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs><polygon points="${x(0)},${y(0)} ${pts} ${x(s.values.length-1)},${y(0)}" fill="url(#area-grad-${si})"/>`;chart+=`<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;s.values.forEach((v,i)=>chart+=`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${s.color}"><title>${esc(s.name)} · ${labels[i]}: ${v}</title></circle>`);});labels.forEach((l,i)=>{chart+=`<text x="${x(i)}" y="${H-7}" text-anchor="middle">${l}</text>`;});return chart+'</svg>'+`<div class="chart-legend">${series.map(s=>`<span><i class="legend-swatch" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;}
function barChart(values,labels,color='var(--accent)',title='Activity'){const W=640,H=190,left=30,bottom=28,top=12,max=Math.ceil(Math.max(...values)/10)*10;let out=`<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>`;for(let i=0;i<4;i++){let v=max*i/3,y=H-bottom-(H-bottom-top)*i/3;out+=`<line class="gridline" x1="${left}" y1="${y}" x2="${W}" y2="${y}"/><text x="${left-8}" y="${y+3}" text-anchor="end">${Math.round(v)}</text>`;}const bw=(W-left)/values.length;values.forEach((v,i)=>{let h=(H-bottom-top)*v/max,x=left+i*bw+bw*.22;out+=`<rect x="${x}" y="${H-bottom-h}" width="${bw*.56}" height="${h}" fill="${color}" opacity="${.45+i/values.length*.5}" rx="3"><title>${labels[i]}: ${v}</title></rect><text x="${x+bw*.28}" y="${H-8}" text-anchor="middle">${labels[i]}</text>`;});return out+'</svg>';}
function fileCell(f){return `<div class="file-cell"><span class="file-icon">TS</span><div><div class="file-name">${esc(f.name)}</div><div class="file-path">${esc(f.path)}</div></div></div>`;}
function empty(title,text,action=''){return `<div class="empty-state">${icon('search',27)}<h2>${title}</h2><p>${text}</p>${action}</div>`;}
window.CIUI={icon,esc,fmt,badge,btn,iconBtn,progress,spark,metric,panel,lineChart,barChart,fileCell,empty};
})();
