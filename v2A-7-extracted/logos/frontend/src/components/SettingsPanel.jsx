import React, { useState, useEffect, useRef } from "react";

import { API } from "../api.js";
import { useLayout } from "../useLayout.js";

export default function SettingsPanel({ mobile }) {
  const { isMobile, isTablet } = useLayout();
  const isNarrow = mobile || isMobile || isTablet;
  const [cfg, setCfg]       = useState(null);
  const [tests, setTests]   = useState({});
  const [testing, setTesting] = useState({});
  const [saved, setSaved]   = useState(false);
  const saveTimer           = useRef(null);

  useEffect(() => {
    fetch(`${API}/settings`).then(r => r.json()).then(setCfg).catch(() =>
      setCfg({ provider:"hybrid", groq_key:"", lmstudio_url:"http://localhost:1234",
               ollama_url:"http://localhost:11434", performanceProfile:"max", preloadOnBoot:true })
    );
  }, []);

  function update(key, value) {
    const next = { ...cfg, [key]: value };
    setCfg(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(next), 600);
  }

  async function persist(data) {
    const d = data || cfg;
    try {
      await fetch(`${API}/settings`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(d) });
      await window.electronAPI?.saveConfig?.(d);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }

  async function testProvider(provider) {
    setTesting(t => ({...t, [provider]: true}));
    try {
      const r = await fetch(`${API}/test/${provider}`, { method:"POST" });
      const d = await r.json();
      setTests(t => ({...t, [provider]: d}));
    } catch(e) {
      setTests(t => ({...t, [provider]: { ok:false, msg:e.message }}));
    }
    setTesting(t => ({...t, [provider]: false}));
  }

  async function warmNow() {
    try { await fetch(`${API}/preload`, { method:"POST" }); } catch {}
  }

  if (!cfg) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#6050a0", fontFamily:"monospace", fontSize:"13px" }}>Loading...</div>;

  return (
    <div style={{ height:"100%", overflowY:"auto", WebkitOverflowScrolling:"touch", padding: isNarrow ? "16px 14px 24px" : "28px 36px", maxWidth:"680px" }}>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"28px" }}>
        <div>
          <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:"17px", color:"#f0c040", letterSpacing:"0.12em", textTransform:"uppercase", margin:0 }}>Settings</h2>
          <p style={{ fontSize:"11px", color:"#5040a0", fontFamily:"monospace", marginTop:"4px" }}>The Collective - Logos AI Council</p>
        </div>
        {saved && <Pill color="#50e890">Saved</Pill>}
      </div>

      {/* Hybrid Architecture */}
      <Section title="Council Routing" glyph="">
        <p style={{ fontSize:"12px", color:"#8070b0", marginBottom:"14px", lineHeight:"1.7" }}>
          Each council member uses the best provider for their role:
        </p>
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          <RoutingCard icon="" name="Pneuma" role="Reasoning & chat" provider="Groq" fallback="Ollama" color="#b090ff"
            desc="Fast cloud responses. Falls back to Ollama if no key." />
          <RoutingCard icon="" name="Techne" role="Code & artifacts" provider="LM Studio" fallback="Ollama" color="#f0c040"
            desc="Your local coder model on GPU. Best for building things." />
          <RoutingCard icon="" name="Opsis" role="Vision & images" provider="Ollama" fallback="none" color="#50c8e8"
            desc="Local vision model. Only activates when you attach an image." />
        </div>
        <div style={{ marginTop:"14px" }}>
          <p style={{ fontSize:"11px", color:"#5040a0", fontFamily:"monospace", marginBottom:"8px" }}>Override: use single provider for all</p>
          <div style={{ display:"flex", gap:"8px" }}>
            {["hybrid","groq","lmstudio","ollama"].map(p => (
              <button key={p} onClick={() => update("provider", p)}
                style={{ padding:"6px 14px", borderRadius:"7px", border:`1px solid ${cfg.provider===p ? "rgba(160,122,255,0.5)" : "rgba(160,122,255,0.15)"}`, background: cfg.provider===p ? "rgba(160,122,255,0.2)" : "transparent", color: cfg.provider===p ? "#c4a0ff" : "#6050a0", cursor:"pointer", fontFamily:"monospace", fontSize:"11px", letterSpacing:"0.05em" }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Groq */}
      <Section title="Groq (Pneuma)" glyph="">
        <p style={{ fontSize:"11px", color:"#8070b0", marginBottom:"10px" }}>Free API key from console.groq.com - 300+ tokens/sec</p>
        <input type="password" value={cfg.groq_key || ""}
          onChange={e => update("groq_key", e.target.value)}
          placeholder="gsk_..."
          style={{ width:"100%", padding:"10px 12px", borderRadius:"8px", background:"rgba(5,5,12,0.9)", border:"1px solid rgba(240,192,64,0.3)", color:"#f0ecff", fontFamily:"monospace", fontSize:"13px", outline:"none", marginBottom:"10px" }}
        />
        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
          <select value={cfg.groq_model_pneuma || "llama-3.1-8b-instant"}
            onChange={e => update("groq_model_pneuma", e.target.value)}
            style={{ flex:1, padding:"8px 10px", borderRadius:"7px", background:"rgba(5,5,12,0.9)", border:"1px solid rgba(240,192,64,0.2)", color:"#e0d0ff", fontFamily:"monospace", fontSize:"12px", outline:"none" }}>
            <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (fastest, free)</option>
            <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (smarter, free)</option>
            <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (long context, free)</option>
          </select>
          <TestBtn onClick={() => testProvider("groq")} loading={testing.groq} result={tests.groq} />
        </div>
      </Section>

      {/* LM Studio */}
      <Section title="LM Studio (Techne)" glyph="">
        <p style={{ fontSize:"11px", color:"#8070b0", marginBottom:"10px" }}>Local GPU inference for code. Auto-started by The Collective.</p>
        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
          <input type="text" value={cfg.lmstudio_url || "http://localhost:1234"}
            onChange={e => update("lmstudio_url", e.target.value)}
            style={{ flex:1, padding:"10px 12px", borderRadius:"8px", background:"rgba(5,5,12,0.9)", border:"1px solid rgba(80,200,232,0.3)", color:"#f0ecff", fontFamily:"monospace", fontSize:"13px", outline:"none" }}
          />
          <TestBtn onClick={() => testProvider("lmstudio")} loading={testing.lmstudio} result={tests.lmstudio} />
        </div>
      </Section>

      {/* Ollama */}
      <Section title="Ollama (Opsis + Fallback)" glyph="">
        <p style={{ fontSize:"11px", color:"#8070b0", marginBottom:"10px" }}>Vision model and Pneuma fallback. Auto-started by The Collective.</p>
        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
          <input type="text" value={cfg.ollama_url || "http://localhost:11434"}
            onChange={e => update("ollama_url", e.target.value)}
            style={{ flex:1, padding:"10px 12px", borderRadius:"8px", background:"rgba(5,5,12,0.9)", border:"1px solid rgba(160,122,255,0.3)", color:"#f0ecff", fontFamily:"monospace", fontSize:"13px", outline:"none" }}
          />
          <TestBtn onClick={() => testProvider("ollama")} loading={testing.ollama} result={tests.ollama} />
        </div>
      </Section>

      {/* Preload */}
      <Section title="Model Preloading" glyph="">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderRadius:"9px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(160,122,255,0.1)", marginBottom:"10px" }}>
          <div>
            <p style={{ fontSize:"13px", color:"#e0d8f8", marginBottom:"2px" }}>Preload models at Windows startup</p>
            <p style={{ fontSize:"11px", color:"#5040a0", fontFamily:"monospace" }}>Warms all three council models into memory at login</p>
          </div>
          <Toggle value={cfg.preloadOnBoot !== false} onChange={v => update("preloadOnBoot", v)} />
        </div>
        <button onClick={warmNow}
          style={{ width:"100%", padding:"11px", borderRadius:"9px", background:"rgba(160,122,255,0.15)", border:"1px solid rgba(160,122,255,0.3)", color:"#c4a0ff", fontFamily:"'Cinzel',serif", fontSize:"12px", letterSpacing:"0.06em", cursor:"pointer" }}>
          Warm All Models Now
        </button>
      </Section>

    </div>
  );
}

