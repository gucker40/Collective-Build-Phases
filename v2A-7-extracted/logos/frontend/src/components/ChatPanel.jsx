import React, { useState, useRef, useEffect, useCallback } from "react";
import LogosSigil from "./LogosSigil.jsx";
import LogosModal from "./LogosModal.jsx";
import { useLayout } from "../useLayout.js";

import { API } from "../api.js";

function renderMd(text) {
  if (!text) return "";
  let html = "", inCode = false, codeLang = "", codeBuf = "", inList = false, listType = "";
  const close = () => { if (inList) { html += listType==="ul"?"</ul>":"</ol>"; inList=false; } };
  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const fmt = s => esc(s).replace(/\*\*\*(.+?)\*\*\*/g,"<strong><em>$1</em></strong>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
  for (const line of text.split("\n")) {
    if (line.startsWith("```")) {
      if (!inCode) { close(); inCode=true; codeLang=line.slice(3).trim()||"text"; codeBuf=""; }
      else { html+=`<pre><code class="lang-${codeLang}">${esc(codeBuf)}</code></pre>`; inCode=false; }
      continue;
    }
    if (inCode) { codeBuf+=(codeBuf?"\n":"")+line; continue; }
    const h3=line.match(/^### (.+)/), h2=line.match(/^## (.+)/), h1=line.match(/^# (.+)/);
    if (h3) { close(); html+=`<h3>${fmt(h3[1])}</h3>`; continue; }
    if (h2) { close(); html+=`<h2>${fmt(h2[1])}</h2>`; continue; }
    if (h1) { close(); html+=`<h1>${fmt(h1[1])}</h1>`; continue; }
    if (line.match(/^---+$/)) { close(); html+="<hr/>"; continue; }
    const bul=line.match(/^[-*+] (.+)/);
    if (bul) { if (!inList||listType!=="ul"){ if(inList) html+=listType==="ul"?"</ul>":"</ol>"; html+="<ul>"; inList=true; listType="ul"; } html+=`<li>${fmt(bul[1])}</li>`; continue; }
    const num=line.match(/^\d+\. (.+)/);
    if (num) { if (!inList||listType!=="ol"){ if(inList) html+=listType==="ul"?"</ul>":"</ol>"; html+="<ol>"; inList=true; listType="ol"; } html+=`<li>${fmt(num[1])}</li>`; continue; }
    if (inList && line.trim()) close();
    if (!line.trim()) { close(); html+="<br/>"; continue; }
    html+=`<p>${fmt(line)}</p>`;
  }
  close();
  return html;
}

// Extract all completed ```lang\ncode``` blocks from text
function extractAllBlocks(text) {
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    blocks.push({ lang: (m[1]||"text").toLowerCase(), code: m[2]||"" });
  }
  return blocks;
}

const LANG_PRIORITY = ["html","svg","jsx","tsx","js","ts","css","csv","py","python","sql","bash","sh","json","md"];

function bestBlock(blocks) {
  if (!blocks.length) return null;
  return blocks.reduce((a, b) => {
    const aS = LANG_PRIORITY.indexOf(a.lang), bS = LANG_PRIORITY.indexOf(b.lang);
    if (aS !== bS) return (aS>=0?aS:999) < (bS>=0?bS:999) ? a : b;
    return b.code.length > a.code.length ? b : a;
  });
}

function smartTitle(lang, code, userPrompt) {
  if (lang !== "html" && lang !== "svg") {
    const types = { py:"Python Script", python:"Python Script", sql:"SQL Query",
      bash:"Shell Script", sh:"Shell Script", js:"JS Script", ts:"TypeScript",
      jsx:"Component", tsx:"Component", css:"Stylesheet", json:"JSON Data",
      md:"Document", csv:"Data Table" };
    return types[lang] || (lang.toUpperCase() + " File");
  }
  const titleTag = code.match(/<title[^>]*>([^<]{2,60})<\/title>/i);
  if (titleTag) return titleTag[1].trim().slice(0, 40);
  const heading = code.match(/<h[12][^>]*>([^<]{2,60})<\/h[12]>/i);
  if (heading) return heading[1].replace(/<[^>]+>/g,"").trim().slice(0, 40);
  const stopWords = new Set(["a","an","the","make","me","some","few","create","build","write",
    "please","can","you","i","want","need","generate","give","show","test","just","my","for",
    "with","and","or","of","to","in","on","at","is","are","that","this","hi","hey","couple"]);
  const words = (userPrompt||"").toLowerCase().replace(/[^a-z0-9 ]/g," ").split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
  if (words.length >= 2) return words.slice(0,3).map(w=>w[0].toUpperCase()+w.slice(1)).join(" ");
  return "Web App";
}

// Replace code blocks in text with artifact tokens for display
function buildDisplayText(rawText, blocks, userPrompt) {
  if (!blocks.length) return rawText;
  // Use regex replacement directly — avoids exact-string matching issues
  return rawText.replace(/```(\w+)?\n[\s\S]*?```/g, (_, lang) => {
    const l = (lang||"text").toLowerCase();
    // Find matching block's code for the title
    const block = blocks.find(b => b.lang === l) || blocks[0];
    const title = smartTitle(l, block?.code||"", userPrompt);
    return `\n[[ARTIFACT:${l}:${title}]]\n`;
  });
}

export default function ChatPanel({ onArtifact, onNotify, loadedSession, onSessionSaved, mobile }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sigil, setSigil]         = useState("idle");
  const [showModal, setModal]     = useState(false);
  const [suggested, setSuggested] = useState(null);
  const [pending, setPending]     = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [backendOk, setBackendOk] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImgPrev] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText]   = useState("");
  const artifactStore             = useRef({});
  const intentRef                 = useRef("explain"); // tracks current intent for artifact decisions

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const abortRef   = useRef(null);
  const fileRef    = useRef(null);
  const { isMobile, isTablet } = useLayout();
  const isNarrow = mobile || isMobile || isTablet;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    fetch(`${API}/health`, { signal: AbortSignal.timeout(4000) })
      .then(r => r.ok ? setBackendOk(true) : setBackendOk(false))
      .catch(() => setBackendOk(false));
  }, []);

  useEffect(() => {
    if (!loadedSession?.id) return;
    fetch(`${API}/history/load/${loadedSession.id}`)
      .then(r => r.json())
      .then(d => { setMessages(d.messages||[]); setSessionId(d.id); })
      .catch(() => {});
  }, [loadedSession]);

  const autoSave = useCallback(async (msgs, sid) => {
    if (msgs.length < 2) return sid;
    try {
      const r = await fetch(`${API}/history/save`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ session_id:sid||undefined, messages:msgs }),
      });
      const d = await r.json();
      if (d.id && !sid) setSessionId(d.id);
      onSessionSaved?.();
      return d.id;
    } catch { return sid; }
  }, [onSessionSaved]);

  async function handleSubmit(e) {
    e?.preventDefault();
    if ((!input.trim() && !imageFile) || streaming) return;
    const userText = input.trim();
    setInput("");
    if (imageFile) { await handleVision(userText||"Describe this image."); return; }
    setPending(userText);
    setSuggested(null);
    setModal(true);
    try {
      const r = await fetch(`${API}/logos/intent`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ prompt:userText }),
        signal:AbortSignal.timeout(15000),
      });
      const d = await r.json();
      setBackendOk(true);
      if (d.intent === "fast") {
        setModal(false); setPending(null);
        await sendToLogos(userText, "fast");
      } else {
        setSuggested(d.intent);
      }
    } catch {
      setSuggested("explain");
    }
  }

  async function handleVision(prompt) {
    const userMsg = { role:"user", content:prompt, image:imagePreview, id:Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setImageFile(null); setImgPrev(null);
    setSigil("thinking"); setStreaming(true);
    try {
      const fd = new FormData(); fd.append("file", imageFile); fd.append("prompt", prompt);
      const r = await fetch(`${API}/logos/vision`, { method:"POST", body:fd });
      const d = await r.json();
      const msgs = [...messages, userMsg, { role:"assistant", content:d.analysis, id:Date.now()+1, member:"opsis" }];
      setMessages(msgs); autoSave(msgs, sessionId);
    } catch (err) {
      setMessages(prev => [...prev, { role:"assistant", content:`Vision failed: ${err.message}`, id:Date.now()+1, error:true }]);
    }
    setSigil("idle"); setStreaming(false);
  }

  function onIntentSelect(intent) { setModal(false); if (pending) { sendToLogos(pending, intent); setPending(null); } }
  function onModalDismiss()       { setModal(false); if (pending) { sendToLogos(pending, "explain"); setPending(null); } }

  async function sendToLogos(userText, intent, baseMsgs) {
    intentRef.current = intent || "explain"; // track intent for artifact decisions
    const userMsg = { role:"user", content:userText, id:Date.now() };
    const asstId  = Date.now() + 1;
    const newMsgs = [...(baseMsgs || messages), userMsg];
    setMessages([...newMsgs, { role:"assistant", content:"", id:asstId, streaming:true, member:"logos", startedAt:Date.now() }]);
    setSigil("thinking"); setStreaming(true);

    // Trim history: last 12 messages, truncate each to 2000 chars to avoid Groq 413
    const history = newMsgs.slice(-12).map(m => ({
      role: m.role,
      content: typeof m.content === "string" && m.content.length > 2000
        ? m.content.slice(0, 2000) + "…[truncated]"
        : (m.content || "")
    }));
    try {
      const ctrl = new AbortController(); abortRef.current = ctrl;
      const res = await fetch(`${API}/logos/chat`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        signal:ctrl.signal,
        body:JSON.stringify({ messages:history, intent, memory_enabled:true }),
      });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let full = "";
      setSigil("speaking");
      let done = false;

      while (!done) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        for (const line of dec.decode(value, { stream:true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));

            if (ev.type === "content") {
              full += ev.content;
              const blocks = extractAllBlocks(full);
              const display = buildDisplayText(full, blocks, userText);
              setMessages(prev => prev.map(m => m.id===asstId
                ? { ...m, content:display, _raw:full, streaming:true, startedAt:m.startedAt }
                : m));

            } else if (ev.type === "done") {
              done = true; // break outer while
              const startedAt = (() => {
                let t = null;
                setMessages(prev => { const m = prev.find(x=>x.id===asstId); if(m) t=m.startedAt; return prev; });
                return t;
              })();

              const allBlocks = extractAllBlocks(full);
              const best = bestBlock(allBlocks);

              // Open artifact panel only for build intent or substantive code responses
              // Never auto-open for explain/research/refine/fast/council plain responses
              const isBuildIntent = intentRef.current === "build" || intentRef.current === "techne";
              const hasHtmlOrSvg  = allBlocks.some(b => b.lang === "html" || b.lang === "svg");
              const isSubstantial = best && best.code.trim().length > 200;
              const shouldOpenArtifact = best && (isBuildIntent || (hasHtmlOrSvg && isSubstantial));

              if (shouldOpenArtifact) {
                const title = smartTitle(best.lang, best.code, userText);
                const art = { type:"code", language:best.lang, content:best.code, title };
                artifactStore.current[title] = art;
                onArtifact(art);
              }
              // Always persist substantial code blocks silently (never auto-open panel)
              for (const block of allBlocks) {
                if (block.code.trim().length > 80) {
                  const t = smartTitle(block.lang, block.code, userText);
                  artifactStore.current[t] = { type:"code", language:block.lang, content:block.code, title:t };
                  fetch(`${API}/artifacts/save`, {
                    method:"POST", headers:{"Content-Type":"application/json"},
                    body:JSON.stringify({ title:t, language:block.lang, content:block.code }),
                  }).catch(()=>{});
                }
              }

              const displayFull = buildDisplayText(full, allBlocks, userText);
              const finalMsgs = [...newMsgs, {
                role:"assistant", content:displayFull, id:asstId, streaming:false,
                member:ev.member, totalMs: Date.now() - (startedAt||Date.now()),
              }];
              setMessages(finalMsgs);
              autoSave(finalMsgs, sessionId);
              setBackendOk(true);
              // Stop spinner immediately
              setSigil("idle"); setStreaming(false);
            }
          } catch { /* malformed SSE line — skip */ }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") { setSigil("idle"); setStreaming(false); return; }
      let msg = err.message;
      if (msg.includes("fetch") || msg.includes("Failed") || msg.includes("network")) {
        msg = "Cannot reach backend. Try closing and reopening The Collective. If the problem persists, check that Python is installed.";
      }
      setMessages(prev => prev.map(m => m.id===asstId ? {...m, content:msg, streaming:false, error:true} : m));
      setBackendOk(false);
    }
    // Ensure spinner always stops even on unexpected exit
    setSigil("idle"); setStreaming(false);
  }

  function handleKey(e) { if (e.key==="Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }

  async function sealMessage(content) {
    try {
      await fetch(`${API}/memory/seal`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ text:content, type:"Conversation" }) });
      onNotify?.("Sealed to memory ✦");
    } catch { onNotify?.("Seal failed","error"); }
  }

  async function handleEditSubmit(msg) {
    const idx = messages.findIndex(m => m.id === msg.id);
    const trimmed = messages.slice(0, idx);
    setMessages(trimmed);
    setEditingId(null);
    await new Promise(r => setTimeout(r, 50));
    setPending(editText); setSuggested(null); setModal(true);
    try {
      const r = await fetch(`${API}/logos/intent`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ prompt:editText }),
        signal:AbortSignal.timeout(10000),
      });
      const d = await r.json();
      if (d.intent === "fast") { setModal(false); setPending(null); sendToLogos(editText, "fast", trimmed); }
      else setSuggested(d.intent);
    } catch { setSuggested("explain"); }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", position:"relative" }}>
      {showModal && <LogosModal visible suggested={suggested} onSelect={onIntentSelect} onDismiss={onModalDismiss} />}

      {backendOk === false && (
        <div style={{ padding:"10px 20px", background:"rgba(220,50,50,0.12)", borderBottom:"1px solid rgba(220,50,50,0.25)", display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"13px", color:"#ff9090", fontFamily:"'IBM Plex Mono',monospace" }}>
            Backend offline — <a href={`${API}/health`} target="_blank" style={{ color:"#ffb0b0" }}>check status</a> or restart The Collective
          </span>
          <button onClick={() => fetch(`${API}/health`).then(()=>setBackendOk(true)).catch(()=>{})}
            style={{ marginLeft:"auto", fontSize:"11px", color:"#ff9090", background:"transparent", border:"1px solid rgba(220,50,50,0.3)", padding:"4px 10px", borderRadius:"6px", cursor:"pointer" }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:"28px 0 12px" }}>
        {messages.length === 0 && <Welcome />}
        {messages.map((msg,i) => (
          <Message key={msg.id||i} msg={msg}
            onSeal={() => sealMessage(msg.content)}
            onEdit={() => { setEditingId(msg.id); setEditText(msg.content); }}
            editing={editingId === msg.id}
            editText={editText}
            onEditText={setEditText}
            onEditSubmit={() => handleEditSubmit(msg)}
            onEditCancel={() => setEditingId(null)}
            onOpenArtifact={onArtifact}
            artifactStore={artifactStore.current}
          />
        ))}
        <div ref={bottomRef} style={{ height:"8px" }} />
      </div>

      <div style={{ flexShrink:0, padding: isNarrow ? "8px 12px 12px" : "12px 24px 18px", borderTop:"1px solid rgba(160,122,255,0.14)" }}>
        {imagePreview && (
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
            <img src={imagePreview} alt="" style={{ height:"52px", width:"52px", objectFit:"cover", borderRadius:"6px", border:"1px solid rgba(160,122,255,0.35)" }} />
            <span style={{ fontSize:"12px", color:"#9080c0" }}>{imageFile?.name}</span>
            <button onClick={()=>{setImageFile(null);setImgPrev(null);}} style={{ marginLeft:"auto", background:"transparent", border:"none", color:"#9080c0", cursor:"pointer", fontSize:"15px" }}>✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display:"flex", alignItems:"flex-end", gap:"12px" }}>
          <div style={{ flexShrink:0, width:"30px", height:"30px", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"9px" }}>
            <LogosSigil size={28} state={sigil} animated />
          </div>
          <div style={{ flex:1, position:"relative", borderRadius:"14px", background:"rgba(8,8,18,0.9)", border: streaming ? "1px solid rgba(160,122,255,0.5)" : "1px solid rgba(160,122,255,0.25)", transition:"border-color 0.2s, box-shadow 0.2s", boxShadow: streaming ? "0 0 28px rgba(160,122,255,0.14)" : "none" }}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Speak to Logos" rows={1} disabled={streaming}
              style={{ width:"100%", background:"transparent", border:"none", outline:"none", resize:"none", padding: isNarrow ? "12px 52px 12px 14px" : "14px 58px 14px 18px", color:"#f0ecff", fontFamily:"'IBM Plex Sans',sans-serif", fontSize: isNarrow ? "16px" : "15px", lineHeight:"1.55", maxHeight:"180px", minHeight: isNarrow ? "44px" : "50px", caretColor:"#c4a0ff" }}
              onInput={e => { e.target.style.height="auto"; e.target.style.height=Math.min(e.target.scrollHeight,180)+"px"; }}
            />
            <div style={{ position:"absolute", right:"8px", bottom:"9px", display:"flex", gap:"4px" }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { const f=e.target.files[0]; if(!f) return; setImageFile(f); const r=new FileReader(); r.onload=ev=>setImgPrev(ev.target.result); r.readAsDataURL(f); }} />
              <IBtn onClick={()=>fileRef.current?.click()} title="Attach image">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.2"/><circle cx="4.5" cy="4.5" r="1.2" fill="currentColor"/><path d="M1 10.5l3.5-3.5 3 3 2-2.5 4 4" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
              </IBtn>
              {streaming
                ? <IBtn onClick={()=>abortRef.current?.abort()} title="Stop generating" bright>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1.5" y="1.5" width="8" height="8" rx="1.5" fill="currentColor"/></svg>
                  </IBtn>
                : <IBtn onClick={handleSubmit} title="Send" bright={!!(input.trim()||imageFile)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12.5 7L1.5 1.5 4 7l-2.5 5.5L12.5 7z" fill="currentColor"/></svg>
                  </IBtn>
              }
            </div>
          </div>
        </form>
        <p style={{ textAlign:"center", marginTop:"8px", fontSize:"11px", color:"#4840a0", fontFamily:"'IBM Plex Mono',monospace" }}>
          Enter to send · Shift+Enter for newline · Logos routes automatically
        </p>
      </div>
    </div>
  );
}

