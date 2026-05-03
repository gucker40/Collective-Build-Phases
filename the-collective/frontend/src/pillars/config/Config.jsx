import React, { useState, useEffect } from 'react';
import { colors, fonts, radius, styles } from '../../theme/tokens.js';
import { api } from '../../api/index.js';
import { useUIStore } from '../../store/ui.js';
import { useAuthStore } from '../../store/auth.js';
import ProviderSettings from './ProviderSettings.jsx';
import AboutMission from './AboutMission.jsx';

const TABS = ['providers', 'skills', 'network', 'about'];

function SkillCard({ skill, onToggle, onUninstall }) {
  return (
    <div style={{ ...styles.card, marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontFamily: fonts.mono, fontSize: '12px', color: colors.text }}>{skill.name}</span>
            {skill.builtin && (
              <span style={{ fontFamily: fonts.mono, fontSize: '9px', color: colors.gold,
                background: 'rgba(240,192,64,0.1)', padding: '1px 6px', borderRadius: '3px',
                border: `1px solid rgba(240,192,64,0.2)` }}>BUILT-IN</span>
            )}
          </div>
          <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim, lineHeight: '1.5' }}>
            {skill.description}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
          <button onClick={() => onToggle(skill)} style={{
            padding: '4px 12px', borderRadius: radius.sm, cursor: 'pointer', border: 'none',
            fontFamily: fonts.mono, fontSize: '10px', letterSpacing: '0.04em',
            background: skill.enabled ? 'rgba(80,216,144,0.15)' : 'rgba(255,255,255,0.05)',
            color: skill.enabled ? colors.success : colors.dim,
          }}>{skill.enabled ? 'ON' : 'OFF'}</button>
          {!skill.builtin && (
            <button onClick={() => onUninstall(skill.id)} style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: colors.dim, fontSize: '12px',
            }}>✕</button>
          )}
        </div>
      </div>
    </div>
  );
}

function NetworkTab() {
  const { notify } = useUIStore();
  const [token, setToken] = useState('');
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.network.status().then(s => { setStatus(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function saveToken() {
    setSaving(true);
    try {
      await api.network.saveToken(token);
      notify('Tunnel token saved ✦');
      setToken('');
      const s = await api.network.status();
      setStatus(s);
    } catch (e) { notify(e.message, 'error'); }
    setSaving(false);
  }

  async function startTunnel() {
    try {
      await api.network.start();
      notify('Tunnel starting...');
      setTimeout(async () => {
        const s = await api.network.status();
        setStatus(s);
      }, 3000);
    } catch (e) { notify(e.message, 'error'); }
  }

  async function stopTunnel() {
    try {
      await api.network.stop();
      const s = await api.network.status();
      setStatus(s);
      notify('Tunnel stopped');
    } catch (e) { notify(e.message, 'error'); }
  }

  if (loading) return <div style={{ padding: '20px', fontFamily: fonts.mono, fontSize: '11px', color: colors.dim }}>Loading...</div>;

  return (
    <div>
      <div style={{ ...styles.card, marginBottom: '16px' }}>
        <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.gold,
          letterSpacing: '0.1em', marginBottom: '12px' }}>CLOUDFLARE TUNNEL</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%',
            background: status?.running ? colors.success : colors.dim }} />
          <span style={{ fontFamily: fonts.mono, fontSize: '11px', color: status?.running ? colors.success : colors.dim }}>
            {status?.running ? `Active · ${status.url || ''}` : 'Inactive'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={startTunnel} disabled={status?.running} style={{
            ...styles.btnPrimary, opacity: status?.running ? 0.4 : 1,
            cursor: status?.running ? 'not-allowed' : 'pointer',
          }}>Start</button>
          <button onClick={stopTunnel} disabled={!status?.running} style={{
            ...styles.btnGhost, opacity: !status?.running ? 0.4 : 1,
            cursor: !status?.running ? 'not-allowed' : 'pointer',
          }}>Stop</button>
        </div>
      </div>

      <div style={{ ...styles.card }}>
        <div style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.gold,
          letterSpacing: '0.1em', marginBottom: '12px' }}>TUNNEL TOKEN</div>
        <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim, marginBottom: '10px' }}>
          Get a free token from Cloudflare Zero Trust dashboard. Stored securely in secrets.json.
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={token} onChange={e => setToken(e.target.value)}
            placeholder="eyJ..." type="password"
            style={{ ...styles.input, flex: 1, fontFamily: fonts.mono, fontSize: '11px' }} />
          <button onClick={saveToken} disabled={!token || saving} style={styles.btnGold}>
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillsTab() {
  const { notify } = useUIStore();
  const [skills, setSkills] = useState([]);
  const [installUrl, setInstallUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.skills.list().then(s => { setSkills(s || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function toggle(skill) {
    try {
      const updated = await (skill.enabled ? api.skills.disable(skill.id) : api.skills.enable(skill.id));
      setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, enabled: !s.enabled } : s));
    } catch (e) { notify(e.message, 'error'); }
  }

  async function uninstall(id) {
    try {
      await api.skills.uninstall(id);
      setSkills(prev => prev.filter(s => s.id !== id));
      notify('Skill removed');
    } catch (e) { notify(e.message, 'error'); }
  }

  async function install(e) {
    e.preventDefault();
    try {
      const skill = await api.skills.install(installUrl);
      setSkills(prev => [...prev, skill]);
      setInstallUrl('');
      notify('Skill installed ✦');
    } catch (e) { notify(e.message, 'error'); }
  }

  if (loading) return <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim }}>Loading...</div>;

  return (
    <div>
      <form onSubmit={install} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input value={installUrl} onChange={e => setInstallUrl(e.target.value)}
          placeholder="Skill URL (.skill.json)" style={{ ...styles.input, flex: 1 }} />
        <button type="submit" disabled={!installUrl} style={styles.btnPrimary}>Install</button>
      </form>
      {skills.length === 0 && (
        <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim, textAlign: 'center', padding: '30px' }}>
          No skills installed.
        </div>
      )}
      {skills.map(s => <SkillCard key={s.id} skill={s} onToggle={toggle} onUninstall={uninstall} />)}
    </div>
  );
}

export default function Config() {
  const [tab, setTab] = useState('providers');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: colors.bg }}>
      {/* Header */}
      <div style={{ padding: '18px 24px 0', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: fonts.heading, fontSize: '14px', color: colors.text,
          letterSpacing: '0.12em', marginBottom: '14px' }}>CONFIG</div>
        <div style={{ display: 'flex', gap: '0' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 16px', background: 'transparent', border: 'none',
              borderBottom: tab === t ? `2px solid ${colors.purple}` : '2px solid transparent',
              cursor: 'pointer', fontFamily: fonts.mono, fontSize: '11px', letterSpacing: '0.06em',
              color: tab === t ? colors.purpleHi : colors.dim, transition: 'all 0.15s',
            }}>{t.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {tab === 'providers' && <ProviderSettings />}
        {tab === 'skills'    && <SkillsTab />}
        {tab === 'network'   && <NetworkTab />}
        {tab === 'about'     && <AboutMission />}
      </div>
    </div>
  );
}
