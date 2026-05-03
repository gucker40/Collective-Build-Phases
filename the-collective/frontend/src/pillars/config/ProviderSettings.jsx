import React, { useState, useEffect } from 'react';
import { colors, fonts, radius, styles } from '../../theme/tokens.js';
import { api } from '../../api/index.js';
import { useUIStore } from '../../store/ui.js';

const PROVIDERS = [
  { id: 'groq',     label: 'Groq',        placeholder: 'gsk_...',     field: 'groq_api_key',      doc: 'console.groq.com' },
  { id: 'claude',   label: 'Claude API',  placeholder: 'sk-ant-...',  field: 'anthropic_api_key', doc: 'console.anthropic.com' },
  { id: 'ollama',   label: 'Ollama URL',  placeholder: 'http://localhost:11434', field: 'ollama_url', doc: 'Runs on localhost by default' },
  { id: 'lmstudio', label: 'LM Studio',   placeholder: 'http://localhost:1234',  field: 'lmstudio_url', doc: 'Enable Local Server in LM Studio' },
];

export default function ProviderSettings() {
  const { notify } = useUIStore();
  const [values, setValues] = useState({});
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings.get().then(cfg => {
      const v = {};
      PROVIDERS.forEach(p => { v[p.field] = cfg[p.field] || ''; });
      setValues(v);
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const secrets = {};
      const config = {};
      ['groq_api_key', 'anthropic_api_key'].forEach(k => { if (values[k]) secrets[k] = values[k]; });
      ['ollama_url', 'lmstudio_url'].forEach(k => { if (values[k]) config[k] = values[k]; });
      if (Object.keys(secrets).length) await api.settings.saveSecrets(secrets);
      if (Object.keys(config).length) await api.settings.save(config);
      notify('Settings saved ✦');
    } catch (e) { notify(e.message, 'error'); }
    setSaving(false);
  }

  async function testProvider(id) {
    setTesting(t => ({ ...t, [id]: true }));
    setTestResults(r => ({ ...r, [id]: null }));
    try {
      const res = await fetch(`/api/test/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('tc_token')}` },
      });
      const data = await res.json();
      setTestResults(r => ({ ...r, [id]: data.ok ? 'ok' : data.error || 'failed' }));
    } catch (e) {
      setTestResults(r => ({ ...r, [id]: e.message }));
    }
    setTesting(t => ({ ...t, [id]: false }));
  }

  return (
    <div>
      <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.gold,
        letterSpacing: '0.1em', marginBottom: '16px' }}>AI PROVIDERS</div>
      <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim,
        marginBottom: '20px', lineHeight: '1.6' }}>
        API keys are stored in secrets.json on your machine and never leave it except to reach the provider directly.
        Logos tries providers in order: Native → Groq → LM Studio → Ollama → Claude.
      </div>

      {PROVIDERS.map(p => {
        const result = testResults[p.id];
        return (
          <div key={p.id} style={{ ...styles.card, marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontFamily: fonts.mono, fontSize: '12px', color: colors.text, flex: 1 }}>
                {p.label}
              </div>
              {result && (
                <span style={{ fontFamily: fonts.mono, fontSize: '10px',
                  color: result === 'ok' ? colors.success : '#ff9090',
                  marginRight: '8px' }}>
                  {result === 'ok' ? '✓ Connected' : `✗ ${result}`}
                </span>
              )}
              <button onClick={() => testProvider(p.id)} disabled={testing[p.id]} style={{
                ...styles.btnGhost, padding: '4px 10px', fontSize: '10px',
                opacity: testing[p.id] ? 0.5 : 1,
              }}>{testing[p.id] ? '...' : 'Test'}</button>
            </div>
            <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim, marginBottom: '8px' }}>
              {p.doc}
            </div>
            <input
              value={values[p.field] || ''}
              onChange={e => setValues(v => ({ ...v, [p.field]: e.target.value }))}
              placeholder={p.placeholder}
              type={p.field.includes('key') ? 'password' : 'text'}
              style={{ ...styles.input, fontFamily: fonts.mono, fontSize: '11px' }}
            />
          </div>
        );
      })}

      <button onClick={save} disabled={saving} style={{ ...styles.btnPrimary, marginTop: '8px' }}>
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Warmup */}
      <div style={{ ...styles.card, marginTop: '20px' }}>
        <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.gold,
          letterSpacing: '0.1em', marginBottom: '10px' }}>ENGINE</div>
        <button onClick={async () => {
          try { await api.logos.warmup(); notify('Engine warming up...'); }
          catch (e) { notify(e.message, 'error'); }
        }} style={styles.btnGhost}>
          Warm Up Engine
        </button>
      </div>
    </div>
  );
}
