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

export const ESSENTIAL_STEP_TYPES = ['http', 'transaction', 'extract', 'assert']
export const LOGIC_STEP_TYPES = ['if', 'while', 'loop', 'foreach', 'fragment', 'include', 'rendezvous']

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']

const defaultHealthUrl = () => `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8092')}/api/health`

/** Defaults for a brand-new HTTP step (and the form's initial journey). */
export const emptyStep = () => ({
  type: 'http',
  name: 'Request',
  method: 'GET',
  url: defaultHealthUrl(),
  body: '',
  think_ms: 50,
  think_ms_rand: 0,
  follow_redirects: true,
  always_encode: false,
  connect_timeout_ms: 0,
  response_timeout_ms: 0,
  headers: {},
  enabled: true,
  selector_type: '',
  selector: '',
  page_url: '',
  ui_action: '',
  children: [],
})

/**
 * Factory for palette "Add …" buttons. Headers stay a plain object for the API;
 * the inspector edits them as rows via headersToRows / rowsToHeaders.
 */
export function makeNode(type) {
  if (type === 'http') {
    return {
      ...emptyStep(),
      url: '',
    }
  }
  if (type === 'container' || type === 'transaction') {
    return {
      type: 'transaction',
      name: 'Transaction',
      enabled: true,
      include_timers: false,
      generate_parent_sample: false,
      children: [],
    }
  }
  if (type === 'if') {
    return {
      type: 'if',
      name: 'If',
      condition: '${__jexl3(true)}',
      use_expression: true,
      evaluate_all: false,
      enabled: true,
      children: [],
    }
  }
  if (type === 'while') {
    return {
      type: 'while',
      name: 'While',
      condition: '${__jexl3(false)}',
      use_expression: true,
      enabled: true,
      children: [],
    }
  }
  if (type === 'loop') {
    return {
      type: 'loop',
      name: 'Loop',
      loops: 1,
      forever: false,
      enabled: true,
      children: [],
    }
  }
  if (type === 'foreach') {
    return {
      type: 'foreach',
      name: 'ForEach',
      input_var: 'items',
      return_var: 'item',
      use_separator: true,
      enabled: true,
      children: [],
    }
  }
  if (type === 'fragment') {
    return {
      type: 'fragment',
      name: 'SharedFragment',
      enabled: true,
      children: [],
    }
  }
  if (type === 'include' || type === 'link') {
    return {
      type: 'include',
      name: 'Include',
      ref: 'SharedFragment',
      params: {},
      enabled: true,
    }
  }
  if (type === 'rendezvous') {
    return {
      type: 'rendezvous',
      name: 'Burst',
      group_size: 0,
      timeout_ms: 0,
      enabled: true,
    }
  }
  if (type === 'extract') {
    return {
      type: 'extract',
      name: 'Extract',
      engine: 'jsonpath',
      expression: '',
      var: 'token',
      match_number: 1,
      template: '$1$',
      default_value: '',
      enabled: true,
    }
  }
  return {
    type: 'assert',
    name: 'Assert',
    status: 200,
    body_contains: '',
    assert_type: 'contains',
    assert_field: 'response_code',
    assume_success: false,
    enabled: true,
  }
}

/** Headers as Name: value lines (legacy textarea). */
export function headersToText(headers) {
  if (!headers || typeof headers !== 'object') return ''
  if (Array.isArray(headers)) {
    return headers
      .filter((h) => h && (h.name || h.key))
      .map((h) => `${h.name || h.key}: ${h.value ?? ''}`)
      .join('\n')
  }
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

/** Editable table rows ↔ headers object (API shape). */
export function headersToRows(headers) {
  if (Array.isArray(headers)) {
    return headers.map((h) => ({
      name: String(h?.name || h?.key || ''),
      value: String(h?.value ?? ''),
    }))
  }
  if (!headers || typeof headers !== 'object') return []
  return Object.entries(headers).map(([name, value]) => ({
    name,
    value: String(value ?? ''),
  }))
}

export function rowsToHeaders(rows) {
  const out = {}
  for (const r of rows || []) {
    const k = String(r?.name || '').trim()
    if (k) out[k] = String(r?.value ?? '')
  }
  return out
}

/** Fragment inputs edit as `name=value` lines and save as a plain object. */
export function paramsToText(params) {
  if (!params || typeof params !== 'object') return ''
  if (Array.isArray(params)) {
    return params
      .filter((p) => p && (p.name || p.key))
      .map((p) => `${p.name || p.key}=${p.value ?? ''}`)
      .join('\n')
  }
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

export function paramsToRows(params) {
  if (Array.isArray(params)) {
    return params.map((p) => ({
      name: String(p?.name || p?.key || ''),
      value: String(p?.value ?? ''),
    }))
  }
  if (!params || typeof params !== 'object') return []
  return Object.entries(params).map(([name, value]) => ({
    name,
    value: String(value ?? ''),
  }))
}

export function rowsToParams(rows) {
  const out = {}
  for (const r of rows || []) {
    const k = String(r?.name || '').trim()
    if (k) out[k] = String(r?.value ?? '')
  }
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
  datasets: {
    csv: {
      inline: '',
      variableNames: 'user,token',
      delimiter: ',',
      recycle: true,
      stop_thread: false,
      share_mode: 'shareMode.all',
      quoted: true,
      ignore_first_line: false,
      encoding: 'UTF-8',
    },
  },
  sla: { p95_ms: 500, error_rate_max: 0.05, rps_min: 0 },
  schedule: { ramp_seconds: 10, enabled: false, every_minutes: 0, daily_at: '' },
  jmx_xml: '',
})
