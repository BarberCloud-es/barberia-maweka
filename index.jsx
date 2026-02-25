import { useState, useEffect, useCallback } from "react";

// ─── Helpers ────────────────────────────────────────────────────────────────
const DAYS_ES = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const SERVICES = [
  { id: "corte", name: "Corte de Cabello", duration: 30, price: "12€" },
  { id: "barba", name: "Arreglo de Barba", duration: 30, price: "10€" },
  { id: "corte_barba", name: "Corte + Barba", duration: 60, price: "20€" },
  { id: "afeitado", name: "Afeitado Clásico", duration: 45, price: "15€" },
  { id: "tinte", name: "Tinte / Color", duration: 60, price: "25€" },
];
const ADMIN_PASS = "maweka2024";

const DEFAULT_SETTINGS = {
  schedule: {
    0: { open: false, start: "09:00", end: "20:00", breaks: [{ start: "14:00", end: "15:00" }] },
    1: { open: true,  start: "09:00", end: "20:00", breaks: [{ start: "14:00", end: "15:00" }] },
    2: { open: true,  start: "09:00", end: "20:00", breaks: [{ start: "14:00", end: "15:00" }] },
    3: { open: true,  start: "09:00", end: "20:00", breaks: [{ start: "14:00", end: "15:00" }] },
    4: { open: true,  start: "09:00", end: "20:00", breaks: [{ start: "14:00", end: "15:00" }] },
    5: { open: true,  start: "09:00", end: "20:00", breaks: [{ start: "14:00", end: "15:00" }] },
    6: { open: true,  start: "09:00", end: "14:00", breaks: [] },
  },
  slotDuration: 30,
  closedDates: [],
  barbers: ["Carlos"],
};

function toMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2,"0")}:${String(min).padStart(2,"0")}`;
}
function today() {
  return new Date().toISOString().split("T")[0];
}
function dateKey(y, m, d) {
  return `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}

