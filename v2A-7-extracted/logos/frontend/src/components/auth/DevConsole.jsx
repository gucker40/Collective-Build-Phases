// DevConsole.jsx - Phase 2A.1 - Admin diagnostic panel with tunnel log display
import React, { useState, useEffect, useRef } from "react";
import { useAuth, API } from "./AuthContext.jsx";

const C = {
  bg:"#0d0d1a", surface:"#07070e", card:"#0a0a16",
  border:"rgba(160,122,255,0.2)", purple:"#a07aff", gold:"#f0c040",
  text:"#f0ecff", muted:"#8878c8", error:"#ff6060", success:"#50d890", warn:"#f0a040",
  input:"rgba(160,122,255,0.08)",
};

function Panel({ title, children, accent = C.purple }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:"12px", marginBottom:"16px", overflow:"hidden" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, background:"rgba(160,122,255,0.05)", display:"flex", alignItems:"center", gap:"10px" }}>
        <div style={{ width:"3px", height:"14px", borderRadius:"2px", background:accent }} />
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:"12px", color:C.text, letterSpacing:"0.1em", textTransform:"uppercase" }}>{title}</span>
      </div>
      <div style={{ padding:"16px" }}>{children}</div>
    </div>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:`1px solid rgba(160,122,255,0.07)` }}>
      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", color:C.muted, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</span>
      <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"12px", color:color||C.text, maxWidth:"60%", textAlign:"right", wordBreak:"break-all" }}>{value}</span>
    </div>
  );
}

