import React, {
  createContext, useContext, useCallback, useEffect, useMemo, useState,
} from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@open-family/ui'
import { useApi } from '../hooks/useApi'
import { apiUrl } from '../utils/apiBase'
import { useTenant } from '../contexts/TenantContext'
import { useReportTemplates } from '../components/ReportTemplateBar'
import { getAtPath, patchStepAt, insertChildAt } from './treeOps'
import {
  DEFAULT_FORM, emptyStep, liveKpisFor, parseJSONField, parseSummary,
  STRESS_PRESETS,
} from './model'
import { resultTabPath } from '../nav'

/**
 * The lab's shared state.
 *
 * The nine in-page tabs became four routes, so everything the tabs used to share
 * through one component's `useState` now lives here — one store above the router,
 * so a scenario being edited survives a move from Scenarios to Run and scale, and
 * the run poller keeps running while the operator walks the result tabs.
 *
 * Every request in this file is byte-for-byte the request the tabbed page made.
 * The only change is that what used to be `setTab('results')` is now
 * `navigate('/results/<id>')`.
 */

const PerfLabContext = createContext(null)

const TOAST_TONE = { ok: 'good', error: 'critical', warn: 'warning' }

/**
 * The selected scenario is remembered across a reload.
 *
 * It has to be: Trends, Comparison and SLA gates are their own URLs now, and a
 * URL you cannot reload is not really a URL. The scenario's *content* is still
 * re-fetched from the API — only the identifier is remembered here.
 */
const SELECTED_KEY = 'opl_selected_scenario'

const readSelected = () => {
  try {
    return localStorage.getItem(SELECTED_KEY) || ''
  } catch {
    return ''
  }
}

