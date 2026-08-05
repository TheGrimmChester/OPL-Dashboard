import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FiRefreshCw } from 'react-icons/fi'
import {
  Banner, Button, Card, EmptyState, Grid, PageHeader, Stack, StatRow, StatTile, Table,
} from '@open-family/ui'
import ReportTemplateBar, { AppliedTemplate } from '../components/ReportTemplateBar'
import LatencyBandChart from '../components/charts/LatencyBandChart'
import ErrorRateBars from '../components/charts/ErrorRateBars'
import { RunStatusBadge } from '../components/RunsTable'
import { tableState } from '../components/tableState'
import { usePerfLab } from '../perflab/PerfLabContext'
import { fmtAgo, fmtNum } from '../theme/format'

/** Δ p95 against the previous run in the window. */
function DeltaP95({ row, points }) {
  if (row.delta_p95_ms != null) {
    const v = Number(row.delta_p95_ms)
    return <span className={v > 0 ? 'opl-stat-bad' : 'opl-stat-good'}>{fmtNum(v)}</span>
  }
  const prev = points[points.indexOf(row) - 1]
  if (!prev) return '—'
  const v = (Number(row.p95_ms) || 0) - (Number(prev.p95_ms) || 0)
  if (!v) return <span className="oui-text-muted">0</span>
  // Rising latency is bad news; the sign carries the direction.
  return <span className={v > 0 ? 'opl-stat-bad' : 'opl-stat-good'}>{v > 0 ? '+' : ''}{fmtNum(v)}</span>
}

/**
 * Trends — multi-run analysis for the selected scenario. This was the `trends`
 * tab.
 */
