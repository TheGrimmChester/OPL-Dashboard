import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { FiCheck, FiPlus, FiTrash2, FiX } from 'react-icons/fi'
import { apiUrl } from '../utils/apiBase'

// Saved report / trend layouts: which widgets, which metrics, which window.
// A template only selects what an export renders — never how a run was measured.

export const REPORT_WIDGETS = ['kpis', 'summary', 'steps', 'errors', 'samples']
export const TREND_WIDGETS = ['kpis', 'latency_band', 'error_bars', 'runs_table']
export const TEMPLATE_METRICS = ['p50_ms', 'p95_ms', 'p99_ms', 'avg_ms', 'error_rate', 'samples']

const WIDGET_LABELS = {
  kpis: 'KPI tiles',
  summary: 'Run summary',
  steps: 'Per-step stats',
  errors: 'Errors',
  samples: 'Samples',
  latency_band: 'Latency band',
  error_bars: 'Error bars',
  runs_table: 'Runs table',
}

export function widgetsForKind(kind) {
  return kind === 'trend' ? TREND_WIDGETS : REPORT_WIDGETS
}

export function widgetLabel(w) {
  return WIDGET_LABELS[w] || w
}

// useReportTemplates loads the saved layouts for one kind, scoped by the tenant
// headers the axios defaults already carry.
export function useReportTemplates(kind) {
  const [templates, setTemplates] = useState([])
  // Start "loading" so a selection restored from elsewhere is not dropped before
  // the first fetch resolves; reload() re-raises it synchronously for the same
  // reason (a template saved a moment ago is not yet in `templates`).
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    axios.get(apiUrl('/api/perf/report-templates'), { params: { kind } })
      .then(({ data }) => {
        if (cancelled) return
        setTemplates(Array.isArray(data?.templates) ? data.templates : [])
      })
      .catch(() => { if (!cancelled) setTemplates([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [kind, reloadKey])

  return { templates, loading, reload }
}

function ChipToggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      className={`perf-tpl-chip ${checked ? 'on' : ''}`}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="perf-tpl-chip-box" aria-hidden="true">{checked ? <FiCheck size={10} /> : null}</span>
      {label}
    </button>
  )
}

function emptyDraft(kind) {
  return {
    id: '',
    name: '',
    kind,
    widgets: widgetsForKind(kind).slice(),
    metrics: ['p50_ms', 'p95_ms', 'p99_ms', 'error_rate'],
    window: kind === 'trend' ? { limit: 25, sla_p95_ms: 500 } : { sample_cap: 200 },
  }
}

// TemplateEditor doubles as the manage list: saved layouts on the left, form on
// the right. Save/delete are admin-only on the API and surface plain errors.
function TemplateEditor({ kind, templates, initial, onClose, onSaved, onError }) {
  const [draft, setDraft] = useState(initial || emptyDraft(kind))
  const [busy, setBusy] = useState(false)
  const widgets = widgetsForKind(draft.kind)

  const setField = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const toggleIn = (list, value, on) => (on
    ? [...new Set([...list, value])]
    : list.filter((v) => v !== value))

  const switchKind = (nextKind) => {
    setDraft((d) => ({
      ...d,
      kind: nextKind,
      widgets: widgetsForKind(nextKind).slice(),
      window: nextKind === 'trend' ? { limit: 25, sla_p95_ms: 500 } : { sample_cap: 200 },
    }))
  }

  const save = async () => {
    if (!draft.name.trim()) {
      onError('Name is required')
      return
    }
    if (!draft.widgets.length) {
      onError('Select at least one widget')
      return
    }
    setBusy(true)
    try {
      const { data } = await axios.post(apiUrl('/api/perf/report-templates/upsert'), {
        id: draft.id || undefined,
        name: draft.name.trim(),
        kind: draft.kind,
        widgets: draft.widgets,
        metrics: draft.metrics,
        window: draft.window,
      })
      onSaved(data?.id || draft.id)
    } catch (e) {
      onError(e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!draft.id) return
    setBusy(true)
    try {
      await axios.delete(apiUrl(`/api/perf/report-templates/${encodeURIComponent(draft.id)}`))
      onSaved('')
    } catch (e) {
      onError(e.response?.data || e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="perf-tpl-scrim" role="dialog" aria-modal="true" aria-label="Report and trend templates">
      <div className="perf-tpl-modal">
        <div className="perf-tpl-modal-head">
          <h3>Report &amp; trend templates</h3>
          <button type="button" className="opa-btn ghost" onClick={onClose} aria-label="Close"><FiX size={13} /></button>
        </div>
        <div className="perf-tpl-modal-body">
          <div className="perf-tpl-list">
            <div className="perf-tpl-list-label">Saved</div>
            {templates.length === 0 && <div className="perf-hint">No saved layouts yet.</div>}
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`perf-tpl-list-item ${draft.id === t.id ? 'active' : ''}`}
                onClick={() => setDraft({
                  id: t.id,
                  name: t.name,
                  kind: t.kind,
                  widgets: Array.isArray(t.widgets) ? t.widgets : [],
                  metrics: Array.isArray(t.metrics) ? t.metrics : [],
                  window: t.window || {},
                })}
              >
                <strong>{t.name}</strong>
                <span>{t.kind}</span>
              </button>
            ))}
            <button type="button" className="perf-tpl-list-item new" onClick={() => setDraft(emptyDraft('report'))}>
              <FiPlus size={11} /> New report layout
            </button>
            <button type="button" className="perf-tpl-list-item new" onClick={() => setDraft(emptyDraft('trend'))}>
              <FiPlus size={11} /> New trend layout
            </button>
          </div>
          <div className="perf-tpl-form">
            <label className="perf-tpl-field">
              <span>Name</span>
              <input
                className="opa-input"
                value={draft.name}
                placeholder="Weekly review"
                onChange={(e) => setField({ name: e.target.value })}
              />
            </label>
            <div className="perf-tpl-field">
              <span>Kind</span>
              <div className="perf-tpl-chiprow">
                {['report', 'trend'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`perf-tpl-chip round ${draft.kind === k ? 'on' : ''}`}
                    aria-pressed={draft.kind === k}
                    onClick={() => switchKind(k)}
                  >
                    {k === 'report' ? 'report · per run' : 'trend · multi-run'}
                  </button>
                ))}
              </div>
            </div>
            <div className="perf-tpl-field">
              <span>Widgets</span>
              <div className="perf-tpl-chiprow">
                {widgets.map((wg) => (
                  <ChipToggle
                    key={wg}
                    label={widgetLabel(wg)}
                    checked={draft.widgets.includes(wg)}
                    onChange={(on) => setField({ widgets: toggleIn(draft.widgets, wg, on) })}
                  />
                ))}
              </div>
            </div>
            <div className="perf-tpl-field">
              <span>Metrics</span>
              <div className="perf-tpl-chiprow">
                {TEMPLATE_METRICS.map((m) => (
                  <ChipToggle
                    key={m}
                    label={m}
                    checked={draft.metrics.includes(m)}
                    onChange={(on) => setField({ metrics: toggleIn(draft.metrics, m, on) })}
                  />
                ))}
              </div>
            </div>
            <div className="perf-tpl-field">
              <span>Window</span>
              {draft.kind === 'trend' ? (
                <div className="perf-tpl-chiprow">
                  <label className="perf-tpl-num">
                    runs
                    <input
                      className="opa-input"
                      type="number"
                      min="1"
                      max="100"
                      value={draft.window.limit ?? 25}
                      onChange={(e) => setField({ window: { ...draft.window, limit: Number(e.target.value) } })}
                    />
                  </label>
                  <label className="perf-tpl-num">
                    SLA p95 ms
                    <input
                      className="opa-input"
                      type="number"
                      min="1"
                      value={draft.window.sla_p95_ms ?? 500}
                      onChange={(e) => setField({ window: { ...draft.window, sla_p95_ms: Number(e.target.value) } })}
                    />
                  </label>
                </div>
              ) : (
                <div className="perf-tpl-chiprow">
                  <label className="perf-tpl-num">
                    sample cap
                    <input
                      className="opa-input"
                      type="number"
                      min="1"
                      max="5000"
                      value={draft.window.sample_cap ?? 200}
                      onChange={(e) => setField({ window: { ...draft.window, sample_cap: Number(e.target.value) } })}
                    />
                  </label>
                </div>
              )}
            </div>
            <p className="perf-hint">
              Saved for the current organization / project, like every other lab object. Unknown widget or metric
              names are dropped on save so an export never claims a widget the product cannot render.
            </p>
            <div className="perf-tpl-actions">
              <button type="button" className="opa-btn primary" disabled={busy} onClick={save}>
                <FiCheck size={12} /> Save template
              </button>
              {draft.id && (
                <button type="button" className="opa-btn ghost" disabled={busy} onClick={remove}>
                  <FiTrash2 size={12} /> Delete
                </button>
              )}
              <button type="button" className="opa-btn ghost" disabled={busy} onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// AppliedTemplate states plainly what the selected layout covers.