function RoutingCard({ icon, name, role, provider, fallback, color, desc }) {
  return (
    <div style={{ padding:"12px 14px", borderRadius:"9px", background:"rgba(5,5,12,0.6)", border:`1px solid ${color}18`, display:"flex", alignItems:"flex-start", gap:"12px" }}>
      <span style={{ fontSize:"18px", color, marginTop:"1px" }}>{icon}</span>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"3px" }}>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:"12px", color:"#e8e0ff", letterSpacing:"0.04em" }}>{name}</span>
          <span style={{ fontSize:"10px", color:"#6050a0" }}>{role}</span>
          <span style={{ marginLeft:"auto", fontSize:"10px", fontFamily:"monospace", color, background:`${color}15`, border:`1px solid ${color}30`, padding:"1px 7px", borderRadius:"4px" }}>{provider}</span>
          {fallback !== "none" && <span style={{ fontSize:"10px", color:"#5040a0", fontFamily:"monospace" }}>-&gt; {fallback}</span>}
        </div>
        <p style={{ fontSize:"11px", color:"#6050a0" }}>{desc}</p>
      </div>
    </div>
  );
}

function TestBtn({ onClick, loading, result }) {
  const ok = result?.ok;
  return (
    <button onClick={onClick} disabled={loading}
      style={{ padding:"8px 14px", borderRadius:"8px", border:`1px solid ${ok===true ? "rgba(80,232,144,0.4)" : ok===false ? "rgba(255,100,100,0.4)" : "rgba(160,122,255,0.3)"}`, background: ok===true ? "rgba(80,232,144,0.12)" : ok===false ? "rgba(255,100,100,0.12)" : "rgba(160,122,255,0.12)", color: ok===true ? "#50e890" : ok===false ? "#ff9090" : "#c4a0ff", fontFamily:"monospace", fontSize:"11px", cursor:"pointer", whiteSpace:"nowrap", minWidth:"70px" }}>
      {loading ? "..." : result ? result.msg?.slice(0,18) || (ok ? "OK" : "Fail") : "Test"}
    </button>
  );
}

