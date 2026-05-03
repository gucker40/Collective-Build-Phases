import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LogosSigil from "./LogosSigil.jsx";

import { API } from "../api.js";
import { useLayout } from "../useLayout.js";

const TYPE_COLORS = {
  Conversation: "rgba(139,92,246,0.7)",
  Note:         "rgba(212,175,55,0.7)",
  Fact:         "rgba(96,165,250,0.7)",
  Instruction:  "rgba(52,211,153,0.7)",
};

const TYPE_GLYPHS = {
  Conversation: "",
  Note:         "",
  Fact:         "",
  Instruction:  "",
};

export default function MemoryVault() {
  const [memories, setMemories]     = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [searchQuery, setSearch]    = useState("");
  const [sealText, setSealText]     = useState("");
  const [sealType, setSealType]     = useState("Fact");
  const [sealing, setSealing]       = useState(false);
  const [sealed, setSealed]         = useState(false);
  const [unsealId, setUnsealId]     = useState(null);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/memory/list`);
      const data = await res.json();
      setMemories(data.memories || []);
      setTotal(data.total || 0);
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  async function handleSearch(q) {
    setSearch(q);
    if (!q.trim()) { loadMemories(); return; }
    try {
      const res = await fetch(`${API}/memory/search?query=${encodeURIComponent(q)}&n=20`);
      const data = await res.json();
      setMemories(data.results || []);
    } catch { /* ignore */ }
  }

  async function handleSeal() {
    if (!sealText.trim()) return;
    setSealing(true);
    try {
      await fetch(`${API}/memory/seal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sealText.trim(), type: sealType }),
      });
      setSealText("");
      setSealed(true);
      setTimeout(() => setSealed(false), 2000);
      await loadMemories();
    } catch { /* ignore */ }
    setSealing(false);
  }

  async function handleUnseal(id) {
    setUnsealId(id);
    try {
      await fetch(`${API}/memory/unseal/${id}`, { method: "DELETE" });
      setMemories(prev => prev.filter(m => m.id !== id));
    } catch { /* ignore */ }
    setUnsealId(null);
  }

  function formatTimestamp(ts) {
    if (!ts) return "";
    const d = new Date(ts * 1000);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid rgba(124,58,237,0.12)" }}
      >
        <div className="w-6 h-6">
          <LogosSigil size={24} state="idle" animated={false} />
        </div>
        <div className="flex-1">
          <h2
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: "13px",
              color: "rgba(212,175,55,0.8)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            Memory Vault
          </h2>
          <p style={{ fontSize: "10px", color: "rgba(160,154,184,0.45)", fontFamily: "'IBM Plex Mono', monospace" }}>
            {total} sealed {total === 1 ? "memory" : "memories"}  persists forever
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Seal new memory form */}
        <div
          className="rounded-xl p-4"
          style={{
            background: "rgba(8,8,15,0.6)",
            border: "1px solid rgba(124,58,237,0.18)",
          }}
        >
          <p
            className="mb-3"
            style={{
              fontSize: "10px",
              fontFamily: "'Cinzel', serif",
              color: "rgba(212,175,55,0.6)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
             Seal New Memory
          </p>

          <textarea
            value={sealText}
            onChange={e => setSealText(e.target.value)}
            placeholder="What should Logos remember forever?"
            rows={3}
            className="w-full resize-none rounded-lg px-3 py-2.5 text-sm outline-none mb-3"
            style={{
              background: "rgba(3,3,5,0.7)",
              border: "1px solid rgba(124,58,237,0.15)",
              color: "rgba(232,224,255,0.85)",
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "13px",
              lineHeight: "1.6",
              caretColor: "rgba(139,92,246,0.9)",
            }}
          />

          <div className="flex items-center gap-2">
            {/* Type selector */}
            <div className="flex gap-1 flex-1">
              {Object.keys(TYPE_COLORS).map(type => (
                <button
                  key={type}
                  onClick={() => setSealType(type)}
                  className="px-2 py-1 rounded text-xs transition-all"
                  style={{
                    background: sealType === type ? "rgba(124,58,237,0.2)" : "transparent",
                    border: `1px solid ${sealType === type ? "rgba(124,58,237,0.35)" : "rgba(124,58,237,0.1)"}`,
                    color: sealType === type ? TYPE_COLORS[type] : "rgba(160,154,184,0.4)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                    letterSpacing: "0.05em",
                  }}
                >
                  {TYPE_GLYPHS[type]} {type}
                </button>
              ))}
            </div>

            {/* Seal button */}
            <motion.button
              onClick={handleSeal}
              disabled={!sealText.trim() || sealing}
              whileTap={{ scale: 0.96 }}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: sealed
                  ? "rgba(52,211,153,0.15)"
                  : sealText.trim()
                    ? "rgba(212,175,55,0.15)"
                    : "rgba(124,58,237,0.05)",
                border: sealed
                  ? "1px solid rgba(52,211,153,0.35)"
                  : sealText.trim()
                    ? "1px solid rgba(212,175,55,0.3)"
                    : "1px solid rgba(124,58,237,0.1)",
                color: sealed
                  ? "rgba(52,211,153,0.9)"
                  : sealText.trim()
                    ? "rgba(212,175,55,0.85)"
                    : "rgba(160,154,184,0.3)",
                fontFamily: "'Cinzel', serif",
                fontSize: "9px",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              {sealed ? " Sealed" : sealing ? "Sealing" : " Seal"}
            </motion.button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search memories"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: "rgba(8,8,15,0.6)",
              border: "1px solid rgba(124,58,237,0.15)",
              color: "rgba(232,224,255,0.8)",
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: "12px",
              caretColor: "rgba(139,92,246,0.9)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "rgba(160,154,184,0.4)", fontSize: "12px" }}
            >
              
            </button>
          )}
        </div>

        {/* Memory cards */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 opacity-50" style={{ animation: "breathe 2s ease-in-out infinite" }}>
              <LogosSigil size={32} state="idle" animated />
            </div>
          </div>
        ) : memories.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: "rgba(160,154,184,0.3)", fontSize: "13px" }}>
              {searchQuery ? "No memories match this query." : "The vault is empty."}
            </p>
            <p style={{ color: "rgba(160,154,184,0.2)", fontSize: "11px", marginTop: "6px" }}>
              Seal a memory above, or ask Logos to remember something.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {memories.map(mem => (
              <motion.div
                key={mem.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="rounded-xl p-4 group relative"
                style={{
                  background: "rgba(5,5,8,0.7)",
                  border: `1px solid ${TYPE_COLORS[mem.type] || "rgba(124,58,237,0.15)"}22`,
                }}
              >
                {/* Header row */}
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ color: TYPE_COLORS[mem.type] || "rgba(160,154,184,0.5)", fontSize: "12px" }}>
                    {TYPE_GLYPHS[mem.type] || ""}
                  </span>
                  <span
                    className="text-xs"
                    style={{
                      color: TYPE_COLORS[mem.type] || "rgba(160,154,184,0.6)",
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "9px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                    }}
                  >
                    {mem.type}
                  </span>
                  <span
                    className="ml-auto text-xs"
                    style={{ color: "rgba(160,154,184,0.3)", fontSize: "9px", fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {formatTimestamp(mem.timestamp)}
                  </span>
                </div>

                {/* Memory text */}
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: "rgba(232,224,255,0.75)",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    fontSize: "12.5px",
                  }}
                >
                  {mem.preview || mem.text}
                </p>

                {/* Unseal button (shows on hover) */}
                <button
                  onClick={() => handleUnseal(mem.id)}
                  disabled={unsealId === mem.id}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-0.5 rounded"
                  style={{
                    color: "rgba(248,113,113,0.6)",
                    border: "1px solid rgba(248,113,113,0.2)",
                    background: "rgba(220,38,38,0.08)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "9px",
                  }}
                >
                  {unsealId === mem.id ? "" : "unseal"}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