export function AppliedTemplate({ template, scopeLabel, note }) {
  if (!template) {
    return (
      <div className="perf-tpl-applied">
        <div className="perf-tpl-applied-row"><span>Template</span><strong>No template — full layout</strong></div>
        <p className="perf-hint">Exports render every widget and metric the product can produce for this run.</p>
        {note && <p className="perf-hint">{note}</p>}
      </div>
    )
  }
  const win = template.window || {}
  const windowText = template.kind === 'trend'
    ? `last ${win.limit ?? win.runs ?? 25} runs · SLA p95 ${win.sla_p95_ms ?? 500} ms`
    : `sample cap ${win.sample_cap ?? 200}`
  return (
    <div className="perf-tpl-applied">
      <div className="perf-tpl-applied-row">
        <span>Template</span>
        <strong>{template.name}</strong>
        <em className="perf-tpl-kind">{template.kind}</em>
      </div>
      <div className="perf-tpl-applied-row"><span>Widgets</span><code>{(template.widgets || []).join(', ') || '—'}</code></div>
      <div className="perf-tpl-applied-row"><span>Metrics</span><code>{(template.metrics || []).join(', ') || '—'}</code></div>
      <div className="perf-tpl-applied-row"><span>Window</span><code>{windowText}</code></div>
      {scopeLabel && <p className="perf-hint">Saved for {scopeLabel}.</p>}
      {note && <p className="perf-hint">{note}</p>}
    </div>
  )
}

