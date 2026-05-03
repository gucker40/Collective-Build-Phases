import React from 'react';
import { colors, fonts, radius } from '../../theme/tokens.js';

const PILLARS_DESC = [
  { name: 'Logos',        desc: 'AI council — three-model reasoning with native inference, cloud fallback, and codebase self-edit.' },
  { name: 'Dashboard',    desc: 'Live overview of council status, recent memories, and quick-launch actions.' },
  { name: 'Productivity', desc: 'Task management with priority tiers — syncs with Logos context.' },
  { name: 'Finance',      desc: 'Local transaction ledger with future Plaid integration planned.' },
  { name: 'Data Vault',   desc: 'Persistent notes, saved artifacts, and Logos memory bank.' },
  { name: 'Config',       desc: 'Provider setup, skill sheet management, Cloudflare tunnel, and diagnostics.' },
];

export default function AboutMission() {
  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18.5" stroke="rgba(200,180,255,0.45)" strokeWidth="1"/>
          <polygon points="20,6.5 31,25.5 9,25.5" fill="none" stroke="rgba(160,122,255,0.9)" strokeWidth="1.2"/>
          <polygon points="20,33.5 9,14.5 31,14.5" fill="none" stroke="rgba(160,122,255,0.55)" strokeWidth="0.9"/>
          <circle cx="20" cy="20" r="3" fill="rgba(240,192,64,0.85)"/>
        </svg>
        <div>
          <div style={{ fontFamily: fonts.heading, fontSize: '18px', color: colors.text,
            letterSpacing: '0.15em' }}>THE COLLECTIVE</div>
          <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim, marginTop: '2px' }}>
            Phase 4 · Open Source AI Workspace
          </div>
        </div>
      </div>

      {/* Mission */}
      <div style={{ background: 'rgba(160,122,255,0.05)', border: `1px solid rgba(160,122,255,0.15)`,
        borderRadius: '10px', padding: '18px', marginBottom: '24px' }}>
        <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.purpleHi,
          letterSpacing: '0.1em', marginBottom: '10px' }}>MISSION</div>
        <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.muted, lineHeight: '1.8' }}>
          The Collective is a local-first AI workspace that gives power users full control over their AI stack.
          Run models natively on your hardware, chain cloud providers as fallbacks, build HTML dashboards,
          and extend Logos with community skill sheets — all without data leaving your machine unless you choose.
        </div>
      </div>

      {/* Five pillars */}
      <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.gold,
        letterSpacing: '0.1em', marginBottom: '14px' }}>THE FIVE PILLARS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {PILLARS_DESC.map(p => (
          <div key={p.name} style={{ display: 'flex', gap: '14px', padding: '10px 14px',
            background: 'rgba(255,255,255,0.02)', borderRadius: '8px',
            border: `1px solid ${colors.border}` }}>
            <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.purpleHi,
              letterSpacing: '0.06em', minWidth: '90px', flexShrink: 0 }}>{p.name.toUpperCase()}</div>
            <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim, lineHeight: '1.5' }}>
              {p.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Version */}
      <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim,
        padding: '12px 0', borderTop: `1px solid ${colors.border}` }}>
        Version 4.0.0 · Electron 31 · React 18 · FastAPI · llama-cpp-python
      </div>
    </div>
  );
}
