import React, { useState } from 'react';
import { colors, fonts, radius, styles } from '../../theme/tokens.js';
import { api } from '../../api/index.js';
import { useUIStore } from '../../store/ui.js';

const STEPS = ['welcome', 'provider', 'apikey', 'done'];

const MODEL_OPTIONS = [
  { id: 'groq',     label: 'Groq Cloud (Recommended)', desc: 'Free API key, fast inference, no local GPU needed.', icon: '⚡' },
  { id: 'native',   label: 'Local GGUF Model',         desc: 'Drop a .gguf file in the-collective/models/ and run offline.', icon: '🖥️' },
  { id: 'lmstudio', label: 'LM Studio',                desc: 'Run LM Studio separately on port 1234.', icon: '🔬' },
  { id: 'ollama',   label: 'Ollama',                   desc: 'Run Ollama separately on port 11434.', icon: '🦙' },
  { id: 'claude',   label: 'Claude API',               desc: 'Anthropic API key — most capable fallback.', icon: '✦' },
];

const NEEDS_KEY = ['groq', 'claude'];

export default function SetupWizard({ onComplete }) {
  const { notify } = useUIStore();
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState('groq');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    try {
      const body = { setup_complete: true, preferred_provider: provider };
      if (provider === 'groq'   && apiKey) body.groq_key      = apiKey;
      if (provider === 'claude' && apiKey) body.anthropic_key = apiKey;
      await api.settings.save(body);
      notify('Setup complete ✦');
      onComplete();
    } catch (e) {
      notify('Setup failed: ' + e.message, 'error');
    }
    setSaving(false);
  }

  function next() {
    if (step === 1 && NEEDS_KEY.includes(provider)) { setStep(2); return; }
    if (step < 3) setStep(3);
  }

  const current = STEPS[step];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', width: '100vw', background: colors.bg,
    }}>
      <div style={{
        width: '480px', background: colors.card, border: `1px solid ${colors.border}`,
        borderRadius: radius.lg, padding: '40px 36px', boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
      }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginBottom: '32px' }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{
              width: i === step ? '20px' : '6px', height: '6px', borderRadius: '3px',
              background: i <= step ? colors.purple : colors.border, transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {current === 'welcome' && (
          <div style={{ textAlign: 'center' }}>
            <svg width="56" height="56" viewBox="0 0 40 40" fill="none" style={{ marginBottom: '20px' }}>
              <circle cx="20" cy="20" r="18.5" stroke="rgba(200,180,255,0.45)" strokeWidth="1"/>
              <polygon points="20,6.5 31,25.5 9,25.5" fill="none" stroke="rgba(160,122,255,0.9)" strokeWidth="1.2"/>
              <polygon points="20,33.5 9,14.5 31,14.5" fill="none" stroke="rgba(160,122,255,0.55)" strokeWidth="0.9"/>
              <circle cx="20" cy="20" r="3" fill="rgba(240,192,64,0.85)"/>
            </svg>
            <div style={{ fontFamily: fonts.heading, fontSize: '22px', color: colors.text,
              letterSpacing: '0.15em', marginBottom: '12px' }}>WELCOME</div>
            <div style={{ fontFamily: fonts.mono, fontSize: '12px', color: colors.muted,
              lineHeight: '1.7', marginBottom: '28px' }}>
              The Collective is your local AI workspace.<br/>
              Let's get Logos online in under 2 minutes.
            </div>
            <button onClick={() => setStep(1)} style={styles.btnPrimary}>Get Started</button>
          </div>
        )}

        {current === 'provider' && (
          <div>
            <div style={{ fontFamily: fonts.heading, fontSize: '14px', color: colors.text,
              letterSpacing: '0.1em', marginBottom: '6px' }}>CHOOSE YOUR AI ENGINE</div>
            <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim, marginBottom: '20px' }}>
              You can change this anytime in Config → Providers.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {MODEL_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setProvider(opt.id)} style={{
                  padding: '12px 14px', borderRadius: radius.md, cursor: 'pointer', textAlign: 'left',
                  background: provider === opt.id ? 'rgba(160,122,255,0.12)' : 'transparent',
                  border: `1px solid ${provider === opt.id ? colors.purple : colors.border}`,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>{opt.icon}</span>
                    <div>
                      <div style={{ fontFamily: fonts.heading, fontSize: '12px',
                        color: provider === opt.id ? colors.purpleHi : colors.text,
                        letterSpacing: '0.06em', marginBottom: '2px' }}>{opt.label}</div>
                      <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim }}>{opt.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(0)} style={{ ...styles.btnGhost, flex: 1 }}>Back</button>
              <button onClick={next} style={{ ...styles.btnPrimary, flex: 2 }}>Continue</button>
            </div>
          </div>
        )}

        {current === 'apikey' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ fontFamily: fonts.heading, fontSize: '14px', color: colors.text, letterSpacing: '0.1em' }}>
                {provider === 'groq' ? 'GROQ API KEY' : 'CLAUDE API KEY'}
              </div>
              <span style={{ fontFamily: fonts.mono, fontSize: '9px', color: colors.gold,
                background: 'rgba(240,192,64,0.1)', border: '1px solid rgba(240,192,64,0.25)',
                borderRadius: '4px', padding: '2px 7px', letterSpacing: '0.06em' }}>OPTIONAL</span>
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim, marginBottom: '14px' }}>
              {provider === 'groq' ? 'console.groq.com — free tier, takes 30 seconds to sign up.' : 'console.anthropic.com'}
              {' '}You can add this later in <strong style={{ color: colors.muted }}>Config → Providers</strong>.
            </div>
            <input value={apiKey} onChange={e => setApiKey(e.target.value)}
              placeholder={provider === 'groq' ? 'gsk_...' : 'sk-ant-...'} autoFocus
              type="password"
              style={{ ...styles.input, marginBottom: '12px', fontFamily: fonts.mono, fontSize: '12px' }} />
            <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim,
              padding: '8px 10px', background: 'rgba(160,122,255,0.06)', borderRadius: radius.sm,
              border: `1px solid ${colors.border}`, marginBottom: '20px' }}>
              Stored locally in secrets.json — never leaves your machine except to reach the provider.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setStep(1)} style={{ ...styles.btnGhost, flex: 1 }}>Back</button>
              <button onClick={() => setStep(3)} style={{ ...styles.btnGhost, flex: 1, color: colors.dim }}>Skip</button>
              <button onClick={() => setStep(3)} disabled={!apiKey} style={{
                ...styles.btnPrimary, flex: 2, opacity: apiKey ? 1 : 0.35,
                cursor: apiKey ? 'pointer' : 'not-allowed',
              }}>Save & Continue</button>
            </div>
          </div>
        )}

        {current === 'done' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✦</div>
            <div style={{ fontFamily: fonts.heading, fontSize: '16px', color: colors.text,
              letterSpacing: '0.12em', marginBottom: '10px' }}>YOU'RE ALL SET</div>
            <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.muted,
              lineHeight: '1.7', marginBottom: '28px' }}>
              Logos is ready. Ask it anything, build HTML dashboards,<br/>
              or explore the five pillars on the left.
            </div>
            <button onClick={finish} disabled={saving}
              style={{ ...styles.btnGold, minWidth: '160px', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving...' : 'Enter The Collective'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
