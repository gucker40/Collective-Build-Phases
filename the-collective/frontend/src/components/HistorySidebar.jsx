import React, { useEffect, useState, useCallback } from 'react';
import { colors, fonts, radius } from '../theme/tokens.js';
import { api } from '../api/index.js';
import { useUIStore } from '../store/ui.js';

export default function HistorySidebar() {
  const { loadSession, activeSession, historyRefresh, newChat } = useUIStore();
  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.history.list();
      setSessions(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load, historyRefresh]);

  const filtered = search
    ? sessions.filter(s => s.title?.toLowerCase().includes(search.toLowerCase()))
    : sessions;

  async function deleteSession(e, id) {
    e.stopPropagation();
    try {
      await api.history.delete(id);
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch {}
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(typeof iso === 'number' ? iso * 1000 : iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  return (
    <div style={{
      width: '220px', flexShrink: 0, background: 'rgba(8,6,18,0.95)',
      borderRight: `1px solid ${colors.border}`,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
      }}>
        <span style={{ fontFamily: fonts.heading, fontSize: '10px', color: colors.gold,
          letterSpacing: '0.12em', flex: 1 }}>HISTORY</span>
        <button onClick={newChat} title="New Chat" style={{
          width: '22px', height: '22px', background: 'rgba(160,122,255,0.1)',
          border: `1px solid ${colors.border}`, borderRadius: '5px',
          color: colors.purpleHi, cursor: 'pointer', fontSize: '14px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search sessions..."
          style={{
            width: '100%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border}`,
            borderRadius: '5px', padding: '5px 8px', color: colors.text,
            fontFamily: fonts.mono, fontSize: '11px', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '20px 12px', fontFamily: fonts.mono, fontSize: '11px',
            color: colors.dim, textAlign: 'center' }}>
            {search ? 'No matches' : 'No sessions yet'}
          </div>
        )}
        {filtered.map(s => {
          const active = activeSession?.id === s.id;
          return (
            <div key={s.id}
              onClick={() => loadSession(s)}
              style={{
                padding: '9px 12px', cursor: 'pointer', position: 'relative',
                borderBottom: `1px solid ${colors.border}`,
                background: active ? 'rgba(160,122,255,0.08)' : 'transparent',
                borderLeft: active ? `2px solid ${colors.purple}` : '2px solid transparent',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: active ? colors.purpleHi : colors.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '3px',
                paddingRight: '20px' }}>
                {s.title || 'Untitled'}
              </div>
              <div style={{ fontFamily: fonts.mono, fontSize: '9px', color: colors.dim }}>
                {formatDate(s.updated_at || s.created_at)}
                {s.message_count > 0 && ` · ${s.message_count} msgs`}
              </div>
              <button
                onClick={e => deleteSession(e, s.id)}
                style={{
                  position: 'absolute', top: '8px', right: '8px',
                  width: '16px', height: '16px', background: 'transparent', border: 'none',
                  color: colors.dim, cursor: 'pointer', fontSize: '11px', opacity: 0,
                  transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                title="Delete"
              >✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
