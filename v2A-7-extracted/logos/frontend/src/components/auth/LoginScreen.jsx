// LoginScreen.jsx - Login & first-time registration
import React, { useState, useEffect } from "react";
import { useAuth, API } from "./AuthContext.jsx";
import LogosSigil from "../LogosSigil.jsx";
import { useLayout } from "../../useLayout.js";

const C = {
  bg:      "#0d0d1a",
  surface: "#07070e",
  border:  "rgba(160,122,255,0.2)",
  purple:  "#a07aff",
  gold:    "#f0c040",
  text:    "#f0ecff",
  muted:   "#8878c8",
  error:   "#ff6060",
  input:   "rgba(160,122,255,0.08)",
};

function Field({ label, type = "text", value, onChange, placeholder, error }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace", fontSize: "10px",
        letterSpacing: "0.12em", color: C.muted, marginBottom: "6px", textTransform: "uppercase" }}>
        {label}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: "100%", padding: "10px 14px", background: C.input, border: `1px solid ${focused ? C.purple : C.border}`,
          borderRadius: "8px", color: C.text, fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "14px",
          outline: "none", transition: "border-color 0.15s", boxSizing: "border-box" }}
      />
      {error && <div style={{ color: C.error, fontSize: "11px", marginTop: "5px", fontFamily: "'IBM Plex Mono',monospace" }}>{error}</div>}
    </div>
  );
}

function Btn({ children, onClick, loading, variant = "primary", disabled }) {
  const styles = {
    primary:  { bg: "rgba(160,122,255,0.2)", border: "rgba(160,122,255,0.5)", color: "#c4a0ff" },
    gold:     { bg: "rgba(240,192,64,0.15)", border: "rgba(240,192,64,0.4)", color: C.gold },
    ghost:    { bg: "transparent", border: "rgba(160,122,255,0.2)", color: C.muted },
  };
  const s = styles[variant];
  return (
    <button onClick={onClick} disabled={loading || disabled}
      style={{ width: "100%", padding: "11px", background: s.bg, border: `1px solid ${s.border}`,
        borderRadius: "8px", color: s.color, fontFamily: "'Cinzel',serif", fontSize: "13px",
        letterSpacing: "0.08em", cursor: loading || disabled ? "not-allowed" : "pointer",
        opacity: loading || disabled ? 0.6 : 1, transition: "all 0.15s", marginBottom: "10px" }}>
      {loading ? "..." : children}
    </button>
  );
}

