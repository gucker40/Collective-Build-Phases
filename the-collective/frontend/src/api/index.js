import { useAuthStore } from '../store/auth.js';

export const BASE =
  typeof window !== 'undefined' && window.electronAPI
    ? 'http://localhost:8000'
    : (import.meta.env.VITE_API_URL || 'http://localhost:8000');

export function authHeaders() {
  const token = useAuthStore.getState().token;
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

export async function apiFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function apiStream(path, body) {
  const token = useAuthStore.getState().token;
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export const api = {
  // ── Auth ───────────────────────────────────────────────────────────────────
  auth: {
    count:    ()     => apiFetch('/users/count'),
    register: (body) => apiFetch('/users/register', { method: 'POST', body: JSON.stringify(body) }),
    login:    (body) => apiFetch('/users/login',    { method: 'POST', body: JSON.stringify(body) }),
    me:       ()     => apiFetch('/users/me'),
  },

  // ── Settings ───────────────────────────────────────────────────────────────
  settings: {
    get:         ()     => apiFetch('/settings'),
    save:        (body) => apiFetch('/settings', { method: 'POST', body: JSON.stringify(body) }),
    saveSecrets: (body) => apiFetch('/settings', { method: 'POST', body: JSON.stringify(body) }),
    test:        (p)    => apiFetch(`/test/${p}`, { method: 'POST' }),
  },

  // ── Artifacts ──────────────────────────────────────────────────────────────
  artifacts: {
    list:   ()     => apiFetch('/artifacts/list'),
    get:    (id)   => apiFetch(`/artifacts/get/${id}`),
    save:   (body) => apiFetch('/artifacts/save', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id)   => apiFetch(`/artifacts/delete/${id}`, { method: 'DELETE' }),
  },

  // ── Chat history ───────────────────────────────────────────────────────────
  history: {
    list:   ()    => apiFetch('/history/list'),
    load:   (id)  => apiFetch(`/history/load/${id}`),
    save:   (b)   => apiFetch('/history/save', { method: 'POST', body: JSON.stringify(b) }),
    delete: (id)  => apiFetch(`/history/delete/${id}`, { method: 'DELETE' }),
  },

  // ── Memory ─────────────────────────────────────────────────────────────────
  memory: {
    list:   ()    => apiFetch('/memory/list'),
    seal:   (b)   => apiFetch('/memory/seal',   { method: 'POST', body: JSON.stringify(b) }),
    unseal: (id)  => apiFetch(`/memory/unseal/${id}`, { method: 'DELETE' }),
    delete: (id)  => apiFetch(`/memory/unseal/${id}`, { method: 'DELETE' }),
    search: (q)   => apiFetch(`/memory/search?query=${encodeURIComponent(q)}&n=10`, { method: 'POST' }),
  },

  // ── Data Vault (notes) ─────────────────────────────────────────────────────
  vault: {
    list:   ()    => apiFetch('/vault/files'),
    load:   (fn)  => apiFetch(`/vault/load?filename=${encodeURIComponent(fn)}`),
    save:   (b)   => apiFetch('/vault/save',   { method: 'POST', body: JSON.stringify(b) }),
    delete: (fn)  => apiFetch(`/vault/delete?filename=${encodeURIComponent(fn)}`, { method: 'DELETE' }),
  },

  // ── Skills ─────────────────────────────────────────────────────────────────
  skills: {
    list:      ()    => apiFetch('/skills/list'),
    toggle:    (id)  => apiFetch(`/skills/toggle/${id}`,    { method: 'POST' }),
    enable:    (id)  => apiFetch(`/skills/toggle/${id}`,    { method: 'POST' }),
    disable:   (id)  => apiFetch(`/skills/toggle/${id}`,    { method: 'POST' }),
    install:   (url) => apiFetch('/skills/install',         { method: 'POST', body: JSON.stringify({ url }) }),
    uninstall: (id)  => apiFetch(`/skills/uninstall/${id}`, { method: 'DELETE' }),
  },

  // ── Logos (chat) ───────────────────────────────────────────────────────────
  logos: {
    status:  ()    => apiFetch('/logos/status'),
    intent:  (p)   => apiFetch('/logos/intent', { method: 'POST', body: JSON.stringify({ prompt: p }) }),
    warmup:  ()    => apiFetch('/logos/warmup',  { method: 'POST' }),
    stream:  (b)   => apiStream('/logos/stream', b),
  },

  // ── Network / tunnel ───────────────────────────────────────────────────────
  network: {
    status:    ()      => apiFetch('/network/status'),
    config:    ()      => apiFetch('/network/config'),
    save:      (b)     => apiFetch('/network/config', { method: 'POST', body: JSON.stringify(b) }),
    saveToken: (token) => apiFetch('/network/config', { method: 'POST', body: JSON.stringify({ tunnel_token: token }) }),
    start:     ()      => apiFetch('/network/tunnel/start', { method: 'POST' }),
    stop:      ()      => apiFetch('/network/tunnel/stop',  { method: 'POST' }),
    log:       ()      => apiFetch('/network/tunnel/log'),
  },

  // ── Finance ────────────────────────────────────────────────────────────────
  finance: {
    list:   ()     => apiFetch('/finance/list'),
    create: (b)    => apiFetch('/finance/create', { method: 'POST', body: JSON.stringify(b) }),
    delete: (id)   => apiFetch(`/finance/delete/${id}`, { method: 'DELETE' }),
  },

  // ── Tasks (Productivity) ───────────────────────────────────────────────────
  tasks: {
    list:   ()          => apiFetch('/tasks/list'),
    create: (b)         => apiFetch('/tasks/create',       { method: 'POST', body: JSON.stringify(b) }),
    update: (id, b)     => apiFetch(`/tasks/update/${id}`, { method: 'PUT',  body: JSON.stringify(b) }),
    delete: (id)        => apiFetch(`/tasks/delete/${id}`, { method: 'DELETE' }),
  },

  // ── Board ──────────────────────────────────────────────────────────────────
  board: {
    list:   ()    => apiFetch('/board/posts'),
    create: (b)   => apiFetch('/board/posts',           { method: 'POST',   body: JSON.stringify(b) }),
    vote:   (id)  => apiFetch(`/board/posts/${id}/vote`, { method: 'POST' }),
    delete: (id)  => apiFetch(`/board/posts/${id}`,      { method: 'DELETE' }),
  },
};
