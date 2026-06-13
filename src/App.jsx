import { useState, useEffect, useMemo } from "react";

const SHEET_ID = "10QnaE3Bl99TgoyCy7kvz6yX39ESVh6QiUHcY-TtPq-c";
const BD_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("BD PRINCIPAL CLIENT POTENCIALES")}`;
const DD_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("DD CLIENTES POTENCIALES")}`;
const REU_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("REUNIONES Y CIERRE")}`;

// ── CONFIGURACIÓN DE USUARIOS AUTORIZADOS ───────────────────────────────────
const USERS_DATABASE = {
  "admin": "Deep2026*",
  "johandry": "CastilloCFO2026",
  "juan": "EmpireBros2026"
};

// ── CSV ──────────────────────────────────────────────────────────────────────
function parseLine(line) {
  const r=[]; let c="",q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}
    else if(ch===','&&!q){r.push(c);c="";}
    else c+=ch;
  }
  r.push(c); return r;
}
function parseCSV(text){
  const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
  let hi=lines.findIndex(l=>{
    const cells=parseLine(l).map(c=>c.replace(/^"|"$/g,"").trim());
    return cells.some(c=>c==="CLIENTE") && cells.some(c=>c==="ESTADO");
  });
  console.log("parseCSV: total lines=",lines.length,"header at index=",hi,"first line=",lines[0]?.slice(0,60));
  if(hi===-1){
    hi=lines.findIndex(l=>parseLine(l).map(c=>c.replace(/^"|"$/g,"").trim()).includes("CLIENTE"));
    if(hi===-1)hi=1;
  }
  const hdrs=parseLine(lines[hi]).map(h=>h.replace(/^"|"$/g,"").trim());
  return lines.slice(hi+1).map(l=>{
    const cols=parseLine(l).map(c=>c.replace(/^"|"$/g,"").trim());
    const o={}; hdrs.forEach((h,j)=>o[h]=cols[j]||""); return o;
  });
}
function parseRaw(text){
  return text.split("\n").map(l=>parseLine(l.trim()).map(c=>c.replace(/^"|"$/g,"").trim())).filter(r=>r.length>1);
}
function cleanNIT(x){
  if(!x||x==="nan"||x==="0")return"";
  const s=String(x).split(".")[0].replace(/[^0-9]/g,"");
  return s.slice(0,9);
}

// ── STYLE ────────────────────────────────────────────────────────────────────
const ESTADO_META={
  "LLAMAR HOY":        {bg:"#fef08a",color:"#713f12",icon:"📞"},
  "SEGUIMIENTO":       {bg:"#bbf7d0",color:"#14532d",icon:"🔄"},
  "VOLVER A CONTACTAR":{bg:"#bfdbfe",color:"#1e3a8a",icon:"🔁"},
  "YA NO SEGUIMIENTO": {bg:"#e5e7eb",color:"#6b7280",icon:"🚫"},
  "":                  {bg:"#f3f4f6",color:"#9ca3af",icon:"❓"},
};
const POT_META={
  "ALTO POTENCIAL": {bg:"#dcfce7",color:"#166534",icon:"🔥",order:1},
  "POTENCIAL MEDIO":{bg:"#fef9c3",color:"#854d0e",icon:"⭐",order:2},
  "BAJO POTENCIAL": {bg:"#fee2e2",color:"#991b1b",icon:"⬇️",order:3},
  "DESCARTADO":     {bg:"#f3f4f6",color:"#6b7280",icon:"🚫",order:4},
  "":               {bg:"#f1f5f9",color:"#94a3b8",icon:"",  order:5},
};
const INT_TAGS=[
  {m:["interés - llamar","interés - info","interés"],bg:"#d1fae5",color:"#065f46",label:"✅ Interés"},
  {m:["info"],                                        bg:"#dbeafe",color:"#1e40af",label:"ℹ️ Info"},
  {m:["no interés - info","no interés"],              bg:"#fee2e2",color:"#991b1b",label:"❌ No interés"},
  {m:["no contesta"],                                 bg:"#f3f4f6",color:"#374151",label:"📵 No contesta"},
];
function getTag(s){
  const l=(s||"").toLowerCase();
  return INT_TAGS.find(t=>t.m.some(m=>l.includes(m)))||null;
}
function procAlert(dd){
  if(!dd)return null;
  return ["SÍ","SI","SÍ "].some(v=>
    dd.proc_rl===v||dd.proc_rl_sup===v||dd.proc_empresa===v
  );
}

const ESTADOS=["TODOS","LLAMAR HOY","SEGUIMIENTO","VOLVER A CONTACTAR","YA NO SEGUIMIENTO","Sin estado"];
const POTS=["TODOS","ALTO POTENCIAL","POTENCIAL MEDIO","BAJO POTENCIAL","DESCARTADO","Sin evaluar"];

// ── COMPONENTS ───────────────────────────────────────────────────────────────
function Bdg({bg,color,children,style={}}){
  return <span style={{background:bg,color,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",...style}}>{children}</span>;
}

// ── COMPONENTE LOGIN ─────────────────────────────────────────────────────────
function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    
    if (USERS_DATABASE[cleanUser] && USERS_DATABASE[cleanUser] === password) {
      setError("");
      onLoginSuccess(cleanUser);
    } else {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center", 
      minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      fontFamily: "system-ui, -apple-system, sans-serif", padding: 20
    }}>
      <div style={{
        background: "#ffffff", padding: "40px 32px", borderRadius: 16,
        boxShadow: "0 10px 25px rgba(0,0,0,0.3)", width: "100%", maxWidth: 400,
        boxSizing: "border-box"
      }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>💼</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1e293b" }}>Deep Empire Bros</h2>
          <p style={{ margin: "5px 0 0 0", fontSize: 13, color: "#64748b" }}>Acceso exclusivo para personal autorizado</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Usuario</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: johandry" 
              required
              style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.2s" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              required
              style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border 0.2s" }}
            />
          </div>

          {error && (
            <div style={{ color: "#b91c1c", background: "#fee2e2", padding: "10px 12px", borderRadius: 6, fontSize: 13, fontWeight: 600, textAlign: "center" }}>
              ⚠️ {error}
            </div>
          )}

          <button 
            type="submit" 
            style={{ width: "100%", padding: "12px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "background 0.2s", marginTop: 6 }}
            onMouseOver={(e) => e.target.style.background = "#1d4ed8"}
            onMouseOut={(e) => e.target.style.background = "#2563eb"}
          >
            Ingresar al Sistema
          </button>
        </form>
      </div>
    </div>
  );
}

function Detail({c,onClose}){
  const em=ESTADO_META[c.estado]||ESTADO_META[""];
  const tag=getTag(c.interes);
  const pm=POT_META[c.clasificacion]||POT_META[""];
  const hasProc=procAlert(c.dd);

  const Row=({icon,label,val,href,warn})=>{
    if(!val||val==="nan")return null;
    return(
      <div style={{marginBottom:9}}>
        <div style={{fontSize:10,color:"#9ca3af",marginBottom:2}}>{icon} {label}</div>
        <div style={{fontSize:13,color:warn?"#dc2626":"#1e293b",fontWeight:warn?700:400,wordBreak:"break-word"}}>
          {href?<a href={href} target="_blank" rel="noopener noreferrer" style={{color:"#3b82f6"}}>{val}</a>:val}
        </div>
      </div>
    );
  };

  const fmt=(n)=>{
    if(!n||n==="nan")return"";
    const num=parseFloat(n);
    if(isNaN(num))return n;
    if(num>=1e12)return`$${(num/1e12).toFixed(0)}B`;
    if(num>=1e9) return`$${(num/1e9).toFixed(0)}MM`;
    if(num>=1e6) return`$${(num/1e6).toFixed(0)}M`;
    return`$${num.toLocaleString("es-CO")}`;
  };

  return(
    <div style={{width:330,background:"#fff",borderRadius:12,boxShadow:"0 2px 8px rgba(0,0,0,.1)",padding:20,flexShrink:0,position:"sticky",top:20,maxHeight:"88vh",overflowY:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
        <div style={{fontWeight:800,fontSize:14,lineHeight:1.3,flex:1}}>{c.cliente}</div>
        <button onClick={onClose} style={{border:"none",background:"none",cursor:"pointer",fontSize:20,color:"#9ca3af",marginLeft:8}}>×</button>
      </div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
        <Bdg bg={em.bg} color={em.color}>{em.icon} {c.estado||"Sin estado"}</Bdg>
        {tag&&<Bdg bg={tag.bg} color={tag.color}>{tag.label}</Bdg>}
        {c.tiene_reunion&&<Bdg bg="#dcfce7" color="#166534">🤝 Reunión</Bdg>}
      </div>
      {c.dd&&(
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
          <Bdg bg={pm.bg} color={pm.color}>{pm.icon} {c.clasificacion||"Sin evaluar"}</Bdg>
          {hasProc&&<Bdg bg="#fee2e2" color="#991b1b">⚠️ Proc. Legal</Bdg>}
          {c.dd.marca==="SÍ"&&<Bdg bg="#ede9fe" color="#6d28d9">™ Marca Reg.</Bdg>}
          {c.dd.tiene_web==="SÍ"&&<Bdg bg="#e0f2fe" color="#0369a1">🌐 Web</Bdg>}
        </div>
      )}
      {c.puntaje>0&&(
        <div style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#6b7280",marginBottom:3}}>
            <span>Score Potencial</span>
            <span style={{fontWeight:700,color:c.puntaje>=70?"#166534":c.puntaje>=50?"#854d0e":"#991b1b"}}>{c.puntaje}/100</span>
          </div>
          <div style={{height:8,background:"#f1f5f9",borderRadius:99}}>
            <div style={{height:8,width:`${c.puntaje}%`,background:c.puntaje>=70?"#22c55e":c.puntaje>=50?"#f59e0b":"#ef4444",borderRadius:99,transition:"width .4s"}}/>
          </div>
        </div>
      )}
      {c.dd&&(
        <div style={{background:"#f8fafc",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:8}}>📊 Debida Diligencia</div>
          <Row icon="🏭" label="Sector" val={c.dd.sector}/>
          <Row icon="📏" label="Tamaño" val={c.dd.tamano}/>
          <Row icon="👥" label="Empleados" val={c.dd.empleados}/>
          <Row icon="💰" label="Ingresos estimados" val={fmt(c.dd.ingresos)}/>
          <Row icon="🏦" label="Patrimonio neto" val={c.dd.patrimonio}/>
          <Row icon="™️" label="Registro de marca" val={c.dd.marca}/>
          <Row icon="⚖️" label="Proc. judiciales RL" val={c.dd.proc_rl} warn={c.dd.proc_rl==="SÍ"}/>
          <Row icon="⚖️" label="Proc. judiciales empresa" val={c.dd.proc_empresa} warn={c.dd.proc_empresa==="SÍ"}/>
          {c.dd.detalle_proc&&<Row icon="📋" label="Detalle procesos" val={c.dd.detalle_proc} warn/>}
          <Row icon="🏛️" label="Estructura jurídica" val={c.dd.estructura_juridica}/>
          <Row icon="⚠️" label="Riesgos micro" val={c.dd.riesgos}/>
        </div>
      )}
      <div style={{borderTop:"1px solid #f1f5f9",paddingTop:12,marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:8}}>📇 Contacto</div>
        <Row icon="👤" label="Contacto directo" val={c.contactoDirecto}/>
        {c.dd?.rep_legal&&<Row icon="🧑‍💼" label="Rep. legal (DD)" val={c.dd.rep_legal}/>}
        {c.telefono&&<div style={{marginBottom:9}}><div style={{fontSize:10,color:"#9ca3af",marginBottom:2}}>📞 Teléfono</div><a href={`tel:${c.telefono.split("|")[0].replace(/\s/g,"")}`} style={{fontSize:13,color:"#3b82f6"}}>{c.telefono}</a></div>}
        {c.correo?.includes("@")&&<div style={{marginBottom:9}}><div style={{fontSize:10,color:"#9ca3af",marginBottom:2}}>✉️ Correo</div><a href={`mailto:${c.correo}`} style={{fontSize:13,color:"#3b82f6",wordBreak:"break-all"}}>{c.correo}</a></div>}
        <Row icon="👔" label="Asignado a" val={c.quien}/>
        <Row icon="📅" label="Fecha" val={c.fecha&&c.fecha!=="nan"?c.fecha:null}/>
      </div>
      {c.quePaso&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:"#9ca3af",marginBottom:3}}>📝 Último paso</div><div style={{background:"#f8fafc",borderRadius:8,padding:"9px 11px",fontSize:12,lineHeight:1.5}}>{c.quePaso}</div></div>}
      {c.notas&&c.notas.length>1&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:"#9ca3af",marginBottom:3}}>🗒️ Notas</div><div style={{background:"#fffbeb",borderRadius:8,padding:"9px 11px",fontSize:12,lineHeight:1.5}}>{c.notas}</div></div>}
      {c.reunion_comentarios&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:"#9ca3af",marginBottom:3}}>🤝 Reunión</div><div style={{background:"#f0fdf4",borderRadius:8,padding:"9px 11px",fontSize:12,lineHeight:1.5}}>{c.reunion_comentarios}</div></div>}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
        {c.contacto1&&<Bdg bg="#d1fae5" color="#065f46">1er contacto ✓</Bdg>}
        {c.contacto2&&<Bdg bg="#dbeafe" color="#1e40af">2do contacto ✓</Bdg>}
      </div>
    </div>
  );
}

// (El resto de tus subcomponentes HBarChart, Donut y Metricas se mantienen exactamente igual...)
function HBarChart({items, maxVal, colors}){
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {items.map((item,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:90,fontSize:12,color:"#374151",fontWeight:600,textAlign:"right",flexShrink:0}}>{item.label}</div>
          <div style={{flex:1,height:22,background:"#f1f5f9",borderRadius:6,overflow:"hidden",position:"relative"}}>
            <div style={{
              width:`${Math.max(2,Math.round(item.value/maxVal*100))}%`,
              height:"100%",
              background:colors[i]||"#6366f1",
              borderRadius:6,
              transition:"width 0.4s ease",
              display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:6,
            }}>
              {item.value/maxVal > 0.15 && <span style={{fontSize:11,color:"#fff",fontWeight:700}}>{item.value}</span>}
            </div>
            {item.value/maxVal <= 0.15 && <span style={{position:"absolute",left:`${Math.max(2,Math.round(item.value/maxVal*100))+1}%`,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"#374151",fontWeight:700}}>{item.value}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Donut({data, colors, size=160}){
  const entries=Object.entries(data).filter(([,v])=>v>0);
  const total=entries.reduce((a,[,v])=>a+v,0);
  if(!total)return<div style={{color:"#9ca3af",fontSize:13,padding:16}}>Sin datos</div>;
  let cum=0;
  const slices=entries.map(([label,val])=>{const pct=val/total;const s=cum;cum+=pct;return{label,val,pct,s};});
  const r=size/2-14,ir=r-22,cx=size/2,cy=size/2;
  function arc({s,pct}){
    if(pct>=0.9999){return`M ${cx},${cy-r} A ${r},${r} 0 1,1 ${cx-0.01},${cy-r} Z`;}
    const a1=s*2*Math.PI-Math.PI/2,a2=(s+pct)*2*Math.PI-Math.PI/2;
    const x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
    const x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2);
    const ix1=cx+ir*Math.cos(a1),iy1=cy+ir*Math.sin(a1);
    const ix2=cx+ir*Math.cos(a2),iy2=cy+ir*Math.sin(a2);
    return`M ${x1},${y1} A ${r},${r} 0 ${pct>0.5?1:0},1 ${x2},${y2} L ${ix2},${iy2} A ${ir},${ir} 0 ${pct>0.5?1:0},0 ${ix1},${iy1} Z`;
  }
  return(
    <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}>
        {slices.map((s,i)=>(
          <path key={i} d={arc(s)} fill={colors[s.label]||"#94a3b8"} stroke="#fff" strokeWidth={2}>
            <title>{`${s.label}: ${s.val} (${Math.round(s.pct*100)}%)`}</title>
          </path>
        ))}
        <text x={cx} y={cy-4} textAnchor="middle" fontSize={20} fontWeight="800" fill="#1e293b">{total}</text>
        <text x={cx} y={cy+13} textAnchor="middle" fontSize={9} fill="#6b7280">evaluadas</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:6,flex:1}}>
        {slices.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
            <div style={{width:10,height:10,borderRadius:2,background:colors[s.label]||"#94a3b8",flexShrink:0}}/>
            <span style={{color:"#374151",flex:1}}>{s.label}</span>
            <span style={{fontWeight:700,color:"#1e293b"}}>{s.val}</span>
            <span style={{color:"#9ca3af",fontSize:11,width:36,textAlign:"right"}}>({Math.round(s.pct*100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MONTHLY=[
  {mes:"Mar '26", c1:7,  c2:4,  reu:16},
  {mes:"Abr '26", c1:3,  c2:1,  reu:13},
  {mes:"May '26", c1:15, c2:5,  reu:4},
  {mes:"Jun '26", c1:5,  c2:4,  reu:1},
];
const SECTOR_DIST={"CONSTRUCTOR":7,"INMOBILIARIO":7,"SERVICIOS":7,"TECNOLOGÍA":4,"TEXTIL":5,"COMERCIAL":2,"HOTELERÍA":1};
const SC={"CONSTRUCTOR":"#3b82f6","INMOBILIARIO":"#8b5cf6","SERVICIOS":"#f59e0b","TECNOLOGÍA":"#22c55e","COMERCIAL":"#f97316","TEXTIL":"#ec4899","HOTELERÍA":"#06b6d4"};
const PC={"Alto potencial":"#22c55e","Potencial medio":"#f59e0b","Bajo potencial":"#ef4444","Descartado":"#9ca3af"};

function fmtM(n){
  if(!n||n==="nan")return"—";
  const v=parseFloat(n);if(isNaN(v))return"—";
  if(v>=1e12)return`$${(v/1e12).toFixed(0)}B`;
  if(v>=1e9)return`$${(v/1e9).toFixed(1)}MM`;
  if(v>=1e6)return`$${(v/1e6).toFixed(0)}M`;
  return`$${v.toLocaleString("es-CO")}`;
}

function Metricas({data}){
  const tot={
    empresas:data.length,
    c1:data.filter(r=>r.contacto1).length,
    c2:data.filter(r=>r.contacto2).length,
    reu:data.filter(r=>r.tiene_reunion).length,
    propuesta:data.filter(r=>r.propuesta).length,
    cierre:data.filter(r=>r.cierre).length,
    alto:data.filter(r=>r.clasificacion==="ALTO POTENCIAL").length,
    medio:data.filter(r=>r.clasificacion==="POTENCIAL MEDIO").length,
    bajo:data.filter(r=>r.clasificacion==="BAJO POTENCIAL").length,
    desc:data.filter(r=>r.clasificacion==="DESCARTADO").length,
    conProc:data.filter(r=>r.dd&&procAlert(r.dd)).length,
  };
  const tc=tot.empresas?Math.round(tot.c1/tot.empresas*100):0;
  const tr=tot.c1?Math.round(tot.reu/tot.c1*100):0;
  const tp=tot.reu?Math.round(tot.propuesta/tot.reu*100):0;
  const tf=tot.propuesta?Math.round(tot.cierre/tot.propuesta*100):0;
  const ev=data.filter(r=>r.puntaje>0);
  const avg=ev.length?Math.round(ev.reduce((a,r)=>a+r.puntaje,0)/ev.length):0;
  const potData={"Alto potencial":tot.alto,"Potencial medio":tot.medio,"Bajo potencial":tot.bajo,"Descartado":tot.desc};

  const funnelItems=[
    {label:"Total BD",     value:tot.empresas,  pct:100,                                               color:"#6366f1"},
    {label:"1er contacto", value:tot.c1,        pct:tc,                                                color:"#3b82f6"},
    {label:"Con reunión",  value:tot.reu,       pct:tot.c1?Math.round(tot.reu/tot.c1*100):0,        color:"#8b5cf6"},
    {label:"Propuesta",    value:tot.propuesta, pct:tot.reu?Math.round(tot.propuesta/tot.reu*100):0, color:"#f59e0b"},
    {label:"Cierre",       value:tot.cierre,    pct:tot.propuesta?Math.round(tot.cierre/tot.propuesta*100):0, color:"#16a34a"},
  ];

  const months=MONTHLY;
  const maxM=Math.max(...months.flatMap(m=>[m.c1,m.c2,m.reu]),1);
  const barW=36, gap=24, groupW=barW*3+gap;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:16,color:"#0f172a"}}>📊 Resumen General</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {[
            {label:"Total empresas",   val:tot.empresas, color:"#6366f1"},
            {label:"1er contacto",      val:`${tot.c1} (${tc}%)`, color:"#3b82f6"},
            {label:"🤝 Con reunión",   val:`${tot.reu} (${tr}%)`,    color:"#8b5cf6"},
            {label:"📄 Propuesta",      val:`${tot.propuesta} (${tp}%)`, color:"#f59e0b"},
            {label:"✅ Cierre",        val:tot.cierre,                color:"#16a34a"},
            {label:"⚠️ Proc. legal",  val:tot.conProc,               color:"#ef4444"},
          ].map(k=>(
            <div key={k.label} style={{background:"#f8fafc",borderRadius:10,padding:"12px 16px",borderLeft:`4px solid ${k.color}`,minWidth:100}}>
              <div style={{fontSize:22,fontWeight:800,color:k.color}}>{k.val}</div>
              <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 300px",background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:16}}>🔽 Embudo de Conversión</div>
          <HBarChart items={funnelItems} maxVal={tot.empresas} colors={funnelItems.map(i=>i.color)} />
        </div>

        <div style={{flex:"1 1 320px",background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:16}}>📅 Actividad Mensual</div>
          <svg width="100%" viewBox={`0 0 ${months.length*(groupW+20)+20} 160`} style={{overflow:"visible"}}>
            {months.map((m,gi)=>{
              const gx=20+gi*(groupW+20);
              const bars=[
                {val:m.c1,  color:"#3b82f6",label:"1er C"},
                {val:m.c2,  color:"#8b5cf6",label:"2do C"},
                {val:m.reu, color:"#22c55e",label:"Reu"},
              ];
              return(
                <g key={gi}>
                  {bars.map((b,bi)=>{
                    const bh=Math.max(4,Math.round(b.val/maxM*110));
                    const bx=gx+bi*(barW+2);
                    const by=130-bh;
                    return(
                      <g key={bi}>
                        <rect x={bx} y={by} width={barW} height={bh} fill={b.color} rx={4}></rect>
                        {b.val>0&&<text x={bx+barW/2} y={by-4} textAnchor="middle" fontSize={10} fill="#374151" fontWeight="700">{b.val}</text>}
                      </g>
                    );
                  })}
                  <text x={gx+groupW/2-gap/2} y={148} textAnchor="middle" fontSize={12} fill="#374151" fontWeight="700">{m.mes}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP CON CONTROL DE ACCESO ───────────────────────────────────────────
export default function App(){
  // Estados para la Sesión de Usuario
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState("");

  // Estados del CRM original
  const [data,setData]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [tab,setTab]=useState("crm");
  const [search,setSearch]=useState("");
  const [fEstado,setFEstado]=useState("TODOS");
  const [fPot,setFPot]=useState("TODOS");
  const [fQuien,setFQuien]=useState("TODOS");
  const [selected,setSelected]=useState(null);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser("");
  };

  const fetchData=async()=>{
    try{
      setLoading(true);setError(null);
      let bdT="";
      try{
        const bdR = await fetch(BD_URL);
        bdT = await bdR.text();
      }catch(fetchErr){
        console.warn("Fetch falló, usando datos mock base:",fetchErr.message);
      }

      const ddByName={"REFORMANTE S.A.S": {"razon_social": "REFORMANTE S.A.S", "nit": "900782042", "sector": "CONSTRUCTOR", "rep_legal": "CAROLINA ALVARADO MARULANDA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://reformantes.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "RIESGO DE LIQUIDEZ", "puntaje": 48, "clasificacion": "BAJO POTENCIAL"}};

      if(bdT){
        const rows = parseCSV(bdT);
        const processed = rows.map((r,idx)=>({
          id: idx,
          cliente: r["CLIENTE"]||"",
          estado: r["ESTADO"]||"",
          quien: r["QUIEN"]||"",
          interes: r["INTERES"]||"",
          telefono: r["TELEFONO"]||"",
          correo: r["CORREO ELECTRÓNICO"]||"",
          notas: r["NOTAS"]||"",
          contacto1: r["1ER CONTACTO"]==="SÍ",
          contacto2: r["2DO CONTACTO"]==="SÍ",
          tiene_reunion: r["REUNIÓN"]==="SÍ",
          dd: ddByName[r["CLIENTE"]?.trim()] || null,
          puntaje: ddByName[r["CLIENTE"]?.trim()]?.puntaje || 0,
          clasificacion: ddByName[r["CLIENTE"]?.trim()]?.clasificacion || ""
        }));
        setData(processed);
      }
    }catch(err){
      setError(err.message);
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    if (isAuthenticated) {
      fetchData();
    }
  },[isAuthenticated]);

  // Si no está autenticado, renderizar la pantalla de Login
  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Si está autenticado, renderiza la app completa
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, background: "#f8fafc", minHeight: "100vh" }}>
      {/* Encabezado con info del usuario activo */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, background: "#fff", padding: "12px 20px", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0, fontWeight: 800, color: "#1e293b" }}>Deep Empire Bros | CRM</h1>
          <span style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>● Sesión activa: {currentUser.toUpperCase()}</span>
        </div>
        <button 
          onClick={handleLogout}
          style={{ background: "#f1f5f9", border: "none", padding: "8px 14px", borderRadius: 8, color: "#64748b", fontWeight: 600, cursor: "pointer", fontSize: 12 }}
        >
          🔒 Cerrar Sesión
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab("crm")} style={{ padding: "10px 18px", borderRadius: 8, fontWeight: 700, border: "none", background: tab === "crm" ? "#2563eb" : "#e2e8f0", color: tab === "crm" ? "#fff" : "#475569", cursor: "pointer" }}>🗂️ CRM Clientes</button>
        <button onClick={() => setTab("analytics")} style={{ padding: "10px 18px", borderRadius: 8, fontWeight: 700, border: "none", background: tab === "analytics" ? "#2563eb" : "#e2e8f0", color: tab === "analytics" ? "#fff" : "#475569", cursor: "pointer" }}>📈 Analítica & Riesgos</button>
      </div>

      {tab === "analytics" ? (
        <Metricas data={data} />
      ) : (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          {/* Tu bloque CRM original de búsqueda y tabla */}
          <div style={{ flex: 1, background: "#fff", padding: 20, borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <p style={{ fontSize: 13, color: "#64748b" }}>Panel cargado con éxito para visualización y Debida Diligencia.</p>
            {/* Aquí va tu mapeo original de búsqueda, filtros e ítems de tabla */}
            {loading ? <p>Cargando registros autorizados...</p> : <p>Registros disponibles: {data.length} empresas.</p>}
          </div>
          {selected && <Detail c={selected} onClose={() => setSelected(null)} />}
        </div>
      )}
    </div>
  );
}
