import React from 'react'
import {
  Badge, Card, DefinitionList, EmptyState, Stack, Table,
} from '@open-family/ui'
import { usePerfLab } from '../../perflab/PerfLabContext'
import { tableState } from '../../components/tableState'
import { fmtNum } from '../../theme/format'

/**
 * Resources — the load-generation side of the run: which containers carried it,
 * and how many workers the engine was given. This was the "Runners" block of the
 * `results` tab.
 */
export default function ResourcesTab() {
  const { runners, runDetail, summaryPreview, engineLabel, runnerLabel } = usePerfLab()
  const containers = runners?.containers || []
  const loading = !runDetail && !runners

  return (
    <Stack gap="sections">
      <Card
        title="Load generation"
        description="What executed this run. A run created without dispatch has no containers at all."
      >
        <DefinitionList
          items={[
            { term: 'Engine', value: summaryPreview?.engine || engineLabel },
            { term: 'Runner', value: runnerLabel },
            { term: 'Workers requested', value: summaryPreview?.workers != null ? fmtNum(summaryPreview.workers) : '—' },
            { term: 'Containers reported', value: summaryPreview?.containers != null ? fmtNum(summaryPreview.containers) : fmtNum(containers.length) },
            { term: 'Running now', value: fmtNum(runners?.running || 0) },
            { term: 'Source', value: runners?.honesty || 'Local Docker inspect' },
          ]}
        />
      </Card>

      <Card
        title="Runner containers"
        description="Inspected directly on the Docker host, so a container that exited is reported as it is rather than hidden."
        flush
      >
        <Table
          aria-label="Runner containers"
          state={tableState({ loading, error: null, rows: containers })}
          columns={[
            { key: 'name', header: 'Container', mono: true, render: (r) => r.name },
            {
              key: 'status',
              header: 'State',
              render: (r) => (
                <Badge tone={r.running ? 'good' : r.found ? 'neutral' : 'critical'} dot>
                  {r.status || '—'}
                </Badge>
              ),
            },
            { key: 'image', header: 'Image', mono: true, render: (r) => r.image || '—' },
          ]}
          rows={containers}
          getRowKey={(r) => r.name}
          emptyState={(
            <EmptyState
              inline
              title="No runner containers"
              description="Either this run was created without dispatch, or its containers have already been reaped. The run's samples and summary are unaffected."
            />
          )}
        />
      </Card>
    </Stack>
  )
}
