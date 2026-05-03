/**
 * api.js — Shared API base URL resolver
 *
 * On Electron (desktop): always use localhost:8000 — backend runs locally
 * On web/mobile (browser): use the current origin — Cloudflare proxies to backend
 *
 * Every component imports API from here instead of hardcoding localhost.
 */

const isElectron = typeof window !== "undefined" && window.electronAPI;

export const API = isElectron
  ? "http://localhost:8000"
  : window.location.origin;