function UserCard({ u, onReset, onDelete, isMe }) {
  const [showReset, setShowR] = useState(false);
  const [newPass,   setPass]  = useState("");
  const [delConf,   setDel]   = useState(false);
  const [busy,      setBusy]  = useState(false);

  async function doReset() {
    if (newPass.length < 6) return;
    setBusy(true); await onReset(u.username, newPass); setBusy(false); setShowR(false); setPass("");
  }

  return (
    <div style={{ padding:"14px", background:C.card, border:`1px solid ${C.border}`, borderRadius:"10px", marginBottom:"10px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:"14px", color:C.text, letterSpacing:"0.06em" }}>
            {u.display_name} {isMe && <span style={{ fontSize:"9px", color:C.gold, fontFamily:"'IBM Plex Mono',monospace" }}>YOU</span>}
          </div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", color:C.muted }}>@{u.username}</div>
        </div>
        <span style={{ padding:"2px 8px", borderRadius:"4px", fontSize:"10px", fontFamily:"'IBM Plex Mono',monospace",
          background:`${u.role==="admin"?C.gold:C.purple}20`, border:`1px solid ${u.role==="admin"?C.gold:C.purple}40`,
          color:u.role==="admin"?C.gold:C.purple, alignSelf:"flex-start" }}>
          {u.role.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize:"11px", color:C.muted, fontFamily:"'IBM Plex Mono',monospace", marginBottom:"10px" }}>
        Joined {u.created ? new Date(u.created*1000).toLocaleDateString() : "—"} · Last seen {u.last_login ? new Date(u.last_login*1000).toLocaleDateString() : "—"}
      </div>
      {!isMe && (
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          <button onClick={() => setShowR(!showReset)} style={{ padding:"5px 12px", background:"rgba(160,122,255,0.1)", border:`1px solid ${C.border}`, borderRadius:"6px", color:C.muted, fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", cursor:"pointer" }}>Reset Password</button>
          {u.role !== "admin" && (
            <button onClick={() => setDel(!delConf)} style={{ padding:"5px 12px", background:"rgba(255,96,96,0.08)", border:"1px solid rgba(255,96,96,0.2)", borderRadius:"6px", color:C.error, fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", cursor:"pointer" }}>
              {delConf ? "Confirm?" : "Delete"}
            </button>
          )}
          {delConf && <button onClick={() => onDelete(u.username)} style={{ padding:"5px 12px", background:"rgba(255,96,96,0.2)", border:"1px solid rgba(255,96,96,0.5)", borderRadius:"6px", color:C.error, fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", cursor:"pointer" }}>YES DELETE</button>}
        </div>
      )}
      {showReset && (
        <div style={{ marginTop:"10px", display:"flex", gap:"8px" }}>
          <input type="password" value={newPass} onChange={e => setPass(e.target.value)} placeholder="New password (min 6)" style={{ flex:1, padding:"7px 12px", background:C.input, border:`1px solid ${C.border}`, borderRadius:"6px", color:C.text, fontFamily:"'IBM Plex Sans',sans-serif", fontSize:"13px", outline:"none" }} />
          <button onClick={doReset} disabled={busy} style={{ padding:"7px 14px", background:"rgba(80,216,144,0.1)", border:"1px solid rgba(80,216,144,0.3)", borderRadius:"6px", color:C.success, fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", cursor:"pointer" }}>
            {busy?"...":"Set"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function DevConsole({ onClose }) {
  const { user } = useAuth();
  const [diag,   setDiag]  = useState(null);
  const [users,  setUsers] = useState([]);
  const [netSt,  setNet]   = useState(null);
  const [tunLog, setTunLog]= useState("");
  const [tab,    setTab]   = useState("users");
  const [loading,setLoad]  = useState(true);
  const [toast,  setToast] = useState("");
  const [tunnelBusy, setTBusy] = useState(false);
  const [tunErr,  setTunErr]   = useState("");
  const logRef = useRef(null);

  const hdr = { Authorization:`Bearer ${user?.token}` };
  const notify = msg => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  async function loadAll() {
    setLoad(true);
    try {
      const [dR, uR, nR] = await Promise.all([
        fetch(`${API}/users/admin/diagnostics`, { headers: hdr }),
        fetch(`${API}/users/admin/users`,        { headers: hdr }),
        fetch(`${API}/network/status`),
      ]);
      if (dR.ok) setDiag(await dR.json());
      if (uR.ok) { const d = await uR.json(); setUsers(d.users||[]); }
      if (nR.ok) setNet(await nR.json());
    } catch {}
    setLoad(false);
  }

  async function loadTunnelLog() {
    try {
      const r = await fetch(`${API}/network/tunnel/log`);
      if (r.ok) { const d = await r.json(); setTunLog(d.log||""); }
    } catch {}
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (tab === "network") loadTunnelLog(); }, [tab]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [tunLog]);

  async function resetPassword(username, password) {
    const r = await fetch(`${API}/users/admin/user/${username}/reset-password`, { method:"POST", headers:{...hdr,"Content-Type":"application/json"}, body:JSON.stringify({password}) });
    notify(r.ok ? `Password reset for ${username}` : "Failed");
  }

  async function deleteUser(username) {
    const r = await fetch(`${API}/users/admin/user/${username}`, { method:"DELETE", headers:hdr });
    if (r.ok) { notify(`Deleted ${username}`); loadAll(); } else notify("Failed");
  }

  async function toggleTunnel() {
    setTBusy(true); setTunErr("");
    const running = netSt?.tunnel_running;
    try {
      const r = await fetch(`${API}/network/tunnel/${running?"stop":"start"}`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:"{}"
      });
      const d = await r.json();
      if (!d.ok && d.error) setTunErr(d.error);
      if (d.log_tail) setTunLog(d.log_tail);
    } catch(e) { setTunErr(String(e)); }
    // Refresh status after a moment
    setTimeout(async () => {
      const r = await fetch(`${API}/network/status`);
      if (r.ok) setNet(await r.json());
      await loadTunnelLog();
      setTBusy(false);
    }, 1500);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"16px 20px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:"16px", color:C.gold, letterSpacing:"0.12em" }}>DEV CONSOLE</div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color:C.muted, marginTop:"2px" }}>ADMIN · {user?.display_name?.toUpperCase()}</div>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <button onClick={loadAll} style={{ padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:"6px", color:C.muted, fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", cursor:"pointer" }}>↻ REFRESH</button>
          {onClose && <button onClick={onClose} style={{ padding:"6px 12px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:"6px", color:C.muted, fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", cursor:"pointer" }}>✕</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", padding:"12px 20px 0", gap:"4px", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        {["users","system","network"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"8px 16px", background:tab===t?"rgba(160,122,255,0.15)":"transparent", border:"none", borderBottom:`2px solid ${tab===t?C.purple:"transparent"}`, borderRadius:"6px 6px 0 0", color:tab===t?"#c4a0ff":C.muted, fontFamily:"'Cinzel',serif", fontSize:"11px", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>
            {t}
          </button>
        ))}
      </div>

      {toast && (
        <div style={{ position:"fixed", top:"60px", left:"50%", transform:"translateX(-50%)", zIndex:999, padding:"8px 18px", background:"rgba(80,216,144,0.15)", border:"1px solid rgba(80,216,144,0.4)", borderRadius:"8px", color:C.success, fontFamily:"'IBM Plex Mono',monospace", fontSize:"12px" }}>{toast}</div>
      )}

      <div style={{ flex:1, overflow:"auto", padding:"16px 20px" }}>
        {loading ? (
          <div style={{ color:C.muted, fontFamily:"'IBM Plex Mono',monospace", fontSize:"12px", textAlign:"center", paddingTop:"40px" }}>Loading...</div>
        ) : (
          <>
            {/* USERS */}
            {tab === "users" && (
              <div>
                <Panel title={`Users (${users.length})`} accent={C.purple}>
                  {users.map(u => <UserCard key={u.username} u={u} isMe={u.username===user?.username} onReset={resetPassword} onDelete={deleteUser} />)}
                  {!users.length && <div style={{ color:C.muted, fontFamily:"'IBM Plex Mono',monospace", fontSize:"12px", textAlign:"center", padding:"20px 0" }}>No users</div>}
                </Panel>
                {diag?.disk_usage && (
                  <Panel title="Data Usage" accent={C.muted}>
                    {diag.disk_usage.map(d => <Row key={d.username} label={d.username} value={`${(d.data_size_bytes/1024).toFixed(1)} KB`} />)}
                  </Panel>
                )}
              </div>
            )}

            {/* SYSTEM */}
            {tab === "system" && diag && (
              <Panel title="System" accent={C.gold}>
                <Row label="Platform" value={diag.platform} />
                <Row label="Python"   value={diag.python} />
                <Row label="App Data" value={diag.appdata} color={C.muted} />
                <Row label="Users"    value={String(diag.user_count)} color={C.purple} />
              </Panel>
            )}

            {/* NETWORK */}
            {tab === "network" && netSt && (
              <div>
                <Panel title="LAN Access" accent={C.gold}>
                  <Row label="LAN IP"  value={netSt.lan_ip}  color={C.purple} />
                  <Row label="LAN URL" value={netSt.lan_url} color={C.muted} />
                  <div style={{ marginTop:"10px", fontSize:"11px", color:C.muted, fontFamily:"'IBM Plex Mono',monospace", lineHeight:"1.6" }}>
                    Open this URL on any device on the same WiFi to access Logos.
                  </div>
                </Panel>

                <Panel title="Cloudflare Tunnel" accent={netSt.tunnel_running ? C.success : C.muted}>
                  <Row label="cloudflared" value={netSt.cloudflared_installed ? "Installed ✓" : "Not found ✗"} color={netSt.cloudflared_installed?C.success:C.error} />
                  {netSt.cloudflared_path && <Row label="Path" value={netSt.cloudflared_path} color={C.muted} />}
                  <Row label="Token"  value={netSt.tunnel_token_set ? "Configured ✓" : "Not set"} color={netSt.tunnel_token_set?C.success:C.warn} />
                  <Row label="Status" value={netSt.tunnel_running ? "Running ↑" : "Stopped"} color={netSt.tunnel_running?C.success:C.muted} />
                  {netSt.custom_domain && <Row label="Domain" value={netSt.custom_domain} color={C.purple} />}

                  {/* Error display */}
                  {tunErr && (
                    <div style={{ marginTop:"12px", padding:"12px", background:"rgba(255,96,96,0.08)", border:"1px solid rgba(255,96,96,0.25)", borderRadius:"8px" }}>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color:C.error, marginBottom:"6px", letterSpacing:"0.08em" }}>TUNNEL ERROR</div>
                      <pre style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", color:"#ffaaaa", whiteSpace:"pre-wrap", margin:0, lineHeight:"1.5" }}>{tunErr}</pre>
                    </div>
                  )}

                  {/* If not installed, show instructions */}
                  {!netSt.cloudflared_installed && (
                    <div style={{ marginTop:"12px", padding:"12px", background:"rgba(240,192,64,0.06)", border:"1px solid rgba(240,192,64,0.2)", borderRadius:"8px" }}>
                      <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color:C.gold, marginBottom:"8px", letterSpacing:"0.08em" }}>HOW TO INSTALL CLOUDFLARED</div>
                      <div style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:"12px", color:C.muted, lineHeight:"1.7" }}>
                        1. Download the MSI from <span style={{ color:C.purple }}>developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads</span><br/>
                        2. Run the installer — OR — rename the .exe to <code style={{ color:C.text }}>cloudflared.exe</code> and place it in:<br/>
                        <code style={{ color:C.purple, fontSize:"11px" }}>{decodeURIComponent(API)}</code>
                        <br/>
                        3. Click Refresh to check detection
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop:"14px", display:"flex", gap:"10px" }}>
                    <button onClick={toggleTunnel} disabled={tunnelBusy || (!netSt.cloudflared_installed)}
                      style={{ padding:"8px 16px", background:netSt.tunnel_running?"rgba(255,96,96,0.1)":"rgba(80,216,144,0.1)", border:`1px solid ${netSt.tunnel_running?"rgba(255,96,96,0.3)":"rgba(80,216,144,0.3)"}`, borderRadius:"8px", color:netSt.tunnel_running?C.error:C.success, fontFamily:"'Cinzel',serif", fontSize:"11px", letterSpacing:"0.08em", cursor:(tunnelBusy||!netSt.cloudflared_installed)?"not-allowed":"pointer", opacity:(tunnelBusy||!netSt.cloudflared_installed)?0.5:1 }}>
                      {tunnelBusy ? "..." : netSt.tunnel_running ? "Stop Tunnel" : "Start Tunnel"}
                    </button>
                    <button onClick={() => { loadAll(); loadTunnelLog(); }} style={{ padding:"8px 14px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:"8px", color:C.muted, fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", cursor:"pointer" }}>↻ Refresh</button>
                  </div>
                </Panel>

                {/* Tunnel log */}
                <Panel title="Tunnel Log" accent={C.muted}>
                  <div ref={logRef} style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", color:"#6060a0", background:"rgba(0,0,0,0.4)", borderRadius:"6px", padding:"10px", maxHeight:"200px", overflowY:"auto", whiteSpace:"pre-wrap", lineHeight:"1.5" }}>
                    {tunLog || "No log yet — start the tunnel to see output here."}
                  </div>
                  <button onClick={loadTunnelLog} style={{ marginTop:"8px", padding:"5px 12px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:"6px", color:C.muted, fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", cursor:"pointer" }}>↻ Reload Log</button>
                </Panel>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