function IBtn({ onClick, title, bright, children }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width:"32px", height:"32px", borderRadius:"8px", display:"flex", alignItems:"center", justifyContent:"center", background: bright ? "rgba(160,122,255,0.25)" : "transparent", border: bright ? "1px solid rgba(160,122,255,0.4)" : "1px solid transparent", color: bright ? "#c4a0ff" : "#6858a8", cursor:"pointer", transition:"all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.background="rgba(160,122,255,0.22)"; e.currentTarget.style.color="#c4a0ff"; }}
      onMouseLeave={e => { e.currentTarget.style.background=bright?"rgba(160,122,255,0.25)":"transparent"; e.currentTarget.style.color=bright?"#c4a0ff":"#6858a8"; }}
    >{children}</button>
  );
}

function renderWithArtifacts(text, onOpenArtifact, artifactStore) {
  if (!text) return null;
  const ARTIFACT_RE = /\[\[ARTIFACT:(\w+):([^\]]+)\]\]/;
  const parts = text.split(/(\[\[ARTIFACT:[^\]]+\]\])/g);
  if (parts.length === 1) return <span dangerouslySetInnerHTML={{ __html: renderMd(text) }} />;
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(ARTIFACT_RE);
        if (m) {
          const [, lang, label] = m;
          const stored = artifactStore && artifactStore[label];
          return (
            <div key={i} onClick={() => { if (onOpenArtifact && stored) onOpenArtifact(stored); }}
              style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"8px 14px", margin:"6px 0", borderRadius:"10px", background:"rgba(160,122,255,0.12)", border:"1px solid rgba(160,122,255,0.3)", cursor: stored ? "pointer" : "default", userSelect:"none", transition:"all 0.15s" }}
              onMouseEnter={e => { if(stored) e.currentTarget.style.background="rgba(160,122,255,0.22)"; }}
              onMouseLeave={e => { e.currentTarget.style.background="rgba(160,122,255,0.12)"; }}
            >
              <span style={{ fontSize:"13px" }}>{lang==="html"?"⬡":lang==="svg"?"◈":lang==="csv"?"⊞":"⟨⟩"}</span>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color:"#c4a0ff", letterSpacing:"0.06em" }}>{label}</span>
              {stored
                ? <span style={{ fontSize:"11px", color:"#8060c0" }}>view ↗</span>
                : <span style={{ fontSize:"10px", color:"#5040a0" }}>···</span>
              }
            </div>
          );
        }
        return part ? <span key={i} dangerouslySetInnerHTML={{ __html: renderMd(part) }} /> : null;
      })}
    </>
  );
}

