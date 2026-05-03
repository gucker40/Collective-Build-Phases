import React, { useEffect, useState } from 'react';
import { colors, fonts, radius, styles } from '../../theme/tokens.js';
import { api } from '../../api/index.js';
import { useUIStore } from '../../store/ui.js';
import { useAuthStore } from '../../store/auth.js';

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ ...styles.card, flex: 1, minWidth: '140px' }}>
      <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim,
        letterSpacing: '0.08em', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontFamily: fonts.heading, fontSize: '22px', color: color || colors.purpleHi,
        letterSpacing: '0.04em', marginBottom: '4px' }}>{value}</div>
      {sub && <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.muted }}>{sub}</div>}
    </div>
  );
}

function RecentMessage({ msg }) {
  return (
    <div style={{ padding: '10px 14px', borderBottom: `1px solid ${colors.border}`,
      display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
      <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.purple,
        background: 'rgba(160,122,255,0.1)', borderRadius: '4px',
        padding: '2px 6px', flexShrink: 0, marginTop: '2px' }}>
        {msg.role === 'user' ? 'YOU' : 'AI'}
      </div>
      <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.muted,
        lineHeight: '1.5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {msg.content}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { newChat } = useUIStore();
  const { user } = useAuthStore();
  const [status, setStatus] = useState(null);
  const [recent, setRecent] = useState([]);
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.logos.status().catch(() => null),
      api.history.list().catch(() => []),
      api.memory.list().catch(() => []),
    ]).then(([s, sessions, mems]) => {
      setStatus(s);
      const msgs = [];
      (sessions || []).slice(0, 3).forEach(sess => {
        if (sess.preview) msgs.push({ role: 'user', content: sess.title || sess.preview });
      });
      setRecent(msgs.slice(0, 5));
      setMemories((mems || []).slice(0, 4));
      setLoading(false);
    });
  }, []);

  const council = status?.council || {};
  const providers = ['pneuma', 'techne', 'opsis'];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: colors.bg }}>
      {/* Greeting */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontFamily: fonts.heading, fontSize: '20px', color: colors.text,
          letterSpacing: '0.1em', marginBottom: '4px' }}>
          WELCOME BACK{user?.display_name ? `, ${user.display_name.toUpperCase()}` : ''}
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Quick action */}
      <button onClick={newChat} style={{
        ...styles.btnPrimary, marginBottom: '28px', display: 'flex',
        alignItems: 'center', gap: '10px', padding: '12px 20px',
      }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="18.5" stroke="currentColor" strokeWidth="1.4"/>
          <polygon points="10,3.5 15.5,12.5 4.5,12.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
          <polygon points="10,16.5 4.5,7.5 15.5,7.5" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.6"/>
        </svg>
        Ask Logos
      </button>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <StatCard label="COUNCIL STATUS" value={
          Object.values(council).filter(Boolean).length + '/3'
        } sub="members online" color={colors.purpleHi} />
        <StatCard label="PROVIDER" value={status?.provider?.toUpperCase() || '—'}
          sub={status?.native_available ? 'native model' : 'cloud'} color={colors.gold} />
        <StatCard label="MEMORIES" value={memories.length || '0'} sub="sealed entries" color={colors.success} />
      </div>

      {/* Council status */}
      <div style={{ ...styles.card, marginBottom: '20px' }}>
        <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.gold,
          letterSpacing: '0.1em', marginBottom: '14px' }}>COUNCIL</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {providers.map(p => (
            <div key={p} style={{
              flex: 1, padding: '12px', borderRadius: radius.sm,
              background: council[p] ? 'rgba(80,216,144,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${council[p] ? 'rgba(80,216,144,0.2)' : colors.border}`,
              textAlign: 'center',
            }}>
              <div style={{ fontFamily: fonts.heading, fontSize: '14px',
                color: council[p] ? colors.success : '#443860',
                letterSpacing: '0.1em', marginBottom: '4px' }}>
                {p.charAt(0).toUpperCase()}
              </div>
              <div style={{ fontFamily: fonts.mono, fontSize: '9px',
                color: council[p] ? colors.success : colors.dim, letterSpacing: '0.06em' }}>
                {p.toUpperCase()}
              </div>
              <div style={{ fontFamily: fonts.mono, fontSize: '8px',
                color: council[p] ? 'rgba(80,216,144,0.6)' : '#332244', marginTop: '2px' }}>
                {council[p] ? 'READY' : 'OFFLINE'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent memories */}
      {memories.length > 0 && (
        <div style={{ ...styles.card, marginBottom: '20px' }}>
          <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.gold,
            letterSpacing: '0.1em', marginBottom: '14px' }}>RECENT MEMORIES</div>
          {memories.map((m, i) => (
            <div key={m.id || i} style={{ padding: '8px 0', borderBottom: i < memories.length - 1 ? `1px solid ${colors.border}` : 'none' }}>
              <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.muted,
                lineHeight: '1.5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.text || m.preview}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent sessions */}
      {recent.length > 0 && (
        <div style={{ ...styles.card }}>
          <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.gold,
            letterSpacing: '0.1em', marginBottom: '10px' }}>RECENT SESSIONS</div>
          {recent.map((m, i) => <RecentMessage key={i} msg={m} />)}
        </div>
      )}

      {loading && (
        <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim, textAlign: 'center',
          padding: '40px' }}>Loading...</div>
      )}
    </div>
  );
}
