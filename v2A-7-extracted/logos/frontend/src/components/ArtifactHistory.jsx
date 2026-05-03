import React, { useState, useEffect, useCallback, useRef } from "react";

import { API } from "../api.js";
import { useLayout } from "../useLayout.js";

const LANG_COLOR = { html:"#f0c040", svg:"#50c8e8", css:"#b090ff", js:"#80d8ff",
  ts:"#60a8ff", jsx:"#a0d890", tsx:"#70c890", python:"#ff9090", sql:"#e8a060",
  bash:"#90d870", csv:"#50e890", json:"#d0c080", md:"#c0c0d8" };

const LANG_ICON = { html:"⬡", svg:"◈", css:"◎", js:"⟨⟩", ts:"⟨⟩", jsx:"⟨⟩",
  tsx:"⟨⟩", python:"𝒑", sql:"⊞", bash:"$", csv:"⊟", json:"{ }", md:"¶" };

const ACCEPT = ".html,.htm,.svg,.css,.js,.ts,.jsx,.tsx,.py,.sql,.sh,.csv,.json,.md,.zip";

export default function ArtifactHistory({ onOpen }) {
  const [arts, setArts]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadMsg, setUploadMsg] = useState("");
  const [dragOver, setDragOver]   = useState(false);
  const [filter, setFilter]       = useState("");
  const [search, setSearch]       = useState("");
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/artifacts/list`);
      setArts((await r.json()).artifacts || []);
    } catch { setArts([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function uploadFiles(fileList) {
    if (!fileList?.length) return;
    setUploading(true); setUploadPct(5); setUploadMsg(`Importing ${fileList.length} file${fileList.length>1?"s":""}…`);
    const fd = new FormData();
    for (const f of fileList) fd.append("files", f);
    try {
      setUploadPct(35);
      const r   = await fetch(`${API}/artifacts/upload`, { method:"POST", body:fd });
      const d   = await r.json();
      setUploadPct(90);
      const n   = d.count || 0;
      setUploadMsg(n > 0 ? `✓ Imported ${n} artifact${n>1?"s":""}` : "No supported files found");
      await load();
      setUploadPct(100);
      setTimeout(() => { setUploading(false); setUploadPct(0); setUploadMsg(""); }, 1800);
    } catch (e) {
      setUploadMsg(`Upload failed: ${e.message}`);
      setTimeout(() => { setUploading(false); setUploadPct(0); setUploadMsg(""); }, 2500);
    }
  }

  function onFileChange(e) { uploadFiles(e.target.files); e.target.value = ""; }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }

  async function del(e, id) {
    e.stopPropagation();
    await fetch(`${API}/artifacts/delete/${id}`, { method:"DELETE" }).catch(()=>{});
    setArts(a => a.filter(x => x.id !== id));
  }

  async function openById(a) {
    try {
      const r = await fetch(`${API}/artifacts/get/${a.id}`);
      const d = await r.json();
      if (d.content) onOpen({ type:"code", language:d.language||"html", content:d.content, title:d.title });
    } catch {}
  }

  // Filter and search
  const langs = [...new Set(arts.map(a => (a.language||"html").toLowerCase()))].sort();
  const visible = arts.filter(a => {
    const lang = (a.language||"html").toLowerCase();
    if (filter && lang !== filter) return false;
    if (search && !(a.title||"").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:"rgba(4,4,10,0.98)" }}>

      {/* Header */}
      <div style={{ padding:"16px 14px 10px", borderBottom:"1px solid rgba(160,122,255,0.12)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color:"#d4a820", letterSpacing:"0.2em", textTransform:"uppercase" }}>
            Projects
          </span>
          <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
            <span style={{ fontSize:"10px", color:"#5040a0", fontFamily:"monospace" }}>{arts.length} artifact{arts.length!==1?"s":""}</span>
            <button onClick={load} title="Refresh"
              style={{ background:"transparent", border:"none", color:"#6050a0", cursor:"pointer", fontSize:"14px", lineHeight:1 }}>↺</button>
          </div>
        </div>

        {/* Search */}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
          style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(160,122,255,0.15)", borderRadius:"7px", padding:"6px 10px", color:"#d0c8e8", fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", outline:"none", marginBottom:"8px", boxSizing:"border-box" }}
        />

        {/* Language filter pills */}
        {langs.length > 1 && (
          <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
            <Pill label="All" active={!filter} color="#a07aff" onClick={()=>setFilter("")} />
            {langs.map(l => (
              <Pill key={l} label={l.toUpperCase()} active={filter===l}
                color={LANG_COLOR[l]||"#a07aff"} onClick={()=>setFilter(f=>f===l?"":l)} />
            ))}
          </div>
        )}
      </div>

      {/* Upload zone — drag & drop or click */}
      <div
        onDragOver={e=>{e.preventDefault();setDragOver(true);}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={onDrop}
        onClick={()=>!uploading && fileRef.current?.click()}
        style={{
          margin:"10px 10px 0",
          borderRadius:"10px",
          border:`1.5px dashed ${dragOver?"rgba(160,122,255,0.7)":"rgba(160,122,255,0.22)"}`,
          background: dragOver ? "rgba(160,122,255,0.1)" : "rgba(160,122,255,0.03)",
          padding: uploading ? "10px 14px" : "14px",
          cursor: uploading ? "default" : "pointer",
          transition:"all 0.18s",
          flexShrink:0,
        }}
      >
        <input ref={fileRef} type="file" multiple accept={ACCEPT} style={{ display:"none" }} onChange={onFileChange} />

        {uploading ? (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
              <span style={{ fontSize:"11px", color:"#a07aff", fontFamily:"monospace" }}>{uploadMsg}</span>
              <span style={{ fontSize:"11px", color:"#6050a0", fontFamily:"monospace" }}>{uploadPct}%</span>
            </div>
            <div style={{ height:"3px", background:"rgba(160,122,255,0.12)", borderRadius:"2px", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${uploadPct}%`, background:"linear-gradient(90deg,#6040c0,#a07aff)", borderRadius:"2px", transition:"width 0.4s ease", boxShadow:"0 0 8px rgba(160,122,255,0.5)" }} />
            </div>
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink:0, color:"rgba(160,122,255,0.5)" }}>
              <path d="M10 13V4M10 4L7 7M10 4l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 14v1a2 2 0 002 2h10a2 2 0 002-2v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <div>
              <p style={{ margin:0, fontSize:"12px", color:"rgba(160,122,255,0.7)", fontFamily:"'IBM Plex Sans',sans-serif" }}>
                {dragOver ? "Drop to import" : "Upload projects"}
              </p>
              <p style={{ margin:"2px 0 0", fontSize:"10px", color:"#5040a0", fontFamily:"monospace" }}>
                HTML · ZIP · SVG · JS · CSS · and more
              </p>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"8px 6px 6px" }}>
        {loading && (
          <p style={{ color:"#6050a0", fontSize:"12px", padding:"20px", textAlign:"center" }}>Loading…</p>
        )}
        {!loading && visible.length === 0 && (
          <div style={{ padding:"30px 16px", textAlign:"center" }}>
            {arts.length === 0 ? (
              <>
                <p style={{ color:"#5040a0", fontSize:"13px", lineHeight:1.7, margin:"0 0 8px" }}>No projects yet.</p>
                <p style={{ color:"#3d2f80", fontSize:"11px", lineHeight:1.7, margin:0 }}>
                  Upload your HTML files above,<br/>or ask Logos to build something.
                </p>
              </>
            ) : (
              <p style={{ color:"#5040a0", fontSize:"12px" }}>No results for "{search || filter}"</p>
            )}
          </div>
        )}

        {visible.map(a => {
          const lang  = (a.language||"html").toLowerCase();
          const color = LANG_COLOR[lang] || "#a07aff";
          const icon  = LANG_ICON[lang]  || "◆";
          const isUploaded = a.uploaded;
          return (
            <div key={a.id} onClick={() => openById(a)}
              style={{ padding:"10px 11px 9px", borderRadius:"9px", marginBottom:"2px", cursor:"pointer", background:"transparent", border:"1px solid transparent", position:"relative", transition:"all 0.12s" }}
              onMouseEnter={e => { e.currentTarget.style.background="rgba(160,122,255,0.1)"; e.currentTarget.style.borderColor="rgba(160,122,255,0.2)"; e.currentTarget.querySelector(".art-del").style.opacity="1"; }}
              onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.querySelector(".art-del").style.opacity="0"; }}
            >
              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"3px" }}>
                <span style={{ fontSize:"13px", color, lineHeight:1, flexShrink:0 }}>{icon}</span>
                <span style={{ fontSize:"13px", color:"#e8e0ff", fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, paddingRight:"22px" }}>
                  {a.title || "Untitled"}
                </span>
              </div>
              <div style={{ fontSize:"10px", color:"#6050a0", fontFamily:"monospace", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                  <span style={{ color:`${color}99` }}>{lang.toUpperCase()}</span>
                  {isUploaded && (
                    <span style={{ color:"rgba(80,200,144,0.5)", fontSize:"9px", border:"1px solid rgba(80,200,144,0.2)", borderRadius:"3px", padding:"0 4px" }}>uploaded</span>
                  )}
                </div>
                <span>{a.created_ago || ""}</span>
              </div>
              <button className="art-del" onClick={e=>del(e,a.id)}
                style={{ position:"absolute", top:"9px", right:"7px", opacity:0, background:"transparent", border:"none", color:"rgba(255,100,100,0.7)", cursor:"pointer", fontSize:"12px", transition:"opacity 0.15s", padding:"2px 5px", borderRadius:"4px" }}>
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ label, active, color, onClick }) {
  return (
    <button onClick={onClick}
      style={{ padding:"2px 8px", borderRadius:"5px", fontSize:"9px", fontFamily:"monospace", cursor:"pointer", border:`1px solid ${active?color+"66":"rgba(160,122,255,0.15)"}`, background: active ? `${color}18` : "transparent", color: active ? color : "#6050a0", transition:"all 0.12s" }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=color+"44"; e.currentTarget.style.color=color;}}
      onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor="rgba(160,122,255,0.15)"; e.currentTarget.style.color="#6050a0";}}}
    >{label}</button>
  );
}