export default function LoginScreen({ onSetupNeeded }) {
  const { login } = useAuth();
  const [mode, setMode]       = useState("login"); // "login" | "register"
  const [username, setUser]   = useState("");
  const [display, setDisplay] = useState("");
  const [password, setPass]   = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr]         = useState({});
  const [loading, setLoading] = useState(false);
  const [globalErr, setGlobal] = useState("");

  function validate() {
    const e = {};
    if (!username.trim()) e.username = "Required";
    if (!password)        e.password = "Required";
    if (mode === "register") {
      if (password.length < 6)    e.password = "Min 6 characters";
      if (password !== confirm)   e.confirm  = "Passwords don't match";
      if (!display.trim())        setDisplay(username);
    }
    setErr(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    setLoading(true); setGlobal("");
    try {
      const endpoint = mode === "login" ? "/users/login" : "/users/register";
      const body     = mode === "login"
        ? { username: username.trim().toLowerCase(), password }
        : { username: username.trim().toLowerCase(), password, display_name: display.trim() || username.trim() };

      const r = await fetch(`${API}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) { setGlobal(data.detail || "Something went wrong"); return; }
      login(data.token, { username: data.username, display_name: data.display_name, role: data.role });
    } catch (e) {
      setGlobal("Cannot reach Logos backend. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  const { isMobile, isTablet } = useLayout();
  const isNarrow = isMobile || isTablet;

  return (
    <div style={{ width: "100vw", height: "100dvh", background: C.bg, display: "flex",
      alignItems: isNarrow ? "flex-start" : "center", justifyContent: "center",
      fontFamily: "'IBM Plex Sans',sans-serif", overflowY: "auto",
      paddingTop: isNarrow ? "env(safe-area-inset-top)" : 0 }}>

      {/* Ambient glow */}
      <div style={{ position: "fixed", top: "30%", left: "50%", transform: "translate(-50%,-50%)",
        width: "500px", height: "500px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(160,122,255,0.06) 0%, transparent 70%)",
        pointerEvents: "none" }} />

      <div style={{ width: isNarrow ? "100%" : "360px", maxWidth: "420px",
        padding: isNarrow ? "32px 20px 40px" : "0",
        animation: "fadeIn 0.4s ease" }}>
        {/* Sigil */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "32px" }}>
          <div style={{ marginBottom: "16px" }}>
            <svg width="56" height="56" viewBox="0 0 40 40" fill="none" style={{ animation: "breathe 3.5s ease-in-out infinite" }}>
              <circle cx="20" cy="20" r="18.5" stroke="rgba(200,180,255,0.45)" strokeWidth="1"/>
              <circle cx="20" cy="20" r="14" stroke="rgba(160,122,255,0.25)" strokeWidth="0.6" strokeDasharray="2 4"/>
              <polygon points="20,6.5 31,25.5 9,25.5" fill="none" stroke="rgba(160,122,255,0.9)" strokeWidth="1.2"/>
              <polygon points="20,33.5 9,14.5 31,14.5" fill="none" stroke="rgba(160,122,255,0.55)" strokeWidth="0.9"/>
              <circle cx="20" cy="20" r="3" fill="rgba(240,192,64,1)"/>
            </svg>
          </div>
          <div style={{ fontFamily: "'Cinzel',serif", fontSize: "22px", letterSpacing: "0.15em", color: C.text }}>
            THE COLLECTIVE
          </div>
          <div style={{ fontSize: "11px", color: C.muted, letterSpacing: "0.1em", marginTop: "4px",
            fontFamily: "'IBM Plex Mono',monospace" }}>
            {mode === "login" ? "ENTER YOUR CREDENTIALS" : "CREATE YOUR PROFILE"}
          </div>
        </div>

        {/* Card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: isNarrow ? "12px" : "14px", padding: isNarrow ? "20px" : "28px" }}>

          {globalErr && (
            <div style={{ background: "rgba(255,96,96,0.1)", border: "1px solid rgba(255,96,96,0.3)",
              borderRadius: "8px", padding: "10px 14px", marginBottom: "18px", color: C.error,
              fontFamily: "'IBM Plex Mono',monospace", fontSize: "12px" }}>
              {globalErr}
            </div>
          )}

          <Field label="Username" value={username} onChange={setUser}
            placeholder="your_username" error={err.username} />

          {mode === "register" && (
            <Field label="Display Name" value={display} onChange={setDisplay}
              placeholder="How you'll appear to others" />
          )}

          <Field label="Password" type="password" value={password} onChange={setPass}
            placeholder="••••••••" error={err.password} />

          {mode === "register" && (
            <Field label="Confirm Password" type="password" value={confirm} onChange={setConfirm}
              placeholder="••••••••" error={err.confirm} />
          )}

          <div style={{ marginTop: "22px" }}>
            <Btn onClick={submit} loading={loading} variant="primary">
              {mode === "login" ? "Enter The Collective" : "Create Profile"}
            </Btn>
            <Btn onClick={() => { setMode(m => m === "login" ? "register" : "login"); setErr({}); setGlobal(""); }}
              variant="ghost">
              {mode === "login" ? "Create New Profile" : "Back to Login"}
            </Btn>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "18px", fontSize: "10px", color: "rgba(136,120,200,0.4)",
          fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.08em" }}>
          THE COLLECTIVE · INVITE ONLY
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes breathe { 0%,100% { opacity:.8; transform:scale(1); } 50% { opacity:1; transform:scale(1.04); } }
      `}</style>
    </div>
  );
}
