import React, { useEffect, useState } from 'react';
import { colors, fonts } from '../theme/tokens.js';

const PHRASES = [
  'Initializing Logos...',
  'Loading council members...',
  'Connecting inference engine...',
  'Preparing your workspace...',
  'Almost there...',
];

export default function LoadingScreen() {
  const [phrase, setPhrase] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPhrase(p => (p + 1) % PHRASES.length), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', width: '100vw', background: colors.bg, gap: '24px',
    }}>
      <svg width="64" height="64" viewBox="0 0 40 40" fill="none"
        style={{ animation: 'breathe 2s ease-in-out infinite' }}>
        <circle cx="20" cy="20" r="18.5" stroke="rgba(200,180,255,0.35)" strokeWidth="1"/>
        <circle cx="20" cy="20" r="14" stroke="rgba(160,122,255,0.2)" strokeWidth="0.6"
          strokeDasharray="2 4" style={{ animation: 'sigilSpin 3s linear infinite' }}/>
        <polygon points="20,6.5 31,25.5 9,25.5" fill="none" stroke="rgba(160,122,255,0.8)" strokeWidth="1.2"/>
        <polygon points="20,33.5 9,14.5 31,14.5" fill="none" stroke="rgba(160,122,255,0.45)" strokeWidth="0.9"/>
        <circle cx="20" cy="20" r="3" fill="rgba(240,192,64,0.85)"/>
      </svg>

      <div style={{ fontFamily: fonts.heading, fontSize: '20px', color: colors.text,
        letterSpacing: '0.2em' }}>THE COLLECTIVE</div>

      <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim,
        letterSpacing: '0.06em', minWidth: '220px', textAlign: 'center',
        transition: 'opacity 0.3s' }}>
        {PHRASES[phrase]}
      </div>
    </div>
  );
}
