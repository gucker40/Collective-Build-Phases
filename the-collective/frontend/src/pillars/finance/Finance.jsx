import React, { useState, useEffect, useCallback } from 'react';
import { colors, fonts, radius, styles } from '../../theme/tokens.js';
import { api } from '../../api/index.js';
import { useUIStore } from '../../store/ui.js';

const CATEGORIES = ['Income', 'Housing', 'Food', 'Transport', 'Entertainment', 'Health', 'Shopping', 'Savings', 'Other'];

function fmt(n) {
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-' : '') + '$' + s;
}

function TxRow({ tx, onDelete }) {
  const isIncome = tx.amount > 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '10px 16px', borderBottom: `1px solid ${colors.border}`,
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
        background: isIncome ? 'rgba(80,216,144,0.1)' : 'rgba(255,150,100,0.1)',
        border: `1px solid ${isIncome ? 'rgba(80,216,144,0.2)' : 'rgba(255,150,100,0.2)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: fonts.mono, fontSize: '14px', color: isIncome ? colors.success : '#ff9966',
      }}>{isIncome ? '+' : '−'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: fonts.mono, fontSize: '12px', color: colors.text, marginBottom: '2px' }}>
          {tx.description || tx.category}
        </div>
        <div style={{ fontFamily: fonts.mono, fontSize: '10px', color: colors.dim }}>
          {tx.category} · {tx.date ? new Date(tx.date).toLocaleDateString() : '—'}
        </div>
      </div>
      <div style={{ fontFamily: fonts.heading, fontSize: '14px',
        color: isIncome ? colors.success : '#ff9966', letterSpacing: '0.03em' }}>
        {fmt(tx.amount)}
      </div>
      <button onClick={() => onDelete(tx.id)} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: colors.dim, fontSize: '12px', padding: '2px',
      }}>✕</button>
    </div>
  );
}

export default function Finance() {
  const { notify } = useUIStore();
  const [txs, setTxs] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', category: 'Other', date: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setTxs(await api.finance.list()); }
    catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addTx(e) {
    e.preventDefault();
    try {
      const amt = parseFloat(form.amount);
      if (isNaN(amt)) throw new Error('Invalid amount');
      const tx = await api.finance.create({ ...form, amount: amt });
      setTxs(prev => [tx, ...prev]);
      setForm({ description: '', amount: '', category: 'Other', date: new Date().toISOString().split('T')[0] });
      setShowAdd(false);
    } catch (err) { notify(err.message, 'error'); }
  }

  async function deleteTx(id) {
    try {
      await api.finance.delete(id);
      setTxs(prev => prev.filter(t => t.id !== id));
    } catch {}
  }

  const total = txs.reduce((s, t) => s + t.amount, 0);
  const income = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expenses = txs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: colors.bg }}>
      {/* Header */}
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontFamily: fonts.heading, fontSize: '14px', color: colors.text,
            letterSpacing: '0.12em', flex: 1 }}>FINANCE</div>
          <button onClick={() => setShowAdd(v => !v)} style={styles.btnPrimary}>
            {showAdd ? 'Cancel' : '+ Transaction'}
          </button>
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { label: 'NET', value: fmt(total), color: total >= 0 ? colors.success : '#ff9966' },
            { label: 'INCOME', value: fmt(income), color: colors.success },
            { label: 'EXPENSES', value: fmt(expenses), color: '#ff9966' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ flex: 1, padding: '10px 14px', borderRadius: radius.sm,
              background: colors.card, border: `1px solid ${colors.border}` }}>
              <div style={{ fontFamily: fonts.mono, fontSize: '9px', color: colors.dim,
                letterSpacing: '0.08em', marginBottom: '5px' }}>{label}</div>
              <div style={{ fontFamily: fonts.heading, fontSize: '16px', color, letterSpacing: '0.03em' }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={addTx} style={{
          padding: '14px 24px', borderBottom: `1px solid ${colors.border}`,
          display: 'flex', gap: '8px', flexWrap: 'wrap', flexShrink: 0,
          background: 'rgba(160,122,255,0.03)',
        }}>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description" style={{ ...styles.input, flex: '2 1 160px' }} />
          <input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="Amount (+/-)" type="number" step="0.01"
            style={{ ...styles.input, flex: '1 1 100px' }} required />
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.sm,
              padding: '7px 10px', color: colors.text, fontFamily: fonts.mono, fontSize: '11px',
              flex: '1 1 120px', cursor: 'pointer' }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            type="date" style={{ ...styles.input, flex: '1 1 130px' }} />
          <button type="submit" style={styles.btnGold}>Add</button>
        </form>
      )}

      {/* Transactions */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', fontFamily: fonts.mono,
            fontSize: '11px', color: colors.dim }}>Loading...</div>
        )}
        {!loading && txs.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', fontFamily: fonts.mono,
            fontSize: '11px', color: colors.dim }}>
            No transactions yet. Add your first one above.
          </div>
        )}
        {txs.map(tx => <TxRow key={tx.id} tx={tx} onDelete={deleteTx} />)}
      </div>
    </div>
  );
}
