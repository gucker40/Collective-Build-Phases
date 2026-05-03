import React, { useState, useRef, useEffect, useCallback } from 'react';
import LogosSigil from './LogosSigil.jsx';
import { colors, fonts, radius } from '../theme/tokens.js';
import { useUIStore } from '../store/ui.js';
import { useAuthStore } from '../store/auth.js';
import { api, BASE } from '../api/index.js';

// ── Markdown renderer ─────────────────────────────────────────────────────────
function renderMd(text) {
  if (!text) return '';
  let html = '', inCode = false, codeLang = '', codeBuf = '', inList = false, listType = '';
  const close = () => { if (inList) { html += listType === 'ul' ? '</ul>' : '</ol>'; inList = false; } };
  const esc   = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const fmt   = s => esc(s)
    .replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank">$1</a>');
  for (const line of text.split('\n')) {
    if (line.startsWith('```')) {
      if (!inCode) { close(); inCode = true; codeLang = line.slice(3).trim() || 'text'; codeBuf = ''; }
      else { html += `<pre><code class="lang-${codeLang}">${esc(codeBuf)}</code></pre>`; inCode = false; }
      continue;
    }
    if (inCode) { codeBuf += (codeBuf ? '\n' : '') + line; continue; }
    const h3=line.match(/^### (.+)/), h2=line.match(/^## (.+)/), h1=line.match(/^# (.+)/);
    if (h3) { close(); html += `<h3>${fmt(h3[1])}</h3>`; continue; }
    if (h2) { close(); html += `<h2>${fmt(h2[1])}</h2>`; continue; }
    if (h1) { close(); html += `<h1>${fmt(h1[1])}</h1>`; continue; }
    if (line.match(/^---+$/)) { close(); html += '<hr/>'; continue; }
    const bul = line.match(/^[-*+] (.+)/);
    if (bul) { if (!inList||listType!=='ul'){if(inList)html+=listType==='ul'?'</ul>':'</ol>';html+='<ul>';inList=true;listType='ul';} html+=`<li>${fmt(bul[1])}</li>`; continue; }
    const num = line.match(/^\d+\. (.+)/);
    if (num) { if (!inList||listType!=='ol'){if(inList)html+=listType==='ul'?'</ul>':'</ol>';html+='<ol>';inList=true;listType='ol';} html+=`<li>${fmt(num[1])}</li>`; continue; }
    if (inList && line.trim()) close();
    if (!line.trim()) { close(); html += '<br/>'; continue; }
    html += `<p>${fmt(line)}</p>`;
  }
  close();
  return html;
}

const LANG_PRIORITY = ['html','svg','jsx','tsx','js','ts','css','py','python','sql','bash','sh','json','md','csv'];

function extractBlocks(text) {
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push({ lang: (m[1]||'text').toLowerCase(), code: m[2]||'' });
  return out;
}

function bestBlock(blocks) {
  if (!blocks.length) return null;
  return blocks.reduce((a, b) => {
    const ai = LANG_PRIORITY.indexOf(a.lang), bi = LANG_PRIORITY.indexOf(b.lang);
    if (ai !== bi) return (ai>=0?ai:999) < (bi>=0?bi:999) ? a : b;
    return b.code.length > a.code.length ? b : a;
  });
}

function smartTitle(lang, code, prompt='') {
  if (lang !== 'html' && lang !== 'svg') {
    const m={py:'Python Script',python:'Python Script',sql:'SQL Query',bash:'Shell Script',sh:'Shell Script',js:'JS Script',ts:'TypeScript',jsx:'Component',tsx:'Component',css:'Stylesheet',json:'JSON',md:'Document',csv:'Data Table'};
    return m[lang] || (lang.toUpperCase()+' File');
  }
  const t = code.match(/<title[^>]*>([^<]{2,60})<\/title>/i);
  if (t) return t[1].trim().slice(0,40);
  const h = code.match(/<h[12][^>]*>([^<]{2,60})<\/h[12]>/i);
  if (h) return h[1].replace(/<[^>]+>/g,'').trim().slice(0,40);
  const stop = new Set(['a','an','the','make','me','some','few','create','build','write','please','can','you','i','want','need','generate','give','show','just','my','for','with','and','or','to','in','on']);
  const words = (prompt||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!stop.has(w));
  if (words.length>=2) return words.slice(0,3).map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');
  return 'Web App';
}

function buildDisplay(raw, blocks, prompt) {
  if (!blocks.length) return raw;
  return raw.replace(/```(\w+)?\n[\s\S]*?```/g, (_,lang) => {
    const l = (lang||'text').toLowerCase();
    const b = blocks.find(x=>x.lang===l)||blocks[0];
    return `\n[[ART:${l}:${smartTitle(l,b?.code||'',prompt)}]]\n`;
  });
}

// ── Welcome screen ────────────────────────────────────────────────────────────
function Welcome() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      minHeight:'65vh', gap:'22px', padding:'40px' }}>
      <div style={{ animation:'breathe 4s ease-in-out infinite' }}>
        <LogosSigil size={80} state="idle" animated />
      </div>
      <h1 style={{ fontFamily:fonts.heading, fontSize:'32px', letterSpacing:'0.2em', color:colors.gold, margin:0 }}>LOGOS</h1>
      <p style={{ color:colors.muted, fontSize:'15px', textAlign:'center', lineHeight:'1.8', maxWidth:'340px' }}>
        The Trilateral Council awaits your word.<br/>Pneuma reasons. Techne builds. Opsis sees.
      </p>
      <div style={{ display:'flex', gap:'14px', marginTop:'8px' }}>
        {[['✦','Explain anything','#b090ff'],['⟨⟩','Build artifacts','#f0c040'],['◉','Analyze images','#50c8e8']].map(([g,l,c])=>(
          <div key={l} style={{ padding:'16px 18px', borderRadius:radius.md, border:`1px solid ${colors.border}`,
            background:colors.purpleLo, display:'flex', flexDirection:'column', alignItems:'center', gap:'9px', minWidth:'110px' }}>
            <span style={{ fontSize:'22px', color:c }}>{g}</span>
            <span style={{ fontSize:'11px', color:colors.muted, textAlign:'center' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ChatPanel ────────────────────────────────────────────────────────────
export default function ChatPanel({ loadedSession }) {
  const { openArtifact, notify, refreshHistory, activeSession } = useUIStore();
  const { token } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sigil, setSigil]       = useState('idle');
  const [backendOk, setBackendOk] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImgPrev] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const artifactStore = useRef({});
  const intentRef     = useRef('explain');
  const bottomRef     = useRef(null);
  const inputRef      = useRef(null);
  const abortRef      = useRef(null);
  const fileRef       = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    fetch(`${BASE}/health`, { signal: AbortSignal.timeout(4000) })
      .then(r => setBackendOk(r.ok)).catch(() => setBackendOk(false));
  }, []);

  useEffect(() => {
    if (!loadedSession?.id) return;
    api.history.load(loadedSession.id)
      .then(d => { setMessages(d.messages||[]); setSessionId(d.id); })
      .catch(() => {});
  }, [loadedSession]);

  const autoSave = useCallback(async (msgs, sid) => {
    if (msgs.length < 2) return sid;
    try {
      const d = await api.history.save({ session_id: sid||undefined, messages: msgs });
      if (d.id && !sid) setSessionId(d.id);
      refreshHistory();
      return d.id;
    } catch { return sid; }
  }, [refreshHistory]);

  async function handleSubmit(e) {
    e?.preventDefault();
    if ((!input.trim() && !imageFile) || streaming) return;
    const text = input.trim();
    setInput('');
    if (imageFile) { await handleVision(text || 'Describe this image.'); return; }
    await sendMessage(text);
  }

  async function handleVision(prompt) {
    const userMsg = { role:'user', content:prompt, image:imagePreview, id:Date.now() };
    setMessages(p => [...p, userMsg]);
    setImageFile(null); setImgPrev(null);
    setSigil('thinking'); setStreaming(true);
    try {
      const fd = new FormData(); fd.append('file', imageFile); fd.append('prompt', prompt);
      const r = await fetch(`${BASE}/logos/vision`, { method:'POST', body:fd });
      const d = await r.json();
      const msgs = [...messages, userMsg, { role:'assistant', content:d.analysis, id:Date.now()+1, member:'opsis' }];
      setMessages(msgs); autoSave(msgs, sessionId);
    } catch (err) {
      setMessages(p => [...p, { role:'assistant', content:`Vision failed: ${err.message}`, id:Date.now()+1, error:true }]);
    }
    setSigil('idle'); setStreaming(false);
  }

  async function sendMessage(text, baseMsgs) {
    const userMsg = { role:'user', content:text, id:Date.now() };
    const asstId  = Date.now()+1;
    const base    = baseMsgs || messages;
    const newMsgs = [...base, userMsg];

    // Detect intent first
    let intent = 'explain';
    try {
      const d = await api.logos.intent(text);
      intent = d.intent || 'explain';
    } catch {}
    intentRef.current = intent;

    setMessages([...newMsgs, { role:'assistant', content:'', id:asstId, streaming:true, member:'logos', startedAt:Date.now() }]);
    setSigil('thinking'); setStreaming(true);

    const history = newMsgs.slice(-12).map(m => ({
      role: m.role,
      content: typeof m.content==='string' && m.content.length>2000 ? m.content.slice(0,2000)+'…' : (m.content||''),
    }));

    try {
      const ctrl = new AbortController(); abortRef.current = ctrl;
      const res  = await api.logos.stream({ messages: history, intent, memory_enabled: true });
      if (!res.ok) throw new Error(`Backend ${res.status}`);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let full = '', done = false;
      setSigil('speaking');

      while (!done) {
        const { done: sd, value } = await reader.read();
        if (sd) break;
        for (const line of dec.decode(value, { stream:true }).split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'content') {
              full += ev.content;
              const blocks  = extractBlocks(full);
              const display = buildDisplay(full, blocks, text);
              setMessages(p => p.map(m => m.id===asstId ? {...m, content:display, _raw:full, streaming:true} : m));
            } else if (ev.type === 'done') {
              done = true;
              const allBlocks = extractBlocks(full);
              const best      = bestBlock(allBlocks);
              const isBuild   = intentRef.current === 'build';
              const hasHtml   = allBlocks.some(b=>b.lang==='html'||b.lang==='svg');
              if (best && (isBuild || (hasHtml && best.code.length>200))) {
                const title = smartTitle(best.lang, best.code, text);
                const art   = { type:'code', language:best.lang, content:best.code, title };
                artifactStore.current[title] = art;
                openArtifact(art);
              }
              for (const b of allBlocks) {
                if (b.code.trim().length>80) {
                  const t = smartTitle(b.lang, b.code, text);
                  artifactStore.current[t] = { type:'code', language:b.lang, content:b.code, title:t };
                  api.artifacts.save({ title:t, language:b.lang, content:b.code }).catch(()=>{});
                }
              }
              const display = buildDisplay(full, allBlocks, text);
              const finalMsgs = [...newMsgs, { role:'assistant', content:display, id:asstId, streaming:false, member:ev.member }];
              setMessages(finalMsgs);
              autoSave(finalMsgs, sessionId);
              setBackendOk(true);
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name==='AbortError') { setSigil('idle'); setStreaming(false); return; }
      setMessages(p => p.map(m => m.id===asstId ? {...m, content:err.message, streaming:false, error:true} : m));
      setBackendOk(false);
    }
    setSigil('idle'); setStreaming(false);
  }

  async function sealMessage(content) {
    try {
      await api.memory.seal({ text:content, type:'Conversation' });
      notify('Sealed to memory ✦');
    } catch { notify('Seal failed','error'); }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', position:'relative' }}>
      {backendOk===false && (
        <div style={{ padding:'8px 20px', background:'rgba(220,50,50,0.1)', borderBottom:'1px solid rgba(220,50,50,0.2)',
          display:'flex', alignItems:'center', gap:'10px', flexShrink:0 }}>
          <span style={{ fontSize:'12px', color:'#ff9090', fontFamily:fonts.mono }}>
            Backend offline — check that Python is running
          </span>
          <button onClick={() => fetch(`${BASE}/health`).then(()=>setBackendOk(true)).catch(()=>{})}
            style={{ marginLeft:'auto', padding:'4px 10px', fontSize:'11px', color:'#ff9090',
              background:'transparent', border:'1px solid rgba(220,50,50,0.3)', borderRadius:'6px', cursor:'pointer' }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto', padding:'28px 0 12px' }}>
        {messages.length===0 && <Welcome />}
        {messages.map((msg,i) => (
          <MessageRow key={msg.id||i} msg={msg}
            onSeal={() => sealMessage(msg.content)}
            onOpenArtifact={openArtifact}
            artifactStore={artifactStore.current}
          />
        ))}
        <div ref={bottomRef} style={{ height:'8px' }} />
      </div>

      <div style={{ flexShrink:0, padding:'12px 24px 18px', borderTop:`1px solid ${colors.border}` }}>
        {imagePreview && (
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
            <img src={imagePreview} alt="" style={{ height:'48px', width:'48px', objectFit:'cover', borderRadius:'6px', border:`1px solid ${colors.border}` }} />
            <span style={{ fontSize:'12px', color:colors.muted }}>{imageFile?.name}</span>
            <button onClick={()=>{setImageFile(null);setImgPrev(null);}} style={{ marginLeft:'auto', background:'transparent', border:'none', color:colors.muted, cursor:'pointer', fontSize:'16px' }}>✕</button>
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display:'flex', alignItems:'flex-end', gap:'12px' }}>
          <div style={{ flexShrink:0, width:'30px', height:'30px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'9px' }}>
            <LogosSigil size={28} state={sigil} animated />
          </div>
          <div style={{ flex:1, position:'relative', borderRadius:'14px', background:'rgba(8,8,18,0.9)',
            border: streaming ? `1px solid rgba(160,122,255,0.5)` : `1px solid ${colors.border}`,
            transition:'border-color 0.2s, box-shadow 0.2s',
            boxShadow: streaming ? '0 0 28px rgba(160,122,255,0.14)' : 'none' }}>
            <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} disabled={streaming}
              placeholder="Speak to Logos" rows={1} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSubmit();}}}
              style={{ width:'100%', background:'transparent', border:'none', outline:'none', resize:'none',
                padding:'14px 58px 14px 18px', color:colors.text, fontFamily:fonts.body, fontSize:'15px',
                lineHeight:'1.55', maxHeight:'180px', minHeight:'50px', caretColor:colors.purpleHi }}
              onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,180)+'px';}}
            />
            <div style={{ position:'absolute', right:'8px', bottom:'9px', display:'flex', gap:'4px' }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
                onChange={e=>{const f=e.target.files[0];if(!f)return;setImageFile(f);const r=new FileReader();r.onload=ev=>setImgPrev(ev.target.result);r.readAsDataURL(f);}} />
              <IBtn onClick={()=>fileRef.current?.click()} title="Attach image">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/><circle cx="4" cy="4" r="1" fill="currentColor"/><path d="M1 9.5l3-3 2.5 2.5 2-2 3 3" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
              </IBtn>
              {streaming
                ? <IBtn onClick={()=>abortRef.current?.abort()} title="Stop" bright>
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1.5" y="1.5" width="8" height="8" rx="1.5" fill="currentColor"/></svg>
                  </IBtn>
                : <IBtn onClick={handleSubmit} title="Send" bright={!!(input.trim()||imageFile)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M12.5 7L1.5 1.5 4 7l-2.5 5.5L12.5 7z" fill="currentColor"/></svg>
                  </IBtn>
              }
            </div>
          </div>
        </form>
        <p style={{ textAlign:'center', marginTop:'8px', fontSize:'10px', color:colors.dim, fontFamily:fonts.mono }}>
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}

function IBtn({ onClick, title, bright, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      width:'32px', height:'32px', borderRadius:'8px', display:'flex', alignItems:'center',
      justifyContent:'center', cursor:'pointer', transition:'all 0.15s',
      background: bright ? 'rgba(160,122,255,0.25)' : 'transparent',
      border: bright ? '1px solid rgba(160,122,255,0.4)' : '1px solid transparent',
      color: bright ? colors.purpleHi : colors.dim,
    }}
    onMouseEnter={e=>{e.currentTarget.style.background='rgba(160,122,255,0.22)';e.currentTarget.style.color=colors.purpleHi;}}
    onMouseLeave={e=>{e.currentTarget.style.background=bright?'rgba(160,122,255,0.25)':'transparent';e.currentTarget.style.color=bright?colors.purpleHi:colors.dim;}}
    >{children}</button>
  );
}

function ArtBadge({ lang, label, stored, onOpen }) {
  return (
    <div onClick={()=>stored&&onOpen(stored)}
      style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'8px 14px', margin:'6px 0',
        borderRadius:'10px', background:'rgba(160,122,255,0.1)', border:`1px solid ${colors.border}`,
        cursor:stored?'pointer':'default', userSelect:'none', transition:'all 0.15s' }}
      onMouseEnter={e=>{if(stored)e.currentTarget.style.background='rgba(160,122,255,0.2)';}}
      onMouseLeave={e=>{e.currentTarget.style.background='rgba(160,122,255,0.1)';}}>
      <span style={{ fontSize:'13px' }}>{lang==='html'?'⬡':lang==='svg'?'◈':'⟨⟩'}</span>
      <span style={{ fontFamily:fonts.heading, fontSize:'11px', color:colors.purpleHi, letterSpacing:'0.06em' }}>{label}</span>
      {stored ? <span style={{ fontSize:'11px', color:colors.dim }}>view ↗</span>
               : <span style={{ fontSize:'10px', color:colors.dim }}>···</span>}
    </div>
  );
}

