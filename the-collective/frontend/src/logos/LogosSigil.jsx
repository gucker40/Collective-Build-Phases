import React from 'react';

export default function LogosSigil({ size = 40, state = 'idle', animated = true }) {
  const breathe = state === 'idle' && animated   ? 'breathe 3.5s ease-in-out infinite' : 'none';
  const spin    = state === 'speaking' && animated ? 'sigilSpin 8s linear infinite'    : 'none';

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none"
      style={{ animation: breathe !== 'none' ? breathe : spin !== 'none' ? spin : 'none',
               flexShrink: 0 }}>
      <circle cx="20" cy="20" r="18.5" stroke="rgba(200,180,255,0.45)" strokeWidth="1"/>
      {state === 'thinking' && (
        <circle cx="20" cy="20" r="14" stroke="rgba(160,122,255,0.25)" strokeWidth="0.6"
          strokeDasharray="2 4" style={{ animation: 'sigilSpin 3s linear infinite' }}/>
      )}
      <polygon points="20,6.5 31,25.5 9,25.5" fill="none"
        stroke="rgba(160,122,255,0.9)" strokeWidth="1.2"/>
      <polygon points="20,33.5 9,14.5 31,14.5" fill="none"
        stroke="rgba(160,122,255,0.55)" strokeWidth="0.9"/>
      <circle cx="20" cy="20" r="3"
        fill={state === 'speaking' ? 'rgba(240,192,64,1)' : 'rgba(240,192,64,0.85)'}/>
    </svg>
  );
}
