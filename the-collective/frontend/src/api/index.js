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
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    count:    ()         => apiFetch('/users/count'),
    register: (body)     => apiFetch('/users/register', { method: 'POST', body: JSON.stringify(body) }),
    login:    (body)     => apiFetch('/users/login',    { method: 'POST', body: JSON.stringify(body) }),
    me:       ()         => apiFetch('/users/me'),
  },
  settings: {
    get:  ()     => apiFetch('/settings'),
    save: (body) => apiFetch('/settings', { method: 'POST', body: JSON.stringify(body) }),
    test: (p)    => apiFetch(`/test/${p}`, { method: 'POST' }),
  },
  artifacts: {
    list:   ()     => apiFetch('/artifacts/list'),
    get:    (id)   => apiFetch(`/artifacts/get/${id}`),
    save:   (body) => apiFetch('/artifacts/save', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id)   => apiFetch(`/artifacts/delete/${id}`, { method: 'DELETE' }),
  },
  history: {
    list:   ()    => apiFetch('/history/list'),
    load:   (id)  => apiFetch(`/history/load/${id}`),
    save:   (b)   => apiFetch('/history/save', { method: 'POST', body: JSON.stringify(b) }),
    delete: (id)  => apiFetch(`/history/delete/${id}`, { method: 'DELETE' }),
  },
  memory: {
    list:   ()    => apiFetch('/memory/list'),
    seal:   (b)   => apiFetch('/memory/seal',   { method: 'POST', body: JSON.stringify(b) }),
    unseal: (id)  => apiFetch(`/memory/unseal/${id}`, { method: 'DELETE' }),
    search: (q)   => apiFetch(`/memory/search?query=${encodeURIComponent(q)}&n=10`, { method: 'POST' }),
  },
  vault: {
    list:   ()    => apiFetch('/vault/files'),
    load:   (fn)  => apiFetch(`/vault/load?filename=${encodeURIComponent(fn)}`),
    save:   (b)   => apiFetch('/vault/save',   { method: 'POST', body: JSON.stringify(b) }),
    delete: (fn)  => apiFetch(`/vault/delete?filename=${encodeURIComponent(fn)}`, { method: 'DELETE' }),
  },
  skills: {
    list:      ()    => apiFetch('/skills/list'),
    toggle:    (id)  => apiFetch(`/skills/toggle/${id}`, { method: 'POST' }),
    install:   (b)   => apiFetch('/skills/install',     { method: 'POST', body: JSON.stringify(b) }),
    uninstall: (id)  => apiFetch(`/skills/uninstall/${id}`, { method: 'DELETE' }),
  },
  logos: {
    status:  () => apiFetch('/logos/status'),
    intent:  (p) => apiFetch('/logos/intent', { method: 'POST', body: JSON.stringify({ prompt: p }) }),
    warmup:  () => apiFetch('/logos/warmup',  { method: 'POST' }),
    stream:  (b) => apiStream('/logos/stream', b),
  },
  network: {
    status: () => apiFetch('/network/status'),
    config: () => apiFetch('/network/config'),
    save:   (b) => apiFetch('/network/config', { method: 'POST', body: JSON.stringify(b) }),
    startTunnel: (t) => apiFetch('/network/tunnel/start', { method: 'POST', body: JSON.stringify({ token: t }) }),
    stopTunnel:  () => apiFetch('/network/tunnel/stop',   { method: 'POST' }),
    log:    () => apiFetch('/network/tunnel/log'),
  },
  board: {
    list:   ()    => apiFetch('/board/posts'),
    create: (b)   => apiFetch('/board/posts', { method: 'POST', body: JSON.stringify(b) }),
    vote:   (id)  => apiFetch(`/board/posts/${id}/vote`, { method: 'POST' }),
    delete: (id)  => apiFetch(`/board/posts/${id}`, { method: 'DELETE' }),
  },
};
