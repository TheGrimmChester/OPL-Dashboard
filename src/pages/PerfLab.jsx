import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  FiZap, FiPlay, FiTrash2, FiUpload, FiDownload, FiCheck,
  FiActivity, FiDatabase, FiSettings, FiBarChart2, FiGitBranch, FiShield,
  FiLayers, FiX, FiExternalLink, FiCopy,
} from 'react-icons/fi'
import { useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { apiUrl } from '../utils/apiBase'
import {
  Panel, KpiTile, DataTable, Badge, StatusPill, Tabs, EmptyState,
} from '../components/ui'
import { useToast } from '../components/ui/Toast'
import { fmtNum, fmtAgo } from '../theme/format'
import { loadRunTracesHref, gatePassed } from '../utils/entityLinks'
import VuTree, { getAtPath, patchStepAt } from '../components/VuTree'
import LoadCurveEditor from '../components/LoadCurveEditor'
import './PerfLab.css'

function OpaTracesLink({ runId, children }) {
  const href = loadRunTracesHref(runId)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="opa-btn ghost" style={{ padding: '2px 8px', fontSize: 12 }}>
      <FiExternalLink size={11} /> {children || 'Open in OPA'}
    </a>
  )
}


const TAB_DEFS = [
  { value: 'design', label: 'Design', icon: <FiLayers size={13} /> },
  { value: 'users', label: 'Users & data', icon: <FiDatabase size={13} /> },
  { value: 'capture', label: 'Capture', icon: <FiActivity size={13} /> },
  { value: 'jmx', label: 'JMX', icon: <FiSettings size={13} /> },
  { value: 'run', label: 'Run & scale', icon: <FiPlay size={13} /> },
  { value: 'results', label: 'Results', icon: <FiBarChart2 size={13} /> },
  { value: 'compare', label: 'Compare', icon: <FiGitBranch size={13} /> },
  { value: 'sla', label: 'SLA gates', icon: <FiShield size={13} /> },
]

const STRESS_PRESETS = [
  { id: '', label: 'Custom', hint: 'Use form VUs / duration', vus: null, profile: '', policy: 'custom', workers: null },
  { id: 'smoke', label: 'Smoke', hint: '2 VUs · 30s · 1 worker', vus: 2, profile: '', policy: 'custom', workers: 1, duration: 30 },
  { id: 'smooth', label: 'Smooth', hint: 'Ramp profile · local Docker workers', vus: null, profile: 'ramp', policy: 'smooth', workers: null },
  { id: 'sustained', label: 'Sustained', hint: 'Soak · 10 VUs · 2 workers', vus: 10, profile: 'soak', policy: 'sustained', workers: 2, duration: 300 },
  { id: 'stress', label: 'Stress', hint: 'Spike · 50 VUs · 4 workers', vus: 50, profile: 'spike', policy: 'stress', workers: 4, duration: 60 },
  { id: 'ramp', label: 'Ramp', hint: 'Profile ramp · current VUs', vus: null, profile: 'ramp', policy: 'smooth', workers: null },
]

