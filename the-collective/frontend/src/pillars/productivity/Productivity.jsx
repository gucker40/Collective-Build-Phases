import React, { useState, useEffect, useCallback } from 'react';
import { colors, fonts, radius, styles } from '../../theme/tokens.js';
import { api } from '../../api/index.js';
import { useUIStore } from '../../store/ui.js';

const PRIORITY = { low: colors.dim, medium: colors.gold, high: '#ff9090' };

function TaskRow({ task, onToggle, onDelete }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '10px 14px', borderBottom: `1px solid ${colors.border}`,
      opacity: task.done ? 0.5 : 1, transition: 'opacity 0.2s',
    }}>
      <button onClick={() => onToggle(task)} style={{
        width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
        border: `1px solid ${task.done ? colors.success : colors.border}`,
        background: task.done ? 'rgba(80,216,144,0.15)' : 'transparent',
        cursor: 'pointer', color: colors.success, fontSize: '11px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{task.done ? '✓' : ''}</button>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: fonts.mono, fontSize: '12px',
          color: task.done ? colors.dim : colors.text,
          textDecoration: task.done ? 'line-through' : 'none' }}>
          {task.title}
        </div>
        {task.notes && (
          <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim, marginTop: '2px' }}>
            {task.notes}
          </div>
        )}
      </div>
      <div style={{
        fontFamily: fonts.mono, fontSize: '9px', letterSpacing: '0.06em',
        color: PRIORITY[task.priority] || colors.dim,
        padding: '2px 6px', borderRadius: '3px',
        background: 'rgba(255,255,255,0.04)',
      }}>{(task.priority || 'low').toUpperCase()}</div>
      <button onClick={() => onDelete(task.id)} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: colors.dim, fontSize: '13px', padding: '2px',
      }}>✕</button>
    </div>
  );
}

export default function Productivity() {
  const { notify } = useUIStore();
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    try { setTasks(await api.tasks.list()); }
    catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function addTask(e) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      const t = await api.tasks.create({ title: newTitle.trim(), priority: newPriority });
      setTasks(prev => [t, ...prev]);
      setNewTitle('');
    } catch (err) { notify('Failed: ' + err.message, 'error'); }
  }

  async function toggleTask(task) {
    try {
      const updated = await api.tasks.update(task.id, { done: !task.done });
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t));
    } catch {}
  }

  async function deleteTask(id) {
    try {
      await api.tasks.delete(id);
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch {}
  }

  const filtered = tasks.filter(t =>
    filter === 'all' ? true : filter === 'done' ? t.done : !t.done
  );
  const done = tasks.filter(t => t.done).length;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: colors.bg }}>
      {/* Header */}
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <div style={{ fontFamily: fonts.heading, fontSize: '14px', color: colors.text,
          letterSpacing: '0.12em', marginBottom: '4px' }}>PRODUCTIVITY</div>
        <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim }}>
          {done}/{tasks.length} tasks complete
        </div>
      </div>

      {/* Add task */}
      <form onSubmit={addTask} style={{
        padding: '12px 24px', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', gap: '8px', flexShrink: 0,
      }}>
        <input
          value={newTitle} onChange={e => setNewTitle(e.target.value)}
          placeholder="Add a task..." style={{ ...styles.input, flex: 1 }}
        />
        <select value={newPriority} onChange={e => setNewPriority(e.target.value)} style={{
          background: colors.surface, border: `1px solid ${colors.border}`,
          borderRadius: radius.sm, padding: '7px 10px', color: colors.text,
          fontFamily: fonts.mono, fontSize: '11px', cursor: 'pointer',
        }}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <button type="submit" style={styles.btnPrimary}>Add</button>
      </form>

      {/* Filter tabs */}
      <div style={{ padding: '8px 24px', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', gap: '6px', flexShrink: 0 }}>
        {['all', 'active', 'done'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 12px', borderRadius: '5px', border: 'none', cursor: 'pointer',
            fontFamily: fonts.mono, fontSize: '10px', letterSpacing: '0.06em',
            background: filter === f ? 'rgba(160,122,255,0.15)' : 'transparent',
            color: filter === f ? colors.purpleHi : colors.dim,
          }}>{f.toUpperCase()}</button>
        ))}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: fonts.mono,
            fontSize: '11px', color: colors.dim }}>Loading...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: fonts.mono,
            fontSize: '11px', color: colors.dim }}>
            {filter === 'done' ? 'No completed tasks yet.' : 'No tasks. Add one above.'}
          </div>
        )}
        {filtered.map(t => (
          <TaskRow key={t.id} task={t} onToggle={toggleTask} onDelete={deleteTask} />
        ))}
      </div>
    </div>
  );
}
