/**
 * Optional deep-links into OPA (Open Profiling Agent) for load_run_id correlation.
 * When VITE_OPA_HUB_URL or VITE_OPA_DASHBOARD_URL is set, links are absolute.
 * When unset, helpers return null so the UI can hide “Open in OPA” actions.
 */

function opaBase() {
  const raw = import.meta.env.VITE_OPA_HUB_URL || import.meta.env.VITE_OPA_DASHBOARD_URL || ''
  return String(raw).replace(/\/$/, '')
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
