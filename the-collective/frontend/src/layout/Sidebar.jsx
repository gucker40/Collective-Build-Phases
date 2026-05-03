import React, { useState, useEffect } from 'react';
import { colors, fonts, radius } from '../theme/tokens.js';
import { api } from '../api/index.js';
import { useAuthStore } from '../store/auth.js';
import { useUIStore } from '../store/ui.js';

const PILLARS = [
  { id: 'logos',        label: 'Logos',        color: colors.purple,
    icon: <svg width="20" height="20" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.4"/><polygon points="20,7 31,26 9,26" fill="none" stroke="currentColor" strokeWidth="1.4"/><polygon points="20,33 9,14 31,14" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.6"/><circle cx="20" cy="20" r="2.5" fill={colors.gold}/></svg> },
  { id: 'dashboard',    label: 'Dashboard',    color: colors.purple,
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg> },
  { id: 'productivity', label: 'Productivity', color: colors.info,
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M6 7h8M6 10.5h8M6 14h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
  { id: 'finance',      label: 'Finance',      color: colors.success,
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 14l4-4 3 3 4-5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4"/></svg> },
  { id: 'data-vault',   label: 'Data Vault',   color: colors.gold,
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><ellipse cx="10" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.4"/><path d="M3 6v8c0 1.66 3.13 3 7 3s7-1.34 7-3V6" stroke="currentColor" strokeWidth="1.4"/><path d="M3 10c0 1.66 3.13 3 7 3s7-1.34 7-3" stroke="currentColor" strokeWidth="1.4"/></svg> },
  { id: 'config',       label: 'Config',       color: colors.muted,
    icon: <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="2.8" stroke="currentColor" strokeWidth="1.4"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg> },
];

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuthStore();
  const { activePillar, setActivePillar, newChat } = useUIStore();
  const [council, setCouncil] = useState({});
  const [showUser, setShowUser] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const d = await api.logos.status();
        setCouncil(d.council || {});
      } catch {}
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  const initials = (user?.display_name || user?.username || '?')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{
      width: '68px', flexShrink: 0, background: 'rgba(5,5,10,0.92)',
      borderRight: `1px solid ${colors.border}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 0', gap: '2px', position: 'relative',
    }}>
      {PILLARS.map(({ id, label, icon, color }) => {
        const active = activePillar === id;
        return (
          <button key={id} title={label}
            onClick={() => id === 'logos' ? newChat() : setActivePillar(id)}
            style={{
              width: '50px', height: '50px', borderRadius: radius.md,
              border: active ? `1px solid ${color}60` : '1px solid transparent',
              background: active ? `${color}22` : 'transparent',
              color: active ? color : colors.dim,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', transition: 'all 0.15s', marginBottom: '2px',
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.background = `${color}14`; e.currentTarget.style.color = color; }}}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = colors.dim; }}}
          >
            {icon}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* Council status dots */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
        {[['P','pneuma'],['T','techne'],['O','opsis']].map(([lbl, key]) => (
          <div key={key} title={`${key}: ${council[key] ? 'ready' : 'offline'}`}
            style={{
              width: '22px', height: '22px', borderRadius: '5px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: fonts.heading, fontSize: '9px', letterSpacing: '0.05em',
              color: council[key] ? colors.gold : '#443860',
              background: council[key] ? 'rgba(240,192,64,0.1)' : 'transparent',
              border: `1px solid ${council[key] ? 'rgba(240,192,64,0.25)' : 'rgba(160,122,255,0.1)'}`,
            }}>
            {lbl}
          </div>
        ))}
      </div>

      <div style={{ width: '36px', height: '1px', background: colors.border, margin: '4px 0' }} />

      {/* User avatar */}
      <div style={{ position: 'relative' }}>
        <div onClick={() => setShowUser(v => !v)} title={user?.display_name}
          style={{
            width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer',
            background: 'rgba(160,122,255,0.2)', border: `1px solid ${colors.borderHi}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: fonts.heading, fontSize: '10px', color: colors.purpleHi,
            letterSpacing: '0.05em', userSelect: 'none',
          }}>
          {initials}
        </div>
        {showUser && (
          <div style={{
            position: 'absolute', bottom: '42px', left: '42px', zIndex: 200,
            background: '#07070e', border: `1px solid ${colors.border}`,
            borderRadius: radius.md, padding: '12px', minWidth: '170px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
          }}>
            <div style={{ fontFamily: fonts.heading, fontSize: '12px', color: colors.text, letterSpacing: '0.06em', marginBottom: '2px' }}>
              {user?.display_name}
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.muted, marginBottom: '12px' }}>
              @{user?.username}
              {user?.role === 'admin' && <span style={{ marginLeft: '6px', color: colors.gold, fontSize: '9px' }}>ADMIN</span>}
            </div>
            <button onClick={() => { setShowUser(false); logout(); }}
              style={{ width: '100%', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(255,96,96,0.08)', border: '1px solid rgba(255,96,96,0.2)',
                borderRadius: radius.sm, color: '#ff9090', fontFamily: fonts.mono, fontSize: '11px',
                cursor: 'pointer', letterSpacing: '0.05em' }}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
