/**
 * Resolve the Open Perf Lab API base URL.
 * Empty / unset in production images → same-origin nginx `/api/` proxy.
 * Local Vite default → http://127.0.0.1:8092 (opl-api).
 */
const DEFAULT_DEV = 'http://127.0.0.1:8092'

function resolveApiBase() {
  const explicit = import.meta.env.VITE_API_URL
  if (explicit !== undefined && explicit !== null) return String(explicit).replace(/\/$/, '')
  return import.meta.env.PROD ? '' : DEFAULT_DEV
}

export const API_BASE = resolveApiBase()

export function apiUrl(path = '') {
  if (!path) return API_BASE
  return `${API_BASE}${path}`
}

export const API_URLS = { API_BASE }
