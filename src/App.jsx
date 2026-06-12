import { useState, useEffect, useMemo } from "react";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SHEET_ID = "10QnaE3Bl99TgoyCy7kvz6yX39ESVh6QiUHcY-TtPq-c";
const SHEET_NAME = "BD PRINCIPAL CLIENT POTENCIALES";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

// ── HELPERS ──────────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  // Find header row (contains CLIENTE)
  let headerIdx = lines.findIndex(l => l.includes("CLIENTE") && l.includes("ESTADO"));
  if (headerIdx === -1) headerIdx = 1;
  const headers = parseCSVLine(lines[headerIdx]).map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]).map(c => c.replace(/^"|"$/g, "").trim());
    if (!cols[0]) continue;
    const obj = {};
    headers.forEach((h, j) => { obj[h] = cols[j] || ""; });
    rows.push(obj);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(cur); cur = "";
    } else cur += ch;
  }
  result.push(cur);
  return result;
}

function mapRow(r, idx) {
  return {
    id: idx,
    cliente: r["CLIENTE"] || "",
    estado: r["ESTADO"] || "",
    quien: r["QUIEN LO LLAMO"] || "",
    emis: r["EMIS"] || "",
    rues: r["RUES"] || "",
    interes: r["COMENTARIOS"] || "",
    contacto1: r["CONTACTÓ"] === "TRUE",
    contacto2: r["SEGUNDO CONTACTO"] === "TRUE",
    quePaso: r["¿QUÉ PASÓ?"] || "",
    fecha: r["FECHA"] || "",
    contactoDirecto: r["CONTACTO DIRECTO"] || "",
    telefono: r["TELEFONO"] || "",
    direccion: r["DIRECCION"] || "",
    correo: r["CORREO"] || "",
    nit: r["NIT"] || "",
    notas: r["COMENTARIOS.1"] || r["COMENTARIOS1"] || "",
  };
}

// ── STYLE MAPS ───────────────────────────────────────────────────────────────
const ESTADO_META = {
  "LLAMAR HOY":        { bg: "#fef08a", color: "#713f12", icon: "📞" },
  "SEGUIMIENTO":       { bg: "#bbf7d0", color: "#14532d", icon: "🔄" },
  "VOLVER A CONTACTAR":{ bg: "#bfdbfe", color: "#1e3a8a", icon: "🔁" },
  "YA NO SEGUIMIENTO": { bg: "#e5e7eb", color: "#6b7280", icon: "🚫" },
  "":                  { bg: "#f3f4f6", color: "#9ca3af", icon: "❓" },
};

const INTERES_TAGS = [
  { match: ["Interés - Llamar","Interés - Info","Interés"],    bg:"#d1fae5",color:"#065f46",label:"✅ Interés"        },
  { match: ["info"],                                             bg:"#dbeafe",color:"#1e40af",label:"ℹ️ Info"          },
  { match: ["No interés - Info","No Interés - Info"],           bg:"#fef3c7",color:"#92400e",label:"⚠️ Sin interés/Info"},
  { match: ["No Interés","No interés"],                         bg:"#fee2e2",color:"#991b1b",label:"❌ No interés"     },
  { match: ["No contesta"],                                      bg:"#f3f4f6",color:"#374151",label:"📵 No contesta"   },
];

function getTag(interes) {
  if (!interes) return null;
  const low = interes.toLowerCase();
  return INTERES_TAGS.find(t => t.match.some(m => low.includes(m.toLowerCase()))) || null;
}

const ESTADOS = ["TODOS","LLAMAR HOY","SEGUIMIENTO","VOLVER A CONTACTAR","YA NO SEGUIMIENTO","Sin estado"];

// ── COMPONENTS ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{ background:"#fff", borderRadius:12, padding:"14px 18px", boxShadow:"0 1px 4px rgba(0,0,0,0.08)", borderLeft:`4px solid ${color}`, minWidth:110 }}>
      <div style={{ fontSize:26, fontWeight:800, color }}>{value}</div>
      <div style={{ fontSize:11, color:"#6b7280", marginTop:2 }}>{label}</div>
    </div>
  );
}

function Badge({ bg, color, children }) {
  return <span style={{ background:bg, color, borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:600, whiteSpace:"nowrap" }}>{children}</span>;
}

