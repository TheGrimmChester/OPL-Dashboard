import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiPlay, FiPlus } from 'react-icons/fi'
import {
  Button, Card, DefinitionList, EmptyState, Grid, PageHeader, Stack, StatRow, StatTile,
} from '@open-family/ui'
import { fmtAgo, fmtNum } from '../theme/format'
import { parseSummary } from '../perflab/model'
import { usePerfLab } from '../perflab/PerfLabContext'
import RunsTable from '../components/RunsTable'
import LatencyBandChart from '../components/charts/LatencyBandChart'

/**
 * The landing page. `/` used to render the whole studio; now it redirects here,
 * and this page answers the one question an operator opens the lab with: what did
 * the last run do, and is anything breaching.
 *
 * Every figure comes from the two lists the lab already fetches — no new request.
 */
export default function Overview() {
  const navigate = useNavigate()
  const {
    scenarios, runs, scnRows, runRows, form, engineLabel, runnerLabel, scopeLabel, busy,
  } = usePerfLab()

  const slaP95 = Number(form.sla?.p95_ms) || 500

  // Runs carry their summary as JSON; oldest→newest so the chart reads left to right.
  const finished = useMemo(() => runRows
    .map((r) => {
      const s = parseSummary(r)
      return {
        id: r.id,
        status: r.status,
        started_at: r.started_at,
        p50_ms: Number(s.p50_ms) || 0,
        p95_ms: Number(s.p95_ms) || 0,
        p99_ms: Number(s.p99_ms) || 0,
        error_rate: Number(s.error_rate) || 0,
      }
    })
    .filter((r) => r.p95_ms > 0)
    .slice(0, 20)
    .reverse(), [runRows])

  const latest = finished[finished.length - 1] || null
  const previous = finished.length > 1 ? finished[finished.length - 2] : null
  const breaching = finished.filter((r) => r.p95_ms > slaP95).length

  const p95Delta = latest && previous
    ? {
      value: `${fmtNum(Math.abs(latest.p95_ms - previous.p95_ms))} ms`,
      direction: latest.p95_ms === previous.p95_ms ? 'flat' : latest.p95_ms > previous.p95_ms ? 'up' : 'down',
      // Rising latency is bad news; the arrow shows direction, the colour sentiment.
      good: latest.p95_ms < previous.p95_ms,
    }
    : undefined

  return (
    <Stack gap="sections">
      <PageHeader
        title="Overview"
        description="What the lab has measured in this scope: the latest run against the scenario SLA, and the load-generation stack behind it."
        meta={[
          { label: 'Scope', value: scopeLabel },
          { label: 'Engine', value: engineLabel },
          { label: 'Runner', value: runnerLabel },
        ]}
        actions={(
          <>
            <Button icon={<FiPlus />} onClick={() => navigate('/scenarios')}>New scenario</Button>
            <Button variant="primary" icon={<FiPlay />} disabled={busy} onClick={() => navigate('/run')}>
              Run and scale
            </Button>
          </>
        )}
      />

      <StatRow>
        <StatTile
          hero
          label="Latest p95"
          value={latest ? `${fmtNum(latest.p95_ms)} ms` : '—'}
          delta={p95Delta}
          deltaLabel={previous ? 'vs the previous run' : undefined}
          foot={<span className="oui-text-muted">{`SLA ${fmtNum(slaP95)} ms`}</span>}
          spark={finished.length > 1 ? finished.map((r) => r.p95_ms) : undefined}
        />
        <StatTile
          label="Scenarios"
          value={scenarios.error ? '—' : fmtNum(scnRows.length)}
          foot={scenarios.error
            ? <span className="opl-stat-bad">List failed to load</span>
            : <span className="oui-text-muted">In this scope</span>}
        />
        <StatTile
          label="Runs recorded"
          value={runs.error ? '—' : fmtNum(runRows.length)}
          foot={runs.error
            ? <span className="opl-stat-bad">List failed to load</span>
            : <span className="oui-text-muted">Newest first below</span>}
        />
        <StatTile
          label="Runs over the SLA"
          value={fmtNum(breaching)}
          meter={{
            value: finished.length ? (breaching / finished.length) * 100 : 0,
            tone: breaching ? 'critical' : 'accent',
            label: 'Share of charted runs over the p95 objective',
          }}
          foot={<span className="oui-text-muted">{`Of the last ${fmtNum(finished.length)} measured runs`}</span>}
        />
      </StatRow>

      <Grid columns="split">
        <Card
          title="Latency across recent runs"
          description="p50, p95 and p99 for every run that reported a summary, oldest on the left."
        >
          <LatencyBandChart points={finished} slaP95={slaP95} />
        </Card>
        <Card title="Latest run" description="The most recent run in this scope.">
          {latest ? (
            <DefinitionList
              items={[
                { term: 'Run', value: String(latest.id).slice(0, 22), mono: true },
                { term: 'Status', value: latest.status || '—' },
                { term: 'Started', value: fmtAgo(latest.started_at) },
                { term: 'p50', value: `${fmtNum(latest.p50_ms)} ms` },
                { term: 'p95', value: `${fmtNum(latest.p95_ms)} ms` },
                { term: 'p99', value: `${fmtNum(latest.p99_ms)} ms` },
                { term: 'Error rate', value: fmtNum(latest.error_rate) },
              ]}
            />
          ) : (
            <EmptyState
              inline
              title="Nothing measured yet"
              description="No run in this scope has reported a summary. Start one, or import an existing JTL from the Results page."
              actions={<Button variant="primary" onClick={() => navigate('/run')}>Run and scale</Button>}
            />
          )}
        </Card>
      </Grid>

      <RunsTable title="Recent runs" rows={runRows.slice(0, 8)} compact />
    </Stack>
  )
}
