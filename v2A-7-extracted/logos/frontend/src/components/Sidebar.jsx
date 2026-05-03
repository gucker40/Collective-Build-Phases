import React, { useState, useEffect } from "react";

import { API } from "../api.js";

const NAV = [
  { id:"chat",      label:"Chat",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2.5 4a1 1 0 011-1h13a1 1 0 011 1v9a1 1 0 01-1 1H11.5L8 17v-3H3.5a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg> },
  { id:"artifacts", label:"Projects",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/><rect x="10.5" y="3" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/><rect x="3" y="10.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/><path d="M13.75 10.5v6.5M10.5 13.75h6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
  { id:"library",   label:"Library",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="8" y="3" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="1.4"/><rect x="14" y="6" width="4" height="11" rx="1" stroke="currentColor" strokeWidth="1.4"/></svg> },
  { id:"browser",   label:"Browser",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4"/><path d="M2 10h16M10 2c-2 2-3 5-3 8s1 6 3 8M10 2c2 2 3 5 3 8s-1 6-3 8" stroke="currentColor" strokeWidth="1.4"/></svg> },
  { id:"vault",     label:"Vault",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M6 7h8M6 10h8M6 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
  { id:"memory",    label:"Memory",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4"/><circle cx="10" cy="10" r="2.8" stroke="currentColor" strokeWidth="1.4"/><path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
  { id:"settings",  label:"Settings",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.8" stroke="currentColor" strokeWidth="1.4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
];

const DevIcon = <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M6 7l-4 3 4 3M14 7l4 3-4 3M11 5l-2 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const LogoutIcon = <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M13 3h4a1 1 0 011 1v12a1 1 0 01-1 1h-4M8 14l4-4-4-4M2 10h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;

export default function Sidebar({ activeView, onNavigate, onNewChat, isAdmin, user, onLogout }) {
  const [status, setStatus]   = useState({});
  const [showUser, setShowUser] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API}/logos/status`);
        const d = await r.json();
        setStatus(d.council || {});
      } catch {}
    };
    check();
    const t = setInterval(check, 20000);
    return () => clearInterval(t);
  }, []);

  const initials = (user?.display_name || user?.username || "?")
    .split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ width:"68px", flexShrink:0, background:"rgba(5,5,10,0.9)",
      borderRight:"1px solid rgba(160,122,255,0.15)", display:"flex", flexDirection:"column",
      alignItems:"center", padding:"14px 0 12px", gap:"3px", position:"relative" }}>

      {/* Sigil / new chat */}
      <div onClick={onNewChat} title="New chat"
        style={{ width:"46px", height:"46px", display:"flex", alignItems:"center",
          justifyContent:"center", marginBottom:"12px", cursor:"pointer" }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ animation:"breathe 3.5s ease-in-out infinite" }}>
          <circle cx="20" cy="20" r="18.5" stroke="rgba(200,180,255,0.45)" strokeWidth="1"/>
          <circle cx="20" cy="20" r="14" stroke="rgba(160,122,255,0.25)" strokeWidth="0.6" strokeDasharray="2 4"/>
          <polygon points="20,6.5 31,25.5 9,25.5" fill="none" stroke="rgba(160,122,255,0.9)" strokeWidth="1.2"/>
          <polygon points="20,33.5 9,14.5 31,14.5" fill="none" stroke="rgba(160,122,255,0.55)" strokeWidth="0.9"/>
          <circle cx="20" cy="20" r="3" fill="rgba(240,192,64,1)"/>
        </svg>
      </div>

      <div style={{ width:"36px", height:"1px", background:"rgba(160,122,255,0.25)", margin:"2px 0 8px" }} />

      {/* Nav items */}
      {NAV.map(({ id, label, icon }) => {
        const active = activeView === id;
        return (
          <button key={id} onClick={() => onNavigate(id)} title={label}
            style={{ width:"48px", height:"48px", borderRadius:"12px", display:"flex",
              alignItems:"center", justifyContent:"center",
              border: active ? "1px solid rgba(160,122,255,0.5)" : "1px solid transparent",
              background: active ? "rgba(160,122,255,0.22)" : "transparent",
              color: active ? "#c4a0ff" : "#7868a0", cursor:"pointer",
              transition:"all 0.15s", marginBottom:"3px" }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background="rgba(160,122,255,0.14)"; e.currentTarget.style.color="#c4a0ff"; }}}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#7868a0"; }}}>
            {icon}
          </button>
        );
      })}

      {/* Bottom section */}
      <div style={{ marginTop:"auto", display:"flex", flexDirection:"column", alignItems:"center", gap:"5px" }}>

        {/* Council status */}
        {[["P","pneuma"],["T","techne"],["O","opsis"]].map(([lbl, key]) => (
          <div key={lbl} title={`${key}: ${status[key] ? "ready" : "not loaded"}`}
            style={{ width:"22px", height:"22px", borderRadius:"5px", display:"flex",
              alignItems:"center", justifyContent:"center", fontFamily:"'Cinzel',serif",
              fontSize:"9px", letterSpacing:"0.05em",
              color: status[key] ? "#f0c040" : "#443860",
              background: status[key] ? "rgba(240,192,64,0.1)" : "transparent",
              border: status[key] ? "1px solid rgba(240,192,64,0.25)" : "1px solid rgba(160,122,255,0.1)" }}>
            {lbl}
          </div>
        ))}

        <div style={{ width:"36px", height:"1px", background:"rgba(160,122,255,0.15)", margin:"4px 0" }} />

        {/* Dev console (admin only) */}
        {isAdmin && (
          <button onClick={() => onNavigate("devconsole")} title="Dev Console"
            style={{ width:"36px", height:"36px", borderRadius:"8px", display:"flex",
              alignItems:"center", justifyContent:"center", border:"1px solid rgba(240,192,64,0.2)",
              background:"rgba(240,192,64,0.06)", color:"rgba(240,192,64,0.7)", cursor:"pointer",
              transition:"all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.background="rgba(240,192,64,0.15)"; e.currentTarget.style.color="#f0c040"; }}
            onMouseLeave={e => { e.currentTarget.style.background="rgba(240,192,64,0.06)"; e.currentTarget.style.color="rgba(240,192,64,0.7)"; }}>
            {DevIcon}
          </button>
        )}

        {/* User avatar + logout */}
        <div style={{ position:"relative" }}>
          <div onClick={() => setShowUser(!showUser)} title={user?.display_name}
            style={{ width:"32px", height:"32px", borderRadius:"50%", display:"flex",
              alignItems:"center", justifyContent:"center", cursor:"pointer",
              background:"rgba(160,122,255,0.2)", border:"1px solid rgba(160,122,255,0.35)",
              fontFamily:"'Cinzel',serif", fontSize:"10px", color:"#c4a0ff",
              letterSpacing:"0.05em", userSelect:"none" }}>
            {initials}
          </div>

          {showUser && (
            <div style={{ position:"absolute", bottom:"40px", left:"50px", zIndex:100,
              background:"#07070e", border:"1px solid rgba(160,122,255,0.3)", borderRadius:"10px",
              padding:"12px", minWidth:"160px", boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}>
              <div style={{ fontFamily:"'Cinzel',serif", fontSize:"12px", color:"#f0ecff",
                letterSpacing:"0.06em", marginBottom:"2px" }}>
                {user?.display_name}
              </div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px",
                color:"#8878c8", marginBottom:"12px" }}>
                @{user?.username}
                {user?.role === "admin" && (
                  <span style={{ marginLeft:"6px", color:"#f0c040", fontSize:"9px" }}>ADMIN</span>
                )}
              </div>
              <button onClick={() => { setShowUser(false); onLogout(); }}
                style={{ width:"100%", padding:"7px 10px", display:"flex", alignItems:"center",
                  gap:"8px", background:"rgba(255,96,96,0.08)", border:"1px solid rgba(255,96,96,0.2)",
                  borderRadius:"6px", color:"#ff9090", fontFamily:"'IBM Plex Mono',monospace",
                  fontSize:"11px", cursor:"pointer", letterSpacing:"0.05em" }}>
                {LogoutIcon} Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
