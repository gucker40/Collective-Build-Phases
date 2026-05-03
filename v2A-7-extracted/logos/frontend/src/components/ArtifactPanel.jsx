import React, { useState, useEffect, useRef } from "react";
import { API } from "../api.js";
import { useLayout } from "../useLayout.js";

const LANG_LABELS = {
  html:"HTML", js:"JavaScript", jsx:"React", tsx:"React/TS",
  py:"Python", python:"Python", css:"CSS", json:"JSON",
  bash:"Bash", sh:"Shell", sql:"SQL", md:"Markdown",
  text:"Text", rust:"Rust", go:"Go", csv:"CSV", svg:"SVG",
};

const RENDERABLE = ["html", "svg"];

// Syntax highlight token types
const TOKEN_PATTERNS = [
  { type: "comment",  re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//g,         color: "#6a7a5c" },
  { type: "string",   re: /(`[\s\S]*?`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, color: "#a8c97a" },
  { type: "number",   re: /\b(\d+\.?\d*)\b/g,                     color: "#e0a060" },
  { type: "keyword",  re: /\b(const|let|var|function|return|if|else|for|while|class|import|export|default|from|async|await|new|this|typeof|instanceof|null|undefined|true|false|try|catch|throw|switch|case|break|continue|of|in|do|void)\b/g, color: "#a07aff" },
  { type: "tag",      re: /(<\/?[\w-]+)/g,                         color: "#60b8ff" },
  { type: "attr",     re: /\s([\w-]+=)/g,                         color: "#80d8b0" },
  { type: "cssval",   re: /(#[0-9a-fA-F]{3,8})/g,                 color: "#f0c040" },
];

function highlightCode(code, lang) {
  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const escaped = esc(code);
  // Only apply to JS/HTML/CSS-ish languages
  const doHL = ["js","jsx","ts","tsx","html","css","py","python"].includes(lang);
  if (!doHL) return escaped;

  // We use a simple single-pass tokenizer
  let result = "";
  let i = 0;
  const src = code;
  const len = src.length;

  function peek(offset = 0) { return src[i + offset] || ""; }
  function eat(n = 1) { const s = src.slice(i, i + n); i += n; return s; }

  function esc2(s) { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  const KEYWORDS = new Set(["const","let","var","function","return","if","else","for","while","class","import","export","default","from","async","await","new","this","typeof","instanceof","null","undefined","true","false","try","catch","throw","switch","case","break","continue","of","in","do","void","def","print","pass","elif","not","and","or","lambda","yield","with","as","del","global","nonlocal","raise","except","finally"]);

  while (i < len) {
    // Line comment
    if (src[i] === "/" && peek(1) === "/") {
      let s = "";
      while (i < len && src[i] !== "\n") s += eat();
      result += `<span style="color:#6a7a5c">${esc2(s)}</span>`;
      continue;
    }
    // Block comment
    if (src[i] === "/" && peek(1) === "*") {
      let s = eat(2);
      while (i < len && !(src[i-1] === "*" && src[i] === "/")) s += eat();
      s += eat(); // consume closing /
      result += `<span style="color:#6a7a5c">${esc2(s)}</span>`;
      continue;
    }
    // Python comment
    if (src[i] === "#" && (lang === "py" || lang === "python")) {
      let s = "";
      while (i < len && src[i] !== "\n") s += eat();
      result += `<span style="color:#6a7a5c">${esc2(s)}</span>`;
      continue;
    }
    // Template literal
    if (src[i] === "`") {
      let s = eat();
      while (i < len && src[i] !== "`") {
        if (src[i] === "\\" && i+1 < len) s += eat(2);
        else s += eat();
      }
      s += eat();
      result += `<span style="color:#a8c97a">${esc2(s)}</span>`;
      continue;
    }
    // String
    if (src[i] === '"' || src[i] === "'") {
      const q = src[i];
      let s = eat();
      while (i < len && src[i] !== q && src[i] !== "\n") {
        if (src[i] === "\\" && i+1 < len) s += eat(2);
        else s += eat();
      }
      s += eat();
      result += `<span style="color:#a8c97a">${esc2(s)}</span>`;
      continue;
    }
    // Hex color
    if (src[i] === "#" && /[0-9a-fA-F]/.test(peek(1))) {
      let s = eat();
      while (i < len && /[0-9a-fA-F]/.test(src[i]) && s.length < 8) s += eat();
      if (s.length >= 4) { result += `<span style="color:#f0c040">${esc2(s)}</span>`; continue; }
      result += esc2(s); continue;
    }
    // Number
    if (/[0-9]/.test(src[i]) && (i===0 || !/[a-zA-Z_$]/.test(src[i-1]))) {
      let s = "";
      while (i < len && /[0-9._]/.test(src[i])) s += eat();
      result += `<span style="color:#e0a060">${esc2(s)}</span>`;
      continue;
    }
    // HTML tag name
    if ((lang === "html" || lang === "svg") && src[i] === "<") {
      let s = eat();
      if (src[i] === "/") s += eat();
      let tag = "";
      while (i < len && /[a-zA-Z0-9_-]/.test(src[i])) tag += eat();
      if (tag) {
        result += `${esc2(s)}<span style="color:#60b8ff">${esc2(tag)}</span>`;
      } else {
        result += esc2(s);
      }
      continue;
    }
    // Identifier / keyword
    if (/[a-zA-Z_$]/.test(src[i])) {
      let s = "";
      while (i < len && /[a-zA-Z_$0-9]/.test(src[i])) s += eat();
      if (KEYWORDS.has(s)) {
        result += `<span style="color:#a07aff">${esc2(s)}</span>`;
      } else if (/^[A-Z]/.test(s)) {
        result += `<span style="color:#f0c8a0">${esc2(s)}</span>`;
      } else {
        result += esc2(s);
      }
      continue;
    }
    // CSS property-like pattern (word followed by colon, in CSS/HTML style blocks)
    result += esc2(eat());
  }
  return result;
}

function wrapForPreview(content, lang) {
  if (lang === "svg") {
    return `<!DOCTYPE html><html><body style="margin:0;background:#0d0d1a;display:flex;align-items:center;justify-content:center;min-height:100vh">${content}</body></html>`;
  }
  return content;
}

export default function ArtifactPanel({ artifact, open, onClose, onNotify, mobile }) {
  const { isMobile, isTablet } = useLayout();
  const isNarrow = mobile || isMobile || isTablet;
  const [tab, setTab]       = useState("preview");
  const [copied, setCopied] = useState(false);
  const [width, setWidth]   = useState(560);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const iframeRef = useRef(null);
  const prevContentRef = useRef("");

  useEffect(() => {
    if (!artifact) return;
    const isR = RENDERABLE.includes(artifact.language?.toLowerCase());
    setTab(isR ? "preview" : "code");
    prevContentRef.current = ""; // clear guard so next effect always fires
  }, [artifact?.title, open]);

  // Set srcdoc whenever artifact opens or content changes
  // Must cover both cases: (1) panel opens with content already set, (2) content updates
  useEffect(() => {
    if (!artifact || !open) return;
    const lang = artifact.language?.toLowerCase();
    if (!RENDERABLE.includes(lang)) return;
    // Small rAF to ensure iframe is in DOM before writing
    requestAnimationFrame(() => {
      if (!iframeRef.current) return;
      const newContent = wrapForPreview(artifact.content || "", lang);
      if (newContent === prevContentRef.current) return;
      prevContentRef.current = newContent;
      iframeRef.current.srcdoc = newContent;
    });
  }, [artifact?.content, artifact?.language, artifact?.title, open]);

  useEffect(() => {
    const move = e => {
      if (!drag.current) return;
      setWidth(Math.max(320, Math.min(1200, drag.current.w + drag.current.x - e.clientX)));
    };
    const up = () => { drag.current = null; setDragging(false); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  async function copy() {
    await navigator.clipboard?.writeText(artifact?.content || "");
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    if (!artifact) return;
    const lang = artifact.language?.toLowerCase() || "txt";
    const extMap = { html:"html", svg:"svg", py:"py", python:"py", js:"js", jsx:"jsx", css:"css", json:"json", sql:"sql", bash:"sh", sh:"sh", md:"md" };
    const ext  = extMap[lang] || lang;
    const name = (artifact.title || "artifact").replace(/[^a-zA-Z0-9_-]/g, "_") + "." + ext;
    const blob = new Blob([artifact.content], { type:"text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url; a.download=name; a.click();
    URL.revokeObjectURL(url);
  }

  async function openInBrowser() {
    if (!artifact) return;
    if (window.electronAPI?.openHtml) {
      window.electronAPI.openHtml(artifact.content, (artifact.title || "preview") + ".html");
      return;
    }
    const blob = new Blob([artifact.content], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  if (!open || !artifact) return null;

  const lang      = artifact.language?.toLowerCase() || "text";
  const isRender  = RENDERABLE.includes(lang);
  const langLabel = LANG_LABELS[lang] || lang.toUpperCase();
  const highlighted = highlightCode(artifact.content || "", lang);

  return (
    <div style={{ width: isNarrow ? "100%" : `${width}px`, flexShrink:0, display:"flex", position:"relative", height:"100%" }}>
      {/* Drag handle */}
      <div
        onMouseDown={e => { drag.current={x:e.clientX,w:width}; setDragging(true); e.preventDefault(); }}
        style={{ position:"absolute",left:0,top:0,bottom:0,width:"5px",cursor:"ew-resize",zIndex:10,
          background:dragging?"rgba(160,122,255,0.5)":"transparent",transition:"background 0.15s" }}
        onMouseEnter={e=>{if(!dragging)e.currentTarget.style.background="rgba(160,122,255,0.2)";}}
        onMouseLeave={e=>{if(!dragging)e.currentTarget.style.background="transparent";}}
      />

      <div style={{ flex:1,display:"flex",flexDirection:"column",background:"#07070e",borderLeft:"1px solid rgba(160,122,255,0.2)",overflow:"hidden" }}>
        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",gap:"6px",padding:"0 10px",height:"42px",borderBottom:"1px solid rgba(160,122,255,0.12)",flexShrink:0,background:"rgba(5,5,12,0.95)" }}>
          <span style={{ padding:"2px 8px",borderRadius:"4px",background:"rgba(240,192,64,0.1)",border:"1px solid rgba(240,192,64,0.25)",fontFamily:"monospace",fontSize:"9px",color:"rgba(240,192,64,0.8)",letterSpacing:"0.1em",textTransform:"uppercase" }}>
            {langLabel}
          </span>
          <span style={{ flex:1,fontSize:"12px",color:"rgba(200,190,220,0.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
            {artifact.title || "Artifact"}
          </span>
          {/* Live indicator during streaming - removed, panel only opens on completion */}
          {isRender && (
            <div style={{ display:"flex",borderRadius:"5px",overflow:"hidden",border:"1px solid rgba(160,122,255,0.2)" }}>
              {["preview","code"].map(t=>(
                <button key={t} onClick={()=>setTab(t)}
                  style={{ padding:"3px 10px",fontSize:"9px",fontFamily:"monospace",textTransform:"uppercase",border:"none",cursor:"pointer",
                    background:tab===t?"rgba(160,122,255,0.28)":"transparent",
                    color:tab===t?"#c4a0ff":"rgba(160,154,184,0.4)" }}>
                  {t}
                </button>
              ))}
            </div>
          )}
          <div style={{ display:"flex",gap:"3px" }}>
            {lang==="html" && <Btn onClick={openInBrowser} title="Open in browser">&#127759;</Btn>}
            <Btn onClick={copy} title="Copy">{copied?"&#10003;":"&#9113;"}</Btn>
            <Btn onClick={download} title="Download">&#8595;</Btn>
            <Btn onClick={onClose} title="Close" danger>&#10005;</Btn>
          </div>
        </div>

          {/* Content */}
          <div style={{ flex:1,overflow:"hidden",position:"relative" }}>
          {isRender && tab==="preview" && (
            <iframe
              ref={iframeRef}
              title="Preview"
              style={{ width:"100%",height:"100%",border:"none" }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
            />
          )}
          {(!isRender || tab==="code") && (
            <div style={{ height:"100%",overflowY:"auto",overflowX:"auto" }}>
              {/* Line numbers + code */}
              <div style={{ display:"flex",minHeight:"100%" }}>
                <div style={{ flexShrink:0,padding:"20px 0",borderRight:"1px solid rgba(160,122,255,0.08)",background:"rgba(0,0,0,0.2)",userSelect:"none",minWidth:"44px" }}>
                  {(artifact.content||"").split("\n").map((_,idx) => (
                    <div key={idx} style={{ padding:"0 12px",fontFamily:"monospace",fontSize:"12px",lineHeight:"1.75",color:"rgba(100,90,140,0.4)",textAlign:"right" }}>
                      {idx+1}
                    </div>
                  ))}
                </div>
                <pre style={{ margin:0,padding:"20px 20px 20px 16px",fontFamily:"'IBM Plex Mono',monospace",fontSize:"12.5px",lineHeight:"1.75",whiteSpace:"pre",tabSize:2,flex:1,overflow:"visible" }}>
                  <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div style={{ padding:"5px 14px",borderTop:"1px solid rgba(160,122,255,0.08)",display:"flex",gap:"16px",flexShrink:0,background:"rgba(3,3,8,0.8)" }}>
          <span style={{ fontFamily:"monospace",fontSize:"10px",color:"rgba(120,100,180,0.4)" }}>
            {(artifact.content||"").split("\n").length} lines
          </span>
          <span style={{ fontFamily:"monospace",fontSize:"10px",color:"rgba(120,100,180,0.4)" }}>
            {((artifact.content||"").length/1024).toFixed(1)} KB
          </span>
          {lang === "html" && (
            <span style={{ fontFamily:"monospace",fontSize:"10px",color:"rgba(120,100,180,0.4)" }}>
              {(artifact.content||"").match(/<script/gi)?.length||0} scripts · {(artifact.content||"").match(/<style/gi)?.length||0} styles
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Btn({ onClick, title, danger, children }) {
  const [h,setH] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
      style={{ width:"27px",height:"27px",borderRadius:"5px",border:"none",cursor:"pointer",fontSize:"13px",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.1s",
        background:h?(danger?"rgba(200,40,40,0.3)":"rgba(160,122,255,0.22)"):"rgba(160,122,255,0.08)",
        color:h?(danger?"#ff8080":"#c4a0ff"):"#8070b0" }}
      dangerouslySetInnerHTML={{ __html:String(children) }}
    />
  );
}