// ReportTemplateBar is the picker: select + save-as + manage.
export default function ReportTemplateBar({
  kind, label, templates, selectedId, onSelect, onChanged, onError,
}) {
  const [editing, setEditing] = useState(null) // null | {} | template
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) || null,
    [templates, selectedId],
  )

  const closeEditor = () => setEditing(null)
  const afterSave = (id) => {
    setEditing(null)
    if (onChanged) onChanged(id)
  }

  return (
    <span className="perf-tpl-bar">
      <span className="perf-tpl-bar-label">{label || 'Template'}</span>
      <select
        className="opa-input perf-tpl-select"
        value={selectedId || ''}
        onChange={(e) => onSelect(e.target.value)}
        aria-label={label || 'Template'}
      >
        <option value="">No template — full layout</option>
        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
      <button
        type="button"
        className="opa-btn ghost"
        style={{ padding: '0 6px', fontSize: 11 }}
        onClick={() => setEditing(emptyDraft(kind))}
      >
        Save as template…
      </button>
      <button
        type="button"
        className="opa-btn ghost"
        style={{ padding: '0 6px', fontSize: 11 }}
        onClick={() => setEditing(selected ? {
          id: selected.id,
          name: selected.name,
          kind: selected.kind,
          widgets: selected.widgets || [],
          metrics: selected.metrics || [],
          window: selected.window || {},
        } : emptyDraft(kind))}
      >
        Manage
      </button>
      {editing && (
        <TemplateEditor
          kind={kind}
          templates={templates}
          initial={editing}
          onClose={closeEditor}
          onSaved={afterSave}
          onError={onError}
        />
      )}
    </span>
  )
}
