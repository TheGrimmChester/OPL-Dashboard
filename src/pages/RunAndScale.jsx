import React from 'react'
import { FiCheck, FiCopy, FiPlay, FiSave, FiTrash2 } from 'react-icons/fi'
import {
  Badge, Banner, Button, Card, EmptyState, Field, Input, PageHeader, Select,
  Sparkline, Stack, Table,
} from '@open-family/ui'
import { STRESS_PRESETS } from '../perflab/model'
import { usePerfLab } from '../perflab/PerfLabContext'
import LoadCurveEditor from '../components/LoadCurveEditor'
import NotifyChannels from '../components/NotifyChannels'
import ScenarioTable from '../components/ScenarioTable'
import ProjectWriteBanner from '../components/ProjectWriteBanner'
import { RunStatusBadge } from '../components/RunsTable'
import { tableState } from '../components/tableState'
import { fmtAgo, fmtNum } from '../theme/format'

const FALLBACK_POLICIES = [
  { id: 'smooth', label: 'Smooth' },
  { id: 'sustained', label: 'Sustained' },
  { id: 'stress', label: 'Stress' },
  { id: 'custom', label: 'Custom' },
]

function NotifyState({ runNotify }) {
  if (!runNotify) return null
  const tone = runNotify.configured ? (runNotify.mode === 'log' ? 'warning' : 'good') : 'neutral'
  const label = runNotify.configured
    ? (runNotify.mode === 'log'
      ? 'Notifications log only'
      : `${runNotify.channels_ready || 0} channel${runNotify.channels_ready === 1 ? '' : 's'} sending`)
    : 'No channel configured'
  return (
    <p className="oui-text-sm oui-text-secondary oui-row">
      <Badge tone={tone} dot>{label}</Badge>
      <span>
        {`Terminal-run notifications · ${runNotify.mode || 'deliver'}`}
        {runNotify.statuses ? ` · ${runNotify.statuses}` : ''}
        {' — the channel panel is at the bottom of this page.'}
      </span>
    </p>
  )
}

/** Multi-run history for the selected scenario. */
function ScenarioHistory() {
  const { scenarioTrend, runs, openRun, selectedId } = usePerfLab()
  if (!selectedId) return null

  const oldestFirst = [...scenarioTrend].reverse()

  return (
    <Card
      title="This scenario's recent runs"
      description="The last twenty-five runs of the selected scenario, so a regression is visible before the next one starts."
      flush
    >
      {oldestFirst.length > 1 && (
        <div className="opl-spark-row">
          <div className="opl-spark">
            <span className="oui-text-sm oui-text-muted">p95, oldest to newest</span>
            <Sparkline points={oldestFirst.map((r) => r.p95_ms)} />
          </div>
          <div className="opl-spark">
            <span className="oui-text-sm oui-text-muted">Error rate, oldest to newest</span>
            <Sparkline points={oldestFirst.map((r) => r.error_rate)} />
          </div>
        </div>
      )}
      <Table
        aria-label="Runs of the selected scenario"
        compact
        state={tableState({ loading: runs.loading, error: runs.error, rows: scenarioTrend })}
        columns={[
          { key: 'id', header: 'Run', mono: true, render: (r) => String(r.id).slice(0, 20) },
          { key: 'status', header: 'Status', render: (r) => <RunStatusBadge status={r.status} /> },
          { key: 'vus', header: 'VUs', numeric: true, render: (r) => fmtNum(r.vus) },
          { key: 'p95_ms', header: 'p95', numeric: true, render: (r) => `${fmtNum(r.p95_ms)} ms` },
          { key: 'error_rate', header: 'Errors', numeric: true, render: (r) => fmtNum(r.error_rate) },
          { key: 'samples', header: 'Samples', numeric: true, render: (r) => fmtNum(r.samples) },
          { key: 'started_at', header: 'Started', render: (r) => <span className="oui-text-muted">{fmtAgo(r.started_at)}</span> },
        ]}
        rows={scenarioTrend}
        getRowKey={(r) => r.id}
        onRowClick={(r) => openRun(r.id)}
        emptyState={(
          <EmptyState
            inline
            title="This scenario has not run yet"
            description="Start a run above and it appears here within a couple of seconds."
          />
        )}
        errorState={(
          <EmptyState
            inline
            title="The run history failed to load"
            description={`${runs.error || 'Request failed'} — the run controls above are unaffected.`}
            actions={<Button variant="primary" onClick={() => runs.reload?.()}>Retry</Button>}
          />
        )}
      />
    </Card>
  )
}

