import React from "react";

export default function TitleBar() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:"40px", padding:"0 16px", background:"rgba(5,5,10,0.98)", borderBottom:"1px solid rgba(160,122,255,0.2)", flexShrink:0, WebkitAppRegion:"drag" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" stroke="rgba(240,192,64,0.65)" strokeWidth="0.9"/>
          <polygon points="9,2.5 15,13.5 3,13.5" fill="none" stroke="rgba(160,122,255,0.9)" strokeWidth="1"/>
          <polygon points="9,15.5 3,4.5 15,4.5" fill="none" stroke="rgba(160,122,255,0.55)" strokeWidth="0.8"/>
          <circle cx="9" cy="9" r="1.8" fill="rgba(240,192,64,1)"/>
        </svg>
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:"12px", letterSpacing:"0.22em", color:"rgba(240,192,64,0.85)", textTransform:"uppercase" }}>Logos</span>
      </div>
      <div style={{ display:"flex", gap:"4px", WebkitAppRegion:"no-drag" }}>
        <WinBtn label="&#8722;" title="Minimize" onClick={() => window.electronAPI?.minimize()} />
        <WinBtn label="&#9723;" title="Maximize" onClick={() => window.electronAPI?.maximize()} />
        <WinBtn label="&#10005;" title="Close" onClick={() => window.electronAPI?.close()} danger />
      </div>
    </div>
  );
}

function WinBtn({ label, title, onClick, danger }) {
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width:"30px", height:"30px", borderRadius:"7px", border:"none", cursor:"pointer", fontSize:"14px", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s",
        background: h ? (danger ? "rgba(220,50,50,0.35)" : "rgba(160,122,255,0.22)") : "rgba(160,122,255,0.08)",
        color: h ? (danger ? "#ff8080" : "#c4a0ff") : "#9080c0" }}
      dangerouslySetInnerHTML={{ __html: label }}
    />
  );
}