// Generate available slots for a given date
function generateSlots(dateStr, settings, appointments) {
  const dt = new Date(dateStr + "T12:00:00");
  const dow = dt.getDay();
  const dayConf = settings.schedule[dow];
  if (!dayConf || !dayConf.open) return [];
  if (settings.closedDates.includes(dateStr)) return [];

  const slotLen = settings.slotDuration;
  const start = toMinutes(dayConf.start);
  const end = toMinutes(dayConf.end);
  const slots = [];

  for (let t = start; t + slotLen <= end; t += slotLen) {
    // Check breaks
    const inBreak = dayConf.breaks.some(b => t >= toMinutes(b.start) && t < toMinutes(b.end));
    if (inBreak) continue;
    const timeStr = fromMinutes(t);
    const bookedServices = appointments.filter(a => a.date === dateStr && a.time === timeStr);
    const booked = bookedServices.length >= settings.barbers.length;
    slots.push({ time: timeStr, booked, bookings: bookedServices });
  }
  return slots;
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function ElMawekaApp() {
  const [view, setView] = useState("client"); // "client" | "admin"
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [appointments, setAppointments] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // Load from storage
  useEffect(() => {
    (async () => {
      try {
        const s = await window.storage.get("maweka_settings");
        if (s) setSettings(JSON.parse(s.value));
      } catch {}
      try {
        const a = await window.storage.get("maweka_appointments");
        if (a) setAppointments(JSON.parse(a.value));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const saveSettings = useCallback(async (s) => {
    setSettings(s);
    await window.storage.set("maweka_settings", JSON.stringify(s));
  }, []);

  const saveAppointments = useCallback(async (a) => {
    setAppointments(a);
    await window.storage.set("maweka_appointments", JSON.stringify(a));
  }, []);

  if (!loaded) return (
    <div style={styles.loading}>
      <div style={styles.loadingSpinner}></div>
      <p style={{color:"#c9a84c",fontFamily:"'Playfair Display',serif",marginTop:16}}>Cargando El Maweka…</p>
    </div>
  );

  return (
    <div style={styles.root}>
      <style>{css}</style>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logo}>
            <span style={styles.logoPole}>💈</span>
            <div>
              <div style={styles.logoTitle}>EL MAWEKA</div>
              <div style={styles.logoSub}>Barbería de Élite</div>
            </div>
          </div>
          <nav style={styles.nav}>
            <button style={{...styles.navBtn, ...(view==="client"?styles.navBtnActive:{})}} onClick={()=>setView("client")}>
              Reservar Cita
            </button>
            <button style={{...styles.navBtn, ...(view==="admin"?styles.navBtnActive:{})}} onClick={()=>setView("admin")}>
              Panel Barbero
            </button>
          </nav>
        </div>
      </header>

      <main style={styles.main}>
        {view === "client"
          ? <ClientView settings={settings} appointments={appointments} saveAppointments={saveAppointments} />
          : <AdminView settings={settings} saveSettings={saveSettings} appointments={appointments} saveAppointments={saveAppointments} />
        }
      </main>

      <footer style={styles.footer}>
        <span>© 2026 El Maweka — Todos los derechos reservados</span>
      </footer>
    </div>
  );
}

// ─── Client View ─────────────────────────────────────────────────────────────
function ClientView({ settings, appointments, saveAppointments }) {
  const [step, setStep] = useState(1);
  const [selDate, setSelDate] = useState(null);
  const [selSlot, setSelSlot] = useState(null);
  const [selService, setSelService] = useState(null);
  const [selBarber, setSelBarber] = useState(settings.barbers[0]);
  const [form, setForm] = useState({ name:"", phone:"", notes:"" });
  const [calMonth, setCalMonth] = useState(() => { const n=new Date(); return {y:n.getFullYear(),m:n.getMonth()}; });
  const [confirmed, setConfirmed] = useState(null);

  const slots = selDate ? generateSlots(selDate, settings, appointments) : [];

  function buildCalendar() {
    const { y, m } = calMonth;
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }

  function isDayAvailable(d) {
    const dk = dateKey(calMonth.y, calMonth.m, d);
    if (dk < today()) return false;
    const dow = new Date(dk+"T12:00:00").getDay();
    const dayConf = settings.schedule[dow];
    if (!dayConf || !dayConf.open) return false;
    if (settings.closedDates.includes(dk)) return false;
    const sl = generateSlots(dk, settings, appointments);
    return sl.some(s => !s.booked);
  }

  function confirmBooking() {
    const id = Date.now().toString(36);
    const newAppt = { id, date: selDate, time: selSlot, service: selService, barber: selBarber, ...form, createdAt: new Date().toISOString() };
    const updated = [...appointments, newAppt];
    saveAppointments(updated);
    setConfirmed(newAppt);
    setStep(5);
  }

  function resetAll() {
    setStep(1); setSelDate(null); setSelSlot(null); setSelService(null);
    setForm({name:"",phone:"",notes:""}); setConfirmed(null);
  }

  const cells = buildCalendar();

  if (step === 5 && confirmed) return (
    <div style={styles.confirmCard} className="fadeIn">
      <div style={{fontSize:64}}>✅</div>
      <h2 style={styles.confirmTitle}>¡Cita Confirmada!</h2>
      <div style={styles.confirmBox}>
        <Row label="Nombre" val={confirmed.name}/>
        <Row label="Fecha" val={new Date(confirmed.date+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}/>
        <Row label="Hora" val={confirmed.time}/>
        <Row label="Servicio" val={SERVICES.find(s=>s.id===confirmed.service)?.name}/>
        <Row label="Barbero" val={confirmed.barber}/>
        {confirmed.phone && <Row label="Teléfono" val={confirmed.phone}/>}
      </div>
      <button style={styles.btnPrimary} onClick={resetAll}>Hacer otra reserva</button>
    </div>
  );

  return (
    <div style={styles.clientWrap} className="fadeIn">
      <div style={styles.stepBar}>
        {["Fecha","Hora","Servicio","Datos"].map((s,i)=>(
          <div key={i} style={{...styles.stepItem, ...(step===i+1?styles.stepActive:{opacity:step>i+1?0.9:0.4})}}>
            <div style={{...styles.stepNum, background: step>i+1?"#c9a84c":step===i+1?"#c9a84c":"transparent", borderColor:"#c9a84c"}}>
              {step>i+1?"✓":i+1}
            </div>
            <span style={styles.stepLabel}>{s}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={styles.card} className="fadeIn">
          <h2 style={styles.cardTitle}>Selecciona una Fecha</h2>
          <div style={styles.calNav}>
            <button style={styles.calNavBtn} onClick={()=>setCalMonth(prev=>{
              const d=new Date(prev.y,prev.m-1,1); return {y:d.getFullYear(),m:d.getMonth()};
            })}>‹</button>
            <span style={styles.calMonthLabel}>{MONTHS_ES[calMonth.m]} {calMonth.y}</span>
            <button style={styles.calNavBtn} onClick={()=>setCalMonth(prev=>{
              const d=new Date(prev.y,prev.m+1,1); return {y:d.getFullYear(),m:d.getMonth()};
            })}>›</button>
          </div>
          <div style={styles.calGrid}>
            {DAYS_ES.map(d=><div key={d} style={styles.calDayHead}>{d.slice(0,3)}</div>)}
            {cells.map((d,i)=>{
              if (!d) return <div key={"e"+i}/>;
              const dk = dateKey(calMonth.y, calMonth.m, d);
              const avail = isDayAvailable(d);
              const isSel = dk===selDate;
              const isPast = dk < today();
              return (
                <div key={d}
                  style={{...styles.calDay, ...(isSel?styles.calDaySelected:avail?styles.calDayAvail:styles.calDayDisabled)}}
                  onClick={()=>{ if(!avail) return; setSelDate(dk); setSelSlot(null); setStep(2); }}
                  className={avail?"calDayHover":""}
                >
                  {d}
                  {settings.closedDates.includes(dk) && <div style={styles.calDot}>🔒</div>}
                </div>
              );
            })}
          </div>
          <p style={styles.calLegend}><span style={styles.dotGold}/>Disponible &nbsp;<span style={styles.dotGray}/>No disponible</p>
        </div>
      )}

      {step === 2 && (
        <div style={styles.card} className="fadeIn">
          <button style={styles.backBtn} onClick={()=>setStep(1)}>← Volver</button>
          <h2 style={styles.cardTitle}>Selecciona una Hora</h2>
          <p style={styles.subTitle}>{new Date(selDate+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}</p>
          {settings.barbers.length > 1 && (
            <div style={styles.barberSelect}>
              <label style={styles.label}>Barbero:</label>
              <div style={styles.barberBtns}>
                {settings.barbers.map(b=>(
                  <button key={b} style={{...styles.barberBtn, ...(selBarber===b?styles.barberBtnActive:{})}} onClick={()=>setSelBarber(b)}>{b}</button>
                ))}
              </div>
            </div>
          )}
          <div style={styles.slotsGrid}>
            {slots.length === 0 && <p style={{color:"#888",gridColumn:"1/-1",textAlign:"center"}}>No hay huecos disponibles</p>}
            {slots.map(slot=>{
              const barberBooked = slot.bookings.some(b=>b.barber===selBarber);
              const fullyBooked = slot.booked;
              const disabled = barberBooked || fullyBooked;
              return (
                <button key={slot.time}
                  style={{...styles.slotBtn, ...(selSlot===slot.time?styles.slotBtnSel:disabled?styles.slotBtnDis:{})}}
                  disabled={disabled}
                  onClick={()=>{ setSelSlot(slot.time); setStep(3); }}
                >
                  {slot.time}
                  {disabled && <span style={{fontSize:10,display:"block"}}>Ocupado</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={styles.card} className="fadeIn">
          <button style={styles.backBtn} onClick={()=>setStep(2)}>← Volver</button>
          <h2 style={styles.cardTitle}>Elige tu Servicio</h2>
          <div style={styles.servicesList}>
            {SERVICES.map(sv=>(
              <div key={sv.id}
                style={{...styles.serviceItem, ...(selService===sv.id?styles.serviceItemSel:{})}}
                onClick={()=>{setSelService(sv.id); setStep(4);}}
                className="serviceHover"
              >
                <div style={styles.serviceName}>{sv.name}</div>
                <div style={styles.serviceMeta}>{sv.duration} min &nbsp;·&nbsp; <span style={styles.servicePrice}>{sv.price}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={styles.card} className="fadeIn">
          <button style={styles.backBtn} onClick={()=>setStep(3)}>← Volver</button>
          <h2 style={styles.cardTitle}>Tus Datos</h2>
          <div style={styles.summaryBox}>
            <Row label="Fecha" val={new Date(selDate+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long"})}/>
            <Row label="Hora" val={selSlot}/>
            <Row label="Servicio" val={SERVICES.find(s=>s.id===selService)?.name}/>
            <Row label="Barbero" val={selBarber}/>
          </div>
          <div style={styles.formFields}>
            <input style={styles.input} placeholder="Nombre completo *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
            <input style={styles.input} placeholder="Teléfono (opcional)" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
            <textarea style={{...styles.input,height:80,resize:"vertical"}} placeholder="Notas (opcional)" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
          </div>
          <button style={{...styles.btnPrimary, opacity: form.name.trim()?1:0.5}} disabled={!form.name.trim()} onClick={confirmBooking}>
            Confirmar Cita
          </button>
        </div>
      )}
    </div>
  );
}

function Row({label,val}) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #2a2118"}}>
      <span style={{color:"#888",fontSize:13}}>{label}</span>
      <span style={{color:"#e8d5a3",fontWeight:600,fontSize:13}}>{val}</span>
    </div>
  );
}

// ─── Admin View ───────────────────────────────────────────────────────────────
function AdminView({ settings, saveSettings, appointments, saveAppointments }) {
  const [logged, setLogged] = useState(false);
  const [pass, setPass] = useState("");
  const [err, setErr] = useState(false);
  const [tab, setTab] = useState("citas");

  function login() {
    if (pass === ADMIN_PASS) { setLogged(true); setErr(false); }
    else { setErr(true); setPass(""); }
  }

  if (!logged) return (
    <div style={styles.loginWrap} className="fadeIn">
      <div style={styles.loginCard}>
        <div style={{fontSize:48,textAlign:"center"}}>🔑</div>
        <h2 style={{...styles.cardTitle,textAlign:"center"}}>Acceso Barbero</h2>
        <input style={styles.input} type="password" placeholder="Contraseña" value={pass}
          onChange={e=>{setPass(e.target.value);setErr(false);}}
          onKeyDown={e=>e.key==="Enter"&&login()}
        />
        {err && <p style={{color:"#e74c3c",textAlign:"center",marginTop:8}}>Contraseña incorrecta</p>}
        <button style={styles.btnPrimary} onClick={login}>Entrar</button>
        <p style={{color:"#555",fontSize:12,textAlign:"center",marginTop:12}}>Contraseña por defecto: maweka2024</p>
      </div>
    </div>
  );

  return (
    <div style={styles.adminWrap} className="fadeIn">
      <div style={styles.adminTabs}>
        {[["citas","📋 Citas"],["horarios","🕐 Horarios"],["festivos","🗓️ Festivos / Cierre"],["barberos","✂️ Barberos"]].map(([id,label])=>(
          <button key={id} style={{...styles.adminTab,...(tab===id?styles.adminTabActive:{})}} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>
      <div style={styles.adminContent}>
        {tab==="citas" && <CitasTab appointments={appointments} saveAppointments={saveAppointments} settings={settings}/>}
        {tab==="horarios" && <HorariosTab settings={settings} saveSettings={saveSettings}/>}
        {tab==="festivos" && <FestivosTab settings={settings} saveSettings={saveSettings}/>}
        {tab==="barberos" && <BarberosTab settings={settings} saveSettings={saveSettings}/>}
      </div>
    </div>
  );
}

// ─── Citas Tab ─────────────────────────────────────────────────────────────
function CitasTab({ appointments, saveAppointments, settings }) {
  const [filter, setFilter] = useState("upcoming");
  const t = today();
  const list = appointments
    .filter(a => filter==="upcoming" ? a.date >= t : a.date < t)
    .sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));

  function cancel(id) {
    if (!confirm("¿Cancelar esta cita?")) return;
    saveAppointments(appointments.filter(a=>a.id!==id));
  }

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        <button style={{...styles.filterBtn,...(filter==="upcoming"?styles.filterBtnActive:{})}} onClick={()=>setFilter("upcoming")}>Próximas</button>
        <button style={{...styles.filterBtn,...(filter==="past"?styles.filterBtnActive:{})}} onClick={()=>setFilter("past")}>Pasadas</button>
      </div>
      {list.length===0 && <p style={{color:"#555",textAlign:"center",padding:40}}>No hay citas {filter==="upcoming"?"próximas":"pasadas"}</p>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {list.map(a=>{
          const sv = SERVICES.find(s=>s.id===a.service);
          return (
            <div key={a.id} style={styles.apptCard}>
              <div style={styles.apptDate}>
                <div style={styles.apptDay}>{new Date(a.date+"T12:00:00").toLocaleDateString("es-ES",{day:"2-digit",month:"short"})}</div>
                <div style={styles.apptTime}>{a.time}</div>
              </div>
              <div style={styles.apptInfo}>
                <div style={styles.apptName}>{a.name}</div>
                <div style={styles.apptMeta}>{sv?.name} · {a.barber}</div>
                {a.phone && <div style={styles.apptPhone}>📞 {a.phone}</div>}
                {a.notes && <div style={styles.apptNotes}>💬 {a.notes}</div>}
              </div>
              {filter==="upcoming" && (
                <button style={styles.cancelBtn} onClick={()=>cancel(a.id)}>✕</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Horarios Tab ──────────────────────────────────────────────────────────
function HorariosTab({ settings, saveSettings }) {
  const [local, setLocal] = useState(JSON.parse(JSON.stringify(settings)));

  function update(dow, field, val) {
    setLocal(prev => {
      const n = JSON.parse(JSON.stringify(prev));
      n.schedule[dow][field] = val;
      return n;
    });
  }
  function updateBreak(dow, bi, field, val) {
    setLocal(prev => {
      const n = JSON.parse(JSON.stringify(prev));
      n.schedule[dow].breaks[bi][field] = val;
      return n;
    });
  }
  function addBreak(dow) {
    setLocal(prev => {
      const n = JSON.parse(JSON.stringify(prev));
      n.schedule[dow].breaks.push({ start:"13:00", end:"14:00" });
      return n;
    });
  }
  function removeBreak(dow, bi) {
    setLocal(prev => {
      const n = JSON.parse(JSON.stringify(prev));
      n.schedule[dow].breaks.splice(bi, 1);
      return n;
    });
  }

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h3 style={styles.sectionTitle}>Horario Semanal</h3>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <label style={styles.label}>Duración del turno:</label>
          <select style={styles.select} value={local.slotDuration} onChange={e=>setLocal(p=>({...p,slotDuration:Number(e.target.value)}))}>
            {[15,20,30,45,60].map(v=><option key={v} value={v}>{v} min</option>)}
          </select>
        </div>
      </div>
      {[1,2,3,4,5,6,0].map(dow=>{
        const day = local.schedule[dow];
        return (
          <div key={dow} style={styles.dayRow}>
            <div style={styles.dayToggle}>
              <label style={styles.toggle}>
                <input type="checkbox" checked={day.open} onChange={e=>update(dow,"open",e.target.checked)} style={{display:"none"}}/>
                <div style={{...styles.toggleTrack, background: day.open?"#c9a84c":"#2a2118"}}>
                  <div style={{...styles.toggleThumb, left: day.open?"calc(100% - 22px)":"2px"}}/>
                </div>
              </label>
              <span style={{color:day.open?"#e8d5a3":"#555",fontWeight:600,width:90}}>{DAYS_ES[dow]}</span>
            </div>
            {day.open ? (
              <div style={styles.dayConfig}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <input type="time" style={styles.timeInput} value={day.start} onChange={e=>update(dow,"start",e.target.value)}/>
                  <span style={{color:"#888"}}>—</span>
                  <input type="time" style={styles.timeInput} value={day.end} onChange={e=>update(dow,"end",e.target.value)}/>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
                  {day.breaks.map((b,bi)=>(
                    <div key={bi} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{color:"#888",fontSize:12}}>Descanso:</span>
                      <input type="time" style={styles.timeInputSm} value={b.start} onChange={e=>updateBreak(dow,bi,"start",e.target.value)}/>
                      <span style={{color:"#888"}}>—</span>
                      <input type="time" style={styles.timeInputSm} value={b.end} onChange={e=>updateBreak(dow,bi,"end",e.target.value)}/>
                      <button style={styles.removeBtn} onClick={()=>removeBreak(dow,bi)}>✕</button>
                    </div>
                  ))}
                  <button style={styles.addBreakBtn} onClick={()=>addBreak(dow)}>+ Añadir descanso</button>
                </div>
              </div>
            ) : (
              <span style={{color:"#555",fontSize:13,marginLeft:12}}>Cerrado</span>
            )}
          </div>
        );
      })}
      <button style={{...styles.btnPrimary,marginTop:24}} onClick={()=>saveSettings(local)}>Guardar Horario</button>
    </div>
  );
}

// ─── Festivos Tab ──────────────────────────────────────────────────────────
function FestivosTab({ settings, saveSettings }) {
  const [newDate, setNewDate] = useState("");
  const [newLabel, setNewLabel] = useState("");

  // Support labelled closures
  const [closures, setClosures] = useState(() => {
    return (settings.closedDates || []).map(d => typeof d === "string" ? { date: d, label: "" } : d);
  });

  function add() {
    if (!newDate) return;
    const exists = closures.some(c=>c.date===newDate);
    if (exists) return;
    const updated = [...closures, {date: newDate, label: newLabel}].sort((a,b)=>a.date.localeCompare(b.date));
    setClosures(updated);
    setNewDate(""); setNewLabel("");
    saveSettings({...settings, closedDates: updated.map(c=>c.date)});
  }
  function remove(date) {
    const updated = closures.filter(c=>c.date!==date);
    setClosures(updated);
    saveSettings({...settings, closedDates: updated.map(c=>c.date)});
  }

  return (
    <div>
      <h3 style={styles.sectionTitle}>Días Festivos / Cierre</h3>
      <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap"}}>
        <input type="date" style={styles.input2} value={newDate} onChange={e=>setNewDate(e.target.value)} min={today()}/>
        <input style={{...styles.input2,flex:1,minWidth:140}} placeholder="Etiqueta (ej: Navidad)" value={newLabel} onChange={e=>setNewLabel(e.target.value)}/>
        <button style={styles.btnGold} onClick={add}>Añadir</button>
      </div>
      {closures.length===0 && <p style={{color:"#555",textAlign:"center",padding:30}}>No hay días de cierre configurados</p>}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {closures.map(c=>(
          <div key={c.date} style={styles.closureRow}>
            <span style={{color:"#c9a84c",fontWeight:700}}>{new Date(c.date+"T12:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</span>
            {c.label && <span style={{color:"#888",fontSize:13}}>— {c.label}</span>}
            <button style={{...styles.removeBtn,marginLeft:"auto"}} onClick={()=>remove(c.date)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Barberos Tab ──────────────────────────────────────────────────────────
function BarberosTab({ settings, saveSettings }) {
  const [barberos, setBarberos] = useState([...settings.barbers]);
  const [newName, setNewName] = useState("");

  function add() {
    if (!newName.trim() || barberos.includes(newName.trim())) return;
    const updated = [...barberos, newName.trim()];
    setBarberos(updated);
    setNewName("");
    saveSettings({...settings, barbers: updated});
  }
  function remove(b) {
    if (barberos.length===1) return alert("Debe haber al menos un barbero");
    const updated = barberos.filter(x=>x!==b);
    setBarberos(updated);
    saveSettings({...settings, barbers: updated});
  }

  return (
    <div>
      <h3 style={styles.sectionTitle}>Gestión de Barberos</h3>
      <div style={{display:"flex",gap:8,marginBottom:24}}>
        <input style={{...styles.input2,flex:1}} placeholder="Nombre del barbero" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/>
        <button style={styles.btnGold} onClick={add}>Añadir</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {barberos.map(b=>(
          <div key={b} style={styles.barberRow}>
            <span style={{fontSize:24}}>✂️</span>
            <span style={{color:"#e8d5a3",fontWeight:600,flex:1,fontSize:18}}>{b}</span>
            <button style={styles.removeBtn} onClick={()=>remove(b)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Styles & CSS ─────────────────────────────────────────────────────────
const styles = {
  root: { minHeight:"100vh", background:"#0d0b08", fontFamily:"'Lato',sans-serif", color:"#e8d5a3" },
  loading: { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0d0b08" },
  loadingSpinner: { width:40,height:40,border:"3px solid #2a2118",borderTop:"3px solid #c9a84c",borderRadius:"50%",animation:"spin 1s linear infinite" },
  header: { background:"linear-gradient(135deg,#0d0b08 0%,#1a1510 100%)", borderBottom:"2px solid #c9a84c", position:"sticky", top:0, zIndex:100 },
  headerInner: { maxWidth:1000,margin:"0 auto",padding:"0 20px",display:"flex",alignItems:"center",justifyContent:"space-between",height:72 },
  logo: { display:"flex",alignItems:"center",gap:12 },
  logoPole: { fontSize:36 },
  logoTitle: { fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#c9a84c",letterSpacing:3 },
  logoSub: { fontSize:10,color:"#7a6844",letterSpacing:4,textTransform:"uppercase",marginTop:-2 },
  nav: { display:"flex",gap:8 },
  navBtn: { background:"transparent",border:"1px solid #3a2e1e",color:"#888",padding:"8px 18px",borderRadius:4,cursor:"pointer",fontSize:13,letterSpacing:1,transition:"all .2s" },
  navBtnActive: { background:"#c9a84c",border:"1px solid #c9a84c",color:"#0d0b08",fontWeight:700 },
  main: { maxWidth:1000,margin:"0 auto",padding:"40px 20px",minHeight:"calc(100vh - 140px)" },
  footer: { textAlign:"center",padding:"20px",borderTop:"1px solid #1a1510",color:"#444",fontSize:12,letterSpacing:2 },

  // Client
  clientWrap: { maxWidth:700,margin:"0 auto" },
  stepBar: { display:"flex",gap:0,marginBottom:32,justifyContent:"center" },
  stepItem: { display:"flex",flexDirection:"column",alignItems:"center",gap:8,flex:1 },
  stepActive: { opacity:1 },
  stepNum: { width:32,height:32,borderRadius:"50%",border:"2px solid",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:"#0d0b08",transition:"all .3s" },
  stepLabel: { fontSize:11,letterSpacing:1,color:"#888",textTransform:"uppercase" },

  card: { background:"#12100c",border:"1px solid #2a2118",borderRadius:12,padding:32 },
  cardTitle: { fontFamily:"'Playfair Display',serif",fontSize:24,color:"#c9a84c",marginBottom:24,fontWeight:700 },
  subTitle: { color:"#888",fontSize:14,marginTop:-18,marginBottom:20,textTransform:"capitalize" },
  backBtn: { background:"transparent",border:"none",color:"#888",cursor:"pointer",fontSize:13,marginBottom:16,padding:0 },

  // Calendar
  calNav: { display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16 },
  calNavBtn: { background:"#1e1a13",border:"1px solid #2a2118",color:"#c9a84c",width:36,height:36,borderRadius:"50%",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" },
  calMonthLabel: { fontFamily:"'Playfair Display',serif",fontSize:18,color:"#e8d5a3" },
  calGrid: { display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4 },
  calDayHead: { textAlign:"center",fontSize:11,color:"#555",padding:"6px 0",fontWeight:600,letterSpacing:1 },
  calDay: { textAlign:"center",padding:"10px 4px",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:600,transition:"all .15s",position:"relative" },
  calDayAvail: { color:"#e8d5a3",border:"1px solid #2a2118",background:"#1a1510" },
  calDaySelected: { background:"#c9a84c",color:"#0d0b08",border:"1px solid #c9a84c" },
  calDayDisabled: { color:"#333",cursor:"default",border:"1px solid #1a1510" },
  calDot: { fontSize:8,position:"absolute",bottom:2,right:2 },
  calLegend: { display:"flex",alignItems:"center",gap:8,marginTop:16,fontSize:12,color:"#555" },
  dotGold: { display:"inline-block",width:10,height:10,borderRadius:"50%",background:"#c9a84c",marginRight:4 },
  dotGray: { display:"inline-block",width:10,height:10,borderRadius:"50%",background:"#2a2118",marginRight:4 },

  // Slots
  barberSelect: { marginBottom:16 },
  barberBtns: { display:"flex",gap:8,marginTop:8,flexWrap:"wrap" },
  barberBtn: { background:"#1a1510",border:"1px solid #2a2118",color:"#888",padding:"6px 16px",borderRadius:20,cursor:"pointer",fontSize:13 },
  barberBtnActive: { background:"#c9a84c",border:"1px solid #c9a84c",color:"#0d0b08",fontWeight:700 },
  slotsGrid: { display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8 },
  slotBtn: { padding:"12px 8px",background:"#1a1510",border:"1px solid #2a2118",color:"#e8d5a3",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:600,transition:"all .15s" },
  slotBtnSel: { background:"#c9a84c",border:"1px solid #c9a84c",color:"#0d0b08" },
  slotBtnDis: { background:"#0f0d0a",border:"1px solid #1a1510",color:"#333",cursor:"default" },

  // Services
  servicesList: { display:"flex",flexDirection:"column",gap:10 },
  serviceItem: { background:"#1a1510",border:"1px solid #2a2118",borderRadius:10,padding:"16px 20px",cursor:"pointer",transition:"all .2s" },
  serviceItemSel: { border:"1px solid #c9a84c",background:"#1e1a12" },
  serviceName: { fontWeight:700,color:"#e8d5a3",fontSize:16 },
  serviceMeta: { color:"#777",fontSize:13,marginTop:4 },
  servicePrice: { color:"#c9a84c",fontWeight:700 },

  // Form
  summaryBox: { background:"#0f0d0a",border:"1px solid #1a1510",borderRadius:8,padding:16,marginBottom:20 },
  formFields: { display:"flex",flexDirection:"column",gap:12,marginBottom:20 },
  input: { background:"#1a1510",border:"1px solid #2a2118",color:"#e8d5a3",padding:"12px 16px",borderRadius:8,fontSize:14,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"'Lato',sans-serif" },
  input2: { background:"#1a1510",border:"1px solid #2a2118",color:"#e8d5a3",padding:"10px 14px",borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'Lato',sans-serif" },
  label: { color:"#888",fontSize:13 },
  btnPrimary: { background:"linear-gradient(135deg,#c9a84c,#a8843c)",border:"none",color:"#0d0b08",padding:"14px 32px",borderRadius:8,fontSize:15,fontWeight:700,cursor:"pointer",width:"100%",letterSpacing:1,fontFamily:"'Lato',sans-serif" },

  // Confirm
  confirmCard: { maxWidth:500,margin:"0 auto",background:"#12100c",border:"1px solid #c9a84c",borderRadius:16,padding:40,textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:16 },
  confirmTitle: { fontFamily:"'Playfair Display',serif",fontSize:28,color:"#c9a84c",margin:0 },
  confirmBox: { width:"100%",background:"#0f0d0a",borderRadius:8,padding:16,border:"1px solid #1a1510" },

  // Admin
  loginWrap: { display:"flex",justifyContent:"center",padding:"60px 20px" },
  loginCard: { background:"#12100c",border:"1px solid #2a2118",borderRadius:16,padding:40,width:"100%",maxWidth:400,display:"flex",flexDirection:"column",gap:16 },
  adminWrap: { },
  adminTabs: { display:"flex",gap:4,marginBottom:28,borderBottom:"1px solid #2a2118",paddingBottom:0,flexWrap:"wrap" },
  adminTab: { background:"transparent",border:"none",borderBottom:"3px solid transparent",color:"#555",padding:"10px 18px",cursor:"pointer",fontSize:14,fontWeight:600,letterSpacing:.5,transition:"all .2s",marginBottom:-1 },
  adminTabActive: { color:"#c9a84c",borderBottom:"3px solid #c9a84c" },
  adminContent: { background:"#12100c",border:"1px solid #2a2118",borderRadius:12,padding:28 },
  sectionTitle: { fontFamily:"'Playfair Display',serif",fontSize:20,color:"#c9a84c",marginBottom:20,fontWeight:700,marginTop:0 },

  // Citas
  apptCard: { display:"flex",gap:16,background:"#0f0d0a",border:"1px solid #1e1a13",borderRadius:10,padding:16,alignItems:"flex-start" },
  apptDate: { textAlign:"center",minWidth:52 },
  apptDay: { color:"#c9a84c",fontWeight:700,fontSize:14,textTransform:"capitalize" },
  apptTime: { color:"#e8d5a3",fontWeight:700,fontSize:20,fontFamily:"'Playfair Display',serif" },
  apptInfo: { flex:1 },
  apptName: { color:"#e8d5a3",fontWeight:700,fontSize:16 },
  apptMeta: { color:"#777",fontSize:13,marginTop:2 },
  apptPhone: { color:"#666",fontSize:12,marginTop:4 },
  apptNotes: { color:"#555",fontSize:12,fontStyle:"italic",marginTop:2 },
  cancelBtn: { background:"#1e1a13",border:"1px solid #2a2118",color:"#e74c3c",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center" },
  filterBtn: { background:"#1a1510",border:"1px solid #2a2118",color:"#888",padding:"7px 20px",borderRadius:20,cursor:"pointer",fontSize:13 },
  filterBtnActive: { background:"#c9a84c",border:"1px solid #c9a84c",color:"#0d0b08",fontWeight:700 },

  // Horarios
  dayRow: { display:"flex",alignItems:"flex-start",gap:16,padding:"14px 0",borderBottom:"1px solid #1a1510",flexWrap:"wrap" },
  dayToggle: { display:"flex",alignItems:"center",gap:10,minWidth:140 },
  toggle: { cursor:"pointer",display:"flex",alignItems:"center" },
  toggleTrack: { width:44,height:24,borderRadius:12,position:"relative",transition:"background .2s",cursor:"pointer" },
  toggleThumb: { position:"absolute",top:2,width:20,height:20,background:"white",borderRadius:"50%",transition:"left .2s" },
  dayConfig: { flex:1,display:"flex",flexDirection:"column",gap:4 },
  timeInput: { background:"#1a1510",border:"1px solid #2a2118",color:"#e8d5a3",padding:"6px 10px",borderRadius:6,fontSize:14,outline:"none",fontFamily:"'Lato',sans-serif" },
  timeInputSm: { background:"#1a1510",border:"1px solid #2a2118",color:"#e8d5a3",padding:"4px 8px",borderRadius:6,fontSize:13,outline:"none",fontFamily:"'Lato',sans-serif" },
  addBreakBtn: { background:"transparent",border:"1px dashed #2a2118",color:"#555",padding:"4px 12px",borderRadius:6,cursor:"pointer",fontSize:12,width:"fit-content" },
  removeBtn: { background:"#1a1510",border:"1px solid #2a2118",color:"#e74c3c",width:24,height:24,borderRadius:"50%",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 },
  select: { background:"#1a1510",border:"1px solid #2a2118",color:"#e8d5a3",padding:"6px 10px",borderRadius:6,fontSize:14,outline:"none" },

  // Festivos
  closureRow: { display:"flex",alignItems:"center",gap:12,background:"#0f0d0a",border:"1px solid #1e1a13",borderRadius:8,padding:"12px 16px" },
  btnGold: { background:"linear-gradient(135deg,#c9a84c,#a8843c)",border:"none",color:"#0d0b08",padding:"10px 20px",borderRadius:8,fontWeight:700,cursor:"pointer",fontSize:14,fontFamily:"'Lato',sans-serif",whiteSpace:"nowrap" },

  // Barberos
  barberRow: { display:"flex",alignItems:"center",gap:16,background:"#0f0d0a",border:"1px solid #1e1a13",borderRadius:10,padding:"16px 20px" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Lato:wght@400;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  .fadeIn { animation: fadeIn .4s ease; }
  .calDayHover:hover { background: #2a2118 !important; border-color: #c9a84c !important; transform: scale(1.05); }
  .serviceHover:hover { border-color: #c9a84c !important; transform: translateX(4px); }
  input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
  input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.7); }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #0d0b08; }
  ::-webkit-scrollbar-thumb { background: #2a2118; border-radius: 3px; }
  select option { background: #1a1510; }
`;
