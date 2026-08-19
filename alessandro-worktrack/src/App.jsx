import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  uid, isoDate, num, money, hoursFmt, dateFmt, monthLabel, jobFor,
  calcActual, calcEstimate, shiftValue, monthMetrics, previousMonth, addMonths, colorForJob, plannedHours, actualHours
} from './utils.js';

const emptyState = {
  version: 1,
  profile: { name: 'Alessandro', currency: 'EUR', weekStartsMonday: true },
  jobs: [], shifts: []
};

const COLORS = ['#7c8cff','#6bd6a5','#ffb86b','#e878a7','#69b9ff','#c08cff','#ff7b73','#c7d66b'];

function App() {
  const [state,setState] = useState(emptyState);
  const [loaded,setLoaded] = useState(false);
  const [auth,setAuth] = useState({checked:false,required:false,authenticated:false});
  const [tab,setTab] = useState('home');
  const [month,setMonth] = useState(() => new Date(new Date().getFullYear(),new Date().getMonth(),1));
  const [jobModal,setJobModal] = useState(null);
  const [shiftModal,setShiftModal] = useState(null);
  const [daySheet,setDaySheet] = useState(null);
  const [toast,setToast] = useState('');
  const [sync,setSync] = useState('idle');
  const saveTimer = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('standalone', Boolean(window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches));
    fetch('/api/session').then(r=>r.json()).then(s=>setAuth({checked:true,required:s.authRequired,authenticated:s.authenticated})).catch(()=>setAuth({checked:true,required:false,authenticated:true}));
  },[]);

  useEffect(() => {
    if (!auth.checked || !auth.authenticated) return;
    (async()=>{
      try {
        const r=await fetch('/api/state');
        if (!r.ok) throw new Error();
        const data=await r.json(); setState(data); localStorage.setItem('worktrack-cache',JSON.stringify(data));
      } catch {
        const cache=localStorage.getItem('worktrack-cache');
        if (cache) { try { setState(JSON.parse(cache)); } catch {} }
        setToast('Modalità offline: userò i dati salvati su iPhone.');
      } finally { setLoaded(true); }
    })();
  },[auth.checked,auth.authenticated]);

  useEffect(()=>{
    if (!loaded || !auth.authenticated) return;
    localStorage.setItem('worktrack-cache',JSON.stringify(state));
    clearTimeout(saveTimer.current);
    setSync('saving');
    saveTimer.current=setTimeout(async()=>{
      try {
        const r=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(state)});
        if (!r.ok) throw new Error(); setSync('saved'); setTimeout(()=>setSync('idle'),1200);
      } catch { setSync('offline'); }
    },700);
    return ()=>clearTimeout(saveTimer.current);
  },[state,loaded,auth.authenticated]);

  const current = useMemo(()=>monthMetrics(state,new Date()),[state]);

  function showToast(msg){ setToast(msg); setTimeout(()=>setToast(''),2600); }
  function upsertJob(job){ setState(s=>({...s,jobs:s.jobs.some(j=>j.id===job.id)?s.jobs.map(j=>j.id===job.id?job:j):[...s.jobs,job]})); setJobModal(null); showToast('Lavoro salvato'); }
  function deleteJob(id){ if(!confirm('Eliminare questo lavoro? I turni resteranno nello storico.'))return; setState(s=>({...s,jobs:s.jobs.filter(j=>j.id!==id)})); setJobModal(null); }
  function upsertShift(shift){ setState(s=>({...s,shifts:s.shifts.some(x=>x.id===shift.id)?s.shifts.map(x=>x.id===shift.id?shift:x):[...s.shifts,shift]})); setShiftModal(null); setDaySheet(null); showToast('Turno salvato'); }
  function deleteShift(id){ if(!confirm('Eliminare questo turno?'))return; setState(s=>({...s,shifts:s.shifts.filter(x=>x.id!==id)})); setShiftModal(null); setDaySheet(null); }

  if (!auth.checked) return <Splash/>;
  if (auth.required && !auth.authenticated) return <Login onSuccess={()=>setAuth(a=>({...a,authenticated:true}))}/>;
  if (!loaded) return <Splash/>;

  return <div className="app-shell">
    <header className="topbar">
      <div>
        <div className="eyebrow">WORKTRACK</div>
        <div className="top-title">Ciao, {state.profile.name || 'Alessandro'}</div>
      </div>
      <div className={`sync-dot ${sync}`} title={sync}/>
    </header>

    <main className="content-scroll scrollable">
      {tab==='home' && <Home state={state} current={current} setTab={setTab} openShift={(date)=>setShiftModal({date:date||isoDate()})} openJob={()=>setJobModal({})}/>} 
      {tab==='calendar' && <Calendar state={state} month={month} setMonth={setMonth} openDay={setDaySheet} openShift={(date)=>setShiftModal({date})}/>} 
      {tab==='jobs' && <Jobs state={state} openJob={setJobModal} openShift={(jobId)=>setShiftModal({jobId,date:isoDate()})}/>} 
      {tab==='insights' && <Insights state={state}/>} 
      {tab==='settings' && <Settings state={state} setState={setState} logout={async()=>{await fetch('/api/logout',{method:'POST'});location.reload();}} authRequired={auth.required} showToast={showToast}/>} 
    </main>

    <button className="fab" onClick={()=>setShiftModal({date:isoDate()})} aria-label="Nuovo turno">+</button>
    <nav className="bottom-nav">
      <NavButton active={tab==='home'} onClick={()=>setTab('home')} icon="⌂" label="Home"/>
      <NavButton active={tab==='calendar'} onClick={()=>setTab('calendar')} icon="▦" label="Calendario"/>
      <NavButton active={tab==='jobs'} onClick={()=>setTab('jobs')} icon="◫" label="Lavori"/>
      <NavButton active={tab==='insights'} onClick={()=>setTab('insights')} icon="↗" label="Analisi"/>
      <NavButton active={tab==='settings'} onClick={()=>setTab('settings')} icon="⚙" label="Altro"/>
    </nav>

    {jobModal!==null && <JobForm initial={jobModal.id?state.jobs.find(j=>j.id===jobModal.id):jobModal} onSave={upsertJob} onDelete={deleteJob} onClose={()=>setJobModal(null)} index={state.jobs.length}/>} 
    {shiftModal!==null && <ShiftForm state={state} initial={shiftModal.id?state.shifts.find(s=>s.id===shiftModal.id):shiftModal} onSave={upsertShift} onDelete={deleteShift} onClose={()=>setShiftModal(null)} onNeedJob={()=>{setShiftModal(null);setJobModal({});}}/>}
    {daySheet && <DaySheet state={state} date={daySheet} onClose={()=>setDaySheet(null)} onEdit={(id)=>{setDaySheet(null);setShiftModal({id});}} onAdd={()=>{setDaySheet(null);setShiftModal({date:daySheet});}}/>}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function Splash(){return <div className="splash"><div className="logo-mark">W</div><div className="splash-title">WorkTrack</div></div>}

