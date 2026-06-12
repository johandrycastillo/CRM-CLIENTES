import { useState, useEffect, useMemo } from "react";

const SHEET_ID = "10QnaE3Bl99TgoyCy7kvz6yX39ESVh6QiUHcY-TtPq-c";
const BD_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("BD PRINCIPAL CLIENT POTENCIALES")}`;
const DD_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("DD CLIENTES POTENCIALES")}`;
const REU_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("REUNIONES Y CIERRE")}`;

// ── CSV PARSER ───────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ""; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}
function parseCSV(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  let hi = lines.findIndex(l => l.includes("CLIENTE") && l.includes("ESTADO"));
  if (hi === -1) hi = 1;
  const headers = parseCSVLine(lines[hi]).map(h => h.replace(/^"|"$/g,"").trim());
  return lines.slice(hi+1).map(l => {
    const cols = parseCSVLine(l).map(c => c.replace(/^"|"$/g,"").trim());
    const o = {}; headers.forEach((h,j) => o[h] = cols[j]||""); return o;
  });
}
function parseCSVRaw(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  return lines.map(l => parseCSVLine(l).map(c => c.replace(/^"|"$/g,"").trim()));
}

// ── STYLE MAPS ───────────────────────────────────────────────────────────────
const ESTADO_META = {
  "LLAMAR HOY":         { bg:"#fef08a", color:"#713f12", icon:"📞" },
  "SEGUIMIENTO":        { bg:"#bbf7d0", color:"#14532d", icon:"🔄" },
  "VOLVER A CONTACTAR": { bg:"#bfdbfe", color:"#1e3a8a", icon:"🔁" },
  "YA NO SEGUIMIENTO":  { bg:"#e5e7eb", color:"#6b7280", icon:"🚫" },
  "":                   { bg:"#f3f4f6", color:"#9ca3af", icon:"❓" },
};
const POTENCIAL_META = {
  "ALTO POTENCIAL":  { bg:"#dcfce7", color:"#166534", icon:"🔥" },
  "POTENCIAL MEDIO": { bg:"#fef9c3", color:"#854d0e", icon:"⭐" },
  "BAJO POTENCIAL":  { bg:"#fee2e2", color:"#991b1b", icon:"⬇️" },
  "DESCARTADO":      { bg:"#f3f4f6", color:"#6b7280", icon:"🚫" },
};
const INTERES_TAGS = [
  { match:["interés - llamar","interés - info","interés"], bg:"#d1fae5",color:"#065f46",label:"✅ Interés" },
  { match:["info"],                                          bg:"#dbeafe",color:"#1e40af",label:"ℹ️ Info"   },
  { match:["no interés - info","no interés"],               bg:"#fee2e2",color:"#991b1b",label:"❌ No interés" },
  { match:["no contesta"],                                   bg:"#f3f4f6",color:"#374151",label:"📵 No contesta" },
];
function getTag(interes) {
  const low = (interes||"").toLowerCase();
  return INTERES_TAGS.find(t => t.match.some(m => low.includes(m))) || null;
}
const ESTADOS = ["TODOS","LLAMAR HOY","SEGUIMIENTO","VOLVER A CONTACTAR","YA NO SEGUIMIENTO","Sin estado"];

// ── COMPONENTS ───────────────────────────────────────────────────────────────
function Badge({ bg, color, children, style={} }) {
  return <span style={{ background:bg, color, borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:600, whiteSpace:"nowrap", ...style }}>{children}</span>;
}
function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ background:"#fff", borderRadius:12, padding:"14px 18px", boxShadow:"0 1px 4px rgba(0,0,0,0.08)", borderLeft:`4px solid ${color}`, minWidth:110 }}>
      <div style={{ fontSize:26, fontWeight:800, color }}>{value}</div>
      <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:"#9ca3af", marginTop:2 }}>{sub}</div>}
    </div>
  );
}

// Métrica de llamadas por mes
function MetricasPanel({ data, reuniones }) {
  const byMonth = useMemo(() => {
    const m = {};
    data.forEach(r => {
      let fecha = r.fecha;
      if (!fecha || fecha === "nan" || fecha.length < 7) return;
      const key = fecha.slice(0,7); // YYYY-MM
      if (!m[key]) m[key] = { mes:key, llamadas:0, contactadas:0, segundoContacto:0, reuniones:0 };
      m[key].llamadas++;
      if (r.contacto1) m[key].contactadas++;
      if (r.contacto2) m[key].segundoContacto++;
    });
    // add reuniones
    reuniones.forEach(r => {
      if (!r.fecha || r.fecha.length < 7) return;
      const key = r.fecha.slice(0,7);
      if (!m[key]) m[key] = { mes:key, llamadas:0, contactadas:0, segundoContacto:0, reuniones:0 };
      if (r.tiene_reunion) m[key].reuniones++;
    });
    return Object.values(m).sort((a,b) => a.mes.localeCompare(b.mes));
  }, [data, reuniones]);

  const totales = useMemo(() => ({
    llamadas: data.length,
    contactadas: data.filter(r => r.contacto1).length,
    segundoContacto: data.filter(r => r.contacto2).length,
    reuniones: reuniones.filter(r => r.tiene_reunion).length,
  }), [data, reuniones]);

  const tasaContacto = totales.llamadas ? Math.round(totales.contactadas/totales.llamadas*100) : 0;
  const tasaReunion = totales.contactadas ? Math.round(totales.reuniones/totales.contactadas*100) : 0;

  const meses = { "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun","07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic" };
  const maxVal = Math.max(...byMonth.map(m => m.llamadas), 1);

  return (
    <div style={{ background:"#fff", borderRadius:12, padding:24, boxShadow:"0 1px 4px rgba(0,0,0,0.07)", marginBottom:20 }}>
      <div style={{ fontWeight:800, fontSize:16, marginBottom:16, color:"#0f172a" }}>📊 Métricas de Conversión</div>

      {/* KPIs globales */}
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:24 }}>
        <StatCard label="Total empresas" value={totales.llamadas} color="#6366f1" />
        <StatCard label="Contactadas (1er)" value={totales.contactadas} color="#3b82f6" sub={`${tasaContacto}% tasa contacto`} />
        <StatCard label="2do contacto" value={totales.segundoContacto} color="#8b5cf6" sub={`${totales.contactadas ? Math.round(totales.segundoContacto/totales.contactadas*100) : 0}% de contactadas`} />
        <StatCard label="Con reunión" value={totales.reuniones} color="#22c55e" sub={`${tasaReunion}% de contactadas`} />
        <StatCard label="Tasa cierre" value={`${totales.llamadas ? Math.round(totales.reuniones/totales.llamadas*100) : 0}%`} color="#f59e0b" sub="llamadas → reunión" />
      </div>

      {/* Gráfico de barras por mes */}
      {byMonth.length > 0 && (
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:"#475569", marginBottom:12 }}>Actividad por mes</div>
          <div style={{ display:"flex", gap:8, alignItems:"flex-end", overflowX:"auto", paddingBottom:8 }}>
            {byMonth.map(m => {
              const mes = m.mes.slice(5,7);
              return (
                <div key={m.mes} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:60 }}>
                  <div style={{ fontSize:10, color:"#6b7280", fontWeight:600 }}>{m.llamadas}</div>
                  <div style={{ width:40, display:"flex", flexDirection:"column", gap:2, alignItems:"center" }}>
                    <div style={{ width:36, height:Math.max(4, m.llamadas/maxVal*80), background:"#bfdbfe", borderRadius:"4px 4px 0 0" }} title={`Llamadas: ${m.llamadas}`}/>
                    <div style={{ width:28, height:Math.max(2, m.contactadas/maxVal*80), background:"#3b82f6", borderRadius:"4px 4px 0 0", marginTop:-2 }} title={`Contactadas: ${m.contactadas}`}/>
                    <div style={{ width:20, height:Math.max(2, m.reuniones/maxVal*80), background:"#22c55e", borderRadius:"4px 4px 0 0", marginTop:-2 }} title={`Reuniones: ${m.reuniones}`}/>
                  </div>
                  <div style={{ fontSize:10, color:"#9ca3af" }}>{meses[mes]||mes}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:16, marginTop:8 }}>
            {[["#bfdbfe","Empresas"],["#3b82f6","Contactadas"],["#22c55e","Reuniones"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#6b7280" }}>
                <div style={{ width:10, height:10, background:c, borderRadius:2 }}/>{l}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailPanel({ c, onClose }) {
  const em = ESTADO_META[c.estado] || ESTADO_META[""];
  const tag = getTag(c.interes);
  const pm = c.clasificacion ? (POTENCIAL_META[c.clasificacion] || null) : null;

  return (
    <div style={{ width:320, background:"#fff", borderRadius:12, boxShadow:"0 1px 6px rgba(0,0,0,0.1)", padding:20, flexShrink:0, position:"sticky", top:20, maxHeight:"85vh", overflowY:"auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div style={{ fontWeight:800, fontSize:14, lineHeight:1.3, flex:1 }}>{c.cliente}</div>
        <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", fontSize:20, color:"#9ca3af", marginLeft:8 }}>×</button>
      </div>

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
        <Badge bg={em.bg} color={em.color}>{em.icon} {c.estado||"Sin estado"}</Badge>
        {tag && <Badge bg={tag.bg} color={tag.color}>{tag.label}</Badge>}
        {pm && <Badge bg={pm.bg} color={pm.color}>{pm.icon} {c.clasificacion}</Badge>}
        {c.tiene_reunion && <Badge bg="#dcfce7" color="#166534">🤝 Reunión</Badge>}
      </div>

      {/* Score bar */}
      {c.puntaje > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6b7280", marginBottom:4 }}>
            <span>Score DD</span><span style={{ fontWeight:700, color: c.puntaje>=70?"#166534":c.puntaje>=50?"#854d0e":"#991b1b" }}>{c.puntaje}/100</span>
          </div>
          <div style={{ height:6, background:"#f1f5f9", borderRadius:99 }}>
            <div style={{ height:6, width:`${c.puntaje}%`, background: c.puntaje>=70?"#22c55e":c.puntaje>=50?"#f59e0b":"#ef4444", borderRadius:99 }}/>
          </div>
        </div>
      )}

      {c.sector && <div style={{ marginBottom:10 }}><div style={{ fontSize:11, color:"#9ca3af", marginBottom:2 }}>🏭 Sector</div><div style={{ fontSize:13 }}>{c.sector}</div></div>}
      {c.tamano && <div style={{ marginBottom:10 }}><div style={{ fontSize:11, color:"#9ca3af", marginBottom:2 }}>🏢 Tamaño</div><div style={{ fontSize:13 }}>{c.tamano}</div></div>}
      {c.ingresos && c.ingresos !== "nan" && <div style={{ marginBottom:10 }}><div style={{ fontSize:11, color:"#9ca3af", marginBottom:2 }}>💰 Ingresos est.</div><div style={{ fontSize:13 }}>${Number(c.ingresos).toLocaleString("es-CO")}</div></div>}

      <div style={{ borderTop:"1px solid #f1f5f9", paddingTop:12, marginTop:4 }}>
        {c.contactoDirecto && <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:"#9ca3af", marginBottom:2 }}>👤 Contacto</div><div style={{ fontSize:13 }}>{c.contactoDirecto}</div></div>}
        {c.telefono && <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:"#9ca3af", marginBottom:2 }}>📞 Teléfono</div><a href={`tel:${c.telefono.split("|")[0].replace(/\s/g,"")}`} style={{ fontSize:13, color:"#3b82f6" }}>{c.telefono}</a></div>}
        {c.correo?.includes("@") && <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:"#9ca3af", marginBottom:2 }}>✉️ Correo</div><a href={`mailto:${c.correo}`} style={{ fontSize:13, color:"#3b82f6", wordBreak:"break-all" }}>{c.correo}</a></div>}
        {c.quien && <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:"#9ca3af", marginBottom:2 }}>👔 Asignado</div><div style={{ fontSize:13 }}>{c.quien}</div></div>}
        {c.fecha && c.fecha!=="nan" && <div style={{ marginBottom:8 }}><div style={{ fontSize:11, color:"#9ca3af", marginBottom:2 }}>📅 Fecha</div><div style={{ fontSize:13 }}>{c.fecha}</div></div>}
      </div>

      {c.quePaso && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>📝 Último paso</div>
          <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px", fontSize:12, lineHeight:1.5 }}>{c.quePaso}</div>
        </div>
      )}
      {c.notas && c.notas.length > 1 && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>🗒️ Notas</div>
          <div style={{ background:"#fffbeb", borderRadius:8, padding:"10px 12px", fontSize:12, lineHeight:1.5 }}>{c.notas}</div>
        </div>
      )}
      {c.reunion_comentarios && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>🤝 Reunión</div>
          <div style={{ background:"#f0fdf4", borderRadius:8, padding:"10px 12px", fontSize:12, lineHeight:1.5 }}>{c.reunion_comentarios}</div>
        </div>
      )}

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
        {c.contacto1 && <Badge bg="#d1fae5" color="#065f46">1er contacto ✓</Badge>}
        {c.contacto2 && <Badge bg="#dbeafe" color="#1e40af">2do contacto ✓</Badge>}
      </div>

      {(c.rues?.startsWith("http") || c.emis?.startsWith("http")) && (
        <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid #f1f5f9", display:"flex", gap:8, flexWrap:"wrap" }}>
          {c.rues?.startsWith("http") && <a href={c.rues} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:"#7c3aed", background:"#ede9fe", borderRadius:6, padding:"4px 10px", textDecoration:"none", fontWeight:600 }}>🔗 RUES</a>}
          {c.emis?.startsWith("http") && <a href={c.emis} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:"#0369a1", background:"#e0f2fe", borderRadius:6, padding:"4px 10px", textDecoration:"none", fontWeight:600 }}>📊 EMIS</a>}
        </div>
      )}
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState([]);
  const [reuniones, setReuniones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tab, setTab] = useState("crm"); // crm | metricas

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("TODOS");
  const [filterQuien, setFilterQuien] = useState("TODOS");
  const [filterPotencial, setFilterPotencial] = useState("TODOS");
  const [selected, setSelected] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true); setError(null);
      const [bdRes, ddRes, reuRes] = await Promise.all([
        fetch(BD_URL), fetch(DD_URL), fetch(REU_URL)
      ]);
      const [bdText, ddText, reuText] = await Promise.all([
        bdRes.text(), ddRes.text(), reuRes.text()
      ]);

      // Parse BD PRINCIPAL
      const bdRows = parseCSV(bdText).filter(r => r["CLIENTE"]?.length > 1);

      // Parse DD — find header row with RAZÓN SOCIAL
      const ddRaw = parseCSVRaw(ddText);
      const ddHeaderIdx = ddRaw.findIndex(r => r.some(c => c.includes("RAZÓN SOCIAL")));
      const ddHeaders = ddHeaderIdx >= 0 ? ddRaw[ddHeaderIdx] : [];
      const scoreMap = {};
      if (ddHeaderIdx >= 0) {
        for (let i = ddHeaderIdx+1; i < ddRaw.length; i++) {
          const row = ddRaw[i];
          const get = (label) => {
            const idx = ddHeaders.findIndex(h => h.includes(label));
            return idx >= 0 ? (row[idx]||"").trim() : "";
          };
          const nombre = get("RAZÓN SOCIAL").toUpperCase().trim();
          const puntaje = parseFloat(get("PUNTAJE")) || 0;
          const clasificacion = get("CLASIFICACIÓN");
          if (nombre.length > 2 && (puntaje > 0 || clasificacion)) {
            scoreMap[nombre] = {
              puntaje,
              clasificacion: clasificacion.includes("ALTO") ? "ALTO POTENCIAL"
                           : clasificacion.includes("MEDIO") ? "POTENCIAL MEDIO"
                           : clasificacion.includes("BAJO") ? "BAJO POTENCIAL"
                           : clasificacion.includes("DESCAR") ? "DESCARTADO" : clasificacion,
              sector: get("SECTOR"),
              ingresos: get("INGRESOS"),
              tamano: get("TAMAÑO"),
            };
          }
        }
      }

      // Parse REUNIONES
      const reuRaw = parseCSVRaw(reuText);
      const reuHeaderIdx = reuRaw.findIndex(r => r.some(c => c === "CLIENTE" || c === "REUNION"));
      const reuMap = {};
      if (reuHeaderIdx >= 0) {
        const reuHeaders = reuRaw[reuHeaderIdx];
        const cIdx = reuHeaders.indexOf("CLIENTE");
        const rIdx = reuHeaders.findIndex(h => h === "REUNION");
        const fIdx = reuHeaders.indexOf("FECHA");
        const coIdx = reuHeaders.indexOf("COMENTARIOS");
        for (let i = reuHeaderIdx+1; i < reuRaw.length; i++) {
          const row = reuRaw[i];
          const nombre = (row[cIdx]||"").toUpperCase().trim();
          if (nombre.length > 1) {
            reuMap[nombre] = {
              tiene_reunion: (row[rIdx]||"").toUpperCase() === "TRUE",
              fecha: row[fIdx]||"",
              comentarios: row[coIdx]||"",
            };
          }
        }
      }

      // Enrich BD with DD scores and reunion data
      const enriched = bdRows.map((r, idx) => {
        const nombre = (r["CLIENTE"]||"").toUpperCase().trim();
        // fuzzy match DD
        const ddKey = Object.keys(scoreMap).find(k =>
          k === nombre || nombre.includes(k.slice(0,10)) || k.includes(nombre.slice(0,10))
        );
        const dd = ddKey ? scoreMap[ddKey] : {};
        // fuzzy match reunion
        const reuKey = Object.keys(reuMap).find(k =>
          k === nombre || nombre.includes(k.slice(0,8)) || k.includes(nombre.slice(0,8))
        );
        const reu = reuKey ? reuMap[reuKey] : {};

        return {
          id: idx,
          cliente: r["CLIENTE"]||"",
          estado: r["ESTADO"]||"",
          quien: r["QUIEN LO LLAMO"]||"",
          emis: r["EMIS"]||"",
          rues: r["RUES"]||"",
          interes: r["COMENTARIOS"]||"",
          contacto1: r["CONTACTÓ"]==="TRUE",
          contacto2: r["SEGUNDO CONTACTO"]==="TRUE",
          quePaso: r["¿QUÉ PASÓ?"]||"",
          fecha: r["FECHA"]||"",
          contactoDirecto: r["CONTACTO DIRECTO"]||"",
          telefono: r["TELEFONO"]||"",
          direccion: r["DIRECCION"]||"",
          correo: r["CORREO"]||"",
          nit: r["NIT"]||"",
          notas: r["COMENTARIOS.1"]||"",
          // DD enrichment
          puntaje: dd.puntaje||0,
          clasificacion: dd.clasificacion||"",
          sector: dd.sector||"",
          ingresos: dd.ingresos||"",
          tamano: dd.tamano||"",
          // Reunion
          tiene_reunion: reu.tiene_reunion||false,
          reunion_comentarios: reu.comentarios||"",
        };
      });

      // Build reuniones list for metrics
      const reuList = Object.values(reuMap);
      setData(enriched);
      setReuniones(reuList);
      setLastUpdate(new Date().toLocaleTimeString("es-CO"));
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const quienes = useMemo(() => {
    const s = new Set(["TODOS"]);
    data.forEach(r => { if (r.quien) r.quien.split(",").forEach(q => s.add(q.trim())); });
    return [...s].filter(Boolean);
  }, [data]);

  const potenciales = ["TODOS","ALTO POTENCIAL","POTENCIAL MEDIO","BAJO POTENCIAL","DESCARTADO","Sin evaluar"];

  const filtered = useMemo(() => data.filter(r => {
    const q = search.toLowerCase();
    const matchS = !q || r.cliente.toLowerCase().includes(q) || r.contactoDirecto.toLowerCase().includes(q) || r.telefono.includes(q) || r.quePaso.toLowerCase().includes(q);
    const matchE = filterEstado==="TODOS" || (filterEstado==="Sin estado" ? !r.estado : r.estado===filterEstado);
    const matchQ = filterQuien==="TODOS" || r.quien.includes(filterQuien);
    const matchP = filterPotencial==="TODOS" || (filterPotencial==="Sin evaluar" ? !r.clasificacion : r.clasificacion===filterPotencial);
    return matchS && matchE && matchQ && matchP;
  }), [data, search, filterEstado, filterQuien, filterPotencial]);

  const stats = useMemo(() => ({
    total: data.length,
    llamarHoy: data.filter(r => r.estado==="LLAMAR HOY").length,
    seguimiento: data.filter(r => r.estado==="SEGUIMIENTO").length,
    volver: data.filter(r => r.estado==="VOLVER A CONTACTAR").length,
    yaNo: data.filter(r => r.estado==="YA NO SEGUIMIENTO").length,
    altoPotencial: data.filter(r => r.clasificacion==="ALTO POTENCIAL").length,
    conReunion: data.filter(r => r.tiene_reunion).length,
  }), [data]);

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:16, color:"#475569" }}>
      <div style={{ fontSize:40 }}>📋</div>
      <div style={{ fontSize:16, fontWeight:600 }}>Cargando CRM…</div>
      <div style={{ fontSize:13, color:"#9ca3af" }}>Conectando con Google Sheets</div>
    </div>
  );
  if (error) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:16 }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ fontSize:16, fontWeight:600, color:"#ef4444" }}>Error al cargar</div>
      <div style={{ fontSize:13, color:"#6b7280", maxWidth:360, textAlign:"center" }}>{error}</div>
      <button onClick={fetchData} style={{ padding:"10px 20px", background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600 }}>Reintentar</button>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", color:"#1e293b" }}>
      {/* HEADER */}
      <div style={{ background:"#0f172a", color:"#fff", padding:"16px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ fontSize:24 }}>📋</div>
          <div>
            <div style={{ fontSize:17, fontWeight:800 }}>Deep Empire Bros — CRM</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>{data.length} empresas · {lastUpdate}</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <div style={{ display:"flex", gap:2, background:"#1e293b", borderRadius:8, padding:3 }}>
            {[["crm","🗂 CRM"],["metricas","📊 Métricas"]].map(([t,l]) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding:"6px 14px", borderRadius:6, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, background: tab===t?"#3b82f6":"transparent", color: tab===t?"#fff":"#94a3b8" }}>{l}</button>
            ))}
          </div>
          <button onClick={fetchData} style={{ padding:"8px 16px", background:"#1e40af", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>🔄 Actualizar</button>
        </div>
      </div>

      <div style={{ padding:"20px 28px" }}>
        {tab === "metricas" ? (
          <MetricasPanel data={data} reuniones={reuniones} />
        ) : (
          <>
            {/* STATS */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
              <StatCard label="Total"             value={stats.total}         color="#6366f1" />
              <StatCard label="📞 Llamar hoy"    value={stats.llamarHoy}     color="#eab308" />
              <StatCard label="🔄 Seguimiento"   value={stats.seguimiento}   color="#22c55e" />
              <StatCard label="🔁 Volver"        value={stats.volver}        color="#3b82f6" />
              <StatCard label="🔥 Alto potencial" value={stats.altoPotencial} color="#f97316" />
              <StatCard label="🤝 Con reunión"   value={stats.conReunion}    color="#8b5cf6" />
            </div>

            {/* FILTERS */}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
              <input placeholder="🔍 Buscar empresa, contacto o acción…" value={search} onChange={e=>setSearch(e.target.value)}
                style={{ flex:1, minWidth:220, padding:"9px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, outline:"none", background:"#fff" }} />
              <select value={filterEstado} onChange={e=>setFilterEstado(e.target.value)}
                style={{ padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, background:"#fff", cursor:"pointer" }}>
                {ESTADOS.map(e => <option key={e}>{e}</option>)}
              </select>
              <select value={filterPotencial} onChange={e=>setFilterPotencial(e.target.value)}
                style={{ padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, background:"#fff", cursor:"pointer" }}>
                {potenciales.map(p => <option key={p}>{p}</option>)}
              </select>
              <select value={filterQuien} onChange={e=>setFilterQuien(e.target.value)}
                style={{ padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, background:"#fff", cursor:"pointer" }}>
                {quienes.map(q => <option key={q}>{q}</option>)}
              </select>
              <div style={{ padding:"9px 14px", background:"#f1f5f9", borderRadius:8, fontSize:13, color:"#475569", display:"flex", alignItems:"center" }}>
                {filtered.length} resultado{filtered.length!==1?"s":""}
              </div>
            </div>

            <div style={{ display:"flex", gap:20, alignItems:"flex-start" }}>
              {/* TABLE */}
              <div style={{ flex:1, background:"#fff", borderRadius:12, boxShadow:"0 1px 4px rgba(0,0,0,0.07)", overflow:"hidden", minWidth:0 }}>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
                        {["Estado","Empresa","Potencial","Score","Contacto","Teléfono","Interés","Reunión","Asignado"].map(h => (
                          <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontWeight:600, color:"#475569", whiteSpace:"nowrap", fontSize:12 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(r => {
                        const em = ESTADO_META[r.estado]||ESTADO_META[""];
                        const tag = getTag(r.interes);
                        const pm = r.clasificacion ? (POTENCIAL_META[r.clasificacion]||null) : null;
                        const isSel = selected?.id===r.id;
                        return (
                          <tr key={r.id} onClick={()=>setSelected(isSel?null:r)}
                            style={{ borderBottom:"1px solid #f1f5f9", cursor:"pointer", background:isSel?"#eff6ff":"transparent" }}
                            onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background="#f8fafc"; }}
                            onMouseLeave={e=>{ if(!isSel) e.currentTarget.style.background="transparent"; }}>
                            <td style={{ padding:"9px 12px", whiteSpace:"nowrap" }}>
                              <Badge bg={em.bg} color={em.color}>{em.icon} {r.estado||"—"}</Badge>
                            </td>
                            <td style={{ padding:"9px 12px", fontWeight:600, maxWidth:170, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.cliente}</td>
                            <td style={{ padding:"9px 12px", whiteSpace:"nowrap" }}>
                              {pm ? <Badge bg={pm.bg} color={pm.color}>{pm.icon} {r.clasificacion}</Badge> : <span style={{ color:"#d1d5db" }}>—</span>}
                            </td>
                            <td style={{ padding:"9px 12px", whiteSpace:"nowrap" }}>
                              {r.puntaje>0 ? (
                                <span style={{ fontWeight:700, color: r.puntaje>=70?"#166534":r.puntaje>=50?"#854d0e":"#991b1b" }}>{r.puntaje}</span>
                              ) : <span style={{ color:"#d1d5db" }}>—</span>}
                            </td>
                            <td style={{ padding:"9px 12px", color:"#475569", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.contactoDirecto||"—"}</td>
                            <td style={{ padding:"9px 12px", whiteSpace:"nowrap" }}>
                              {r.telefono ? <a href={`tel:${r.telefono.split("|")[0].replace(/\s/g,"")}`} style={{ color:"#3b82f6", textDecoration:"none" }} onClick={e=>e.stopPropagation()}>{r.telefono.slice(0,15)}</a> : <span style={{ color:"#d1d5db" }}>—</span>}
                            </td>
                            <td style={{ padding:"9px 12px" }}>
                              {tag ? <Badge bg={tag.bg} color={tag.color}>{tag.label}</Badge> : <span style={{ color:"#d1d5db" }}>—</span>}
                            </td>
                            <td style={{ padding:"9px 12px", textAlign:"center" }}>
                              {r.tiene_reunion ? <span title="Tiene reunión">🤝</span> : <span style={{ color:"#d1d5db" }}>—</span>}
                            </td>
                            <td style={{ padding:"9px 12px", color:"#6b7280", fontSize:12 }}>{r.quien||"—"}</td>
                          </tr>
                        );
                      })}
                      {filtered.length===0 && (
                        <tr><td colSpan={9} style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>Sin resultados</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {selected && <DetailPanel c={selected} onClose={()=>setSelected(null)} />}
            </div>

            <div style={{ marginTop:14, fontSize:11, color:"#9ca3af", textAlign:"center" }}>
              Datos en tiempo real desde Google Sheets · Edita tu hoja y presiona "Actualizar"
            </div>
          </>
        )}
      </div>
    </div>
  );
}
