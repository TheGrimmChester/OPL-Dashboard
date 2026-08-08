import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { FiCheck, FiPlus, FiTrash2, FiX } from 'react-icons/fi'
import {
  Badge, Button, Code, DefinitionList, Field, Input, Select, Stack,
} from '@open-family/ui'
import { apiUrl } from '../utils/apiBase'
import { useTenant } from '../contexts/TenantContext'

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
  const { scopeKey } = useTenant()
  const [templates, setTemplates] = useState([])
  // Start "loading" so a selection restored from elsewhere is not dropped before
  // the first fetch resolves; reload() re-raises it synchronously for the same
  // reason (a template saved a moment ago is not yet in `templates`).
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => {
    setLoading(true)
    setReloadKey((k) => k + 1)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    axios.get(apiUrl('/api/perf/report-templates'), { params: { kind } })
      .then(({ data }) => {
        if (cancelled) return
        setTemplates(Array.isArray(data?.templates) ? data.templates : [])
      })
      .catch((e) => {
        if (cancelled) return
        setTemplates([])
        setError(e.response?.data?.error || e.message || 'Request failed')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [kind, reloadKey, scopeKey])

  return { templates, loading, error, reload }
}

function ChipToggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      className={`opl-chip is-toggle${checked ? ' is-active' : ''}`}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="opl-chip-box" aria-hidden="true">{checked ? <FiCheck size={11} /> : null}</span>
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
  const { hasConcreteProject } = useTenant()
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
    if (!hasConcreteProject) {
      onError('Select one project to save templates')
      return
    }
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
    if (!hasConcreteProject) {
      onError('Select one project to delete templates')
      return
    }
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
    <div className="opl-modal-scrim" role="presentation" onMouseDown={onClose}>
      <div
        className="opl-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Report and trend templates"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="opl-modal-head">
          <h2>Report and trend templates</h2>
          <Button variant="ghost" aria-label="Close" icon={<FiX />} onClick={onClose} />
        </div>
        <div className="opl-modal-body">
          <div className="opl-tpl-list">
            <div className="opl-tpl-list-label">Saved</div>
            {templates.length === 0 && <p className="oui-text-sm oui-text-muted">No saved layouts yet.</p>}
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`opl-tpl-list-item${draft.id === t.id ? ' is-active' : ''}`}
                aria-pressed={draft.id === t.id}
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
                <span className="oui-text-sm oui-text-muted">{t.kind}</span>
              </button>
            ))}
            <Button size="sm" variant="ghost" icon={<FiPlus />} onClick={() => setDraft(emptyDraft('report'))}>
              New report layout
            </Button>
            <Button size="sm" variant="ghost" icon={<FiPlus />} onClick={() => setDraft(emptyDraft('trend'))}>
              New trend layout
            </Button>
          </div>

          <div className="opl-tpl-form">
            <Stack>
              <Field label="Name" htmlFor="tpl-name">
                <Input
                  id="tpl-name"
                  value={draft.name}
                  placeholder="Weekly review"
                  onChange={(e) => setField({ name: e.target.value })}
                />
              </Field>

              <Field label="Kind">
                <div className="opl-chiprow">
                  {['report', 'trend'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={`opl-chip${draft.kind === k ? ' is-active' : ''}`}
                      aria-pressed={draft.kind === k}
                      onClick={() => switchKind(k)}
                    >
                      {k === 'report' ? 'report · per run' : 'trend · multi-run'}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Widgets" hint="At least one. Unknown names are dropped on save.">
                <div className="opl-chiprow">
                  {widgets.map((wg) => (
                    <ChipToggle
                      key={wg}
                      label={widgetLabel(wg)}
                      checked={draft.widgets.includes(wg)}
                      onChange={(on) => setField({ widgets: toggleIn(draft.widgets, wg, on) })}
                    />
                  ))}
                </div>
              </Field>

              <Field label="Metrics">
                <div className="opl-chiprow">
                  {TEMPLATE_METRICS.map((m) => (
                    <ChipToggle
                      key={m}
                      label={m}
                      checked={draft.metrics.includes(m)}
                      onChange={(on) => setField({ metrics: toggleIn(draft.metrics, m, on) })}
                    />
                  ))}
                </div>
              </Field>

              {draft.kind === 'trend' ? (
                <div className="opl-field-grid">
                  <Field label="Runs in the window" htmlFor="tpl-limit">
                    <Input
                      id="tpl-limit"
                      type="number"
                      min="1"
                      max="100"
                      value={draft.window.limit ?? 25}
                      onChange={(e) => setField({ window: { ...draft.window, limit: Number(e.target.value) } })}
                    />
                  </Field>
                  <Field label="SLA p95 (ms)" htmlFor="tpl-sla">
                    <Input
                      id="tpl-sla"
                      type="number"
                      min="1"
                      value={draft.window.sla_p95_ms ?? 500}
                      onChange={(e) => setField({ window: { ...draft.window, sla_p95_ms: Number(e.target.value) } })}
                    />
                  </Field>
                </div>
              ) : (
                <div className="opl-field-grid">
                  <Field label="Sample cap" htmlFor="tpl-cap">
                    <Input
                      id="tpl-cap"
                      type="number"
                      min="1"
                      max="5000"
                      value={draft.window.sample_cap ?? 200}
                      onChange={(e) => setField({ window: { ...draft.window, sample_cap: Number(e.target.value) } })}
                    />
                  </Field>
                </div>
              )}

              <p className="oui-text-sm oui-text-muted">
                Saved for the current organisation and project, like every other lab object. Unknown
                widget or metric names are dropped on save so an export never claims a widget the
                product cannot render.
              </p>

              <div className="oui-row">
                <Button variant="primary" icon={<FiCheck />} disabled={busy || !hasConcreteProject} onClick={save}>
                  Save template
                </Button>
                {draft.id && (
                  <Button variant="danger" icon={<FiTrash2 />} disabled={busy || !hasConcreteProject} onClick={remove}>
                    Delete
                  </Button>
                )}
                <span className="oui-spacer" />
                <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
              </div>
            </Stack>
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
      <Stack>
        <DefinitionList items={[{ term: 'Template', value: 'None — the full layout' }]} />
        <p className="oui-text-sm oui-text-muted">
          Exports render every widget and metric the product can produce for this run.
        </p>
        {note && <p className="oui-text-sm oui-text-muted">{note}</p>}
      </Stack>
    )
  }
  const win = template.window || {}
  const windowText = template.kind === 'trend'
    ? `last ${win.limit ?? win.runs ?? 25} runs · SLA p95 ${win.sla_p95_ms ?? 500} ms`
    : `sample cap ${win.sample_cap ?? 200}`
  return (
    <Stack>
      <DefinitionList
        items={[
          {
            term: 'Template',
            value: (
              <span className="oui-row">
                <strong>{template.name}</strong>
                <Badge tone="accent">{template.kind}</Badge>
              </span>
            ),
          },
          { term: 'Widgets', value: <Code>{(template.widgets || []).join(', ') || '—'}</Code> },
          { term: 'Metrics', value: <Code>{(template.metrics || []).join(', ') || '—'}</Code> },
          { term: 'Window', value: <Code>{windowText}</Code> },
        ]}
      />
      {scopeLabel && <p className="oui-text-sm oui-text-muted">{`Saved for ${scopeLabel}.`}</p>}
      {note && <p className="oui-text-sm oui-text-muted">{note}</p>}
    </Stack>
  )
}

// ReportTemplateBar is the picker: select + save-as + manage.
export default function ReportTemplateBar({
  kind, label, templates, selectedId, onSelect, onChanged, onError,
}) {
  const { hasConcreteProject } = useTenant()
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
    <span className="opl-tpl-bar">
      <Select
        aria-label={label || 'Template'}
        className="opl-tpl-select"
        options={[
          { value: '', label: 'No template — the full layout' },
          ...templates.map((t) => ({ value: t.id, label: t.name })),
        ]}
        value={selectedId || ''}
        onChange={(e) => onSelect(e.target.value)}
      />
      <Button size="sm" disabled={!hasConcreteProject} onClick={() => setEditing(emptyDraft(kind))}>Save as…</Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={!hasConcreteProject}
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
      </Button>
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