function Login({onSuccess}){
  const [pin,setPin]=useState(''); const [err,setErr]=useState('');
  async function submit(e){e.preventDefault();setErr('');const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});if(r.ok)onSuccess();else setErr('PIN non corretto');}
  return <div className="login-screen"><div className="login-card"><div className="logo-mark">W</div><h1>WorkTrack</h1><p>Inserisci il PIN per accedere ai tuoi dati.</p><form onSubmit={submit}><input className="big-pin" type="password" inputMode="numeric" autoFocus value={pin} onChange={e=>setPin(e.target.value)} placeholder="PIN"/><button className="primary wide">Accedi</button>{err&&<div className="form-error">{err}</div>}</form></div></div>
}

function NavButton({active,onClick,icon,label}){return <button className={`nav-btn ${active?'active':''}`} onClick={onClick}><span className="nav-icon">{icon}</span><span>{label}</span></button>}

function Home({state,current,setTab,openShift,openJob}){
  const currency=state.profile.currency;
  const prev=monthMetrics(state,previousMonth(new Date()));
  const pct=prev.earned?((current.earned-prev.earned)/prev.earned)*100:(current.earned?100:0);
  const upcoming=[...state.shifts].filter(s=>s.status==='planned'&&s.date>=isoDate()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
  const recent=[...state.shifts].filter(s=>s.status==='completed').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
  return <div className="page home-page">
    <section className="hero-card">
      <div className="hero-label">Questo mese</div>
      <div className="hero-money">{money(current.earned,currency)}</div>
      <div className="hero-sub">guadagnati · <strong>{money(current.projected,currency)}</strong> previsti a fine mese</div>
      <div className={`delta ${pct>=0?'up':'down'}`}>{pct>=0?'↑':'↓'} {Math.abs(pct).toFixed(0)}% vs mese scorso</div>
    </section>

    <section className="metric-grid">
      <Metric label="Ore lavorate" value={hoursFmt(current.completedHours)} sub={`${current.completedCount} turni chiusi`}/>
      <Metric label="Media oraria" value={money(current.effectiveHourly,currency)} sub="effettiva"/>
      <Metric label="Da incassare" value={money(current.unpaid,currency)} sub="turni completati" tone={current.unpaid>0?'warn':''}/>
      <Metric label="Turni futuri" value={String(current.plannedCount)} sub={`${hoursFmt(current.plannedHours)} stimate`}/>
    </section>

    <section className="quick-row"><button className="quick primary-soft" onClick={()=>openShift()}><b>＋</b><span>Nuovo turno</span></button><button className="quick" onClick={openJob}><b>＋</b><span>Nuovo lavoro</span></button></section>

    <SectionTitle title="Prossimi turni" action="Calendario" onAction={()=>setTab('calendar')}/>
    {upcoming.length? <div className="stack">{upcoming.map(s=><ShiftRow key={s.id} state={state} shift={s}/>)}</div>:<Empty title="Nessun turno programmato" text="Aggiungi i prossimi giorni di lavoro per ottenere una previsione realistica delle entrate." action="Pianifica turno" onAction={()=>openShift()}/>} 

    <SectionTitle title="Ultimi turni chiusi" action="Analisi" onAction={()=>setTab('insights')}/>
    {recent.length?<div className="stack">{recent.map(s=><ShiftRow key={s.id} state={state} shift={s}/>)}</div>:<Empty title="Ancora nessun turno chiuso" text="Quando finisci un turno, inserisci ore e paga reali: le statistiche si aggiorneranno da sole."/>}
  </div>
}

function Metric({label,value,sub,tone=''}){return <div className={`metric ${tone}`}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-sub">{sub}</div></div>}
function SectionTitle({title,action,onAction}){return <div className="section-title"><h2>{title}</h2>{action&&<button onClick={onAction}>{action}</button>}</div>}
function Empty({title,text,action,onAction}){return <div className="empty"><b>{title}</b><p>{text}</p>{action&&<button onClick={onAction}>{action}</button>}</div>}
function ShiftRow({state,shift,onClick}){const j=jobFor(state,shift.jobId);const val=shift.status==='completed'?calcActual(shift,j):calcEstimate(shift,j);return <button className="shift-row" onClick={onClick}><span className="job-dot" style={{background:colorForJob(j)}}/><span className="shift-main"><b>{j?.name||shift.jobNameSnapshot||'Lavoro eliminato'}</b><small>{dateFmt(shift.date,{weekday:'short',day:'2-digit',month:'short'})} · {shift.status==='completed'?`${actualHours(shift).toFixed(1)} h reali`:`${plannedHours(shift,j).toFixed(1)} h stimate`}</small></span><span className="shift-right"><b>{money(val,state.profile.currency)}</b><small>{shift.status==='completed'?(shift.paid?'Incassato':'Da incassare'):'Previsto'}</small></span></button>}

function Calendar({state,month,setMonth,openDay,openShift}){
  const y=month.getFullYear(),m=month.getMonth(); const first=new Date(y,m,1); const offset=(first.getDay()+6)%7; const total=new Date(y,m+1,0).getDate(); const cells=[];
  for(let i=0;i<offset;i++)cells.push(null); for(let d=1;d<=total;d++)cells.push(new Date(y,m,d)); while(cells.length%7)cells.push(null);
  const monthData=monthMetrics(state,month);
  return <div className="page">
    <div className="month-head"><button onClick={()=>setMonth(addMonths(month,-1))}>‹</button><div><h1>{monthLabel(month)}</h1><small>{money(monthData.earned,state.profile.currency)} guadagnati · {money(monthData.projected,state.profile.currency)} previsti</small></div><button onClick={()=>setMonth(addMonths(month,1))}>›</button></div>
    <div className="weekday-row">{['L','M','M','G','V','S','D'].map((x,i)=><span key={i}>{x}</span>)}</div>
    <div className="calendar-grid">{cells.map((d,i)=>{
      if(!d)return <div key={i} className="day blank"/>;
      const ds=isoDate(d);const shifts=state.shifts.filter(s=>s.date===ds&&s.status!=='cancelled');const value=shifts.reduce((a,s)=>a+shiftValue(s,jobFor(state,s.jobId)),0);const today=ds===isoDate();
      return <button key={ds} className={`day ${today?'today':''}`} onClick={()=>openDay(ds)}><span className="day-num">{d.getDate()}</span><span className="day-dots">{shifts.slice(0,3).map(s=><i key={s.id} style={{background:colorForJob(jobFor(state,s.jobId))}}/> )}</span>{value>0&&<small>{Math.round(value)}€</small>}</button>;
    })}</div>
    <button className="secondary wide calendar-add" onClick={()=>openShift(isoDate(new Date(y,m,Math.min(new Date().getDate(),total))))}>Aggiungi turno in questo mese</button>
    <div className="legend-card"><div><span>Guadagnato</span><b>{money(monthData.earned,state.profile.currency)}</b></div><div><span>Stimato futuro</span><b>{money(monthData.forecast,state.profile.currency)}</b></div><div><span>Ore reali</span><b>{hoursFmt(monthData.completedHours)}</b></div></div>
  </div>
}

function DaySheet({state,date,onClose,onEdit,onAdd}){const shifts=state.shifts.filter(s=>s.date===date).sort((a,b)=>(a.startTime||'').localeCompare(b.startTime||''));return <Modal onClose={onClose} title={dateFmt(date,{weekday:'long',day:'numeric',month:'long'})}><div className="stack">{shifts.length?shifts.map(s=><ShiftRow key={s.id} state={state} shift={s} onClick={()=>onEdit(s.id)}/>):<Empty title="Nessun turno" text="Questa giornata è libera."/>}</div><button className="primary wide modal-action" onClick={onAdd}>+ Aggiungi turno</button></Modal>}

function Jobs({state,openJob,openShift}){
  return <div className="page"><div className="page-title-row"><div><div className="eyebrow">LAVORI</div><h1>I tuoi lavori</h1></div><button className="small-primary" onClick={()=>openJob({})}>+ Nuovo</button></div>
    {state.jobs.length?<div className="job-list">{state.jobs.map(j=>{
      const related=state.shifts.filter(s=>s.jobId===j.id);const earned=related.reduce((a,s)=>a+calcActual(s,j),0);const next=related.filter(s=>s.status==='planned'&&s.date>=isoDate()).sort((a,b)=>a.date.localeCompare(b.date))[0];
      return <div className="job-card" key={j.id}><div className="job-card-head"><span className="job-color" style={{background:j.color}}/><div><h3>{j.name}</h3><p>{j.employer||'Nessun datore indicato'}</p></div><span className={`status-pill ${j.active===false?'off':''}`}>{j.active===false?'Pausa':'Attivo'}</span></div><div className="job-card-stats"><div><span>Paga base</span><b>{j.payType==='hourly'?`${money(j.hourlyRate,state.profile.currency)}/h`:j.payType==='fixed'?`${money(j.fixedPay,state.profile.currency)}/turno`:'Variabile'}</b></div><div><span>Totale storico</span><b>{money(earned,state.profile.currency)}</b></div></div>{next&&<div className="next-mini">Prossimo: <b>{dateFmt(next.date,{weekday:'short',day:'2-digit',month:'short'})}</b></div>}<div className="job-actions"><button onClick={()=>openShift(j.id)}>+ Turno</button><button onClick={()=>openJob({id:j.id})}>Modifica</button></div></div>})}</div>:<Empty title="Aggiungi il primo lavoro" text="Imposta una paga standard, le ore tipiche e se il rapporto è continuo o ha una data di fine. Ogni turno potrà comunque sovrascrivere questi valori." action="Crea lavoro" onAction={()=>openJob({})}/>} 
  </div>
}

function Insights({state}){
  const now=new Date(); const months=Array.from({length:6},(_,i)=>addMonths(new Date(now.getFullYear(),now.getMonth(),1),i-5));const series=months.map(d=>({d,...monthMetrics(state,d)}));const max=Math.max(1,...series.map(x=>x.earned));
  const current=monthMetrics(state,now); const byJob=state.jobs.map(j=>({job:j,value:state.shifts.filter(s=>s.jobId===j.id).reduce((a,s)=>a+calcActual(s,j),0),hours:state.shifts.filter(s=>s.jobId===j.id&&s.status==='completed').reduce((a,s)=>a+num(s.actualHours),0)})).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
  const best=byJob[0];
  return <div className="page"><div className="page-title-row"><div><div className="eyebrow">ANALISI</div><h1>Performance</h1></div></div>
    <div className="insight-hero"><span>Proiezione mese</span><b>{money(current.projected,state.profile.currency)}</b><small>{current.completedCount} turni chiusi · {current.plannedCount} programmati</small></div>
    <SectionTitle title="Ultimi 6 mesi"/><div className="bar-chart">{series.map(x=><div className="bar-col" key={x.d.toISOString()}><div className="bar-wrap"><div className="bar" style={{height:`${Math.max(4,(x.earned/max)*100)}%`}}/></div><small>{new Intl.DateTimeFormat('it-IT',{month:'short'}).format(x.d)}</small><b>{Math.round(x.earned)}€</b></div>)}</div>
    <div className="metric-grid"><Metric label="Miglior lavoro" value={best?.job.name||'—'} sub={best?money(best.value,state.profile.currency):'Nessun dato'}/><Metric label="Media oraria mese" value={money(current.effectiveHourly,state.profile.currency)} sub={`${hoursFmt(current.completedHours)} reali`}/></div>
    <SectionTitle title="Guadagni per lavoro"/>{byJob.length?<div className="stack">{byJob.map(x=><div className="rank-row" key={x.job.id}><span className="job-dot" style={{background:x.job.color}}/><div><b>{x.job.name}</b><small>{hoursFmt(x.hours)} totali</small></div><strong>{money(x.value,state.profile.currency)}</strong></div>)}</div>:<Empty title="Servono più dati" text="Chiudi qualche turno e qui vedrai quali lavori rendono di più in totale e per ora."/>}
  </div>
}

function Settings({state,setState,logout,authRequired,showToast}){
  const fileRef=useRef();
  async function importFile(file){if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.jobs)||!Array.isArray(data.shifts))throw new Error();setState(data);showToast('Backup importato');}catch{showToast('File di backup non valido');}}
  function download(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`worktrack-backup-${isoDate()}.json`;a.click();URL.revokeObjectURL(a.href);}
  return <div className="page"><div className="page-title-row"><div><div className="eyebrow">IMPOSTAZIONI</div><h1>Controllo dati</h1></div></div>
    <div className="settings-card"><label>Nome<input value={state.profile.name||''} onChange={e=>setState(s=>({...s,profile:{...s.profile,name:e.target.value}}))}/></label><label>Valuta<select value={state.profile.currency||'EUR'} onChange={e=>setState(s=>({...s,profile:{...s.profile,currency:e.target.value}}))}><option>EUR</option><option>GBP</option><option>USD</option><option>CHF</option></select></label></div>
    <SectionTitle title="Backup"/><div className="settings-actions"><button onClick={download}>Esporta JSON</button><button onClick={()=>fileRef.current?.click()}>Importa backup</button><input ref={fileRef} hidden type="file" accept="application/json" onChange={e=>importFile(e.target.files?.[0])}/></div>
    <div className="note-card"><b>Persistenza</b><p>I dati vengono salvati sul server Railway e anche in cache locale sul tuo iPhone. Per Railway monta un volume persistente su <code>/data</code>.</p></div>
    <div className="note-card"><b>Modalità app iPhone</b><p>Apri il sito in Safari → Condividi → “Aggiungi alla schermata Home”. Il layout usa viewport standalone, safe-area e body bloccato per evitare il classico rimbalzo della pagina web.</p></div>
    {authRequired&&<button className="danger wide" onClick={logout}>Esci</button>}
  </div>
}