function renderWithArtifacts(text, onOpen, store) {
  if (!text) return null;
  const parts = text.split(/(\[\[ART:[^\]]+\]\])/g);
  if (parts.length===1) return <span dangerouslySetInnerHTML={{ __html: renderMd(text) }} />;
  return (
    <>
      {parts.map((part,i) => {
        const m = part.match(/\[\[ART:(\w+):([^\]]+)\]\]/);
        if (m) {
          const [,lang,label] = m;
          return <ArtBadge key={i} lang={lang} label={label} stored={store&&store[label]} onOpen={onOpen} />;
        }
        return part ? <span key={i} dangerouslySetInnerHTML={{ __html: renderMd(part) }} /> : null;
      })}
    </>
  );
}

function MessageRow({ msg, onSeal, onOpenArtifact, artifactStore }) {
  const [hover, setHover]   = useState(false);
  const [copied, setCopied] = useState(false);
  const [sealed, setSealed] = useState(false);
  const isUser = msg.role==='user';

  if (isUser) return (
    <div style={{ padding:'6px 28px', display:'flex', justifyContent:'flex-end' }}>
      <div style={{ maxWidth:'70%', padding:'13px 18px', borderRadius:'18px 18px 4px 18px',
        background:'rgba(160,122,255,0.18)', border:`1px solid rgba(160,122,255,0.3)`,
        color:colors.text, fontSize:'15px', lineHeight:'1.65', fontFamily:fonts.body }}>
        {msg.image && <img src={msg.image} alt="" style={{ maxHeight:'150px', borderRadius:'6px', marginBottom:'8px', display:'block' }} />}
        <span style={{ whiteSpace:'pre-wrap' }}>{msg.content}</span>
      </div>
    </div>
  );

  return (
    <div style={{ padding:'6px 28px', display:'flex', gap:'14px', alignItems:'flex-start' }}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>
      <div style={{ flexShrink:0, marginTop:'2px' }}>
        <LogosSigil size={26} state={msg.streaming?'speaking':'idle'} animated={!!msg.streaming} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        {msg.member && !msg.streaming && (
          <div style={{ display:'flex', gap:'8px', marginBottom:'8px', alignItems:'center' }}>
            <span style={{ fontFamily:fonts.heading, fontSize:'11px', color:colors.gold, letterSpacing:'0.15em' }}>Logos</span>
            <span style={{ fontFamily:fonts.mono, fontSize:'10px', color:colors.dim }}>
              via {msg.member==='pneuma'?'Pneuma':msg.member==='techne'?'Techne':msg.member==='opsis'?'Opsis':msg.member==='memory'?'Memory':'Logos'}
            </span>
          </div>
        )}
        {msg.error
          ? <p style={{ color:'#ff9090', fontFamily:fonts.mono, fontSize:'13px', lineHeight:'1.7',
              padding:'12px 16px', background:'rgba(220,50,50,0.08)', border:'1px solid rgba(220,50,50,0.2)',
              borderRadius:'8px' }}>{msg.content}</p>
          : <div className={`logos-prose${msg.streaming?' stream-cursor':''}`}>
              {renderWithArtifacts(msg.content, onOpenArtifact, artifactStore)}
            </div>
        }
        {msg.streaming && <StreamDots />}
        {!msg.streaming && hover && !msg.error && (
          <div style={{ display:'flex', gap:'6px', marginTop:'10px' }}>
            <ABtn onClick={async()=>{await navigator.clipboard?.writeText(msg.content);setCopied(true);setTimeout(()=>setCopied(false),1500);}} label={copied?'Copied ✓':'Copy'} />
            <ABtn onClick={async()=>{await onSeal();setSealed(true);setTimeout(()=>setSealed(false),2000);}} label={sealed?'Sealed ✦':'Seal'} gold={sealed} />
          </div>
        )}
      </div>
    </div>
  );
}

