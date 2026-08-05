import React from 'react'
import { FiSave, FiShield } from 'react-icons/fi'
import {
  Badge, Banner, Button, Card, EmptyState, Field, Input, PageHeader, Select, Stack,
} from '@open-family/ui'
import { usePerfLab } from '../perflab/PerfLabContext'
import { gatePassed } from '../utils/entityLinks'
import { fmtNum } from '../theme/format'

/**
 * SLA gates — the objective a run is judged against, and the verdict for one run.
 * This was the `sla` tab.
 */
export default function SlaGates() {
  const {
    form, setForm, runRows, activeRunId, setActiveRunId, gateResult,
    busy, saveScenario, evaluateGate, selectedId, scopeLabel,
  } = usePerfLab()

  const passed = gateResult ? gatePassed(gateResult) : null
  const reasons = gateResult?.reasons?.length ? gateResult.reasons : ['No reasons returned']

  return (
    <Stack gap="sections">
      <PageHeader
        title="SLA gates"
        description="The objective saved with the scenario, and the pass or fail verdict for a chosen run. Evaluation is fail-closed on the API: an empty or in-flight summary fails unless explicitly allowed."
        meta={[
          { label: 'Scenario', value: selectedId ? form.name : 'None selected' },
          { label: 'Run under judgement', value: activeRunId ? String(activeRunId).slice(0, 20) : 'None' },
          { label: 'Scope', value: scopeLabel },
        ]}
        actions={(
          <Button
            variant="primary"
            icon={<FiShield />}
            disabled={busy || !activeRunId}
            onClick={() => evaluateGate()}
          >
            Evaluate gate
          </Button>
        )}
      />

      <Card
        title="Objective"
        description="Saved on the scenario, so every future run of it is judged the same way."
        footer={(
          <Button icon={<FiSave />} disabled={busy} onClick={saveScenario}>
            Save the objective on the scenario
          </Button>
        )}
      >
        <div className="opl-field-grid">
          <Field label="p95 threshold (ms)" htmlFor="sla-p95">
            <Input
              id="sla-p95"
              type="number"
              value={form.sla.p95_ms}
              onChange={(e) => setForm({ ...form, sla: { ...form.sla, p95_ms: Number(e.target.value) } })}
            />
          </Field>
          <Field label="Maximum error rate" hint="A fraction, so 0.05 is five per cent." htmlFor="sla-err">
            <Input
              id="sla-err"
              type="number"
              step="0.01"
              value={form.sla.error_rate_max}
              onChange={(e) => setForm({ ...form, sla: { ...form.sla, error_rate_max: Number(e.target.value) } })}
            />
          </Field>
          <Field label="Run to judge" className="opl-span-2">
            <Select
              aria-label="Run to judge"
              options={[
                { value: '', label: 'Select a run…' },
                ...runRows.map((r) => ({ value: r.id, label: `${String(r.id).slice(0, 24)} · ${r.status}` })),
              ]}
              value={activeRunId}
              onChange={(e) => setActiveRunId(e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card title="Verdict" description="What the gate returned for the selected run.">
        {gateResult ? (
          <Stack>
            <Banner
              tone={passed ? 'good' : 'critical'}
              title={passed ? 'Gate passed' : 'Gate failed'}
            >
              {passed
                ? 'Every condition held for this run.'
                : 'At least one condition did not hold. The reasons below come straight from the API.'}
            </Banner>
            <ul className="opl-gate-reasons">
              {reasons.map((reason, i) => (
                <li key={i}>
                  <Badge tone={passed ? 'good' : 'critical'} dot>{passed ? 'held' : 'failed'}</Badge>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
            {gateResult.summary && (
              <details className="opl-raw">
                <summary>Summary the gate judged</summary>
                <pre className="opl-code-well">{JSON.stringify(gateResult.summary, null, 2)}</pre>
              </details>
            )}
          </Stack>
        ) : (
          <EmptyState
            title="No verdict yet"
            description="Pick a finished run above and evaluate it against the objective. A run that is still in flight fails by design rather than passing on partial data."
            actions={(
              <Button
                variant="primary"
                icon={<FiShield />}
                disabled={busy || !activeRunId}
                onClick={() => evaluateGate()}
              >
                Evaluate gate
              </Button>
            )}
          />
        )}
      </Card>
    </Stack>
  )
}
