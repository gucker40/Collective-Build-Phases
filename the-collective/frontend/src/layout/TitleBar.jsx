import React, { useState } from 'react';
import { colors, fonts } from '../theme/tokens.js';

export default function TitleBar() {
  const [maxed, setMaxed] = useState(false);
  const isElectron = typeof window !== 'undefined' && window.electronAPI;
  if (!isElectron) return null;

  const btn = (onClick, children, danger) => (
    <button onClick={onClick} style={{
      width: '28px', height: '28px', borderRadius: '6px', border: 'none',
      background: 'transparent', color: danger ? '#ff6060' : colors.dim,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.12s', fontSize: '13px',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = danger ? 'rgba(255,96,96,0.15)' : 'rgba(160,122,255,0.12)'; e.currentTarget.style.color = danger ? '#ff6060' : colors.purpleHi; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = danger ? '#ff6060' : colors.dim; }}
    >{children}</button>
  );

  return (
    <div style={{
      height: '36px', flexShrink: 0, display: 'flex', alignItems: 'center',
      background: colors.card, borderBottom: `1px solid ${colors.border}`,
      WebkitAppRegion: 'drag', userSelect: 'none', paddingLeft: '14px', paddingRight: '8px',
    }}>
      <svg width="18" height="18" viewBox="0 0 40 40" fill="none" style={{ flexShrink: 0 }}>
        <circle cx="20" cy="20" r="18.5" stroke="rgba(160,122,255,0.4)" strokeWidth="1"/>
        <polygon points="20,6.5 31,25.5 9,25.5" fill="none" stroke="rgba(160,122,255,0.85)" strokeWidth="1.2"/>
        <polygon points="20,33.5 9,14.5 31,14.5" fill="none" stroke="rgba(160,122,255,0.5)" strokeWidth="0.9"/>
        <circle cx="20" cy="20" r="2.8" fill="rgba(240,192,64,1)"/>
      </svg>
      <span style={{ fontFamily: fonts.heading, fontSize: '10px', color: colors.dim, letterSpacing: '0.16em', marginLeft: '10px' }}>
        THE COLLECTIVE
      </span>
      <div style={{ flex: 1, WebkitAppRegion: 'drag' }} />
      <div style={{ display: 'flex', gap: '2px', WebkitAppRegion: 'no-drag' }}>
        {btn(() => window.electronAPI.minimize(), '─')}
        {btn(() => { window.electronAPI.maximize(); setMaxed(m => !m); }, maxed ? '❐' : '□')}
        {btn(() => window.electronAPI.close(), '✕', true)}
      </div>
    </div>
  );
}