/**
 * Execution. This was the `run` tab: presets, engine and policy, the custom load
 * curve, the scheduler, and the notification channels a terminal run reports to.
 */
export default function RunAndScale() {
  const {
    form, setForm, selectedId, busy, scopeLabel, engineLabel, runnerLabel, hasConcreteProject,
    preset, applyPreset, apiPolicies,
    dispatch, setDispatch, engine, setEngine, policy, setPolicy, profile, setProfile,
    workers, setWorkers, fanout, setFanout, hasFederationPeers, peerRows,
    showCurve, setShowCurve, setScheduleField, saveSchedule, saveScenario,
    startRun, validateScenario, duplicateScenario, archiveScenario, runNotify, flash,
  } = usePerfLab()

  const policies = apiPolicies.length ? apiPolicies : FALLBACK_POLICIES

  return (
    <Stack gap="sections">
      <PageHeader
        title="Run and scale"
        description="Dispatch the selected scenario onto ephemeral Docker workers on the compose network. Point the journey at an instrumented service so the run correlates with traces by load_run_id."
        meta={[
          { label: 'Scenario', value: selectedId ? form.name : 'None selected' },
          { label: 'Engine', value: engineLabel },
          { label: 'Runner', value: runnerLabel },
          { label: 'Scope', value: scopeLabel },
        ]}
        actions={(
          <>
            <Button icon={<FiCheck />} disabled={busy || !selectedId || !hasConcreteProject} onClick={validateScenario}>Validate</Button>
            <Button variant="primary" icon={<FiPlay />} disabled={busy || !selectedId || !hasConcreteProject} onClick={() => startRun()}>
              Start run
            </Button>
          </>
        )}
      />

      <ProjectWriteBanner hasConcreteProject={hasConcreteProject} />

      {!selectedId && (
        <Banner tone="accent" title="No scenario selected">
          Pick one from the list at the bottom of this page, or build one on Scenarios. The run
          controls below still edit the draft, but nothing can be dispatched until a scenario is saved.
        </Banner>
      )}

      <Card
        title="Stress presets"
        description="Each preset sets the virtual users, duration, profile and worker count in one move. Everything remains editable afterwards."
      >
        <div className="opl-presets">
          {STRESS_PRESETS.map((p) => (
            <button
              key={p.id || 'custom'}
              type="button"
              className={`opl-preset${preset === p.id ? ' is-active' : ''}`}
              aria-pressed={preset === p.id}
              onClick={() => applyPreset(p.id)}
            >
              <strong>{p.label}</strong>
              <span className="oui-text-sm oui-text-secondary">{p.hint}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Engine and load policy"
        description="How the load is generated and shaped. Load policies map onto local Docker workers only — they are not multi-region injectors."
      >
        <Stack>
          <NotifyState runNotify={runNotify} />
          <div className="opl-field-grid">
            <Field label="Dispatch now">
              <Select
                aria-label="Dispatch now"
                options={[
                  { value: '1', label: 'Yes — spawn the engine' },
                  { value: '0', label: 'No — create a run id only' },
                ]}
                value={dispatch ? '1' : '0'}
                onChange={(e) => setDispatch(e.target.value === '1')}
              />
            </Field>
            <Field label="Engine" hint="The Node fallback needs OPA_PERF_ALLOW_NODE_FALLBACK=1.">
              <Select
                aria-label="Engine"
                options={[
                  { value: 'jmeter', label: 'Docker JMeter' },
                  { value: 'node', label: 'Node fallback (dev only)' },
                ]}
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
              />
            </Field>
            <Field label="Load policy">
              <Select
                aria-label="Load policy"
                options={[
                  { value: '', label: 'default' },
                  ...policies.map((p) => ({ value: p.id, label: p.label || p.id })),
                ]}
                value={policy || profile}
                onChange={(e) => {
                  const v = e.target.value
                  setPolicy(v)
                  if (v === 'smooth') setProfile('ramp')
                  else if (v === 'sustained') setProfile('soak')
                  else if (v === 'stress') setProfile('spike')
                  else setProfile(v === 'custom' ? '' : v)
                  if (v === 'custom') setShowCurve(true)
                }}
              />
            </Field>
            <Field label="Profile">
              <Select
                aria-label="Profile"
                options={[
                  { value: '', label: 'default' },
                  { value: 'soak', label: 'soak' },
                  { value: 'spike', label: 'spike' },
                  { value: 'ramp', label: 'ramp' },
                ]}
                value={profile}
                onChange={(e) => setProfile(e.target.value)}
              />
            </Field>
            {engine === 'jmeter' && (
              <Field label="Container workers" htmlFor="run-workers">
                <Input
                  id="run-workers"
                  type="number"
                  min={1}
                  max={16}
                  value={workers}
                  onChange={(e) => setWorkers(Number(e.target.value) || 1)}
                />
              </Field>
            )}
            <Field label="Virtual users" htmlFor="run-vus">
              <Input
                id="run-vus"
                type="number"
                min={1}
                value={form.vus}
                onChange={(e) => setForm({ ...form, vus: Number(e.target.value) })}
              />
            </Field>
            <Field
              label="Federation fan-out"
              hint={hasFederationPeers
                ? `${peerRows.length} peer${peerRows.length === 1 ? '' : 's'} available.`
                : 'No peers configured, so runs stay local-sample-only.'}
            >
              <Select
                aria-label="Federation fan-out"
                disabled={!hasFederationPeers}
                options={[
                  { value: '0', label: 'Off' },
                  { value: '1', label: 'Dispatch to peers' },
                ]}
                value={fanout && hasFederationPeers ? '1' : '0'}
                onChange={(e) => setFanout(hasFederationPeers && e.target.value === '1')}
              />
            </Field>
            <Field
              label="Burst group size"
              hint="Holds threads at the journey's first request until this many are waiting, then releases them together. 0 disables it."
              htmlFor="run-burst"
            >
              <Input
                id="run-burst"
                type="number"
                min={0}
                value={form.schedule?.rendezvous_group_size ?? 0}
                onChange={(e) => setScheduleField({ rendezvous_group_size: Number(e.target.value) })}
              />
            </Field>
            <Field label="Custom curve">
              <Select
                aria-label="Custom curve"
                options={[
                  { value: '0', label: 'Hidden' },
                  { value: '1', label: 'Edit the point curve' },
                ]}
                value={showCurve ? '1' : '0'}
                onChange={(e) => setShowCurve(e.target.value === '1')}
              />
            </Field>
          </div>

          <p className="oui-text-sm oui-text-muted">
            Dispatch uses ephemeral JMeter containers on the compose network. Point the journey at an
            instrumented service — the default is http://node-app:3000/hello — so trace search finds
            tags.load_run_id; a public example host never yields traces. Federation fan-out dispatches
            to configured peers over remote-load and is not a multi-region cloud injector.
          </p>

          <div className="oui-row">
            <Button variant="primary" icon={<FiPlay />} disabled={busy || !selectedId || !hasConcreteProject} onClick={() => startRun()}>
              Start run
            </Button>
            <Button icon={<FiCopy />} disabled={busy || !selectedId || !hasConcreteProject} onClick={() => duplicateScenario()}>
              Duplicate scenario
            </Button>
            <span className="oui-spacer" />
            <Button variant="danger" icon={<FiTrash2 />} disabled={busy || !selectedId || !hasConcreteProject} onClick={() => archiveScenario()}>
              Archive scenario
            </Button>
          </div>
        </Stack>
      </Card>

      {showCurve && (
        <Card
          title="Custom load curve"
          description="Points in time against concurrent virtual users, or against an arrival rate. Selecting either mode switches the policy to custom."
        >
          <LoadCurveEditor
            curve={form.schedule?.curve}
            curveMode={form.schedule?.curve_mode || 'vus'}
            onModeChange={(curveMode) => {
              setPolicy('custom')
              const nextCurve = curveMode === 'arrivals'
                ? (Array.isArray(form.schedule?.curve) && form.schedule.curve.some((p) => p.rate != null)
                  ? form.schedule.curve
                  : [{ t: 0, rate: 0 }, { t: 30, rate: 2 }, { t: 90, rate: 2 }, { t: 120, rate: 0 }])
                : (Array.isArray(form.schedule?.curve) && form.schedule.curve.some((p) => p.vus != null)
                  ? form.schedule.curve
                  : [{ t: 0, vus: 0 }, { t: 30, vus: 10 }, { t: 90, vus: 10 }, { t: 120, vus: 0 }])
              setScheduleField({ curve_mode: curveMode, curve: nextCurve, policy: 'custom' })
            }}
            onChange={(curve) => {
              setPolicy('custom')
              setScheduleField({
                curve,
                policy: 'custom',
                curve_mode: form.schedule?.curve_mode || 'vus',
              })
            }}
            onApplyPeak={({ mode, peak, duration, ramp, curve, totalArrivals, peakRate }) => {
              setPolicy('custom')
              setForm((f) => ({
                ...f,
                vus: peak || f.vus,
                duration_seconds: duration || f.duration_seconds,
                schedule: {
                  ...f.schedule,
                  curve,
                  policy: 'custom',
                  curve_mode: mode || 'vus',
                  ramp_seconds: mode === 'arrivals' ? 0 : ramp,
                  peak_vus: mode === 'arrivals' ? undefined : peak,
                  total_arrivals: mode === 'arrivals' ? totalArrivals : undefined,
                  peak_rate: mode === 'arrivals' ? peakRate : undefined,
                  duration_seconds: duration,
                },
              }))
            }}
          />
        </Card>
      )}

      <Card
        title="Scheduler"
        description="An in-process tick on the API. Either an interval in minutes or one daily time in UTC — not both."
        footer={(
          <div className="oui-row">
            <Button icon={<FiSave />} disabled={busy || !selectedId} onClick={saveSchedule}>
              Save schedule
            </Button>
            <Button variant="ghost" disabled={busy} onClick={saveScenario}>
              Save the whole scenario
            </Button>
          </div>
        )}
      >
        <div className="opl-field-grid">
          <Field label="Enabled">
            <Select
              aria-label="Scheduler enabled"
              options={[{ value: '0', label: 'Off' }, { value: '1', label: 'On' }]}
              value={form.schedule?.enabled ? '1' : '0'}
              onChange={(e) => setScheduleField({ enabled: e.target.value === '1' })}
            />
          </Field>
          <Field label="Every (minutes)" htmlFor="sched-every">
            <Input
              id="sched-every"
              type="number"
              min={0}
              value={form.schedule?.every_minutes || 0}
              onChange={(e) => setScheduleField({ every_minutes: Number(e.target.value) || 0 })}
              placeholder="60"
            />
          </Field>
          <Field label="Daily at (UTC HH:MM)" htmlFor="sched-daily">
            <Input
              id="sched-daily"
              value={form.schedule?.daily_at || ''}
              onChange={(e) => setScheduleField({ daily_at: e.target.value })}
              placeholder="02:30"
            />
          </Field>
          <Field label="Next fire" hint="Reported by the API on save." htmlFor="sched-next">
            <Input id="sched-next" readOnly value={form.schedule?.next_fire_at || '—'} />
          </Field>
        </div>
      </Card>

      <ScenarioHistory />

      <ScenarioTable title="Scenarios" />

      <NotifyChannels
        runNotify={runNotify}
        onError={(detail) => flash('error', 'Notification test failed', detail)}
      />
    </Stack>
  )
}
