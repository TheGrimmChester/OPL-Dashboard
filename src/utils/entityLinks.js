/**
 * Optional deep-links into OPA (Open Profiling Agent) for load_run_id correlation.
 * When VITE_OPA_HUB_URL or VITE_OPA_DASHBOARD_URL is set, links are absolute.
 * Otherwise, co-deployed stacks use same-host :8088 (compose / NAS topology).
 */

function opaBase() {
  const raw = import.meta.env.VITE_OPA_HUB_URL || import.meta.env.VITE_OPA_DASHBOARD_URL || ''
  if (raw) return String(raw).replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location
    return `${protocol}//${hostname}:8088`
  }
  return ''
}

export function opaConfigured() {
  return !!opaBase()
}

export function opaHref(path = '/') {
  const base = opaBase()
  if (!base) return null
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

function withParams(path, entries) {
  const p = new URLSearchParams()
  Object.entries(entries || {}).forEach(([k, v]) => {
    if (v == null || v === '') return
    p.set(k, String(v))
  })
  const qs = p.toString()
  return qs ? `${path}?${qs}` : path
}

/** OPA Trace Explorer filtered by load_run_id — absolute when OPA URL is configured. */
export function loadRunTracesHref(runId) {
  if (!runId) return null
  const path = withParams('/traces', { load_run_id: runId })
  return opaHref(path)
}

/** Hub / dashboard home for “Open in OPA”. */
export function opaHubHref() {
  return opaHref('/')
}

/** Normalize gate API payloads (`ok` / `pass` / `status`). */
export function gatePassed(data) {
  if (!data || typeof data !== 'object') return false
  if (typeof data.pass === 'boolean') return data.pass
  if (typeof data.ok === 'boolean') return data.ok
  return String(data.status || '').toLowerCase() === 'passed'
}
