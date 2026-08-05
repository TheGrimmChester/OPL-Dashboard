import React, { useEffect } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { FiPackage, FiShield, FiXCircle } from 'react-icons/fi'
import {
  Button, PageHeader, Stack, StatRow, StatTile, SubNav,
} from '@open-family/ui'
import { RESULT_TABS, resultTabPath } from '../nav'
import { usePerfLab } from '../perflab/PerfLabContext'
import { RunStatusBadge } from '../components/RunsTable'
import OpaTracesLink from '../components/OpaTracesLink'
import { fmtNum } from '../theme/format'

/**
 * One run, four views. `?run=<id>&tab=results` on a single page became
 * `/results/:runId` with a tab strip — the run is now in the URL, so a result can
 * be linked, bookmarked and reloaded.
 */
export default function ResultDetail() {
  const { runId } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const {
    activeRunId, setActiveRunId, runDetail, liveKPIs, form, busy,
    runIsActive, cancelRun, evaluateGate, downloadBenchPack,
  } = usePerfLab()

  // The URL is the source of truth for which run is open: a reload, a bookmark
  // and an in-app click all land in the same state.
  useEffect(() => {
    if (runId && runId !== activeRunId) setActiveRunId(runId)
  }, [runId, activeRunId, setActiveRunId])

  const slaP95 = Number(form.sla?.p95_ms) || 500
  const maxErr = Number(form.sla?.error_rate_max) || 0.05
  const p95Over = liveKPIs.p95 > slaP95
  const errOver = liveKPIs.err > maxErr

  const tabs = RESULT_TABS.map((t) => ({ to: resultTabPath(runId, t.segment), label: t.label }))

  return (
    <Stack gap="sections">
      <PageHeader
        breadcrumbs={[
          { label: 'Results', onClick: () => navigate('/results') },
          { label: String(runId) },
        ]}
        title={String(runId)}
        mono
        description={liveKPIs.source === 'summary'
          ? 'Figures below come from the run summary the engine reported.'
          : liveKPIs.source === 'samples'
            ? 'Figures below are computed from the samples streamed so far, and update every two seconds.'
            : 'No samples yet — waiting for the engine, or this run was created without dispatch.'}
        meta={[
          { label: 'Status', value: <RunStatusBadge status={runDetail?.status} /> },
          { label: 'Source', value: liveKPIs.source },
          { label: 'Objective', value: `p95 ${fmtNum(slaP95)} ms · errors ${maxErr}` },
        ]}
        actions={(
          <>
            <OpaTracesLink runId={runId} size="md" />
            <Button icon={<FiShield />} disabled={busy} onClick={() => evaluateGate(runId)}>SLA gate</Button>
            <Button variant="primary" icon={<FiPackage />} disabled={busy} onClick={downloadBenchPack}>
              Bench pack
            </Button>
            {runIsActive && (
              <Button variant="danger" icon={<FiXCircle />} disabled={busy} onClick={() => cancelRun(runId)}>
                Cancel run
              </Button>
            )}
          </>
        )}
        flush
      />

      <StatRow>
        <StatTile
          label={liveKPIs.source === 'summary' ? 'Requests' : 'Samples'}
          value={fmtNum(liveKPIs.n)}
        />
        <StatTile label="p50" value={`${fmtNum(liveKPIs.p50)} ms`} />
        <StatTile
          label="p95"
          value={`${fmtNum(liveKPIs.p95)} ms`}
          foot={(
            <span className={p95Over ? 'opl-stat-bad' : 'oui-text-muted'}>
              {p95Over ? `Over the ${fmtNum(slaP95)} ms objective` : `Within the ${fmtNum(slaP95)} ms objective`}
            </span>
          )}
        />
        <StatTile
          label="Error rate"
          value={fmtNum(liveKPIs.err)}
          meter={{
            value: Math.min(100, (liveKPIs.err / (maxErr || 1)) * 100),
            tone: errOver ? 'critical' : 'accent',
            label: 'Error rate against the maximum',
          }}
          foot={(
            <span className={errOver ? 'opl-stat-bad' : 'oui-text-muted'}>
              {errOver ? `Over the ${maxErr} maximum` : `Maximum ${maxErr}`}
            </span>
          )}
        />
      </StatRow>

      <SubNav aria-label="Result views" items={tabs} pathname={pathname} onNavigate={navigate} />
      <Outlet />
    </Stack>
  )
}