function Message({ msg, onSeal, onEdit, editing, editText, onEditText, onEditSubmit, onEditCancel, onOpenArtifact, artifactStore }) {
  const [hover, setHover]   = useState(false);
  const [copied, setCopied] = useState(false);
  const [sealed, setSealed] = useState(false);
  const isUser = msg.role === "user";

  if (isUser && editing) {
    return (
      <div style={{ display:"flex", justifyContent:"flex-end", padding:"4px 32px 8px", gap:"8px" }}>
        <div style={{ maxWidth:"75%", width:"100%" }}>
          <textarea value={editText} onChange={e => onEditText(e.target.value)} autoFocus
            style={{ width:"100%", padding:"12px 16px", borderRadius:"14px 14px 4px 14px", background:"rgba(120,80,200,0.18)", border:"1px solid rgba(160,122,255,0.6)", color:"#f0ecff", fontFamily:"'IBM Plex Sans',sans-serif", fontSize:"15px", lineHeight:"1.55", resize:"none", outline:"none", caretColor:"#c4a0ff", minHeight:"60px" }}
            onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();onEditSubmit();} if(e.key==="Escape")onEditCancel(); }}
          />
          <div style={{ display:"flex", gap:"8px", marginTop:"6px", justifyContent:"flex-end" }}>
            <button onClick={onEditCancel} style={{ padding:"5px 14px", borderRadius:"7px", background:"transparent", border:"1px solid rgba(160,122,255,0.2)", color:"#7868a0", cursor:"pointer", fontSize:"12px" }}>Cancel</button>
            <button onClick={onEditSubmit} style={{ padding:"5px 14px", borderRadius:"7px", background:"rgba(160,122,255,0.25)", border:"1px solid rgba(160,122,255,0.4)", color:"#c4a0ff", cursor:"pointer", fontSize:"12px" }}>Re-send</button>
          </div>
        </div>
      </div>
    );
  }

  async function copy() { await navigator.clipboard?.writeText(msg.content); setCopied(true); setTimeout(()=>setCopied(false),1500); }
  async function seal() { await onSeal(); setSealed(true); setTimeout(()=>setSealed(false),2000); }

  if (isUser) return (
    <div style={{ padding:"6px 28px", display:"flex", justifyContent:"flex-end" }}>
      <div style={{ maxWidth:"70%", padding:"13px 18px", borderRadius:"18px 18px 4px 18px", background:"rgba(160,122,255,0.18)", border:"1px solid rgba(160,122,255,0.3)", color:"#f0ecff", fontSize:"15px", lineHeight:"1.65", fontFamily:"'IBM Plex Sans',sans-serif" }}>
        {msg.image && <img src={msg.image} alt="" style={{ maxHeight:"160px", borderRadius:"6px", marginBottom:"8px", display:"block" }} />}
        <span style={{ whiteSpace:"pre-wrap" }}>{msg.content}</span>
      </div>
    </div>
  );

  return (
    <div style={{ padding:"6px 28px", display:"flex", gap:"14px", alignItems:"flex-start" }}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
      <div style={{ flexShrink:0, marginTop:"2px" }}>
        <LogosSigil size={26} state={msg.streaming?"speaking":"idle"} animated={!!msg.streaming} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        {msg.member && !msg.streaming && (
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px" }}>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color:"#d4a820", letterSpacing:"0.15em", textTransform:"uppercase" }}>Logos</span>
            <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color:"#5850a0" }}>
              via {msg.member==="pneuma"?"Pneuma":msg.member==="techne"?"Techne":msg.member==="opsis"?"Opsis":msg.member==="council"?"Full Council":msg.member==="memory"?"Memory Vault":"Logos"}
            </span>
            {msg.totalMs > 0 && (
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color:"#4840a0", marginLeft:"4px" }}>
                {msg.totalMs >= 60000
                  ? `${Math.floor(msg.totalMs/60000)}m ${Math.floor((msg.totalMs%60000)/1000)}s`
                  : `${(msg.totalMs/1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        )}
        {msg.error
          ? <p style={{ color:"#ff9090", fontFamily:"'IBM Plex Mono',monospace", fontSize:"13px", lineHeight:"1.7", padding:"12px 16px", background:"rgba(220,50,50,0.08)", border:"1px solid rgba(220,50,50,0.2)", borderRadius:"8px" }}>{msg.content}</p>
          : <div className={`logos-prose${msg.streaming?" stream-cursor":""}`}>
              {renderWithArtifacts(msg.content, onOpenArtifact, artifactStore)}
            </div>
        }
        {msg.streaming && <StreamingStatus startedAt={msg.startedAt} member={msg.member} hasContent={!!msg.content} />}
        {!msg.streaming && hover && !msg.error && (
          <div style={{ display:"flex", gap:"6px", marginTop:"10px" }}>
            {isUser && <ABtn onClick={() => onEdit?.()} label="Edit" />}
            <ABtn onClick={seal}  label={sealed?"Sealed ✦":"Seal"}  gold={sealed} />
            <ABtn onClick={copy}  label={copied?"Copied ✓":"Copy"} />
          </div>
        )}
      </div>
    </div>
  );
}

const ETA = {
  pneuma_cold:[45,12], pneuma_warm:[2,8],
  techne_cold:[50,18], techne_warm:[2,14],
  logos_cold:[45,10],  logos_warm:[2,10],
};

function StreamingStatus({ startedAt, member, hasContent }) {
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now()-(startedAt||Date.now()))/1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const key = member||"logos";
  const isLoading = !hasContent && elapsed > 3;
  const etaKey = isLoading ? `${key}_cold` : `${key}_warm`;
  const [loadTime] = ETA[etaKey]||ETA["logos_warm"];
  const pct = isLoading ? Math.min(95, Math.round((elapsed/loadTime)*100)) : null;
  const phase = isLoading ? "Loading model" : hasContent ? "Generating" : "Thinking";
  const eta = isLoading ? (Math.max(0,loadTime-elapsed) > 0 ? `~${Math.max(0,loadTime-elapsed)}s` : "almost ready…") : null;
  const fmtElapsed = elapsed >= 60 ? `${Math.floor(elapsed/60)}m ${elapsed%60}s` : `${elapsed}s`;

  return (
    <div style={{ marginTop:"12px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom: isLoading?"8px":"0" }}>
        <div style={{ display:"flex", gap:"4px" }}>
          {[0,1,2].map(i=>(
            <div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%", background:"rgba(160,122,255,0.7)", animation:`thinkPulse 1.2s ease-in-out ${i*0.22}s infinite` }} />
          ))}
        </div>
        <span style={{ fontSize:"11px", color:"#7060b0", fontFamily:"'IBM Plex Mono',monospace" }}>{phase}</span>
        <span style={{ fontSize:"11px", color:"#5048a0", fontFamily:"'IBM Plex Mono',monospace", marginLeft:"auto" }}>
          {fmtElapsed}{eta && <span style={{ color:"#6050a0" }}> · {eta}</span>}
        </span>
      </div>
      {isLoading && (
        <div>
          <div style={{ height:"2px", background:"rgba(160,122,255,0.12)", borderRadius:"1px", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg, #6040c0, #a07aff)", borderRadius:"1px", transition:"width 1s linear", boxShadow:"0 0 8px rgba(160,122,255,0.4)" }} />
          </div>
          <p style={{ fontSize:"10px", color:"#5048a0", fontFamily:"'IBM Plex Mono',monospace", marginTop:"5px" }}>
            {elapsed < 5 ? "Loading model into GPU memory. Subsequent responses are instant."
              : elapsed < 20 ? "Large models take 30–60s on first load. Worth the wait."
              : elapsed < 45 ? "Almost ready. Logos will be fast for the rest of this session."
              : "Still loading — model is large. This only happens once per session."}
          </p>
        </div>
      )}
    </div>
  );
}

function ABtn({ onClick, label, gold }) {
  return (
    <button onClick={onClick}
      style={{ padding:"4px 12px", borderRadius:"6px", fontSize:"11px", fontFamily:"'IBM Plex Mono',monospace", background:"transparent", border:"1px solid rgba(160,122,255,0.2)", color: gold?"#f0c040":"#8878c0", cursor:"pointer", transition:"all 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.color="#c4a0ff"; e.currentTarget.style.borderColor="rgba(160,122,255,0.4)"; }}
      onMouseLeave={e => { e.currentTarget.style.color=gold?"#f0c040":"#8878c0"; e.currentTarget.style.borderColor="rgba(160,122,255,0.2)"; }}
    >{label}</button>
  );
}

function Welcome() {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"65vh", gap:"22px", padding:"40px" }}>
      <div style={{ animation:"breathe 4s ease-in-out infinite" }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <circle cx="40" cy="40" r="37" stroke="rgba(200,180,255,0.4)" strokeWidth="1.2"/>
          <circle cx="40" cy="40" r="28" stroke="rgba(160,122,255,0.2)" strokeWidth="0.7" strokeDasharray="3 5"/>
          <polygon points="40,11 63,53 17,53" fill="none" stroke="rgba(160,122,255,0.85)" strokeWidth="1.4"/>
          <polygon points="40,69 17,27 63,27" fill="none" stroke="rgba(160,122,255,0.5)" strokeWidth="1.1"/>
          <circle cx="40" cy="40" r="5" fill="rgba(240,192,64,1)"/>
        </svg>
      </div>
      <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:"32px", letterSpacing:"0.2em", color:"#f0c040", margin:0 }}>LOGOS</h1>
      <p style={{ color:"#9888c8", fontSize:"16px", textAlign:"center", lineHeight:"1.8", maxWidth:"360px" }}>
        The Trilateral Council awaits your word.<br/>
        Pneuma reasons. Techne builds. Opsis sees.
      </p>
      <div style={{ display:"flex", gap:"14px", marginTop:"8px" }}>
        {[["✦","Explain anything","#b090ff"],["⟨⟩","Build with code","#f0c040"],["◉","Analyze images","#50c8e8"]].map(([g,l,c]) => (
          <div key={l} style={{ padding:"16px 18px", borderRadius:"12px", border:"1px solid rgba(160,122,255,0.18)", background:"rgba(160,122,255,0.06)", display:"flex", flexDirection:"column", alignItems:"center", gap:"9px", minWidth:"120px" }}>
            <span style={{ fontSize:"22px", color:c }}>{g}</span>
            <span style={{ fontSize:"12px", color:"#7868a8", textAlign:"center" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
