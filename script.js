
(function(){
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scriptURL = "https://script.google.com/macros/s/AKfycbzVzNPx9iTSbJwdaYH3YSNRuyaMgXel40oWfDlzY8KlMLXG2X5-1X63A9QBgF8JDD-z/exec";
const CACHE_KEY = "c2tech_machines_data_v3", SYNC_KEY = "last_sync_time", LANG_KEY = "c2_lang", THEME_KEY = "c2_theme";
const pad=n=>String(n).padStart(2,'0');
const ymdOf=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
// วันที่จากชีต: Apps Script ส่งเป็นเวลาสากล (เช่น 2026-09-30T17:00:00Z = 1 ต.ค. เวลาไทย) → ใช้วันที่ตามเวลาเครื่อง
// (แก้บั๊กเดิมที่ใช้ toISOString แล้ววันที่ถอยหลัง 1 วันทุกครั้งที่กดแก้ไข)
const ymd=v=>{if(!v)return '';const t=String(v).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(t))return t;const d=new Date(t);return isNaN(d)?'':ymdOf(d)};
let TODAY=ymdOf(new Date());
const D=s=>new Date(s+'T00:00:00');
const days=(a,b)=>a?Math.max(0,Math.round((D(b||TODAY)-D(a))/864e5)):0;
const addD=(s,n)=>{const d=D(s);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};

/* ---------- i18n (UI) ---------- */
const T={th:{'nav.machines':'เครื่องทั้งหมด','nav.trials':'การทดลอง',refresh:'รีเฟรชข้อมูล',admin:'เข้าสู่ระบบ Admin',adminOut:'ออกจาก Admin',search:'ค้นหา S/N, ลูกค้า, สถานที่…',allClients:'ลูกค้าทั้งหมด',allModes:'ทุกโหมด',allTypes:'ทุกประเภท',clear:'ล้างตัวกรอง',units:'เครื่อง',days:'วัน',updated:'อัปเดต',
 st:{all:'ทั้งหมด',Stock:'ในคลัง',Test:'กำลังทดลอง',Complete:'ขายแล้ว',Broken:'ส่งซ่อม'},res:{Bought:'ซื้อ',"Not Bought":'ไม่ซื้อ',Pending:'รอพิจารณา'},
 cols:['S/N Analyzer','Model','ลูกค้า / สถานที่','Mode','ประเภท','สถานะ','ส่งมอบ','ใช้งานมา']},
en:{'nav.machines':'All Machines','nav.trials':'Trials',refresh:'Refresh data',admin:'Admin login',adminOut:'Leave Admin',search:'Search S/N, client, location…',allClients:'All clients',allModes:'All modes',allTypes:'All types',clear:'Clear filters',units:'units',days:'days',updated:'Updated',
 st:{all:'All',Stock:'In stock',Test:'On trial',Complete:'Sold',Broken:'In repair'},res:{Bought:'Bought',"Not Bought":'Not bought',Pending:'Pending'},
 cols:['S/N Analyzer','Model','Client / Location','Mode','Type','Status','Delivered','In use']}};
let L=T.th;
const ST_C={Stock:['--stock','--stock-bg'],Test:['--test','--test-bg'],Complete:['--sold','--sold-bg'],Broken:['--broken','--broken-bg']};
const RS_C={Bought:['--sold','--sold-bg'],"Not Bought":['--broken','--broken-bg'],Pending:['--pend','--pend-bg']};
const pill=(txt,c)=>`<span class="pill" style="--c:var(${c[0]});--b:var(${c[1]})">${esc(txt)}</span>`;
const stPill=s=>pill(L.st[s]||s,ST_C[s]||ST_C.Stock);
const rsPill=r=>pill(L.res[r]||r,RS_C[r]||RS_C.Pending);
const fmtD=s=>{if(!s)return '–';const d=D(s);return d.toLocaleDateString(L===T.th?'th-TH':'en-GB',{day:'numeric',month:'short',year:'2-digit'})};

/* ---------- ข้อมูลสมมติ ---------- */
let S={machines:[],hist:[]};
const normStatus=v=>{const x=String(v||'').toLowerCase();return x.includes('complete')?'Complete':x.includes('broken')?'Broken':(x.includes('test')||x.includes('progress'))?'Test':'Stock'};
const normResult=v=>{const x=String(v||'').trim();return x==='Bought'||x==='Not Bought'?x:'Pending'};
function ingest(data){
  const ms=(Array.isArray(data)?data:(data.machines||[])).filter(r=>String(r["Type"]||'').toLowerCase()!=='sorter'&&String(r["S/N Analyzer"]||'').trim());
  S.machines=ms.map(r=>({sn:String(r["S/N Analyzer"]).trim(),edge:r["S/N Edge server"]||'',model:r["Model"]||'',mode:r["Mode"]||'',type:r["Type"]||'',
    status:normStatus(r["Status"]),raw:String(r["Status"]||'').trim(),client:r["Client name"]||'',loc:r["Location"]||'',deliv:ymd(r["Delivery date"]),period:parseInt(r["Period"],10),pmDone:!!(r["PM1_Status"]||r["PM2_Status"]||r["PM3_Status"])}));
  S.hist=(Array.isArray(data)?[]:(data.histories||[])).filter(h=>String(h["S/N Analyzer"]||'').trim()).map(h=>({id:String(h["ID"]),sn:String(h["S/N Analyzer"]).trim(),client:h["Client Name"]||'',loc:h["Location"]||'',
    start:ymd(h["Start Date"]),end:ymd(h["End Date"]),status:String(h["Status"]||'').trim()==='Completed'?'Completed':'In Progress',result:normResult(h["Result"]),remark:h["Remark"]||'',mode:h["Mode"]||''}));
}
let UI={pw:'',busy:false,syncing:false,err:null,view:'dash',stF:'all',typeF:'all',modeF:'all',clientF:'all',q:'',sort:['use',-1],trTab:'open',resF:'all',open:null,form:null,admin:false,lang:'th',synced:''};
const M=sn=>S.machines.find(m=>m.sn===sn)||(S.hist.some(h=>h.sn===sn)?{sn,edge:'',model:'',mode:'',type:'',status:'Stock',client:'',loc:'',deliv:'',missing:true}:null);
const openTrial=sn=>S.hist.find(h=>h.sn===sn&&h.status==='In Progress');
const noClient=m=>{const th=L===T.th;return m.status==='Broken'?(th?'อยู่ระหว่างซ่อม':'in repair'):m.status==='Stock'?(th?'อยู่ในคลัง':'in stock'):(th?'ยังไม่ระบุลูกค้า':'no client')};
const useDays=m=>Number.isFinite(m.period)&&m.period>0?m.period:(m.deliv?days(m.deliv):0);

/* ---------- views ---------- */
function vMachines(){
  const ms=S.machines, by=(f)=>ms.filter(f).length;
  const lab=m=>m.type==='Lab', rt=m=>m.type==='Real-time';
  const st=(k)=>ms.filter(m=>m.status===k);
  const lr=a=>`Lab ${a.filter(lab).length} · RT ${a.filter(rt).length}`;
  const stat=(key,label,val,sub,c)=>`<button class="stat ${UI.statKey===key?'on':''}" style="--c:var(${c})" data-stat="${key}"><small>${label}</small><b class="num">${val}</b><em>${sub}</em></button>`;
  let h=`<div class="fixed"><div class="stats">
    ${stat('all',L===T.th?'เครื่องทั้งหมด':'All machines',ms.length,`Lab ${by(lab)} · Real-time ${by(rt)}`,'--brand')}
    ${stat('Stock',L.st.Stock,st('Stock').length,lr(st('Stock')),'--stock')}
    ${stat('Test',L.st.Test,st('Test').length,lr(st('Test')),'--test')}
    ${stat('Complete',L.st.Complete,st('Complete').length,lr(st('Complete')),'--sold')}
    ${stat('Broken',L.st.Broken,st('Broken').length,lr(st('Broken')),'--broken')}</div>`;
  const clients=[...new Set(ms.map(m=>m.client).filter(Boolean))].sort();
  h+=`<div class="filters"><div class="frow">
      <label class="search"><svg class="ms" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--mute)"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" placeholder="${L.search}" value="${esc(UI.q)}" aria-label="ค้นหา"></label>
      <select class="sel" id="fClient" aria-label="ลูกค้า"><option value="all">${L.allClients}</option>${clients.map(c=>`<option ${UI.clientF===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
      <select class="sel" id="fMode" aria-label="โหมด"><option value="all">${L.allModes}</option>${['Milled rice','Paddy'].map(x=>`<option ${UI.modeF===x?'selected':''}>${x}</option>`).join('')}</select>
      <div class="seg" role="group">${[['all',L.allTypes],['Lab','Lab'],['Real-time','Real-time']].map(([k,t])=>`<button class="${UI.typeF===k?'on':''}" data-type="${k}">${t}</button>`).join('')}</div>
    </div><div class="frow"><div class="chips">${['all','Stock','Test','Complete','Broken'].map(k=>`<button class="chip ${UI.stF===k?'on':''}" data-st="${k}" style="--c:var(${k==='all'?'--brand':ST_C[k][0]})">${k==='all'?'':'<i></i>'}${L.st[k]} <b class="num">${k==='all'?ms.length:st(k).length}</b></button>`).join('')}</div>
      ${(UI.q||UI.stF!=='all'||UI.typeF!=='all'||UI.modeF!=='all'||UI.clientF!=='all')?`<button class="link" data-act="clearF">${L.clear}</button>`:''}</div></div>`;
  const q=UI.q.toLowerCase();
  let list=ms.filter(m=>(UI.stF==='all'||m.status===UI.stF)&&(UI.typeF==='all'||m.type===UI.typeF)&&(UI.modeF==='all'||m.mode===UI.modeF)&&(UI.clientF==='all'||m.client===UI.clientF)&&(!q||[m.sn,m.edge,m.client,m.loc,m.model,m.mode].join(' ').toLowerCase().includes(q)));
  const [sk,sd]=UI.sort, key={sn:m=>m.sn,model:m=>m.model,client:m=>m.client||'~',status:m=>m.status,deliv:m=>m.deliv||'0',use:m=>useDays(m)}[sk];
  list.sort((a,b)=>{const A=key(a),B=key(b);return (A>B?1:A<B?-1:0)*sd});
  h+=`<p class="count">${L===T.th?'แสดง':'Showing'} <b class="num">${list.length}</b> ${L.units} · ${L===T.th?'แตะที่เครื่องเพื่อดูรายละเอียดและประวัติ':'Tap a machine for details & history'}</p></div><div class="scroll" id="sc">`;
  if(!list.length) return h+`<div class="tw" style="display:block"><div class="empty">${L===T.th?'ไม่พบเครื่องที่ตรงกับตัวกรอง':'No machines match'}</div></div></div>`;
  const ar=k=>UI.sort[0]===k?`<span class="ar">${UI.sort[1]>0?'▲':'▼'}</span>`:'';
  const C=L.cols;
  h+=`<div class="tw"><table><thead><tr><th data-sort="sn">${C[0]}${ar('sn')}</th><th data-sort="model">${C[1]}${ar('model')}</th><th data-sort="client">${C[2]}${ar('client')}</th><th>${C[3]}</th><th>${C[4]}</th><th data-sort="status">${C[5]}${ar('status')}</th><th data-sort="deliv">${C[6]}${ar('deliv')}</th><th data-sort="use" class="r">${C[7]}${ar('use')}</th></tr></thead><tbody>
    ${list.map(m=>{const ot=openTrial(m.sn), u=useDays(m);
      return `<tr data-open="${m.sn}"><td><span class="sn">${esc(m.sn)}</span><span class="subt">Edge ${esc(m.edge)}</span></td><td>${esc(m.model)}</td>
      <td>${m.client?`${esc(m.client)}<span class="subt">${esc(m.loc)}</span>`:'<span class="subt">— '+noClient(m)+'</span>'}</td>
      <td><span class="tag">${esc(m.mode)}</span></td><td>${esc(m.type)}</td>
      <td>${stPill(m.status)}${ot?`<span class="subt">${L===T.th?'ทดลองมา':'for'} ${days(ot.start)} ${L.days}</span>`:''}</td>
      <td class="num">${fmtD(m.deliv)}</td><td class="r num ${u>365?'long':''}">${u?u+' '+L.days:'–'}</td></tr>`}).join('')}</tbody></table></div>
    <div class="cards">${list.map(m=>{const ot=openTrial(m.sn);return `<button class="mc" data-open="${m.sn}"><div class="h"><span class="sn">${esc(m.sn)}</span>${stPill(m.status)}</div>
      <div class="who">${m.client?esc(m.client)+' · <span style="color:var(--sub)">'+esc(m.loc)+'</span>':'<span style="color:var(--mute)">'+noClient(m)+'</span>'}</div>
      <div class="meta"><span class="tag">${esc(m.type)}</span><span class="tag">${esc(m.mode)}</span><span>${esc(m.model)}</span>${ot?`<span style="color:var(--test);font-weight:600">· ${L===T.th?'ทดลองมา':'trial'} ${days(ot.start)} ${L.days}</span>`:m.deliv?`<span>· ${L===T.th?'ส่งมอบ':'delivered'} ${fmtD(m.deliv)}</span>`:''}</div></button>`}).join('')}</div></div>`;
  return h;
}

function vTrials(){
  const open=S.hist.filter(h=>h.status==='In Progress').sort((a,b)=>a.start.localeCompare(b.start));
  const done=S.hist.filter(h=>h.status==='Completed');
  let h=`<div class="fixed"><div class="tabs" role="tablist"><button class="${UI.trTab==='open'?'on':''}" data-tr="open">${L===T.th?'กำลังทดลอง':'On trial'}<span class="ct num">${open.length}</span></button><button class="${UI.trTab==='done'?'on':''}" data-tr="done">${L===T.th?'จบแล้ว':'Finished'}<span class="ct num">${done.length}</span></button></div>`;
  const endFixed='</div><div class="scroll" id="sc">';
  if(UI.trTab==='open'){
    if(!open.length) return h+endFixed+`<div class="card empty">${L===T.th?'ไม่มีเครื่องที่กำลังทดลอง':'No machines on trial'}</div></div>`;
    h+=`<p class="count">${L===T.th?'เรียงจากทดลองนานสุด · เกิน 45 วันขึ้นสีส้ม เกิน 90 วันขึ้นสีแดง':'Longest first · amber after 45 days, red after 90'}</p>`+endFixed+`<div class="tgrid">`+open.map(t=>{const m=M(t.sn)||{}, d=days(t.start), c=d>90?'--broken':d>45?'--test':'--brand';
      return `<div class="tcard" data-open="${t.sn}" role="button" tabindex="0"><div class="h"><div><b>${esc(t.client)}</b><div class="meta">${esc(t.loc)}</div></div>${pill(L.st.Test,ST_C.Test)}</div>
        <div class="meta"><span class="sn" style="color:var(--ink)">${esc(t.sn)}</span><span class="tag">${esc(m.type||'')}</span><span class="tag">${esc(t.mode)}</span><span>${esc(m.model||'')}</span></div>
        <div class="dur"><div><small>${L===T.th?'เริ่ม':'Started'} ${fmtD(t.start)}</small></div><div class="bar" style="--c:var(${c})"><i style="width:${Math.min(100,d/120*100)}%"></i></div><b class="num" style="color:var(${c})">${d}<small> ${L.days}</small></b></div>
        ${d>90?`<div class="warn hot">● ${L===T.th?'ทดลองนานมาก ควรสรุปผลกับลูกค้า':'Very long trial — follow up for a decision'}</div>`:d>45?`<div class="warn">● ${L===T.th?'เกิน 45 วัน ควรติดตามผล':'Over 45 days — follow up'}</div>`:''}
        ${t.remark?`<div class="meta">“${esc(t.remark)}”</div>`:''}
        ${UI.admin?`<div class="acts"><button class="btn sm pri" data-act="closeTrial" data-v="${t.sn}">${L===T.th?'ปิดการทดลอง':'End trial'}</button></div>`:''}</div>`}).join('')+'</div></div>';
    return h;
  }
  const cnt=k=>done.filter(x=>x.result===k).length;
  h+=`<div class="filters"><div class="frow"><label class="search"><svg class="ms" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--mute)"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q2" placeholder="${L===T.th?'ค้นหาลูกค้า, S/N, จังหวัด…':'Search client, S/N, province…'}" value="${esc(UI.q2||'')}"></label></div>
    <div class="chips">${['all','Not Bought','Pending','Bought'].map(k=>`<button class="chip ${UI.resF===k?'on':''}" data-res="${k}" style="--c:var(${k==='all'?'--brand':RS_C[k][0]})">${k==='all'?'':'<i></i>'}${k==='all'?L.st.all:L.res[k]} <b class="num">${k==='all'?done.length:cnt(k)}</b></button>`).join('')}</div></div>`+endFixed;
  const q=(UI.q2||'').toLowerCase();
  let list=done.filter(x=>(UI.resF==='all'||x.result===UI.resF)&&(!q||[x.client,x.sn,x.loc].join(' ').toLowerCase().includes(q)));
  list.sort((a,b)=>((a.result==='Not Bought'?0:1)-(b.result==='Not Bought'?0:1))||(days(b.start,b.end)-days(a.start,a.end)));
  if(!list.length) return h+`<div class="card empty">${L===T.th?'ไม่พบรายการ':'Nothing found'}</div></div>`;
  const C=L===T.th?['ลูกค้า / จังหวัด','S/N Analyzer','Model','Mode','ช่วงทดลอง','รวม','ผล']:['Client / Province','S/N Analyzer','Model','Mode','Trial period','Total','Result'];
  h+=`<div class="tw"><table><thead><tr>${C.map((c,i)=>`<th class="${i===5?'r':''}">${c}</th>`).join('')}</tr></thead><tbody>${list.map(x=>{const m=M(x.sn)||{};return `<tr data-open="${x.sn}"><td><b>${esc(x.client)}</b><span class="subt">${esc(x.loc)}</span></td><td class="sn">${esc(x.sn)}</td><td>${esc(m.model||'–')}</td><td><span class="tag">${esc(x.mode)}</span></td><td class="num">${fmtD(x.start)} – ${fmtD(x.end)}</td><td class="r num">${days(x.start,x.end)} ${L.days}</td><td>${rsPill(x.result)}${x.remark?`<span class="subt" style="max-width:220px;white-space:normal">${esc(x.remark)}</span>`:''}</td></tr>`}).join('')}</tbody></table></div>
    <div class="cards">${list.map(x=>`<button class="mc" data-open="${x.sn}"><div class="h"><b>${esc(x.client)}</b>${rsPill(x.result)}</div><div class="meta"><span class="sn" style="color:var(--ink)">${esc(x.sn)}</span><span class="tag">${esc(x.mode)}</span><span>${esc(x.loc)}</span></div><div class="meta">${fmtD(x.start)} – ${fmtD(x.end)} · <b class="num" style="color:var(--ink)">${days(x.start,x.end)} ${L.days}</b></div>${x.remark?`<div class="meta">“${esc(x.remark)}”</div>`:''}</button>`).join('')}</div></div>`;
  return h;
}

function vDash(){
  const ms=S.machines, sold=ms.filter(m=>m.status==='Complete').length;
  const done=S.hist.filter(h=>h.status==='Completed'), open=S.hist.filter(h=>h.status==='In Progress');
  const nb=done.filter(h=>h.result==='Not Bought'), pd=done.filter(h=>h.result==='Pending');
  const total=sold+nb.length+pd.length, pct=n=>total?Math.round(n/total*100):0;
  const kpi=(l,v,s,c)=>`<div class="kpi"><small><i style="--c:var(${c})"></i>${l}</small><b class="num">${v}</b><em>${s}</em></div>`;
  let h=`<div class="scroll whole" id="sc"><div class="dgrid">${kpi(L.st.Complete,sold,`${pct(sold)}% ${L===T.th?'ของเครื่องที่ทดลองจบแล้ว':'of finished trials'}`,'--sold')}${kpi(L.res['Not Bought'],nb.length,`${pct(nb.length)}%`,'--broken')}${kpi(L.res.Pending,pd.length,`${pct(pd.length)}% · ${L===T.th?'ต้องติดตาม':'follow up'}`,'--pend')}${kpi(L.st.Test,open.length,L===T.th?'ยังไม่จบการทดลอง':'not finished yet','--test')}</div>`;
  // donut
  const segs=[[sold,'--sold',L.st.Complete],[nb.length,'--broken',L.res['Not Bought']],[pd.length,'--pend',L.res.Pending]];
  const Cc=2*Math.PI*40; let acc=0;
  const arcs=total?segs.map(([v,c])=>{if(!v)return '';const len=v/total*Cc, gap=Math.min(2,len*.2);const a=`<circle r="40" cx="50" cy="50" fill="none" stroke="var(${c})" stroke-width="16" stroke-dasharray="${(len-gap).toFixed(2)} ${(Cc-len+gap).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}"/>`;acc+=len;return a}).join(''):'';
  const conv=total?Math.round(sold/total*100):0;
  h+=`<div class="d2"><div class="card"><h3>${L===T.th?'ผลการทดลองทั้งหมด':'Trial outcomes'}<small>${total} ${L.units} · ${L===T.th?'ขายแล้วนับจากสถานะเครื่องจริง':'sold = actual machine status'}</small></h3>
    <div class="donutw"><svg viewBox="0 0 100 100" width="170" height="170" role="img" aria-label="สัดส่วนผลการทดลอง"><g transform="rotate(-90 50 50)"><circle r="40" cx="50" cy="50" fill="none" stroke="var(--line2)" stroke-width="16"/>${arcs}</g><text x="50" y="50" text-anchor="middle" style="font:700 17px 'Chakra Petch';fill:var(--ink)">${conv}%</text><text x="50" y="62" text-anchor="middle" style="font:500 7px 'Chakra Petch';fill:var(--sub)">${L===T.th?'ทดลองแล้วซื้อ':'converted'}</text></svg>
    <div class="lg">${segs.map(([v,c,l])=>`<span><i style="--c:var(${c})"></i>${l}<b class="num">${v} (${pct(v)}%)</b></span>`).join('')}</div></div></div>`;
  // fleet
  const rows=[['Lab',m=>m.type==='Lab'],['Real-time',m=>m.type==='Real-time']];
  h+=`<div class="card"><h3>${L===T.th?'สถานะเครื่องตามประเภท':'Fleet by type'}<small>${ms.length} ${L.units}</small></h3><div class="hbar">${rows.map(([n,f])=>{const a=ms.filter(f);return `<div class="row"><span>${n}</span><div class="track">${['Complete','Test','Stock','Broken'].map(k=>{const v=a.filter(m=>m.status===k).length;return v?`<i style="width:${v/a.length*100}%;background:var(${ST_C[k][0]})" title="${L.st[k]} ${v}"></i>`:''}).join('')}</div><b class="num r">${a.length}</b></div>`}).join('')}
    <div class="lg" style="flex-direction:row;flex-wrap:wrap;gap:14px;font-size:13px">${['Complete','Test','Stock','Broken'].map(k=>`<span><i style="--c:var(${ST_C[k][0]})"></i>${L.st[k]} <b class="num" style="margin:0;padding:0">${ms.filter(m=>m.status===k).length}</b></span>`).join('')}</div></div></div></div>`;
  // follow up
  const it=(sn,t,s,r)=>`<div class="it" data-open="${sn}"><div class="bd"><b>${esc(t)}</b><small>${s}</small></div>${r}</div>`;
  h+=`<div class="d2"><div class="card"><h3>${L===T.th?'รอพิจารณา — ต้องติดตาม':'Pending — follow up'}<small>${pd.length}</small></h3><div class="list">${pd.sort((a,b)=>a.end.localeCompare(b.end)).map(x=>it(x.sn,x.client,`${esc(x.sn)} · ${L===T.th?'จบทดลอง':'ended'} ${fmtD(x.end)}${x.remark?' · '+esc(x.remark):''}`,`<span class="big num" style="color:var(--pend)">${days(x.end)}<small style="font-size:12px;font-weight:400"> ${L.days}</small></span>`)).join('')||`<div class="empty">—</div>`}</div></div>
    <div class="card"><h3>${L===T.th?'กำลังทดลองนานที่สุด':'Longest running trials'}<small>${open.length}</small></h3><div class="list">${open.sort((a,b)=>a.start.localeCompare(b.start)).slice(0,5).map(x=>{const d=days(x.start);return it(x.sn,x.client,`${esc(x.sn)} · ${esc(x.mode)} · ${L===T.th?'เริ่ม':'since'} ${fmtD(x.start)}`,`<span class="big num" style="color:var(${d>90?'--broken':d>45?'--test':'--brand'})">${d}<small style="font-size:12px;font-weight:400"> ${L.days}</small></span>`)}).join('')||`<div class="empty">—</div>`}</div></div></div></div>`;
  return h;
}

/* ---------- drawer ---------- */
function drawer(){
  const m=M(UI.open); if(!m){closeDrawer();return}
  const hs=S.hist.filter(h=>h.sn===m.sn).sort((a,b)=>b.start.localeCompare(a.start)), ot=openTrial(m.sn), th=L===T.th;
  let body='';
  if(m.missing) body+=`<div class="note warnb">⚠ ${th?'ไม่พบเครื่องนี้ในชีต Panolyzer Data (มีแค่ในประวัติ)':'Machine not found in Panolyzer Data'}</div>`;
  if(UI.admin && !UI.form && !m.missing){
    body+=`<div class="qa">${ot?`<button class="btn pri" data-act="closeTrial" data-v="${m.sn}">${th?'ปิดการทดลอง':'End trial'}</button>`:`<button class="btn pri" data-act="startTrial" data-v="${m.sn}">${th?'เริ่มทดลองกับลูกค้า':'Start a trial'}</button>`}
      <button class="btn" data-act="editMachine">${th?'แก้ไขข้อมูลเครื่อง':'Edit machine'}</button>
      ${m.status==='Broken'?`<button class="btn" data-act="quickStatus" data-v="Stock">${th?'ซ่อมเสร็จ · กลับเข้าคลัง':'Repaired · back to stock'}</button>`:m.status!=='Complete'?`<button class="btn danger" data-act="quickStatus" data-v="Broken">${th?'ส่งซ่อม':'Send to repair'}</button>`:''}
      <button class="btn" data-act="addHist">${th?'เพิ่มประวัติเอง':'Add history'}</button></div>`;
  }
  if(UI.form) body+=formHtml(m,hs,ot);
  if(!UI.admin) body+=`<div class="lock"><svg class="ms" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>${th?'ดูอย่างเดียว · แก้ไขได้เมื่อเข้าสู่ระบบ Admin':'View only · log in as Admin to edit'}<button class="btn sm" data-act="admin">${th?'เข้าสู่ระบบ':'Log in'}</button></div>`;
  body+=`<div class="card"><h3>${th?'ข้อมูลเครื่อง':'Machine info'}</h3><dl class="kv">
    <div><dt>${th?'ลูกค้าปัจจุบัน':'Current client'}</dt><dd>${esc(m.client)||'–'}</dd></div><div><dt>${th?'สถานที่':'Location'}</dt><dd>${esc(m.loc)||'–'}</dd></div>
    <div><dt>Model</dt><dd>${esc(m.model)}</dd></div><div><dt>Mode</dt><dd>${esc(m.mode)}</dd></div>
    <div><dt>${th?'ประเภท':'Type'}</dt><dd>${esc(m.type)}</dd></div><div><dt>S/N Edge server</dt><dd>${esc(m.edge)}</dd></div>
    <div><dt>${th?'วันส่งมอบ':'Delivered'}</dt><dd>${fmtD(m.deliv)}</dd></div><div><dt>${th?'ใช้งานมา':'In use'}</dt><dd>${m.deliv?useDays(m)+' '+L.days:'–'}</dd></div></dl></div>`;
  body+=`<div class="card"><h3>${th?'ประวัติการทดลอง':'Trial history'}<small>${hs.length} ${th?'ครั้ง':'records'}</small></h3>${hs.length?`<ul class="tl">${hs.map(x=>{const open=x.status==='In Progress', c=open?'--test':RS_C[x.result][0];
    return `<li style="--c:var(${c})"><div class="tc"><div class="th"><b>${esc(x.client)}</b>${open?pill(L.st.Test,ST_C.Test):rsPill(x.result)}${UI.admin?`<span class="acts"><button class="btn sm ghost" data-act="editHist" data-v="${esc(x.id)}" aria-label="แก้ไข">${th?'แก้ไข':'Edit'}</button><button class="btn sm ghost" style="color:var(--broken)" data-act="delHist" data-v="${esc(x.id)}" aria-label="ลบ">${th?'ลบ':'Delete'}</button></span>`:''}</div>
      <div class="per">${esc(x.loc)} · ${esc(x.mode)} · ${fmtD(x.start)} – ${open?(th?'ปัจจุบัน':'now'):fmtD(x.end)} · <b class="num">${days(x.start,open?'':x.end)} ${L.days}</b></div>${x.remark?`<div class="rm">${esc(x.remark)}</div>`:''}</div></li>`}).join('')}</ul>`:`<div class="empty" style="padding:16px">${th?'ยังไม่เคยทดลอง':'No trials yet'}</div>`}</div>`;
  $('#drawer').innerHTML=`<div class="dh"><div class="t"><h2 class="num">${esc(m.sn)}</h2><div>${stPill(m.status)}<span class="tag">${esc(m.type)}</span><span class="tag">${esc(m.mode)}</span><span class="tag">${esc(m.model)}</span></div></div><button class="iconbtn" data-act="close" aria-label="ปิด">✕</button></div><div class="db">${body}</div>`;
}
const optsKeep=(list,cur)=>{const c=String(cur||'').trim();return (c&&!list.includes(c)?`<option value="${esc(c)}" selected>${esc(c)} (${L===T.th?'ค่าเดิมในชีต':'current'})</option>`:'')+list.map(v=>`<option ${c===v?'selected':''}>${v}</option>`).join('')};
// ปิดทดลองแบบ "ซื้อ": วันส่งมอบ = วันสิ้นสุดการทดลอง + นัด PM1-3 (+4/+8/+12 เดือน แบบเดียวกับ backend) ถ้ายังไม่เคยเข้า PM
const addMonths=(s,n)=>{const d=D(s);d.setMonth(d.getMonth()+n);return ymdOf(d)};
function buyNote(m,end){const th=L===T.th;if(!end)return th?'ใส่วันสิ้นสุดการทดลองเพื่อใช้เป็นวันส่งมอบ':'Set the end date — it becomes the delivery date';
  if(m.pmDone)return th?`วันส่งมอบจะเปลี่ยนเป็น <b>${fmtD(end)}</b> · นัด PM เดิมไม่เปลี่ยน (เครื่องนี้เคยเข้า PM แล้ว)`:`Delivery date becomes ${fmtD(end)} · existing PM schedule kept`;
  return th?`วันส่งมอบจะเป็น <b>${fmtD(end)}</b> (วันสิ้นสุดการทดลอง) · นัด PM1 <b>${fmtD(addMonths(end,4))}</b> · PM2 ${fmtD(addMonths(end,8))} · PM3 ${fmtD(addMonths(end,12))}`
    :`Delivery date ${fmtD(end)} · PM1 ${fmtD(addMonths(end,4))} · PM2 ${fmtD(addMonths(end,8))} · PM3 ${fmtD(addMonths(end,12))}`}
function formHtml(m,hs,ot){
  const f=UI.form, th=L===T.th, today=TODAY;
  const sync=`<div class="hint">${th?'ระบบอัปเดตสถานะเครื่องให้อัตโนมัติ: กำลังทดลอง → "กำลังทดลอง" · ซื้อ → "ขายแล้ว" + วันส่งมอบ = วันสิ้นสุดทดลอง · ไม่ซื้อ/รอพิจารณา → "ในคลัง" (ล้างชื่อลูกค้า) · แก้ประวัติเก่าย้อนหลังจะไม่เปลี่ยนสถานะเครื่อง':'Machine status updates automatically from the latest trial record.'}</div>`;
  const acts=(save)=>`<div class="fa"><button class="btn" data-act="cancelForm">${th?'ยกเลิก':'Cancel'}</button><button class="btn pri" data-act="${save}">${th?'บันทึก':'Save'}</button></div>`;
  const resR=(cur)=>`<div class="radios">${['Bought','Not Bought','Pending'].map(k=>`<label style="--c:var(${RS_C[k][0]});--b:var(${RS_C[k][1]})"><input type="radio" name="ff-res" value="${k}" ${cur===k?'checked':''}>${L.res[k]}</label>`).join('')}</div>`;
  if(f.kind==='start') return `<div class="form"><h4>${th?'เริ่มทดลองกับลูกค้า':'Start a trial'}</h4>
    ${ot?`<div class="note warnb">⚠ ${th?`เครื่องนี้ยังทดลองค้างอยู่ที่ <b>${esc(ot.client)}</b> (เริ่ม ${fmtD(ot.start)}) — เมื่อบันทึก ระบบจะปิดรายการเดิมเป็น "จบแล้ว / ไม่ซื้อ" ให้อัตโนมัติ`:`Still on trial at ${esc(ot.client)} — saving will close it as Not bought`}</div>`:''}
    <div class="fg"><div class="f full"><label>${th?'ชื่อลูกค้า / โรงสี *':'Client *'}</label><input id="ff-client" list="clist" value="${esc(f.client||'')}"><datalist id="clist">${[...new Set(S.hist.map(h=>h.client))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div>
    <div class="f"><label>${th?'สถานที่ / จังหวัด':'Location'}</label><input id="ff-loc" value="${esc(f.loc||'')}"></div>
    <div class="f"><label>${th?'โหมดที่ทดลอง':'Mode'}</label><select id="ff-mode">${['Milled rice','Paddy'].map(x=>`<option ${(f.mode||m.mode)===x?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="f"><label>${th?'วันเริ่มทดลอง':'Start date'}</label><input type="date" id="ff-start" value="${f.start||today}"></div>
    <div class="f full"><label>${th?'หมายเหตุ':'Remark'}</label><input id="ff-rm" value="${esc(f.remark||'')}" placeholder="${th?'ไม่บังคับ':'optional'}"></div></div>${sync}${acts('saveStart')}</div>`;
  if(f.kind==='close') return `<div class="form"><h4>${th?'ปิดการทดลอง':'End trial'} · ${esc(ot.client)}</h4><div class="note info">${th?`ทดลองมาแล้ว ${days(ot.start)} วัน (เริ่ม ${fmtD(ot.start)})`:`Running ${days(ot.start)} days`}</div>
    <div class="f"><label>${th?'ผลการทดลอง *':'Result *'}</label>${resR(f.result)}</div>
    <div class="note info" id="ff-buy" ${f.result==='Bought'?'':'hidden'}>📦 <span>${buyNote(m,f.end||TODAY)}</span></div>
    <div class="fg"><div class="f"><label>${th?'วันสิ้นสุดทดลอง':'End date'}</label><input type="date" id="ff-end" value="${f.end||today}"></div>
    <div class="f"><label>${th?'หมายเหตุ / เหตุผล':'Remark'}</label><input id="ff-rm" value="${esc(f.remark||ot.remark||'')}" placeholder="${th?'เช่น งบไม่พอ, รอใบเสนอราคา':'e.g. budget'}"></div></div>${sync}${acts('saveClose')}</div>`;
  if(f.kind==='hist'){ const x=f.id?S.hist.find(h=>h.id===f.id):{}; return `<div class="form"><h4>${f.id?(th?'แก้ไขประวัติ':'Edit history'):(th?'เพิ่มประวัติเอง':'Add history')}</h4>
    <div class="fg"><div class="f full"><label>${th?'ชื่อลูกค้า *':'Client *'}</label><input id="ff-client" value="${esc(x.client||'')}"></div>
    <div class="f"><label>${th?'สถานที่':'Location'}</label><input id="ff-loc" value="${esc(x.loc||'')}"></div><div class="f"><label>Mode</label><select id="ff-mode">${['Milled rice','Paddy'].map(v=>`<option ${(x.mode||m.mode)===v?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="f"><label>${th?'วันเริ่ม':'Start'}</label><input type="date" id="ff-start" value="${x.start||TODAY}"></div><div class="f"><label>${th?'วันสิ้นสุด':'End'}</label><input type="date" id="ff-end" value="${x.end||''}"></div>
    <div class="f"><label>${th?'สถานะการทดลอง':'Trial status'}</label><select id="ff-status"><option value="In Progress" ${x.status==='In Progress'?'selected':''}>${L.st.Test}</option><option value="Completed" ${x.status==='Completed'?'selected':''}>${th?'จบแล้ว':'Finished'}</option></select></div>
    <div class="f"><label>${th?'ผล':'Result'}</label><select id="ff-result">${['Pending','Bought','Not Bought'].map(k=>`<option value="${k}" ${(x.result||'Pending')===k?'selected':''}>${L.res[k]}</option>`).join('')}</select></div>
    <div class="f full"><label>${th?'หมายเหตุ':'Remark'}</label><input id="ff-rm" value="${esc(x.remark||'')}"></div></div>${sync}${acts('saveHist')}</div>`;}
  if(f.kind==='machine') return `<div class="form"><h4>${th?'แก้ไขข้อมูลเครื่อง':'Edit machine'}</h4>
    <div class="fg"><div class="f"><label>${th?'ลูกค้าปัจจุบัน':'Client'}</label><input id="mf-client" value="${esc(m.client)}"></div><div class="f"><label>${th?'สถานที่':'Location'}</label><input id="mf-loc" value="${esc(m.loc)}"></div>
    <div class="f"><label>${th?'สถานะ':'Status'}</label><select id="mf-status">${['Stock','Test','Complete','Broken'].map(k=>`<option value="${k}" ${m.status===k?'selected':''}>${L.st[k]}</option>`).join('')}</select></div>
    <div class="f"><label>Model</label><select id="mf-model">${optsKeep(['Gen 1','Gen 2'],m.model)}</select></div>
    <div class="f"><label>Mode</label><select id="mf-mode">${optsKeep(['Milled rice','Paddy'],m.mode)}</select></div>
    <div class="f"><label>${th?'ประเภท':'Type'}</label><select id="mf-type">${optsKeep(['Lab','Real-time'],m.type)}</select></div>
    <div class="f"><label>S/N Edge server</label><input id="mf-edge" value="${esc(m.edge)}"></div><div class="f"><label>${th?'วันส่งมอบ':'Delivered'}</label><input type="date" id="mf-deliv" value="${m.deliv}"><span class="hint">${th?'ใส่วันส่งมอบครั้งแรก ระบบคำนวณนัด PM 1–3 ให้':'PM 1–3 dates are scheduled from this'}</span></div></div>
    <div class="hint">S/N Analyzer ${th?'แก้ไม่ได้ (ใช้ระบุเครื่อง)':'cannot be changed'}</div>${acts('saveMachine')}</div>`;
  return '';
}

/* ---------- render ---------- */
const TITLE=()=>({machines:L['nav.machines'],trials:L['nav.trials'],dash:'Dashboard'})[UI.view];
function render(keep){
  const sc0=$('#sc'), y=sc0?sc0.scrollTop:0;
  $('#page').innerHTML=UI.view==='machines'?vMachines():UI.view==='trials'?vTrials():vDash();
  $('#ttl').textContent=$('#ttlM').textContent=TITLE();
  $$('[data-go]').forEach(b=>b.classList.toggle('on',b.dataset.go===UI.view));
  $$('[data-t]').forEach(e=>e.textContent=L[e.dataset.t]);
  $('#ctM').textContent=S.machines.length; $('#ctT').textContent=S.hist.filter(h=>h.status==='In Progress').length||'';
  $('#adminR').innerHTML=UI.admin?`🔓 ${L.adminOut}`:`🔒 ${L.admin}`; $('#adminR').classList.toggle('on',UI.admin);
  $('#adminM').textContent=UI.admin?'🔓':'🔒'; $('#adminM').classList.toggle('on',UI.admin);
  $('#langM').textContent=UI.lang==='th'?'EN':'TH';
  $$('[data-lang]').forEach(b=>b.classList.toggle('on',b.dataset.lang===UI.lang));
  renderSync();
  const ab=$('#adminbar'); ab.hidden=!UI.admin; ab.innerHTML=UI.admin?`<b>${L===T.th?'โหมด Admin':'Admin mode'}</b> · ${L===T.th?'แก้ไข เพิ่ม ลบข้อมูลได้':'you can edit data'} <button data-act="admin">${L.adminOut}</button>`:'';
  if(UI.open) drawer();
  const sc1=$('#sc'); if(keep&&sc1) sc1.scrollTop=y;
}
function openDrawer(sn){UI.open=sn;UI.form=null;drawer();$('#drawer').classList.add('on');$('#scrim').classList.add('on')}
function closeDrawer(){UI.open=null;UI.form=null;$('#drawer').classList.remove('on');$('#scrim').classList.remove('on')}
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('on'),2200)}
function modal(html){$('#mbox').innerHTML=html;$('#modal').classList.add('on');const i=$('#mbox input');if(i)i.focus()}
function closeModal(){$('#modal').classList.remove('on')}
const val=id=>{const e=document.getElementById(id);return e?e.value.trim():''};

/* ---------- events ---------- */
document.addEventListener('click',e=>{
  const go=e.target.closest('[data-go]'); if(go){UI.view=go.dataset.go;closeDrawer();render();return}
  const st=e.target.closest('[data-stat]'); if(st){const k=st.dataset.stat;UI.stF=k;UI.statKey=k;render(true);return}
  const c=e.target.closest('[data-st]'); if(c){UI.stF=c.dataset.st;UI.statKey=null;render(true);return}
  const ty=e.target.closest('[data-type]'); if(ty){UI.typeF=ty.dataset.type;render(true);return}
  const so=e.target.closest('th[data-sort]'); if(so){const k=so.dataset.sort;UI.sort=[k,UI.sort[0]===k?-UI.sort[1]:(k==='use'||k==='deliv'?-1:1)];render(true);return}
  const tr=e.target.closest('[data-tr]'); if(tr){UI.trTab=tr.dataset.tr;render();return}
  const rs=e.target.closest('[data-res]'); if(rs){UI.resF=rs.dataset.res;render(true);return}
  const lg=e.target.closest('[data-lang]'); if(lg){setLang(lg.dataset.lang);return}
  const tm=e.target.closest('[data-theme-set]'); if(tm){const v=tm.dataset.themeSet;if(v==='auto')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',v);try{localStorage.setItem(THEME_KEY,v)}catch(e){}return}
  const a=e.target.closest('[data-act]');
  if(a){act(a.dataset.act,a.dataset.v,e);return}
  const o=e.target.closest('[data-open]'); if(o){openDrawer(o.dataset.open);return}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#modal').classList.contains('on'))closeModal();else closeDrawer()}
  if(e.key==='Enter'&&e.target.closest('.tcard')&&!e.target.closest('button'))openDrawer(e.target.closest('.tcard').dataset.open)});
document.addEventListener('input',e=>{const t=e.target;
  if(t.id==='q'){UI.q=t.value;clearTimeout(UI.qt);UI.qt=setTimeout(()=>{render(true);const q=$('#q');q.focus();q.setSelectionRange(q.value.length,q.value.length)},180)}
  if(t.id==='q2'){UI.q2=t.value;clearTimeout(UI.qt);UI.qt=setTimeout(()=>{render(true);const q=$('#q2');q.focus();q.setSelectionRange(q.value.length,q.value.length)},180)}});
document.addEventListener('change',e=>{const t=e.target;
  if(t.id==='fClient'){UI.clientF=t.value;render(true)} if(t.id==='fMode'){UI.modeF=t.value;render(true)}
  if(t.name==='ff-res'&&UI.form){UI.form.result=t.value;updBuy()}
  if(t.id==='ff-end'&&UI.form&&UI.form.kind==='close'){UI.form.end=t.value;updBuy()}});
function updBuy(){const el=$('#ff-buy');if(!el)return;el.hidden=UI.form.result!=='Bought';el.querySelector('span').innerHTML=buyNote(M(UI.open),val('ff-end'))}
function setLang(l){UI.lang=l;L=T[l];try{localStorage.setItem(LANG_KEY,l)}catch(e){}render(true);toast(l==='th'?'เปลี่ยนเป็นภาษาไทย':'Switched to English')}
function act(a,v){
  const th=L===T.th;
  if(a==='close'){closeDrawer();return}
  if(a==='lang'){setLang(UI.lang==='th'?'en':'th');return}
  if(a==='clearF'){Object.assign(UI,{q:'',stF:'all',typeF:'all',modeF:'all',clientF:'all',statKey:null});render(true);return}
  if(a==='refresh'){if(!UI.syncing)load().then(ok=>toast(ok?(th?'ข้อมูลล่าสุดแล้ว':'Data updated'):(th?'เชื่อมต่อไม่ได้':'Connection failed')));return}
  if(a==='admin'){ if(UI.admin){UI.admin=false;UI.pw='';UI.form=null;render(true);toast(th?'ออกจากโหมด Admin แล้ว':'Left Admin mode');return}
    modal(`<h3>${th?'เข้าสู่ระบบ Admin':'Admin login'}</h3><p>${th?'ใส่รหัสผ่านเพื่อเพิ่ม แก้ไข หรือลบข้อมูล':'Enter the password to add, edit or delete data'}</p><div class="f"><label for="pw">${th?'รหัสผ่าน':'Password'}</label><input type="password" id="pw" autocomplete="current-password"></div><div class="hint" id="pwErr" style="color:var(--broken)"></div><div class="fa"><button class="btn" data-act="mclose">${th?'ยกเลิก':'Cancel'}</button><button class="btn pri" data-act="login" id="loginBtn">${th?'เข้าสู่ระบบ':'Log in'}</button></div>`);return}
  if(a==='mclose'){closeModal();return}
  if(a==='login'){login();return}
  if(a==='retry'){boot(true);return}
  const m=UI.open&&M(UI.open);
  if(a==='startTrial'){if(UI.open!==v)openDrawer(v);UI.form={kind:'start'};drawer();$('#drawer .db').scrollTop=0;return}
  if(a==='closeTrial'){if(UI.open!==v)openDrawer(v);UI.form={kind:'close',result:''};drawer();$('#drawer .db').scrollTop=0;return}
  if(a==='editMachine'){UI.form={kind:'machine'};drawer();$('#drawer .db').scrollTop=0;return}
  if(a==='addHist'){UI.form={kind:'hist'};drawer();$('#drawer .db').scrollTop=0;return}
  if(a==='editHist'){UI.form={kind:'hist',id:v};drawer();$('#drawer .db').scrollTop=0;return}
  if(a==='cancelForm'){UI.form=null;drawer();return}
  if(a==='delHist'){const x=S.hist.find(h=>h.id===v);if(!x)return;modal(`<h3>${th?'ลบประวัตินี้?':'Delete this record?'}</h3><p>${esc(x.client)} · ${fmtD(x.start)} – ${x.end?fmtD(x.end):'…'}<br>${th?'ลบแล้วกู้คืนไม่ได้':'This cannot be undone'}${x.status==='In Progress'?`<br><b style="color:var(--test)">${th?'รายการนี้กำลังทดลองอยู่ — สถานะเครื่องจะปรับตามประวัติที่เหลือ':'This trial is active — machine status will follow the remaining history'}</b>`:''}</p><div class="fa"><button class="btn" data-act="mclose">${th?'ยกเลิก':'Cancel'}</button><button class="btn danger" data-act="delOk" data-v="${esc(x.id)}">${th?'ลบ':'Delete'}</button></div>`);return}
  if(a==='delOk'){closeModal();save('delete',{ID:v},th?'ลบประวัติแล้ว':'Deleted');return}
  if(a==='quickStatus'){const d={"S/N Analyzer":m.sn,"Status":v};if(v==='Stock'){d["Client name"]='';d["Location"]=''}
    save('edit_machine',d,v==='Broken'?(th?'เปลี่ยนสถานะเป็น "ส่งซ่อม" แล้ว':'Marked as in repair'):(th?'กลับเข้าคลังแล้ว':'Back in stock'));return}
  if(a==='saveStart'){const client=val('ff-client');if(!client){toast(th?'กรอกชื่อลูกค้าก่อน':'Client required');return}
    save('add',{"S/N Analyzer":m.sn,"Client Name":client,"Location":val('ff-loc'),"Start Date":val('ff-start')||TODAY,"End Date":'',"Status":'In Progress',"Result":'Pending',"Remark":val('ff-rm'),"Mode":val('ff-mode'),autoCloseOldTrials:!!openTrial(m.sn),syncMachineStatus:true},th?`เริ่มทดลองที่ ${client} แล้ว`:'Trial started');return}
  if(a==='saveClose'){const ot=openTrial(m.sn),r=UI.form.result;if(!r){toast(th?'เลือกผลการทดลองก่อน':'Pick a result');return}
    const end=val('ff-end')||TODAY;if(end<ot.start){toast(th?'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม':'End date is before start');return}
    save('edit',histPayload({...ot,status:'Completed',result:r,end,remark:val('ff-rm')}),th?`ปิดการทดลองแล้ว · ${L.res[r]}`:`Trial ended · ${L.res[r]}`);return}
  if(a==='saveHist'){const client=val('ff-client');if(!client){toast(th?'กรอกชื่อลูกค้าก่อน':'Client required');return}
    const d={sn:m.sn,client,loc:val('ff-loc'),mode:val('ff-mode'),start:val('ff-start'),end:val('ff-end'),status:val('ff-status'),result:val('ff-result'),remark:val('ff-rm')};
    if(d.end&&d.start&&d.end<d.start){toast(th?'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม':'End date is before start');return}
    if(UI.form.id) save('edit',histPayload({...d,id:UI.form.id}),th?'แก้ไขประวัติแล้ว':'Saved');
    else { const p=histPayload(d); delete p.ID; p.autoCloseOldTrials=d.status==='In Progress'&&!!openTrial(m.sn); save('add',p,th?'เพิ่มประวัติแล้ว':'Added'); }
    return}
  if(a==='saveMachine'){save('edit_machine',{"S/N Analyzer":m.sn,"Client name":val('mf-client'),"Location":val('mf-loc'),"Status":val('mf-status'),"Model":val('mf-model'),"Mode":val('mf-mode'),"Type":val('mf-type'),"S/N Edge server":val('mf-edge'),"Delivery date":val('mf-deliv')},th?'แก้ไขข้อมูลเครื่องแล้ว':'Machine updated');return}
}
const histPayload=x=>({ID:x.id,"S/N Analyzer":x.sn,"Client Name":x.client,"Location":x.loc,"Start Date":x.start,"End Date":x.end||'',"Status":x.status,"Result":x.result,"Remark":x.remark||'',"Mode":x.mode,syncMachineStatus:true});

/* ---------- เชื่อมต่อ Apps Script ---------- */
async function api(action,data,pw){
  const r=await fetch(scriptURL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,data,adminPassword:pw})});
  return r.json();
}
async function login(){const th=L===T.th,pw=val('pw'),btn=$('#loginBtn'),err=$('#pwErr');
  if(!pw){err.textContent=th?'กรุณากรอกรหัสผ่าน':'Enter password';return}
  btn.disabled=true;btn.textContent=th?'กำลังตรวจสอบ…':'Checking…';
  try{const j=await api('verify_admin',null,pw);
    if(j.status!=='success'){err.textContent=j.message||(th?'รหัสผ่านไม่ถูกต้อง':'Wrong password');btn.disabled=false;btn.textContent=th?'เข้าสู่ระบบ':'Log in';return}
    UI.pw=pw;UI.admin=true;closeModal();render(true);toast(th?'เข้าสู่โหมด Admin แล้ว':'Admin mode on');
  }catch(e){err.textContent=th?'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง':'Connection failed';btn.disabled=false;btn.textContent=th?'เข้าสู่ระบบ':'Log in'}}
function setBusy(b){UI.busy=b;$('#drawer').classList.toggle('busy',b);renderSync()}
async function save(action,data,okMsg){const th=L===T.th;if(UI.busy)return;
  setBusy(true);
  try{const j=await api(action,data,UI.pw);
    if(j.status!=='success'){const msg=j.message||(th?'บันทึกไม่สำเร็จ':'Save failed');
      if(/รหัสผ่าน|ล็อก|Admin/.test(msg)){UI.admin=false;UI.pw='';UI.form=null}
      setBusy(false);render(true);modal(`<h3>${th?'บันทึกไม่สำเร็จ':'Save failed'}</h3><p>${esc(msg)}</p><div class="fa"><button class="btn pri" data-act="mclose">${th?'ตกลง':'OK'}</button></div>`);return}
    UI.form=null;setBusy(false);await load();toast(j.message||okMsg);
  }catch(e){setBusy(false);modal(`<h3>${th?'เชื่อมต่อไม่ได้':'Connection failed'}</h3><p>${th?'ยังไม่ได้บันทึก กรุณาลองใหม่อีกครั้ง':'Nothing was saved. Please try again.'}</p><div class="fa"><button class="btn pri" data-act="mclose">${th?'ตกลง':'OK'}</button></div>`)}}
function renderSync(){const th=L===T.th;
  const t=UI.busy?(th?'กำลังบันทึก…':'Saving…'):UI.syncing?(th?'กำลังซิงค์…':'Syncing…'):'';
  const html=t?`<span class="syncpill"><span class="dot"></span>${t}</span>`:UI.err?`<span style="color:var(--broken)">${esc(UI.err)}</span>`:(UI.synced?`${L.updated} ${esc(UI.synced)}`:'');
  $('#sync').innerHTML=html;$('#syncR').innerHTML=html;
  $$('[data-act=refresh] svg').forEach(s=>s.classList.toggle('spin',UI.syncing))}
async function load(){const th=L===T.th;UI.syncing=true;renderSync();
  try{const r=await fetch(scriptURL+'?app=panolyzer&v='+Date.now(),{cache:'no-store',redirect:'follow'});const data=await r.json();
    if(!data||data.status==='error')throw new Error(data&&data.message||'error');
    ingest(data);TODAY=ymdOf(new Date());
    UI.synced=new Date().toLocaleString(th?'th-TH':'en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',hour12:false});UI.err=null;
    try{localStorage.setItem(CACHE_KEY,JSON.stringify({machines:data.machines||[],histories:data.histories||[]}));localStorage.setItem(SYNC_KEY,UI.synced)}catch(e){}
    UI.syncing=false;render(true);return true;
  }catch(e){UI.syncing=false;UI.err=th?'เชื่อมต่อไม่ได้ · แสดงข้อมูลล่าสุดที่เก็บไว้':'Offline · showing saved data';render(true);return false}}

/* ---------- เริ่มแอป: หน้า loading อย่างน้อย ~3.5 วินาที ระหว่างนั้นดึงข้อมูลไปพร้อมกัน ---------- */
function loaderSteps(){const th=L===T.th;return th?['กำลังเชื่อมต่อ…','กำลังโหลดข้อมูลเครื่อง…','กำลังโหลดประวัติการทดลอง…','พร้อมใช้งาน']:['Connecting…','Loading machines…','Loading trial history…','Ready']}
function stepTo(t){const st=$('#ldStep');st.style.opacity=0;setTimeout(()=>{st.textContent=t;st.style.opacity=1},150)}
async function boot(retry){
  const ld=$('#ld'),steps=loaderSteps();ld.classList.remove('out');$('#ldErr').hidden=true;$('#ldStep').textContent=steps[0];
  let i=0;clearInterval(boot.t);boot.t=setInterval(()=>{if(i<2){i++;stepTo(steps[i])}},950);
  const minShow=new Promise(r=>setTimeout(r,retry?1200:2850));
  const [ok]=await Promise.all([load(),minShow]);clearInterval(boot.t);
  if(!ok&&!S.machines.length){stepTo(L===T.th?'เชื่อมต่อไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่':'Cannot connect. Check your connection and retry.');$('#ldErr').hidden=false;return}
  stepTo(steps[3]);setTimeout(()=>ld.classList.add('out'),700);
}
(function init(){
  try{const l=localStorage.getItem(LANG_KEY);if(l==='en'||l==='th'){UI.lang=l;L=T[l]}}catch(e){}
  try{const t=localStorage.getItem(THEME_KEY);if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}
  try{const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');if(c){ingest(c);UI.synced=localStorage.getItem(SYNC_KEY)||''}}catch(e){}
  render();boot(false);
})();
})();
