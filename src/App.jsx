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

// Full CSV parser that handles quoted cells containing literal newlines
// (Google Sheets exports headers like "TAMAÑO\nCORPORATIVO" with a REAL \n inside quotes,
// which breaks naive text.split("\n")). This walks char-by-char across the WHOLE text.
function parseFullCSV(text){
  const rows=[]; let row=[]; let c=""; let q=false; let i=0;
  while(i<text.length){
    const ch=text[i];
    if(q){
      if(ch==='"'){
        if(text[i+1]==='"'){c+='"';i+=2;continue;}
        q=false;i++;continue;
      }
      c+=ch;i++;continue;
    }else{
      if(ch==='"'){q=true;i++;continue;}
      if(ch===','){row.push(c);c="";i++;continue;}
      if(ch==='\r'){i++;continue;}
      if(ch==='\n'){row.push(c);c="";rows.push(row);row=[];i++;continue;}
      c+=ch;i++;continue;
    }
  }
  if(c.length>0||row.length>0){row.push(c);rows.push(row);}
  return rows.filter(r=>r.some(c=>c.trim().length>0));
}
function parseCSV(text, headerMustHave=["CLIENTE","ESTADO"]){
  const rows=parseFullCSV(text);
  // Find header row: must have ALL labels in headerMustHave as exact cells (not substring)
  let hi=rows.findIndex(cells=>headerMustHave.every(req=>cells.some(c=>c.trim()===req)));
  console.log("parseCSV: total rows=",rows.length,"header at index=",hi,"looking for=",headerMustHave);
  if(hi===-1){
    hi=rows.findIndex(cells=>cells.some(c=>c.trim()===headerMustHave[0]));
    if(hi===-1)hi=1;
  }
  const hdrs=rows[hi].map(h=>h.trim());
  return rows.slice(hi+1).map(cols=>{
    const o={}; hdrs.forEach((h,j)=>o[h]=(cols[j]||"").trim()); return o;
  });
}
function parseRaw(text){
  return parseFullCSV(text).filter(r=>r.length>1);
}
function cleanNIT(x){
  if(!x||x==="nan"||x==="0")return"";
  // Handle both string and float format (901214227 or 901214227.0)
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
// IMPORTANTE: ya no hay datos hardcodeados aquí. MONTHLY y SECTOR_DIST se calculan
// 100% en vivo dentro de Metricas() a partir de `data`, sin importar cuántas filas
// tenga el Sheet (1, 144, o 1 millón).
const SC_PALETTE=["#3b82f6","#8b5cf6","#f59e0b","#22c55e","#f97316","#ec4899","#06b6d4","#eab308","#14b8a6","#a855f7","#ef4444","#84cc16"];
function colorForSector(sector,sectorList){
  // Asigna un color estable según el orden alfabético de los sectores presentes,
  // así nuevos sectores que aparezcan en el Sheet siempre tienen color consistente
  const idx=sectorList.indexOf(sector);
  return SC_PALETTE[idx % SC_PALETTE.length]||"#94a3b8";
}
const PC={"Alto potencial":"#22c55e","Potencial medio":"#f59e0b","Bajo potencial":"#ef4444","Descartado":"#9ca3af"};

function fmtM(n){
  if(!n||n==="nan")return"—";
  const v=parseFloat(n);if(isNaN(v))return"—";
  if(v>=1e12)return`$${(v/1e12).toFixed(0)}B`;
  if(v>=1e9)return`$${(v/1e9).toFixed(1)}MM`;
  if(v>=1e6)return`$${(v/1e6).toFixed(0)}M`;
  return`$${v.toLocaleString("es-CO")}`;
}

// Horizontal bar chart — clean and readable
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

// Clean donut chart
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

function Metricas({data}){
  // ── Sectores 100% en vivo: cuenta cualquier sector presente en `data`, sin importar
  // cuántos registros haya o qué sectores nuevos aparezcan en el Sheet ──
  const SECTOR_DIST={};
  data.forEach(r=>{
    if(r.dd&&r.dd.sector){
      SECTOR_DIST[r.dd.sector]=(SECTOR_DIST[r.dd.sector]||0)+1;
    }
  });
  const sectorList=Object.keys(SECTOR_DIST).sort();
  const SC={};
  sectorList.forEach(s=>{SC[s]=colorForSector(s,sectorList);});

  // ── Actividad mensual 100% en vivo: agrupa por mes/año a partir de la columna FECHA
  // de cada registro (y de las reuniones), sin asumir ningún mes fijo ──
  const monthMap={};
  const parseFechaToKey=(f)=>{
    if(!f)return null;
    // Soporta formatos DD/MM/YYYY y fechas largas en español
    const m1=f.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if(m1)return `${m1[3]}-${m1[2].padStart(2,"0")}`;
    const meses={"enero":"01","febrero":"02","marzo":"03","abril":"04","mayo":"05","junio":"06","julio":"07","agosto":"08","septiembre":"09","octubre":"10","noviembre":"11","diciembre":"12"};
    const m2=f.toLowerCase().match(/de\s+(\w+)\s+de\s+(\d{4})/);
    if(m2&&meses[m2[1]])return `${m2[2]}-${meses[m2[1]]}`;
    return null;
  };
  const ensureMonth=(key)=>{
    if(!monthMap[key])monthMap[key]={key,c1:0,c2:0,reu:0};
    return monthMap[key];
  };
  data.forEach(r=>{
    const key=parseFechaToKey(r.fecha);
    if(key){
      if(r.contacto1)ensureMonth(key).c1++;
      if(r.contacto2)ensureMonth(key).c2++;
    }
  });
  data.forEach(r=>{
    if(r.tiene_reunion){
      const key=parseFechaToKey(r.fecha)||parseFechaToKey(r.reunion_comentarios);
      if(key)ensureMonth(key).reu++;
      else{
        // Si no hay fecha parseable, igual contamos la reunión en un bucket "Sin fecha"
        ensureMonth("zzz-sf").reu++;
      }
    }
  });
  const MESES_NOMBRE={"01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun","07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic"};
  const MONTHLY=Object.values(monthMap)
    .filter(m=>m.key!=="zzz-sf")
    .sort((a,b)=>a.key.localeCompare(b.key))
    .map(m=>{
      const [yr,mo]=m.key.split("-");
      return {mes:`${MESES_NOMBRE[mo]||mo} '${yr.slice(2)}`, c1:m.c1, c2:m.c2, reu:m.reu};
    });

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
  // tr usa el máximo entre c1 y reu como base, para que nunca pase de 100%
  // (las reuniones que vienen de REUNIONES Y CIERRE sin "1er contacto" formal en BD
  // no deben inflar la tasa por encima de lo lógico)
  const baseReu=Math.max(tot.c1,tot.reu)||1;
  const tr=Math.round(tot.reu/baseReu*100);
  const tp=tot.reu?Math.round(tot.propuesta/tot.reu*100):0;
  const tf=tot.propuesta?Math.round(tot.cierre/tot.propuesta*100):0;
  const ev=data.filter(r=>r.puntaje>0);
  const avg=ev.length?Math.round(ev.reduce((a,r)=>a+r.puntaje,0)/ev.length):0;

  const potData={"Alto potencial":tot.alto,"Potencial medio":tot.medio,"Bajo potencial":tot.bajo,"Descartado":tot.desc};

  // Conversion funnel data for horizontal bars
  const funnelItems=[
    {label:"Total BD",     value:tot.empresas,  pct:100,                                           color:"#6366f1"},
    {label:"1er contacto", value:tot.c1,        pct:tc,                                            color:"#3b82f6"},
    {label:"Con reunión",  value:tot.reu,       pct:tr,       color:"#8b5cf6"},
    {label:"Propuesta",    value:tot.propuesta, pct:tot.reu?Math.round(tot.propuesta/tot.reu*100):0, color:"#f59e0b"},
    {label:"Cierre",       value:tot.cierre,    pct:tot.propuesta?Math.round(tot.cierre/tot.propuesta*100):0, color:"#16a34a"},
  ];

  // Monthly grouped bar data — build as SVG
  const months=MONTHLY;
  const maxM=Math.max(...months.flatMap(m=>[m.c1,m.c2,m.reu]),1);
  const barW=36, gap=24, groupW=barW*3+gap;

  return(
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* ── ROW 1: KPIs ── */}
      <div style={{background:"#fff",borderRadius:12,padding:24,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
        <div style={{fontWeight:800,fontSize:16,marginBottom:16,color:"#0f172a"}}>📊 Resumen General</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {[
            {label:"Total empresas",   val:tot.empresas, color:"#6366f1"},
            {label:"1er contacto",     val:`${tot.c1} (${tc}%)`, color:"#3b82f6"},
            {label:"🤝 Con reunión",   val:`${tot.reu} (${tr}%)`,    color:"#8b5cf6"},
            {label:"📄 Propuesta",     val:`${tot.propuesta} (${tp}%)`, color:"#f59e0b"},
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

      {/* ── ROW 2: Funnel + Monthly ── */}
      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>

        {/* Funnel embudo */}
        <div style={{flex:"1 1 300px",background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:16}}>🔽 Embudo de Conversión</div>
          <HBarChart
            items={funnelItems}
            maxVal={tot.empresas}
            colors={funnelItems.map(i=>i.color)}
          />
          <div style={{marginTop:16,display:"flex",gap:12,fontSize:11,color:"#6b7280",flexWrap:"wrap"}}>
            <span>📞→🤝 Reunión: <strong style={{color:"#8b5cf6"}}>{tr}%</strong></span>
            <span>🤝→📄 Propuesta: <strong style={{color:"#f59e0b"}}>{tp}%</strong></span>
            <span>📄→✅ Cierre: <strong style={{color:"#16a34a"}}>{tf}%</strong></span>
          </div>
        </div>

        {/* Monthly grouped bars — clean SVG */}
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

      {/* ── ROW 3: Donuts ── */}
      <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>

        {/* Potencial */}
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

        {/* Sector */}
        <div style={{flex:"1 1 300px",background:"#fff",borderRadius:12,padding:20,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
          <div style={{fontWeight:700,fontSize:14,color:"#0f172a",marginBottom:4}}>🏭 Distribución por Sector</div>
          <div style={{fontSize:11,color:"#6b7280",marginBottom:14}}>Para enfocar campañas de prospección</div>
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

      {/* ── ROW 4: Ranking ── */}
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
                      {sc
                        ? <span style={{background:sc,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>{r.dd.sector}</span>
                        : <span style={{color:"#d1d5db"}}>—</span>}
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
      // Fetch BD and REU — handle failures gracefully
      let bdT="",reuT="",ddT="";
      try{
        const [bdR,reuR,ddR]=await Promise.all([fetch(BD_URL),fetch(REU_URL),fetch(DD_URL)]);
        [bdT,reuT,ddT]=await Promise.all([bdR.text(),reuR.text(),ddR.text()]);
        console.log("Fetched live: BD=",bdT.length,"REU=",reuT.length,"DD=",ddT.length);
      }catch(fetchErr){
        console.error("Fetch en vivo falló:",fetchErr.message);
        setError("No se pudo conectar con Google Sheets en este momento. Los datos mostrados pueden estar desactualizados. Verifica tu conexión y presiona Actualizar de nuevo. Detalle: "+fetchErr.message);
      }

      // ── DD data embedded from Excel (exact NIT or name match only) ──
      const ddByName={"REFORMANTE S.A.S": {"razon_social": "REFORMANTE S.A.S", "nit": "900782042", "sector": "CONSTRUCTOR", "rep_legal": "CAROLINA ALVARADO MARULANDA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://reformantes.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "RIESGO DE LIQUIDEZ, GESTION DE TESORERIA", "puntaje": 48, "clasificacion": "BAJO POTENCIAL"}, "CONSTRUCTORA INGROSSO S.A.S.": {"razon_social": "CONSTRUCTORA INGROSSO S.A.S.", "nit": "900911752", "sector": "CONSTRUCTOR", "rep_legal": "OSORNO HERRERA EMMANUEL", "ingresos": "10000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://constructoraingrosso.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">500 M", "riesgos": "RIESGO LEGAL, RIESGO DE LIQUIDEZ", "puntaje": 60, "clasificacion": "POTENCIAL MEDIO"}, "CONHOGAR S.A.S.": {"razon_social": "CONHOGAR S.A.S.", "nit": "890900836", "sector": "CONSTRUCTOR", "rep_legal": "GERMAN PEREZ MEJIA", "ingresos": "10000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://www.conhogar.co", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "CONJUNTO RESIDENCIAL NATURA PH", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "RIESGO LEGAL, RIESGO DE LIQUIDEZ", "puntaje": 43, "clasificacion": "BAJO POTENCIAL"}, "BORNEO CAPITAL S.A.S.": {"razon_social": "BORNEO CAPITAL S.A.S.", "nit": "901398785", "sector": "HOTELERÍA", "rep_legal": "TOMAS EASTMAN MADRID", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "Riesgo Legal, Riesgo Mercado, Riesgo economico", "puntaje": 58, "clasificacion": "POTENCIAL MEDIO"}, "INVERSIONES PINAR DEL RODEO S.A.S": {"razon_social": "INVERSIONES PINAR DEL RODEO S.A.S", "nit": "901183489", "sector": "CONSTRUCTOR", "rep_legal": "MEJIA SARRAZOLA MARY LUZ", "ingresos": "500000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 38, "clasificacion": "BAJO POTENCIAL"}, "CONSTRUCCIONES Y URBANIZACIONES L.G S.A.S": {"razon_social": "CONSTRUCCIONES Y URBANIZACIONES L.G S.A.S", "nit": "900450388", "sector": "CONSTRUCTOR", "rep_legal": "GARCIA ANGARITA LIBARDO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://construccionesyurbanizaciones.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 60, "clasificacion": "POTENCIAL MEDIO"}, "CIRCULO INMOBILIARIA DEL SUR S.A.S.": {"razon_social": "CIRCULO INMOBILIARIA DEL SUR S.A.S.", "nit": "901555099", "sector": "INMOBILIARIO", "rep_legal": "SEPULVEDA PALACIO CARLOS ALBERTO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://www.circuloinmobiliariodelsur.co", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">500 M", "riesgos": "Riesgo Legal, Riesgo de Mercado Oferta y Demanda", "puntaje": 60, "clasificacion": "POTENCIAL MEDIO"}, "MONTACARGAS AM&M S.A.S.": {"razon_social": "MONTACARGAS AM&M S.A.S.", "nit": "811014849", "sector": "SERVICIOS", "rep_legal": "IRMA STELLA BLANDON MONTES", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "501", "tiene_web": "SÍ", "url_web": "https://montacargasamym.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "EPM, Sumas de dinero y Laboral", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 90, "clasificacion": "ALTO POTENCIAL"}, "LANGUAGE CENTERS NETWORK S.A.S.": {"razon_social": "LANGUAGE CENTERS NETWORK S.A.S.", "nit": "900430124", "sector": "SERVICIOS", "rep_legal": "PATRICIA BATISTA CANELON", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "11", "tiene_web": "SÍ", "url_web": "https://lcnidiomas.edu.co", "marca": "SÍ", "proc_rl": "SÍ", "proc_rl_sup": "SÍ", "proc_empresa": "SÍ", "detalle_proc": "tutelas, garantías, laboral", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 56, "clasificacion": "POTENCIAL MEDIO"}, "ADA S.A.S.": {"razon_social": "ADA S.A.S.", "nit": "800167494", "sector": "TECNOLOGÍA", "rep_legal": "CESAR AUGUSTO ECHEVERRI PEREZ", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "200", "tiene_web": "SÍ", "url_web": "https://ada.co", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "Laboral, sumas de dinero", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 61, "clasificacion": "POTENCIAL MEDIO"}, "GRUPO NUTRY S.A.S.": {"razon_social": "GRUPO NUTRY S.A.S.", "nit": "901214227", "sector": "COMERCIAL", "rep_legal": "JULIAN FRANCESCO RESTREPO ARIAS", "ingresos": "2000000000", "tamano": "MICRO", "empleados": ">15", "tiene_web": "SÍ", "url_web": "https://gruponutry.com", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 88, "clasificacion": "ALTO POTENCIAL"}, "HMV INGENIEROS LTDA.": {"razon_social": "HMV INGENIEROS LTDA.", "nit": "860000656", "sector": "TECNOLOGÍA", "rep_legal": "WILLIAM PAREDES FORERO", "ingresos": "10000000000000", "tamano": "GRANDE", "empleados": ">500", "tiene_web": "SÍ", "url_web": "https://www.h-mv.com", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "SÍ", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 93, "clasificacion": "ALTO POTENCIAL"}, "OFIMA S.A.S.": {"razon_social": "OFIMA S.A.S.", "nit": "800132302", "sector": "TECNOLOGÍA", "rep_legal": "MARCO ANTONIO CARRASQUILLA", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": "51", "tiene_web": "SÍ", "url_web": "https://www.ofima.com", "marca": "SÍ", "proc_rl": "SÍ", "proc_rl_sup": "SÍ", "proc_empresa": "SÍ", "detalle_proc": "De ejecucion, TUTELAS", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 75, "clasificacion": "ALTO POTENCIAL"}, "OHANA COMPANY S.A.S.": {"razon_social": "OHANA COMPANY S.A.S.", "nit": "901424683", "sector": "INMOBILIARIO", "rep_legal": "ERICH GOTTLIEB MASSMANN SANABRIA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "NO", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 45, "clasificacion": "BAJO POTENCIAL"}, "INVERSORA LIRIO S.A.S.": {"razon_social": "INVERSORA LIRIO S.A.S.", "nit": "901497064", "sector": "INMOBILIARIO", "rep_legal": "JUAN CARLOS LOPEZ DIEZ", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "Riesgo Legal, Riesgo de Mercado Oferta y Demanda", "puntaje": 48, "clasificacion": "BAJO POTENCIAL"}, "CADENA COMERCIAL OXXO COLOMBIA S.A.S": {"razon_social": "CADENA COMERCIAL OXXO COLOMBIA S.A.S", "nit": "900236520", "sector": "SERVICIOS", "rep_legal": "ANDRES MORALES", "ingresos": "10000000000000", "tamano": "GRANDE", "empleados": "N/A", "tiene_web": "SÍ", "url_web": "https://colombia.oxxodomicilios.com", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 98, "clasificacion": "ALTO POTENCIAL"}, "IMTAMAR S.A.S.": {"razon_social": "IMTAMAR S.A.S.", "nit": "901529751", "sector": "INMOBILIARIO", "rep_legal": "IVONNE ESCAF DE SALDARRIAGA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "NO", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 45, "clasificacion": "BAJO POTENCIAL"}, "RESTCAFE S.A.S": {"razon_social": "RESTCAFE S.A.S", "nit": "800213075", "sector": "SERVICIOS", "rep_legal": "Marlon Masis Campos", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "482", "tiene_web": "SÍ", "url_web": "https://www.cafeoma.com", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 78, "clasificacion": "ALTO POTENCIAL"}, "CONSTRUCCIONES ROJAS Y ALVAREZ S.A.S.": {"razon_social": "CONSTRUCCIONES ROJAS Y ALVAREZ S.A.S.", "nit": "901778642", "sector": "CONSTRUCTOR", "rep_legal": "HERNAN DE JESUS ROJAS TEJADA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "NO", "patrimonio": ">100 M", "riesgos": "", "puntaje": 30, "clasificacion": "BAJO POTENCIAL"}, "INVERSIONES LOS PERRITOS DEL MONO S.A.S.": {"razon_social": "INVERSIONES LOS PERRITOS DEL MONO S.A.S.", "nit": "901637324", "sector": "COMERCIAL", "rep_legal": "ANDRES FELIPE PELAEZ AGUDELO", "ingresos": "20000000000", "tamano": "PEQUEÑA", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://losperritosdelmono.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 61, "clasificacion": "POTENCIAL MEDIO"}, "AGUA BENDITA S.A.S": {"razon_social": "AGUA BENDITA S.A.S", "nit": "811044893", "sector": "TEXTIL", "rep_legal": "HINESTROZA MONTOYA MARIANA", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://www.aguabendita.com.co", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 86, "clasificacion": "ALTO POTENCIAL"}, "GESTION INMOBILIARIA MIC S.A.S.": {"razon_social": "GESTION INMOBILIARIA MIC S.A.S.", "nit": "900778625", "sector": "INMOBILIARIO", "rep_legal": "Camargo Delgado Maria Ines", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "SÍ", "url_web": "https://micinmobiliaria.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 48, "clasificacion": "BAJO POTENCIAL"}, "RICHOUSE INMOBILIARIA SAS": {"razon_social": "RICHOUSE INMOBILIARIA SAS", "nit": "901554815", "sector": "INMOBILIARIO", "rep_legal": "LUX MIRTA ESPITIA CHAPARRO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "SÍ", "url_web": "https://www.richouseinmobiliaria.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 38, "clasificacion": "BAJO POTENCIAL"}, "INMOBILIARIA GOMEZ Y ASOCIADOS S.A.S.": {"razon_social": "INMOBILIARIA GOMEZ Y ASOCIADOS S.A.S.", "nit": "900009803", "sector": "INMOBILIARIO", "rep_legal": "LUZ DARY GOMEZ OSPINA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://gomezyasociados.com.co", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">100 M", "riesgos": "", "puntaje": 45, "clasificacion": "BAJO POTENCIAL"}, "MAGI GROUP SAS": {"razon_social": "MAGI GROUP SAS", "nit": "901871794", "sector": "TEXTIL", "rep_legal": "MARLYN PELAEZ AREVALO", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": ">20", "tiene_web": "SÍ", "url_web": "", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">50 M", "riesgos": "", "puntaje": 63, "clasificacion": "POTENCIAL MEDIO"}, "INVERSIONES BLO S.A.S": {"razon_social": "INVERSIONES BLO S.A.S", "nit": "901166382", "sector": "TEXTIL", "rep_legal": "Wilingthon Ortiz Jaramillo", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": ">50", "tiene_web": "SÍ", "url_web": "", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 58, "clasificacion": "POTENCIAL MEDIO"}, "AUNA COLOMBIA S.A.S.": {"razon_social": "AUNA COLOMBIA S.A.S.", "nit": "901212102", "sector": "SERVICIOS", "rep_legal": "JUAN GONZALO ALVAREZ RESTREPO", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "SÍ", "url_web": "", "marca": "NO", "proc_rl": "SIN INFORMACIÓN", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SIN INFORMACIÓN", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 58, "clasificacion": "POTENCIAL MEDIO"}, "INVERSIONES FALABELLA DE COLOMBIA S.A": {"razon_social": "INVERSIONES FALABELLA DE COLOMBIA S.A", "nit": "900017459", "sector": "SERVICIOS", "rep_legal": "Rodrigo Agustin Fajardo Zilleruelo", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "SIN INFORMACIÓN", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SIN INFORMACIÓN", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 55, "clasificacion": "POTENCIAL MEDIO"}, "EMPRESA TRANSPORTADORA SAN GABRIEL S.A.S.": {"razon_social": "EMPRESA TRANSPORTADORA SAN GABRIEL S.A.S.", "nit": "900759329", "sector": "SERVICIOS", "rep_legal": "Castro Vega Diana Paola", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "SÍ", "url_web": "https://www.etsg.com.co", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 65, "clasificacion": "POTENCIAL MEDIO"}, "CONSTRUCTORA INMOBILIARIA HABITAT DE LOS ANDES SAS": {"razon_social": "CONSTRUCTORA INMOBILIARIA HABITAT DE LOS ANDES SAS", "nit": "901875692", "sector": "CONSTRUCTOR", "rep_legal": "PEÑA PIÑEROS JORGE", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "SÍ", "url_web": "https://habitatdelosandes.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 75, "clasificacion": "ALTO POTENCIAL"}, "REVOLUT BANK COLOMBIA S.A.": {"razon_social": "REVOLUT BANK COLOMBIA S.A.", "nit": "902002134", "sector": "TECNOLOGÍA", "rep_legal": "Diego Caicedo Mosquera", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "SÍ", "url_web": "https://www.revolut.com/es-CO/", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "Supervisión SFC, riesgos regulatorios, LAFT", "puntaje": 83, "clasificacion": "ALTO POTENCIAL"}, "MANUFACTURAS AMALU S.A.S": {"razon_social": "MANUFACTURAS AMALU S.A.S", "nit": "901285773", "sector": "TEXTIL", "rep_legal": "CESAR AUGUSTO SERNA CASTAÑO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://fajasamalu.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "NO", "patrimonio": ">100 M", "riesgos": "", "puntaje": 40, "clasificacion": "BAJO POTENCIAL"}, "LINDA MIA MODA INFANTIL S.A.S.": {"razon_social": "LINDA MIA MODA INFANTIL S.A.S.", "nit": "901814061", "sector": "TEXTIL", "rep_legal": "ANA MILENA CAMACHO HENAO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://lindamia.co", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 48, "clasificacion": "BAJO POTENCIAL"}};
      const ddByNit={"900782042": {"razon_social": "REFORMANTE S.A.S", "nit": "900782042", "sector": "CONSTRUCTOR", "rep_legal": "CAROLINA ALVARADO MARULANDA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://reformantes.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "RIESGO DE LIQUIDEZ, GESTION DE TESORERIA", "puntaje": 48, "clasificacion": "BAJO POTENCIAL"}, "900911752": {"razon_social": "CONSTRUCTORA INGROSSO S.A.S.", "nit": "900911752", "sector": "CONSTRUCTOR", "rep_legal": "OSORNO HERRERA EMMANUEL", "ingresos": "10000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://constructoraingrosso.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">500 M", "riesgos": "RIESGO LEGAL, RIESGO DE LIQUIDEZ", "puntaje": 60, "clasificacion": "POTENCIAL MEDIO"}, "890900836": {"razon_social": "CONHOGAR S.A.S.", "nit": "890900836", "sector": "CONSTRUCTOR", "rep_legal": "GERMAN PEREZ MEJIA", "ingresos": "10000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://www.conhogar.co", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "CONJUNTO RESIDENCIAL NATURA PH", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "RIESGO LEGAL, RIESGO DE LIQUIDEZ", "puntaje": 43, "clasificacion": "BAJO POTENCIAL"}, "901398785": {"razon_social": "BORNEO CAPITAL S.A.S.", "nit": "901398785", "sector": "HOTELERÍA", "rep_legal": "TOMAS EASTMAN MADRID", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": ">10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "Riesgo Legal, Riesgo Mercado, Riesgo economico", "puntaje": 58, "clasificacion": "POTENCIAL MEDIO"}, "901183489": {"razon_social": "INVERSIONES PINAR DEL RODEO S.A.S", "nit": "901183489", "sector": "CONSTRUCTOR", "rep_legal": "MEJIA SARRAZOLA MARY LUZ", "ingresos": "500000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 38, "clasificacion": "BAJO POTENCIAL"}, "900450388": {"razon_social": "CONSTRUCCIONES Y URBANIZACIONES L.G S.A.S", "nit": "900450388", "sector": "CONSTRUCTOR", "rep_legal": "GARCIA ANGARITA LIBARDO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://construccionesyurbanizaciones.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 60, "clasificacion": "POTENCIAL MEDIO"}, "901555099": {"razon_social": "CIRCULO INMOBILIARIA DEL SUR S.A.S.", "nit": "901555099", "sector": "INMOBILIARIO", "rep_legal": "SEPULVEDA PALACIO CARLOS ALBERTO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": "<10", "tiene_web": "SÍ", "url_web": "https://www.circuloinmobiliariodelsur.co", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">500 M", "riesgos": "Riesgo Legal, Riesgo de Mercado Oferta y Demanda", "puntaje": 60, "clasificacion": "POTENCIAL MEDIO"}, "811014849": {"razon_social": "MONTACARGAS AM&M S.A.S.", "nit": "811014849", "sector": "SERVICIOS", "rep_legal": "IRMA STELLA BLANDON MONTES", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "501", "tiene_web": "SÍ", "url_web": "https://montacargasamym.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "EPM, Sumas de dinero y Laboral", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 90, "clasificacion": "ALTO POTENCIAL"}, "900430124": {"razon_social": "LANGUAGE CENTERS NETWORK S.A.S.", "nit": "900430124", "sector": "SERVICIOS", "rep_legal": "PATRICIA BATISTA CANELON", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "11", "tiene_web": "SÍ", "url_web": "https://lcnidiomas.edu.co", "marca": "SÍ", "proc_rl": "SÍ", "proc_rl_sup": "SÍ", "proc_empresa": "SÍ", "detalle_proc": "tutelas, garantías, laboral", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 56, "clasificacion": "POTENCIAL MEDIO"}, "800167494": {"razon_social": "ADA S.A.S.", "nit": "800167494", "sector": "TECNOLOGÍA", "rep_legal": "CESAR AUGUSTO ECHEVERRI PEREZ", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "200", "tiene_web": "SÍ", "url_web": "https://ada.co", "marca": "NO", "proc_rl": "SÍ", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "Laboral, sumas de dinero", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 61, "clasificacion": "POTENCIAL MEDIO"}, "901214227": {"razon_social": "GRUPO NUTRY S.A.S.", "nit": "901214227", "sector": "COMERCIAL", "rep_legal": "JULIAN FRANCESCO RESTREPO ARIAS", "ingresos": "2000000000", "tamano": "MICRO", "empleados": ">15", "tiene_web": "SÍ", "url_web": "https://gruponutry.com", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 88, "clasificacion": "ALTO POTENCIAL"}, "860000656": {"razon_social": "HMV INGENIEROS LTDA.", "nit": "860000656", "sector": "TECNOLOGÍA", "rep_legal": "WILLIAM PAREDES FORERO", "ingresos": "10000000000000", "tamano": "GRANDE", "empleados": ">500", "tiene_web": "SÍ", "url_web": "https://www.h-mv.com", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "SÍ", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 93, "clasificacion": "ALTO POTENCIAL"}, "800132302": {"razon_social": "OFIMA S.A.S.", "nit": "800132302", "sector": "TECNOLOGÍA", "rep_legal": "MARCO ANTONIO CARRASQUILLA", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": "51", "tiene_web": "SÍ", "url_web": "https://www.ofima.com", "marca": "SÍ", "proc_rl": "SÍ", "proc_rl_sup": "SÍ", "proc_empresa": "SÍ", "detalle_proc": "De ejecucion, TUTELAS", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 75, "clasificacion": "ALTO POTENCIAL"}, "901424683": {"razon_social": "OHANA COMPANY S.A.S.", "nit": "901424683", "sector": "INMOBILIARIO", "rep_legal": "ERICH GOTTLIEB MASSMANN SANABRIA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "NO", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 45, "clasificacion": "BAJO POTENCIAL"}, "901497064": {"razon_social": "INVERSORA LIRIO S.A.S.", "nit": "901497064", "sector": "INMOBILIARIO", "rep_legal": "JUAN CARLOS LOPEZ DIEZ", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "Riesgo Legal, Riesgo de Mercado Oferta y Demanda", "puntaje": 48, "clasificacion": "BAJO POTENCIAL"}, "900236520": {"razon_social": "CADENA COMERCIAL OXXO COLOMBIA S.A.S", "nit": "900236520", "sector": "SERVICIOS", "rep_legal": "ANDRES MORALES", "ingresos": "10000000000000", "tamano": "GRANDE", "empleados": "N/A", "tiene_web": "SÍ", "url_web": "https://colombia.oxxodomicilios.com", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 98, "clasificacion": "ALTO POTENCIAL"}, "901529751": {"razon_social": "IMTAMAR S.A.S.", "nit": "901529751", "sector": "INMOBILIARIO", "rep_legal": "IVONNE ESCAF DE SALDARRIAGA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "NO", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 45, "clasificacion": "BAJO POTENCIAL"}, "800213075": {"razon_social": "RESTCAFE S.A.S", "nit": "800213075", "sector": "SERVICIOS", "rep_legal": "Marlon Masis Campos", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": "482", "tiene_web": "SÍ", "url_web": "https://www.cafeoma.com", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 78, "clasificacion": "ALTO POTENCIAL"}, "901778642": {"razon_social": "CONSTRUCCIONES ROJAS Y ALVAREZ S.A.S.", "nit": "901778642", "sector": "CONSTRUCTOR", "rep_legal": "HERNAN DE JESUS ROJAS TEJADA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "NO", "patrimonio": ">100 M", "riesgos": "", "puntaje": 30, "clasificacion": "BAJO POTENCIAL"}, "901637324": {"razon_social": "INVERSIONES LOS PERRITOS DEL MONO S.A.S.", "nit": "901637324", "sector": "COMERCIAL", "rep_legal": "ANDRES FELIPE PELAEZ AGUDELO", "ingresos": "20000000000", "tamano": "PEQUEÑA", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://losperritosdelmono.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 61, "clasificacion": "POTENCIAL MEDIO"}, "811044893": {"razon_social": "AGUA BENDITA S.A.S", "nit": "811044893", "sector": "TEXTIL", "rep_legal": "HINESTROZA MONTOYA MARIANA", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://www.aguabendita.com.co", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 86, "clasificacion": "ALTO POTENCIAL"}, "900778625": {"razon_social": "GESTION INMOBILIARIA MIC S.A.S.", "nit": "900778625", "sector": "INMOBILIARIO", "rep_legal": "Camargo Delgado Maria Ines", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "SÍ", "url_web": "https://micinmobiliaria.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 48, "clasificacion": "BAJO POTENCIAL"}, "901554815": {"razon_social": "RICHOUSE INMOBILIARIA SAS", "nit": "901554815", "sector": "INMOBILIARIO", "rep_legal": "LUX MIRTA ESPITIA CHAPARRO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">5", "tiene_web": "SÍ", "url_web": "https://www.richouseinmobiliaria.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 38, "clasificacion": "BAJO POTENCIAL"}, "900009803": {"razon_social": "INMOBILIARIA GOMEZ Y ASOCIADOS S.A.S.", "nit": "900009803", "sector": "INMOBILIARIO", "rep_legal": "LUZ DARY GOMEZ OSPINA", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://gomezyasociados.com.co", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">100 M", "riesgos": "", "puntaje": 45, "clasificacion": "BAJO POTENCIAL"}, "901871794": {"razon_social": "MAGI GROUP SAS", "nit": "901871794", "sector": "TEXTIL", "rep_legal": "MARLYN PELAEZ AREVALO", "ingresos": "5000000000", "tamano": "PEQUEÑA", "empleados": ">20", "tiene_web": "SÍ", "url_web": "", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">50 M", "riesgos": "", "puntaje": 63, "clasificacion": "POTENCIAL MEDIO"}, "901166382": {"razon_social": "INVERSIONES BLO S.A.S", "nit": "901166382", "sector": "TEXTIL", "rep_legal": "Wilingthon Ortiz Jaramillo", "ingresos": "20000000000", "tamano": "MEDIANA", "empleados": ">50", "tiene_web": "SÍ", "url_web": "", "marca": "SÍ", "proc_rl": "NO", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 58, "clasificacion": "POTENCIAL MEDIO"}, "901212102": {"razon_social": "AUNA COLOMBIA S.A.S.", "nit": "901212102", "sector": "SERVICIOS", "rep_legal": "JUAN GONZALO ALVAREZ RESTREPO", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "SÍ", "url_web": "", "marca": "NO", "proc_rl": "SIN INFORMACIÓN", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SIN INFORMACIÓN", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 58, "clasificacion": "POTENCIAL MEDIO"}, "900017459": {"razon_social": "INVERSIONES FALABELLA DE COLOMBIA S.A", "nit": "900017459", "sector": "SERVICIOS", "rep_legal": "Rodrigo Agustin Fajardo Zilleruelo", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "NO", "url_web": "", "marca": "NO", "proc_rl": "SIN INFORMACIÓN", "proc_rl_sup": "SIN INFORMACIÓN", "proc_empresa": "SIN INFORMACIÓN", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 55, "clasificacion": "POTENCIAL MEDIO"}, "900759329": {"razon_social": "EMPRESA TRANSPORTADORA SAN GABRIEL S.A.S.", "nit": "900759329", "sector": "SERVICIOS", "rep_legal": "Castro Vega Diana Paola", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "SÍ", "url_web": "https://www.etsg.com.co", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "SÍ", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 65, "clasificacion": "POTENCIAL MEDIO"}, "901875692": {"razon_social": "CONSTRUCTORA INMOBILIARIA HABITAT DE LOS ANDES SAS", "nit": "901875692", "sector": "CONSTRUCTOR", "rep_legal": "PEÑA PIÑEROS JORGE", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "SÍ", "url_web": "https://habitatdelosandes.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "", "puntaje": 75, "clasificacion": "ALTO POTENCIAL"}, "902002134": {"razon_social": "REVOLUT BANK COLOMBIA S.A.", "nit": "902002134", "sector": "TECNOLOGÍA", "rep_legal": "Diego Caicedo Mosquera", "ingresos": "100000000000", "tamano": "GRANDE", "empleados": ">50", "tiene_web": "SÍ", "url_web": "https://www.revolut.com/es-CO/", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "SÍ", "patrimonio": ">1.000 M", "riesgos": "Supervisión SFC, riesgos regulatorios, LAFT", "puntaje": 83, "clasificacion": "ALTO POTENCIAL"}, "901285773": {"razon_social": "MANUFACTURAS AMALU S.A.S", "nit": "901285773", "sector": "TEXTIL", "rep_legal": "CESAR AUGUSTO SERNA CASTAÑO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">20", "tiene_web": "SÍ", "url_web": "https://fajasamalu.com", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "NO", "patrimonio": ">100 M", "riesgos": "", "puntaje": 40, "clasificacion": "BAJO POTENCIAL"}, "901814061": {"razon_social": "LINDA MIA MODA INFANTIL S.A.S.", "nit": "901814061", "sector": "TEXTIL", "rep_legal": "ANA MILENA CAMACHO HENAO", "ingresos": "1000000000", "tamano": "MICRO", "empleados": ">10", "tiene_web": "SÍ", "url_web": "https://lindamia.co", "marca": "NO", "proc_rl": "NO", "proc_rl_sup": "NO", "proc_empresa": "NO", "detalle_proc": "", "estructura_juridica": "PARCIAL", "patrimonio": ">100 M", "riesgos": "", "puntaje": 48, "clasificacion": "BAJO POTENCIAL"}};
      // ── DD CLIENTES POTENCIALES — leer EN VIVO desde Google Sheets ──
      // Usa parseCSV (header-based) en vez de parseRaw para evitar desalineación
      // por celdas multilínea ("TAMAÑO\nCORPORATIVO", etc.)
      const ddRows=parseCSV(ddT,["RAZÓN SOCIAL"]);
      let liveCount=0;
      if(ddRows.length>0){
        // Detectar nombres de columnas reales (pueden variar levemente)
        const sampleKeys=Object.keys(ddRows[0]);
        const findKey=(label)=>sampleKeys.find(k=>k.toUpperCase().includes(label.toUpperCase()));
        const kRS   = findKey("RAZÓN SOCIAL")||findKey("RAZON SOCIAL");
        const kNIT  = findKey("NIT");
        const kSEC  = findKey("TIPO DE")||sampleKeys.find(k=>k.toUpperCase()==="SECTOR");
        const kRL   = findKey("REPRESENTANTE");
        const kING  = findKey("INGRESOS");
        const kTAM  = findKey("TAMAÑO");
        const kEMP  = findKey("N° EMPLEADOS")||findKey("EMPLEADOS");
        const kWEB  = findKey("TIENE")||findKey("PÁGINA WEB");
        const kURL  = findKey("URL");
        const kMAR  = findKey("REGISTRO")||findKey("MARCA");
        const kPRL  = sampleKeys.find(k=>k.toUpperCase().includes("JUDICIALES")&&k.toUpperCase().includes("RL")&&!k.toUpperCase().includes("SUPLENTE"));
        const kPRLS = findKey("RL SUPLENTE")||findKey("SUPLENTE");
        const kPEMP = sampleKeys.find(k=>k.toUpperCase().includes("JUDICIALES")&&k.toUpperCase().includes("EMPRESA"));
        const kDET  = findKey("DETALLE");
        const kESTR = sampleKeys.find(k=>k.toUpperCase().includes("ESTRUCTURA")&&k.toUpperCase().includes("JUR"));
        const kPAT  = findKey("PATRIMONIO");
        const kRIES = findKey("RIESGOS");
        const kPUN  = findKey("PUNTAJE");
        const kCLAS = findKey("CLASIFICACIÓN")||findKey("CLASIFICACION");

        console.log("DD columns found:",{kRS,kNIT,kSEC,kPUN,kCLAS});
        console.log("DD sample row 0:",ddRows[0]);
        console.log("DD sample row 1:",ddRows[1]);
        console.log("DD row 0 clasificacion raw:",ddRows[0]?.[kCLAS],"puntaje raw:",ddRows[0]?.[kPUN]);

        for(const row of ddRows){
          const razon=(row[kRS]||"").trim();
          if(razon.length<2)continue;
          const nombre=razon.toUpperCase();
          const nit=cleanNIT(row[kNIT]||"");
          // Normaliza acentos y espacios para evitar problemas de matching
          const clasRawOrig=(row[kCLAS]||"").trim();
          const clasNorm0=clasRawOrig.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
          let clasNorm;
          if(clasNorm0.includes("ALTO"))clasNorm="ALTO POTENCIAL";
          else if(clasNorm0.includes("MEDIO"))clasNorm="POTENCIAL MEDIO";
          else if(clasNorm0.includes("BAJO"))clasNorm="BAJO POTENCIAL";
          else if(clasNorm0.includes("DESCAR"))clasNorm="DESCARTADO";
          else{
            // Si no matchea ningún patrón conocido, inferir por puntaje como respaldo
            const p=parseFloat(row[kPUN])||0;
            clasNorm=p>=70?"ALTO POTENCIAL":p>=50?"POTENCIAL MEDIO":p>0?"BAJO POTENCIAL":"";
            if(clasRawOrig)console.warn("Clasificación no reconocida:",JSON.stringify(clasRawOrig),"-> inferida por puntaje:",clasNorm);
          }
          const entry={
            razon_social:razon,nit,
            sector:(row[kSEC]||"").trim().toUpperCase(),
            rep_legal:(row[kRL]||"").trim(),
            ingresos:(row[kING]||"").replace(/[^0-9]/g,""),
            tamano:(row[kTAM]||"").trim(),
            empleados:(row[kEMP]||"").trim(),
            tiene_web:(row[kWEB]||"").trim(),
            url_web:(row[kURL]||"").trim(),
            marca:(row[kMAR]||"").trim(),
            proc_rl:(row[kPRL]||"").trim(),
            proc_rl_sup:(row[kPRLS]||"").trim(),
            proc_empresa:(row[kPEMP]||"").trim(),
            detalle_proc:(row[kDET]||"").trim(),
            estructura_juridica:(row[kESTR]||"").trim(),
            patrimonio:(row[kPAT]||"").trim(),
            riesgos:(row[kRIES]||"").trim(),
            puntaje:parseFloat(row[kPUN])||0,
            clasificacion:clasNorm,
          };
          if(nit)ddByNit[nit]=entry;   // overwrite embedded fallback with live data
          ddByName[nombre]=entry;
          liveCount++;
        }
      }
      console.log("DD live data loaded:",liveCount,"empresas desde Google Sheets (de",ddRows.length,"filas totales)");
      const lookupDD=(nombre,nit)=>ddByNit[nit]||ddByName[nombre]||null;
      
      // ── REUNIONES      const lookupDD=(nombre,nit)=>ddByNit[nit]||ddByName[nombre]||null;
      
      // ── REUNIONES Y CIERRE — 100% en vivo desde Google Sheets, sin datos embebidos ──
      // Match por NIT exacto primero, luego nombre exacto, luego nombre normalizado
      const reuByName={};
      const reuByNit={};
      const reuRaw=parseRaw(reuT);
      const reuHi=reuRaw.findIndex(r=>r.some(c=>c.trim()==="CLIENTE")&&r.some(c=>c.trim()==="REUNION"||c.trim()==="REUNIÓN"));
      if(reuHi>=0){
        const rH=reuRaw[reuHi];
        const CI=rH.findIndex(h=>h.trim()==="CLIENTE");
        const NI=rH.findIndex(h=>h.trim().toUpperCase()==="NIT");
        const RI=rH.findIndex(h=>h.trim()==="REUNION"||h.trim()==="REUNIÓN");
        const PI=rH.findIndex(h=>h.trim().toUpperCase()==="PROPUESTA");
        const FI=rH.findIndex(h=>h.trim()==="FECHA");
        const COI=rH.findIndex(h=>h.trim()==="COMENTARIOS");
        const ESI=rH.findIndex(h=>h.trim()==="ESTADO");
        for(let i=reuHi+1;i<reuRaw.length;i++){
          const row=reuRaw[i];
          const nombre=(row[CI]||"").toUpperCase().trim();
          if(nombre.length<2)continue;
          const nitRaw=NI>=0?(row[NI]||""):"";
          const nit=cleanNIT(nitRaw);
          const coment=(row[COI]||"").toLowerCase();
          const estado=(row[ESI]||"").toLowerCase();
          const reunVal=(row[RI]||"").toUpperCase().trim();
          const propVal=PI>=0?(row[PI]||"").toUpperCase().trim():"";
          const entry={
            tiene_reunion:["TRUE","VERDADERO","1"].includes(reunVal),
            propuesta:["TRUE","VERDADERO","1"].includes(propVal)||coment.includes("propuesta")||coment.includes("firma contrato"),
            cierre:estado.includes("cerrado")||coment.includes("firma contrato")||coment.includes("cierre"),
            estado_reu:row[ESI]||"",
            comentarios_reu:row[COI]||"",
            fecha_reu:row[FI]||"",
          };
          if(nit)reuByNit[nit]=entry;
          reuByName[nombre]=entry;
        }
        console.log("REUNIONES Y CIERRE leído en vivo:",Object.keys(reuByName).length,"empresas desde Google Sheets");
      } else {
        console.warn("⚠️ No se pudo leer la hoja REUNIONES Y CIERRE (header no encontrado). reuT length:",reuT.length);
      }
      // Normaliza nombres para matching tolerante: quita acentos, S.A.S/SAS, 
      // puntuación, espacios extra, y plurales simples (S final tras palabra >3 letras)
      const normalizeForMatch=(s)=>{
        if(!s)return"";
        return s.toUpperCase()
          .normalize("NFD").replace(/[\u0300-\u036f]/g,"")  // quita acentos
          .replace(/[.,]/g,"")
          .replace(/\bS\.?A\.?S\.?\b/g,"")  // quita S.A.S, SAS, S.A
          .replace(/\bLTDA\.?\b/g,"")
          .replace(/[^A-Z0-9 ]/g," ")
          .replace(/\s+/g," ")
          .trim();
      };
      // Índice normalizado para fallback de fuzzy matching
      const reuByNormName={};
      Object.entries(reuByName).forEach(([k,v])=>{
        const nk=normalizeForMatch(k);
        if(nk)reuByNormName[nk]=v;
      });
      const lookupReu=(nombre,nit)=>{
        if(nit&&reuByNit[nit])return reuByNit[nit];
        if(reuByName[nombre])return reuByName[nombre];
        const norm=normalizeForMatch(nombre);
        if(norm&&reuByNormName[norm])return reuByNormName[norm];
        return null;
      };
      // Diagnóstico: qué empresas de REUNIONES Y CIERRE no encontraron match en BD
      window.__reuDebug={reuByName,reuByNit,normalizeForMatch};



      // ── Parse BD ──
      // Parse BD
      const bdRows=parseCSV(bdT).filter(r=>r["CLIENTE"]?.length>1);
      console.log("BD rows parsed:", bdRows.length, "| bdT length:", bdT.length);
      if(bdRows.length===0){
        const msg=bdT.length<100
          ? "Error: Google Sheets no respondió. Verifica que la hoja sea pública."
          : `Error al parsear BD. Primeras letras recibidas: "${bdT.slice(0,80)}"`;
        setError(msg);
        setLoading(false); return;
      }
      const enriched=bdRows.map((r,idx)=>{
        const nombre=(r["CLIENTE"]||"").toUpperCase().trim();
        const nit=cleanNIT(r["NIT"]||"");
        // Match DD — exact NIT or exact name only
        const dd=lookupDD(nombre,nit);
        // Match reunión — NIT primero, luego nombre exacto
        const reu=lookupReu(nombre,nit);
        return{
          id:idx,
          cliente:r["CLIENTE"]||"",
          estado:r["ESTADO"]||"",
          quien:r["QUIEN LO LLAMO"]||"",
          emis:r["EMIS"]||"",rues:r["RUES"]||"",
          interes:r["COMENTARIOS"]||"",
          contacto1:["TRUE","VERDADERO","1"].includes((r["CONTACTÓ"]||"").toUpperCase().trim()),
          contacto2:["TRUE","VERDADERO","1"].includes((r["SEGUNDO CONTACTO"]||"").toUpperCase().trim()),
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
          // Reunión + Propuesta + Cierre
          tiene_reunion:reu?.tiene_reunion||false,
          propuesta:reu?.propuesta||false,
          cierre:reu?.cierre||false,
          estado_reu:reu?.estado_reu||"",
          reunion_comentarios:reu?.comentarios_reu||"",
        };
      });

      // ── Empresas que están en REUNIONES Y CIERRE pero NO en BD PRINCIPAL ──
      // Se agregan como filas adicionales (deduplicadas por nombre normalizado para
      // evitar que se dupliquen al refrescar) para que ninguna reunión/propuesta/cierre
      // se pierda por no estar todavía registrada en el BD principal.
      const bdNombresNormalizados=new Set(enriched.map(r=>normalizeForMatch(r.cliente.toUpperCase().trim())));
      const huerfanasMap={}; // dedupe by normalized name
      Object.entries(reuByName).forEach(([nombre,reu])=>{
        const norm=normalizeForMatch(nombre);
        if(norm&&!bdNombresNormalizados.has(norm)&&!huerfanasMap[norm]){
          const dd=lookupDD(nombre,"");
          huerfanasMap[norm]={
            cliente:nombre,
            estado:reu.estado_reu&&reu.estado_reu.toUpperCase().includes("CERRADO")?"SEGUIMIENTO":"",
            quien:"",emis:"",rues:"",interes:"",
            contacto1:false,contacto2:false,quePaso:"",
            fecha:reu.fecha_reu||"",
            contactoDirecto:"",telefono:"",direccion:"",correo:"",nit:"",notas:"",
            dd,puntaje:dd?.puntaje||0,clasificacion:dd?.clasificacion||"",
            tiene_reunion:reu.tiene_reunion||false,
            propuesta:reu.propuesta||false,
            cierre:reu.cierre||false,
            estado_reu:reu.estado_reu||"",
            reunion_comentarios:reu.comentarios_reu||"",
            soloEnReuniones:true,
          };
        }
      });
      const huerfanas=Object.values(huerfanasMap).map((h,i)=>({id:enriched.length+i,...h}));
      if(huerfanas.length>0){
        console.log(huerfanas.length,"empresas únicas de REUNIONES Y CIERRE no estaban en BD PRINCIPAL — agregadas:",huerfanas.map(h=>h.cliente));
      }
      const enrichedFull=[...enriched,...huerfanas];

      // Sort: ALTO POTENCIAL primero, luego por score desc, luego por estado (LLAMAR HOY primero)
      const estadoOrder={"LLAMAR HOY":1,"SEGUIMIENTO":2,"VOLVER A CONTACTAR":3,"":4,"YA NO SEGUIMIENTO":5};
      enrichedFull.sort((a,b)=>{
        const pa=POT_META[a.clasificacion]?.order||5,pb=POT_META[b.clasificacion]?.order||5;
        if(pa!==pb)return pa-pb;
        if(b.puntaje!==a.puntaje)return b.puntaje-a.puntaje;
        return (estadoOrder[a.estado]||4)-(estadoOrder[b.estado]||4);
      });

      const reuList=Object.values(reuByName);
      setData(enrichedFull);setReuniones(reuList);
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
    conPropuesta:data.filter(r=>r.propuesta).length,
    conCierre:data.filter(r=>r.cierre).length,
    conProc:data.filter(r=>r.dd&&procAlert(r.dd)).length,
  }),[data]);

  // Mapa de colores por sector, 100% en vivo a partir de los sectores presentes en `data`
  const SC=useMemo(()=>{
    const sectors=new Set();
    data.forEach(r=>{if(r.dd&&r.dd.sector)sectors.add(r.dd.sector);});
    const list=[...sectors].sort();
    const map={};
    list.forEach(s=>{map[s]=colorForSector(s,list);});
    return map;
  },[data]);

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
        {tab==="metricas"?<Metricas data={data}/>:(
          <>
            {/* STATS */}
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              <KPI label="Total BD"          value={stats.total}       color="#6366f1"/>
              <KPI label="📞 Llamar hoy"    value={stats.llamarHoy}   color="#eab308"/>
              <KPI label="🔄 Seguimiento"   value={stats.seguimiento}  color="#22c55e"/>
              <KPI label="🔥 Alto potencial" value={stats.alto}        color="#f97316"/>
              <KPI label="🤝 Reunión"       value={stats.conReunion}   color="#8b5cf6"/>
              <KPI label="📄 Propuesta"     value={stats.conPropuesta} color="#3b82f6"/>
              <KPI label="✅ Cierre"        value={stats.conCierre}    color="#16a34a"/>
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
                        {["Score","Potencial","Estado","Empresa","Sector","Contacto","Teléfono","Interés","🤝","📄","✅","Asignado"].map(h=>(
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
                        const secColor=SC[r.dd?.sector||""]||null;
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
                            <td style={{padding:"9px 11px",fontWeight:600,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                              {r.cliente}
                              {r.soloEnReuniones&&<span title="Solo en hoja REUNIONES Y CIERRE, aún no está en BD PRINCIPAL" style={{marginLeft:5,fontSize:10,color:"#a855f7"}}>🆕</span>}
                            </td>
                            <td style={{padding:"9px 11px",whiteSpace:"nowrap"}}>
                              {secColor
                                ? <span style={{background:secColor,color:"#fff",borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>{r.dd.sector}</span>
                                : <span style={{color:"#d1d5db",fontSize:11}}>—</span>}
                            </td>
                            <td style={{padding:"9px 11px",color:"#475569",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.contactoDirecto||"—"}</td>
                            <td style={{padding:"9px 11px",whiteSpace:"nowrap"}}>
                              {r.telefono?<a href={`tel:${r.telefono.split("|")[0].replace(/\s/g,"")}`} style={{color:"#3b82f6",textDecoration:"none"}} onClick={e=>e.stopPropagation()}>{r.telefono.slice(0,14)}</a>:<span style={{color:"#d1d5db"}}>—</span>}
                            </td>
                            <td style={{padding:"9px 11px"}}>
                              {tag?<Bdg bg={tag.bg} color={tag.color}>{tag.label}</Bdg>:<span style={{color:"#d1d5db"}}>—</span>}
                            </td>
                            <td style={{padding:"9px 11px",textAlign:"center"}}>
                              {r.tiene_reunion?<span title="Reunión realizada">🤝</span>:<span style={{color:"#d1d5db"}}>—</span>}
                            </td>
                            <td style={{padding:"9px 11px",textAlign:"center"}}>
                              {r.propuesta?<span title={`Propuesta enviada — ${r.reunion_comentarios}`} style={{cursor:"help"}}>📄</span>:<span style={{color:"#d1d5db"}}>—</span>}
                            </td>
                            <td style={{padding:"9px 11px",textAlign:"center"}}>
                              {r.cierre?<span title="CERRADO ✅" style={{fontWeight:700,color:"#16a34a"}}>✅</span>:<span style={{color:"#d1d5db"}}>—</span>}
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
