import React from 'react'
import { FiRefreshCw, FiShield, FiXCircle } from 'react-icons/fi'
import {
  Badge, Button, Card, CellStack, EmptyState, Table, TableCaption,
} from '@open-family/ui'
import { useNavigate } from 'react-router-dom'
import { fmtAgo, fmtNum } from '../theme/format'
import { parseSummary } from '../perflab/model'
import { usePerfLab } from '../perflab/PerfLabContext'
import { tableState } from './tableState'
import OpaTracesLink from './OpaTracesLink'

const STATUS_TONE = {
  failed: 'critical',
  error: 'critical',
  cancelled: 'warning',
  running: 'accent',
  created: 'neutral',
  passed: 'good',
  completed: 'good',
  ok: 'good',
}

export function RunStatusBadge({ status }) {
  const key = String(status || '').toLowerCase()
  return <Badge tone={STATUS_TONE[key] || 'neutral'} dot>{status || '—'}</Badge>
}

/** Every load run in this scope, newest first. */
export default function RunsTable({ title = 'Runs', rows, compact = false }) {
  const navigate = useNavigate()
  const {
    runs, runRows, openRun, evaluateGate, cancelRun, busy, activeRunId,
  } = usePerfLab()
  const data = rows || runRows

  const columns = [
    {
      key: 'id',
      header: 'Run',
      mono: true,
      render: (r) => <CellStack primary={String(r.id).slice(0, 20)} secondary={r.scenario_id ? String(r.scenario_id).slice(0, 18) : undefined} />,
    },
    { key: 'status', header: 'Status', render: (r) => <RunStatusBadge status={r.status} /> },
    { key: 'vus', header: 'VUs', numeric: true, render: (r) => fmtNum(r.vus) },
    { key: 'p95_ms', header: 'p95', numeric: true, render: (r) => `${fmtNum(parseSummary(r).p95_ms)} ms` },
    { key: 'error_rate', header: 'Errors', numeric: true, render: (r) => fmtNum(parseSummary(r).error_rate) },
    { key: 'started_at', header: 'Started', render: (r) => <span className="oui-text-muted">{fmtAgo(r.started_at)}</span> },
  ]

  const rowActions = (r) => {
    const active = ['running', 'created'].includes(String(r.status || '').toLowerCase())
    return [
      { label: 'Open the result', icon: <FiRefreshCw />, onSelect: () => openRun(r.id) },
      { label: 'Evaluate the SLA gate', icon: <FiShield />, disabled: busy, onSelect: () => evaluateGate(r.id) },
      ...(active
        ? [{ separator: true }, { label: 'Cancel this run', icon: <FiXCircle />, danger: true, disabled: busy, onSelect: () => cancelRun(r.id) }]
        : []),
    ]
  }

  return (
    <Card
      title={title}
      actions={<OpaTracesLink runId={data[0]?.id}>Traces for the latest run</OpaTracesLink>}
      flush
    >
      <Table
        aria-label={title}
        state={tableState({ loading: runs.loading, error: runs.error, rows: data })}
        compact={compact}
        columns={columns}
        rows={data}
        getRowKey={(r) => r.id}
        isRowSelected={(r) => r.id === activeRunId}
        onRowClick={(r) => openRun(r.id)}
        rowActions={rowActions}
        emptyState={(
          <EmptyState
            inline
            title="No runs in this scope yet"
            description="A run appears the moment one is dispatched. You can also import an existing JTL to read results without running anything."
            actions={<Button variant="primary" onClick={() => navigate('/run')}>Go to Run and scale</Button>}
          />
        )}
        errorState={(
          <EmptyState
            inline
            title="The run list failed to load"
            description={`${runs.error || 'Request failed'} — this panel only. Runs are stored per organisation and project, so check the scope in the top bar as well.`}
            actions={(
              <Button variant="primary" icon={<FiRefreshCw />} onClick={() => runs.reload?.()}>Retry</Button>
            )}
          />
        )}
      />
      <TableCaption>
        <span>
          {'Showing '}
          <strong className="oui-num">{fmtNum(data.length)}</strong>
          {' runs'}
        </span>
      </TableCaption>
    </Card>
  )
}
