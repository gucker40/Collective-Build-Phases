import React, { useState, useEffect } from 'react';
import { colors, fonts, radius, shadow } from '../theme/tokens.js';
import { useUIStore } from '../store/ui.js';
import { api } from '../api/index.js';

const isElectron = () => typeof window !== 'undefined' && window.electronAPI;

export default function ArtifactPanel({ artifact, open }) {
  const { closeArtifact, notify } = useUIStore();
  const [tab, setTab] = useState('preview');
  const [saving, setSaving] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (artifact) setEditContent(artifact.content || '');
  }, [artifact]);

  const w = open ? '480px' : '0px';

  if (!open || !artifact) {
    return <div style={{ width: 0, transition: 'width 0.3s ease', overflow: 'hidden' }} />;
  }

  const isHtml = artifact.language === 'html' || artifact.language === 'svg';
  const srcDoc = isHtml ? (editContent || artifact.content) : null;

  async function saveArtifact() {
    setSaving(true);
    try {
      await api.artifacts.save({
        id: artifact.id,
        title: artifact.title,
        language: artifact.language,
        content: editContent,
      });
      notify('Saved to Data Vault ✦');
    } catch (e) {
      notify('Save failed — ' + e.message, 'error');
    }
    setSaving(false);
  }

  async function openInBrowser() {
    if (isElectron()) {
      await window.electronAPI.openHtml(editContent || artifact.content, `${artifact.title}.html`);
    } else {
      const blob = new Blob([editContent || artifact.content], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    }
  }

  async function copyContent() {
    await navigator.clipboard?.writeText(editContent || artifact.content || '');
    notify('Copied ✦');
  }

  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{
      padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
      fontFamily: fonts.mono, fontSize: '10px', letterSpacing: '0.08em',
      background: tab === id ? 'rgba(160,122,255,0.2)' : 'transparent',
      color: tab === id ? colors.purpleHi : colors.dim,
      transition: 'all 0.15s',
    }}>{label}</button>
  );

  return (
    <div style={{
      width: w, flexShrink: 0, overflow: 'hidden', transition: 'width 0.3s ease',
      background: colors.surface, borderLeft: `1px solid ${colors.border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
        background: colors.card,
      }}>
        <span style={{ fontFamily: fonts.heading, fontSize: '11px', color: colors.gold,
          letterSpacing: '0.1em', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {artifact.title || 'ARTIFACT'}
        </span>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {isHtml && tabBtn('preview', 'Preview')}
          {tabBtn('code', 'Code')}
          <button onClick={closeArtifact} style={{
            width: '26px', height: '26px', borderRadius: '6px', border: `1px solid ${colors.border}`,
            background: 'transparent', color: colors.dim, cursor: 'pointer', fontSize: '12px',
          }}>✕</button>
        </div>
      </div>

      {/* Action bar */}
      <div style={{
        padding: '6px 12px', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', gap: '6px', flexShrink: 0,
      }}>
        {[
          ['Save', saveArtifact, saving],
          ...(isHtml ? [['Open', openInBrowser, false]] : []),
          ['Copy', copyContent, false],
        ].map(([label, fn, loading]) => (
          <button key={label} onClick={fn} disabled={loading} style={{
            padding: '5px 12px', borderRadius: radius.sm, cursor: 'pointer',
            fontFamily: fonts.mono, fontSize: '10px', letterSpacing: '0.06em',
            background: 'rgba(160,122,255,0.1)', border: `1px solid ${colors.border}`,
            color: colors.muted, transition: 'all 0.15s', opacity: loading ? 0.5 : 1,
          }}>{loading ? '...' : label}</button>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: fonts.mono, fontSize: '10px',
          color: colors.dim, alignSelf: 'center' }}>
          {artifact.language?.toUpperCase()}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {tab === 'preview' && isHtml && (
          <iframe
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-same-origin"
            style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
            title="artifact-preview"
          />
        )}
        {tab === 'code' && (
          <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
            spellCheck={false} style={{
              width: '100%', height: '100%', resize: 'none', background: 'transparent',
              border: 'none', outline: 'none', color: colors.text, fontFamily: fonts.mono,
              fontSize: '12px', lineHeight: '1.7', padding: '16px', boxSizing: 'border-box',
              caretColor: colors.purpleHi,
            }}
          />
        )}
      </div>
    </div>
  );
}