function DetailPanel({ c, onClose }) {
  const em = ESTADO_META[c.estado] || ESTADO_META[""];
  const tag = getTag(c.interes);

  const Field = ({ label, val }) => {
    if (!val || val === "nan" || val === "FALSE" || val === "TRUE") return null;
    const isEmail = val.includes("@");
    const isTel = /^\+?[\d\s\-|]{7,}$/.test(val.split("|")[0]);
    const isUrl = val.startsWith("http");
    return (
      <div style={{ marginBottom:10 }}>
        <div style={{ fontSize:11, color:"#9ca3af", marginBottom:2 }}>{label}</div>
        <div style={{ fontSize:13, color:"#1e293b", wordBreak:"break-word" }}>
          {isEmail ? <a href={`mailto:${val}`} style={{ color:"#3b82f6" }}>{val}</a>
          : isTel && !val.includes(" ") ? <a href={`tel:${val}`} style={{ color:"#3b82f6" }}>{val}</a>
          : isUrl ? <a href={val} target="_blank" rel="noopener noreferrer" style={{ color:"#7c3aed" }}>{val.length > 40 ? val.slice(0,40)+"…" : val}</a>
          : val}
        </div>
      </div>
    );
  };

  return (
    <div style={{ width:320, background:"#fff", borderRadius:12, boxShadow:"0 1px 6px rgba(0,0,0,0.1)", padding:20, height:"fit-content", flexShrink:0, position:"sticky", top:20 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div style={{ fontWeight:800, fontSize:14, lineHeight:1.3, flex:1 }}>{c.cliente}</div>
        <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", fontSize:20, color:"#9ca3af", marginLeft:8, lineHeight:1 }}>×</button>
      </div>

      <Badge bg={em.bg} color={em.color}>{em.icon} {c.estado || "Sin estado"}</Badge>
      {tag && <span style={{ marginLeft:6 }}><Badge bg={tag.bg} color={tag.color}>{tag.label}</Badge></span>}

      <div style={{ marginTop:14 }}>
        <Field label="👤 Contacto directo" val={c.contactoDirecto} />
        <Field label="📞 Teléfono" val={c.telefono} />
        <Field label="✉️ Correo" val={c.correo && c.correo.includes("@") ? c.correo : null} />
        <Field label="📍 Dirección" val={c.direccion && !c.direccion.includes("http") && !c.direccion.includes("@") && !c.direccion.match(/^\d{4}-\d{2}-\d{2}/) ? c.direccion : null} />
        <Field label="🏢 NIT" val={c.nit} />
        <Field label="📅 Fecha" val={c.fecha && c.fecha !== "nan" && !c.fecha.startsWith("nan") ? c.fecha : null} />
        <Field label="👔 Asignado a" val={c.quien} />
      </div>

      {c.quePaso && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>📝 Último paso</div>
          <div style={{ background:"#f8fafc", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#374151", lineHeight:1.5 }}>{c.quePaso}</div>
        </div>
      )}
      {c.notas && c.notas.length > 1 && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:"#9ca3af", marginBottom:4 }}>🗒️ Notas</div>
          <div style={{ background:"#fffbeb", borderRadius:8, padding:"10px 12px", fontSize:12, color:"#374151", lineHeight:1.5 }}>{c.notas}</div>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("TODOS");
  const [filterQuien, setFilterQuien] = useState("TODOS");
  const [selected, setSelected] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(CSV_URL);
      if (!res.ok) throw new Error("No se pudo cargar la hoja");
      const text = await res.text();
      const rows = parseCSV(text).map(mapRow).filter(r => r.cliente.length > 1);
      setData(rows);
      setLastUpdate(new Date().toLocaleTimeString("es-CO"));
    } catch (e) {
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

  const filtered = useMemo(() => {
    return data.filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.cliente.toLowerCase().includes(q) ||
        r.contactoDirecto.toLowerCase().includes(q) ||
        r.telefono.includes(q) ||
        r.quePaso.toLowerCase().includes(q);
      const matchEstado = filterEstado === "TODOS" ||
        (filterEstado === "Sin estado" ? !r.estado : r.estado === filterEstado);
      const matchQuien = filterQuien === "TODOS" || r.quien.includes(filterQuien);
      return matchSearch && matchEstado && matchQuien;
    });
  }, [data, search, filterEstado, filterQuien]);

  const stats = useMemo(() => ({
    total: data.length,
    llamarHoy: data.filter(r => r.estado === "LLAMAR HOY").length,
    seguimiento: data.filter(r => r.estado === "SEGUIMIENTO").length,
    volver: data.filter(r => r.estado === "VOLVER A CONTACTAR").length,
    yaNo: data.filter(r => r.estado === "YA NO SEGUIMIENTO").length,
    conInteres: data.filter(r => {
      const low = r.interes.toLowerCase();
      return low.includes("interés") && !low.startsWith("no");
    }).length,
  }), [data]);

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:16, color:"#475569" }}>
      <div style={{ fontSize:40 }}>📋</div>
      <div style={{ fontSize:16, fontWeight:600 }}>Cargando datos desde Google Sheets…</div>
      <div style={{ fontSize:13, color:"#9ca3af" }}>Conectando con tu hoja de cálculo</div>
    </div>
  );

  if (error) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:16, color:"#ef4444" }}>
      <div style={{ fontSize:40 }}>⚠️</div>
      <div style={{ fontSize:16, fontWeight:600 }}>Error al cargar datos</div>
      <div style={{ fontSize:13, color:"#6b7280", maxWidth:400, textAlign:"center" }}>{error}</div>
      <div style={{ fontSize:12, color:"#9ca3af", maxWidth:400, textAlign:"center" }}>
        Asegúrate de que la hoja esté compartida como "Cualquier persona con el enlace puede ver"
      </div>
      <button onClick={fetchData} style={{ padding:"10px 20px", background:"#3b82f6", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontWeight:600 }}>
        Reintentar
      </button>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", color:"#1e293b" }}>
      {/* HEADER */}
      <div style={{ background:"#0f172a", color:"#fff", padding:"18px 28px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ fontSize:26 }}>📋</div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, letterSpacing:-0.5 }}>CRM · Clientes Potenciales</div>
            <div style={{ fontSize:11, color:"#94a3b8", marginTop:1 }}>
              {data.length} empresas · Actualizado: {lastUpdate}
            </div>
          </div>
        </div>
        <button onClick={fetchData} style={{ padding:"8px 16px", background:"#1e40af", color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600 }}>
          🔄 Actualizar
        </button>
      </div>

      <div style={{ padding:"20px 28px" }}>
        {/* STATS */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:18 }}>
          <StatCard label="Total"            value={stats.total}      color="#6366f1" />
          <StatCard label="📞 Llamar hoy"   value={stats.llamarHoy}  color="#eab308" />
          <StatCard label="🔄 Seguimiento"  value={stats.seguimiento} color="#22c55e" />
          <StatCard label="🔁 Volver contactar" value={stats.volver} color="#3b82f6" />
          <StatCard label="✅ Con interés"  value={stats.conInteres} color="#10b981" />
          <StatCard label="🚫 Cerrados"     value={stats.yaNo}       color="#9ca3af" />
        </div>

        {/* FILTERS */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14 }}>
          <input
            placeholder="🔍 Buscar empresa, contacto, teléfono o acción…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex:1, minWidth:220, padding:"9px 14px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, outline:"none", background:"#fff" }}
          />
          <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
            style={{ padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, background:"#fff", cursor:"pointer" }}>
            {ESTADOS.map(e => <option key={e}>{e}</option>)}
          </select>
          <select value={filterQuien} onChange={e => setFilterQuien(e.target.value)}
            style={{ padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:13, background:"#fff", cursor:"pointer" }}>
            {quienes.map(q => <option key={q}>{q}</option>)}
          </select>
          <div style={{ padding:"9px 14px", background:"#f1f5f9", borderRadius:8, fontSize:13, color:"#475569", display:"flex", alignItems:"center" }}>
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div style={{ display:"flex", gap:20, alignItems:"flex-start" }}>
          {/* TABLE */}
          <div style={{ flex:1, background:"#fff", borderRadius:12, boxShadow:"0 1px 4px rgba(0,0,0,0.07)", overflow:"hidden", minWidth:0 }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#f8fafc", borderBottom:"2px solid #e2e8f0" }}>
                    {["Estado","Empresa","Contacto","Teléfono","Interés","Asignado","Último paso"].map(h => (
                      <th key={h} style={{ padding:"10px 14px", textAlign:"left", fontWeight:600, color:"#475569", whiteSpace:"nowrap", fontSize:12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const em = ESTADO_META[r.estado] || ESTADO_META[""];
                    const tag = getTag(r.interes);
                    const isSelected = selected?.id === r.id;
                    return (
                      <tr key={r.id}
                        onClick={() => setSelected(isSelected ? null : r)}
                        style={{ borderBottom:"1px solid #f1f5f9", cursor:"pointer", background: isSelected ? "#eff6ff" : "transparent" }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f8fafc"; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}>
                        <td style={{ padding:"9px 14px", whiteSpace:"nowrap" }}>
                          <Badge bg={em.bg} color={em.color}>{em.icon} {r.estado || "—"}</Badge>
                        </td>
                        <td style={{ padding:"9px 14px", fontWeight:600, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {r.cliente}
                        </td>
                        <td style={{ padding:"9px 14px", color:"#475569", maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {r.contactoDirecto || "—"}
                        </td>
                        <td style={{ padding:"9px 14px", whiteSpace:"nowrap" }}>
                          {r.telefono
                            ? <a href={`tel:${r.telefono.split("|")[0].replace(/\s/g,"")}`} style={{ color:"#3b82f6", textDecoration:"none" }} onClick={e => e.stopPropagation()}>
                                {r.telefono.length > 16 ? r.telefono.slice(0,16)+"…" : r.telefono}
                              </a>
                            : <span style={{ color:"#d1d5db" }}>—</span>}
                        </td>
                        <td style={{ padding:"9px 14px" }}>
                          {tag ? <Badge bg={tag.bg} color={tag.color}>{tag.label}</Badge>
                               : <span style={{ color:"#d1d5db" }}>—</span>}
                        </td>
                        <td style={{ padding:"9px 14px", color:"#6b7280", fontSize:12 }}>{r.quien || "—"}</td>
                        <td style={{ padding:"9px 14px", color:"#374151", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {r.quePaso || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding:40, textAlign:"center", color:"#9ca3af" }}>
                        Sin resultados para la búsqueda actual
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* DETAIL PANEL */}
          {selected && <DetailPanel c={selected} onClose={() => setSelected(null)} />}
        </div>

        {/* FOOTER */}
        <div style={{ marginTop:16, fontSize:11, color:"#9ca3af", textAlign:"center" }}>
          Los datos se leen en tiempo real desde Google Sheets · Para modificar, edita directamente tu hoja de cálculo y presiona "Actualizar"
        </div>
      </div>
    </div>
  );
}
