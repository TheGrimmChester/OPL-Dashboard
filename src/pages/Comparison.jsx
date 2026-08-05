import React from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import {
  Badge, Button, Card, EmptyState, Field, Grid, PageHeader, Select, Stack, Table,
} from '@open-family/ui'
import { usePerfLab } from '../perflab/PerfLabContext'
import OpaTracesLink from '../components/OpaTracesLink'
import { tableState } from '../components/tableState'
import { fmtNum } from '../theme/format'

/**
 * Comparison — two runs side by side. This was the `compare` tab.
 *
 * Δ is always B minus A, and the badge says whether that direction is welcome:
 * a lower p95 in B is good news even though the number is negative.
 */
export default function Comparison() {
  const {
    runRows, runs, compareA, setCompareA, compareB, setCompareB, compare,
    baselines, baseRows, scopeLabel,
  } = usePerfLab()

  const runOptions = [
    { value: '', label: 'Select a run…' },
    ...runRows.map((r) => ({ value: r.id, label: `${String(r.id).slice(0, 22)} · ${r.status}` })),
  ]

  const rows = compare
    ? [
      { metric: 'p50', a: `${fmtNum(compare.a.p50_ms)} ms`, b: `${fmtNum(compare.b.p50_ms)} ms`, d: compare.d_p50, unit: 'ms', worse: compare.d_p50 > 0 },
      { metric: 'p95', a: `${fmtNum(compare.a.p95_ms)} ms`, b: `${fmtNum(compare.b.p95_ms)} ms`, d: compare.d_p95, unit: 'ms', worse: compare.d_p95 > 0 },
      { metric: 'Error rate', a: fmtNum(compare.a.error_rate), b: fmtNum(compare.b.error_rate), d: compare.d_err, unit: '', worse: compare.d_err > 0 },
      { metric: 'Virtual users', a: fmtNum(compare.a.vus), b: fmtNum(compare.b.vus), d: (compare.b.vus || 0) - (compare.a.vus || 0), unit: '', worse: false, neutral: true },
    ]
    : []

  return (
    <Stack gap="sections">
      <PageHeader
        title="Comparison"
        description="Percentile and error-rate deltas between any two runs in this scope. Both runs keep their own trace deep link, so a regression can be traced rather than guessed at."
        meta={[
          { label: 'Runs available', value: fmtNum(runRows.length) },
          { label: 'Scope', value: scopeLabel },
        ]}
      />

      <Card title="Pick two runs" description="A is the reference; B is the run under test.">
        <Stack>
          <Grid columns={2}>
            <Field label="Run A — reference">
              <Select
                aria-label="Run A"
                options={runOptions}
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
              />
            </Field>
            <Field label="Run B — under test">
              <Select
                aria-label="Run B"
                options={runOptions}
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
              />
            </Field>
          </Grid>
          {(compareA || compareB) && (
            <div className="oui-row">
              {compareA && <OpaTracesLink runId={compareA}>Traces for A</OpaTracesLink>}
              {compareB && <OpaTracesLink runId={compareB}>Traces for B</OpaTracesLink>}
            </div>
          )}
        </Stack>
      </Card>

      <Card title="Deltas" description="B minus A. The badge reads the direction, not the sign." flush>
        <Table
          aria-label="Run comparison"
          state={tableState({ loading: runs.loading, error: runs.error, rows })}
          columns={[
            { key: 'metric', header: 'Metric' },
            { key: 'a', header: 'Run A', numeric: true },
            { key: 'b', header: 'Run B', numeric: true },
            {
              key: 'd',
              header: 'Δ (B − A)',
              numeric: true,
              render: (r) => {
                const value = `${r.d > 0 ? '+' : ''}${fmtNum(r.d)}${r.unit ? ` ${r.unit}` : ''}`
                if (r.neutral || !r.d) return <span className="oui-num oui-text-muted">{value}</span>
                return (
                  <Badge tone={r.worse ? 'critical' : 'good'} dot>
                    {`${value} · ${r.worse ? 'worse' : 'better'}`}
                  </Badge>
                )
              },
            },
          ]}
          rows={rows}
          getRowKey={(r) => r.metric}
          emptyState={(
            <EmptyState
              inline
              title="Pick two runs"
              description="Choose a reference above and the run you want to judge against it. Both must have reported a summary."
            />
          )}
          errorState={(
            <EmptyState
              inline
              title="The run list failed to load"
              description={`${runs.error || 'Request failed'} — without it there is nothing to compare. Check the scope in the top bar as well; runs are stored per organisation and project.`}
              actions={(
                <Button variant="primary" icon={<FiRefreshCw />} onClick={() => runs.reload?.()}>Retry</Button>
              )}
            />
          )}
        />
      </Card>

      {baseRows.length > 0 && (
        <Card title="Stored baselines" description="Baselines held on the profiling agent, when the peer API is available." flush>
          <Table
            aria-label="Stored baselines"
            state={tableState({ loading: baselines.loading, error: baselines.error, rows: baseRows })}
            columns={[
              { key: 'service', header: 'Service' },
              { key: 'transaction', header: 'Transaction' },
              { key: 'metric', header: 'Metric' },
              { key: 'value', header: 'Value', numeric: true, render: (r) => fmtNum(r.value) },
            ]}
            rows={baseRows}
            getRowKey={(r) => r.id || `${r.service}:${r.metric}`}
            emptyState={<EmptyState inline title="No baselines stored" />}
            errorState={(
              <EmptyState
                inline
                title="The baseline list failed to load"
                description={`${baselines.error || 'Request failed'} — comparison between two runs is unaffected.`}
              />
            )}
          />
        </Card>
      )}
    </Stack>
  )
}
