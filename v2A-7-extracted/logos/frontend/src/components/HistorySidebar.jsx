import React, { useState, useEffect, useCallback } from "react";

import { API } from "../api.js";
import { useLayout } from "../useLayout.js";

export default function HistorySidebar({ refresh, onLoad, onNew, activeSessionId, mobile }) {
  const { isMobile, isTablet } = useLayout();
  const isNarrow = mobile || isMobile || isTablet;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/history/list`);
      const d = await r.json();
      setSessions(d.sessions || []);
    } catch { setSessions([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refresh]);

  async function del(e, id) {
    e.stopPropagation();
    await fetch(`${API}/history/delete/${id}`, { method:"DELETE" });
    setSessions(s => s.filter(x => x.id !== id));
  }

  function timeAgo(ts) {
    if (!ts) return "";
    const d = Math.floor((Date.now()/1000 - ts)/86400);
    if (d===0) return "today"; if (d===1) return "yesterday";
    if (d<7) return `${d}d ago`; if (d<30) return `${Math.floor(d/7)}w ago`;
    return `${Math.floor(d/30)}mo ago`;
  }

  return (
    <div style={{ width: isNarrow ? "100%" : "230px", flexShrink:0, background:"rgba(6,6,12,0.97)", borderRight: isNarrow ? "none" : "1px solid rgba(160,122,255,0.15)", display:"flex", flexDirection:"column", overflow:"hidden", height: isNarrow ? "100%" : "auto" }}>
      {/* Header */}
      <div style={{ padding:"16px 14px 12px", borderBottom:"1px solid rgba(160,122,255,0.12)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color:"#d4a820", letterSpacing:"0.2em", textTransform:"uppercase" }}>
          History
        </span>
        <button onClick={onNew} title="New chat"
          style={{ width:"28px", height:"28px", borderRadius:"7px", background:"rgba(160,122,255,0.18)", border:"1px solid rgba(160,122,255,0.35)", color:"#c4a0ff", cursor:"pointer", fontSize:"18px", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}
          onMouseEnter={e => { e.currentTarget.style.background="rgba(160,122,255,0.3)"; }}
          onMouseLeave={e => { e.currentTarget.style.background="rgba(160,122,255,0.18)"; }}
        >+</button>
      </div>

      {/* List */}
      <div style={{ flex:1, overflowY:"auto", padding:"6px 6px" }}>
        {loading && <p style={{ color:"#6860a0", fontSize:"12px", padding:"14px", textAlign:"center" }}>Loading...</p>}
        {!loading && sessions.length === 0 && (
          <p style={{ color:"#6860a0", fontSize:"13px", padding:"20px 12px", textAlign:"center", lineHeight:1.7 }}>
            No history yet.<br/>Start a conversation.
          </p>
        )}
        {sessions.map(s => (
          <div key={s.id} onClick={() => onLoad(s)}
            style={{ padding:"11px 11px 9px", borderRadius:"9px", marginBottom:"3px", cursor:"pointer", background: activeSessionId===s.id ? "rgba(160,122,255,0.18)" : "transparent", border: activeSessionId===s.id ? "1px solid rgba(160,122,255,0.35)" : "1px solid transparent", position:"relative", transition:"all 0.12s" }}
            onMouseEnter={e => {
              if (activeSessionId!==s.id) e.currentTarget.style.background="rgba(160,122,255,0.1)";
              e.currentTarget.querySelector(".del-btn").style.opacity="1";
            }}
            onMouseLeave={e => {
              if (activeSessionId!==s.id) e.currentTarget.style.background="transparent";
              e.currentTarget.querySelector(".del-btn").style.opacity="0";
            }}
          >
            <div style={{ fontSize:"14px", color:"#e8e0ff", fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:500, marginBottom:"4px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", paddingRight:"22px" }}>
              {s.title || "Untitled"}
            </div>
            <div style={{ fontSize:"11px", color:"#7868a0", fontFamily:"'IBM Plex Mono',monospace", display:"flex", justifyContent:"space-between" }}>
              <span>{s.message_count} msgs</span>
              <span>{timeAgo(s.updated_at)}</span>
            </div>
            <button className="del-btn" onClick={e => del(e, s.id)}
              style={{ position:"absolute", top:"9px", right:"7px", opacity:0, background:"transparent", border:"none", color:"rgba(255,100,100,0.7)", cursor:"pointer", fontSize:"13px", transition:"opacity 0.15s", padding:"2px 5px", borderRadius:"4px" }}
            >&#10005;</button>
          </div>
        ))}
      </div>
    </div>
  );
}
