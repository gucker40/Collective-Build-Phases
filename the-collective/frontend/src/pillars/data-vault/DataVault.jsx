import React, { useState, useEffect, useCallback } from 'react';
import { colors, fonts, radius, styles } from '../../theme/tokens.js';
import { api } from '../../api/index.js';
import { useUIStore } from '../../store/ui.js';

const TABS = ['notes', 'artifacts', 'memories'];

function formatTs(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleDateString();
}

function NoteCard({ note, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState(null);
  const [loadingContent, setLoadingContent] = useState(false);

  async function toggle() {
    if (!expanded && content === null) {
      setLoadingContent(true);
      try {
        const data = await api.vault.load(note.filename);
        setContent(data.content || '');
      } catch {
        setContent('Failed to load.');
      }
      setLoadingContent(false);
    }
    setExpanded(v => !v);
  }

  const displayName = (note.filename || 'Untitled').replace(/\.md$/, '');

  return (
    <div style={{ ...styles.card, marginBottom: '10px', cursor: 'pointer' }} onClick={toggle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: fonts.mono, fontSize: '12px', color: colors.text,
            marginBottom: '3px' }}>{displayName}</div>
          <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim }}>
            {formatTs(note.updated_at)}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(note); }} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: colors.dim, fontSize: '12px',
        }}>✕</button>
      </div>
      {expanded && (
        <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(0,0,0,0.2)',
          borderRadius: radius.sm, fontFamily: fonts.mono, fontSize: '11px',
          color: colors.muted, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
          {loadingContent ? 'Loading…' : content}
        </div>
      )}
    </div>
  );
}

function ArtifactCard({ artifact, onOpen }) {
  return (
    <div style={{ ...styles.card, marginBottom: '10px', cursor: 'pointer' }}
      onClick={() => onOpen(artifact)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '32px', height: '32px', borderRadius: '6px', flexShrink: 0,
          background: 'rgba(160,122,255,0.1)', border: `1px solid rgba(160,122,255,0.2)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: fonts.mono, fontSize: '9px', color: colors.purpleHi, letterSpacing: '0.04em' }}>
          {(artifact.language || 'txt').toUpperCase().slice(0, 3)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: fonts.mono, fontSize: '12px', color: colors.text,
            marginBottom: '2px' }}>{artifact.title}</div>
          <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim }}>
            {artifact.language} · {artifact.created_ago || ''}
          </div>
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: '9px', color: colors.purpleHi }}>
          View →
        </div>
      </div>
    </div>
  );
}

function MemoryCard({ memory, onDelete }) {
  return (
    <div style={{ ...styles.card, marginBottom: '10px' }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', marginTop: '5px',
          background: colors.gold, flexShrink: 0 }} />
        <div style={{ flex: 1, fontFamily: fonts.mono, fontSize: '11px', color: colors.muted,
          lineHeight: '1.6' }}>{memory.text || memory.preview}</div>
        <button onClick={() => onDelete(memory.id)} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: colors.dim, fontSize: '12px', flexShrink: 0,
        }}>✕</button>
      </div>
    </div>
  );
}

export default function DataVault() {
  const { notify, openArtifact } = useUIStore();
  const [tab, setTab] = useState('notes');
  const [notes, setNotes] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [memories, setMemories] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [n, a, m] = await Promise.all([
        api.vault.list().catch(() => []),
        api.artifacts.list().catch(() => []),
        api.memory.list().catch(() => []),
      ]);
      setNotes(n || []);
      setArtifacts(a || []);
      setMemories(m || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addNote(e) {
    e.preventDefault();
    try {
      await api.vault.save({ filename: newTitle || 'Untitled', content: newContent });
      setNewTitle(''); setNewContent(''); setShowAdd(false);
      await load();
    } catch (err) { notify(err.message, 'error'); }
  }

  async function deleteNote(note) {
    try {
      await api.vault.delete(note.filename);
      setNotes(prev => prev.filter(n => n.id !== note.id));
    } catch {}
  }

  async function deleteMemory(id) {
    try { await api.memory.unseal(id); setMemories(prev => prev.filter(m => m.id !== id)); }
    catch {}
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: colors.bg }}>
      {/* Header */}
      <div style={{ padding: '18px 24px 0', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ fontFamily: fonts.heading, fontSize: '14px', color: colors.text,
            letterSpacing: '0.12em', flex: 1 }}>DATA VAULT</div>
          {tab === 'notes' && (
            <button onClick={() => setShowAdd(v => !v)} style={styles.btnPrimary}>
              {showAdd ? 'Cancel' : '+ Note'}
            </button>
          )}
        </div>
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

      {/* Add note form */}
      {tab === 'notes' && showAdd && (
        <form onSubmit={addNote} style={{
          padding: '14px 24px', borderBottom: `1px solid ${colors.border}`,
          display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0,
          background: 'rgba(160,122,255,0.03)',
        }}>
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Title" style={styles.input} />
          <textarea value={newContent} onChange={e => setNewContent(e.target.value)}
            placeholder="Content..." rows={4}
            style={{ ...styles.input, resize: 'vertical', lineHeight: '1.6' }} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowAdd(false)} style={styles.btnGhost}>Cancel</button>
            <button type="submit" style={styles.btnPrimary}>Save Note</button>
          </div>
        </form>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: fonts.mono,
            fontSize: '11px', color: colors.dim }}>Loading...</div>
        )}

        {!loading && tab === 'notes' && (
          notes.length === 0
            ? <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim,
                textAlign: 'center', padding: '40px' }}>No notes yet.</div>
            : notes.map(n => <NoteCard key={n.id || n.filename} note={n} onDelete={deleteNote} />)
        )}

        {!loading && tab === 'artifacts' && (
          artifacts.length === 0
            ? <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim,
                textAlign: 'center', padding: '40px' }}>No saved artifacts yet. Ask Logos to build something.</div>
            : artifacts.map(a => <ArtifactCard key={a.id} artifact={a}
                onOpen={art => openArtifact({ ...art, content: art.content || '' })} />)
        )}

        {!loading && tab === 'memories' && (
          memories.length === 0
            ? <div style={{ fontFamily: fonts.mono, fontSize: '11px', color: colors.dim,
                textAlign: 'center', padding: '40px' }}>No sealed memories. Tell Logos to "remember" something.</div>
            : memories.map(m => <MemoryCard key={m.id} memory={m} onDelete={deleteMemory} />)
        )}
      </div>
    </div>
  );
}
