/**
 * Perf Lab domain helpers, shared by the lab store and the pages it feeds.
 * Pure functions only — no React, no network — so the test suite can import them.
 */

export const STRESS_PRESETS = [
  { id: '', label: 'Custom', hint: 'Use form VUs / duration', vus: null, profile: '', policy: 'custom', workers: null },
  { id: 'smoke', label: 'Smoke', hint: '2 VUs · 30s · 1 worker', vus: 2, profile: '', policy: 'custom', workers: 1, duration: 30 },
  { id: 'smooth', label: 'Smooth', hint: 'Ramp profile · local Docker workers', vus: null, profile: 'ramp', policy: 'smooth', workers: null },
  { id: 'sustained', label: 'Sustained', hint: 'Soak · 10 VUs · 2 workers', vus: 10, profile: 'soak', policy: 'sustained', workers: 2, duration: 300 },
  { id: 'stress', label: 'Stress', hint: 'Spike · 50 VUs · 4 workers', vus: 50, profile: 'spike', policy: 'stress', workers: 4, duration: 60 },
  { id: 'ramp', label: 'Ramp', hint: 'Profile ramp · current VUs', vus: null, profile: 'ramp', policy: 'smooth', workers: null },
]

export const STEP_TYPES = [
  { value: 'http', label: 'HTTP request' },
  { value: 'extract', label: 'Extract variable' },
  { value: 'assert', label: 'Assert' },
  { value: 'transaction', label: 'Transaction label' },
  { value: 'if', label: 'If controller' },
  { value: 'while', label: 'While controller' },
  { value: 'loop', label: 'Loop controller' },
  { value: 'foreach', label: 'ForEach controller' },
  { value: 'fragment', label: 'Fragment (reusable)' },
  { value: 'include', label: 'Link / include fragment' },
  { value: 'rendezvous', label: 'Burst (synchronising timer)' },
]

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']

export const emptyStep = () => ({
  type: 'http',
  name: 'Request',
  method: 'GET',
  url: `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8092')}/api/health`,
  body: '',
  think_ms: 50,
  headers: {},
  selector_type: '',
  selector: '',
  page_url: '',
  ui_action: '',
  children: [],
})

export function headersToText(headers) {
  if (!headers || typeof headers !== 'object') return ''
  return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n')
}

export function textToHeaders(text) {
  const out = {}
  String(text || '').split('\n').forEach((line) => {
    const i = line.indexOf(':')
    if (i <= 0) return
    const k = line.slice(0, i).trim()
    const v = line.slice(i + 1).trim()
    if (k) out[k] = v
  })
  return out
}

/** Fragment inputs edit as `name=value` lines and save as a plain object. */
export function paramsToText(params) {
  if (!params || typeof params !== 'object') return ''
  return Object.entries(params).map(([k, v]) => `${k}=${v}`).join('\n')
}

export function textToParams(text) {
  const out = {}
  String(text || '').split('\n').forEach((line) => {
    const i = line.indexOf('=')
    if (i <= 0) return
    const k = line.slice(0, i).trim()
    if (k) out[k] = line.slice(i + 1).trim()
  })
  return out
}

export function parseJSONField(raw, fallback) {
  try {
    if (raw == null || raw === '') return fallback
    return typeof raw === 'string' ? JSON.parse(raw || 'null') ?? fallback : raw
  } catch {
    return fallback
  }
}

export const parseSummary = (row) => parseJSONField(row?.summary_json, {})

/** A sample is a failure unless it says otherwise. */
export const sampleFailed = (s) => !(s?.ok || s?.ok === 1)

export function percentile(sortedValues, p) {
  if (!sortedValues.length) return 0
  const idx = Math.min(sortedValues.length - 1, Math.ceil(p * sortedValues.length) - 1)
  return sortedValues[Math.max(0, idx)] || 0
}

/**
 * Live KPIs for a run: the server summary when it has one, otherwise computed
 * from the streamed samples. `source` says which, so the page can label it.
 */
export function liveKpisFor(runDetail, samples) {
  const summary = parseSummary(runDetail)
  const n = Number(summary.requests || summary.samples || summary.n) || 0
  if (n > 0) {
    return {
      n,
      p50: Number(summary.p50_ms) || 0,
      p95: Number(summary.p95_ms) || 0,
      p99: Number(summary.p99_ms) || 0,
      err: Number(summary.error_rate) || 0,
      source: 'summary',
    }
  }
  if (!samples.length) return { n: 0, p50: 0, p95: 0, p99: 0, err: 0, source: 'none' }
  const lats = samples.map((s) => Number(s.latency_ms) || 0).sort((a, b) => a - b)
  const errors = samples.filter(sampleFailed).length
  return {
    n: samples.length,
    p50: percentile(lats, 0.5),
    p95: percentile(lats, 0.95),
    p99: percentile(lats, 0.99),
    err: samples.length ? errors / samples.length : 0,
    source: 'samples',
  }
}

export const DEFAULT_FORM = () => ({
  name: 'my-load-test',
  // Default to the compose-network instrumented demo so Open traces /
  // load_run_id correlation works (example.com never reports APM spans).
  target_url: 'http://node-app:3000/hello',
  method: 'GET',
  vus: 10,
  duration_seconds: 60,
  steps: [emptyStep()],
  datasets: { csv: { inline: '', variableNames: 'user,token', delimiter: ',', recycle: true } },
  sla: { p95_ms: 500, error_rate_max: 0.05 },
  schedule: { ramp_seconds: 10, enabled: false, every_minutes: 0, daily_at: '' },
  jmx_xml: '',
})