function JobForm({initial,onSave,onDelete,onClose,index}){
  const [f,setF]=useState(()=>({id:initial?.id||uid('job'),name:initial?.name||'',employer:initial?.employer||'',color:initial?.color||COLORS[index%COLORS.length],payType:initial?.payType||'hourly',hourlyRate:initial?.hourlyRate??'',fixedPay:initial?.fixedPay??'',estimatedHours:initial?.estimatedHours??8,employmentType:initial?.employmentType||'ongoing',startDate:initial?.startDate||isoDate(),endDate:initial?.endDate||'',active:initial?.active!==false,notes:initial?.notes||''}));
  function set(k,v){setF(x=>({...x,[k]:v}))}
  return <Modal onClose={onClose} title={initial?.id?'Modifica lavoro':'Nuovo lavoro'}>
    <div className="form-grid"><label>Nome lavoro<input autoFocus value={f.name} onChange={e=>set('name',e.target.value)} placeholder="Es. Catering eventi"/></label><label>Datore / cliente<input value={f.employer} onChange={e=>set('employer',e.target.value)} placeholder="Opzionale"/></label><label>Tipo paga<select value={f.payType} onChange={e=>set('payType',e.target.value)}><option value="hourly">A ore</option><option value="fixed">Fissa per turno</option><option value="variable">Variabile</option></select></label>{f.payType==='hourly'&&<label>Paga oraria<input type="number" inputMode="decimal" value={f.hourlyRate} onChange={e=>set('hourlyRate',e.target.value)} placeholder="12.50"/></label>}{f.payType==='fixed'&&<label>Paga per turno<input type="number" inputMode="decimal" value={f.fixedPay} onChange={e=>set('fixedPay',e.target.value)} placeholder="100"/></label>}<label>Ore tipiche per turno<input type="number" inputMode="decimal" value={f.estimatedHours} onChange={e=>set('estimatedHours',e.target.value)}/></label><label>Durata rapporto<select value={f.employmentType} onChange={e=>set('employmentType',e.target.value)}><option value="ongoing">Continuativo / a chiamata</option><option value="fixed">Periodo fisso</option></select></label><div className="two-col"><label>Inizio<input type="date" value={f.startDate} onChange={e=>set('startDate',e.target.value)}/></label>{f.employmentType==='fixed'&&<label>Fine<input type="date" value={f.endDate} onChange={e=>set('endDate',e.target.value)}/></label>}</div><label>Colore<div className="color-row">{COLORS.map(c=><button type="button" key={c} onClick={()=>set('color',c)} className={`color-choice ${f.color===c?'selected':''}`} style={{background:c}}/>)}</div></label><label>Note<textarea value={f.notes} onChange={e=>set('notes',e.target.value)} placeholder="Dettagli utili..."/></label><label className="switch-line"><span>Lavoro attivo</span><input type="checkbox" checked={f.active} onChange={e=>set('active',e.target.checked)}/></label></div>
    <button className="primary wide modal-action" disabled={!f.name.trim()} onClick={()=>onSave(f)}>Salva lavoro</button>{initial?.id&&<button className="danger-text wide" onClick={()=>onDelete(f.id)}>Elimina lavoro</button>}
  </Modal>
}

