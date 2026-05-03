import React, { useState, useCallback, useEffect } from "react";
import { AuthProvider, useAuth } from "./components/auth/AuthContext.jsx";
import LoginScreen   from "./components/auth/LoginScreen.jsx";
import SetupWizard   from "./components/auth/SetupWizard.jsx";
import DevConsole    from "./components/auth/DevConsole.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import Sidebar       from "./components/Sidebar.jsx";
import ChatPanel     from "./components/ChatPanel.jsx";
import ArtifactPanel from "./components/ArtifactPanel.jsx";
import MemoryVault   from "./components/MemoryVault.jsx";
import VaultEditor   from "./components/VaultEditor.jsx";
import SettingsPanel from "./components/SettingsPanel.jsx";
import TitleBar      from "./components/TitleBar.jsx";
import HistorySidebar from "./components/HistorySidebar.jsx";
import ArtifactHistory from "./components/ArtifactHistory.jsx";
import Library       from "./components/Library.jsx";
import Browser       from "./components/Browser.jsx";
import { API }       from "./api.js";
import { useLayout } from "./useLayout.js";

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const [userCount, setUserCount] = useState(null);
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => {
    fetch(`${API}/users/count`)
      .then(r => r.json())
      .then(d => setUserCount(d.count))
      .catch(() => setUserCount(0));
    setSetupDone(!!localStorage.getItem("logos_setup_done"));
  }, []);

  if (loading || userCount === null) {
    return (
      <div style={{ width:"100vw", height:"100vh", background:"#0d0d1a",
        display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:"32px", height:"32px", borderRadius:"50%",
          border:"2px solid rgba(160,122,255,0.3)", borderTopColor:"#a07aff",
          animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isElectron = typeof window !== "undefined" && window.electronAPI;
  if (userCount === 0 && isElectron) {
    return <SetupWizard onComplete={() => { setUserCount(1); setSetupDone(true); }} />;
  }
  if (!user) return <LoginScreen />;
  return children;
}

// ── Mobile bottom tab bar ─────────────────────────────────────────────────────
const MOBILE_TABS = [
  { id:"chat",      label:"Chat",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2.5 4a1 1 0 011-1h13a1 1 0 011 1v9a1 1 0 01-1 1H11.5L8 17v-3H3.5a1 1 0 01-1-1V4z" stroke="currentColor" strokeWidth="1.4" fill="none"/></svg> },
  { id:"artifacts", label:"Projects",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/><rect x="10.5" y="3" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/><rect x="3" y="10.5" width="6.5" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1.4"/><path d="M13.75 10.5v6.5M10.5 13.75h6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
  { id:"vault",     label:"Vault",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2.5" y="2.5" width="15" height="15" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M6 7h8M6 10h8M6 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
  { id:"settings",  label:"Settings",
    icon:<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.8" stroke="currentColor" strokeWidth="1.4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
];

function MobileTabBar({ activeView, onNavigate }) {
  return (
    <div style={{
      position:"fixed", bottom:0, left:0, right:0, zIndex:200,
      minHeight:"60px", height:"calc(60px + env(safe-area-inset-bottom))",
      background:"rgba(5,5,10,0.97)",
      borderTop:"1px solid rgba(160,122,255,0.2)",
      display:"flex", alignItems:"flex-start", paddingTop:"4px",
      backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
      paddingBottom:"env(safe-area-inset-bottom)",
    }}>
      {MOBILE_TABS.map(({ id, label, icon }) => {
        const active = activeView === id || (activeView === "history" && id === "chat");
        return (
          <button key={id} onClick={() => onNavigate(id)}
            style={{
              flex:1, display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", gap:"3px", background:"transparent", border:"none",
              color: active ? "#a07aff" : "#443860", cursor:"pointer",
              transition:"color 0.15s", padding:"6px 0",
            }}>
            <div style={{ opacity: active ? 1 : 0.6, transform: active ? "scale(1.1)" : "scale(1)", transition:"all 0.15s" }}>
              {icon}
            </div>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"9px",
              letterSpacing:"0.08em", textTransform:"uppercase",
              color: active ? "#a07aff" : "#443860" }}>
              {label}
            </span>
            {active && (
              <div style={{ position:"absolute", bottom:0, width:"32px", height:"2px",
                background:"#a07aff", borderRadius:"1px 1px 0 0" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Mobile header bar ─────────────────────────────────────────────────────────
function MobileHeader({ activeView, user, onNewChat, onShowHistory, showHistory, onLogout }) {
  const [showMenu, setShowMenu] = useState(false);
  const initials = (user?.display_name || user?.username || "?")
    .split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  const viewLabels = { chat:"Chat", artifacts:"Projects", vault:"Vault", settings:"Settings", memory:"Memory" };

  return (
    <div style={{
      height:"52px", background:"rgba(5,5,10,0.97)", flexShrink:0,
      borderBottom:"1px solid rgba(160,122,255,0.15)",
      display:"flex", alignItems:"center", paddingLeft:"12px", paddingRight:"12px",
      gap:"10px", backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
      paddingTop:"env(safe-area-inset-top)",
      position:"relative", zIndex:100,
    }}>
      {/* Sigil + app name */}
      <div onClick={onNewChat} style={{ display:"flex", alignItems:"center", gap:"8px", cursor:"pointer", flexShrink:0 }}>
        <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18.5" stroke="rgba(200,180,255,0.45)" strokeWidth="1"/>
          <polygon points="20,6.5 31,25.5 9,25.5" fill="none" stroke="rgba(160,122,255,0.9)" strokeWidth="1.2"/>
          <polygon points="20,33.5 9,14.5 31,14.5" fill="none" stroke="rgba(160,122,255,0.55)" strokeWidth="0.9"/>
          <circle cx="20" cy="20" r="3" fill="rgba(240,192,64,1)"/>
        </svg>
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:"13px", color:"#f0ecff", letterSpacing:"0.12em" }}>
          THE COLLECTIVE
        </span>
      </div>

      <div style={{ flex:1 }} />

      {/* History toggle (chat only) */}
      {activeView === "chat" && (
        <button onClick={onShowHistory}
          style={{ width:"36px", height:"36px", borderRadius:"8px", border:"1px solid rgba(160,122,255,0.2)",
            background: showHistory ? "rgba(160,122,255,0.2)" : "transparent",
            color: showHistory ? "#c4a0ff" : "#7868a0", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M4 5h12M4 10h12M4 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* User avatar */}
      <div style={{ position:"relative" }}>
        <div onClick={() => setShowMenu(!showMenu)}
          style={{ width:"32px", height:"32px", borderRadius:"50%", display:"flex",
            alignItems:"center", justifyContent:"center", cursor:"pointer",
            background:"rgba(160,122,255,0.2)", border:"1px solid rgba(160,122,255,0.35)",
            fontFamily:"'Cinzel',serif", fontSize:"10px", color:"#c4a0ff",
            letterSpacing:"0.05em", userSelect:"none" }}>
          {initials}
        </div>
        {showMenu && (
          <div style={{ position:"fixed", top:"56px", right:"12px", zIndex:300,
            background:"#07070e", border:"1px solid rgba(160,122,255,0.3)", borderRadius:"10px",
            padding:"12px", minWidth:"160px", boxShadow:"0 8px 32px rgba(0,0,0,0.8)" }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:"12px", color:"#f0ecff", letterSpacing:"0.06em", marginBottom:"2px" }}>
              {user?.display_name}
            </div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color:"#8878c8", marginBottom:"12px" }}>
              @{user?.username}
              {user?.role === "admin" && <span style={{ marginLeft:"6px", color:"#f0c040", fontSize:"9px" }}>ADMIN</span>}
            </div>
            <button onClick={() => { setShowMenu(false); onLogout(); }}
              style={{ width:"100%", padding:"7px 10px", display:"flex", alignItems:"center", gap:"8px",
                background:"rgba(255,96,96,0.08)", border:"1px solid rgba(255,96,96,0.2)", borderRadius:"6px",
                color:"#ff9090", fontFamily:"'IBM Plex Mono',monospace", fontSize:"11px", cursor:"pointer" }}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
function MainApp() {
  const { user, logout, isAdmin } = useAuth();
  const { isMobile, isTablet, isDesktop, isElectron } = useLayout();
  const isNarrow = isMobile || isTablet;

  const [ready, setReady]                   = useState(false);
  const [fadeIn, setFadeIn]                 = useState(false);
  const [activeView, setActiveView]         = useState("chat");
  const [artifact, setArtifact]             = useState(null);
  const [artifactOpen, setArtifactOpen]     = useState(false);
  const [notification, setNotification]     = useState(null);
  const [activeSession, setActiveSession]   = useState(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [chatKey, setChatKey]               = useState(0);
  const [devOpen, setDevOpen]               = useState(false);
  const [showMobileHistory, setMobileHistory] = useState(false);

  function handleReady() { setReady(true); setTimeout(() => setFadeIn(true), 50); }

  const openArtifact = useCallback((data) => {
    setArtifact(prev => {
      if (prev && prev.title === data.title) return { ...prev, content: data.content };
      return data;
    });
    setArtifactOpen(true);
  }, []);
  const closeArtifact  = useCallback(() => { setArtifactOpen(false); setTimeout(() => setArtifact(null), 350); }, []);
  const notify         = useCallback((text, type="success") => { setNotification({ text, type }); setTimeout(() => setNotification(null), 2800); }, []);
  const onSessionSaved = useCallback(() => setHistoryRefresh(n => n+1), []);
  const handleLoadSession = useCallback((s) => { setActiveSession(s); setActiveView("chat"); setMobileHistory(false); }, []);
  const handleNewChat     = useCallback(() => { setActiveSession(null); setActiveView("chat"); setChatKey(k => k+1); setMobileHistory(false); }, []);

  const navigate = useCallback((v) => {
    if (v === "devconsole") { setDevOpen(true); return; }
    if (isElectron) {
      if (v === "browser") {
        setTimeout(() => {
          const el = document.getElementById("browser-view-placeholder");
          if (el) { const r = el.getBoundingClientRect(); window.electronAPI.browserShow({ x:Math.round(r.left), y:Math.round(r.top), width:Math.round(r.width), height:Math.round(r.height) }); }
        }, 60);
      } else if (activeView === "browser") {
        window.electronAPI.browserHide();
      }
    }
    setActiveView(v);
  }, [isElectron, activeView]);

  const nc = ({ success:["rgba(80,216,144,0.15)","rgba(80,216,144,0.4)","#50d890"], error:["rgba(255,96,96,0.15)","rgba(255,96,96,0.4)","#ff9090"], info:["rgba(240,192,64,0.15)","rgba(240,192,64,0.4)","#f0c040"] })[notification?.type || "info"];

  if (!ready) return <LoadingScreen onReady={handleReady} />;

  // Dev console overlay (all layouts)
  if (devOpen && isAdmin()) {
    return (
      <div style={{ width:"100vw", height:"100vh", background:"#0d0d1a", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(160,122,255,0.15)",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:"rgba(5,5,10,0.95)" }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:"12px", color:"#f0c040", letterSpacing:"0.12em" }}>◈ DEV CONSOLE</div>
          <button onClick={() => setDevOpen(false)}
            style={{ padding:"5px 12px", background:"transparent", border:"1px solid rgba(160,122,255,0.2)",
              borderRadius:"6px", color:"#8878c8", fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", cursor:"pointer" }}>
            ← Back to App
          </button>
        </div>
        <div style={{ flex:1, overflow:"hidden" }}><DevConsole onClose={() => setDevOpen(false)} /></div>
      </div>
    );
  }

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isNarrow) {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100dvh", width:"100vw",
        overflow:"hidden", background:"#0d0d1a", opacity:fadeIn?1:0, transition:"opacity 0.5s ease",
        position:"fixed", top:0, left:0 }}>

        <style>{`
          * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
          body { overscroll-behavior: none; }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes breathe { 0%,100%{opacity:0.8} 50%{opacity:1} }
          @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        `}</style>

        {/* Mobile header */}
        <MobileHeader
          activeView={activeView}
          user={user}
          onNewChat={handleNewChat}
          onShowHistory={() => setMobileHistory(v => !v)}
          showHistory={showMobileHistory}
          onLogout={logout}
        />

        {/* Notification */}
        {notification && (
          <div style={{ position:"fixed", top:"60px", left:"12px", right:"12px", zIndex:500,
            padding:"10px 16px", borderRadius:"8px", background:nc[0],
            border:`1px solid ${nc[1]}`, color:nc[2],
            fontFamily:"'IBM Plex Mono',monospace", fontSize:"12px",
            textAlign:"center", animation:"slideUp 0.2s ease" }}>
            {notification.text}
          </div>
        )}

        {/* Main content area */}
        <div style={{ flex:1, overflow:"hidden", position:"relative",
          paddingBottom:"calc(60px + env(safe-area-inset-bottom))" /* space for tab bar */ }}>

          {/* Mobile history drawer — slides over chat */}
          {showMobileHistory && activeView === "chat" && (
            <div style={{ position:"absolute", inset:0, zIndex:100, background:"#0d0d1a",
              animation:"slideUp 0.2s ease", overflow:"auto" }}>
              <HistorySidebar
                refresh={historyRefresh}
                onLoad={handleLoadSession}
                onNew={handleNewChat}
                activeSessionId={activeSession?.id}
                mobile={true}
              />
            </div>
          )}

          {/* Mobile artifact panel — full screen overlay */}
          {artifactOpen && artifact && (
            <div style={{ position:"absolute", inset:0, zIndex:200, background:"#0d0d1a",
              animation:"slideUp 0.2s ease", display:"flex", flexDirection:"column" }}>
              <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(160,122,255,0.15)",
                display:"flex", alignItems:"center", justifyContent:"space-between",
                background:"rgba(5,5,10,0.95)", flexShrink:0 }}>
                <span style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color:"#f0c040",
                  letterSpacing:"0.1em" }}>{artifact.title || "ARTIFACT"}</span>
                <button onClick={closeArtifact}
                  style={{ padding:"5px 12px", background:"transparent",
                    border:"1px solid rgba(160,122,255,0.2)", borderRadius:"6px",
                    color:"#8878c8", fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", cursor:"pointer" }}>
                  ✕ Close
                </button>
              </div>
              <div style={{ flex:1, overflow:"hidden" }}>
                <ArtifactPanel artifact={artifact} open={true} onClose={closeArtifact} onNotify={notify} mobile={true} />
              </div>
            </div>
          )}

          {/* Main views */}
          <div style={{ height:"100%", overflow:"hidden" }}>
            {activeView === "chat"      && <ChatPanel key={chatKey} onArtifact={openArtifact} onNotify={notify} loadedSession={activeSession} onSessionSaved={onSessionSaved} mobile={true} />}
            {activeView === "artifacts" && <ArtifactHistory onOpen={openArtifact} mobile={true} />}
            {activeView === "library"   && <Library mobile={true} />}
            {activeView === "vault"     && <VaultEditor onNotify={notify} mobile={true} />}
            {activeView === "memory"    && <MemoryVault onNotify={notify} mobile={true} />}
            {activeView === "settings"  && <SettingsPanel mobile={true} />}
          </div>
        </div>

        {/* Mobile tab bar */}
        <MobileTabBar activeView={activeView} onNavigate={navigate} />
      </div>
    );
  }

  // ── DESKTOP LAYOUT (unchanged) ─────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", width:"100vw",
      overflow:"hidden", background:"#0d0d1a", opacity:fadeIn?1:0, transition:"opacity 0.5s ease" }}>
      <TitleBar />

      {notification && (
        <div style={{ position:"absolute", top:"44px", left:"50%", transform:"translateX(-50%)",
          zIndex:50, padding:"8px 20px", borderRadius:"8px", background:nc[0],
          border:`1px solid ${nc[1]}`, color:nc[2], fontFamily:"'IBM Plex Mono',monospace",
          fontSize:"12px", whiteSpace:"nowrap" }}>
          {notification.text}
        </div>
      )}

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        <Sidebar activeView={activeView} onNavigate={navigate}
          onNewChat={handleNewChat} isAdmin={isAdmin()} user={user} onLogout={logout} />

        {activeView === "chat" && (
          <HistorySidebar refresh={historyRefresh} onLoad={handleLoadSession}
            onNew={handleNewChat} activeSessionId={activeSession?.id} />
        )}

        <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
          <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
            {activeView === "chat"      && <ChatPanel key={chatKey} onArtifact={openArtifact} onNotify={notify} loadedSession={activeSession} onSessionSaved={onSessionSaved} />}
            {activeView === "artifacts" && <ArtifactHistory onOpen={openArtifact} />}
            {activeView === "library"   && <Library />}
            {activeView === "browser"   && <Browser />}
            {activeView === "vault"     && <VaultEditor onNotify={notify} />}
            {activeView === "memory"    && <MemoryVault onNotify={notify} />}
            {activeView === "settings"  && <SettingsPanel />}
          </div>
          <ArtifactPanel artifact={artifact} open={artifactOpen} onClose={closeArtifact} onNotify={notify} />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <MainApp />
      </AuthGate>
    </AuthProvider>
  );
}
