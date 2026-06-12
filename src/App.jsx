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
function Metricas({data,reuniones}){
  const byMonth=useMemo(()=>{
    const m={};
    data.forEach(r=>{
      const f=r.fecha; if(!f||f==="nan"||f.length<7)return;
      const k=f.slice(0,7);
      if(!m[k])m[k]={mes:k,empresas:0,contactadas:0,segundo:0,reuniones:0};
      m[k].empresas++;
      if(r.contacto1)m[k].contactadas++;
      if(r.contacto2)m[k].segundo++;
    });
    reuniones.forEach(r=>{
      if(!r.fecha||r.fecha.length<7)return;
      const k=r.fecha.slice(0,7);
      if(!m[k])m[k]={mes:k,empresas:0,contactadas:0,segundo:0,reuniones:0};
      if(r.tiene_reunion)m[k].reuniones++;
    });
    return Object.values(m).sort((a,b)=>a.mes.localeCompare(b.mes));
  },[data,reuniones]);

  const tot={
    empresas:data.length,
    contactadas:data.filter(r=>r.contacto1).length,
    segundo:data.filter(r=>r.contacto2).length,
    reuniones:reuniones.filter(r=>r.tiene_reunion).length,
    alto:data.filter(r=>r.clasificacion==="ALTO POTENCIAL").length,
    conProc:data.filter(r=>r.dd&&procAlert(r.dd)).length,
  };
  const tc=tot.empresas?Math.round(tot.contactadas/tot.empresas*100):0;
  const tr=tot.contactadas?Math.round(tot.reuniones/tot.contactadas*100):0;
  const tf=tot.empresas?Math.round(tot.reuniones/tot.empresas*100):0;

  const MES={"01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun","07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic"};
  const maxV=Math.max(...byMonth.map(m=>m.empresas),1);

  return(
    <div>
      <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.07)",marginBottom:20}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:16,color:"#0f172a"}}>📊 Métricas de Conversión — Embudo Comercial</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:28}}>
          <KPI label="Total empresas"       value={tot.empresas}    color="#6366f1"/>
          <KPI label="1er contacto"         value={tot.contactadas} color="#3b82f6" sub={`${tc}% tasa de contacto`}/>
          <KPI label="2do contacto"         value={tot.segundo}     color="#8b5cf6" sub={`${tot.contactadas?Math.round(tot.segundo/tot.contactadas*100):0}% de contactadas`}/>
          <KPI label="Con reunión"          value={tot.reuniones}   color="#22c55e" sub={`${tr}% de contactadas`}/>
          <KPI label="Llamada → Reunión"    value={`${tf}%`}        color="#f59e0b" sub="tasa de cierre global"/>
          <KPI label="🔥 Alto potencial"   value={tot.alto}        color="#f97316"/>
          <KPI label="⚠️ Con proc. legal"  value={tot.conProc}     color="#ef4444"/>
        </div>

        {/* Funnel visual */}
        <div style={{display:"flex",gap:0,marginBottom:28,alignItems:"center",flexWrap:"wrap"}}>
          {[
            {label:"Empresas BD",val:tot.empresas,  color:"#6366f1",bg:"#eef2ff"},
            {label:"Contactadas", val:tot.contactadas,color:"#3b82f6",bg:"#eff6ff"},
            {label:"2do contacto",val:tot.segundo,   color:"#8b5cf6",bg:"#f5f3ff"},
            {label:"Con reunión", val:tot.reuniones,  color:"#22c55e",bg:"#f0fdf4"},
          ].map((s,i)=>(
            <div key={s.label} style={{display:"flex",alignItems:"center"}}>
              <div style={{background:s.bg,borderRadius:10,padding:"14px 20px",textAlign:"center",minWidth:110,border:`2px solid ${s.color}`}}>
                <div style={{fontSize:28,fontWeight:800,color:s.color}}>{s.val}</div>
                <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{s.label}</div>
              </div>
              {i<3&&<div style={{fontSize:20,color:"#d1d5db",margin:"0 6px"}}>→</div>}
            </div>
          ))}
        </div>

        {/* Barras por mes */}
        {byMonth.length>0&&(
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"#475569",marginBottom:12}}>Actividad mensual</div>
            <div style={{display:"flex",gap:10,alignItems:"flex-end",overflowX:"auto",paddingBottom:8}}>
              {byMonth.map(m=>{
                const mes=m.mes.slice(5,7);
                return(
                  <div key={m.mes} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,minWidth:56}}>
                    <div style={{fontSize:10,color:"#6b7280",fontWeight:600}}>{m.empresas}</div>
                    <div style={{width:44,display:"flex",flexDirection:"column",alignItems:"center",gap:0}}>
                      <div style={{width:40,height:Math.max(4,m.empresas/maxV*90),background:"#c7d2fe",borderRadius:"4px 4px 0 0"}} title={`Empresas: ${m.empresas}`}/>
                      <div style={{width:32,height:Math.max(2,m.contactadas/maxV*90),background:"#3b82f6",borderRadius:"4px 4px 0 0",marginTop:-1}} title={`Contactadas: ${m.contactadas}`}/>
                      <div style={{width:22,height:Math.max(2,m.reuniones/maxV*90),background:"#22c55e",borderRadius:"4px 4px 0 0",marginTop:-1}} title={`Reuniones: ${m.reuniones}`}/>
                    </div>
                    <div style={{fontSize:10,color:"#9ca3af"}}>{MES[mes]||mes}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:16,marginTop:10}}>
              {[["#c7d2fe","Empresas"],["#3b82f6","Contactadas"],["#22c55e","Reuniones"]].map(([c,l])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"#6b7280"}}>
                  <div style={{width:10,height:10,background:c,borderRadius:2}}/>{l}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabla de alto potencial */}
      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
        <div style={{fontWeight:800,fontSize:15,marginBottom:14,color:"#0f172a"}}>🔥 Empresas con Mayor Potencial (evaluadas en DD)</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                {["Score","Empresa","Clasificación","Ingresos","Tamaño","Proc. Legal","Marca","Estado CRM"].map(h=>(
                  <th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:600,color:"#475569",fontSize:12,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.filter(r=>r.dd&&r.puntaje>0).sort((a,b)=>b.puntaje-a.puntaje).map(r=>{
                const pm=POT_META[r.clasificacion]||POT_META[""];
                const em=ESTADO_META[r.estado]||ESTADO_META[""];
                const hp=procAlert(r.dd);
                const fmt=(n)=>{if(!n||n==="nan")return"—";const v=parseFloat(n);if(isNaN(v))return n;if(v>=1e9)return`$${(v/1e9).toFixed(0)}MM`;if(v>=1e6)return`$${(v/1e6).toFixed(0)}M`;return`$${v.toLocaleString()}`;};
                return(
                  <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9"}}>
                    <td style={{padding:"8px 12px",fontWeight:800,color:r.puntaje>=70?"#166534":r.puntaje>=50?"#854d0e":"#991b1b"}}>{r.puntaje}</td>
                    <td style={{padding:"8px 12px",fontWeight:600,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.cliente}</td>
                    <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}><Bdg bg={pm.bg} color={pm.color}>{pm.icon} {r.clasificacion}</Bdg></td>
                    <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}>{fmt(r.dd.ingresos)}</td>
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
      const [bdR,ddR,reuR]=await Promise.all([fetch(BD_URL),fetch(DD_URL),fetch(REU_URL)]);
      const [bdT,ddT,reuT]=await Promise.all([bdR.text(),ddR.text(),reuR.text()]);

      // ── Parse DD ──
      const ddRaw=parseRaw(ddT);
      const ddHi=ddRaw.findIndex(r=>r.some(c=>c.includes("RAZÓN SOCIAL")));
      const ddH=ddHi>=0?ddRaw[ddHi]:[];
      const gi=(label)=>ddH.findIndex(h=>h.includes(label));
      const ddMap={};
      if(ddHi>=0){
        for(let i=ddHi+1;i<ddRaw.length;i++){
          const row=ddRaw[i];
          const g=(label)=>{const idx=gi(label);return idx>=0?(row[idx]||"").trim():"";};
          const nombre=g("RAZÓN SOCIAL").toUpperCase().trim();
          const nit=cleanNIT(g("NIT"));
          const puntaje=parseFloat(g("PUNTAJE"))||0;
          const clas=g("CLASIFICACIÓN");
          const clasNorm=clas.includes("ALTO")?"ALTO POTENCIAL":clas.includes("MEDIO")?"POTENCIAL MEDIO":clas.includes("BAJO")?"BAJO POTENCIAL":clas.includes("DESCAR")?"DESCARTADO":clas;
          if(nombre.length<2)continue;
          const entry={
            razon_social:g("RAZÓN SOCIAL"),nit,sector:g("SECTOR"),
            rep_legal:g("REPRESENTANTE"),ingresos:g("INGRESOS"),
            tamano:g("TAMAÑO"),empleados:g("N° EMPLEADOS"),
            tiene_web:g("TIENE"),url_web:g("URL"),
            marca:g("REGISTRO"),
            proc_rl:g("PROC. JUDICIALES\nRL")||g("RL"),
            proc_rl_sup:g("RL SUPLENTE"),
            proc_empresa:g("EMPRESA"),
            detalle_proc:g("DETALLE"),
            estructura_juridica:g("ESTRUCTURA\nJURÍDICA")||g("JURÍDICA"),
            patrimonio:g("PATRIMONIO"),riesgos:g("RIESGOS"),
            puntaje,clasificacion:clasNorm,
          };
          if(nit)ddMap[nit]=entry;
          ddMap[nombre]=entry;
        }
      }

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
        // Match DD por NIT primero, luego nombre parcial
        const dd=ddMap[nit]||ddMap[nombre]||Object.entries(ddMap).find(([k])=>k.length>5&&(nombre.includes(k.slice(0,8))||k.includes(nombre.slice(0,8))))?.[1]||null;
        // Match reunión
        const reu=reuMap[nombre]||Object.entries(reuMap).find(([k])=>k.length>5&&(nombre.includes(k.slice(0,8))||k.includes(nombre.slice(0,8))))?.[1]||null;
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