function ShiftForm({state,initial,onSave,onDelete,onClose,onNeedJob}){
  const firstJob=initial?.jobId||state.jobs.find(j=>j.active!==false)?.id||state.jobs[0]?.id||'';
  const [f,setF]=useState(()=>({id:initial?.id||uid('shift'),jobId:firstJob,date:initial?.date||isoDate(),status:initial?.status||'planned',startTime:initial?.startTime||'',endTime:initial?.endTime||'',estimatedHours:initial?.estimatedHours??'',actualHours:initial?.actualHours??'',payType:initial?.payType||'',hourlyRate:initial?.hourlyRate??'',fixedPay:initial?.fixedPay??'',estimatedPay:initial?.estimatedPay??'',actualPay:initial?.actualPay??'',manualPay:initial?.manualPay??'',bonus:initial?.bonus??'',deductions:initial?.deductions??'',paid:initial?.paid||false,notes:initial?.notes||'',jobNameSnapshot:initial?.jobNameSnapshot||''}));
  const job=jobFor(state,f.jobId); const effectiveType=f.payType||job?.payType||'hourly';
  function set(k,v){setF(x=>({...x,[k]:v}))}
  function save(){const snap={...f,jobNameSnapshot:job?.name||f.jobNameSnapshot};onSave(snap)}
  if(!state.jobs.length)return <Modal onClose={onClose} title="Nuovo turno"><Empty title="Prima crea un lavoro" text="Il turno deve essere collegato a un lavoro. Potrai poi cambiare paga e ore direttamente sul singolo turno." action="Crea lavoro" onAction={onNeedJob}/></Modal>;
  const preview=f.status==='completed'?calcActual(f,job):calcEstimate(f,job);
  return <Modal onClose={onClose} title={initial?.id?'Modifica turno':'Nuovo turno'}>
    <div className="form-grid"><label>Lavoro<select value={f.jobId} onChange={e=>set('jobId',e.target.value)}>{state.jobs.map(j=><option key={j.id} value={j.id}>{j.name}</option>)}</select></label><div className="two-col"><label>Data<input type="date" value={f.date} onChange={e=>set('date',e.target.value)}/></label><label>Stato<select value={f.status} onChange={e=>set('status',e.target.value)}><option value="planned">Programmato</option><option value="completed">Completato</option><option value="cancelled">Annullato</option></select></label></div><div className="two-col"><label>Ora inizio<input type="time" value={f.startTime} onChange={e=>set('startTime',e.target.value)}/></label><label>Ora fine<input type="time" value={f.endTime} onChange={e=>set('endTime',e.target.value)}/></label></div><div className="two-col"><label>Ore stimate<input type="number" inputMode="decimal" value={f.estimatedHours} onChange={e=>set('estimatedHours',e.target.value)} placeholder={String(job?.estimatedHours||0)}/></label>{f.status==='completed'&&<label>Ore reali<input type="number" inputMode="decimal" value={f.actualHours} onChange={e=>set('actualHours',e.target.value)} placeholder="0"/></label>}</div>
      <div className="override-box"><div className="override-title">Paga del singolo turno <span>override opzionali</span></div><label>Metodo<select value={f.payType} onChange={e=>set('payType',e.target.value)}><option value="">Usa quello del lavoro ({job?.payType==='hourly'?'oraria':job?.payType==='fixed'?'fissa':'variabile'})</option><option value="hourly">A ore</option><option value="fixed">Fissa</option><option value="variable">Variabile</option></select></label>{effectiveType==='hourly'&&<label>Paga oraria per questo turno<input type="number" inputMode="decimal" value={f.hourlyRate} onChange={e=>set('hourlyRate',e.target.value)} placeholder={String(job?.hourlyRate||0)}/></label>}{effectiveType==='fixed'&&<label>Paga fissa per questo turno<input type="number" inputMode="decimal" value={f.fixedPay} onChange={e=>set('fixedPay',e.target.value)} placeholder={String(job?.fixedPay||0)}/></label>}{effectiveType==='variable'&&<div className="two-col"><label>Stima paga<input type="number" inputMode="decimal" value={f.estimatedPay} onChange={e=>set('estimatedPay',e.target.value)}/></label>{f.status==='completed'&&<label>Paga reale<input type="number" inputMode="decimal" value={f.actualPay} onChange={e=>set('actualPay',e.target.value)}/></label>}</div>}<label>Totale manuale <span className="hint">se compilato, prevale su tutto</span><input type="number" inputMode="decimal" value={f.manualPay} onChange={e=>set('manualPay',e.target.value)} placeholder="Lascia vuoto per calcolo automatico"/></label><div className="two-col"><label>Bonus / mance<input type="number" inputMode="decimal" value={f.bonus} onChange={e=>set('bonus',e.target.value)}/></label><label>Trattenute<input type="number" inputMode="decimal" value={f.deductions} onChange={e=>set('deductions',e.target.value)}/></label></div></div>
      {f.status==='completed'&&<label className="switch-line"><span>Pagamento ricevuto</span><input type="checkbox" checked={f.paid} onChange={e=>set('paid',e.target.checked)}/></label>}<label>Note turno<textarea value={f.notes} onChange={e=>set('notes',e.target.value)} placeholder="Cambio orario, straordinari, dettagli..."/></label><div className="preview-card"><span>{f.status==='completed'?'Totale reale':'Stima turno'}</span><b>{money(preview,state.profile.currency)}</b><small>Il valore si aggiorna con gli override sopra.</small></div></div>
    <button className="primary wide modal-action" onClick={save}>Salva turno</button>{initial?.id&&<button className="danger-text wide" onClick={()=>onDelete(f.id)}>Elimina turno</button>}
  </Modal>
}

function Modal({title,onClose,children}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal-sheet"><div className="modal-handle"/><div className="modal-head"><h2>{title}</h2><button onClick={onClose}>×</button></div><div className="modal-scroll scrollable">{children}</div></div></div>}

export default App;
