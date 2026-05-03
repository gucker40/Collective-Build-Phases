/**
 * Browser.jsx - Phase 2A.1 - "Logos Browser"
 * 
 * Architecture:
 * - Electron main process manages WebContentsView (persists across sidebar nav)
 * - This React component is the chrome/UI only — sends IPC to main for navigation
 * - webview tag kept as fallback for web-mode (non-Electron)
 * - Full browser data import (bookmarks from Chrome/Brave/Edge/Firefox)
 */
import React, { useState, useEffect, useRef, useCallback } from "react";

const isElectron = typeof window !== "undefined" && window.electronAPI;
const HOME = "https://search.brave.com";

const C = {
  bg:     "#05050e",
  bar:    "rgba(4,4,12,0.97)",
  border: "rgba(160,122,255,0.13)",
  purple: "#a07aff",
  gold:   "#f0c040",
  text:   "#e8e0ff",
  muted:  "#6a5eaa",
  input:  "rgba(255,255,255,0.05)",
  active: "rgba(160,122,255,0.18)",
};

function normalizeUrl(input) {
  const t = input.trim();
  if (!t) return HOME;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^localhost|127\.0\.0\.1/.test(t)) return "http://" + t;
  if (t.includes(".") && !t.includes(" ")) return "https://" + t;
  return "https://www.google.com/search?q=" + encodeURIComponent(t);
}

// ── Bookmark import parser ──────────────────────────────────────────────────
function parseChromiumBookmarks(json) {
  const out = [];
  const EPOCH = 11644473600000000n;
  function toMs(s) { try { return s ? Number((BigInt(s) - EPOCH) / 1000n) : null; } catch { return null; } }
  function walk(node, folder = "") {
    if (!node) return;
    if (node.type === "url") {
      out.push({ name: node.name || node.url, url: node.url, folder, dateAdded: toMs(node.date_added) });
    } else if (node.type === "folder" && node.children) {
      const nextFolder = folder ? `${folder}/${node.name}` : node.name;
      node.children.forEach(c => walk(c, nextFolder));
    }
  }
  try {
    const roots = json.roots || {};
    ["bookmark_bar","other","synced"].forEach(k => roots[k] && walk(roots[k]));
  } catch {}
  return out;
}

function parseNetscapeBookmarks(html) {
  const out = [];
  const re = /<A HREF="([^"]+)"[^>]*>([^<]+)<\/A>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push({ name: m[2].trim(), url: m[1], folder: "", dateAdded: null });
  }
  return out;
}

// ── Nav button ──────────────────────────────────────────────────────────────
function NavBtn({ onClick, disabled, title, children, gold }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ width:30, height:30, borderRadius:7, background:"transparent",
        border:`1px solid ${gold ? "rgba(240,192,64,0.2)" : C.border}`,
        color: disabled ? "#252058" : gold ? C.gold : C.muted,
        cursor: disabled ? "default" : "pointer", fontSize:16,
        display:"flex", alignItems:"center", justifyContent:"center",
        transition:"all 0.12s", flexShrink:0 }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background=gold?"rgba(240,192,64,0.1)":C.active; e.currentTarget.style.color=gold?C.gold:C.purple; }}}
      onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color=disabled?"#252058":gold?C.gold:C.muted; }}>
      {children}
    </button>
  );
}