export function PerfLabProvider({ children }) {
  const toast = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [showArchived, setShowArchived] = useState(false)
  const scenarios = useApi('/api/perf/scenarios', showArchived ? { archived: '1' } : {}, { noRange: true })
  const runs = useApi('/api/perf/runs', {}, { noRange: true })
  // Baselines / federation peer list remain on OPA Agent — optional; skip until peer APIs move.
  const baselines = useApi('/api/performance/baselines', {}, { noRange: true, skip: true })
  const federationPeers = useApi('/api/federation/peers', {}, { noRange: true, skip: true })

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
  const [selectedId, setSelectedId] = useState(readSelected)
  const [restored, setRestored] = useState(false)
  const [activeRunId, setActiveRunId] = useState('')
  const [runDetail, setRunDetail] = useState(null)
  const [samples, setSamples] = useState([])
  const [stepStats, setStepStats] = useState([])
  const [runners, setRunners] = useState(null)
  const [gateResult, setGateResult] = useState(null)
  const [captureIncludeStatic, setCaptureIncludeStatic] = useState(false)
  const [captureDryRun, setCaptureDryRun] = useState(true)
  const [capturePreview, setCapturePreview] = useState(null)
  const [captureImportError, setCaptureImportError] = useState(null)
  const [selectedStepPath, setSelectedStepPath] = useState(null)
  const [treeExpanded, setTreeExpanded] = useState({})
  const [validateResult, setValidateResult] = useState(null)
  const [apiPolicies, setApiPolicies] = useState([])
  const [showCurve, setShowCurve] = useState(false)
  const [runNotify, setRunNotify] = useState(null)
  const [trendData, setTrendData] = useState(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState(null)
  const [reportTemplateId, setReportTemplateId] = useState('')
  const [trendTemplateId, setTrendTemplateId] = useState('')

  const [form, setForm] = useState(DEFAULT_FORM)

  const scnRows = scenarios.data?.scenarios || []
  const runRows = runs.data?.runs || []
  const baseRows = baselines.data?.baselines || []
  const peerRows = Array.isArray(federationPeers.data?.peers) ? federationPeers.data.peers : []
  const hasFederationPeers = peerRows.length > 0

  // Without peers, fan-out is local-sample-only — keep the toggle off and disabled.
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
    axios.get(apiUrl('/api/health'))
      .then(({ data }) => {
        if (data?.run_notify && typeof data.run_notify === 'object') setRunNotify(data.run_notify)
      })
      .catch(() => { /* health optional for UI chrome */ })
  }, [])

  useEffect(() => {
    if (policy === 'custom' || (Array.isArray(form.schedule?.curve) && form.schedule.curve.length)) {
      setShowCurve(true)
    }
  }, [policy]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem(SELECTED_KEY, selectedId)
      else localStorage.removeItem(SELECTED_KEY)
    } catch {
      /* storage unavailable — the selection still holds for this session */
    }
  }, [selectedId])

  const engineLabel = scenarios.data?.engine || engine
  const runnerLabel = scenarios.data?.runner || 'docker'

  const { organizationId, projectId, hasConcreteProject, scopeKey } = useTenant()
  const scopeLabel = `${organizationId} / ${projectId}`
  const reportTemplates = useReportTemplates('report')
  const trendTemplates = useReportTemplates('trend')
  const activeReportTemplate = reportTemplates.templates.find((t) => t.id === reportTemplateId) || null
  const activeTrendTemplate = trendTemplates.templates.find((t) => t.id === trendTemplateId) || null

  // A saved layout that disappears (archived elsewhere, other scope) must not
  // silently keep applying — drop the selection instead.
  useEffect(() => {
    if (reportTemplateId && !reportTemplates.loading && !activeReportTemplate) setReportTemplateId('')
  }, [reportTemplateId, reportTemplates.loading, activeReportTemplate])
  useEffect(() => {
    if (trendTemplateId && !trendTemplates.loading && !activeTrendTemplate) setTrendTemplateId('')
  }, [trendTemplateId, trendTemplates.loading, activeTrendTemplate])

  const trendWidgets = useMemo(() => {
    if (activeTrendTemplate?.widgets?.length) return activeTrendTemplate.widgets
    if (Array.isArray(trendData?.widgets) && trendData.widgets.length) return trendData.widgets
    return ['kpis', 'latency_band', 'error_bars', 'runs_table']
  }, [activeTrendTemplate, trendData])
  const trendShows = useCallback((w) => trendWidgets.includes(w), [trendWidgets])

  const trendMetrics = useMemo(() => {
    if (activeTrendTemplate?.metrics?.length) return activeTrendTemplate.metrics
    if (Array.isArray(trendData?.metrics) && trendData.metrics.length) return trendData.metrics
    return ['p50_ms', 'p95_ms', 'p99_ms', 'avg_ms', 'error_rate', 'samples']
  }, [activeTrendTemplate, trendData])
  const trendShowsMetric = useCallback((m) => trendMetrics.includes(m), [trendMetrics])

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
          p50_ms: Number(s.p50_ms) || 0,
          p95_ms: Number(s.p95_ms) || 0,
          p99_ms: Number(s.p99_ms) || 0,
          error_rate: Number(s.error_rate) || 0,
          samples: Number(s.requests || s.samples || s.n) || 0,
        }
      })
  }, [selectedId, runRows])

  const trendPoints = useMemo(() => {
    if (Array.isArray(trendData?.points) && trendData.points.length) return trendData.points
    // Fallback: reverse local multi-run history to oldest→newest for charts
    return [...scenarioTrend].reverse().map((r) => ({
      ...r,
      p50_ms: r.p50_ms || 0,
      p99_ms: r.p99_ms || 0,
    }))
  }, [trendData, scenarioTrend])

  const onTrends = pathname === '/trends'
  useEffect(() => {
    if (!onTrends || !selectedId) return undefined
    let cancelled = false
    setTrendLoading(true)
    setTrendError(null)
    // A trend template supplies the window; without one, keep the local defaults.
    const params = trendTemplateId
      ? { template: trendTemplateId }
      : { limit: 25, sla_p95_ms: form.sla?.p95_ms || 500 }
    axios.get(apiUrl(`/api/perf/scenarios/${encodeURIComponent(selectedId)}/trends`), { params })
      .then(({ data }) => { if (!cancelled) setTrendData(data) })
      .catch((e) => {
        if (cancelled) return
        setTrendData(null)
        // The tabbed page swallowed this, so a failed trend request rendered as
        // "no runs yet" — a wrong answer, not a missing one.
        setTrendError(e.response?.data?.error || e.message || 'Trend request failed')
      })
      .finally(() => { if (!cancelled) setTrendLoading(false) })
    return () => { cancelled = true }
  }, [onTrends, selectedId, form.sla?.p95_ms, runs.data, trendTemplateId, scopeKey])

  const flash = useCallback((tone, title, detail) => {
    setBanner({ tone, title, detail })
    toast.push({
      tone: TOAST_TONE[tone] || 'accent',
      title,
      description: detail == null ? undefined : (typeof detail === 'string' ? detail : JSON.stringify(detail)),
    })
  }, [toast])

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

  const liveKPIs = useMemo(() => liveKpisFor(runDetail, samples), [samples, runDetail])

  // The tabbed page polled while the Results or SLA tab was open. Same rule,
  // expressed against the route: the poller must survive a move between the
  // four result tabs, so match the whole `/results` subtree.
  const pollingRoute = pathname === '/sla' || pathname === '/results' || pathname.startsWith('/results/')
  useEffect(() => {
    if (!activeRunId || !pollingRoute) return undefined
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
  }, [activeRunId, pollingRoute])

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

  /**
   * Fetch a scenario and put it in the form.
   *
   * `goToDesigner` is false for the one-shot restore on mount: reloading
   * `/trends` must stay on `/trends`, not bounce the operator to the designer.
   */
  const fetchScenario = async (id, { goToDesigner = true, announce = true } = {}) => {
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
            ...(datasets.csv || {}),
          },
        },
        sla: { p95_ms: 500, error_rate_max: 0.05, rps_min: 0, ...sla },
        schedule: { ramp_seconds: 10, ...schedule },
        jmx_xml: data.jmx_xml || '',
      })
      if (goToDesigner) navigate('/scenarios')
      if (announce) flash('ok', `Loaded ${data.name || id}`, id)
    } catch (e) {
      if (announce) flash('error', 'Load failed', e.response?.data || e.message)
      // A remembered scenario that no longer exists must not keep claiming to be
      // selected — every Analysis page would then read an empty window.
      else setSelectedId('')
    } finally {
      setBusy(false)
    }
  }

  const loadScenario = (id) => fetchScenario(id)

  // One-shot rehydration of the remembered scenario, so a bookmarked or reloaded
  // Trends / Comparison / SLA URL is not silently scenario-less.
  useEffect(() => {
    if (restored) return
    setRestored(true)
    const remembered = readSelected()
    if (remembered) fetchScenario(remembered, { goToDesigner: false, announce: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored])

  const archiveScenario = async (id) => {
    if (!hasConcreteProject) {
      flash('warn', 'Select one project', 'All projects and multi-select are list-only.')
      return
    }
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

  const unarchiveScenario = async (id) => {
    if (!hasConcreteProject) {
      flash('warn', 'Select one project', 'All projects and multi-select are list-only.')
      return
    }
    const sid = id || selectedId
    if (!sid) return
    setBusy(true)
    try {
      await axios.post(apiUrl(`/api/perf/scenarios/${encodeURIComponent(sid)}/unarchive`))
      flash('ok', 'Scenario restored', sid)
      setShowArchived(false)
      scenarios.reload?.()
      await loadScenario(sid)
    } catch (e) {
      flash('error', 'Restore failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const applyCorrelationSuggestion = (sug) => {
    if (!sug) return
    const extract = {
      type: 'extract',
      name: sug.var || 'token',
      engine: sug.engine || 'regex',
      expression: sug.expression || '',
      var: sug.var || 'token',
    }
    // Prefer nesting under the currently selected HTTP; else append under the first HTTP at root.
    let path = selectedStepPath
    const node = path ? getAtPath(form.steps, path) : null
    if (!node || (node.type && node.type !== 'http')) {
      const idx = (form.steps || []).findIndex((s) => !s.type || s.type === 'http')
      if (idx < 0) {
        flash('error', 'Select an HTTP step', 'Correlation extractors nest under HTTP requests.')
        return
      }
      path = [idx]
    }
    setForm((f) => ({ ...f, steps: insertChildAt(f.steps, path, extract) }))
    flash('ok', 'Extractor added', `${extract.engine} ${extract.var}`)
  }

  const importJtlFile = async (file) => {
    if (!file) return
    if (!hasConcreteProject) {
      flash('warn', 'Select one project', 'All projects and multi-select are list-only.')
      return
    }
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('jtl', file)
      if (selectedId) fd.append('scenario_id', selectedId)
      const q = selectedId ? `?scenario_id=${encodeURIComponent(selectedId)}` : ''
      const { data } = await axios.post(apiUrl(`/api/perf/runs/import-jtl${q}`), fd)
      if (data.id || data.load_run_id) {
        const rid = data.id || data.load_run_id
        setActiveRunId(rid)
        navigate(resultTabPath(rid, ''))
      }
      flash('ok', 'JTL imported', data.honesty || `${data.sample_count || 0} samples`)
      runs.reload?.()
    } catch (e) {
      flash('error', 'JTL import failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const duplicateScenario = async (id) => {
    if (!hasConcreteProject) {
      flash('warn', 'Select one project', 'All projects and multi-select are list-only.')
      return
    }
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

  const setScheduleField = (patch) => {
    setForm((f) => ({ ...f, schedule: { ...f.schedule, ...patch } }))
  }

  const saveSchedule = async () => {
    if (!hasConcreteProject) {
      flash('warn', 'Select one project', 'All projects and multi-select are list-only.')
      return
    }
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
        curve_mode: form.schedule?.curve_mode || undefined,
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

  // Exports carry the selected report template so the artifact matches what the
  // operator sees; the API echoes the layout it actually applied.
  const templateQuery = (prefix) => (reportTemplateId
    ? `${prefix}template=${encodeURIComponent(reportTemplateId)}`
    : '')
  const templateDetail = activeReportTemplate
    ? `template "${activeReportTemplate.name}"`
    : 'full layout (no template)'

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

  const exportRunReport = async (format = 'json') => {
    if (!activeRunId) return
    try {
      if (format === 'json') {
        setBusy(true)
        const { data } = await axios.get(
          apiUrl(`/api/perf/runs/${encodeURIComponent(activeRunId)}/report${templateQuery('?')}`),
        )
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `opl-report-${activeRunId}.json`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        flash('ok', 'JSON report downloaded', `${activeRunId} · ${templateDetail}`)
        setBusy(false)
        return
      }
      const ext = format === 'pdf' ? 'pdf' : format === 'html' ? 'html' : 'csv'
      await downloadExport(
        `/api/perf/runs/${encodeURIComponent(activeRunId)}/report?format=${encodeURIComponent(format)}${templateQuery('&')}`,
        `opl-report-${activeRunId}.${ext}`,
      )
      flash('ok', `${String(format).toUpperCase()} report downloaded`, `${activeRunId} · ${templateDetail}`)
    } catch (e) {
      flash('error', 'Report export failed', e.response?.data || e.message)
      setBusy(false)
    }
  }

  const downloadBenchPack = async () => {
    if (!activeRunId) return
    try {
      await downloadExport(
        `/api/perf/runs/${encodeURIComponent(activeRunId)}/bench-pack${templateQuery('?')}`,
        `opl-bench-${activeRunId}.zip`,
      )
      flash('ok', 'Bench pack downloaded', `ZIP with JSON + CSV + HTML + PDF · ${templateDetail}`)
    } catch (e) {
      flash('error', 'Bench pack failed', e.response?.data || e.message)
    }
  }

  const saveScenario = async () => {
    if (!hasConcreteProject) {
      flash('warn', 'Select one project', 'All projects and multi-select are list-only.')
      return
    }
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

  const importJmxFile = async (file) => {
    if (!file) return
    if (!hasConcreteProject) {
      flash('warn', 'Select one project', 'All projects and multi-select are list-only.')
      return
    }
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
    // Persist writes use WriteTenant (default-project collapse) — require concrete project.
    const persist = !captureDryRun
    if (persist && !hasConcreteProject) {
      flash('warn', 'Select one project', 'All projects and multi-select are list-only. Use dry-run preview instead.')
      return
    }
    setBusy(true)
    setCapturePreview(null)
    setCaptureImportError(null)
    try {
      const text = await file.text()
      let body
      try {
        body = JSON.parse(text)
      } catch {
        throw new Error('File must be JSON (HAR, XHR array, or Postman collection)')
      }
      const q = new URLSearchParams()
      q.set('name', file.name.replace(/\.(har|json)$/i, ''))
      if (!persist) q.set('dry_run', '1')
      if (captureIncludeStatic) q.set('include_static', '1')
      if (selectedId && persist) q.set('id', selectedId)
      let payload
      if (kind === 'har') {
        payload = body.log ? body : { har: body }
      } else if (kind === 'xhr') {
        payload = Array.isArray(body) ? { xhr: body } : body
      } else {
        payload = body.info ? body : { postman: body }
      }
      const { data } = await axios.post(
        apiUrl(`/api/perf/scenarios/import-${kind}?${q}`),
        payload,
      )
      setCapturePreview(data)
      if (!captureDryRun && data.id) {
        setSelectedId(data.id)
        await loadScenario(data.id)
        scenarios.reload?.()
      } else if (!captureDryRun && data.steps?.length) {
        setForm((f) => ({
          ...f,
          name: data.scenario?.name || f.name,
          steps: data.steps.map((s) => ({ ...emptyStep(), ...s, headers: s.headers || {} })),
        }))
        navigate('/scenarios')
      }
      const n = data.count || data.steps?.length || 0
      const warnN = Array.isArray(data.warnings) ? data.warnings.length : 0
      flash(
        n === 0 || warnN > 0 ? 'warn' : 'ok',
        `${kind.toUpperCase()} ${captureDryRun ? 'preview' : 'imported'}`,
        n === 0
          ? (warnN ? `${warnN} warning(s) · no steps` : 'no steps')
          : `${n} steps${warnN ? ` · ${warnN} warning(s)` : ''}`,
      )
    } catch (e) {
      const detail = e.response?.data || e.message
      setCaptureImportError(detail)
      flash('error', `${kind.toUpperCase()} import failed`, detail)
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
    navigate('/scenarios')
    flash('ok', 'Steps applied to designer', `${steps.length} steps`)
  }

  const validateScenario = async () => {
    if (!hasConcreteProject) {
      flash('warn', 'Select one project', 'All projects and multi-select are list-only.')
      return
    }
    if (!selectedId) { flash('warn', 'Save the scenario first'); return }
    setBusy(true)
    try {
      const { data } = await axios.post(apiUrl(`/api/perf/scenarios/${encodeURIComponent(selectedId)}/validate`))
      setValidateResult(data)
      const ok = data.pass !== false && data.ok !== false
      flash(ok ? 'ok' : 'error', ok ? 'Validation passed' : 'Validation failed', data.honesty || `${(data.triage || []).length} triage item(s)`)
      navigate('/scenarios')
    } catch (e) {
      flash('error', 'Validate failed', e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const startRun = async (scenarioId) => {
    if (!hasConcreteProject) {
      flash('warn', 'Select one project', 'All projects and multi-select are list-only.')
      return
    }
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
        navigate(resultTabPath(rid, ''))
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
      navigate('/sla')
      const ok = data && (typeof data.pass === 'boolean' ? data.pass
        : typeof data.ok === 'boolean' ? data.ok
          : String(data.status || '').toLowerCase() === 'passed')
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

  const openRun = (rid) => {
    setActiveRunId(rid)
    navigate(resultTabPath(rid, ''))
  }

  const runIsActive = ['running', 'created'].includes(String(runDetail?.status || '').toLowerCase())
  const summaryPreview = parseSummary(runDetail)

  const value = {
    // collections
    scenarios, runs, baselines, federationPeers,
    scnRows, runRows, baseRows, peerRows, hasFederationPeers,
    showArchived, setShowArchived,
    engineLabel, runnerLabel, scopeLabel, hasConcreteProject,

    // scenario form
    form, setForm, selectedId, setSelectedId,
    selectedStepPath, setSelectedStepPath, selectedStep, patchSelectedStep,
    treeExpanded, setTreeExpanded,
    validateResult, setValidateResult,

    // run controls
    busy, banner, setBanner, flash,
    fanout, setFanout, profile, setProfile, policy, setPolicy,
    engine, setEngine, workers, setWorkers, dispatch, setDispatch,
    preset, applyPreset, apiPolicies, showCurve, setShowCurve,
    setScheduleField, saveSchedule,

    // runs and results
    activeRunId, setActiveRunId, openRun,
    runDetail, samples, stepStats, runners, runIsActive, summaryPreview, liveKPIs,
    runNotify,

    // analysis
    compareA, setCompareA, compareB, setCompareB, compare,
    trendData, trendLoading, trendError, trendPoints, scenarioTrend,
    trendShows, trendShowsMetric, trendWidgets,
    gateResult,

    // capture
    captureDryRun, setCaptureDryRun,
    captureIncludeStatic, setCaptureIncludeStatic,
    capturePreview, captureImportError, applyCapturePreview,

    // templates
    reportTemplates, trendTemplates,
    reportTemplateId, setReportTemplateId, activeReportTemplate,
    trendTemplateId, setTrendTemplateId, activeTrendTemplate,
    templateDetail,

    // actions
    saveScenario, loadScenario, archiveScenario, unarchiveScenario, duplicateScenario,
    validateScenario, startRun, cancelRun, evaluateGate,
    importJmxFile, importJtlFile, importCaptureFile,
    downloadJmx, downloadCapture, exportRunReport, downloadBenchPack,
    applyCorrelationSuggestion,
  }

  return <PerfLabContext.Provider value={value}>{children}</PerfLabContext.Provider>
}

export function usePerfLab() {
  const ctx = useContext(PerfLabContext)
  if (!ctx) throw new Error('usePerfLab must be used within PerfLabProvider')
  return ctx
}
