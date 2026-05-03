import React, { useState } from "react";
import { motion } from "framer-motion";
import LogosSigil from "./LogosSigil.jsx";

// Lightweight markdown renderer  no external dep needed for basic formatting
function renderMarkdown(text) {
  if (!text) return "";

  // Process line by line for block-level elements
  const lines = text.split("\n");
  let html = "";
  let inCode = false;
  let codeLang = "";
  let codeBuffer = "";
  let inList = false;
  let listType = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code fence
    if (line.startsWith("```")) {
      if (!inCode) {
        if (inList) { html += listType === "ul" ? "</ul>" : "</ol>"; inList = false; }
        inCode = true;
        codeLang = line.slice(3).trim() || "text";
        codeBuffer = "";
      } else {
        html += `<pre><code class="lang-${codeLang}">${escapeHtml(codeBuffer)}</code></pre>`;
        inCode = false;
        codeBuffer = "";
        codeLang = "";
      }
      continue;
    }

    if (inCode) {
      codeBuffer += (codeBuffer ? "\n" : "") + line;
      continue;
    }

    // Headings
    const h3 = line.match(/^### (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h1 = line.match(/^# (.+)/);
    if (h3) { closeList(); html += `<h3>${inlineFormat(h3[1])}</h3>`; continue; }
    if (h2) { closeList(); html += `<h2>${inlineFormat(h2[1])}</h2>`; continue; }
    if (h1) { closeList(); html += `<h1>${inlineFormat(h1[1])}</h1>`; continue; }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      closeList();
      html += "<hr/>";
      continue;
    }

    // Bullet list
    const bullet = line.match(/^[-*+] (.+)/);
    if (bullet) {
      if (!inList || listType !== "ul") {
        if (inList) html += listType === "ul" ? "</ul>" : "</ol>";
        html += "<ul>";
        inList = true;
        listType = "ul";
      }
      html += `<li>${inlineFormat(bullet[1])}</li>`;
      continue;
    }

    // Numbered list
    const numbered = line.match(/^\d+\. (.+)/);
    if (numbered) {
      if (!inList || listType !== "ol") {
        if (inList) html += listType === "ul" ? "</ul>" : "</ol>";
        html += "<ol>";
        inList = true;
        listType = "ol";
      }
      html += `<li>${inlineFormat(numbered[1])}</li>`;
      continue;
    }

    // Close list if not in list context
    if (inList && line.trim() !== "") {
      html += listType === "ul" ? "</ul>" : "</ol>";
      inList = false;
    }

    // Blockquote
    const bq = line.match(/^> (.+)/);
    if (bq) { html += `<blockquote>${inlineFormat(bq[1])}</blockquote>`; continue; }

    // Empty line
    if (line.trim() === "") {
      if (inList) { html += listType === "ul" ? "</ul>" : "</ol>"; inList = false; }
      html += "<br/>";
      continue;
    }

    // Regular paragraph line
    html += `<p>${inlineFormat(line)}</p>`;
  }

  if (inList) html += listType === "ul" ? "</ul>" : "</ol>";

  return html;

  function closeList() {
    if (inList) { html += listType === "ul" ? "</ul>" : "</ol>"; inList = false; }
  }
}