function StreamDots() {
  return (
    <div style={{ display:'flex', gap:'4px', marginTop:'12px', alignItems:'center' }}>
      {[0,1,2].map(i=>(
        <div key={i} style={{ width:'6px', height:'6px', borderRadius:'50%', background:'rgba(160,122,255,0.7)',
          animation:`thinkPulse 1.2s ease-in-out ${i*0.22}s infinite` }} />
      ))}
      <span style={{ fontSize:'11px', color:colors.dim, fontFamily:fonts.mono, marginLeft:'8px' }}>Thinking…</span>
    </div>
  );
}

function ABtn({ onClick, label, gold }) {
  return (
    <button onClick={onClick} style={{ padding:'4px 12px', borderRadius:'6px', fontSize:'11px',
      fontFamily:fonts.mono, background:'transparent', border:`1px solid ${colors.border}`,
      color:gold?colors.gold:colors.muted, cursor:'pointer', transition:'all 0.15s' }}
    onMouseEnter={e=>{e.currentTarget.style.color=colors.purpleHi;e.currentTarget.style.borderColor='rgba(160,122,255,0.4)';}}
    onMouseLeave={e=>{e.currentTarget.style.color=gold?colors.gold:colors.muted;e.currentTarget.style.borderColor=colors.border;}}
    >{label}</button>
  );
}