function Section({ title, glyph, children }) {
  return (
    <div style={{ marginBottom:"28px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"14px" }}>
        <span style={{ color:"#6050a0", fontSize:"13px" }}>{glyph}</span>
        <h3 style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color:"#8070c0", letterSpacing:"0.2em", textTransform:"uppercase" }}>{title}</h3>
        <div style={{ flex:1, height:"1px", background:"rgba(160,122,255,0.12)", marginLeft:"8px" }} />
      </div>
      {children}
    </div>
  );
}

function Pill({ color, children }) {
  return <span style={{ fontSize:"11px", color, fontFamily:"monospace", padding:"3px 10px", background:`${color}15`, border:`1px solid ${color}30`, borderRadius:"6px" }}>{children}</span>;
}

function Toggle({ value, onChange }) {
  return (
    <button onClick={() => onChange(!value)}
      style={{ width:"44px", height:"24px", borderRadius:"12px", border:"none", cursor:"pointer", flexShrink:0, position:"relative", transition:"background 0.2s",
        background: value ? "rgba(160,122,255,0.5)" : "rgba(160,122,255,0.12)" }}>
      <div style={{ position:"absolute", top:"3px", left: value ? "23px" : "3px", width:"18px", height:"18px", borderRadius:"50%", transition:"left 0.2s",
        background: value ? "#c4a0ff" : "#6050a0" }} />
    </button>
  );
}
