import React, { useState, useEffect } from "react";

import { API } from "../api.js";

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

export default function LoadingScreen({ onReady }) {
  const [step, setStep]       = useState("Starting Logos backend...");
  const [elapsed, setElapsed] = useState(0);
  const [dots, setDots]       = useState("");

  useEffect(() => {
    const t1 = setInterval(() => setElapsed(e => e + 1), 1000);
    const t2 = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 400);
    startUp();
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  async function startUp() {
    const maxWait = 40; // 40s max — venv boots in ~5s, 40s covers slow machines
    for (let i = 0; i < maxWait; i++) {
      try {
        const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) });
        if (r.ok) {
          setStep("Ready");
          await sleep(300);
          onReady();
          return;
        }
      } catch {}
      if      (i < 3)  setStep("Starting backend");
      else if (i < 10) setStep("Loading packages");
      else if (i < 25) setStep("Initialising");
      else             setStep("Almost ready");
      await sleep(1000);
    }
    setStep("Entering Logos");
    await sleep(300);
    onReady();
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"#080810", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'IBM Plex Sans',sans-serif" }}>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", background:"radial-gradient(ellipse at 50% 40%, rgba(120,60,220,0.18) 0%, transparent 65%)" }} />

      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ marginBottom:"32px", animation:"breathe 3s ease-in-out infinite" }}>
        <circle cx="40" cy="40" r="37" stroke="rgba(200,180,255,0.35)" strokeWidth="1"/>
        <circle cx="40" cy="40" r="28" stroke="rgba(160,122,255,0.18)" strokeWidth="0.7" strokeDasharray="3 5"/>
        <polygon points="40,11 63,53 17,53" fill="none" stroke="rgba(160,122,255,0.85)" strokeWidth="1.4"/>
        <polygon points="40,69 17,27 63,27" fill="none" stroke="rgba(160,122,255,0.5)" strokeWidth="1.1"/>
        <circle cx="40" cy="40" r="5" fill="rgba(240,192,64,1)"/>
        <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(160,122,255,0.3)" strokeWidth="1"
          strokeDasharray="15 200" style={{ animation:"sigilSpin 3s linear infinite", transformOrigin:"40px 40px" }}/>
      </svg>

      <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:"24px", letterSpacing:"0.25em", color:"#f0c040", margin:"0 0 4px", textTransform:"uppercase" }}>
        Logos
      </h1>
      <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color:"#5040a0", letterSpacing:"0.2em", margin:"0 0 40px", textTransform:"uppercase" }}>
        Logos AI Council
      </p>

      <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"12px", color:"#7060b0" }}>
        {step}{dots}
      </p>

      {elapsed > 8 && step !== "Ready" && (
        <p style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color:"#4030a0", marginTop:"12px" }}>
          {elapsed}s elapsed
        </p>
      )}
    </div>
  );
}
