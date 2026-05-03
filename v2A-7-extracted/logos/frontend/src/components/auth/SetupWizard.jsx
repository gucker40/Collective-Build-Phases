// SetupWizard.jsx - First-run setup wizard for Logos
import React, { useState, useEffect } from "react";
import { useAuth, API } from "./AuthContext.jsx";

const C = {
  bg:      "#0d0d1a",
  surface: "#07070e",
  card:    "#0a0a16",
  border:  "rgba(160,122,255,0.2)",
  purple:  "#a07aff",
  gold:    "#f0c040",
  text:    "#f0ecff",
  muted:   "#8878c8",
  error:   "#ff6060",
  success: "#50d890",
  input:   "rgba(160,122,255,0.08)",
};

// ── Shared components ──────────────────────────────────────────────────────────
function Field({ label, type = "text", value, onChange, placeholder, note, error }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px",
        letterSpacing: "0.12em", color: C.muted, marginBottom: "6px", textTransform: "uppercase" }}>
        {label}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: "100%", padding: "10px 14px", background: C.input, border: `1px solid ${focused ? C.purple : C.border}`,
          borderRadius: "8px", color: C.text, fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "14px",
          outline: "none", transition: "border-color 0.15s", boxSizing: "border-box" }}
      />
      {note  && <div style={{ color: C.muted,  fontSize: "11px", marginTop: "5px", fontFamily: "'IBM Plex Mono',monospace" }}>{note}</div>}
      {error && <div style={{ color: C.error,  fontSize: "11px", marginTop: "5px", fontFamily: "'IBM Plex Mono',monospace" }}>{error}</div>}
    </div>
  );
}

function Btn({ children, onClick, loading, variant = "primary", small, disabled }) {
  const variants = {
    primary: { bg: "rgba(160,122,255,0.18)", border: "rgba(160,122,255,0.5)", color: "#c4a0ff" },
    gold:    { bg: "rgba(240,192,64,0.12)",  border: "rgba(240,192,64,0.4)",  color: C.gold },
    ghost:   { bg: "transparent",             border: C.border,                color: C.muted },
    success: { bg: "rgba(80,216,144,0.1)",   border: "rgba(80,216,144,0.4)",  color: C.success },
  };
  const s = variants[variant] || variants.primary;
  return (
    <button onClick={onClick} disabled={loading || disabled}
      style={{ padding: small ? "8px 18px" : "11px 22px", background: s.bg, border: `1px solid ${s.border}`,
        borderRadius: "8px", color: s.color, fontFamily: "'Cinzel',serif", fontSize: small ? "11px" : "13px",
        letterSpacing: "0.08em", cursor: loading || disabled ? "not-allowed" : "pointer",
        opacity: loading || disabled ? 0.55 : 1, transition: "all 0.15s" }}>
      {loading ? "..." : children}
    </button>
  );
}

