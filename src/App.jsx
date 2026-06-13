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
  if(!x||x==="nan"||x==="0")return "";
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
  return ["SÍ","SI","SÍ "].some(v=>dd.proc_rl===v||dd.proc_rl_sup===v||dd.proc_empresa===v);
}

const ESTADOS=["TODOS","LLAMAR HOY","SEGUIMIENTO","VOLVER A CONTACTAR","YA NO SEGUIMIENTO","Sin estado"];
const POTS=["TODOS","ALTO POTENCIAL","POTENCIAL MEDIO","BAJO POTENCIAL","DESCARTADO","Sin evaluar"];

// ── COMPONENTS ───────────────────────────────────────────────────────────────
function Bdg({bg,color,children,style={}}){
  return <span style={{background:bg,color,borderRadius:6,padding:"3px 8px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",...style}}>{children}</span>;
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
    if(!n||n==="nan")return "";
    const num=parseFloat(n);
    if(isNaN(num))return n;
    if(num>=1e12)return `$${(num/1e12).toFixed(0)}B`;
    if(num>=1e9) return `$${(num/1e9).toFixed(0)}MM`;
    if(num>=1e6) return `$${(num/1e6).toFixed(0)}M`;
    return `$${num.toLocaleString("es-CO")}`;
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
  if(!n||n==="nan")return "—";
  const v=parseFloat(n);if(isNaN(v))return "—";
  if(v>=1e12)return `$${(v/1e12).toFixed(0)}B`;
  if(v>=1e9)return `$${(v/1e9).toFixed(1)}MM`;
  if(v>=1e6)return `$${(v/1e6).toFixed(0)}M`;
  return `$${v.toLocaleString("es-CO")}`;
}

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
  if(!total)return <div style={{color:"#9ca3af",fontSize:13,padding:16}}>Sin datos</div>;
  let cum=0;
  const slices=entries.map(([label,val])=>{const pct=val/total;const s=cum;cum+=pct;return{label,val,pct,s};});
  const r=size/2-14,ir=r-22,cx=size/2,cy=size/2;
  function arc({s,pct}){
    if(pct>=0.9999){return `M ${cx},${cy-r} A ${r},${r} 0 1,1 ${cx-0.01},${cy-r} Z`;}
    const a1=s*2*Math.PI-Math.PI/2,a2=(s+pct)*2*Math.PI-Math.PI/2;
    const x1=cx+r*Math.cos(a1),y1=cy+r*Math.sin(a1);
    const x2=cx+r*Math.cos(a2),y2=cy+r*Math.sin(a2);
    const ix1=cx+ir*Math.cos(a1),iy1=cy+ir*Math.sin(a1);
    const ix2=cx+ir*Math.cos(a2),iy2=cy+ir*Math.sin(a2);
    return `M ${x1},${y1} A ${r},${r} 0 ${pct>0.5?1:0},1 ${x2},${y2} L ${ix2},${iy2} A ${ir},${ir} 0 ${pct>0.5?1:0},0 ${ix1},${iy1} Z`;
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
    conMarca:data.filter(r=>r.dd&&r.dd.marca==="SÍ").length,
  };
  const tc=tot.empresas?Math.round(tot.c1/tot.empresas*100):0;
  const tr=tot.c1?Math.round(tot.reu/tot.c1*100):0;
  const tp=tot.reu?Math.round(tot.propuesta/tot.reu*100):0;
  const tf=tot.propuesta?Math.round(tot.cierre/tot.propuesta*100):0;
  const ev=data.filter(r=>r.puntaje>0);
  const avg=ev.length?Math.round(ev.reduce((a,r)=>a+r.puntaje,0)/ev.length):0;

  const potData={"Alto potencial":tot.alto,"Potencial medio":tot.medio,"Bajo potencial":tot.bajo,"Descartado":tot.desc};

  const funnelItems=[
    {label:"Total BD",     value:tot.empresas,  pct:100,                                             color:"#6366f1"},
    {label:"1er contacto", value:tot.c1,        pct:tc,                                              color:"#3b82f6"},
    {label:"Con reunión",  value:tot.reu,       pct:tot.c1?Math.round(tot.reu/tot.c1*100):0,       color:"#8b5cf6"},
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
            {label:"Tasa cierre",      val:tot.propuesta?`${tf}%`:"—", color:"#059669"},
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
          <HBarChart items={funnelItems} maxVal={tot.empresas} colors={funnelItems.map(i=>i.color)}/>
          <div style={{marginTop:16,display:"flex",gap:12,fontSize:11,color:"#6b7280",flexWrap:"wrap"}}>
            <span>📞→🤝 Reunión: <strong style={{color:"#8b5cf6"}}>{tr}%</strong></span>
            <span>🤝→📄 Propuesta: <strong style={{color:"#f59e0b"}}>{tp}%</strong></span>
            <span>📄→✅ Cierre: <strong style={{color:"#16a34a"}}>{tf}%</strong></span>
          </div>
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
                        <rect x={bx} y={by} width={barW} height={bh} fill={b.color} rx={4}>
                          <title>{`${m.mes} — ${b.label}: ${b.val}`}</title>
                        </rect>
                        {b.val>0&&<text x={bx+barW/2} y={by-4} textAnchor="middle" fontSize={10} fill="#374151" fontWeight="700">{b.val}</text>}
                      </g>
                    );
                  })}
                  <text x={gx+groupW/2-gap/2} y={148} textAnchor="middle" fontSize={12} fill="#374151" fontWeight="700">{m.mes.slice(0,3)}</text>
                  <text x={gx+groupW/2-gap/2} y={160} textAnchor="middle" fontSize={10} fill="#9ca3af">{m.mes.slice(4)}</text>
                </g>
              );
            })}
          </svg>
          <div style={{display:"flex",gap:14,marginTop:8,flexWrap:"wrap"}}>
            {[["#3b82f6","1er contacto"],["#8b5cf6","2do contacto"],["#22c55e","Reuniones"]].map(([c,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#6b7280"}}>
                <div style={{width:10,height:10,background:c,borderRadius:2}}/>{l}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
        <div style={{flex:"1 1 300px",background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:4}}>🎯 Distribución por Potencial</div>
          <div style={{fontSize:11,color:"#6b7280",marginBottom:14}}>Según evaluación de Debida Diligencia</div>
          <Donut data={potData} colors={PC} size={160}/>
          <div style={{marginTop:16,background:"#f8fafc",borderRadius:8,padding:"10px 14px",display:"flex",gap:20}}>
            <div>
              <div style={{fontSize:11,color:"#6b7280"}}>Score promedio</div>
              <div style={{fontSize:22,fontWeight:800,color:"#6366f1"}}>{avg||"—"}<span style={{fontSize:12,color:"#9ca3af"}}>/100</span></div>
            </div>
            <div>
              <div style={{fontSize:11,color:"#6b7280"}}>Evaluadas en DD</div>
              <div style={{fontSize:22,fontWeight:800,color:"#374151"}}>{ev.length}</div>
            </div>
          </div>
        </div>

        <div style={{flex:"1 1 300px",background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:4}}>🏭 Distribución por Sector</div>
          <div style={{fontSize:11,color:"#6b7280",marginBottom:14}}>Para enfocar campaigns de prospección</div>
          <Donut data={SECTOR_DIST} colors={SC} size={160}/>
          <div style={{marginTop:16,background:"#f8fafc",borderRadius:8,padding:"10px 14px"}}>
            <div style={{fontSize:11,color:"#6b7280",marginBottom:2}}>Sector prioritario — enfocar aquí</div>
            <div style={{fontSize:16,fontWeight:800,color:SC[Object.entries(SECTOR_DIST).sort((a,b)=>b[1]-a[1])[0][0]]||"#374151"}}>
              {Object.entries(SECTOR_DIST).sort((a,b)=>b[1]-a[1])[0][0]}
            </div>
            <div style={{fontSize:11,color:"#9ca3af"}}>{Object.entries(SECTOR_DIST).sort((a,b)=>b[1]-a[1])[0][1]} empresas evaluadas</div>
          </div>
        </div>
      </div>

      <div style={{background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
        <div style={{fontWeight:800,fontSize:15,marginBottom:14,color:"#0f172a"}}>🔥 Ranking por Score — Empresas evaluadas en DD</div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:"#f8fafc",borderBottom:"2px solid #e2e8f0"}}>
                {["#","Score","Empresa","Clasificación","Sector","Ingresos","Tamaño","Proc.Legal","Marca","CRM"].map(h=>(
                  <th key={h} style={{padding:"8px 12px",textAlign:"left",fontWeight:600,color:"#475569",fontSize:12,whiteSpace:"nowrap"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.filter(r=>r.dd&&r.puntaje>0).sort((a,b)=>b.puntaje-a.puntaje).map((r,i)=>{
                const pm=POT_META[r.clasificacion]||POT_META[""];
                const em=ESTADO_META[r.estado]||ESTADO_META[""];
                const hp=procAlert(r.dd);
                const sc=SC[r.dd.sector]||null;
                return(
                  <tr key={r.id} style={{borderBottom:"1px solid #f1f5f9",background:i<3?"#fefce8":"transparent"}}>
                    <td style={{padding:"8px 10px",color:i<3?"#854d0e":"#9ca3af",fontWeight:i<3?800:400,fontSize:12}}>{i+1}</td>
                    <td style={{padding:"8px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:34,height:34,borderRadius:8,background:r.puntaje>=70?"#dcfce7":r.puntaje>=50?"#fef9c3":"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:r.puntaje>=70?"#166534":r.puntaje>=50?"#854d0e":"#991b1b"}}>{r.puntaje}</div>
                      </div>
                    </td>
                    <td style={{padding:"8px 10px",fontWeight:600,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.cliente}</td>
                    <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}><Bdg bg={pm.bg} color={pm.color}>{pm.icon} {r.clasificacion}</Bdg></td>
                    <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>
                      {sc ? <span style={{background:sc,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>{r.dd.sector}</span> : <span style={{color:"#d1d5db"}}>—</span>}
                    </td>
                    <td style={{padding:"8px 10px",whiteSpace:"nowrap",fontWeight:600}}>{fmtM(r.dd.ingresos)}</td>
                    <td style={{padding:"8px 10px"}}>{r.dd.tamano||"—"}</td>
                    <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}>{hp?<span style={{color:"#dc2626",fontWeight:700}}>⚠️ SÍ</span>:<span style={{color:"#16a34a",fontSize:12}}>✅ No</span>}</td>
                    <td style={{padding:"8px 10px"}}>{r.dd.marca==="SÍ"?<span style={{color:"#7c3aed",fontWeight:700}}>™ Sí</span>:<span style={{color:"#9ca3af",fontSize:11}}>No</span>}</td>
                    <td style={{padding:"8px 10px",whiteSpace:"nowrap"}}><Bdg bg={em.bg} color={em.color}>{em.icon} {r.estado||"—"}</Bdg></td>
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

// ── CONFIGURACIÓN DE CREDENCIALES LOGIN ──────────────────────────────────────
const USER_AUTH = "admin"; 
const PASS_AUTH = "Deep2026*"; 

// ── COMPONENTE DE PANTALLA DE LOGIN ──────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (user === USER_AUTH && pass === PASS_AUTH) {
      localStorage.setItem("crm_authenticated", "true");
      onLogin();
    } else {
      setErr("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div style={{
      display: "flex", justifyContent: "center", alignItems: "center", 
      height: "100vh", background: "#f1f5f9", fontFamily: "system-ui, sans-serif"
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#fff", padding: 30, borderRadius: 12, 
        boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)", width: 320
      }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <span style={{ fontSize: 32 }}>💼</span>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginTop: 8, marginBottom: 4 }}>
            Control de Mando
          </h2>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Ingresa tus credenciales de acceso</p>
        </div>

        {err && (
          <div style={{ color: "#991b1b", background: "#fee2e2", padding: "8px 12px", borderRadius: 6, fontSize: 12, marginBottom: 14, fontWeight: 600 }}>
            {err}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>USUARIO</label>
          <input type="text" value={user} onChange={e => setUser(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }} required />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4 }}>CONTRASEÑA</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13, boxSizing: "border-box" }} required />
        </div>

        <button type="submit" style={{ width: "100%", padding: "10px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Iniciar Sesión
        </button>
      </form>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App(){
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem("crm_authenticated") === "true");
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
      let bdT="",reuT="";
      try{
        const [bdR,reuR]=await Promise.all([fetch(BD_URL),fetch(REU_URL)]);
        [bdT,reuT]=await Promise.all([bdR.text(),reuR.text()]);
      }catch(fetchErr){
        console.warn("Fetch failed, using embedded data only:",fetchErr.message);
      }

      const ddByName={"REFORMANTE S.A.S": {"razon_social": "REFORMANTE S.A.S", "nit": "900782042", "sector": "CONSTRUCTOR", "rep_legal": "CAROLINA ALVARADO MARULANDA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://reformantes.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "RIESGO DE LIQUIDEZ, GESTION DE TESORERIA", "puntaje": 48, "clasificacion": "BAJO POTENCIAL"}, "CONSTRUCTORA INGROSSO S.A.S.": {"razon_social": "CONSTRUCTORA INGROSSO S.A.S.", "nit": "900911752", "sector": "CONSTRUCTOR", "rep_legal": "OSORNO HERRERA EMMANUEL", "ingresos": "10000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://constructoraingrosso.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">500 M", "riesgos": "RIESGO LEGAL, RIESGO DE LIQUIDEZ", "puntaje": 60, "clasificacion": "POTENCIAL MEDIO"}, "CONHOGAR S.A.S.": {"razon_social": "CONHOGAR S.A.S.", "nit": "890900836", "sector": "CONSTRUCTOR", "rep_legal": "GERMAN PEREZ MEJIA", "ingresos": "10000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://www.conhogar.co", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "CONJUNTO RESIDENCIAL NATURA PH", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "RIESGO LEGAL, RIESGO DE LIQUIDEZ", "puntaje": 43, "clasificacion": "BAJO POTENCIAL"}, "BORNEO CAPITAL S.A.S.": {"razon_social": "BORNEO CAPITAL S.A.S.", "nit": "901398785", "sector": "HOTELERÍA", "rep_legal": "TOMAS EASTMAN MADRID", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "Riesgo Legal, Riesgo Mercado, Riesgo economico", "puntaje": 58, "clasificacion": "POTENCIAL MEDIO"}};

      let bRows=[];
      if(bdT){
        bRows=parseCSV(bdT);
        localStorage.setItem("crm_cache_bd", JSON.stringify(bRows));
      } else {
        bRows=JSON.parse(localStorage.getItem("crm_cache_bd")||"[]");
      }

      let rRows=[];
      if(reuT){
        rRows=parseCSV(reuT);
        localStorage.setItem("crm_cache_reu", JSON.stringify(rRows));
      } else {
        rRows=JSON.parse(localStorage.getItem("crm_cache_reu")||"[]");
      }
      setReuniones(rRows);

      const reuMap={};
      rRows.forEach(r=>{
        const k=String(r["EMPRESA / CLIENTE"]||"").trim().toLowerCase();
        if(k) reuMap[k]=r;
      });

      const parsed=bRows.map((row,idx)=>{
        const rawCli=row["CLIENTE"]||"";
        const cleanCli=rawCli.replace(/[\d.-]/g,"").replace(/\s+/g," ").trim();
        const kName=cleanCli.toLowerCase();
        
        let dd=null;
        const exactMatch=Object.keys(ddByName).find(k=>k.toLowerCase()===kName);
        if(exactMatch) dd=ddByName[exactMatch];

        const rData=reuMap[kName]||null;

        return {
          id: idx,
          cliente: rawCli,
          nit: cleanNIT(row["NIT"]),
          telefono: row["TELÉFONO"]||"",
          correo: row["CORREO"]||"",
          estado: (row["ESTADO"]||"").trim(),
          interes: row["INTERES / NO INTERES"]||"",
          quien: row["QUIEN INTERVIENE"]||"",
          fecha: row["FECHA"]||"",
          quePaso: row["QUE PASO EN EL LLAMADO / OBSERVACION"]||"",
          notas: row["NOTAS IMPORTANTES CLIENTES"]||"",
          rues: row["RUES"]||"",
          emis: row["EMIS"]||"",
          dd: dd,
          puntaje: dd?dd.puntaje:0,
          clasificacion: dd?dd.clasificacion:(row["POTENCIAL"]||""),
          contacto1: row["1 CONTACTO"]==="SÍ",
          contacto2: row["2 CONTACTO"]==="SÍ",
          tiene_reunion: rData?true:false,
          reunion_comentarios: rData?rData["COMENTARIOS / ACUERDOS"]:""
        };
      });

      setLastUpdate(new Date().toLocaleTimeString());
      setData(parsed);
    }catch(err){
      setError(err.message);
    }finally{
      setLoading(false);
    }
  };

  useEffect(()=>{
    if(isAuthenticated) {
      fetchData();
    }
  },[isAuthenticated]);

  const filtered=useMemo(()=>{
    return data.filter(r=>{
      const matchesSearch=!search || r.cliente.toLowerCase().includes(search.toLowerCase()) || r.nit.includes(search);
      const matchesEstado=fEstado==="TODOS" || (fEstado==="Sin estado"? !r.estado : r.estado===fEstado);
      const matchesPot=fPot==="TODOS" || (fPot==="Sin evaluar"? !r.clasificacion : r.clasificacion===fPot);
      const matchesQuien=fQuien==="TODOS" || r.quien===fQuien;
      return matchesSearch && matchesEstado && matchesPot && matchesQuien;
    });
  },[data,search,fEstado,fPot,fQuien]);

  const users=useMemo(()=>{
    const u=new Set(); data.forEach(r=>{if(r.quien)u.add(r.quien);}); return ["TODOS",...Array.from(u)];
  },[data]);

  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return(
    <div style={{padding:20,fontFamily:"system-ui, sans-serif",background:"#f8fafc"}}>
      <div style={{maxWidth:1300,margin:"0 auto"}}>
        
        {/* HEADER CONTROLS */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fff",padding:"14px 20px",borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,.05)",marginBottom:20,flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setTab("crm")} style={{padding:"8px 16px",background:tab==="crm"?"#6366f1":"#fff",color:tab==="crm"?"#fff":"#475569",border:"1px solid #cbd5e1",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"}}>💼 CRM Principal</button>
            <button onClick={()=>setTab("metricas")} style={{padding:"8px 16px",background:tab==="metricas"?"#6366f1":"#fff",color:tab==="metricas"?"#fff":"#475569",border:"1px solid #cbd5e1",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"}}>📈 Métricas</button>
          </div>
          
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {lastUpdate&&<span style={{fontSize:11,color:"#9ca3af"}}>Actualizado: {lastUpdate}</span>}
            <button onClick={fetchData} disabled={loading} style={{padding:"8px 14px",background:"#1e293b",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"}}>{loading?"Cargando...":"🔄 Actualizar"}</button>
            <button 
              onClick={() => {
                localStorage.removeItem("crm_authenticated");
                setIsAuthenticated(false);
              }} 
              style={{ padding: "8px 14px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              🔒 Cerrar Sesión
            </button>
          </div>
        </div>

        {error&&<div style={{background:"#fee2e2",color:"#991b1b",padding:14,borderRadius:10,marginBottom:20,fontSize:13,fontWeight:600}}>⚠️ Error de sincronización: {error} (Mostrando datos locales)</div>}

        {tab==="metricas" ? (
          <Metricas data={data}/>
        ) : (
          <>
            {/* FILTROS CRM */}
            <div style={{background:"#fff",padding:16,borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,.05)",marginBottom:16,display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{flex:1,minWidth:200}}><input type="text" placeholder="🔍 Buscar cliente, NIT..." value={search} onChange={e=>setSearch(e.target.value)} style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid #cbd5e1",fontSize:13,boxSizing:"border-box"}}/></div>
              <div><select value={fEstado} onChange={e=>setFEstado(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #cbd5e1",fontSize:13,background:"#fff"}}>{ESTADOS.map(e=><option key={e} value={e}>{e}</option>)}</select></div>
              <div><select value={fPot} onChange={e=>setFPot(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #cbd5e1",fontSize:13,background:"#fff"}}>{POTS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
              <div><select value={fQuien} onChange={e=>setFQuien(e.target.value)} style={{padding:"8px 12px",borderRadius:8,border:"1px solid #cbd5e1",fontSize:13,background:"#fff"}}>{users.map(u=><option key={u} value={u}>{u==="TODOS"?"Todos los asesores":u}</option>)}</select></div>
              <div style={{fontSize:12,color:"#6b7280",fontWeight:600}}>{filtered.length} encontradas</div>
            </div>

            {/* TABLA PRINCIPAL */}
            <div style={{display:"flex",gap:20,alignItems:"flex-start"}}>
              <div style={{flex:1,background:"#fff",borderRadius:12,boxShadow:"0 1px 3px rgba(0,0,0,.05)",overflow:"hidden"}}>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",textAlign:"left",fontSize:13}}>
                    <thead>
                      <tr style={{background:"#f8fafc",borderBottom:"1px solid #e2e8f0",color:"#475569",fontSize:12,fontWeight:600}}>
                        <th style={{padding:"11px 14px"}}>Empresa / Cliente</th>
                        <th style={{padding:"11px 14px"}}>NIT</th>
                        <th style={{padding:"11px 14px"}}>Score</th>
                        <th style={{padding:"11px 14px"}}>Potencial</th>
                        <th style={{padding:"11px 14px"}}>Estado CRM</th>
                        <th style={{padding:"11px 11px",textAlign:"center"}}>C1</th>
                        <th style={{padding:"11px 11px",textAlign:"center"}}>C2</th>
                        <th style={{padding:"11px 11px",textAlign:"center"}}>Reu</th>
                        <th style={{padding:"11px 11px",textAlign:"center"}}>Cierre</th>
                        <th style={{padding:"11px 14px"}}>Asesor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.sort((a,b)=>b.puntaje - a.puntaje).map(r=>{
                        const em=ESTADO_META[r.estado]||ESTADO_META[""];
                        const pm=POT_META[r.clasificacion]||POT_META[""];
                        const isSel=selected?.id===r.id;
                        return(
                          <tr key={r.id} onClick={()=>setSelected(r)} style={{borderBottom:"1px solid #f1f5f9",cursor:"pointer",background:isSel?"#eff6ff":(r.dd?"#f8fafc":"transparent"),transition:"background .15s"}}>
                            <td style={{padding:"9px 14px",fontWeight:600,color:"#1e293b",maxWidth:220,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.cliente}</td>
                            <td style={{padding:"9px 14px",color:"#6b7280",fontFamily:"monospace"}}>{r.nit||"—"}</td>
                            <td style={{padding:"9px 14px"}}>
                              {r.puntaje>0 ? <span style={{fontWeight:800,color:r.puntaje>=70?"#166534":r.puntaje>=50?"#854d0e":"#991b1b",background:r.puntaje>=70?"#dcfce7":r.puntaje>=50?"#fef9c3":"#fee2e2",padding:"2px 6px",borderRadius:4}}>{r.puntaje}</span> : <span style={{color:"#d1d5db"}}>—</span>}
                            </td>
                            <td style={{padding:"9px 14px"}}>{r.clasificacion ? <Bdg bg={pm.bg} color={pm.color}>{pm.icon} {r.clasificacion}</Bdg> : <span style={{color:"#94a3b8"}}>—</span>}</td>
                            <td style={{padding:"9px 14px"}}><Bdg bg={em.bg} color={em.color}>{em.icon} {r.estado||"Sin estado"}</Bdg></td>
                            <td style={{padding:"9px 11px",textAlign:"center"}}>{r.contacto1?<span style={{color:"#22c55e",fontWeight:700}}>✓</span>:<span style={{color:"#d1d5db"}}>—</span>}</td>
                            <td style={{padding:"9px 11px",textAlign:"center"}}>{r.contacto2?<span style={{color:"#3b82f6",fontWeight:700}}>✓</span>:<span style={{color:"#d1d5db"}}>—</span>}</td>
                            <td style={{padding:"9px 11px",textAlign:"center"}}>{r.tiene_reunion?<span title="Reunión realizada">🤝</span>:<span style={{color:"#d1d5db"}}>—</span>}</td>
                            <td style={{padding:"9px 11px",textAlign:"center"}}>{r.cierre?<span style={{fontWeight:700,color:"#16a34a"}}>✅</span>:<span style={{color:"#d1d5db"}}>—</span>}</td>
                            <td style={{padding:"9px 11px",color:"#6b7280",fontSize:12}}>{r.quien||"—"}</td>
                          </tr>
                        );
                      })}
                      {filtered.length===0&&<tr><td colSpan={10} style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Sin resultados</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              {selected&&<Detail c={selected} onClose={()=>setSelected(null)}/>}
            </div>
            <div style={{marginTop:14,fontSize:11,color:"#9ca3af",textAlign:"center"}}>Las empresas con DD aparecen primero, ordenadas por score · Edita Google Sheets y presiona "Actualizar"</div>
          </>
        )}
      </div>
    </div>
  );
}

```