export default function Trends() {
  const navigate = useNavigate()
  const {
    selectedId, form, scopeLabel, flash, runs,
    trendData, trendLoading, trendError, trendPoints, trendWidgets, trendShows, trendShowsMetric,
    trendTemplates, trendTemplateId, setTrendTemplateId, activeTrendTemplate,
  } = usePerfLab()

  const slaP95 = Number(trendData?.sla_p95_ms ?? form.sla.p95_ms) || 500
  const maxErr = Number(form.sla?.error_rate_max) || 0.05

  if (!selectedId) {
    return (
      <Stack gap="sections">
        <PageHeader
          title="Trends"
          description="How one scenario has behaved across its recent runs — the latency band, the error rate, and every run in the window."
          meta={[{ label: 'Scope', value: scopeLabel }]}
        />
        <Card>
          <EmptyState
            title="No scenario selected"
            description="Trends compare runs of a single scenario, so pick one first. Selecting a row on Scenarios or Run and scale loads it here."
            actions={<Button variant="primary" onClick={() => navigate('/scenarios')}>Choose a scenario</Button>}
          />
        </Card>
      </Stack>
    )
  }

  const breaches = trendData?.sla_breaches
    ?? trendPoints.filter((p) => Number(p.p95_ms) > slaP95).length
  const bestP95 = trendData?.best_p95_ms
    ?? (trendPoints.length ? Math.min(...trendPoints.map((p) => Number(p.p95_ms) || Infinity)) : 0)
  const worstP95 = trendData?.worst_p95_ms
    ?? (trendPoints.length ? Math.max(...trendPoints.map((p) => Number(p.p95_ms) || 0)) : 0)

  const columns = [
    { key: 'id', header: 'Run', mono: true, render: (r) => String(r.id).slice(0, 20) },
    { key: 'status', header: 'Status', render: (r) => <RunStatusBadge status={r.status} /> },
    { key: 'vus', header: 'VUs', numeric: true, render: (r) => fmtNum(r.vus) },
    ...(trendShowsMetric('p50_ms') ? [{ key: 'p50_ms', header: 'p50', numeric: true, render: (r) => `${fmtNum(r.p50_ms)} ms` }] : []),
    ...(trendShowsMetric('p95_ms') ? [{ key: 'p95_ms', header: 'p95', numeric: true, render: (r) => `${fmtNum(r.p95_ms)} ms` }] : []),
    ...(trendShowsMetric('p99_ms') ? [{ key: 'p99_ms', header: 'p99', numeric: true, render: (r) => `${fmtNum(r.p99_ms)} ms` }] : []),
    ...(trendShowsMetric('avg_ms') ? [{ key: 'avg_ms', header: 'Average', numeric: true, render: (r) => `${fmtNum(r.avg_ms)} ms` }] : []),
    {
      key: 'delta_p95_ms',
      header: 'Δ p95',
      numeric: true,
      render: (r) => <DeltaP95 row={r} points={trendPoints} />,
    },
    ...(trendShowsMetric('error_rate') ? [{ key: 'error_rate', header: 'Errors', numeric: true, render: (r) => fmtNum(r.error_rate) }] : []),
    ...(trendShowsMetric('samples') ? [{ key: 'samples', header: 'Samples', numeric: true, render: (r) => fmtNum(r.samples) }] : []),
    { key: 'started_at', header: 'Started', render: (r) => <span className="oui-text-muted">{fmtAgo(r.started_at)}</span> },
  ]

  return (
    <Stack gap="sections">
      <PageHeader
        title="Trends"
        description="How this scenario has behaved across its recent runs. A regression shows here before it shows in production."
        meta={[
          { label: 'Scenario', value: form.name },
          { label: 'Runs in window', value: fmtNum(trendData?.count ?? trendPoints.length) },
          { label: 'Objective', value: `p95 ${fmtNum(slaP95)} ms` },
          { label: 'Scope', value: scopeLabel },
        ]}
      />

      {trendError && (
        <Banner
          tone="critical"
          title="The trend request failed"
          actions={<Button size="sm" icon={<FiRefreshCw />} onClick={() => runs.reload?.()}>Retry</Button>}
        >
          {`${trendError} — the figures below fall back to this session's local run history, which may cover a different window than the template asks for.`}
        </Banner>
      )}

      <Card
        title="Trend layout"
        description="A template selects which widgets and metric columns this page and its exports render."
        actions={(
          <ReportTemplateBar
            kind="trend"
            label="Trend template"
            templates={trendTemplates.templates}
            selectedId={trendTemplateId}
            onSelect={setTrendTemplateId}
            onChanged={(id) => { trendTemplates.reload(); setTrendTemplateId(id || '') }}
            onError={(detail) => flash('error', 'Template save failed', detail)}
          />
        )}
      >
        <AppliedTemplate
          template={activeTrendTemplate}
          scopeLabel={scopeLabel}
          note={trendData?.template_note}
        />
      </Card>

      {trendWidgets.length === 0 && (
        <Card>
          <EmptyState
            title="This template selects no widgets"
            description="Open Manage on the template picker and tick at least one widget, or switch back to the full layout."
          />
        </Card>
      )}

      {trendShows('kpis') && (
        <StatRow>
          <StatTile
            label="Runs in window"
            value={fmtNum(trendData?.count ?? trendPoints.length)}
            foot={trendData?.limit ? <span className="oui-text-muted">{`Limit ${trendData.limit}`}</span> : null}
          />
          <StatTile
            label="Best p95"
            value={`${fmtNum(bestP95)} ms`}
            foot={trendData?.best_run_id
              ? <span className="oui-text-muted oui-mono">{String(trendData.best_run_id).slice(0, 16)}</span>
              : null}
          />
          <StatTile
            label="Worst p95"
            value={`${fmtNum(worstP95)} ms`}
            foot={trendData?.worst_run_id
              ? <span className="oui-text-muted oui-mono">{String(trendData.worst_run_id).slice(0, 16)}</span>
              : null}
          />
          <StatTile
            label="SLA breaches"
            value={fmtNum(breaches)}
            meter={{
              value: trendPoints.length ? (breaches / trendPoints.length) * 100 : 0,
              tone: breaches ? 'critical' : 'accent',
              label: 'Share of runs in the window over the p95 objective',
            }}
            foot={<span className="oui-text-muted">{`p95 over ${fmtNum(slaP95)} ms`}</span>}
          />
        </StatRow>
      )}

      {(trendShows('latency_band') || trendShows('error_bars')) && (
        <Grid columns={trendShows('latency_band') && trendShows('error_bars') ? 'split' : 2}>
          {trendShows('latency_band') && (
            <Card
              title="Latency band"
              description="p50, p95 and p99 per run, oldest on the left, against the p95 objective."
            >
              {trendLoading
                ? <p className="oui-text-sm oui-text-muted">Loading the window…</p>
                : <LatencyBandChart points={trendPoints} slaP95={slaP95} />}
            </Card>
          )}
          {trendShows('error_bars') && (
            <Card title="Error rate by run" description="One column per run, oldest on the left.">
              {trendLoading
                ? <p className="oui-text-sm oui-text-muted">Loading the window…</p>
                : <ErrorRateBars points={trendPoints} maxErrorRate={maxErr} />}
            </Card>
          )}
        </Grid>
      )}

      {trendShows('runs_table') && (
        <Card title="Every run in the window" description="Newest first." flush>
          <Table
            aria-label="Runs in the trend window"
            state={tableState({
              loading: trendLoading,
              error: trendError && !trendPoints.length ? trendError : null,
              rows: trendPoints,
            })}
            columns={columns}
            rows={[...trendPoints].reverse()}
            getRowKey={(r) => r.id}
            emptyState={(
              <EmptyState
                inline
                title="Only one run so far"
                description="A trend needs at least two runs of the same scenario. Start another from Run and scale."
              />
            )}
            errorState={(
              <EmptyState
                inline
                title="The trend window failed to load"
                description={`${trendError || 'Request failed'} — nothing else on this page is affected.`}
                actions={<Button variant="primary" icon={<FiRefreshCw />} onClick={() => runs.reload?.()}>Retry</Button>}
              />
            )}
          />
        </Card>
      )}

      {trendData?.honesty && (
        <p className="oui-text-sm oui-text-muted">{trendData.honesty}</p>
      )}
    </Stack>
  )
}