function StepCard({ title, subtitle, children }) {
  return (
    <div style={{ animation: "stepIn 0.3s ease" }}>
      <div style={{ fontFamily: "'Cinzel',serif", fontSize: "20px", color: C.text,
        letterSpacing: "0.1em", marginBottom: "6px" }}>{title}</div>
      {subtitle && <div style={{ fontSize: "13px", color: C.muted, marginBottom: "24px",
        fontFamily: "'IBM Plex Sans',sans-serif", lineHeight: "1.5" }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function SelectCard({ label, description, selected, onClick }) {
  return (
    <div onClick={onClick} style={{ padding: "14px 16px", background: selected ? "rgba(160,122,255,0.14)" : C.input,
      border: `1px solid ${selected ? "rgba(160,122,255,0.55)" : C.border}`, borderRadius: "10px",
      cursor: "pointer", marginBottom: "10px", transition: "all 0.15s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "16px", height: "16px", borderRadius: "50%", border: `2px solid ${selected ? C.purple : C.border}`,
          background: selected ? C.purple : "transparent", flexShrink: 0, transition: "all 0.15s" }} />
        <div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: "13px", color: selected ? "#c4a0ff" : C.text,
            letterSpacing: "0.05em" }}>{label}</div>
          {description && <div style={{ fontSize: "12px", color: C.muted, marginTop: "3px",
            fontFamily: "'IBM Plex Sans',sans-serif" }}>{description}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Hardware tiers ─────────────────────────────────────────────────────────────
const TIERS = [
  { id: "lite",       label: "Lite",        vram: "4–8GB VRAM / CPU-only",
    pneuma: "llama3.2:3b", techne: "qwen2.5-coder:3b", opsis: "moondream:latest",
    desc: "Smaller models, slower but works on modest hardware" },
  { id: "standard",   label: "Standard",    vram: "8–12GB VRAM (RTX 3070/3080)",
    pneuma: "qwen3:8b", techne: "qwen2.5-coder:7b", opsis: "qwen2-vl:7b",
    desc: "Recommended — balanced speed and quality" },
  { id: "performance",label: "Performance", vram: "16–24GB VRAM (RTX 3090/4090)",
    pneuma: "qwen3:14b", techne: "qwen2.5-coder:14b", opsis: "llava:13b",
    desc: "High quality, requires powerful GPU" },
  { id: "maxed",      label: "Maxed",       vram: "48GB+ / Multi-GPU",
    pneuma: "qwen3:30b", techne: "qwen2.5-coder:32b", opsis: "qwen2-vl:72b",
    desc: "Best quality, extreme hardware only" },
  { id: "cloud",      label: "Cloud Only",  vram: "Any (uses Groq API — no local GPU needed)",
    pneuma: "groq", techne: "groq", opsis: "groq",
    desc: "Requires Groq API key — fast, no local models needed" },
];

// ── Steps ──────────────────────────────────────────────────────────────────────

function StepWelcome({ onNext }) {
  return (
    <StepCard title="Welcome to The Collective"
      subtitle="Your personal AI-powered operating system. Let's get you configured in a few steps.">
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
        {[
          ["🧠", "Logos", "Your AI council — Pneuma, Techne, and Opsis"],
          ["🗺️", "Mind Map", "Every note, chat, and project — connected"],
          ["📊", "Dashboard", "Portfolio, finances, tasks — all in one view"],
          ["🌐", "Web Access", "Access Logos from any device"],
        ].map(([icon, name, desc]) => (
          <div key={name} style={{ display: "flex", alignItems: "center", gap: "14px",
            padding: "12px 14px", background: C.input, borderRadius: "10px", border: `1px solid ${C.border}` }}>
            <span style={{ fontSize: "20px" }}>{icon}</span>
            <div>
              <div style={{ fontFamily: "'Cinzel',serif", fontSize: "13px", color: C.text, letterSpacing: "0.05em" }}>{name}</div>
              <div style={{ fontSize: "12px", color: C.muted }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
      <Btn onClick={onNext} variant="gold">Begin Setup →</Btn>
    </StepCard>
  );
}

function StepAccount({ onNext, login }) {
  const [username, setUser] = useState("");
  const [display,  setDisp] = useState("");
  const [password, setPass] = useState("");
  const [confirm,  setConf] = useState("");
  const [err, setErr]       = useState({});
  const [loading, setLoad]  = useState(false);
  const [global,  setGlob]  = useState("");

  async function submit() {
    const e = {};
    if (!username.trim())     e.username = "Required";
    if (password.length < 6) e.password = "Min 6 characters";
    if (password !== confirm) e.confirm  = "Passwords don't match";
    setErr(e);
    if (Object.keys(e).length) return;

    setLoad(true); setGlob("");
    try {
      const r = await fetch(`${API}/users/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password,
          display_name: display.trim() || username.trim(),
        }),
      });
      const data = await r.json();
      if (!r.ok) { setGlob(data.detail || "Registration failed"); return; }
      login(data.token, { username: data.username, display_name: data.display_name, role: data.role });
      onNext();
    } catch { setGlob("Cannot reach backend. Make sure Logos is running."); }
    finally { setLoad(false); }
  }

  return (
    <StepCard title="Create Your Profile"
      subtitle="This is your personal identity within Logos. The first account created becomes the admin.">
      {global && <div style={{ color: C.error, fontSize: "12px", marginBottom: "14px",
        fontFamily: "'IBM Plex Mono',monospace", padding: "10px", background: "rgba(255,96,96,0.08)",
        borderRadius: "8px", border: "1px solid rgba(255,96,96,0.2)" }}>{global}</div>}
      <Field label="Username" value={username} onChange={setUser} placeholder="your_username" error={err.username}
        note="Lowercase letters, numbers, - and _ only" />
      <Field label="Display Name" value={display} onChange={setDisp} placeholder="How you appear to others" />
      <Field label="Password" type="password" value={password} onChange={setPass} placeholder="••••••••" error={err.password} />
      <Field label="Confirm Password" type="password" value={confirm} onChange={setConf} placeholder="••••••••" error={err.confirm} />
      <div style={{ marginTop: "20px" }}><Btn onClick={submit} loading={loading} variant="primary">Create Profile →</Btn></div>
    </StepCard>
  );
}

function StepHardware({ tier, setTier, onNext, onBack }) {
  return (
    <StepCard title="Choose Your Hardware Tier"
      subtitle="This determines which AI models power Logos. You can change this anytime in Settings.">
      {TIERS.map(t => (
        <SelectCard key={t.id} label={`${t.label}  ·  ${t.vram}`} description={t.desc}
          selected={tier === t.id} onClick={() => setTier(t.id)} />
      ))}
      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
        <Btn onClick={onBack} variant="ghost" small>← Back</Btn>
        <Btn onClick={onNext} variant="primary">Continue →</Btn>
      </div>
    </StepCard>
  );
}

function StepProviders({ tier, groqKey, setGroqKey, ollamaUrl, setOllamaUrl, lmsUrl, setLmsUrl, onNext, onBack }) {
  const isCloud = tier === "cloud";
  return (
    <StepCard title="Configure AI Providers"
      subtitle="Enter your API keys and service URLs. Your Groq key is pre-configured for invite-only access.">
      <Field label="Groq API Key" type="password" value={groqKey} onChange={setGroqKey}
        placeholder="gsk_..." note={isCloud ? "Required for Cloud Only mode" : "Optional — enables fast cloud inference"} />
      {!isCloud && (
        <>
          <Field label="Ollama URL" value={ollamaUrl} onChange={setOllamaUrl}
            placeholder="http://localhost:11434" note="Default if Ollama is running locally" />
          <Field label="LM Studio URL" value={lmsUrl} onChange={setLmsUrl}
            placeholder="http://localhost:1234" note="Optional — for Techne's code model" />
        </>
      )}
      <div style={{ padding: "12px 14px", background: "rgba(240,192,64,0.07)", border: "1px solid rgba(240,192,64,0.2)",
        borderRadius: "8px", marginTop: "8px", marginBottom: "20px" }}>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px", color: C.gold, letterSpacing: "0.1em", marginBottom: "6px" }}>
          INVITE-ONLY NOTE
        </div>
        <div style={{ fontSize: "12px", color: C.muted, lineHeight: "1.5" }}>
          This is a private tool. API keys are shared for now. In a future version, each user will supply their own.
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <Btn onClick={onBack} variant="ghost" small>← Back</Btn>
        <Btn onClick={onNext} variant="primary">Continue →</Btn>
      </div>
    </StepCard>
  );
}

function StepNetwork({ domain, setDomain, tunnelEnabled, setTunnelEnabled, tunnelToken, setTunnelToken, onNext, onBack }) {
  const [lanIp, setLanIp] = useState("");
  const [cfInstalled, setCfInstalled] = useState(null);

  useEffect(() => {
    fetch(`${API}/network/lan-ip`).then(r => r.json()).then(d => setLanIp(d.ip)).catch(() => {});
    fetch(`${API}/network/cloudflared/check`).then(r => r.json())
      .then(d => setCfInstalled(d.installed)).catch(() => {});
  }, []);

  return (
    <StepCard title="Web & Remote Access"
      subtitle="Access Logos from your phone or any device. Your PC stays as the server.">

      {/* LAN info */}
      <div style={{ padding: "14px", background: C.input, borderRadius: "10px", border: `1px solid ${C.border}`,
        marginBottom: "18px" }}>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px", color: C.muted, marginBottom: "8px", letterSpacing: "0.1em" }}>
          LOCAL NETWORK ACCESS (SAME WIFI)
        </div>
        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", color: C.purple }}>
          http://{lanIp || "..."} :8000/app
        </div>
        <div style={{ fontSize: "11px", color: C.muted, marginTop: "6px" }}>
          Any device on your home WiFi can open this URL right now.
        </div>
      </div>

      {/* Cloudflare tunnel */}
      <div style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <div onClick={() => setTunnelEnabled(!tunnelEnabled)}
            style={{ width: "38px", height: "20px", borderRadius: "10px", cursor: "pointer", transition: "background 0.2s",
              background: tunnelEnabled ? "rgba(160,122,255,0.5)" : "rgba(160,122,255,0.15)",
              border: `1px solid ${tunnelEnabled ? C.purple : C.border}`, flexShrink: 0, position: "relative" }}>
            <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: tunnelEnabled ? C.purple : C.muted,
              position: "absolute", top: "2px", left: tunnelEnabled ? "20px" : "2px", transition: "left 0.2s" }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: "12px", color: C.text, letterSpacing: "0.05em" }}>
              Cloudflare Tunnel (Public URL)
            </div>
            <div style={{ fontSize: "11px", color: C.muted }}>Access from anywhere — free, no port forwarding needed</div>
          </div>
        </div>

        {tunnelEnabled && (
          <div style={{ marginLeft: "50px" }}>
            <Field label="Custom Domain" value={domain} onChange={setDomain}
              placeholder="the-collective.vip" note="Your registered domain (optional — works without it)" />
            <Field label="Cloudflare Tunnel Token" type="password" value={tunnelToken} onChange={setTunnelToken}
              placeholder="eyJhIjoiY..."
              note="Get this from dash.cloudflare.com → Zero Trust → Tunnels → Create Tunnel" />

            {cfInstalled === false && (
              <div style={{ padding: "12px", background: "rgba(240,192,64,0.07)", border: "1px solid rgba(240,192,64,0.25)",
                borderRadius: "8px", marginTop: "8px" }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px", color: C.gold, marginBottom: "6px", letterSpacing: "0.1em" }}>
                  CLOUDFLARED NOT FOUND
                </div>
                <div style={{ fontSize: "12px", color: C.muted, lineHeight: "1.5" }}>
                  Download <strong style={{ color: C.text }}>cloudflared-windows-amd64.exe</strong> from{" "}
                  <span style={{ color: C.purple }}>github.com/cloudflare/cloudflared/releases</span>{" "}
                  and save it to <span style={{ color: C.muted, fontFamily: "monospace" }}>%APPDATA%\logos-app\cloudflared.exe</span>.
                  Then come back here.
                </div>
              </div>
            )}
            {cfInstalled === true && (
              <div style={{ fontSize: "11px", color: C.success, fontFamily: "'IBM Plex Mono',monospace" }}>
                ✓ cloudflared detected
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <Btn onClick={onBack} variant="ghost" small>← Back</Btn>
        <Btn onClick={onNext} variant="primary">Continue →</Btn>
      </div>
    </StepCard>
  );
}

function StepDashboard({ widgets, setWidgets, onNext, onBack }) {
  const ALL_WIDGETS = [
    { id: "clock",     label: "Clock",             desc: "Analog/digital time display" },
    { id: "calendar",  label: "Calendar",           desc: "Monthly calendar view" },
    { id: "todos",     label: "To-Do List",         desc: "Task tracker with priorities" },
    { id: "briefing",  label: "Logos Briefing",     desc: "AI daily summary of your tasks" },
    { id: "portfolio", label: "Portfolio Summary",  desc: "Live stock P&L snapshot" },
    { id: "finance",   label: "Finance Snapshot",   desc: "Worldly expenses vs surplus" },
    { id: "weather",   label: "Weather",            desc: "Current conditions" },
    { id: "system",    label: "System Monitor",     desc: "CPU / RAM / GPU usage" },
    { id: "notes",     label: "Quick Notes",        desc: "Scratch pad widget" },
    { id: "music",     label: "Music Player",       desc: "Local music playback" },
    { id: "habits",    label: "Habit Tracker",      desc: "Daily habit streaks" },
    { id: "crypto",    label: "Crypto Ticker",      desc: "Live crypto prices" },
    { id: "social",    label: "Social Feed",        desc: "Peek at connected accounts" },
    { id: "artifacts", label: "Recent Artifacts",   desc: "Last 5 built artifacts" },
    { id: "mindmap",   label: "Mind Map Preview",   desc: "Mini graph of your knowledge" },
  ];

  function toggle(id) {
    setWidgets(prev => prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]);
  }

  return (
    <StepCard title="Your Dashboard"
      subtitle="Choose which widgets appear on your home screen. You can change this anytime.">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "20px" }}>
        {ALL_WIDGETS.map(w => {
          const active = widgets.includes(w.id);
          return (
            <div key={w.id} onClick={() => toggle(w.id)}
              style={{ padding: "10px 12px", background: active ? "rgba(160,122,255,0.14)" : C.input,
                border: `1px solid ${active ? "rgba(160,122,255,0.5)" : C.border}`, borderRadius: "8px",
                cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "3px", flexShrink: 0,
                  background: active ? C.purple : "transparent", border: `1.5px solid ${active ? C.purple : C.border}`,
                  transition: "all 0.15s" }} />
                <div>
                  <div style={{ fontFamily: "'Cinzel',serif", fontSize: "11px", color: active ? "#c4a0ff" : C.text,
                    letterSpacing: "0.04em" }}>{w.label}</div>
                  <div style={{ fontSize: "10px", color: C.muted, marginTop: "1px" }}>{w.desc}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <Btn onClick={onBack} variant="ghost" small>← Back</Btn>
        <Btn onClick={onNext} variant="primary">Continue →</Btn>
      </div>
    </StepCard>
  );
}

function StepComplete({ config, onFinish, finishing }) {
  const tier = TIERS.find(t => t.id === config.tier) || TIERS[1];
  return (
    <StepCard title="You're Ready"
      subtitle="Logos is configured. Here's a summary of your setup.">
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
        {[
          ["Profile", config.username],
          ["Hardware Tier", tier.label],
          ["Pneuma Model", tier.pneuma],
          ["Techne Model", tier.techne],
          ["Dashboard Widgets", `${config.widgets.length} selected`],
          ["Web Access", config.tunnelEnabled ? `Cloudflare Tunnel → ${config.domain || "configured"}` : "LAN only"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 14px", background: C.input, borderRadius: "8px", border: `1px solid ${C.border}` }}>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "11px", color: C.muted,
              letterSpacing: "0.08em", textTransform: "uppercase" }}>{k}</span>
            <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "13px", color: C.text }}>{v}</span>
          </div>
        ))}
      </div>
      <Btn onClick={onFinish} loading={finishing} variant="gold">Enter Logos →</Btn>
    </StepCard>
  );
}

// ── Progress bar ───────────────────────────────────────────────────────────────
function Progress({ step, total }) {
  const LABELS = ["Welcome", "Profile", "Hardware", "Providers", "Network", "Dashboard", "Complete"];
  return (
    <div style={{ marginBottom: "32px" }}>
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
        {Array.from({ length: total }, (_, i) => (
          <div key={i} style={{ flex: 1, height: "3px", borderRadius: "2px", transition: "background 0.3s",
            background: i < step ? C.purple : i === step ? "rgba(160,122,255,0.5)" : "rgba(160,122,255,0.12)" }} />
        ))}
      </div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px", color: C.muted,
        letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Step {step + 1} of {total} · {LABELS[step] || ""}
      </div>
    </div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────────
export default function SetupWizard({ onComplete }) {
  const { login } = useAuth();
  const [step, setStep]               = useState(0);
  const TOTAL                         = 7;
  const [tier, setTier]               = useState("standard");
  const [groqKey, setGroqKey]         = useState("");
  const [ollamaUrl, setOllamaUrl]     = useState("http://localhost:11434");
  const [lmsUrl, setLmsUrl]           = useState("http://localhost:1234");
  const [domain, setDomain]           = useState("the-collective.vip");
  const [tunnelEnabled, setTunnelEn]  = useState(false);
  const [tunnelToken, setTunnelTok]   = useState("");
  const [widgets, setWidgets]         = useState(["clock","calendar","todos","briefing","portfolio","weather","system","notes"]);
  const [finishing, setFinishing]     = useState(false);

  function next() { setStep(s => Math.min(s + 1, TOTAL - 1)); }
  function back() { setStep(s => Math.max(s - 1, 0)); }

  async function finish() {
    setFinishing(true);
    const tierData = TIERS.find(t => t.id === tier) || TIERS[1];
    try {
      // Save provider config
      await fetch(`${API}/settings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider:          tier === "cloud" ? "groq" : "hybrid",
          groq_key:          groqKey,
          ollama_url:        ollamaUrl,
          lmstudio_url:      lmsUrl,
          performanceProfile: tier,
          groq_model_pneuma: "llama-3.1-8b-instant",
        }),
      });

      // Save network config
      await fetch(`${API}/network/config`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          web_enabled:    true,
          tunnel_enabled: tunnelEnabled,
          tunnel_token:   tunnelToken,
          custom_domain:  domain,
        }),
      });

      // Save dashboard widget prefs locally
      localStorage.setItem("logos_widgets", JSON.stringify(widgets));
      localStorage.setItem("logos_setup_done", "1");

      // Start tunnel if configured
      if (tunnelEnabled && tunnelToken) {
        fetch(`${API}/network/tunnel/start`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tunnelToken }),
        }).catch(() => {});
      }
      onComplete();
    } catch (e) {
      console.error(e);
      onComplete(); // proceed anyway
    } finally {
      setFinishing(false);
    }
  }

  const config = { tier, groqKey, ollamaUrl, lmsUrl, domain, tunnelEnabled, widgets, username: "you" };

  return (
    <div style={{ width: "100vw", height: "100vh", background: C.bg, display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans',sans-serif",
      overflow: "hidden" }}>

      {/* Ambient */}
      <div style={{ position: "fixed", top: "20%", left: "30%", width: "600px", height: "600px",
        borderRadius: "50%", background: "radial-gradient(circle, rgba(160,122,255,0.04) 0%, transparent 70%)",
        pointerEvents: "none" }} />

      <div style={{ width: "520px", maxHeight: "90vh", overflowY: "auto", padding: "2px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "32px" }}>
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="20" cy="20" r="18.5" stroke="rgba(200,180,255,0.45)" strokeWidth="1"/>
            <polygon points="20,6.5 31,25.5 9,25.5" fill="none" stroke="rgba(160,122,255,0.9)" strokeWidth="1.2"/>
            <polygon points="20,33.5 9,14.5 31,14.5" fill="none" stroke="rgba(160,122,255,0.55)" strokeWidth="0.9"/>
            <circle cx="20" cy="20" r="3" fill="rgba(240,192,64,1)"/>
          </svg>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", fontSize: "18px", color: C.text, letterSpacing: "0.12em" }}>
              SETUP WIZARD
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px", color: C.muted, letterSpacing: "0.08em" }}>
              THE COLLECTIVE · PHASE 2
            </div>
          </div>
        </div>

        <Progress step={step} total={TOTAL} />

        {/* Step content */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "14px", padding: "28px" }}>
          {step === 0 && <StepWelcome onNext={next} />}
          {step === 1 && <StepAccount onNext={next} login={login} />}
          {step === 2 && <StepHardware tier={tier} setTier={setTier} onNext={next} onBack={back} />}
          {step === 3 && <StepProviders tier={tier} groqKey={groqKey} setGroqKey={setGroqKey}
            ollamaUrl={ollamaUrl} setOllamaUrl={setOllamaUrl} lmsUrl={lmsUrl} setLmsUrl={setLmsUrl}
            onNext={next} onBack={back} />}
          {step === 4 && <StepNetwork domain={domain} setDomain={setDomain} tunnelEnabled={tunnelEnabled}
            setTunnelEnabled={setTunnelEn} tunnelToken={tunnelToken} setTunnelToken={setTunnelTok}
            onNext={next} onBack={back} />}
          {step === 5 && <StepDashboard widgets={widgets} setWidgets={setWidgets} onNext={next} onBack={back} />}
          {step === 6 && <StepComplete config={config} onFinish={finish} finishing={finishing} />}
        </div>
      </div>

      <style>{`
        @keyframes stepIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(160,122,255,0.2); border-radius: 2px; }
      `}</style>
    </div>
  );
}
