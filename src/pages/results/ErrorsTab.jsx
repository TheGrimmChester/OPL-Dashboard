import React, { useMemo } from 'react'
import { Banner, Card, EmptyState, Meter, Stack, Table } from '@open-family/ui'
import { usePerfLab } from '../../perflab/PerfLabContext'
import { sampleFailed } from '../../perflab/model'
import { tableState } from '../../components/tableState'
import { fmtAgo, fmtNum } from '../../theme/format'

/**
 * Errors — the failing samples and the steps they came from.
 *
 * Both tables are views over data the run poller already holds; nothing here
 * issues a request of its own.
 */
export default function ErrorsTab() {
  const { samples, stepStats, runDetail, summaryPreview, form } = usePerfLab()

  const failed = useMemo(() => samples.filter(sampleFailed), [samples])
  const worstSteps = useMemo(() => [...stepStats]
    .filter((s) => (Number(s.error_rate) || 0) > 0)
    .sort((a, b) => (Number(b.error_rate) || 0) - (Number(a.error_rate) || 0)), [stepStats])

  const runError = runDetail?.error || summaryPreview?.dispatch_error
  const maxErr = Number(form.sla?.error_rate_max) || 0.05
  const loading = !runDetail && !samples.length

  return (
    <Stack gap="sections">
      {runError && (
        <Banner tone="critical" title="The run itself failed">
          {String(runError)}
        </Banner>
      )}

      <Card
        title="Failing steps"
        description="Journey steps with a non-zero error rate, worst first. The meter compares each step against the scenario's maximum."
        flush
      >
        <Table
          aria-label="Failing steps"
          state={tableState({ loading, error: null, rows: worstSteps })}
          columns={[
            { key: 'step_name', header: 'Step' },
            { key: 'samples', header: 'Samples', numeric: true, render: (r) => fmtNum(r.samples) },
            { key: 'error_rate', header: 'Error rate', numeric: true, render: (r) => fmtNum(r.error_rate) },
            {
              key: 'against',
              header: `Against the ${maxErr} maximum`,
              width: 220,
              render: (r) => (
                <Meter
                  value={Math.min(100, ((Number(r.error_rate) || 0) / (maxErr || 1)) * 100)}
                  tone={(Number(r.error_rate) || 0) > maxErr ? 'critical' : 'accent'}
                  label={`${r.step_name} error rate against the maximum`}
                />
              ),
            },
          ]}
          rows={worstSteps}
          getRowKey={(r) => r.step_name}
          emptyState={(
            <EmptyState
              inline
              title="No step reported an error"
              description="Either every step succeeded, or the engine has not written per-step statistics yet — those arrive when the run reaches a terminal status."
            />
          )}
        />
      </Card>

      <Card
        title="Failed samples"
        description="Every sample the engine marked as a failure, from the stream this session has collected."
        flush
      >
        <Table
          aria-label="Failed samples"
          state={tableState({ loading, error: null, rows: failed })}
          columns={[
            { key: 'label', header: 'Step', render: (r) => r.step_name || r.label || r.name || r.url || '—' },
            { key: 'latency_ms', header: 'Latency', numeric: true, render: (r) => `${fmtNum(r.latency_ms)} ms` },
            { key: 'status', header: 'Status', render: (r) => r.status ?? r.code ?? '—' },
            { key: 'detail', header: 'Detail', render: (r) => r.error || r.message || r.detail || '—' },
            { key: 'ts', header: 'When', render: (r) => <span className="oui-text-muted">{fmtAgo(r.ts || r.t)}</span> },
          ]}
          rows={failed}
          getRowKey={(r, i) => String(r.id ?? `fail-${i}`)}
          emptyState={(
            <EmptyState
              inline
              title="No failed samples"
              description={samples.length
                ? `All ${fmtNum(samples.length)} samples in this session succeeded.`
                : 'No samples have arrived yet, so nothing can be classified as a failure.'}
            />
          )}
        />
      </Card>
    </Stack>
  )
}
