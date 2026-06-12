import { useState, useEffect, useMemo } from "react";

const SHEET_ID = "10QnaE3Bl99TgoyCy7kvz6yX39ESVh6QiUHcY-TtPq-c";
const BD_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("BD PRINCIPAL CLIENT POTENCIALES")}`;
const DD_URL  = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("DD CLIENTES POTENCIALES")}`;
const REU_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("REUNIONES Y CIERRE")}`;

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
  let hi=lines.findIndex(l=>l.includes("CLIENTE")&&l.includes("ESTADO"));
  if(hi===-1)hi=1;
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
  if(!x||x==="nan")return"";
  return x.replace(/[^0-9]/g,"").slice(0,9);
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
  const bad=["SÍ","SI","SÍ "].some(v=>
    dd.proc_rl===v||dd.proc_rl_sup===v||dd.proc_empresa===v
  );
  return bad;
}

const ESTADOS=["TODOS","LLAMAR HOY","SEGUIMIENTO","VOLVER A CONTACTAR","YA NO SEGUIMIENTO","Sin estado"];
const POTS=["TODOS","ALTO POTENCIAL","POTENCIAL MEDIO","BAJO POTENCIAL","DESCARTADO","Sin evaluar"];

// ── COMPONENTS ───────────────────────────────────────────────────────────────
function Bdg({bg,color,children,style={}}){
  return <span style={{background:bg,color,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",...style}}>{children}</span>;
}
function KPI({label,value,color,sub}){
  return(
    <div style={{background:"#fff",borderRadius:12,padding:"14px 18px",boxShadow:"0 1px 4px rgba(0,0,0,.08)",borderLeft:`4px solid ${color}`,minWidth:110}}>
      <div style={{fontSize:26,fontWeight:800,color}}>{value}</div>
      <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{label}</div>
      {sub&&<div style={{fontSize:10,color:"#9ca3af",marginTop:1}}>{sub}</div>}
    </div>
  );
}

// ── DETAIL PANEL ─────────────────────────────────────────────────────────────
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

      {/* Badges fila 1 */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
        <Bdg bg={em.bg} color={em.color}>{em.icon} {c.estado||"Sin estado"}</Bdg>
        {tag&&<Bdg bg={tag.bg} color={tag.color}>{tag.label}</Bdg>}
        {c.tiene_reunion&&<Bdg bg="#dcfce7" color="#166534">🤝 Reunión</Bdg>}
      </div>

      {/* Badges fila 2 — DD */}
      {c.dd&&(
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}}>
          <Bdg bg={pm.bg} color={pm.color}>{pm.icon} {c.clasificacion||"Sin evaluar"}</Bdg>
          {hasProc&&<Bdg bg="#fee2e2" color="#991b1b">⚠️ Proc. Legal</Bdg>}
          {c.dd.marca==="SÍ"&&<Bdg bg="#ede9fe" color="#6d28d9">™ Marca Reg.</Bdg>}
          {c.dd.tiene_web==="SÍ"&&<Bdg bg="#e0f2fe" color="#0369a1">🌐 Web</Bdg>}
        </div>
      )}

      {/* Score bar */}
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

      {/* DD info */}
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

      {/* Contacto */}
      <div style={{borderTop:"1px solid #f1f5f9",paddingTop:12,marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:"#475569",marginBottom:8}}>📇 Contacto</div>
        <Row icon="👤" label="Contacto directo" val={c.contactoDirecto}/>
        {c.dd?.rep_legal&&<Row icon="🧑‍💼" label="Rep. legal (DD)" val={c.dd.rep_legal}/>}
        {c.telefono&&<div style={{marginBottom:9}}><div style={{fontSize:10,color:"#9ca3af",marginBottom:2}}>📞 Teléfono</div><a href={`tel:${c.telefono.split("|")[0].replace(/\s/g,"")}`} style={{fontSize:13,color:"#3b82f6"}}>{c.telefono}</a></div>}
        {c.correo?.includes("@")&&<div style={{marginBottom:9}}><div style={{fontSize:10,color:"#9ca3af",marginBottom:2}}>✉️ Correo</div><a href={`mailto:${c.correo}`} style={{fontSize:13,color:"#3b82f6",wordBreak:"break-all"}}>{c.correo}</a></div>}
        <Row icon="👔" label="Asignado a" val={c.quien}/>
        <Row icon="📅" label="Fecha" val={c.fecha&&c.fecha!=="nan"?c.fecha:null}/>
      </div>

      {/* Novedades */}
      {c.quePaso&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:"#9ca3af",marginBottom:3}}>📝 Último paso</div><div style={{background:"#f8fafc",borderRadius:8,padding:"9px 11px",fontSize:12,lineHeight:1.5}}>{c.quePaso}</div></div>}
      {c.notas&&c.notas.length>1&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:"#9ca3af",marginBottom:3}}>🗒️ Notas</div><div style={{background:"#fffbeb",borderRadius:8,padding:"9px 11px",fontSize:12,lineHeight:1.5}}>{c.notas}</div></div>}
      {c.reunion_comentarios&&<div style={{marginBottom:10}}><div style={{fontSize:10,color:"#9ca3af",marginBottom:3}}>🤝 Reunión</div><div style={{background:"#f0fdf4",borderRadius:8,padding:"9px 11px",fontSize:12,lineHeight:1.5}}>{c.reunion_comentarios}</div></div>}

      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
        {c.contacto1&&<Bdg bg="#d1fae5" color="#065f46">1er contacto ✓</Bdg>}
        {c.contacto2&&<Bdg bg="#dbeafe" color="#1e40af">2do contacto ✓</Bdg>}
      </div>

      {(c.rues?.startsWith("http")||c.emis?.startsWith("http"))&&(
        <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #f1f5f9",display:"flex",gap:8,flexWrap:"wrap"}}>
          {c.rues?.startsWith("http")&&<a href={c.rues} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#7c3aed",background:"#ede9fe",borderRadius:6,padding:"4px 10px",textDecoration:"none",fontWeight:600}}>🔗 RUES</a>}
          {c.emis?.startsWith("http")&&<a href={c.emis} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#0369a1",background:"#e0f2fe",borderRadius:6,padding:"4px 10px",textDecoration:"none",fontWeight:600}}>📊 EMIS</a>}
          {c.dd?.url_web&&c.dd.url_web.startsWith("http")&&<a href={c.dd.url_web} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#065f46",background:"#dcfce7",borderRadius:6,padding:"4px 10px",textDecoration:"none",fontWeight:600}}>🌐 Web</a>}
        </div>
      )}
    </div>
  );
}

// ── MÉTRICAS ─────────────────────────────────────────────────────────────────
const MONTHLY_DATA=[{"mes":"2026-03","empresas":7,"contacto1":7,"contacto2":4,"reuniones":9},{"mes":"2026-04","empresas":6,"contacto1":3,"contacto2":1,"reuniones":14},{"mes":"2026-05","empresas":20,"contacto1":15,"contacto2":5,"reuniones":1},{"mes":"2026-06","empresas":18,"contacto1":5,"contacto2":4,"reuniones":0}];
const SECTOR_DATA={"CONSTRUCTOR":6,"HOTELERÍA":1,"INMOBILIARIO":5,"TECNOLOGÍA":4,"SERVICIOS":5,"COMERCIAL":3,"TEXTIL":1};
const SECTOR_COLORS={"CONSTRUCTOR":"#3b82f6","INMOBILIARIO":"#8b5cf6","SERVICIOS":"#f59e0b","TECNOLOGÍA":"#22c55e","COMERCIAL":"#f97316","TEXTIL":"#ec4899","HOTELERÍA":"#06b6d4"};
const MESES={"01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun","07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic"};
const POT_COLORS={"ALTO POTENCIAL":"#22c55e","POTENCIAL MEDIO":"#f59e0b","BAJO POTENCIAL":"#ef4444","DESCARTADO":"#9ca3af"};

function DonutChart({dataObj, colors, size=180}){
  const entries = Object.entries(dataObj).filter(([,v])=>v>0);
  const total = entries.reduce((a,[,v])=>a+v,0);
  if(!total) return <div style={{color:"#9ca3af",fontSize:13,padding:16}}>Sin datos</div>;
  let cum=0;
  const slices = entries.map(([label,val])=>{
    const pct=val/total; const start=cum; cum+=pct;
    return {label,val,pct,start};
  });
  const r=size/2-18, ir=r-26, cx=size/2, cy=size/2;
  function arc(s){
    if(s.pct>=0.9999){ // full circle — draw as two halves
      return `M ${cx},${cy-r} A ${r},${r} 0 1,1 ${cx-0.01},${cy-r} Z`;
    }
    const a1=s.start*2*Math.PI-Math.PI/2;
    const a2=(s.start+s.pct)*2*Math.PI-Math.PI/2;
    const x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
    const x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2);
    const ix1=cx+ir*Math.cos(a1),iy1=cy+ir*Math.sin(a1);
    const ix2=cx+ir*Math.cos(a2),iy2=cy+ir*Math.sin(a2);
    const lg=s.pct>0.5?1:0;
    return `M ${x1},${y1} A ${r},${r} 0 ${lg},1 ${x2},${y2} L ${ix2},${iy2} A ${ir},${ir} 0 ${lg},0 ${ix1},${iy1} Z`;
  }
  return(
    <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s,i)=>(
          <path key={i} d={arc(s)} fill={colors[s.label]||"#94a3b8"} stroke="#fff" strokeWidth={2}>
            <title>{`${s.label}: ${s.val} (${Math.round(s.pct*100)}%)`}</title>
          </path>
        ))}
        <text x={cx} y={cy-5} textAnchor="middle" fontSize={20} fontWeight="800" fill="#1e293b">{total}</text>
        <text x={cx} y={cy+12} textAnchor="middle" fontSize={9} fill="#6b7280">total</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {slices.map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:7,fontSize:12}}>
            <div style={{width:11,height:11,borderRadius:3,background:colors[s.label]||"#94a3b8",flexShrink:0}}/>
            <span style={{color:"#374151"}}>{s.label}</span>
            <span style={{fontWeight:700,color:"#1e293b",marginLeft:4}}>{s.val}</span>
            <span style={{color:"#9ca3af",fontSize:11}}>({Math.round(s.pct*100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metricas({data}){
  const byMonth = MONTHLY_DATA;
  const sectors = SECTOR_DATA;

  const tot={
    empresas: data.length,
    contacto1: data.filter(r=>r.contacto1).length,
    contacto2: data.filter(r=>r.contacto2).length,
    reuniones: byMonth.reduce((a,m)=>a+m.reuniones,0),
    alto:      data.filter(r=>r.clasificacion==="ALTO POTENCIAL").length,
    medio:     data.filter(r=>r.clasificacion==="POTENCIAL MEDIO").length,
    bajo:      data.filter(r=>r.clasificacion==="BAJO POTENCIAL").length,
    descartado:data.filter(r=>r.clasificacion==="DESCARTADO").length,
    conProc:   data.filter(r=>r.dd&&procAlert(r.dd)).length,
    conMarca:  data.filter(r=>r.dd&&r.dd.marca==="SÍ").length,
  };
  const tc = tot.empresas  ? Math.round(tot.contacto1/tot.empresas*100)  : 0;
  const tr = tot.contacto1 ? Math.round(tot.reuniones/tot.contacto1*100) : 0;
  const tf = tot.empresas  ? Math.round(tot.reuniones/tot.empresas*100)  : 0;

  const potData={
    "Alto potencial":  tot.alto,
    "Potencial medio": tot.medio,
    "Bajo potencial":  tot.bajo,
    "Descartado":      tot.descartado,
  };
  const potColors={"Alto potencial":"#22c55e","Potencial medio":"#f59e0b","Bajo potencial":"#ef4444","Descartado":"#9ca3af"};

  const evaluated = data.filter(r=>r.puntaje>0);
  const avgScore  = evaluated.length ? Math.round(evaluated.reduce((a,r)=>a+r.puntaje,0)/evaluated.length) : 0;
  const maxV = Math.max(...byMonth.map(m=>Math.max(m.empresas,m.reuniones,1)));

  const fmtI=(n)=>{
    if(!n||n==="nan") return "—";
    const v=parseFloat(n); if(isNaN(v)) return "—";
    if(v>=1e12) return `$${(v/1e12).toFixed(0)} Billones`;
    if(v>=1e9)  return `$${(v/1e9).toFixed(1)} MM`;
    if(v>=1e6)  return `$${(v/1e6).toFixed(0)} M`;
    return `$${v.toLocaleString("es-CO")}`;
  };

  return(
    <div>
      {/* ── KPIs ── */}
      <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.07)",marginBottom:20}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:16,color:"#0f172a"}}>📊 Métricas de Conversión</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:24}}>
          <KPI label="Total BD"          value={tot.empresas}   color="#6366f1"/>
          <KPI label="1er contacto"      value={tot.contacto1}  color="#3b82f6" sub={`${tc}% tasa contacto`}/>
          <KPI label="2do contacto"      value={tot.contacto2}  color="#8b5cf6" sub={`${tot.contacto1?Math.round(tot.contacto2/tot.contacto1*100):0}% de contactadas`}/>
          <KPI label="Con reunión"       value={tot.reuniones}  color="#22c55e" sub={`${tr}% de contactadas`}/>
          <KPI label="Llamada → Reunión" value={`${tf}%`}       color="#f59e0b" sub="tasa cierre global"/>
          <KPI label="⚠️ Proc. legal"   value={tot.conProc}    color="#ef4444"/>
          <KPI label="™ Marca reg."     value={tot.conMarca}   color="#7c3aed"/>
        </div>

        {/* ── Funnel ── */}
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:24}}>
          {[
            {label:"BD Total",    val:tot.empresas,  color:"#6366f1",bg:"#eef2ff",pct:null},
            {label:"1er contacto",val:tot.contacto1, color:"#3b82f6",bg:"#eff6ff",pct:tc},
            {label:"2do contacto",val:tot.contacto2, color:"#8b5cf6",bg:"#f5f3ff",pct:tot.contacto1?Math.round(tot.contacto2/tot.contacto1*100):0},
            {label:"Con reunión", val:tot.reuniones, color:"#22c55e",bg:"#f0fdf4",pct:tr},
          ].map((s,i)=>(
            <div key={s.label} style={{display:"flex",alignItems:"center"}}>
              <div style={{background:s.bg,borderRadius:10,padding:"12px 16px",textAlign:"center",border:`2px solid ${s.color}`,minWidth:90}}>
                <div style={{fontSize:26,fontWeight:800,color:s.color}}>{s.val}</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:1}}>{s.label}</div>
                {s.pct!==null&&<div style={{fontSize:11,color:s.color,fontWeight:700,marginTop:3}}>{s.pct}%</div>}
              </div>
              {i<3&&<div style={{fontSize:20,color:"#d1d5db",margin:"0 6px"}}>→</div>}
            </div>
          ))}
        </div>

        {/* ── Bar chart by month ── */}
        <div style={{fontWeight:700,fontSize:14,color:"#374151",marginBottom:12}}>📅 Actividad mensual</div>
        <div style={{display:"flex",gap:14,alignItems:"flex-end",overflowX:"auto",paddingBottom:8}}>
          {byMonth.map(m=>{
            const mes=m.mes.slice(5,7), año=m.mes.slice(2,4);
            return(
              <div key={m.mes} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,minWidth:64}}>
                <div style={{fontSize:11,color:"#374151",fontWeight:700}}>{m.empresas}</div>
                <div style={{width:52,display:"flex",flexDirection:"column",alignItems:"center"}}>
                  <div style={{width:48,height:Math.max(4,Math.round(m.empresas/maxV*110)),background:"#c7d2fe",borderRadius:"4px 4px 0 0"}} title={`Empresas: ${m.empresas}`}/>
                  <div style={{width:38,height:Math.max(2,Math.round(m.contacto1/maxV*110)),background:"#3b82f6",borderRadius:"4px 4px 0 0",marginTop:-1}} title={`1er contacto: ${m.contacto1}`}/>
                  <div style={{width:28,height:Math.max(2,Math.round(m.contacto2/maxV*110)),background:"#8b5cf6",borderRadius:"4px 4px 0 0",marginTop:-1}} title={`2do contacto: ${m.contacto2}`}/>
                  <div style={{width:18,height:Math.max(2,Math.round(m.reuniones/maxV*110)),background:"#22c55e",borderRadius:"4px 4px 0 0",marginTop:-1}} title={`Reuniones: ${m.reuniones}`}/>
                </div>
                <div style={{fontSize:13,fontWeight:700,color:"#374151"}}>{MESES[mes]||mes}</div>
                <div style={{fontSize:10,color:"#9ca3af"}}>'{año}</div>
              </div>
            );
          })}
        </div>
        <div style={{display:"flex",gap:14,marginTop:10,flexWrap:"wrap"}}>
          {[["#c7d2fe","Empresas"],["#3b82f6","1er contacto"],["#8b5cf6","2do contacto"],["#22c55e","Reuniones"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#6b7280"}}>
              <div style={{width:10,height:10,background:c,borderRadius:2}}/>{l}
            </div>
          ))}
        </div>
      </div>

      {/* ── Donuts row ── */}
      <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:20}}>
        {/* Potencial */}
        <div style={{flex:1,minWidth:300,background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:16}}>🎯 Distribución por Potencial</div>
          <DonutChart dataObj={potData} colors={potColors} size={180}/>
          <div style={{marginTop:16,padding:"12px",background:"#f8fafc",borderRadius:8}}>
            <div style={{fontSize:11,color:"#6b7280",marginBottom:3}}>Score promedio DD</div>
            <div style={{fontSize:24,fontWeight:800,color:"#6366f1"}}>{avgScore || "—"}</div>
            <div style={{fontSize:11,color:"#9ca3af"}}>sobre 100 · {evaluated.length} empresa{evaluated.length!==1?"s":""} evaluada{evaluated.length!==1?"s":""}</div>
          </div>
        </div>

        {/* Sector */}
        <div style={{flex:1,minWidth:300,background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:16}}>🏭 Distribución por Sector</div>
          <DonutChart dataObj={sectors} colors={SECTOR_COLORS} size={180}/>
          <div style={{marginTop:16,padding:"12px",background:"#f8fafc",borderRadius:8}}>
            <div style={{fontSize:11,color:"#6b7280",marginBottom:3}}>Sector dominante — enfocar campañas</div>
            <div style={{fontSize:16,fontWeight:800,color:SECTOR_COLORS[Object.entries(sectors).sort((a,b)=>b[1]-a[1])[0]?.[0]]||"#374151"}}>
              {Object.entries(sectors).sort((a,b)=>b[1]-a[1])[0]?.[0]||"—"}
            </div>
            <div style={{fontSize:11,color:"#9ca3af"}}>{Object.entries(sectors).sort((a,b)=>b[1]-a[1])[0]?.[1]||0} empresas en este sector</div>
          </div>
        </div>
      </div>

      {/* ── Ranking DD ── */}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
        <div style={{fontWeight:800,fontSize:15,marginBottom:14,color:"#0f172a"}}>🔥 Ranking por Score — Empresas con Debida Diligencia</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                {["#","Score","Empresa","Clasificación","Sector","Ingresos","Tamaño","Proc.Legal","Marca","Estado CRM"].map(h=>(
                  <th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:600,color:"#475569",fontSize:12,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.filter(r=>r.dd&&r.puntaje>0).sort((a,b)=>b.puntaje-a.puntaje).map((r,i)=>{
                const pm=POT_META[r.clasificacion]||POT_META[""];
                const em=ESTADO_META[r.estado]||ESTADO_META[""];
                const hp=procAlert(r.dd);
                const sc=SECTOR_COLORS[r.dd.sector||""]||"#e5e7eb";
                return(
                  <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                    <td style={{padding:"8px 12px",color:"#9ca3af",fontSize:12}}>{i+1}</td>
                    <td style={{padding:"8px 12px",fontWeight:800,fontSize:15,color:r.puntaje>=70?"#166534":r.puntaje>=50?"#854d0e":"#991b1b"}}>{r.puntaje}</td>
                    <td style={{padding:"8px 12px",fontWeight:600,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.cliente}</td>
                    <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}><Bdg bg={pm.bg} color={pm.color}>{pm.icon} {r.clasificacion}</Bdg></td>
                    <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}>
                      {r.dd.sector
                        ? <span style={{background:sc,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>{r.dd.sector}</span>
                        : <span style={{color:"#d1d5db"}}>—</span>}
                    </td>
                    <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}>{fmtI(r.dd.ingresos)}</td>
                    <td style={{padding:"8px 12px"}}>{r.dd.tamano||"—"}</td>
                    <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}>{hp?<span style={{color:"#dc2626",fontWeight:700}}>⚠️ SÍ</span>:<span style={{color:"#16a34a"}}>✅ No</span>}</td>
                    <td style={{padding:"8px 12px"}}>{r.dd.marca==="SÍ"?<span style={{color:"#7c3aed",fontWeight:700}}>™ Sí</span>:"No"}</td>
                    <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}><Bdg bg={em.bg} color={em.color}>{em.icon} {r.estado||"—"}</Bdg></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [data,setData]=useState([]);
  const [reuniones,setReuniones]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [lastUpdate,setLastUpdate]=useState(null);
  const [tab,setTab]=useState("crm");
  const [search,setSearch]=useState("");
  const [fEstado,setFEstado]=useState("TODOS");
  const [fPot,setFPot]=useState("TODOS");
  const [fQuien,setFQuien]=useState("TODOS");
  const [selected,setSelected]=useState(null);

  const fetchData=async()=>{
    try{
      setLoading(true);setError(null);
      const [bdR,reuR]=await Promise.all([fetch(BD_URL),fetch(REU_URL)]);
      const [bdT,reuT]=await Promise.all([bdR.text(),reuR.text()]);

      // ── DD data embedded from Excel (exact NIT or name match only) ──
      const ddByName={"REFORMANTE S.A.S": {"razon_social": "REFORMANTE S.A.S", "nit": "900782042", "sector": "", "rep_legal": "CAROLINA ALVARADO MARULANDA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://reformantes.com/condiciones-de-la-lopd", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": "<50 M", "riesgos": "RIESGO DE LIQUIDEZ, GESTION DE TESORERIA", "puntaje": 48.0, "clasificacion": "BAJO POTENCIAL"}, "CONSTRUCCIONES MASERCA S.A.S.": {"razon_social": "CONSTRUCCIONES MASERCA S.A.S.", "nit": "900707333", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "MARIO DE JESUS SERNA CANO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": "", "riesgos": "RIESGO LEGAL\nRIESGO REPUTACIONAL", "puntaje": 18.0, "clasificacion": "DESCARTADO"}, "CONSTRUCTORA INGROSSO S.A.S.": {"razon_social": "CONSTRUCTORA INGROSSO S.A.S.", "nit": "900911752", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "OSORNO HERRERA EMMANUEL", "ingresos": "10000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://constructoraingrosso.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">500 M", "riesgos": "RIESGO LEGAL, RIESGO DE LIQUIDEZ", "puntaje": 60.0, "clasificacion": "POTENCIAL MEDIO"}, "CONHOGAR S.A.S.": {"razon_social": "CONHOGAR S.A.S.", "nit": "890900836", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "GERMAN PEREZ MEJIA", "ingresos": "10000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://www.conhogar.co", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "CONJUNTO RESIDENCIAL NATURA PH", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "RIESGO LEGAL, RIESGO DE LIQUIDEZ", "puntaje": 43.0, "clasificacion": "BAJO POTENCIAL"}, "BORNEO CAPITAL S.A.S.": {"razon_social": "BORNEO CAPITAL S.A.S.", "nit": "901398785", "sector": "", "rep_legal": "TOMAS EASTMAN MADRID", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "Riesgo Legal, Riesgo Mercado, Riesgo economico", "puntaje": 58.0, "clasificacion": "POTENCIAL MEDIO"}, "INVERSIONES PINAR DEL RODEO S.A.S": {"razon_social": "INVERSIONES PINAR DEL RODEO S.A.S", "nit": "901183489", "sector": "", "rep_legal": "MEJIA SARRAZOLA MARY LUZ", "ingresos": "500000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 38.0, "clasificacion": "BAJO POTENCIAL"}, "CONSTRUCCIONES Y URBANIZACIONES L.G S.A.S": {"razon_social": "CONSTRUCCIONES Y URBANIZACIONES L.G S.A.S", "nit": "900450388", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "GARCIA ANGARITA LIBARDO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://construccionesyurbanizaciones.com/terminos-y-condiciones/", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 60.0, "clasificacion": "POTENCIAL MEDIO"}, "MAVEBIENES S.A.S.": {"razon_social": "MAVEBIENES S.A.S.", "nit": "901546499", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "VELASQUEZ PARRA JORGE ANDRES", "ingresos": "100000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://mavebienes.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": "<50 M", "riesgos": "", "puntaje": 48.0, "clasificacion": "BAJO POTENCIAL"}, "CIRCULO INMOBILIARIA DEL SUR S.A.S.": {"razon_social": "CIRCULO INMOBILIARIA DEL SUR S.A.S.", "nit": "901555099", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "SEPULVEDA PALACIO CARLOS ALBERTO", "ingresos": "100000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://www.circuloinmobiliariodelsur.co", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">500 M", "riesgos": "Riesgo Legal, Riesgo de Mercado Oferta y Demanda", "puntaje": 60.0, "clasificacion": "POTENCIAL MEDIO"}, "MASTER. IA": {"razon_social": "MASTER. IA", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "MICRO", "empleados": "30", "tiene_web": "SÍ", "url_web": "https://master.la/politica-servicio", "marca": "NO", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "LLC en USA, revisar colombia", "estructura_juridica": "", "patrimonio": ">500 M", "riesgos": "", "puntaje": 27.0, "clasificacion": "BAJO POTENCIAL"}, "MONTACARGAS AM&M S.A.S.": {"razon_social": "MONTACARGAS AM&M S.A.S.", "nit": "811014849", "sector": "", "rep_legal": "IRMA STELLA BLANDON MONTES", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "501", "tiene_web": "SÍ", "url_web": "https://montacargasamym.com", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "", "proc_empresa": "SÍ", "detalle_proc": "EPM, Sumas de dinero y Laboral (el ultimo empresa).", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 75.0, "clasificacion": "ALTO POTENCIAL"}, "LANGUAGE CENTERS NETWORK S.A.S.": {"razon_social": "LANGUAGE CENTERS NETWORK S.A.S.", "nit": "900430124", "sector": "", "rep_legal": "PATRICIA BATISTA CANELON", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "11", "tiene_web": "SÍ", "url_web": "https://lcnidiomas.edu.co", "marca": "SÍ", "proc_rl": "SÍ", "proc_rl_sup": "SÍ", "proc_empresa": "SÍ", "detalle_proc": "tutelas, garantías, laboral", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 56.0, "clasificacion": "POTENCIAL MEDIO"}, "ADA S.A.S.": {"razon_social": "ADA S.A.S.", "nit": "800167494", "sector": "", "rep_legal": "CESAR AUGUSTO ECHEVERRI PEREZ", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "200", "tiene_web": "SÍ", "url_web": "https://ada.co/terms-and-conditions/", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "Laboral, sumas de dinero", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 61.0, "clasificacion": "POTENCIAL MEDIO"}, "GRUPO NUTRY S.A.S.": {"razon_social": "GRUPO NUTRY S.A.S.", "nit": "901214227", "sector": "", "rep_legal": "JULIAN FRANCESCO RESTREPO ARIAS", "ingresos": "2000000000", "tamano": "MICRO", "empleados": ">15", "tiene_web": "SÍ", "url_web": "https://gruponutry.com", "marca": "SÍ", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 25.0, "clasificacion": "BAJO POTENCIAL"}, "HMV INGENIEROS LTDA.": {"razon_social": "HMV INGENIEROS LTDA.", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "SÍ", "url_web": "https://www.h-mv.com/General/Index.aspx?Lang=es-CO", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 10.0, "clasificacion": "DESCARTADO"}, "OFIMA S.A.S.": {"razon_social": "OFIMA S.A.S.", "nit": "800132302", "sector": "", "rep_legal": "MARCO ANTONIO CARRASQUILLA | FLOR MARIA PALACIO DE CARRASQUILLA", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": "51", "tiene_web": "SÍ", "url_web": "https://www.ofima.com/lp-general/?gad_source=1&gad_campaignid=23304152356&gbraid=0AAAABAIX1HCx9FSjI35v6NcsGrKIdYPCa&gclid=Cj0KCQjwk_bPBhDXARIsACiq8R2oJkO1eq1kz_ec1iHRcahqZt6-PohIv879rgIMtexWxKf-QZx8YUAaAhKUEALw_wcB", "marca": "SÍ", "proc_rl": "SÍ", "proc_rl_sup": "SÍ", "proc_empresa": "SÍ", "detalle_proc": "De ejecucion, TUTELAS", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 75.0, "clasificacion": "ALTO POTENCIAL"}, "OHANA COMPANY S.A.S. | GRUPO CUTRINI": {"razon_social": "OHANA COMPANY S.A.S. | GRUPO CUTRINI", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "MICRO", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 5.0, "clasificacion": "DESCARTADO"}, "INVERSORA LIRIO S.A.S.": {"razon_social": "INVERSORA LIRIO S.A.S.", "nit": "901497064", "sector": "", "rep_legal": "JUAN CARLOS LOPEZ DIEZ", "ingresos": "100000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "Riesgo Legal, Riesgo de Mercado Oferta y Demanda", "puntaje": 48.0, "clasificacion": "BAJO POTENCIAL"}, "CADENA COMERCIAL OXXO COLOMBIA S.A.S": {"razon_social": "CADENA COMERCIAL OXXO COLOMBIA S.A.S", "nit": "900236520", "sector": "", "rep_legal": "ANDRES MORALES", "ingresos": "10000000000000", "tamano": "GRANDE", "empleados": "", "tiene_web": "SÍ", "url_web": "https://colombia.oxxodomicilios.com", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 98.0, "clasificacion": "ALTO POTENCIAL"}, "INVERSIONES INTRAMAR S&P SAS": {"razon_social": "INVERSIONES INTRAMAR S&P SAS", "nit": "901394202", "sector": "", "rep_legal": "", "ingresos": "0", "tamano": "MICRO", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 5.0, "clasificacion": "DESCARTADO"}, "IMTAMAR S.A.S.": {"razon_social": "IMTAMAR S.A.S.", "nit": "901529751", "sector": "", "rep_legal": "", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 5.0, "clasificacion": "DESCARTADO"}, "RESTCAFE S A S": {"razon_social": "RESTCAFE S A S", "nit": "800213075", "sector": "", "rep_legal": "Marlon Masis Campos", "ingresos": "", "tamano": "MICRO", "empleados": "482", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 5.0, "clasificacion": "DESCARTADO"}, "BRAINFOODS S.A.S": {"razon_social": "BRAINFOODS S.A.S", "nit": "901822717", "sector": "", "rep_legal": "DAVID TRUJILLO GONZALEZ", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "NO", "patrimonio": ">100 M", "riesgos": "", "puntaje": 30.0, "clasificacion": "BAJO POTENCIAL"}, "CONSTRUCCIONES ROJAS Y ALVAREZ S.A.S.": {"razon_social": "CONSTRUCCIONES ROJAS Y ALVAREZ S.A.S.", "nit": "901778642", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "INVERSIONES LOS PERRITOS DEL MONO S.A.S.": {"razon_social": "INVERSIONES LOS PERRITOS DEL MONO S.A.S.", "nit": "901637324", "sector": "", "rep_legal": "ANDRES FELIPE PELAEZ AGUDELO", "ingresos": "20000000000", "tamano": "PEQUEÑA", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://losperritosdelmono.com", "marca": "NO", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 20.0, "clasificacion": "DESCARTADO"}, "AGUA BENDITA S.A.S": {"razon_social": "AGUA BENDITA S.A.S", "nit": "811044893", "sector": "", "rep_legal": "HINESTROZA MONTOYA MARIANA", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://www.aguabendita.com.co", "marca": "SÍ", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": "", "riesgos": "", "puntaje": 61.0, "clasificacion": "POTENCIAL MEDIO"}, "GESTION INMOBILIARIA MIC S.A.S.": {"razon_social": "GESTION INMOBILIARIA MIC S.A.S.", "nit": "900778625", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "Camargo Delgado Maria Ines | Reyes Vargas Mireya | Thomas Camargo Daniel", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "RICHOUSE INMOBILIARIA SAS": {"razon_social": "RICHOUSE INMOBILIARIA SAS", "nit": "901554815", "sector": "", "rep_legal": "Lux Mirta Espitia Chaparro", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "INMOBILIARIA GOMEZ Y ASOCIADOS S.A.S.": {"razon_social": "INMOBILIARIA GOMEZ Y ASOCIADOS S.A.S.", "nit": "900009803", "sector": "", "rep_legal": "LUZ DARY GOMEZ OSPINA | NUBIA ESTELA GOMEZ OSPINA | HECTOR FABIAN GOMEZ OSPINA", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "INVERSIONES BLO S.A.S": {"razon_social": "INVERSIONES BLO S.A.S", "nit": "901166382", "sector": "", "rep_legal": "Wilingthon Ortiz Jaramillo", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "AUNA COLOMBIA S.A.S.": {"razon_social": "Auna Colombia S.A.S.", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "GRUPO FALABELLA": {"razon_social": "Grupo Falabella", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "ZOOMLION HEAVY INDUSTRY COLOMBIA S.A.S.": {"razon_social": "Zoomlion Heavy Industry Colombia S.A.S.", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "COBRO | PEXTO COLOMBIA S.A.S": {"razon_social": "COBRO | PEXTO COLOMBIA S.A.S", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "GENESIS INVESTMENTS C.S.C S.A.S": {"razon_social": "GENESIS INVESTMENTS C.S.C S.A.S", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "KONFIDETIA MULTI FAMILY OFFICE S.A.S": {"razon_social": "KONFIDETIA MULTI FAMILY OFFICE S.A.S", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "EMPRESA TRANSPORTADORA SAN GABRIEL S.A.S.": {"razon_social": "Empresa Transportadora San Gabriel S.A.S.", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "CONSTRUCTORA INMOBILIARIA HABITAT DE LOS ANDES SAS": {"razon_social": "CONSTRUCTORA INMOBILIARIA HABITAT DE LOS ANDES SAS", "nit": "", "sector": "", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "REVOLUT BANK COLOMBIA S.A.": {"razon_social": "REVOLUT BANK COLOMBIA S.A.", "nit": "902002134", "sector": "FINTECH / BANCO", "rep_legal": "Diego Caicedo Mosquera", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "SÍ", "url_web": "https://www.revolut.com/es-CO/", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "Consideradom un sector con alta supervisión y vigilancia por parte de la SFC. Asimismo, se ve expuesta a riesgos regulatorios, riesgos tributarios y riesgo de LAFT", "puntaje": 83.0, "clasificacion": "ALTO POTENCIAL"}};
      const ddByNit={"900782042": {"razon_social": "REFORMANTE S.A.S", "nit": "900782042", "sector": "", "rep_legal": "CAROLINA ALVARADO MARULANDA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://reformantes.com/condiciones-de-la-lopd", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": "<50 M", "riesgos": "RIESGO DE LIQUIDEZ, GESTION DE TESORERIA", "puntaje": 48.0, "clasificacion": "BAJO POTENCIAL"}, "900707333": {"razon_social": "CONSTRUCCIONES MASERCA S.A.S.", "nit": "900707333", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "MARIO DE JESUS SERNA CANO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": "", "riesgos": "RIESGO LEGAL\nRIESGO REPUTACIONAL", "puntaje": 18.0, "clasificacion": "DESCARTADO"}, "900911752": {"razon_social": "CONSTRUCTORA INGROSSO S.A.S.", "nit": "900911752", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "OSORNO HERRERA EMMANUEL", "ingresos": "10000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://constructoraingrosso.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">500 M", "riesgos": "RIESGO LEGAL, RIESGO DE LIQUIDEZ", "puntaje": 60.0, "clasificacion": "POTENCIAL MEDIO"}, "890900836": {"razon_social": "CONHOGAR S.A.S.", "nit": "890900836", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "GERMAN PEREZ MEJIA", "ingresos": "10000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://www.conhogar.co", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "CONJUNTO RESIDENCIAL NATURA PH", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "RIESGO LEGAL, RIESGO DE LIQUIDEZ", "puntaje": 43.0, "clasificacion": "BAJO POTENCIAL"}, "901398785": {"razon_social": "BORNEO CAPITAL S.A.S.", "nit": "901398785", "sector": "", "rep_legal": "TOMAS EASTMAN MADRID", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "Riesgo Legal, Riesgo Mercado, Riesgo economico", "puntaje": 58.0, "clasificacion": "POTENCIAL MEDIO"}, "901183489": {"razon_social": "INVERSIONES PINAR DEL RODEO S.A.S", "nit": "901183489", "sector": "", "rep_legal": "MEJIA SARRAZOLA MARY LUZ", "ingresos": "500000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 38.0, "clasificacion": "BAJO POTENCIAL"}, "900450388": {"razon_social": "CONSTRUCCIONES Y URBANIZACIONES L.G S.A.S", "nit": "900450388", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "GARCIA ANGARITA LIBARDO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://construccionesyurbanizaciones.com/terminos-y-condiciones/", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 60.0, "clasificacion": "POTENCIAL MEDIO"}, "901546499": {"razon_social": "MAVEBIENES S.A.S.", "nit": "901546499", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "VELASQUEZ PARRA JORGE ANDRES", "ingresos": "100000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://mavebienes.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": "<50 M", "riesgos": "", "puntaje": 48.0, "clasificacion": "BAJO POTENCIAL"}, "901555099": {"razon_social": "CIRCULO INMOBILIARIA DEL SUR S.A.S.", "nit": "901555099", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "SEPULVEDA PALACIO CARLOS ALBERTO", "ingresos": "100000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://www.circuloinmobiliariodelsur.co", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">500 M", "riesgos": "Riesgo Legal, Riesgo de Mercado Oferta y Demanda", "puntaje": 60.0, "clasificacion": "POTENCIAL MEDIO"}, "811014849": {"razon_social": "MONTACARGAS AM&M S.A.S.", "nit": "811014849", "sector": "", "rep_legal": "IRMA STELLA BLANDON MONTES", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "501", "tiene_web": "SÍ", "url_web": "https://montacargasamym.com", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "", "proc_empresa": "SÍ", "detalle_proc": "EPM, Sumas de dinero y Laboral (el ultimo empresa).", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 75.0, "clasificacion": "ALTO POTENCIAL"}, "900430124": {"razon_social": "LANGUAGE CENTERS NETWORK S.A.S.", "nit": "900430124", "sector": "", "rep_legal": "PATRICIA BATISTA CANELON", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "11", "tiene_web": "SÍ", "url_web": "https://lcnidiomas.edu.co", "marca": "SÍ", "proc_rl": "SÍ", "proc_rl_sup": "SÍ", "proc_empresa": "SÍ", "detalle_proc": "tutelas, garantías, laboral", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 56.0, "clasificacion": "POTENCIAL MEDIO"}, "800167494": {"razon_social": "ADA S.A.S.", "nit": "800167494", "sector": "", "rep_legal": "CESAR AUGUSTO ECHEVERRI PEREZ", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "200", "tiene_web": "SÍ", "url_web": "https://ada.co/terms-and-conditions/", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "Laboral, sumas de dinero", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 61.0, "clasificacion": "POTENCIAL MEDIO"}, "901214227": {"razon_social": "GRUPO NUTRY S.A.S.", "nit": "901214227", "sector": "", "rep_legal": "JULIAN FRANCESCO RESTREPO ARIAS", "ingresos": "2000000000", "tamano": "MICRO", "empleados": ">15", "tiene_web": "SÍ", "url_web": "https://gruponutry.com", "marca": "SÍ", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 25.0, "clasificacion": "BAJO POTENCIAL"}, "800132302": {"razon_social": "OFIMA S.A.S.", "nit": "800132302", "sector": "", "rep_legal": "MARCO ANTONIO CARRASQUILLA | FLOR MARIA PALACIO DE CARRASQUILLA", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": "51", "tiene_web": "SÍ", "url_web": "https://www.ofima.com/lp-general/?gad_source=1&gad_campaignid=23304152356&gbraid=0AAAABAIX1HCx9FSjI35v6NcsGrKIdYPCa&gclid=Cj0KCQjwk_bPBhDXARIsACiq8R2oJkO1eq1kz_ec1iHRcahqZt6-PohIv879rgIMtexWxKf-QZx8YUAaAhKUEALw_wcB", "marca": "SÍ", "proc_rl": "SÍ", "proc_rl_sup": "SÍ", "proc_empresa": "SÍ", "detalle_proc": "De ejecucion, TUTELAS", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 75.0, "clasificacion": "ALTO POTENCIAL"}, "901497064": {"razon_social": "INVERSORA LIRIO S.A.S.", "nit": "901497064", "sector": "", "rep_legal": "JUAN CARLOS LOPEZ DIEZ", "ingresos": "100000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "Riesgo Legal, Riesgo de Mercado Oferta y Demanda", "puntaje": 48.0, "clasificacion": "BAJO POTENCIAL"}, "900236520": {"razon_social": "CADENA COMERCIAL OXXO COLOMBIA S.A.S", "nit": "900236520", "sector": "", "rep_legal": "ANDRES MORALES", "ingresos": "10000000000000", "tamano": "GRANDE", "empleados": "", "tiene_web": "SÍ", "url_web": "https://colombia.oxxodomicilios.com", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 98.0, "clasificacion": "ALTO POTENCIAL"}, "901394202": {"razon_social": "INVERSIONES INTRAMAR S&P SAS", "nit": "901394202", "sector": "", "rep_legal": "", "ingresos": "0", "tamano": "MICRO", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 5.0, "clasificacion": "DESCARTADO"}, "901529751": {"razon_social": "IMTAMAR S.A.S.", "nit": "901529751", "sector": "", "rep_legal": "", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 5.0, "clasificacion": "DESCARTADO"}, "800213075": {"razon_social": "RESTCAFE S A S", "nit": "800213075", "sector": "", "rep_legal": "Marlon Masis Campos", "ingresos": "", "tamano": "MICRO", "empleados": "482", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 5.0, "clasificacion": "DESCARTADO"}, "901822717": {"razon_social": "BRAINFOODS S.A.S", "nit": "901822717", "sector": "", "rep_legal": "DAVID TRUJILLO GONZALEZ", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "NO", "patrimonio": ">100 M", "riesgos": "", "puntaje": 30.0, "clasificacion": "BAJO POTENCIAL"}, "901778642": {"razon_social": "CONSTRUCCIONES ROJAS Y ALVAREZ S.A.S.", "nit": "901778642", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "901637324": {"razon_social": "INVERSIONES LOS PERRITOS DEL MONO S.A.S.", "nit": "901637324", "sector": "", "rep_legal": "ANDRES FELIPE PELAEZ AGUDELO", "ingresos": "20000000000", "tamano": "PEQUEÑA", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://losperritosdelmono.com", "marca": "NO", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 20.0, "clasificacion": "DESCARTADO"}, "811044893": {"razon_social": "AGUA BENDITA S.A.S", "nit": "811044893", "sector": "", "rep_legal": "HINESTROZA MONTOYA MARIANA", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://www.aguabendita.com.co", "marca": "SÍ", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": "", "riesgos": "", "puntaje": 61.0, "clasificacion": "POTENCIAL MEDIO"}, "900778625": {"razon_social": "GESTION INMOBILIARIA MIC S.A.S.", "nit": "900778625", "sector": "INMOBILIARIA | CONSTRUCCIÓN", "rep_legal": "Camargo Delgado Maria Ines | Reyes Vargas Mireya | Thomas Camargo Daniel", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "901554815": {"razon_social": "RICHOUSE INMOBILIARIA SAS", "nit": "901554815", "sector": "", "rep_legal": "Lux Mirta Espitia Chaparro", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "900009803": {"razon_social": "INMOBILIARIA GOMEZ Y ASOCIADOS S.A.S.", "nit": "900009803", "sector": "", "rep_legal": "LUZ DARY GOMEZ OSPINA | NUBIA ESTELA GOMEZ OSPINA | HECTOR FABIAN GOMEZ OSPINA", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "901166382": {"razon_social": "INVERSIONES BLO S.A.S", "nit": "901166382", "sector": "", "rep_legal": "Wilingthon Ortiz Jaramillo", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "901875692": {"razon_social": "CONSTRUCTORA INMOBILIARIA HABITAT DE LOS ANDES SAS", "nit": "901875692", "sector": "", "rep_legal": "PEÑA PIÑEROS JORGE", "ingresos": "", "tamano": "REVISAR SECTOR", "empleados": "", "tiene_web": "", "url_web": "", "marca": "", "proc_rl": "", "proc_rl_sup": "", "proc_empresa": "", "detalle_proc": "", "estructura_juridica": "", "patrimonio": "", "riesgos": "", "puntaje": 0.0, "clasificacion": "DESCARTADO"}, "902002134": {"razon_social": "REVOLUT BANK COLOMBIA S.A.", "nit": "902002134", "sector": "FINTECH / BANCO", "rep_legal": "Diego Caicedo Mosquera", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "SÍ", "url_web": "https://www.revolut.com/es-CO/", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "Consideradom un sector con alta supervisión y vigilancia por parte de la SFC. Asimismo, se ve expuesta a riesgos regulatorios, riesgos tributarios y riesgo de LAFT", "puntaje": 83.0, "clasificacion": "ALTO POTENCIAL"}};
      const lookupDD=(nombre,nit)=>ddByNit[nit]||ddByName[nombre]||null;
      
      // ── Parse REUNIONES ──
      const reuRaw=parseRaw(reuT);
      const reuHi=reuRaw.findIndex(r=>r.includes("CLIENTE")&&(r.includes("REUNION")||r.includes("REUNIÓN")));
      const reuMap={};
      if(reuHi>=0){
        const rH=reuRaw[reuHi];
        const ci=rH.indexOf("CLIENTE"),ri=rH.findIndex(h=>h==="REUNION"||h==="REUNIÓN"),fi=rH.indexOf("FECHA"),coi=rH.indexOf("COMENTARIOS");
        for(let i=reuHi+1;i<reuRaw.length;i++){
          const row=reuRaw[i];
          const nombre=(row[ci]||"").toUpperCase().trim();
          if(nombre.length>1) reuMap[nombre]={tiene_reunion:(row[ri]||"").toUpperCase()==="TRUE",fecha:row[fi]||"",comentarios:row[coi]||""};
        }
      }

      // ── Parse BD ──
      const bdRows=parseCSV(bdT).filter(r=>r["CLIENTE"]?.length>1);
      const enriched=bdRows.map((r,idx)=>{
        const nombre=(r["CLIENTE"]||"").toUpperCase().trim();
        const nit=cleanNIT(r["NIT"]||"");
        // Match DD — exact NIT or exact name only
        const dd=lookupDD(nombre,nit);
        // Match reunión — exact name only
        const reu=reuMap[nombre]||null;
        return{
          id:idx,
          cliente:r["CLIENTE"]||"",
          estado:r["ESTADO"]||"",
          quien:r["QUIEN LO LLAMO"]||"",
          emis:r["EMIS"]||"",rues:r["RUES"]||"",
          interes:r["COMENTARIOS"]||"",
          contacto1:r["CONTACTÓ"]==="TRUE",
          contacto2:r["SEGUNDO CONTACTO"]==="TRUE",
          quePaso:r["¿QUÉ PASÓ?"]||"",
          fecha:r["FECHA"]||"",
          contactoDirecto:r["CONTACTO DIRECTO"]||"",
          telefono:r["TELEFONO"]||"",
          direccion:r["DIRECCION"]||"",
          correo:r["CORREO"]||"",
          nit:r["NIT"]||"",
          notas:r["COMENTARIOS.1"]||"",
          // DD
          dd,
          puntaje:dd?.puntaje||0,
          clasificacion:dd?.clasificacion||"",
          // Reunión
          tiene_reunion:reu?.tiene_reunion||false,
          reunion_comentarios:reu?.comentarios||"",
        };
      });

      // Sort: ALTO POTENCIAL primero, luego por score desc, luego por estado (LLAMAR HOY primero)
      const estadoOrder={"LLAMAR HOY":1,"SEGUIMIENTO":2,"VOLVER A CONTACTAR":3,"":4,"YA NO SEGUIMIENTO":5};
      enriched.sort((a,b)=>{
        const pa=POT_META[a.clasificacion]?.order||5,pb=POT_META[b.clasificacion]?.order||5;
        if(pa!==pb)return pa-pb;
        if(b.puntaje!==a.puntaje)return b.puntaje-a.puntaje;
        return (estadoOrder[a.estado]||4)-(estadoOrder[b.estado]||4);
      });

      const reuList=Object.values(reuMap);
      setData(enriched);setReuniones(reuList);
      setLastUpdate(new Date().toLocaleTimeString("es-CO"));
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  };

  useEffect(()=>{fetchData();},[]);

  const quienes=useMemo(()=>{
    const s=new Set(["TODOS"]);
    data.forEach(r=>{if(r.quien)r.quien.split(",").forEach(q=>s.add(q.trim()));});
    return[...s].filter(Boolean);
  },[data]);

  const filtered=useMemo(()=>data.filter(r=>{
    const q=search.toLowerCase();
    const mS=!q||r.cliente.toLowerCase().includes(q)||r.contactoDirecto.toLowerCase().includes(q)||r.telefono.includes(q)||r.quePaso.toLowerCase().includes(q);
    const mE=fEstado==="TODOS"||(fEstado==="Sin estado"?!r.estado:r.estado===fEstado);
    const mQ=fQuien==="TODOS"||r.quien.includes(fQuien);
    const mP=fPot==="TODOS"||(fPot==="Sin evaluar"?!r.clasificacion:r.clasificacion===fPot);
    return mS&&mE&&mQ&&mP;
  }),[data,search,fEstado,fQuien,fPot]);

  const stats=useMemo(()=>({
    total:data.length,
    llamarHoy:data.filter(r=>r.estado==="LLAMAR HOY").length,
    seguimiento:data.filter(r=>r.estado==="SEGUIMIENTO").length,
    alto:data.filter(r=>r.clasificacion==="ALTO POTENCIAL").length,
    conReunion:data.filter(r=>r.tiene_reunion).length,
    conProc:data.filter(r=>r.dd&&procAlert(r.dd)).length,
  }),[data]);

  if(loading)return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",gap:16,color:"#475569"}}>
      <div style={{fontSize:40}}>📋</div>
      <div style={{fontSize:16,fontWeight:600}}>Cargando CRM + Debida Diligencia…</div>
      <div style={{fontSize:13,color:"#9ca3af"}}>Conectando con Google Sheets</div>
    </div>
  );
  if(error)return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",gap:16}}>
      <div style={{fontSize:40}}>⚠️</div>
      <div style={{fontSize:16,fontWeight:600,color:"#ef4444"}}>Error al cargar</div>
      <div style={{fontSize:13,color:"#6b7280",maxWidth:380,textAlign:"center"}}>{error}</div>
      <button onClick={fetchData} style={{padding:"10px 20px",background:"#3b82f6",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600}}>Reintentar</button>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"#f8fafc",color:"#1e293b"}}>
      {/* HEADER */}
      <div style={{background:"#0f172a",color:"#fff",padding:"16px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{fontSize:24}}>📋</div>
          <div>
            <div style={{fontSize:17,fontWeight:800}}>Deep Empire Bros — CRM</div>
            <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{data.length} empresas · {data.filter(r=>r.dd).length} con DD · {lastUpdate}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{display:"flex",gap:2,background:"#1e293b",borderRadius:8,padding:3}}>
            {[["crm","🗂 CRM"],["metricas","📊 Métricas"]].map(([t,l])=>(
              <button key={t} onClick={()=>setTab(t)} style={{padding:"6px 14px",borderRadius:6,border:"none",cursor:"pointer",fontWeight:600,fontSize:13,background:tab===t?"#3b82f6":"transparent",color:tab===t?"#fff":"#94a3b8"}}>{l}</button>
            ))}
          </div>
          <button onClick={fetchData} style={{padding:"8px 14px",background:"#1e40af",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600}}>🔄 Actualizar</button>
        </div>
      </div>

      <div style={{padding:"20px 28px"}}>
        {tab==="metricas"?<Metricas data={data} reuniones={reuniones}/>:(
          <>
            {/* STATS */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              <KPI label="Total"            value={stats.total}       color="#6366f1"/>
              <KPI label="📞 Llamar hoy"   value={stats.llamarHoy}   color="#eab308"/>
              <KPI label="🔄 Seguimiento"  value={stats.seguimiento}  color="#22c55e"/>
              <KPI label="🔥 Alto potencial" value={stats.alto}       color="#f97316"/>
              <KPI label="🤝 Con reunión"  value={stats.conReunion}   color="#8b5cf6"/>
              <KPI label="⚠️ Proc. legal"  value={stats.conProc}     color="#ef4444"/>
            </div>

            {/* FILTROS */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
              <input placeholder="🔍 Buscar empresa, contacto, acción…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{flex:1,minWidth:220,padding:"9px 14px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:14,outline:"none",background:"#fff"}}/>
              <select value={fEstado} onChange={e=>setFEstado(e.target.value)}
                style={{padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,background:"#fff",cursor:"pointer"}}>
                {ESTADOS.map(e=><option key={e}>{e}</option>)}
              </select>
              <select value={fPot} onChange={e=>setFPot(e.target.value)}
                style={{padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,background:"#fff",cursor:"pointer"}}>
                {POTS.map(p=><option key={p}>{p}</option>)}
              </select>
              <select value={fQuien} onChange={e=>setFQuien(e.target.value)}
                style={{padding:"9px 12px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,background:"#fff",cursor:"pointer"}}>
                {quienes.map(q=><option key={q}>{q}</option>)}
              </select>
              <div style={{padding:"9px 14px",background:"#f1f5f9",borderRadius:8,fontSize:13,color:"#475569",display:"flex",alignItems:"center"}}>
                {filtered.length} resultado{filtered.length!==1?"s":""}
              </div>
            </div>

            <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
              {/* TABLA */}
              <div style={{flex:1,background:"#fff",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,.07)",overflow:"hidden",minWidth:0}}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                        {["Score","Potencial","Estado","Empresa","Contacto","Teléfono","Proc.Legal","Marca","Interés","🤝","Asignado"].map(h=>(
                          <th key={h} style={{padding:"10px 11px",textAlign:"left",fontWeight:600,color:"#475569",whiteSpace:"nowrap",fontSize:12}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r=>{
                        const em=ESTADO_META[r.estado]||ESTADO_META[""];
                        const tag=getTag(r.interes);
                        const pm=POT_META[r.clasificacion]||null;
                        const hp=r.dd&&procAlert(r.dd);
                        const isSel=selected?.id===r.id;
                        return(
                          <tr key={r.id} onClick={()=>setSelected(isSel?null:r)}
                            style={{borderBottom:"1px solid #f1f5f9",cursor:"pointer",background:isSel?"#eff6ff":"transparent"}}
                            onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background="#f8fafc";}}
                            onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
                            <td style={{padding:"9px 11px",fontWeight:800,color:r.puntaje>=70?"#166534":r.puntaje>=50?"#854d0e":r.puntaje>0?"#991b1b":"#d1d5db"}}>
                              {r.puntaje>0?r.puntaje:"—"}
                            </td>
                            <td style={{padding:"9px 11px",whiteSpace:"nowrap"}}>
                              {pm?<Bdg bg={pm.bg} color={pm.color}>{pm.icon} {r.clasificacion}</Bdg>:<span style={{color:"#d1d5db",fontSize:11}}>Sin DD</span>}
                            </td>
                            <td style={{padding:"9px 11px",whiteSpace:"nowrap"}}>
                              <Bdg bg={em.bg} color={em.color}>{em.icon} {r.estado||"—"}</Bdg>
                            </td>
                            <td style={{padding:"9px 11px",fontWeight:600,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.cliente}</td>
                            <td style={{padding:"9px 11px",color:"#475569",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.contactoDirecto||"—"}</td>
                            <td style={{padding:"9px 11px",whiteSpace:"nowrap"}}>
                              {r.telefono?<a href={`tel:${r.telefono.split("|")[0].replace(/\s/g,"")}`} style={{color:"#3b82f6",textDecoration:"none"}} onClick={e=>e.stopPropagation()}>{r.telefono.slice(0,14)}</a>:<span style={{color:"#d1d5db"}}>—</span>}
                            </td>
                            <td style={{padding:"9px 11px",textAlign:"center"}}>
                              {r.dd?(hp?<span title="Tiene procesos legales" style={{color:"#dc2626",fontWeight:700}}>⚠️</span>:<span style={{color:"#16a34a"}}>✅</span>):<span style={{color:"#d1d5db"}}>—</span>}
                            </td>
                            <td style={{padding:"9px 11px",textAlign:"center"}}>
                              {r.dd?(r.dd.marca==="SÍ"?<span style={{color:"#7c3aed",fontWeight:700}}>™</span>:<span style={{color:"#9ca3af",fontSize:11}}>No</span>):<span style={{color:"#d1d5db"}}>—</span>}
                            </td>
                            <td style={{padding:"9px 11px"}}>
                              {tag?<Bdg bg={tag.bg} color={tag.color}>{tag.label}</Bdg>:<span style={{color:"#d1d5db"}}>—</span>}
                            </td>
                            <td style={{padding:"9px 11px",textAlign:"center"}}>
                              {r.tiene_reunion?<span title="Con reunión">🤝</span>:<span style={{color:"#d1d5db"}}>—</span>}
                            </td>
                            <td style={{padding:"9px 11px",color:"#6b7280",fontSize:12}}>{r.quien||"—"}</td>
                          </tr>
                        );
                      })}
                      {filtered.length===0&&<tr><td colSpan={11} style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Sin resultados</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              {selected&&<Detail c={selected} onClose={()=>setSelected(null)}/>}
            </div>

            <div style={{marginTop:14,fontSize:11,color:"#9ca3af",textAlign:"center"}}>
              Las empresas con DD aparecen primero, ordenadas por score · Edita Google Sheets y presiona "Actualizar"
            </div>
          </>
        )}
      </div>
    </div>
  );
}