// ── Bookmark import modal ────────────────────────────────────────────────────
function ImportModal({ onImport, onClose }) {
  const [step, setStep]       = useState("choose"); // choose | processing | done
  const [imported, setImp]    = useState([]);
  const [source, setSource]   = useState("");
  const fileRef = useRef(null);

  const BROWSER_PATHS = [
    { id:"brave",      label:"Brave (Recommended)",  hint: "%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\User Data\\Default\\Bookmarks" },
    { id:"brave_beta", label:"Brave Beta",            hint: "%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser-Beta\\User Data\\Default\\Bookmarks" },
    { id:"chrome",     label:"Chrome",                hint: "%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Bookmarks" },
    { id:"edge",       label:"Edge",                  hint: "%LOCALAPPDATA%\\Microsoft\\Edge\\User Data\\Default\\Bookmarks" },
    { id:"firefox",    label:"Firefox",               hint: "%APPDATA%\\Mozilla\\Firefox\\Profiles\\<profile>\\bookmarks export.html" },
    { id:"file",       label:"From File (JSON or HTML)", hint: "Select your exported bookmarks file directly" },
  ];

  async function handleFile(file) {
    setStep("processing");
    try {
      const text = await file.text();
      let bmarks = [];
      if (file.name.endsWith(".json") || text.trimStart().startsWith("{")) {
        bmarks = parseChromiumBookmarks(JSON.parse(text));
      } else {
        bmarks = parseNetscapeBookmarks(text);
      }
      setImp(bmarks);
      setStep("done");
    } catch(e) {
      alert("Could not parse file: " + e.message);
      setStep("choose");
    }
  }

  function confirm() {
    onImport(imported);
    onClose();
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:999, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:520, background:C.bg, border:`1px solid ${C.border}`, borderRadius:"14px", padding:"24px", fontFamily:"'IBM Plex Sans',sans-serif" }}>
        <div style={{ fontFamily:"'Cinzel',serif", fontSize:"16px", color:C.text, letterSpacing:"0.1em", marginBottom:"6px" }}>Import Bookmarks</div>
        <div style={{ fontSize:"12px", color:C.muted, marginBottom:"20px" }}>
          Import from Chrome, Brave, Edge (JSON) or Firefox (HTML export). Cookies and passwords cannot be imported.
        </div>

        {step === "choose" && (
          <>
            {BROWSER_PATHS.map(b => (
              <div key={b.id} onClick={() => { setSource(b.id); if (b.id !== "file") {} }}
                style={{ padding:"12px 14px", background:source===b.id?C.active:"rgba(160,122,255,0.05)", border:`1px solid ${source===b.id?"rgba(160,122,255,0.4)":C.border}`, borderRadius:"8px", marginBottom:"8px", cursor:"pointer", transition:"all 0.15s" }}>
                <div style={{ fontFamily:"'Cinzel',serif", fontSize:"12px", color:source===b.id?"#c4a0ff":C.text, letterSpacing:"0.05em" }}>{b.label}</div>
                <div style={{ fontSize:"11px", color:C.muted, marginTop:"3px", fontFamily:"'IBM Plex Mono',monospace" }}>{b.hint}</div>
              </div>
            ))}
            <div style={{ display:"flex", gap:"10px", marginTop:"16px" }}>
              <button onClick={() => fileRef.current.click()} style={{ flex:1, padding:"10px", background:"rgba(160,122,255,0.15)", border:"1px solid rgba(160,122,255,0.4)", borderRadius:"8px", color:"#c4a0ff", fontFamily:"'Cinzel',serif", fontSize:"12px", letterSpacing:"0.08em", cursor:"pointer" }}>
                Select File →
              </button>
              <button onClick={onClose} style={{ padding:"10px 20px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:"8px", color:C.muted, fontFamily:"'Cinzel',serif", fontSize:"12px", cursor:"pointer" }}>Cancel</button>
            </div>
            <input ref={fileRef} type="file" accept=".json,.html,.htm" style={{ display:"none" }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
          </>
        )}

        {step === "processing" && (
          <div style={{ textAlign:"center", padding:"30px 0", color:C.muted, fontFamily:"'IBM Plex Mono',monospace" }}>Parsing bookmarks...</div>
        )}

        {step === "done" && (
          <>
            <div style={{ padding:"12px", background:"rgba(80,216,144,0.08)", border:"1px solid rgba(80,216,144,0.2)", borderRadius:"8px", marginBottom:"16px" }}>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"12px", color:"#50d890" }}>✓ Found {imported.length} bookmarks</div>
            </div>
            <div style={{ maxHeight:"160px", overflowY:"auto", marginBottom:"16px" }}>
              {imported.slice(0,20).map((b,i) => (
                <div key={i} style={{ fontSize:"11px", color:C.muted, fontFamily:"'IBM Plex Mono',monospace", padding:"3px 0", borderBottom:`1px solid rgba(160,122,255,0.07)`, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {b.folder && <span style={{ color:"rgba(160,122,255,0.5)", marginRight:"6px" }}>[{b.folder}]</span>}
                  {b.name}
                </div>
              ))}
              {imported.length > 20 && <div style={{ fontSize:"10px", color:"rgba(160,122,255,0.4)", padding:"6px 0", fontFamily:"'IBM Plex Mono',monospace" }}>... and {imported.length - 20} more</div>}
            </div>
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={confirm} style={{ flex:1, padding:"10px", background:"rgba(80,216,144,0.12)", border:"1px solid rgba(80,216,144,0.35)", borderRadius:"8px", color:"#50d890", fontFamily:"'Cinzel',serif", fontSize:"12px", letterSpacing:"0.08em", cursor:"pointer" }}>
                Import All →
              </button>
              <button onClick={onClose} style={{ padding:"10px 20px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:"8px", color:C.muted, fontFamily:"'Cinzel',serif", fontSize:"12px", cursor:"pointer" }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Browser component ────────────────────────────────────────────────────
export default function Browser() {
  const [url,       setUrl]       = useState(HOME);
  const [inputVal,  setInputVal]  = useState(HOME);
  const [loading,   setLoading]   = useState(false);
  const [canBack,   setCanBack]   = useState(false);
  const [canFwd,    setCanFwd]    = useState(false);
  const [title,     setTitle]     = useState("");
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem("logos_browser_bookmarks") || "null") || getDefaultBookmarks(); }
    catch { return getDefaultBookmarks(); }
  });
  const [showImport, setShowImport] = useState(false);
  const [showBmBar,  setShowBmBar]  = useState(true);
  const webviewRef = useRef(null);
  const inputRef   = useRef(null);

  function getDefaultBookmarks() {
    return [
      { name:"Brave Search", url:"https://search.brave.com",  folder:"" },
      { name:"YouTube",      url:"https://youtube.com",       folder:"" },
      { name:"GitHub",       url:"https://github.com",        folder:"" },
      { name:"X",            url:"https://x.com",             folder:"" },
      { name:"Reddit",       url:"https://reddit.com",        folder:"" },
      { name:"Twitch",       url:"https://twitch.tv",         folder:"" },
    ];
  }

  function saveBookmarks(bms) {
    setBookmarks(bms);
    localStorage.setItem("logos_browser_bookmarks", JSON.stringify(bms));
  }

  function handleImport(imported) {
    // Merge: dedupe by URL, keep existing order, append new ones
    const existing = new Set(bookmarks.map(b => b.url));
    const merged   = [...bookmarks, ...imported.filter(b => !existing.has(b.url))];
    saveBookmarks(merged);
  }

  // Wire webview events (fallback / web mode)
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || isElectron) return; // In electron, IPC handles state

    const onLoad  = () => { setLoading(false); setInputVal(wv.getURL()); setTitle(wv.getTitle?.()||""); setCanBack(wv.canGoBack()); setCanFwd(wv.canGoForward()); };
    const onStart = () => setLoading(true);
    const onNav   = e  => setInputVal(e.url);

    wv.addEventListener("did-finish-load",      onLoad);
    wv.addEventListener("did-start-loading",    onStart);
    wv.addEventListener("did-navigate",         onNav);
    wv.addEventListener("did-navigate-in-page", onNav);
    return () => {
      wv.removeEventListener("did-finish-load",      onLoad);
      wv.removeEventListener("did-start-loading",    onStart);
      wv.removeEventListener("did-navigate",         onNav);
      wv.removeEventListener("did-navigate-in-page", onNav);
    };
  }, []);

  // IPC-based navigation for Electron (WebContentsView persists in main process)
  function navigate(dest) {
    const full = normalizeUrl(dest);
    setUrl(full); setInputVal(full); setLoading(true);
    if (isElectron && window.electronAPI?.browserNavigate) {
      window.electronAPI.browserNavigate(full);
    } else if (webviewRef.current) {
      webviewRef.current.loadURL(full);
    }
  }

  function go(dir) {
    if (isElectron && window.electronAPI?.browserGo) {
      window.electronAPI.browserGo(dir);
    } else {
      const wv = webviewRef.current; if (!wv) return;
      if (dir === "back"   && wv.canGoBack())    wv.goBack();
      if (dir === "forward"&& wv.canGoForward()) wv.goForward();
      if (dir === "reload") wv.reload();
      if (dir === "home")   navigate(HOME);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") { e.target.blur(); navigate(inputVal); }
    if (e.key === "Escape") { e.target.blur(); setInputVal(url); }
  }

  // Receive navigation events from main process
  useEffect(() => {
    if (!isElectron || !window.electronAPI?.onBrowserNav) return;
    const unsub = window.electronAPI.onBrowserNav(({ url: u, title: t, canBack: b, canFwd: f, loading: l }) => {
      if (u) { setUrl(u); setInputVal(u); }
      if (t !== undefined) setTitle(t);
      if (b !== undefined) setCanBack(b);
      if (f !== undefined) setCanFwd(f);
      if (l !== undefined) setLoading(l);
    });
    return () => unsub?.();
  }, []);

  const isSecure = url.startsWith("https://");

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:C.bg, position:"relative" }}>

      {/* ── Chrome bar ── */}
      <div style={{ background:C.bar, borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
        
        {/* Title bar area with branding */}
        <div style={{ padding:"6px 12px 0", display:"flex", alignItems:"center", gap:"8px" }}>
          {/* Collective sigil */}
          <div style={{ flexShrink:0, opacity:0.7 }}>
            <svg width="18" height="18" viewBox="0 0 40 40" fill="none">
              <polygon points="20,6.5 31,25.5 9,25.5" fill="none" stroke="rgba(160,122,255,0.9)" strokeWidth="2"/>
              <polygon points="20,33.5 9,14.5 31,14.5" fill="none" stroke="rgba(160,122,255,0.55)" strokeWidth="1.5"/>
              <circle cx="20" cy="20" r="3" fill="rgba(240,192,64,1)"/>
            </svg>
          </div>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:"10px", color:"rgba(160,122,255,0.5)", letterSpacing:"0.15em", flex:1 }}>BRAVE · THE COLLECTIVE</span>
          {/* Import button */}
          <button onClick={() => setShowImport(true)} title="Import bookmarks"
            style={{ padding:"3px 10px", background:"rgba(240,192,64,0.07)", border:"1px solid rgba(240,192,64,0.2)", borderRadius:"5px", color:C.gold, fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", cursor:"pointer", letterSpacing:"0.06em" }}>
            ⊕ IMPORT
          </button>
          <button onClick={() => setShowBmBar(b => !b)} title="Toggle bookmarks bar"
            style={{ padding:"3px 8px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:"5px", color:C.muted, fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", cursor:"pointer" }}>
            ≡
          </button>
        </div>

        {/* Nav controls */}
        <div style={{ padding:"6px 12px", display:"flex", alignItems:"center", gap:6 }}>
          <NavBtn onClick={() => go("back")}    disabled={!canBack} title="Back">‹</NavBtn>
          <NavBtn onClick={() => go("forward")} disabled={!canFwd}  title="Forward">›</NavBtn>
          <NavBtn onClick={() => go("reload")}  title="Reload">
            {loading
              ? <span style={{ display:"inline-block", animation:"spin 0.8s linear infinite", fontSize:13 }}>↻</span>
              : "↻"}
          </NavBtn>
          <NavBtn onClick={() => navigate(HOME)} title="Home">⌂</NavBtn>

          {/* URL bar */}
          <div style={{ flex:1, position:"relative" }}>
            {/* Security indicator */}
            <div style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:11,
              color:isSecure?"rgba(80,216,144,0.8)":"rgba(255,160,64,0.7)", zIndex:1, pointerEvents:"none" }}>
              {isSecure ? "🔒" : "⚠"}
            </div>
            <input
              ref={inputRef}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              style={{ width:"100%", background:C.input, border:"1px solid rgba(160,122,255,0.18)", borderRadius:8,
                padding:"7px 36px 7px 28px", color:C.text, fontFamily:"'IBM Plex Mono',monospace",
                fontSize:12, outline:"none", boxSizing:"border-box", transition:"border-color 0.15s" }}
              onFocus={e => { e.target.select(); e.target.style.borderColor="rgba(160,122,255,0.45)"; }}
              onBlur={e  => { e.target.style.borderColor="rgba(160,122,255,0.18)"; }}
            />
            <button onClick={() => navigate(inputVal)}
              style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"transparent",
                border:"none", color:C.muted, cursor:"pointer", fontSize:14, lineHeight:1, padding:"2px 4px" }}>↵</button>
          </div>

          {/* Open in system browser */}
          <NavBtn onClick={() => { if(window.electronAPI?.openHtml) {} window.open(url,"_blank"); }} title="Open externally" gold>⎋</NavBtn>
        </div>
      </div>

      {/* ── Bookmarks bar ── */}
      {showBmBar && (
        <div style={{ padding:"4px 12px", background:"rgba(3,3,10,0.95)", borderBottom:`1px solid rgba(160,122,255,0.07)`, display:"flex", gap:3, flexShrink:0, overflowX:"auto", alignItems:"center" }}>
          {bookmarks.filter(b => !b.folder).map((b, i) => (
            <button key={i} onClick={() => navigate(b.url)}
              style={{ padding:"3px 11px", borderRadius:5, background:"transparent", border:`1px solid ${C.border}`, color:C.muted,
                cursor:"pointer", fontSize:11, fontFamily:"'IBM Plex Mono',monospace", whiteSpace:"nowrap",
                display:"flex", alignItems:"center", gap:5, transition:"all 0.12s", flexShrink:0 }}
              onMouseEnter={e => { e.currentTarget.style.background=C.active; e.currentTarget.style.color=C.purple; e.currentTarget.style.borderColor="rgba(160,122,255,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color=C.muted; e.currentTarget.style.borderColor=C.border; }}>
              {b.name}
            </button>
          ))}
          {bookmarks.some(b => b.folder) && (
            <button style={{ padding:"3px 10px", borderRadius:5, background:"rgba(240,192,64,0.05)", border:"1px solid rgba(240,192,64,0.15)", color:"rgba(240,192,64,0.5)", cursor:"pointer", fontSize:10, fontFamily:"'IBM Plex Mono',monospace", flexShrink:0 }}>
              ▾ Folders
            </button>
          )}
        </div>
      )}

      {/* ── Webview (persists via main process WebContentsView in Electron) ── */}
      <div style={{ flex:1, position:"relative", overflow:"hidden" }}>
        {/* In Electron: webContentsView is managed by main process and overlaid here.
            React renders a transparent placeholder div. The main process sizes the 
            WebContentsView to match this div's bounds on each navigation. */}
        {isElectron ? (
          <div id="browser-view-placeholder" style={{ width:"100%", height:"100%", background:"transparent" }} />
        ) : (
          <webview
            ref={webviewRef}
            src={HOME}
            style={{ width:"100%", height:"100%", border:"none" }}
            allowpopups="true"
            partition="persist:logos-browser"
          />
        )}

        {/* Loading bar */}
        {loading && (
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:"rgba(160,122,255,0.08)", zIndex:10 }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#4020a0,#a07aff,#4020a0)", backgroundSize:"200% 100%", animation:"loadBar 1.2s linear infinite" }} />
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      <div style={{ padding:"3px 14px", background:"rgba(2,2,8,0.95)", borderTop:`1px solid rgba(160,122,255,0.05)`, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:10, color:"#3030a0", fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"70%" }}>
          {title || url}
        </span>
        <span style={{ fontSize:9, color:"rgba(160,122,255,0.3)", fontFamily:"'Cinzel',serif", letterSpacing:"0.1em", flexShrink:0 }}>
          THE COLLECTIVE
        </span>
      </div>

      {/* Import modal */}
      {showImport && <ImportModal onImport={handleImport} onClose={() => setShowImport(false)} />}

      <style>{`
        @keyframes loadBar { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
