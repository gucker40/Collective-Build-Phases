import React, { useState, useEffect, useCallback, useRef } from "react";

import { API } from "../api.js";
import { useLayout } from "../useLayout.js";

// Same rule-based title logic as history.py  instant, no model call
function generateTitle(content) {
  if (!content || !content.trim()) return "Untitled Note";
  const firstLine = content.split("\n").find(l => l.trim());
  if (!firstLine) return "Untitled Note";

  // Strip markdown heading markers
  let text = firstLine.replace(/^#+\s*/, "").trim();
  if (!text) return "Untitled Note";

  const stop = new Set(["a","an","the","is","are","was","be","have","do","will",
    "i","my","me","we","you","it","this","that","what","how","why","when",
    "please","help","make","create","write","tell","show","get","need"]);

  const words = text.split(/\s+/).filter(Boolean);
  const meaningful = words
    .map(w => w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase())
    .filter(w => w.length > 2 && !stop.has(w));

  if (!meaningful.length) return words.slice(0, 4).join(" ").slice(0, 40) || "Untitled Note";
  const titleWords = words.filter(w => {
    const clean = w.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    return clean.length > 2 && !stop.has(clean);
  }).slice(0, 4);

  return titleWords.join(" ").slice(0, 45) || "Untitled Note";
}

export default function VaultEditor({ onNotify }) {
  const [files, setFiles]         = useState([]);
  const [activeFile, setActive]   = useState(null);
  const [content, setContent]     = useState("");
  const [unsaved, setUnsaved]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [showNew, setShowNew]     = useState(false);
  const [newName, setNewName]     = useState("");
  const saveTimer                 = useRef(null);
  const textareaRef               = useRef(null);

  const loadFiles = useCallback(async () => {
    try {
      const r = await fetch(`${API}/vault/files`);
      const d = await r.json();
      setFiles(d.files || []);
    } catch { setFiles([]); }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  async function openFile(filename) {
    try {
      const r = await fetch(`${API}/vault/load?filename=${encodeURIComponent(filename)}`);
      const d = await r.json();
      setActive(filename);
      setContent(d.content || "");
      setUnsaved(false);
    } catch { onNotify?.("Failed to open file", "error"); }
  }

  function handleContentChange(val) {
    setContent(val);
    setUnsaved(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveFile(val), 1500);
  }

  async function saveFile(text = content) {
    if (!activeFile) return;
    setSaving(true);
    try {
      // Auto-update filename based on content title if file is "Untitled"
      let targetFile = activeFile;
      if (activeFile.startsWith("Untitled") || activeFile.startsWith("untitled")) {
        const newTitle = generateTitle(text);
        const newFilename = newTitle
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .toLowerCase() + ".md";
        if (newFilename !== activeFile && newTitle !== "Untitled Note") {
          // Save under new name, delete old
          await fetch(`${API}/vault/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: newFilename, content: text }),
          });
          await fetch(`${API}/vault/delete?filename=${encodeURIComponent(activeFile)}`, { method: "DELETE" });
          setActive(newFilename);
          await loadFiles();
          setSaving(false);
          setUnsaved(false);
          return;
        }
      }
      await fetch(`${API}/vault/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: targetFile, content: text }),
      });
      setUnsaved(false);
    } catch { onNotify?.("Save failed", "error"); }
    setSaving(false);
  }

  async function createNewFile() {
    // Create with placeholder name  will auto-rename when content is added
    const placeholder = `untitled-${Date.now()}.md`;
    try {
      await fetch(`${API}/vault/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: placeholder, content: "" }),
      });
      await loadFiles();
      await openFile(placeholder);
      setShowNew(false);
      setNewName("");
      // Focus textarea
      setTimeout(() => textareaRef.current?.focus(), 100);
    } catch { onNotify?.("Failed to create file", "error"); }
  }

  async function deleteFile(filename, e) {
    e.stopPropagation();
    try {
      await fetch(`${API}/vault/delete?filename=${encodeURIComponent(filename)}`, { method: "DELETE" });
      if (activeFile === filename) { setActive(null); setContent(""); }
      await loadFiles();
    } catch { onNotify?.("Failed to delete", "error"); }
  }

  function handleKey(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      clearTimeout(saveTimer.current);
      saveFile();
    }
  }

  const displayName = (f) => f.replace(/\.md$/, "").replace(/-/g, " ").replace(/^untitled-\d+$/, "New note");

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      {/* File list */}
      <div style={{ width:"220px", flexShrink:0, background:"rgba(5,5,10,0.7)", borderRight:"1px solid rgba(160,122,255,0.12)", display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"16px 14px 12px", borderBottom:"1px solid rgba(160,122,255,0.1)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color:"#d4a820", letterSpacing:"0.2em", textTransform:"uppercase" }}>Vault</span>
          <button onClick={createNewFile}
            style={{ width:"26px", height:"26px", borderRadius:"7px", background:"rgba(160,122,255,0.18)", border:"1px solid rgba(160,122,255,0.35)", color:"#c4a0ff", cursor:"pointer", fontSize:"16px", display:"flex", alignItems:"center", justifyContent:"center" }}
            title="New note"
            onMouseEnter={e => e.currentTarget.style.background="rgba(160,122,255,0.3)"}
            onMouseLeave={e => e.currentTarget.style.background="rgba(160,122,255,0.18)"}
          >+</button>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"6px" }}>
          {files.length === 0 && (
            <p style={{ color:"#5040a0", fontSize:"12px", padding:"16px 10px", textAlign:"center", lineHeight:1.7 }}>
              No notes yet.<br/>Click + to create one.
            </p>
          )}
          {files.map(f => (
            <div key={f} onClick={() => openFile(f)}
              style={{ padding:"10px 10px 8px", borderRadius:"8px", marginBottom:"2px", cursor:"pointer", background: activeFile===f ? "rgba(160,122,255,0.18)" : "transparent", border: activeFile===f ? "1px solid rgba(160,122,255,0.35)" : "1px solid transparent", position:"relative" }}
              onMouseEnter={e => {
                if (activeFile!==f) e.currentTarget.style.background="rgba(160,122,255,0.08)";
                e.currentTarget.querySelector(".del").style.opacity="1";
              }}
              onMouseLeave={e => {
                if (activeFile!==f) e.currentTarget.style.background="transparent";
                e.currentTarget.querySelector(".del").style.opacity="0";
              }}
            >
              <div style={{ fontSize:"13px", color:"#e8e0ff", fontWeight:500, paddingRight:"18px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {displayName(f)}
              </div>
              <button className="del" onClick={e => deleteFile(f, e)}
                style={{ position:"absolute", top:"8px", right:"6px", opacity:0, background:"transparent", border:"none", color:"rgba(255,100,100,0.7)", cursor:"pointer", fontSize:"12px", transition:"opacity 0.15s", padding:"0 3px" }}
              >&#10005;</button>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {activeFile ? (
          <>
            <div style={{ padding:"12px 20px", borderBottom:"1px solid rgba(160,122,255,0.1)", display:"flex", alignItems:"center", gap:"12px" }}>
              <span style={{ fontSize:"14px", color:"#e8e0ff", fontWeight:500 }}>
                {displayName(activeFile)}
              </span>
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color: unsaved ? "#f0c040" : saving ? "#60a8f0" : "#5040a0" }}>
                {saving ? "saving..." : unsaved ? "unsaved" : "saved"}
              </span>
              <span style={{ marginLeft:"auto", fontFamily:"'IBM Plex Mono',monospace", fontSize:"10px", color:"#4030a0" }}>
                Ctrl+S to save  Markdown supported  Title auto-generated from content
              </span>
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              onKeyDown={handleKey}
              placeholder={"Start writing...\n\nThe note title is generated automatically from your first line.\nMarkdown is fully supported."}
              style={{ flex:1, resize:"none", background:"transparent", border:"none", outline:"none", padding:"24px 32px", color:"#f0ecff", fontFamily:"'IBM Plex Mono',monospace", fontSize:"14px", lineHeight:"1.85", caretColor:"#c4a0ff" }}
              spellCheck={false}
            />
          </>
        ) : (
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"14px" }}>
            <span style={{ fontSize:"28px", color:"rgba(160,122,255,0.3)" }}></span>
            <p style={{ color:"#6050a0", fontSize:"14px" }}>Select a note or create a new one</p>
            <p style={{ color:"#4030a0", fontSize:"11px", fontFamily:"'IBM Plex Mono',monospace" }}>
              Notes auto-title from your first line  Obsidian compatible
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
