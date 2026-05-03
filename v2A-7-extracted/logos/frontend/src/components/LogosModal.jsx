import React, { useEffect, useRef } from "react";

const INTENTS = [
  { id:"explain",  label:"Explain",     glyph:"", desc:"Reason, analyze, teach",    member:"Pneuma", color:"#b090ff" },
  { id:"build",    label:"Build",        glyph:"", desc:"Generate code & artifacts", member:"Techne", color:"#f0c040" },
  { id:"refine",   label:"Refine",       glyph:"", desc:"Edit, improve, fix",        member:"Pneuma", color:"#b090ff" },
  { id:"research", label:"Research",     glyph:"", desc:"Deep analysis & synthesis", member:"Pneuma", color:"#b090ff" },
  { id:"remember", label:"Remember",     glyph:"", desc:"Seal this to memory",       member:"Memory", color:"#50e8a0" },
  { id:"council",  label:"Full Council", glyph:"", desc:"All three united",          member:"All",    color:"#f0c040", special:true },
];

export default function LogosModal({ visible, suggested, onSelect, onDismiss }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (e.key==="Escape") onDismiss(); };
    if (visible) window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div style={{ position:"absolute", inset:0, zIndex:50, display:"flex", alignItems:"flex-end", justifyContent:"center", paddingBottom:"100px", background:"rgba(2,2,6,0.75)", backdropFilter:"blur(6px)" }}
      onClick={e => { if (e.target===e.currentTarget) onDismiss(); }}>
      <div ref={ref} style={{ width:"540px", background:"linear-gradient(160deg,#0e0e1e 0%,#080810 100%)", border:"1px solid rgba(160,122,255,0.4)", borderRadius:"18px", overflow:"hidden", boxShadow:"0 0 100px rgba(160,122,255,0.25), 0 40px 80px rgba(0,0,0,0.8)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"18px 22px", borderBottom:"1px solid rgba(160,122,255,0.15)" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" stroke="rgba(200,180,255,0.4)" strokeWidth="0.9"/>
            <polygon points="12,3.5 20,17.5 4,17.5" fill="none" stroke="rgba(160,122,255,0.9)" strokeWidth="1.1"/>
            <polygon points="12,20.5 4,6.5 20,6.5" fill="none" stroke="rgba(160,122,255,0.5)" strokeWidth="0.9"/>
            <circle cx="12" cy="12" r="2" fill="rgba(240,192,64,1)"/>
          </svg>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:"12px", color:"#d4a820", letterSpacing:"0.2em", textTransform:"uppercase" }}>
            Logos  How shall I proceed?
          </span>
          <span style={{ marginLeft:"auto", fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", padding:"3px 10px", borderRadius:"6px",
            color: suggested ? "#c4a0ff" : "#6050a0",
            background: suggested ? "rgba(160,122,255,0.15)" : "rgba(160,122,255,0.06)",
            border: suggested ? "1px solid rgba(160,122,255,0.3)" : "1px solid rgba(160,122,255,0.12)",
          }}>
            {suggested ? `suggested: ${suggested}` : "detecting intent..."}
          </span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px", padding:"18px" }}>
          {INTENTS.map(({ id, label, glyph, desc, member, color, special }) => {
            const isSugg = id === suggested;
            return (
              <button key={id} onClick={() => onSelect(id)}
                style={{ padding:"16px 14px 13px", borderRadius:"11px", textAlign:"left", border: isSugg ? `1px solid rgba(160,122,255,0.55)` : special ? "1px solid rgba(240,192,64,0.3)" : "1px solid rgba(255,255,255,0.08)", background: isSugg ? "rgba(160,122,255,0.22)" : special ? "rgba(240,192,64,0.07)" : "rgba(255,255,255,0.04)", cursor:"pointer", transition:"all 0.15s", display:"flex", flexDirection:"column", gap:"5px" }}
                onMouseEnter={e => { if (!isSugg) e.currentTarget.style.background = special ? "rgba(240,192,64,0.12)" : "rgba(160,122,255,0.15)"; }}
                onMouseLeave={e => { if (!isSugg) e.currentTarget.style.background = special ? "rgba(240,192,64,0.07)" : "rgba(255,255,255,0.04)"; }}
              >
                <span style={{ fontSize:"20px", color, lineHeight:1 }}>{glyph}</span>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:"13px", color: special ? "#f0c040" : "#e8e0ff", letterSpacing:"0.04em" }}>{label}</span>
                <span style={{ fontSize:"11px", color:"#9080c0", lineHeight:"1.4" }}>{desc}</span>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color, marginTop:"2px" }}> {member}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 22px 16px", borderTop:"1px solid rgba(160,122,255,0.1)" }}>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", color:"#5850a0" }}>Esc to dismiss</span>
          <button onClick={onDismiss}
            style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", color:"#9080c0", background:"transparent", border:"1px solid rgba(160,122,255,0.2)", padding:"5px 14px", borderRadius:"7px", cursor:"pointer" }}
            onMouseEnter={e => { e.currentTarget.style.color="#c4a0ff"; e.currentTarget.style.borderColor="rgba(160,122,255,0.4)"; }}
            onMouseLeave={e => { e.currentTarget.style.color="#9080c0"; e.currentTarget.style.borderColor="rgba(160,122,255,0.2)"; }}
          >Fast Path</button>
        </div>
      </div>
    </div>
  );
}