function inlineFormat(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

//  MessageBubble 

export default function MessageBubble({ message, onSeal, onArtifact }) {
  const [hovering, setHovering] = useState(false);
  const [sealed, setSealed] = useState(false);
  const isUser = message.role === "user";
  const isError = message.error;

  async function handleSeal() {
    await onSeal?.();
    setSealed(true);
    setTimeout(() => setSealed(false), 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="px-6 py-2"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {isUser ? (
        //  User message 
        <div className="flex justify-end">
          <div
            className="max-w-xl px-4 py-3 rounded-2xl rounded-tr-sm text-sm"
            style={{
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.2)",
              color: "rgba(232,224,255,0.92)",
              lineHeight: "1.65",
              fontFamily: "'IBM Plex Sans', sans-serif",
            }}
          >
            {message.image && (
              <img
                src={message.image}
                alt="Uploaded"
                className="rounded mb-2 max-h-40 object-contain"
                style={{ maxWidth: "200px" }}
              />
            )}
            <span style={{ whiteSpace: "pre-wrap" }}>{message.content}</span>
          </div>
        </div>
      ) : (
        //  Logos message 
        <div className="flex gap-3 items-start">
          {/* Sigil avatar */}
          <div className="flex-shrink-0 mt-0.5">
            <LogosSigil
              size={22}
              state={message.streaming ? "speaking" : "idle"}
              animated={message.streaming}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Member badge */}
            {message.member && !message.streaming && (
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  style={{
                    fontSize: "9px",
                    fontFamily: "'Cinzel', serif",
                    color: memberColor(message.member),
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}
                >
                  Logos
                </span>
                <span
                  style={{
                    fontSize: "9px",
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: "rgba(160,154,184,0.3)",
                  }}
                >
                  via {memberLabel(message.member)}
                </span>
              </div>
            )}

            {/* Reasoning collapse (council mode) */}
            {message.reasoning && (
              <details className="mb-2">
                <summary
                  style={{
                    fontSize: "10px",
                    color: "rgba(160,154,184,0.4)",
                    cursor: "pointer",
                    fontFamily: "'IBM Plex Mono', monospace",
                    userSelect: "none",
                  }}
                >
                   council reasoning
                </summary>
                <div
                  className="mt-1 pl-3 text-xs"
                  style={{
                    color: "rgba(160,154,184,0.6)",
                    borderLeft: "1px solid rgba(124,58,237,0.2)",
                    fontFamily: "'IBM Plex Sans', sans-serif",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {message.reasoning}
                </div>
              </details>
            )}

            {/* Main content */}
            {isError ? (
              <p
                className="text-sm"
                style={{
                  color: "rgba(248,113,113,0.8)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12px",
                }}
              >
                {message.content}
              </p>
            ) : (
              <div
                className={`logos-prose text-sm ${message.streaming ? "stream-cursor" : ""}`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
              />
            )}

            {/* Streaming indicator */}
            {message.streaming && (
              <div className="flex items-center gap-1.5 mt-2">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1 h-1 rounded-full"
                    style={{
                      background: "rgba(124,58,237,0.6)",
                      animation: `thinkPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Action bar (on hover, after done) */}
            {!message.streaming && hovering && !isError && (
              <motion.div
                initial={{ opacity: 0, y: 2 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-1 mt-2"
              >
                <ActionBtn
                  onClick={handleSeal}
                  title="Seal to memory"
                  active={sealed}
                  label={sealed ? "Sealed " : "Seal"}
                  color={sealed ? "rgba(212,175,55,0.8)" : "rgba(160,154,184,0.4)"}
                />
                <ActionBtn
                  onClick={() => navigator.clipboard?.writeText(message.content)}
                  title="Copy text"
                  label="Copy"
                  color="rgba(160,154,184,0.4)"
                />
              </motion.div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ActionBtn({ onClick, label, title, color, active }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="px-2 py-0.5 rounded text-xs transition-all"
      style={{
        color: hover ? "rgba(196,181,253,0.8)" : color,
        background: hover ? "rgba(124,58,237,0.1)" : "transparent",
        border: "1px solid rgba(124,58,237,0.1)",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "10px",
      }}
    >
      {label}
    </button>
  );
}

function memberLabel(member) {
  const map = { pneuma: "Pneuma", techne: "Techne", opsis: "Opsis", logos: "Council" };
  return map[member] || "Logos";
}

function memberColor(member) {
  const map = {
    pneuma: "rgba(139,92,246,0.8)",
    techne: "rgba(212,175,55,0.7)",
    opsis:  "rgba(96,165,250,0.8)",
    logos:  "rgba(212,175,55,0.7)",
  };
  return map[member] || "rgba(212,175,55,0.7)";
}