const emptyStep = () => ({
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

function headersToText(headers) {
  if (!headers || typeof headers !== 'object') return ''
  return Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n')
}

function textToHeaders(text) {
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

function parseJSONField(raw, fallback) {
  try {
    if (raw == null || raw === '') return fallback
    return typeof raw === 'string' ? JSON.parse(raw || 'null') ?? fallback : raw
  } catch {
    return fallback
  }
}

/**
 * Perf Lab studio — visual scenario builder → Docker JMeter containers.
 * JMX remains the exportable source of truth; users design with forms + selectors.
 */
export default function PerfLab() {
  const toast = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const scenarios = useApi('/api/perf/scenarios', {}, { noRange: true })
  const runs = useApi('/api/perf/runs', {}, { noRange: true })
  // Baselines / federation peer list remain on OPA Agent — optional; skip until peer APIs move.
  const baselines = useApi('/api/performance/baselines', {}, { noRange: true, skip: true })
  const federationPeers = useApi('/api/federation/peers', {}, { noRange: true, skip: true })

  const initialTab = searchParams.get('tab')
  const [tab, setTab] = useState(TAB_DEFS.some((t) => t.value === initialTab) ? initialTab : 'design')
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)
  const [fanout, setFanout] = useState(false)
  const [profile, setProfile] = useState('')
  const [policy, setPolicy] = useState('')
  const [engine, setEngine] = useState('jmeter')
  const [workers, setWorkers] = useState(1)
  const [dispatch, setDispatch] = useState(true)
  const [preset, setPreset] = useState('')
  const [compareA, setCompareA] = useState('')
  const [compareB, setCompareB] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [activeRunId, setActiveRunId] = useState(searchParams.get('run') || '')
  const [runDetail, setRunDetail] = useState(null)
  const [samples, setSamples] = useState([])
  const [stepStats, setStepStats] = useState([])
  const [runners, setRunners] = useState(null)
  const [gateResult, setGateResult] = useState(null)
  const [captureIncludeStatic, setCaptureIncludeStatic] = useState(false)
  const [captureDryRun, setCaptureDryRun] = useState(true)
  const [capturePreview, setCapturePreview] = useState(null)
  const [selectedStepPath, setSelectedStepPath] = useState(null)
  const [treeExpanded, setTreeExpanded] = useState({})
  const [validateResult, setValidateResult] = useState(null)
  const [apiPolicies, setApiPolicies] = useState([])
  const [showCurve, setShowCurve] = useState(false)

  const [form, setForm] = useState({
    name: 'my-load-test',
    // Default to the compose-network instrumented demo so Open traces / load_run_id
    // correlation works (example.com never reports APM spans).
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

  const scnRows = scenarios.data?.scenarios || []
  const runRows = runs.data?.runs || []
  const baseRows = baselines.data?.baselines || []
  const peerRows = Array.isArray(federationPeers.data?.peers) ? federationPeers.data.peers : []
  const hasFederationPeers = peerRows.length > 0
  // Without peers, fan-out is local-sample-only — keep toggle off and disabled.
  useEffect(() => {
    if (!hasFederationPeers && fanout) setFanout(false)
  }, [hasFederationPeers, fanout])

  useEffect(() => {
    axios.get(apiUrl('/api/perf/load-policies'))
      .then(({ data }) => {
        if (Array.isArray(data?.policies)) setApiPolicies(data.policies)
      })
      .catch(() => { /* optional — presets remain local */ })
  }, [])

  useEffect(() => {
    if (policy === 'custom' || (Array.isArray(form.schedule?.curve) && form.schedule.curve.length)) {
      setShowCurve(true)
    }
  }, [policy]) // eslint-disable-line react-hooks/exhaustive-deps

  const engineLabel = scenarios.data?.engine || engine
  const runnerLabel = scenarios.data?.runner || 'docker'

  const scenarioTrend = useMemo(() => {
    if (!selectedId) return []
    return runRows
      .filter((r) => r.scenario_id === selectedId)
      .slice(0, 25)
      .map((r) => {
        const s = parseJSONField(r.summary_json, {})
        return {
          id: r.id,
          status: r.status,
          started_at: r.started_at,
          vus: r.vus,
          p95_ms: Number(s.p95_ms) || 0,
          error_rate: Number(s.error_rate) || 0,
          samples: Number(s.requests || s.samples || s.n) || 0,
        }
      })
  }, [selectedId, runRows])

  const flash = (tone, title, detail) => {
    setBanner({ tone, title, detail })
    toast.push(title, { tone: tone === 'error' ? 'error' : 'neutral' })
  }

  const parseSummary = (r) => parseJSONField(r?.summary_json, {})

  const compare = useMemo(() => {
    if (!compareA || !compareB) return null
    const a = runRows.find((r) => r.id === compareA)
    const b = runRows.find((r) => r.id === compareB)
    if (!a || !b) return null
    const sa = parseSummary(a)
    const sb = parseSummary(b)
    const delta = (x, y) => (Number(y) || 0) - (Number(x) || 0)
    return {
      a: { id: a.id, ...sa, vus: a.vus, status: a.status },
      b: { id: b.id, ...sb, vus: b.vus, status: b.status },
      d_p95: delta(sa.p95_ms, sb.p95_ms),
      d_p50: delta(sa.p50_ms, sb.p50_ms),
      d_err: delta(sa.error_rate, sb.error_rate),
      d_n: delta(sa.samples || sa.n, sb.samples || sb.n),
    }
  }, [compareA, compareB, runRows])

  const liveKPIs = useMemo(() => {
    const summary = parseSummary(runDetail)
    const fromSummary = Number(summary.requests || summary.samples || summary.n) > 0
    if (fromSummary) {
      return {
        n: Number(summary.requests || summary.samples || summary.n) || 0,
        p50: Number(summary.p50_ms) || 0,
        p95: Number(summary.p95_ms) || 0,
        p99: Number(summary.p99_ms) || 0,
        err: Number(summary.error_rate) || 0,
        source: 'summary',
      }
    }
    if (!samples.length) return { n: 0, p50: 0, p95: 0, p99: 0, err: 0, source: 'none' }
    const lats = samples.map((s) => Number(s.latency_ms) || 0).sort((a, b) => a - b)
    const errors = samples.filter((s) => !s.ok && s.ok !== 1).length
    const pct = (p) => {
      if (!lats.length) return 0
      const idx = Math.min(lats.length - 1, Math.ceil(p * lats.length) - 1)
      return lats[Math.max(0, idx)] || 0
    }
    return {
      n: samples.length,
      p50: pct(0.5),
      p95: pct(0.95),
      p99: pct(0.99),
      err: samples.length ? errors / samples.length : 0,
      source: 'samples',
    }
  }, [samples, runDetail])

  useEffect(() => {
    if (!activeRunId || (tab !== 'results' && tab !== 'sla')) return undefined
    let cancelled = false
    const tick = async () => {
      try {
        const [d, s, steps, runn] = await Promise.all([
          axios.get(apiUrl(`/api/perf/runs/${encodeURIComponent(activeRunId)}`)),
          axios.get(apiUrl(`/api/perf/runs/${encodeURIComponent(activeRunId)}/samples`)),
          axios.get(apiUrl(`/api/perf/runs/${encodeURIComponent(activeRunId)}/steps`)).catch(() => ({ data: { steps: [] } })),
          axios.get(apiUrl(`/api/perf/runs/${encodeURIComponent(activeRunId)}/runners`)).catch(() => ({ data: null })),
        ])
        if (!cancelled) {
          setRunDetail(d.data)
          setSamples(s.data?.samples || [])
          setStepStats(steps.data?.steps || [])
          setRunners(runn.data)
        }
      } catch { /* ignore poll errors */ }
    }
    tick()
    const t = setInterval(tick, 2000)
    return () => { cancelled = true; clearInterval(t) }
  }, [activeRunId, tab])

  // Deep-link: /lab?run=…&tab=results (also served at /)
  useEffect(() => {
    const run = searchParams.get('run')
    const tabQ = searchParams.get('tab')
    if (run && run !== activeRunId) {
      setActiveRunId(run)
      setTab(TAB_DEFS.some((t) => t.value === tabQ) ? tabQ : 'results')
    } else if (tabQ && TAB_DEFS.some((t) => t.value === tabQ) && tabQ !== tab && !run) {
      setTab(tabQ)
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const p = new URLSearchParams(searchParams)
    if (activeRunId) p.set('run', activeRunId)
    else p.delete('run')
    if (tab && tab !== 'design') p.set('tab', tab)
    else p.delete('tab')
    const next = p.toString()
    if (next !== searchParams.toString()) setSearchParams(p, { replace: true })
  }, [activeRunId, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedStep = selectedStepPath ? getAtPath(form.steps, selectedStepPath) : null

  const patchSelectedStep = (patch) => {
    if (!selectedStepPath) return
    setForm({ ...form, steps: patchStepAt(form.steps, selectedStepPath, patch) })
  }

  const applyPreset = (id) => {
    setPreset(id)
    const p = STRESS_PRESETS.find((x) => x.id === id)
    if (!p) return
    if (p.profile != null) {
      setProfile(p.profile)
      setPolicy(p.policy || p.profile)
    }
    if (p.workers != null) setWorkers(p.workers)
    const patch = {}
    if (p.vus != null) patch.vus = p.vus
    if (p.duration != null) patch.duration_seconds = p.duration
    if (Object.keys(patch).length) setForm((f) => ({ ...f, ...patch }))
  }

  const archiveScenario = async (id) => {
    const sid = id || selectedId
    if (!sid) return
    if (!window.confirm('Archive this scenario? It will disappear from the list (soft-delete).')) return
    setBusy(true)
    try {
      await axios.delete(apiUrl(`/api/perf/scenarios/${encodeURIComponent(sid)}`))
      if (selectedId === sid) setSelectedId('')
      flash('ok', 'Scenario archived', sid)
      scenarios.reload?.()
    } catch (e) {
      flash('error', 'Archive failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const duplicateScenario = async (id) => {
    const sid = id || selectedId
    if (!sid) return
    setBusy(true)
    try {
      const { data } = await axios.post(apiUrl(`/api/perf/scenarios/${encodeURIComponent(sid)}/duplicate`))
      if (data.id) {
        setSelectedId(data.id)
        await loadScenario(data.id)
      }
      flash('ok', 'Scenario duplicated', data.name || data.id)
      scenarios.reload?.()
    } catch (e) {
      flash('error', 'Duplicate failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const saveSchedule = async () => {
    if (!selectedId) {
      flash('error', 'Select a scenario', 'Save the scenario first, then patch schedule.')
      return
    }
    setBusy(true)
    try {
      const patch = {
        enabled: !!form.schedule?.enabled,
        every_minutes: Number(form.schedule?.every_minutes) || 0,
        daily_at: form.schedule?.daily_at || '',
        ramp_seconds: form.schedule?.ramp_seconds,
        curve: form.schedule?.curve,
        policy: policy || form.schedule?.policy || undefined,
        vus: form.vus,
        workers,
      }
      const { data } = await axios.post(
        apiUrl(`/api/perf/scenarios/${encodeURIComponent(selectedId)}/schedule`),
        patch,
      )
      if (data.schedule) {
        setForm((f) => ({ ...f, schedule: { ...f.schedule, ...data.schedule } }))
      }
      flash('ok', 'Schedule saved', data.honesty || 'In-process scheduler tick')
    } catch (e) {
      flash('error', 'Schedule save failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const setScheduleField = (patch) => {
    setForm((f) => ({ ...f, schedule: { ...f.schedule, ...patch } }))
  }

  const exportRunReport = async (format = 'json') => {
    if (!activeRunId) return
    try {
      if (format === 'csv') {
        await downloadExport(
          `/api/perf/runs/${encodeURIComponent(activeRunId)}/report?format=csv`,
          `opl-report-${activeRunId}.csv`,
        )
        flash('ok', 'CSV report downloaded', activeRunId)
      } else {
        setBusy(true)
        const { data } = await axios.get(apiUrl(`/api/perf/runs/${encodeURIComponent(activeRunId)}/report`))
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `opl-report-${activeRunId}.json`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        flash('ok', 'JSON report downloaded', activeRunId)
        setBusy(false)
      }
    } catch (e) {
      flash('error', 'Report export failed', e.response?.data || e.message)
      setBusy(false)
    }
  }

  const saveScenario = async () => {
    setBusy(true)
    try {
      const firstHttp = form.steps.find((s) => !s.type || s.type === 'http') || {}
      const { data } = await axios.post(apiUrl('/api/perf/scenarios/upsert'), {
        id: selectedId || undefined,
        name: form.name,
        target_url: firstHttp.url || form.target_url,
        method: firstHttp.method || form.method,
        vus: form.vus,
        duration_seconds: form.duration_seconds,
        steps: form.steps,
        datasets: form.datasets,
        sla: form.sla,
        schedule: form.schedule,
        jmx_xml: form.jmx_xml || undefined,
        thresholds: form.sla,
      })
      if (data.id) setSelectedId(data.id)
      flash('ok', 'Scenario saved', data.honesty || `id=${data.id}`)
      scenarios.reload?.()
    } catch (e) {
      flash('error', 'Save failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const loadScenario = async (id) => {
    setBusy(true)
    try {
      const { data } = await axios.get(apiUrl(`/api/perf/scenarios/${encodeURIComponent(id)}`))
      let steps = parseJSONField(data.steps_json, [])
      if (!Array.isArray(steps) || !steps.length) {
        steps = [{
          type: 'http', name: 'Request', method: data.method || 'GET',
          url: data.target_url, body: data.body || '', think_ms: 50, headers: {},
        }]
      }
      steps = steps.map((s) => ({
        ...emptyStep(),
        ...s,
        headers: s.headers && typeof s.headers === 'object' ? s.headers : {},
      }))
      const datasets = parseJSONField(data.datasets_json, form.datasets)
      const sla = parseJSONField(data.sla_json, form.sla)
      const schedule = parseJSONField(data.schedule_json, form.schedule)
      setSelectedId(id)
      setForm({
        name: data.name || form.name,
        target_url: data.target_url,
        method: data.method || 'GET',
        vus: Number(data.vus) || 10,
        duration_seconds: Number(data.duration_seconds) || 60,
        steps,
        datasets: { csv: { inline: '', variableNames: 'user,token', delimiter: ',', recycle: true, ...(datasets.csv || {}) } },
        sla: { p95_ms: 500, error_rate_max: 0.05, ...sla },
        schedule: { ramp_seconds: 10, ...schedule },
        jmx_xml: data.jmx_xml || '',
      })
      setTab('design')
      flash('ok', `Loaded ${data.name || id}`, id)
    } catch (e) {
      flash('error', 'Load failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const importJmxFile = async (file) => {
    if (!file) return
    setBusy(true)
    try {
      const text = await file.text()
      const { data } = await axios.post(
        apiUrl(`/api/perf/scenarios/import-jmx?name=${encodeURIComponent(file.name.replace(/\.jmx$/i, ''))}`),
        { name: file.name.replace(/\.jmx$/i, ''), jmx: text },
      )
      if (data.id) {
        setSelectedId(data.id)
        await loadScenario(data.id)
      }
      flash('ok', 'JMX imported', data.honesty || data.id)
      scenarios.reload?.()
    } catch (e) {
      flash('error', 'JMX import failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const importCaptureFile = async (kind, file) => {
    if (!file) return
    setBusy(true)
    setCapturePreview(null)
    try {
      const text = await file.text()
      let body
      try {
        body = JSON.parse(text)
      } catch {
        throw new Error('File must be JSON (HAR or XHR array)')
      }
      const q = new URLSearchParams()
      q.set('name', file.name.replace(/\.(har|json)$/i, ''))
      if (captureDryRun) q.set('dry_run', '1')
      if (captureIncludeStatic) q.set('include_static', '1')
      if (selectedId && !captureDryRun) q.set('id', selectedId)
      const payload = kind === 'har'
        ? (body.log ? body : { har: body })
        : (Array.isArray(body) ? { xhr: body } : body)
      const { data } = await axios.post(
        apiUrl(`/api/perf/scenarios/import-${kind}?${q}`),
        payload,
      )
      setCapturePreview(data)
      if (!captureDryRun && data.id) {
        setSelectedId(data.id)
        await loadScenario(data.id)
        scenarios.reload?.()
      } else if (data.steps?.length) {
        setForm((f) => ({
          ...f,
          name: data.scenario?.name || f.name,
          steps: data.steps.map((s) => ({ ...emptyStep(), ...s, headers: s.headers || {} })),
        }))
        setTab('design')
      }
      flash('ok', `${kind.toUpperCase()} ${captureDryRun ? 'preview' : 'imported'}`, `${data.count || data.steps?.length || 0} steps`)
    } catch (e) {
      flash('error', `${kind.toUpperCase()} import failed`, e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const applyCapturePreview = () => {
    const steps = capturePreview?.steps || capturePreview?.scenario?.steps
    if (!steps?.length) return
    setForm((f) => ({
      ...f,
      name: capturePreview.scenario?.name || f.name,
      steps: steps.map((s) => ({ ...emptyStep(), ...s, headers: s.headers || {} })),
    }))
    setTab('design')
    flash('ok', 'Steps applied to designer', `${steps.length} steps`)
  }

  const validateScenario = async () => {
    if (!selectedId) { flash('warn', 'Save the scenario first'); return }
    setBusy(true)
    try {
      const { data } = await axios.post(apiUrl(`/api/perf/scenarios/${encodeURIComponent(selectedId)}/validate`))
      setValidateResult(data)
      const ok = data.pass !== false && data.ok !== false
      flash(ok ? 'ok' : 'error', ok ? 'Validation passed' : 'Validation failed', data.honesty || `${(data.triage || []).length} triage item(s)`)
      setTab('design')
    } catch (e) {
      flash('error', 'Validate failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const startRun = async (scenarioId) => {
    const sid = scenarioId || selectedId
    if (!sid) { flash('warn', 'Save or select a scenario first'); return }
    setBusy(true)
    try {
      const { data } = await axios.post(apiUrl('/api/perf/runs'), {
        scenario_id: sid,
        vus: form.vus,
        fanout,
        profile: profile || undefined,
        policy: policy || undefined,
        engine,
        dispatch,
        workers: engine === 'jmeter' ? Number(workers) || 1 : undefined,
        schedule: form.schedule,
      })
      const rid = data.load_run_id || data.id
      if (rid) {
        setActiveRunId(rid)
        setTab('results')
      }
      const dispatched = data.dispatch?.dispatched
      flash(
        dispatched === false && data.dispatch?.error ? 'warn' : 'ok',
        dispatched ? 'Run dispatched' : 'Run created',
        data.honesty || rid,
      )
      runs.reload?.()
    } catch (e) {
      flash('error', 'Start run failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const downloadExport = async (path, filename) => {
    setBusy(true)
    try {
      const response = await axios.get(apiUrl(path), { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      flash('error', 'Export failed', e.message || 'download failed')
    } finally {
      setBusy(false)
    }
  }

  const downloadJmx = () => {
    if (!selectedId) return
    downloadExport(
      `/api/perf/scenarios/${encodeURIComponent(selectedId)}/export-jmx`,
      `${selectedId}.jmx`,
    )
  }

  const downloadCapture = (kind) => {
    if (!selectedId) return
    downloadExport(
      `/api/perf/scenarios/${encodeURIComponent(selectedId)}/export-${kind}`,
      `${selectedId}.${kind}`,
    )
  }

  const evaluateGate = async (runId) => {
    const rid = runId || activeRunId
    if (!rid) { flash('warn', 'Select a run first'); return }
    setBusy(true)
    try {
      const { data } = await axios.get(apiUrl(`/api/perf/runs/${encodeURIComponent(rid)}/gate`))
      setGateResult(data)
      setTab('sla')
      const ok = gatePassed(data)
      flash(ok ? 'ok' : 'error', ok ? 'SLA passed' : 'SLA failed', (data.reasons || []).join('; ') || rid)
    } catch (e) {
      flash('error', 'Gate failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const cancelRun = async (runId) => {
    const rid = runId || activeRunId
    if (!rid) { flash('warn', 'Select a run first'); return }
    setBusy(true)
    try {
      const { data } = await axios.post(apiUrl(`/api/perf/runs/${encodeURIComponent(rid)}/cancel`))
      flash('ok', 'Run cancelled', data.status || rid)
      setRunDetail((prev) => (prev && prev.id === rid ? { ...prev, status: data.status || 'cancelled' } : prev))
      runs.reload?.()
    } catch (e) {
      flash('error', 'Cancel failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const scnCols = [
    {
      key: 'name', header: 'Name',
      render: (r) => (
        <button type="button" className="opa-btn ghost" onClick={() => loadScenario(r.id)} style={{ padding: 0 }}>
          <span className="cell-strong">{r.name}</span>
        </button>
      ),
    },
    { key: 'vus', header: 'VUs', num: true },
    { key: 'duration_seconds', header: 'Dur', num: true },
    { key: 'jmx_bytes', header: 'JMX', num: true, render: (r) => fmtNum(r.jmx_bytes || 0) },
    {
      key: 'actions', header: '',
      render: (r) => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button type="button" className="opa-btn ghost" disabled={busy} onClick={() => startRun(r.id)} aria-label={`Start ${r.name}`}>
            <FiPlay size={12} />
          </button>
          <button type="button" className="opa-btn ghost" disabled={busy} onClick={() => duplicateScenario(r.id)} aria-label={`Duplicate ${r.name}`} title="Duplicate">
            <FiCopy size={12} />
          </button>
          <button type="button" className="opa-btn ghost" disabled={busy} onClick={() => archiveScenario(r.id)} aria-label={`Archive ${r.name}`} title="Archive">
            <FiTrash2 size={12} />
          </button>
        </div>
      ),
    },
  ]

  const stepCols = [
    { key: 'step_name', header: 'Step' },
    { key: 'samples', header: 'N', num: true },
    { key: 'avg_ms', header: 'Avg', num: true, render: (r) => fmtNum(r.avg_ms) },
    { key: 'p95_ms', header: 'p95', num: true, render: (r) => fmtNum(r.p95_ms) },
    { key: 'error_rate', header: 'Err', num: true, render: (r) => fmtNum(r.error_rate) },
  ]

  const runnerCols = [
    { key: 'name', header: 'Container', render: (r) => <span className="opa-mono" style={{ fontSize: 11 }}>{r.name}</span> },
    {
      key: 'status', header: 'Status',
      render: (r) => <StatusPill tone={r.running ? 'ok' : r.found ? 'neutral' : 'error'}>{r.status || '—'}</StatusPill>,
    },
    { key: 'image', header: 'Image', render: (r) => <span className="opa-muted" style={{ fontSize: 11 }}>{r.image || '—'}</span> },
  ]

  const runCols = [
    {
      key: 'id', header: 'Run',
      render: (r) => (
        <button
          type="button"
          className="opa-btn ghost opa-mono"
          style={{ fontSize: 11 }}
          onClick={() => { setActiveRunId(r.id); setTab('results') }}
        >
          {String(r.id).slice(0, 18)}
        </button>
      ),
    },
    { key: 'status', header: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'vus', header: 'VUs', num: true },
    {
      key: 'summary_json', header: 'Summary',
      render: (r) => {
        const s = parseSummary(r)
        return <span className="opa-mono" style={{ fontSize: 11 }}>p95={fmtNum(s.p95_ms)} err={fmtNum(s.error_rate)}</span>
      },
    },
    { key: 'started_at', header: 'When', num: true, render: (r) => <span className="opa-muted">{fmtAgo(r.started_at)}</span> },
    {
      key: 'id2', header: 'Traces',
      render: (r) => <OpaTracesLink runId={r.id} />,
    },
  ]

  const sampleCols = [
    { key: 'label', header: 'Label', render: (r) => r.step_name || r.label || r.name || r.url || '—' },
    { key: 'latency_ms', header: 'ms', num: true, render: (r) => fmtNum(r.latency_ms) },
    {
      key: 'ok', header: 'OK',
      render: (r) => <StatusPill tone={r.ok || r.ok === 1 ? 'ok' : 'error'}>{r.ok || r.ok === 1 ? 'ok' : 'err'}</StatusPill>,
    },
    { key: 'ts', header: 'When', render: (r) => <span className="opa-muted">{fmtAgo(r.ts || r.t || r.started_at)}</span> },
  ]

  const runIsActive = ['running', 'created'].includes(String(runDetail?.status || '').toLowerCase())
  const summaryPreview = parseSummary(runDetail)

  return (
    <div className="opa-stack perf-studio">
      <header className="perf-studio-hero">
        <div className="perf-studio-hero-main">
          <div className="perf-studio-kicker">Open Perf Lab</div>
          <h1 className="opa-page-title">Load test studio</h1>
          <p className="opa-page-sub">
            Design scenarios visually, parameterize datasets, scale Docker load engines, and gate on SLA.
            Correlate finished runs in OPA Trace Explorer via load_run_id (same-host :8088 by default).
          </p>
          <div className="perf-studio-meta">
            <span className="perf-chip">Engine <strong>{engineLabel}</strong></span>
            <span className="perf-chip">Runner <strong>{runnerLabel}</strong></span>
            <span className="perf-chip">Scenarios <strong>{fmtNum(scnRows.length)}</strong></span>
            <span className="perf-chip">Runs <strong>{fmtNum(runRows.length)}</strong></span>
            {selectedId && (
              <span className="perf-chip">Active <strong className="opa-mono">{String(selectedId).slice(0, 16)}</strong></span>
            )}
          </div>
        </div>
        <div className="perf-studio-actions">
          <button type="button" className="opa-btn" disabled={busy} onClick={saveScenario} aria-label="Save scenario">
            Save scenario
          </button>
          <button type="button" className="opa-btn ghost" disabled={busy || !selectedId} onClick={validateScenario} aria-label="Validate one virtual user">
            <FiCheck size={12} /> Validate 1 VU
          </button>
          <button type="button" className="opa-btn primary" disabled={busy || !selectedId} onClick={() => startRun()} aria-label="Start load run">
            <FiPlay size={12} /> Start run
          </button>
        </div>
      </header>

      {banner && (
        <div className={`perf-banner ${banner.tone || ''}`} role="status">
          <div className="perf-banner-body">
            <div className="perf-banner-title">{banner.title}</div>
            {banner.detail && <div className="perf-banner-detail">{typeof banner.detail === 'string' ? banner.detail : JSON.stringify(banner.detail)}</div>}
          </div>
          <button type="button" className="opa-btn ghost" aria-label="Dismiss" onClick={() => setBanner(null)}><FiX size={14} /></button>
        </div>
      )}

      <div className="opa-grid cols-4">
        <KpiTile label="Scenarios" icon={<FiZap size={12} />} value={fmtNum(scnRows.length)} status="neutral" />
        <KpiTile label="Runs" icon={<FiPlay size={12} />} value={fmtNum(runRows.length)} status="neutral" />
        <KpiTile label="Live samples" icon={<FiActivity size={12} />} value={fmtNum(liveKPIs.n)} status="neutral" />
        <KpiTile
          label="Active run"
          icon={<FiBarChart2 size={12} />}
          value={runDetail?.status || (activeRunId ? '…' : '—')}
          status={runDetail?.status === 'failed' ? 'error' : runDetail?.status === 'passed' || runDetail?.status === 'ok' ? 'ok' : 'neutral'}
        />
      </div>

      <Tabs tabs={TAB_DEFS} value={tab} onChange={setTab} />

      {tab === 'design' && (
        <div className="perf-split">
          <Panel title="JMeter visual editor" icon={<FiLayers />}>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="perf-field-grid">
                <div className="perf-field span-2">
                  <label htmlFor="perf-name">Scenario name</label>
                  <input id="perf-name" className="opa-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="perf-field">
                  <label htmlFor="perf-vus">Virtual users</label>
                  <input id="perf-vus" className="opa-input" type="number" min={1} value={form.vus} onChange={(e) => setForm({ ...form, vus: Number(e.target.value) })} />
                </div>
                <div className="perf-field">
                  <label htmlFor="perf-dur">Duration (s)</label>
                  <input id="perf-dur" className="opa-input" type="number" min={1} value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })} />
                </div>
                <div className="perf-field">
                  <label htmlFor="perf-ramp">Ramp-up (s)</label>
                  <input
                    id="perf-ramp"
                    className="opa-input"
                    type="number"
                    min={0}
                    value={form.schedule?.ramp_seconds ?? 10}
                    onChange={(e) => setForm({ ...form, schedule: { ...form.schedule, ramp_seconds: Number(e.target.value) } })}
                  />
                </div>
                <div className="perf-field">
                  <label htmlFor="perf-p95">SLA p95 (ms)</label>
                  <input id="perf-p95" className="opa-input" type="number" value={form.sla.p95_ms} onChange={(e) => setForm({ ...form, sla: { ...form.sla, p95_ms: Number(e.target.value) } })} />
                </div>
                <div className="perf-field">
                  <label htmlFor="perf-err">Max error rate</label>
                  <input id="perf-err" className="opa-input" type="number" step="0.01" value={form.sla.error_rate_max} onChange={(e) => setForm({ ...form, sla: { ...form.sla, error_rate_max: Number(e.target.value) } })} />
                </div>
              </div>

                              <p className="perf-hint">
                Build a nested VU tree (HTTP, transactions, If/While/Loop, extractors, asserts). Drag to reorder.
                Optional CSS/XPath selectors correlate recorded UI actions with requests.
                Saving generates JMX for Docker execution.
              </p>

              {validateResult && (
                <div
                  className={`perf-banner ${(validateResult.pass !== false && validateResult.ok !== false) ? 'ok' : 'error'}`}
                  role="status"
                >
                  <div className="perf-banner-body">
                    <div className="perf-banner-title">
                      {(validateResult.pass !== false && validateResult.ok !== false) ? 'Validation passed' : 'Validation triage'}
                    </div>
                    <div className="perf-banner-detail">
                      {validateResult.honesty
                        || (Array.isArray(validateResult.triage) && validateResult.triage.length
                          ? validateResult.triage.map((t) => (typeof t === 'string' ? t : (t.message || t.detail || JSON.stringify(t)))).join('\n')
                          : JSON.stringify(validateResult).slice(0, 600))}
                    </div>
                  </div>
                  <button type="button" className="opa-btn ghost" aria-label="Dismiss validation" onClick={() => setValidateResult(null)}><FiX size={14} /></button>
                </div>
              )}

              <div className="vu-design-layout">
                <div className="vu-design-tree">
                  <VuTree
                    steps={form.steps}
                    selectedPath={selectedStepPath}
                    onSelect={setSelectedStepPath}
                    onChange={(steps) => setForm({ ...form, steps })}
                    expanded={treeExpanded}
                    setExpanded={setTreeExpanded}
                  />
                </div>
                <div className="vu-design-inspector">
                  {!selectedStep ? (
                    <div className="perf-empty-cta">
                      <div className="title">Inspector</div>
                      <div className="perf-hint">Select a node in the VU tree to edit its properties.</div>
                    </div>
                  ) : (
                    <div className="perf-step-body" style={{ padding: 0 }}>
                      <div className="perf-field-grid wide">
                        <div className="perf-field">
                          <label>Type</label>
                          <select
                            className="opa-input"
                            aria-label="Step type"
                            value={selectedStep.type || 'http'}
                            onChange={(e) => patchSelectedStep({ type: e.target.value })}
                          >
                            <option value="http">HTTP request</option>
                            <option value="extract">Extract variable</option>
                            <option value="assert">Assert</option>
                            <option value="transaction">Transaction label</option>
                            <option value="if">If controller</option>
                            <option value="while">While controller</option>
                            <option value="loop">Loop controller</option>
                          </select>
                        </div>
                        <div className="perf-field span-2">
                          <label>Name</label>
                          <input
                            className="opa-input"
                            value={selectedStep.name || ''}
                            onChange={(e) => patchSelectedStep({ name: e.target.value })}
                            placeholder="Step name"
                            aria-label="Step name"
                          />
                        </div>
                      </div>
                      {(selectedStep.type === 'http' || !selectedStep.type) && (
                        <>
                          <div className="perf-field-grid wide">
                            <div className="perf-field">
                              <label>Method</label>
                              <select className="opa-input" value={selectedStep.method || 'GET'} onChange={(e) => patchSelectedStep({ method: e.target.value })}>
                                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                            <div className="perf-field span-3">
                              <label>URL</label>
                              <input className="opa-input" value={selectedStep.url || ''} onChange={(e) => patchSelectedStep({ url: e.target.value })} placeholder="https://… or ${token}" />
                            </div>
                            <div className="perf-field">
                              <label>Think time (ms)</label>
                              <input className="opa-input" type="number" value={selectedStep.think_ms || 0} onChange={(e) => patchSelectedStep({ think_ms: Number(e.target.value) })} />
                            </div>
                            <div className="perf-field span-3">
                              <label>Body</label>
                              <input className="opa-input" value={selectedStep.body || ''} onChange={(e) => patchSelectedStep({ body: e.target.value })} placeholder="Optional request body" />
                            </div>
                            <div className="perf-field span-3">
                              <label>Headers (Name: value per line)</label>
                              <textarea
                                className="opa-input opa-mono"
                                rows={2}
                                value={headersToText(selectedStep.headers)}
                                onChange={(e) => patchSelectedStep({ headers: textToHeaders(e.target.value) })}
                                placeholder={'Authorization: Bearer ${token}\nContent-Type: application/json'}
                              />
                            </div>
                          </div>
                          <div className="perf-field-grid wide">
                            <div className="perf-field">
                              <label>UI selector type</label>
                              <select className="opa-input" value={selectedStep.selector_type || ''} onChange={(e) => patchSelectedStep({ selector_type: e.target.value })}>
                                <option value="">—</option>
                                <option value="css">CSS</option>
                                <option value="xpath">XPath</option>
                              </select>
                            </div>
                            <div className="perf-field span-2">
                              <label>Selector</label>
                              <input className="opa-input opa-mono" value={selectedStep.selector || ''} onChange={(e) => patchSelectedStep({ selector: e.target.value })} placeholder="#login-btn or //button[@id='save']" />
                            </div>
                            <div className="perf-field">
                              <label>UI action</label>
                              <select className="opa-input" value={selectedStep.ui_action || ''} onChange={(e) => patchSelectedStep({ ui_action: e.target.value })}>
                                <option value="">—</option>
                                <option value="click">click</option>
                                <option value="fill">fill</option>
                                <option value="submit">submit</option>
                                <option value="navigate">navigate</option>
                              </select>
                            </div>
                            <div className="perf-field span-3">
                              <label>Page URL (context)</label>
                              <input className="opa-input" value={selectedStep.page_url || ''} onChange={(e) => patchSelectedStep({ page_url: e.target.value })} placeholder="https://app.example.com/login" />
                            </div>
                          </div>
                        </>
                      )}
                      {selectedStep.type === 'extract' && (
                        <div className="perf-field-grid wide">
                          <div className="perf-field">
                            <label>Engine</label>
                            <select className="opa-input" value={selectedStep.engine || 'regex'} onChange={(e) => patchSelectedStep({ engine: e.target.value })}>
                              <option value="regex">Regex</option>
                              <option value="jsonpath">JSONPath</option>
                            </select>
                          </div>
                          <div className="perf-field span-2">
                            <label>Expression</label>
                            <input className="opa-input opa-mono" value={selectedStep.expression || ''} onChange={(e) => patchSelectedStep({ expression: e.target.value })} />
                          </div>
                          <div className="perf-field">
                            <label>Variable</label>
                            <input className="opa-input" value={selectedStep.var || ''} onChange={(e) => patchSelectedStep({ var: e.target.value })} />
                          </div>
                        </div>
                      )}
                      {selectedStep.type === 'assert' && (
                        <div className="perf-field-grid wide">
                          <div className="perf-field">
                            <label>Status code</label>
                            <input className="opa-input" type="number" value={selectedStep.status || 200} onChange={(e) => patchSelectedStep({ status: Number(e.target.value) })} />
                          </div>
                          <div className="perf-field span-3">
                            <label>Body contains</label>
                            <input className="opa-input" value={selectedStep.body_contains || ''} onChange={(e) => patchSelectedStep({ body_contains: e.target.value })} />
                          </div>
                        </div>
                      )}
                      {selectedStep.type === 'transaction' && (
                        <p className="perf-hint">Transaction containers group child HTTP requests in the JMX hashTree.</p>
                      )}
                      {(selectedStep.type === 'if' || selectedStep.type === 'if_controller') && (
                        <div className="perf-field-grid wide">
                          <div className="perf-field span-3">
                            <label>Condition (JMeter expression)</label>
                            <input
                              className="opa-input opa-mono"
                              value={selectedStep.condition || ''}
                              onChange={(e) => patchSelectedStep({ condition: e.target.value })}
                              placeholder={'${__jexl3("${status}"=="200")}'}
                            />
                          </div>
                          <p className="perf-hint span-3">Emits IfController; children run when the condition is true.</p>
                        </div>
                      )}
                      {(selectedStep.type === 'while' || selectedStep.type === 'while_controller') && (
                        <div className="perf-field-grid wide">
                          <div className="perf-field span-3">
                            <label>Condition (JMeter expression)</label>
                            <input
                              className="opa-input opa-mono"
                              value={selectedStep.condition || ''}
                              onChange={(e) => patchSelectedStep({ condition: e.target.value })}
                              placeholder={'${__jexl3("${more}"=="true")}'}
                            />
                          </div>
                          <p className="perf-hint span-3">Emits WhileController — keep exit conditions tight to avoid runaway loops.</p>
                        </div>
                      )}
                      {(selectedStep.type === 'loop' || selectedStep.type === 'loop_controller') && (
                        <div className="perf-field-grid wide">
                          <div className="perf-field">
                            <label>Loops</label>
                            <input
                              className="opa-input"
                              type="number"
                              min={1}
                              value={selectedStep.loops ?? 1}
                              onChange={(e) => patchSelectedStep({ loops: Number(e.target.value) })}
                            />
                          </div>
                          <div className="perf-field">
                            <label>Forever</label>
                            <select
                              className="opa-input"
                              value={selectedStep.forever ? '1' : '0'}
                              onChange={(e) => patchSelectedStep({ forever: e.target.value === '1' })}
                            >
                              <option value="0">No</option>
                              <option value="1">Yes</option>
                            </select>
                          </div>
                          <p className="perf-hint span-3">Emits LoopController wrapping child samplers.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="perf-step-toolbar">
                <button type="button" className="opa-btn primary" disabled={busy} onClick={saveScenario}>Save (generates JMX)</button>
                <button type="button" className="opa-btn ghost" disabled={busy || !selectedId} onClick={validateScenario}><FiCheck size={12} /> Validate 1 VU</button>
                <button type="button" className="opa-btn ghost" onClick={() => setTab('capture')}>Import from Capture</button>
              </div>
            </div>
          </Panel>

          <Panel title="Scenarios" flush loading={scenarios.loading} empty={!scenarios.loading && !scnRows.length} emptyText="Save a scenario to see it listed here">
            <DataTable columns={scnCols} rows={scnRows} rowKey={(r) => r.id} maxHeight={480} />
          </Panel>
        </div>
      )}

      {tab === 'users' && (
        <Panel title="Virtual users & datasets">
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="perf-field-grid">
              <div className="perf-field">
                <label htmlFor="users-vus">Virtual users</label>
                <input id="users-vus" className="opa-input" type="number" min={1} value={form.vus} onChange={(e) => setForm({ ...form, vus: Number(e.target.value) })} />
              </div>
              <div className="perf-field">
                <label htmlFor="users-ramp">Ramp-up (s)</label>
                <input
                  id="users-ramp"
                  className="opa-input"
                  type="number"
                  min={0}
                  value={form.schedule?.ramp_seconds ?? 10}
                  onChange={(e) => setForm({ ...form, schedule: { ...form.schedule, ramp_seconds: Number(e.target.value) } })}
                />
              </div>
              <div className="perf-field">
                <label htmlFor="users-dur">Duration (s)</label>
                <input id="users-dur" className="opa-input" type="number" min={1} value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })} />
              </div>
              <div className="perf-field">
                <label htmlFor="users-recycle">CSV recycle</label>
                <select
                  id="users-recycle"
                  className="opa-input"
                  value={form.datasets.csv?.recycle ? '1' : '0'}
                  onChange={(e) => setForm({
                    ...form,
                    datasets: { ...form.datasets, csv: { ...form.datasets.csv, recycle: e.target.value === '1' } },
                  })}
                >
                  <option value="1">Yes — loop rows</option>
                  <option value="0">No — stop when exhausted</option>
                </select>
              </div>
            </div>
            <div className="perf-field">
              <label htmlFor="csv-cols">Column names</label>
              <input
                id="csv-cols"
                className="opa-input"
                value={form.datasets.csv?.variableNames || ''}
                onChange={(e) => setForm({ ...form, datasets: { ...form.datasets, csv: { ...form.datasets.csv, variableNames: e.target.value } } })}
                placeholder="user,password,token"
              />
            </div>
            <div className="perf-field">
              <label htmlFor="csv-data">CSV rows</label>
              <textarea
                id="csv-data"
                className="opa-input opa-mono"
                rows={10}
                value={form.datasets.csv?.inline || ''}
                onChange={(e) => setForm({ ...form, datasets: { ...form.datasets, csv: { ...form.datasets.csv, inline: e.target.value } } })}
                placeholder={'user1,secret1,tok1\nuser2,secret2,tok2'}
              />
            </div>
            <p className="perf-hint">Reference columns as {'${user}'} in URLs, headers, and bodies after save.</p>
            <div>
              <button type="button" className="opa-btn primary" disabled={busy} onClick={saveScenario}>Save users & datasets</button>
            </div>
          </div>
        </Panel>
      )}

      {tab === 'capture' && (
        <Panel title="Capture → steps">
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p className="perf-hint">
              Import a browser HAR or an XHR/fetch JSON log. Entries become HTTP steps with optional UI selector metadata.
              Prefer dry-run preview before persisting.
            </p>
            <div className="perf-field-grid">
              <div className="perf-field">
                <label>Mode</label>
                <select className="opa-input" value={captureDryRun ? 'dry' : 'save'} onChange={(e) => setCaptureDryRun(e.target.value === 'dry')}>
                  <option value="dry">Dry-run preview</option>
                  <option value="save">Persist scenario</option>
                </select>
              </div>
              <div className="perf-field">
                <label>Static assets</label>
                <select className="opa-input" value={captureIncludeStatic ? '1' : '0'} onChange={(e) => setCaptureIncludeStatic(e.target.value === '1')}>
                  <option value="0">Skip CSS/JS/images</option>
                  <option value="1">Include static</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <label className="opa-btn">
                <FiUpload size={12} /> Import .har
                <input type="file" accept=".har,application/json,text/json" hidden onChange={(e) => importCaptureFile('har', e.target.files?.[0])} />
              </label>
              <label className="opa-btn ghost">
                <FiUpload size={12} /> Import XHR JSON
                <input type="file" accept=".json,application/json" hidden onChange={(e) => importCaptureFile('xhr', e.target.files?.[0])} />
              </label>
              <button type="button" className="opa-btn ghost" disabled={!selectedId} onClick={() => downloadCapture('har')}><FiDownload size={12} /> Export HAR</button>
              <button type="button" className="opa-btn ghost" disabled={!selectedId} onClick={() => downloadCapture('xhr')}><FiDownload size={12} /> Export XHR</button>
            </div>
            {capturePreview && (
              <div>
                <div className="perf-hint" style={{ marginBottom: 8 }}>
                  Preview: {fmtNum(capturePreview.count || capturePreview.steps?.length || 0)} steps
                  {(capturePreview.warnings || []).length ? ` · ${(capturePreview.warnings || []).join(' · ')}` : ''}
                </div>
                <DataTable
                  columns={[
                    { key: 'method', header: 'Method', render: (r) => r.method || 'GET' },
                    { key: 'url', header: 'URL', render: (r) => <span className="opa-mono" style={{ fontSize: 11 }}>{r.url}</span> },
                    { key: 'selector', header: 'Selector', render: (r) => r.selector || '—' },
                  ]}
                  rows={(capturePreview.steps || capturePreview.scenario?.steps || []).slice(0, 50)}
                  rowKey={(_, i) => i}
                  maxHeight={240}
                />
                {captureDryRun && (
                  <button type="button" className="opa-btn" style={{ marginTop: 8 }} onClick={applyCapturePreview}>Apply steps to Design</button>
                )}
              </div>
            )}
            {!capturePreview && (
              <EmptyState title="No capture loaded" hint="Drop a HAR from DevTools or an XHR JSON export to seed the designer." />
            )}
          </div>
        </Panel>
      )}

      {tab === 'jmx' && (
        <Panel title="JMX source of truth">
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="perf-hint">
              Prefer Design and Capture. Paste or import a .jmx only when you already have one.
              Export downloads Agent-generated JMX used by Docker workers.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="opa-btn ghost">
                <FiUpload size={12} /> Import .jmx
                <input type="file" accept=".jmx,application/xml,text/xml" hidden onChange={(e) => importJmxFile(e.target.files?.[0])} />
              </label>
              <button type="button" className="opa-btn ghost" disabled={!selectedId} onClick={downloadJmx}><FiDownload size={12} /> Export .jmx</button>
            </div>
            <textarea
              className="opa-input opa-mono"
              rows={16}
              style={{ fontSize: 11 }}
              value={form.jmx_xml}
              onChange={(e) => setForm({ ...form, jmx_xml: e.target.value })}
              placeholder="Generated on Save, or paste JMX XML here"
              aria-label="JMX XML"
            />
            <button type="button" className="opa-btn" disabled={busy} onClick={saveScenario}>Save JMX</button>
          </div>
        </Panel>
      )}

      {tab === 'run' && (
        <>
          <Panel title="Run & scale">
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="perf-hint" style={{ marginBottom: 8 }}>Stress presets</div>
                <div className="perf-preset-row">
                  {STRESS_PRESETS.map((p) => (
                    <button
                      key={p.id || 'custom'}
                      type="button"
                      className={`perf-preset ${preset === p.id ? 'active' : ''}`}
                      onClick={() => applyPreset(p.id)}
                    >
                      <strong>{p.label}</strong>
                      {p.hint}
                    </button>
                  ))}
                </div>
              </div>
              <div className="perf-field-grid">
                <div className="perf-field">
                  <label>Dispatch now</label>
                  <select className="opa-input" value={dispatch ? '1' : '0'} onChange={(e) => setDispatch(e.target.value === '1')}>
                    <option value="1">Yes — spawn engine</option>
                    <option value="0">No — create run id only</option>
                  </select>
                </div>
                <div className="perf-field">
                  <label>Engine</label>
                  <select className="opa-input" value={engine} onChange={(e) => setEngine(e.target.value)}>
                    <option value="jmeter">Docker JMeter</option>
                    <option value="node">Node fallback (dev-only)</option>
                  </select>
                </div>
                <div className="perf-field">
                  <label>Load policy</label>
                  <select
                    className="opa-input"
                    value={policy || profile}
                    onChange={(e) => {
                      const v = e.target.value
                      setPolicy(v)
                      if (v === 'smooth') setProfile('ramp')
                      else if (v === 'sustained') setProfile('soak')
                      else if (v === 'stress') setProfile('spike')
                      else setProfile(v === 'custom' ? '' : v)
                      if (v === 'custom') setShowCurve(true)
                    }}
                  >
                    <option value="">default</option>
                    {(apiPolicies.length
                      ? apiPolicies
                      : [
                        { id: 'smooth', label: 'Smooth' },
                        { id: 'sustained', label: 'Sustained' },
                        { id: 'stress', label: 'Stress' },
                        { id: 'custom', label: 'Custom' },
                      ]
                    ).map((p) => (
                      <option key={p.id} value={p.id}>{p.label || p.id}</option>
                    ))}
                  </select>
                </div>
                <div className="perf-field">
                  <label>Profile</label>
                  <select className="opa-input" value={profile} onChange={(e) => setProfile(e.target.value)}>
                    <option value="">default</option>
                    <option value="soak">soak</option>
                    <option value="spike">spike</option>
                    <option value="ramp">ramp</option>
                  </select>
                </div>
                {engine === 'jmeter' && (
                  <div className="perf-field">
                    <label htmlFor="workers">Container workers</label>
                    <input id="workers" className="opa-input" type="number" min={1} max={16} value={workers} onChange={(e) => setWorkers(Number(e.target.value) || 1)} />
                  </div>
                )}
                <div className="perf-field">
                  <label>Virtual users</label>
                  <input className="opa-input" type="number" min={1} value={form.vus} onChange={(e) => setForm({ ...form, vus: Number(e.target.value) })} />
                </div>
                <div className="perf-field">
                  <label>Federation fan-out</label>
                  <select
                    className="opa-input"
                    value={fanout && hasFederationPeers ? '1' : '0'}
                    disabled={!hasFederationPeers}
                    title={hasFederationPeers
                      ? 'Dispatch to Agent federation peers via remote-load (≠ multi-region cloud)'
                      : 'No federation peers — local-sample-only. Set OPA_FEDERATION_PEERS on Agent/Perf-Lab.'}
                    onChange={(e) => setFanout(hasFederationPeers && e.target.value === '1')}
                  >
                    <option value="0">Off</option>
                    <option value="1">Peers (≠ multi-region cloud)</option>
                  </select>
                </div>
                <div className="perf-field">
                  <label>Custom curve</label>
                  <select className="opa-input" value={showCurve ? '1' : '0'} onChange={(e) => setShowCurve(e.target.value === '1')}>
                    <option value="0">Hidden</option>
                    <option value="1">Edit point curve</option>
                  </select>
                </div>
              </div>
              {showCurve && (
                <LoadCurveEditor
                  curve={form.schedule?.curve}
                  onChange={(curve) => {
                    setPolicy('custom')
                    setScheduleField({ curve, policy: 'custom' })
                  }}
                  onApplyPeak={({ peak, duration, ramp, curve }) => {
                    setPolicy('custom')
                    setForm((f) => ({
                      ...f,
                      vus: peak || f.vus,
                      duration_seconds: duration || f.duration_seconds,
                      schedule: {
                        ...f.schedule,
                        curve,
                        policy: 'custom',
                        ramp_seconds: ramp,
                        peak_vus: peak,
                        duration_seconds: duration,
                      },
                    }))
                  }}
                />
              )}
              <div className="sched-panel">
                <div className="perf-hint" style={{ margin: 0 }}>Scheduler (in-process tick — every_minutes or daily_at UTC)</div>
                <div className="perf-field-grid">
                  <div className="perf-field">
                    <label>Enabled</label>
                    <select
                      className="opa-input"
                      value={form.schedule?.enabled ? '1' : '0'}
                      onChange={(e) => setScheduleField({ enabled: e.target.value === '1' })}
                    >
                      <option value="0">Off</option>
                      <option value="1">On</option>
                    </select>
                  </div>
                  <div className="perf-field">
                    <label>Every (minutes)</label>
                    <input
                      className="opa-input"
                      type="number"
                      min={0}
                      value={form.schedule?.every_minutes || 0}
                      onChange={(e) => setScheduleField({ every_minutes: Number(e.target.value) || 0 })}
                      placeholder="60"
                    />
                  </div>
                  <div className="perf-field">
                    <label>Daily at (UTC HH:MM)</label>
                    <input
                      className="opa-input"
                      value={form.schedule?.daily_at || ''}
                      onChange={(e) => setScheduleField({ daily_at: e.target.value })}
                      placeholder="02:30"
                    />
                  </div>
                  <div className="perf-field">
                    <label>Next fire</label>
                    <input className="opa-input" readOnly value={form.schedule?.next_fire_at || '—'} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="opa-btn ghost" disabled={busy || !selectedId} onClick={saveSchedule}>
                    Save schedule
                  </button>
                  <button type="button" className="opa-btn ghost" disabled={busy} onClick={saveScenario}>
                    Save scenario (incl. schedule_json)
                  </button>
                </div>
              </div>
              <p className="perf-hint">
                Dispatch uses ephemeral JMeter containers on the compose network. Point target_url at an instrumented service (default http://node-app:3000/hello) so Open traces finds tags.load_run_id — example.com never yields traces.
                Load policies (Smooth / Sustained / Stress / Custom curve) map onto local Docker workers only (≠ multi-cloud geo injectors).
                Node requires OPA_PERF_ALLOW_NODE_FALLBACK=1.
                {!hasFederationPeers
                  ? ' Federation fan-out disabled until peers are configured (OPA_FEDERATION_PEERS / opa.federation_peers) — otherwise runs stay local-sample-only.'
                  : ` Federation peers available: ${peerRows.length}.`}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="opa-btn primary" disabled={busy || !selectedId} onClick={() => startRun()} aria-label="Start load run">
                  <FiPlay size={12} /> Start run
                </button>
                <button type="button" className="opa-btn ghost" disabled={busy || !selectedId} onClick={validateScenario}>Validate</button>
                <button type="button" className="opa-btn ghost" disabled={busy || !selectedId} onClick={() => duplicateScenario()} title="Duplicate scenario">
                  <FiCopy size={12} /> Duplicate
                </button>
                <button type="button" className="opa-btn ghost" disabled={busy || !selectedId} onClick={() => archiveScenario()} title="Archive scenario">
                  <FiTrash2 size={12} /> Archive
                </button>
              </div>
              {scenarioTrend.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="perf-hint" style={{ marginBottom: 6 }}>
                    Multi-run history for this scenario (≤25) — p95 / errors over recent runs
                  </div>
                  <DataTable
                    columns={[
                      {
                        key: 'id', header: 'Run',
                        render: (r) => (
                          <button type="button" className="opa-btn ghost" style={{ padding: '0 4px', fontSize: 11 }} onClick={() => { setActiveRunId(r.id); setTab('results') }}>
                            {String(r.id).slice(0, 18)}
                          </button>
                        ),
                      },
                      { key: 'status', header: 'Status', render: (r) => <StatusPill tone={r.status === 'failed' ? 'error' : 'neutral'}>{r.status}</StatusPill> },
                      { key: 'vus', header: 'VUs', num: true, render: (r) => fmtNum(r.vus) },
                      { key: 'p95_ms', header: 'p95', num: true, render: (r) => fmtNum(r.p95_ms) },
                      { key: 'error_rate', header: 'Err', num: true, render: (r) => fmtNum(r.error_rate) },
                      { key: 'samples', header: 'N', num: true, render: (r) => fmtNum(r.samples) },
                      { key: 'started_at', header: 'Started', render: (r) => fmtAgo(r.started_at) },
                    ]}
                    rows={scenarioTrend}
                    rowKey={(r) => r.id}
                    maxHeight={200}
                  />
                </div>
              )}
            </div>
          </Panel>
          <Panel title="Scenarios" flush loading={scenarios.loading} empty={!scenarios.loading && !scnRows.length} emptyText="Build a scenario in Design">
            <DataTable columns={scnCols} rows={scnRows} rowKey={(r) => r.id} />
          </Panel>
        </>
      )}

      {tab === 'results' && (
        <>
          <div className="opa-grid cols-4">
            <KpiTile label={liveKPIs.source === 'summary' ? 'Requests' : 'Samples'} value={fmtNum(liveKPIs.n)} status="neutral" />
            <KpiTile label="p50 ms" value={fmtNum(liveKPIs.p50)} status="neutral" />
            <KpiTile label="p95 ms" value={fmtNum(liveKPIs.p95)} status={liveKPIs.p95 > (form.sla.p95_ms || 500) ? 'warn' : 'ok'} />
            <KpiTile label="Error rate" value={fmtNum(liveKPIs.err)} status={liveKPIs.err > (form.sla.error_rate_max || 0.05) ? 'error' : 'ok'} />
          </div>
          <Panel title="Active run">
            <div style={{ padding: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="opa-mono" style={{ fontSize: 12 }}>{activeRunId || 'No run selected'}</span>
              <StatusPill tone={runDetail?.status === 'failed' || runDetail?.status === 'error' ? 'error' : runDetail?.status === 'passed' || runDetail?.status === 'completed' ? 'ok' : 'neutral'}>
                {runDetail?.status || '—'}
              </StatusPill>
              {activeRunId && <OpaTracesLink runId={activeRunId} />}
              {activeRunId && (
                <button type="button" className="opa-btn ghost" disabled={busy} onClick={() => evaluateGate(activeRunId)}>
                  <FiShield size={12} /> SLA gate
                </button>
              )}
              {activeRunId && (
                <>
                  <button type="button" className="opa-btn ghost" disabled={busy} onClick={() => exportRunReport('json')}>
                    <FiDownload size={12} /> Report JSON
                  </button>
                  <button type="button" className="opa-btn ghost" disabled={busy} onClick={() => exportRunReport('csv')}>
                    <FiDownload size={12} /> Report CSV
                  </button>
                </>
              )}
              {activeRunId && runIsActive && (
                <button type="button" className="opa-btn ghost" disabled={busy} onClick={() => cancelRun(activeRunId)}>
                  Cancel run
                </button>
              )}
              {!activeRunId && (
                <span className="perf-hint">Start a run or pick one from the table below.</span>
              )}
            </div>
            {runners?.containers?.length > 0 && (
              <div style={{ padding: '0 12px 12px' }}>
                <div className="perf-hint" style={{ marginBottom: 6 }}>
                  Runners · {runners.running || 0} running · {runners.honesty || 'local Docker inspect'}
                </div>
                <DataTable columns={runnerCols} rows={runners.containers} rowKey={(r) => r.name} maxHeight={160} />
              </div>
            )}
            {summaryPreview && (summaryPreview.p95_ms != null || summaryPreview.engine || runDetail?.error) && (
              <pre className="opa-mono" style={{ fontSize: 11, margin: '0 12px 12px', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify({
                  engine: summaryPreview.engine,
                  mode: summaryPreview.mode,
                  p50_ms: summaryPreview.p50_ms,
                  p95_ms: summaryPreview.p95_ms,
                  p99_ms: summaryPreview.p99_ms,
                  error_rate: summaryPreview.error_rate,
                  requests: summaryPreview.requests,
                  workers: summaryPreview.workers,
                  containers: summaryPreview.containers,
                  error: runDetail?.error || summaryPreview.dispatch_error,
                }, null, 2)}
              </pre>
            )}
          </Panel>
          {stepStats.length > 0 && (
            <Panel title="Per-step stats" flush>
              <DataTable columns={stepCols} rows={stepStats} rowKey={(r) => r.step_name} maxHeight={280} />
            </Panel>
          )}
          {samples.length > 0 && (
            <Panel title="Live samples" flush>
              <DataTable columns={sampleCols} rows={samples.slice(0, 100)} rowKey={(r, i) => r.id || i} maxHeight={280} />
            </Panel>
          )}
          {activeRunId && samples.length === 0 && liveKPIs.source === 'none' && (
            <p className="perf-hint" style={{ padding: '0 4px' }}>
              No samples yet — waiting for the engine, or this run was created without dispatch.
            </p>
          )}
          <Panel title="Runs" flush loading={runs.loading} empty={!runs.loading && !runRows.length} emptyText="Start a run from Run & scale">
            <DataTable columns={runCols} rows={runRows} rowKey={(r) => r.id} />
          </Panel>
        </>
      )}

      {tab === 'compare' && (
        <Panel title="Compare runs">
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="perf-compare-grid">
              <div className="perf-field">
                <label>Run A</label>
                <select className="opa-input" value={compareA} onChange={(e) => setCompareA(e.target.value)}>
                  <option value="">Select…</option>
                  {runRows.map((r) => <option key={r.id} value={r.id}>{String(r.id).slice(0, 22)} · {r.status}</option>)}
                </select>
              </div>
              <div className="perf-field">
                <label>Run B</label>
                <select className="opa-input" value={compareB} onChange={(e) => setCompareB(e.target.value)}>
                  <option value="">Select…</option>
                  {runRows.map((r) => <option key={r.id} value={r.id}>{String(r.id).slice(0, 22)} · {r.status}</option>)}
                </select>
              </div>
            </div>
            {compareA && <OpaTracesLink runId={compareA}>Traces A</OpaTracesLink>}
            {compareB && <OpaTracesLink runId={compareB}>Traces B</OpaTracesLink>}
            {!compare && (
              <EmptyState title="Pick two runs" hint="Compare percentiles and error rate deltas between A and B." />
            )}
            {compare && (
              <DataTable
                columns={[
                  { key: 'metric', header: 'Metric' },
                  { key: 'a', header: 'Run A', num: true },
                  { key: 'b', header: 'Run B', num: true },
                  {
                    key: 'd', header: 'Δ (B−A)', num: true,
                    render: (r) => <StatusPill tone={r.worse ? 'error' : 'ok'}>{r.d}</StatusPill>,
                  },
                ]}
                rows={[
                  { metric: 'p50 ms', a: fmtNum(compare.a.p50_ms), b: fmtNum(compare.b.p50_ms), d: fmtNum(compare.d_p50), worse: compare.d_p50 > 0 },
                  { metric: 'p95 ms', a: fmtNum(compare.a.p95_ms), b: fmtNum(compare.b.p95_ms), d: fmtNum(compare.d_p95), worse: compare.d_p95 > 0 },
                  { metric: 'Error rate', a: fmtNum(compare.a.error_rate), b: fmtNum(compare.b.error_rate), d: fmtNum(compare.d_err), worse: compare.d_err > 0 },
                  { metric: 'VUs', a: fmtNum(compare.a.vus), b: fmtNum(compare.b.vus), d: fmtNum((compare.b.vus || 0) - (compare.a.vus || 0)), worse: false },
                ]}
                rowKey={(r) => r.metric}
              />
            )}
            {baseRows.length > 0 && (
              <div>
                <div className="perf-hint" style={{ marginBottom: 6 }}>Stored baselines</div>
                <DataTable
                  columns={[
                    { key: 'service', header: 'Service' },
                    { key: 'transaction', header: 'Txn' },
                    { key: 'metric', header: 'Metric' },
                    { key: 'value', header: 'Value', num: true, render: (r) => fmtNum(r.value) },
                  ]}
                  rows={baseRows}
                  rowKey={(r) => r.id || `${r.service}:${r.metric}`}
                  maxHeight={200}
                />
              </div>
            )}
          </div>
        </Panel>
      )}

      {tab === 'sla' && (
        <Panel title="SLA gates">
          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="perf-field-grid">
              <div className="perf-field">
                <label>p95 threshold (ms)</label>
                <input className="opa-input" type="number" value={form.sla.p95_ms} onChange={(e) => setForm({ ...form, sla: { ...form.sla, p95_ms: Number(e.target.value) } })} />
              </div>
              <div className="perf-field">
                <label>Max error rate</label>
                <input className="opa-input" type="number" step="0.01" value={form.sla.error_rate_max} onChange={(e) => setForm({ ...form, sla: { ...form.sla, error_rate_max: Number(e.target.value) } })} />
              </div>
              <div className="perf-field span-2">
                <label>Run</label>
                <select className="opa-input" value={activeRunId} onChange={(e) => setActiveRunId(e.target.value)}>
                  <option value="">Select run…</option>
                  {runRows.map((r) => <option key={r.id} value={r.id}>{String(r.id).slice(0, 24)} · {r.status}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="opa-btn" disabled={busy} onClick={saveScenario}>Save SLA on scenario</button>
              <button type="button" className="opa-btn primary" disabled={busy || !activeRunId} onClick={() => evaluateGate()}>
                <FiShield size={12} /> Evaluate gate
              </button>
            </div>
            <p className="perf-hint">Gate evaluation is fail-closed on the Agent — empty or in-flight summaries fail unless explicitly allowed.</p>
            {gateResult ? (
              <div>
                <StatusPill tone={gatePassed(gateResult) ? 'ok' : 'error'}>{gatePassed(gateResult) ? 'PASS' : 'FAIL'}</StatusPill>
                <div style={{ marginTop: 8 }}>
                  {(gateResult.reasons || ['No reasons returned']).map((reason, i) => (
                    <div className="perf-gate-row" key={i}>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
                {gateResult.summary && (
                  <pre className="opa-mono" style={{ fontSize: 11, marginTop: 8, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(gateResult.summary, null, 2)}
                  </pre>
                )}
              </div>
            ) : (
              <EmptyState title="No gate result yet" hint="Select a finished run and evaluate against the scenario SLA." />
            )}
          </div>
        </Panel>
      )}
    </div>
  )
}
