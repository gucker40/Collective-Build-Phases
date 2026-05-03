import React, { useState, useEffect, useRef, useCallback } from "react";
import { API } from "../api.js";

const STORAGE_KEY = "logos_library_v1";
const ACCEPT_EXTS = [".lnk", ".exe", ".url"];

// ── Persistence ───────────────────────────────────────────────────────────────
function loadLibrary() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveLibrary(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// ── Icons for known apps ──────────────────────────────────────────────────────
const KNOWN = {
  steam:    { color:"#1b2838", accent:"#66c0f4", icon:"S", gradient:"linear-gradient(135deg,#1b2838,#2a475e)" },
  discord:  { color:"#23272a", accent:"#5865f2", icon:"D", gradient:"linear-gradient(135deg,#23272a,#5865f2)" },
  spotify:  { color:"#121212", accent:"#1db954", icon:"♪", gradient:"linear-gradient(135deg,#121212,#1db954)" },
  chrome:   { color:"#202124", accent:"#4285f4", icon:"C", gradient:"linear-gradient(135deg,#4285f4,#ea4335)" },
  firefox:  { color:"#20123a", accent:"#ff7139", icon:"F", gradient:"linear-gradient(135deg,#20123a,#ff7139)" },
  epic:     { color:"#0f0f0f", accent:"#2a9d8f", icon:"E", gradient:"linear-gradient(135deg,#0f0f0f,#2a9d8f)" },
  battlenet:{ color:"#00214d", accent:"#148eff", icon:"B", gradient:"linear-gradient(135deg,#00214d,#148eff)" },
  obs:      { color:"#1a1a2e", accent:"#302ead", icon:"⊙", gradient:"linear-gradient(135deg,#1a1a2e,#302ead)" },
  vscode:   { color:"#1e1e2e", accent:"#007acc", icon:"⟨⟩", gradient:"linear-gradient(135deg,#1e1e2e,#007acc)" },
};

function guessTheme(name) {
  const n = name.toLowerCase();
  for (const [key, theme] of Object.entries(KNOWN)) {
    if (n.includes(key)) return theme;
  }
  // Generate consistent color from name
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return {
    color: `hsl(${hue},40%,10%)`,
    accent: `hsl(${hue},70%,60%)`,
    icon: name[0]?.toUpperCase() || "?",
    gradient: `linear-gradient(135deg,hsl(${hue},40%,8%),hsl(${hue},60%,25%))`,
  };
}

function launch(item) {
  if (window.electronAPI?.launchApp) {
    window.electronAPI.launchApp(item.path);
  } else {
    console.log("Launch:", item.path);
  }
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function AddModal({ onAdd, onClose }) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [err,  setErr]  = useState("");

  function submit() {
    if (!name.trim()) { setErr("Name is required"); return; }
    if (!path.trim()) { setErr("Path is required"); return; }
    onAdd({ id: Date.now().toString(), name: name.trim(), path: path.trim(), pinned: false, lastOpened: null });
    onClose();
  }

  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(2,2,8,0.85)",backdropFilter:"blur(8px)" }}
      onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={{ width:440,background:"linear-gradient(160deg,#0e0e1e,#080810)",border:"1px solid rgba(160,122,255,0.4)",borderRadius:16,overflow:"hidden",boxShadow:"0 0 80px rgba(160,122,255,0.2),0 40px 80px rgba(0,0,0,0.8)" }}>
        <div style={{ padding:"18px 22px",borderBottom:"1px solid rgba(160,122,255,0.12)",display:"flex",alignItems:"center",gap:10 }}>
          <span style={{ fontFamily:"'Cinzel',serif",fontSize:12,color:"#d4a820",letterSpacing:"0.18em" }}>ADD TO LIBRARY</span>
          <button onClick={onClose} style={{ marginLeft:"auto",background:"transparent",border:"none",color:"#6050a0",cursor:"pointer",fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"22px" }}>
          <Field label="Display Name" value={name} onChange={setName} placeholder="e.g. Steam" />
          <Field label="Path / Target" value={path} onChange={setPath} placeholder="C:\Program Files\Steam\Steam.exe" mono />
          <p style={{ fontSize:11,color:"#6050a0",fontFamily:"monospace",marginBottom:16,lineHeight:1.6 }}>
            Tip: drag a .lnk or .exe onto the library to import automatically.
          </p>
          {err && <p style={{ color:"#ff9090",fontSize:12,marginBottom:10 }}>{err}</p>}
          <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
            <Btn onClick={onClose} label="Cancel" />
            <Btn onClick={submit} label="Add to Library" primary />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, mono }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block",fontSize:11,color:"#8070b0",fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:5 }}>{label}</label>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(160,122,255,0.2)",borderRadius:8,padding:"9px 12px",color:"#f0ecff",fontFamily:mono?"'IBM Plex Mono',monospace":"inherit",fontSize:13,outline:"none",boxSizing:"border-box" }}
        onFocus={e=>e.target.style.borderColor="rgba(160,122,255,0.5)"}
        onBlur={e=>e.target.style.borderColor="rgba(160,122,255,0.2)"}
      />
    </div>
  );
}

