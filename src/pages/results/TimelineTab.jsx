import React from 'react'
import { Badge, Card, EmptyState, Stack, Table, TableCaption } from '@open-family/ui'
import { usePerfLab } from '../../perflab/PerfLabContext'
import { sampleFailed } from '../../perflab/model'
import { tableState } from '../../components/tableState'
import { fmtAgo, fmtNum } from '../../theme/format'

const SAMPLE_CAP = 100

/**
 * Timeline — the sample stream, newest first, as the poller receives it. This was
 * the "Live samples" panel of the `results` tab.
 */
export default function TimelineTab() {
  const { samples, runDetail, activeRunId, liveKPIs } = usePerfLab()
  const rows = samples.slice(0, SAMPLE_CAP)
  const loading = !runDetail && !samples.length

  return (
    <Stack gap="sections">
      <Card
        title="Samples"
        description={`The most recent ${SAMPLE_CAP} samples the engine has reported, refreshed every two seconds while this page is open.`}
        flush
      >
        <Table
          aria-label="Run samples"
          state={tableState({ loading, error: null, rows })}
          columns={[
            {
              key: 'label',
              header: 'Step',
              render: (r) => r.step_name || r.label || r.name || r.url || '—',
            },
            { key: 'latency_ms', header: 'Latency', numeric: true, render: (r) => `${fmtNum(r.latency_ms)} ms` },
            {
              key: 'ok',
              header: 'Outcome',
              render: (r) => (sampleFailed(r)
                ? <Badge tone="critical" dot>failed</Badge>
                : <Badge tone="good" dot>ok</Badge>),
            },
            {
              key: 'ts',
              header: 'When',
              render: (r) => <span className="oui-text-muted">{fmtAgo(r.ts || r.t || r.started_at)}</span>,
            },
          ]}
          rows={rows}
          getRowKey={(r, i) => String(r.id ?? i)}
          emptyState={(
            <EmptyState
              inline
              title={activeRunId && liveKPIs.source === 'none'
                ? 'No samples yet'
                : 'This run reported no samples'}
              description={activeRunId && liveKPIs.source === 'none'
                ? 'Waiting for the engine. A run created without dispatch never produces samples — check the Resources tab for the runner containers.'
                : 'A run imported from a summary carries aggregate figures but no individual samples.'}
            />
          )}
        />
        {rows.length > 0 && (
          <TableCaption>
            <span>
              {'Showing '}
              <strong className="oui-num">{fmtNum(rows.length)}</strong>
              {' of '}
              <strong className="oui-num">{fmtNum(samples.length)}</strong>
              {' samples held in this session'}
            </span>
          </TableCaption>
        )}
      </Card>
    </Stack>
  )
}
