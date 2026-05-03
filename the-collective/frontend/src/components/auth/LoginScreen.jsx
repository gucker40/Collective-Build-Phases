import React, { useState } from 'react';
import { colors, fonts, radius, styles } from '../../theme/tokens.js';
import { useAuthStore } from '../../store/auth.js';

export default function LoginScreen() {
  const { login } = useAuthStore();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { username, password }
        : { username, password, display_name: displayName || username };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Request failed');
      login(data.token, data.user);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', width: '100vw', background: colors.bg,
    }}>
      <div style={{
        width: '340px', background: colors.card, border: `1px solid ${colors.border}`,
        borderRadius: radius.lg, padding: '36px 32px', boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Sigil */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <svg width="48" height="48" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18.5" stroke="rgba(200,180,255,0.45)" strokeWidth="1"/>
            <polygon points="20,6.5 31,25.5 9,25.5" fill="none" stroke="rgba(160,122,255,0.9)" strokeWidth="1.2"/>
            <polygon points="20,33.5 9,14.5 31,14.5" fill="none" stroke="rgba(160,122,255,0.55)" strokeWidth="0.9"/>
            <circle cx="20" cy="20" r="3" fill="rgba(240,192,64,0.85)"/>
          </svg>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontFamily: fonts.heading, fontSize: '18px', color: colors.text, letterSpacing: '0.15em', marginBottom: '4px' }}>
            THE COLLECTIVE
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim, letterSpacing: '0.08em' }}>
            {mode === 'login' ? 'SIGN IN TO CONTINUE' : 'CREATE YOUR ACCOUNT'}
          </div>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'register' && (
            <div>
              <label style={styles.label}>Display Name</label>
              <input
                value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                style={styles.input}
              />
            </div>
          )}
          <div>
            <label style={styles.label}>Username</label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="username" required autoFocus
              style={styles.input}
            />
          </div>
          <div>
            <label style={styles.label}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={styles.input}
            />
          </div>

          {error && (
            <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: '#ff9090', padding: '8px 10px',
              background: 'rgba(255,96,96,0.08)', borderRadius: radius.sm, border: '1px solid rgba(255,96,96,0.2)' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            ...styles.btnPrimary, marginTop: '4px',
            opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: fonts.mono, fontSize: '11px', color: colors.dim,
              textDecoration: 'underline', letterSpacing: '0.04em' }}>
            {mode === 'login' ? 'Create an account' : 'Already have an account?'}
          </button>
        </div>
      </div>
    </div>
  );
}
