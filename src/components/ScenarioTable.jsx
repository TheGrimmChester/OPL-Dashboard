import React from 'react'
import { FiCopy, FiPlay, FiPlus, FiRefreshCw, FiRotateCcw, FiTrash2 } from 'react-icons/fi'
import {
  Button, Card, CellStack, EmptyState, Segmented, Table, TableCaption, TableToolbar,
  TableToolbarSpacer,
} from '@open-family/ui'
import { useNavigate } from 'react-router-dom'
import { fmtNum } from '../theme/format'
import { usePerfLab } from '../perflab/PerfLabContext'
import { tableState } from './tableState'

/**
 * The scenario list. One implementation, used by Scenarios, Run and scale, and
 * Overview — the tabbed page rendered two near-identical copies with different
 * `maxHeight` values.
 */
export default function ScenarioTable({ title = 'Scenarios', density = 'comfortable', onDensity }) {
  const navigate = useNavigate()
  const {
    scenarios, scnRows, showArchived, setShowArchived, busy,
    loadScenario, startRun, duplicateScenario, archiveScenario, unarchiveScenario,
  } = usePerfLab()

  const columns = [
    {
      key: 'name',
      header: 'Scenario',
      render: (r) => <CellStack primary={r.name} secondary={String(r.id).slice(0, 18)} />,
    },
    { key: 'vus', header: 'VUs', numeric: true, render: (r) => fmtNum(r.vus) },
    { key: 'duration_seconds', header: 'Duration', numeric: true, render: (r) => `${fmtNum(r.duration_seconds)} s` },
    { key: 'jmx_bytes', header: 'JMX', numeric: true, render: (r) => fmtNum(r.jmx_bytes || 0) },
  ]

  const rowActions = (r) => (showArchived
    ? [
      { label: 'Restore', icon: <FiRotateCcw />, disabled: busy, onSelect: () => unarchiveScenario(r.id) },
    ]
    : [
      { label: 'Open in the designer', icon: <FiPlus />, disabled: busy, onSelect: () => loadScenario(r.id) },
      { label: 'Start a run', icon: <FiPlay />, disabled: busy, onSelect: () => startRun(r.id) },
      { label: 'Duplicate', icon: <FiCopy />, disabled: busy, onSelect: () => duplicateScenario(r.id) },
      { separator: true },
      { label: 'Archive', icon: <FiTrash2 />, danger: true, disabled: busy, onSelect: () => archiveScenario(r.id) },
    ])

  return (
    <Card title={showArchived ? 'Archived scenarios' : title} flush>
      <TableToolbar>
        <Segmented
          aria-label="Scenario list"
          value={showArchived ? 'archived' : 'active'}
          onChange={(v) => setShowArchived(v === 'archived')}
          items={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }]}
        />
        <TableToolbarSpacer />
        {onDensity && (
          <Segmented
            aria-label="Row density"
            value={density}
            onChange={onDensity}
            items={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]}
          />
        )}
      </TableToolbar>
      <Table
        aria-label={showArchived ? 'Archived scenarios' : 'Scenarios'}
        state={tableState({ loading: scenarios.loading, error: scenarios.error, rows: scnRows })}
        compact={density === 'compact'}
        columns={columns}
        rows={scnRows}
        getRowKey={(r) => r.id}
        onRowClick={(r) => (showArchived ? unarchiveScenario(r.id) : loadScenario(r.id))}
        rowActions={rowActions}
        emptyState={(
          <EmptyState
            inline
            title={showArchived ? 'Nothing archived' : 'No scenarios in this scope yet'}
            description={showArchived
              ? 'Archived scenarios are soft-deleted, not removed. Anything you archive appears here.'
              : 'A scenario is a virtual-user journey plus its load shape and SLA. Build one in the designer, or import a JMX or a captured HAR.'}
            actions={showArchived
              ? undefined
              : <Button variant="primary" icon={<FiPlus />} onClick={() => navigate('/scenarios')}>Open the designer</Button>}
          />
        )}
        errorState={(
          <EmptyState
            inline
            title="The scenario list failed to load"
            description={`${scenarios.error || 'Request failed'} — the rest of the page is unaffected. Check the scope in the top bar; scenarios are stored per organisation and project.`}
            actions={(
              <Button variant="primary" icon={<FiRefreshCw />} onClick={() => scenarios.reload?.()}>
                Retry
              </Button>
            )}
          />
        )}
      />
      <TableCaption>
        <span>
          {'Showing '}
          <strong className="oui-num">{fmtNum(scnRows.length)}</strong>
          {showArchived ? ' archived scenarios' : ' scenarios'}
        </span>
      </TableCaption>
    </Card>
  )
}
