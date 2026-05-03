import React, { useState, useEffect } from 'react';
import { colors, fonts, radius, styles } from '../../theme/tokens.js';
import { api } from '../../api/index.js';
import { useUIStore } from '../../store/ui.js';

const PROVIDERS = [
  { id: 'groq',     label: 'Groq',        placeholder: 'gsk_...',     field: 'groq_api_key',      doc: 'console.groq.com — free tier, fast inference' },
  { id: 'claude',   label: 'Claude API',  placeholder: 'sk-ant-...',  field: 'anthropic_api_key', doc: 'console.anthropic.com' },
  { id: 'ollama',   label: 'Ollama URL',  placeholder: 'http://localhost:11434', field: 'ollama_url', doc: 'Runs on localhost by default' },
  { id: 'lmstudio', label: 'LM Studio',   placeholder: 'http://localhost:1234',  field: 'lmstudio_url', doc: 'Enable Local Server in LM Studio' },
];

const NATIVE_ROLES = [
  { key: 'native_model_pneuma', label: 'Pneuma (Chat)',    hint: 'General reasoning model' },
  { key: 'native_model_techne', label: 'Techne (Code)',    hint: 'Code-focused model' },
  { key: 'native_model_opsis',  label: 'Opsis (Vision)',   hint: 'Vision / multimodal model' },
];

const FIELD_MAP = {
  groq_api_key:      'groq_key',
  anthropic_api_key: 'anthropic_key',
  ollama_url:        'ollama_url',
  lmstudio_url:      'lmstudio_url',
};

export default function ProviderSettings() {
  const { notify } = useUIStore();
  const [values, setValues] = useState({});
  const [nativePaths, setNativePaths] = useState({ native_model_pneuma: '', native_model_techne: '', native_model_opsis: '' });
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings.get().then(cfg => {
      const v = {};
      PROVIDERS.forEach(p => { v[p.field] = cfg[FIELD_MAP[p.field] || p.field] || ''; });
      setValues(v);
      setNativePaths({
        native_model_pneuma: cfg.native_model_pneuma || '',
        native_model_techne: cfg.native_model_techne || '',
        native_model_opsis:  cfg.native_model_opsis  || '',
      });
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const body = {};
      if (values['groq_api_key'])      body.groq_key      = values['groq_api_key'];
      if (values['anthropic_api_key']) body.anthropic_key = values['anthropic_api_key'];
      if (values['ollama_url'])        body.ollama_url    = values['ollama_url'];
      if (values['lmstudio_url'])      body.lmstudio_url  = values['lmstudio_url'];
      body.native_model_pneuma = nativePaths.native_model_pneuma;
      body.native_model_techne = nativePaths.native_model_techne;
      body.native_model_opsis  = nativePaths.native_model_opsis;
      await api.settings.save(body);
      notify('Settings saved ✦');
    } catch (e) { notify(e.message, 'error'); }
    setSaving(false);
  }

  async function testProvider(id) {
    setTesting(t => ({ ...t, [id]: true }));
    setTestResults(r => ({ ...r, [id]: null }));
    try {
      const data = await api.settings.test(id);
      setTestResults(r => ({ ...r, [id]: data.ok ? 'ok' : data.msg || 'failed' }));
    } catch (e) {
      setTestResults(r => ({ ...r, [id]: e.message }));
    }
    setTesting(t => ({ ...t, [id]: false }));
  }

  async function browseGguf(key) {
    if (!window.electronAPI?.selectFile) {
      notify('File browser only available in the desktop app', 'error');
      return;
    }
    const path = await window.electronAPI.selectFile([{ name: 'GGUF Models', extensions: ['gguf'] }]);
    if (path) setNativePaths(p => ({ ...p, [key]: path }));
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

      {/* Native GGUF models */}
      <div style={{ ...styles.card, marginBottom: '12px' }}>
        <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.gold,
          letterSpacing: '0.1em', marginBottom: '10px' }}>NATIVE GGUF MODELS</div>
        <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim,
          marginBottom: '14px', lineHeight: '1.6' }}>
          Pick .gguf files to run Logos fully offline without any API key.
          Models auto-load on startup when configured.
        </div>
        {NATIVE_ROLES.map(r => (
          <div key={r.key} style={{ marginBottom: '12px' }}>
            <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.text,
              marginBottom: '2px' }}>{r.label}</div>
            <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim,
              marginBottom: '6px' }}>{r.hint}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={nativePaths[r.key] || ''}
                onChange={e => setNativePaths(p => ({ ...p, [r.key]: e.target.value }))}
                placeholder="Path to .gguf file…"
                style={{ ...styles.input, flex: 1, fontFamily: fonts.mono, fontSize: '10px' }}
              />
              {window.electronAPI?.selectFile && (
                <button onClick={() => browseGguf(r.key)} style={{
                  ...styles.btnGhost, padding: '6px 12px', fontSize: '11px', flexShrink: 0,
                }}>Browse</button>
              )}
            </div>
          </div>
        ))}
      </div>

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