function Btn({ onClick, label, primary }) {
  return (
    <button onClick={onClick}
      style={{ padding:"8px 20px",borderRadius:8,fontSize:12,fontFamily:"'IBM Plex Mono',monospace",cursor:"pointer",border:primary?"1px solid rgba(160,122,255,0.5)":"1px solid rgba(160,122,255,0.2)",background:primary?"rgba(160,122,255,0.25)":"transparent",color:primary?"#c4a0ff":"#8070b0",transition:"all 0.15s" }}
      onMouseEnter={e=>{e.currentTarget.style.background=primary?"rgba(160,122,255,0.38)":"rgba(160,122,255,0.1)";}}
      onMouseLeave={e=>{e.currentTarget.style.background=primary?"rgba(160,122,255,0.25)":"transparent";}}
    >{label}</button>
  );
}

// ── App Card ──────────────────────────────────────────────────────────────────
function AppCard({ item, onRemove, onPin }) {
  const [hover, setHover] = useState(false);
  const theme = guessTheme(item.name);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ position:"relative",borderRadius:14,overflow:"hidden",cursor:"pointer",
        background: theme.gradient,
        border: hover ? `1px solid ${theme.accent}55` : "1px solid rgba(255,255,255,0.06)",
        transition:"all 0.18s",
        transform: hover ? "translateY(-3px) scale(1.01)" : "none",
        boxShadow: hover ? `0 12px 40px ${theme.accent}30, 0 0 0 1px ${theme.accent}20` : "0 4px 16px rgba(0,0,0,0.4)",
      }}
      onClick={() => launch(item)}
    >
      {/* Hero area */}
      <div style={{ height:130,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden" }}>
        {/* Background glow */}
        <div style={{ position:"absolute",inset:0,background:`radial-gradient(ellipse at 50% 60%, ${theme.accent}25, transparent 70%)`,pointerEvents:"none" }} />
        {/* Icon letter */}
        <span style={{ fontSize:52,fontFamily:"'Cinzel',serif",color:theme.accent,opacity:0.9,textShadow:`0 0 40px ${theme.accent}80`,userSelect:"none" }}>
          {theme.icon}
        </span>
        {/* Pin indicator */}
        {item.pinned && (
          <div style={{ position:"absolute",top:8,right:8,width:8,height:8,borderRadius:"50%",background:"#f0c040",boxShadow:"0 0 8px #f0c04080" }} />
        )}
      </div>

      {/* Name bar */}
      <div style={{ padding:"10px 14px 12px",background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)" }}>
        <p style={{ fontFamily:"'IBM Plex Sans',sans-serif",fontSize:13,fontWeight:600,color:"#f0ecff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
          {item.name}
        </p>
        <p style={{ fontFamily:"monospace",fontSize:10,color:"rgba(255,255,255,0.3)",margin:"3px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
          {item.path.split("\\").pop() || item.path}
        </p>
      </div>

      {/* Hover actions */}
      {hover && (
        <div style={{ position:"absolute",top:8,left:8,display:"flex",gap:5 }}
          onClick={e => e.stopPropagation()}>
          <CardBtn onClick={() => onPin(item.id)} title={item.pinned?"Unpin":"Pin"} color="#f0c040">
            {item.pinned ? "★" : "☆"}
          </CardBtn>
          <CardBtn onClick={() => onRemove(item.id)} title="Remove" color="#ff6060">✕</CardBtn>
        </div>
      )}
    </div>
  );
}

function CardBtn({ onClick, title, color, children }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width:26,height:26,borderRadius:6,background:"rgba(0,0,0,0.7)",border:`1px solid ${color}44`,color,cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}
      onMouseEnter={e=>{e.currentTarget.style.background=`${color}22`;}}
      onMouseLeave={e=>{e.currentTarget.style.background="rgba(0,0,0,0.7)";}}
    >{children}</button>
  );
}

// ── Main Library ──────────────────────────────────────────────────────────────
export default function Library() {
  const [items,    setItems]    = useState(loadLibrary);
  const [search,   setSearch]   = useState("");
  const [showAdd,  setShowAdd]  = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [filter,   setFilter]   = useState("all"); // all | pinned
  const dropRef = useRef(null);

  useEffect(() => { saveLibrary(items); }, [items]);

  const addItem = useCallback((item) => {
    setItems(prev => {
      if (prev.find(i => i.path === item.path)) return prev; // no dupes
      return [...prev, item];
    });
  }, []);

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const togglePin = useCallback((id) => {
    setItems(prev => prev.map(i => i.id === id ? {...i, pinned: !i.pinned} : i));
  }, []);

  // Drag-and-drop import
  function onDragOver(e) { e.preventDefault(); setDragOver(true); }
  function onDragLeave() { setDragOver(false); }
  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    const files = [...e.dataTransfer.files];
    files.forEach(f => {
      const ext = "." + f.name.split(".").pop().toLowerCase();
      if (ACCEPT_EXTS.includes(ext) || ext === ".exe") {
        const name = f.name.replace(/\.(lnk|exe|url)$/i, "");
        addItem({ id: Date.now().toString() + Math.random(), name, path: f.path || f.name, pinned: false, lastOpened: null });
      }
    });
  }

  // Filter + sort: pinned first, then alphabetical
  const visible = items
    .filter(i => {
      if (filter === "pinned" && !i.pinned) return false;
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div
      ref={dropRef}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      style={{ display:"flex",flexDirection:"column",height:"100%",background:"rgba(4,4,10,0.98)",position:"relative" }}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div style={{ position:"absolute",inset:0,zIndex:100,background:"rgba(160,122,255,0.12)",border:"2px dashed rgba(160,122,255,0.6)",borderRadius:0,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:48,marginBottom:12 }}>⊕</div>
            <p style={{ fontFamily:"'Cinzel',serif",fontSize:14,color:"#c4a0ff",letterSpacing:"0.15em" }}>DROP TO IMPORT</p>
            <p style={{ fontFamily:"monospace",fontSize:11,color:"#8070b0",marginTop:6 }}>.lnk · .exe · .url</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:"18px 22px 12px",borderBottom:"1px solid rgba(160,122,255,0.1)",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12 }}>
          <span style={{ fontFamily:"'Cinzel',serif",fontSize:12,color:"#d4a820",letterSpacing:"0.2em",flex:1 }}>LIBRARY</span>
          <span style={{ fontSize:10,color:"#5040a0",fontFamily:"monospace" }}>{items.length} apps</span>
          <button onClick={() => setShowAdd(true)}
            style={{ width:28,height:28,borderRadius:8,background:"rgba(160,122,255,0.18)",border:"1px solid rgba(160,122,255,0.35)",color:"#c4a0ff",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center" }}
            onMouseEnter={e=>{e.currentTarget.style.background="rgba(160,122,255,0.3)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(160,122,255,0.18)";}}
          >+</button>
        </div>

        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search library..."
          style={{ width:"100%",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(160,122,255,0.15)",borderRadius:8,padding:"7px 12px",color:"#d0c8e8",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,outline:"none",boxSizing:"border-box",marginBottom:8 }}
          onFocus={e=>e.target.style.borderColor="rgba(160,122,255,0.4)"}
          onBlur={e=>e.target.style.borderColor="rgba(160,122,255,0.15)"}
        />

        <div style={{ display:"flex",gap:6 }}>
          {[["all","All"],["pinned","Pinned ★"]].map(([val,lbl]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ padding:"3px 12px",borderRadius:6,fontSize:10,fontFamily:"monospace",cursor:"pointer",border:`1px solid ${filter===val?"rgba(160,122,255,0.5)":"rgba(160,122,255,0.15)"}`,background:filter===val?"rgba(160,122,255,0.2)":"transparent",color:filter===val?"#c4a0ff":"#6050a0" }}
            >{lbl}</button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex:1,overflowY:"auto",padding:"14px 14px 20px" }}>
        {visible.length === 0 && (
          <div style={{ height:"60%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,padding:32 }}>
            {items.length === 0 ? (
              <>
                <div style={{ fontSize:36,opacity:0.3 }}>⊞</div>
                <p style={{ fontFamily:"'Cinzel',serif",fontSize:13,color:"#5040a0",letterSpacing:"0.1em",textAlign:"center" }}>YOUR LIBRARY IS EMPTY</p>
                <p style={{ fontFamily:"monospace",fontSize:11,color:"#3d2f80",textAlign:"center",lineHeight:1.7 }}>
                  Drop .lnk or .exe files here<br/>or click + to add manually
                </p>
              </>
            ) : (
              <p style={{ color:"#5040a0",fontSize:12,fontFamily:"monospace" }}>No results for "{search}"</p>
            )}
          </div>
        )}

        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12 }}>
          {visible.map(item => (
            <AppCard key={item.id} item={item} onRemove={removeItem} onPin={togglePin} />
          ))}
        </div>
      </div>

      {showAdd && <AddModal onAdd={addItem} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
