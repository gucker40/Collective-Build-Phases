/* Design token system — all colors, spacing, typography in one place. */

export const colors = {
  bg:       '#0d0d1a',
  surface:  '#12121f',
  card:     '#0a0a16',
  border:   'rgba(160,122,255,0.2)',
  borderHi: 'rgba(160,122,255,0.45)',
  text:     '#f0ecff',
  muted:    '#8878c8',
  dim:      '#5048a0',

  purple:   '#a07aff',
  purpleHi: '#c4a0ff',
  purpleLo: 'rgba(160,122,255,0.12)',
  gold:     '#f0c040',
  goldLo:   'rgba(240,192,64,0.12)',

  success:  '#50d890',
  error:    '#ff6060',
  errorLo:  'rgba(255,96,96,0.12)',
  info:     '#60b8ff',

  overlay:  'rgba(5,5,10,0.97)',
};

export const fonts = {
  heading: "'Cinzel', serif",
  mono:    "'IBM Plex Mono', monospace",
  body:    "'IBM Plex Sans', sans-serif",
};

export const radius = {
  sm: '6px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  pill: '999px',
};

export const shadow = {
  sm:  '0 2px 8px rgba(0,0,0,0.4)',
  md:  '0 4px 20px rgba(0,0,0,0.6)',
  lg:  '0 8px 40px rgba(0,0,0,0.8)',
  glow:'0 0 24px rgba(160,122,255,0.2)',
};

// Pre-built style objects for common patterns
export const styles = {
  card: {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: '16px',
  },
  input: {
    background: 'rgba(160,122,255,0.06)',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: '14px',
    padding: '10px 14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  label: {
    display: 'block',
    fontFamily: fonts.mono,
    fontSize: '10px',
    letterSpacing: '0.12em',
    color: colors.muted,
    marginBottom: '6px',
    textTransform: 'uppercase',
  },
  btnPrimary: {
    background: 'rgba(160,122,255,0.18)',
    border: `1px solid rgba(160,122,255,0.5)`,
    borderRadius: radius.sm,
    color: colors.purpleHi,
    cursor: 'pointer',
    fontFamily: fonts.heading,
    fontSize: '12px',
    letterSpacing: '0.08em',
    padding: '10px 20px',
    transition: 'all 0.15s',
  },
  btnGold: {
    background: 'rgba(240,192,64,0.12)',
    border: `1px solid rgba(240,192,64,0.4)`,
    borderRadius: radius.sm,
    color: colors.gold,
    cursor: 'pointer',
    fontFamily: fonts.heading,
    fontSize: '12px',
    letterSpacing: '0.08em',
    padding: '10px 20px',
    transition: 'all 0.15s',
  },
  btnGhost: {
    background: 'transparent',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.sm,
    color: colors.muted,
    cursor: 'pointer',
    fontFamily: fonts.mono,
    fontSize: '11px',
    padding: '8px 16px',
    transition: 'all 0.15s',
  },
  tag: {
    background: colors.purpleLo,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.pill,
    color: colors.muted,
    fontFamily: fonts.mono,
    fontSize: '10px',
    letterSpacing: '0.06em',
    padding: '3px 10px',
  },
};

export const PILLAR_COLORS = {
  dashboard:   colors.purple,
  productivity: colors.info,
  finance:     colors.success,
  'data-vault': colors.gold,
  config:      colors.muted,
};
