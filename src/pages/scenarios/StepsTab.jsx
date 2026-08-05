import React from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCheck, FiSave, FiUpload, FiX } from 'react-icons/fi'
import {
  Badge, Banner, Button, Card, Code, Field, Input, Stack,
} from '@open-family/ui'
import VuTree from '../../components/VuTree'
import StepInspector from '../../components/StepInspector'
import ScenarioTable from '../../components/ScenarioTable'
import { usePerfLab } from '../../perflab/PerfLabContext'

const SEVERITY_TONE = { error: 'critical', warn: 'warning', warning: 'warning', info: 'accent' }

/* A fragment emitted as a reference is the intended outcome; an inline copy works
   but drifts from the shared definition, and "not emitted" is a failure. */
const REFERENCE_TONE = { module_reference: 'good', inline_expansion: 'warning' }
const REFERENCE_LABEL = { module_reference: 'module reference', inline_expansion: 'inlined copy' }

/** The validation result: triage items and auto-correlation suggestions. */
function ValidationReport() {
  const { validateResult, setValidateResult, applyCorrelationSuggestion } = usePerfLab()
  if (!validateResult) return null

  const passed = validateResult.pass !== false && validateResult.ok !== false
  const triage = Array.isArray(validateResult.triage) ? validateResult.triage : []
  const suggestions = Array.isArray(validateResult.correlation_suggestions)
    ? validateResult.correlation_suggestions
    : []
  const references = Array.isArray(validateResult.fragment_references)
    ? validateResult.fragment_references
    : []

  return (
    <Card
      title={passed ? 'Validation passed' : 'Validation triage'}
      description={validateResult.honesty || (passed
        ? 'One virtual user completed the journey.'
        : 'One virtual user could not complete the journey. Each item below is a step that failed and why.')}
      actions={(
        <Button
          variant="ghost"
          size="sm"
          aria-label="Dismiss the validation report"
          icon={<FiX />}
          onClick={() => setValidateResult(null)}
        />
      )}
    >
      <Stack>
        <Banner tone={passed ? 'good' : 'critical'} title={passed ? 'Journey replayed' : `${triage.length} step${triage.length === 1 ? '' : 's'} need attention`}>
          {passed
            ? 'The generated plan ran end to end with a single virtual user, so the journey is safe to scale.'
            : 'Fix these before scaling — under load a broken step multiplies rather than fails once.'}
        </Banner>

        {triage.map((t, i) => (
          <div className="opl-triage" key={i} data-severity={t.severity || 'error'}>
            <div className="oui-row">
              <Badge tone={SEVERITY_TONE[String(t.severity || '').toLowerCase()] || 'critical'} dot>
                {t.severity || 'error'}
              </Badge>
              <strong>{`#${t.index} ${t.type || 'step'}`}</strong>
              {t.name ? <span className="oui-text-secondary">{t.name}</span> : null}
            </div>
            <p className="oui-text-sm oui-text-secondary">{t.hint || t.error}</p>
            {t.body_preview && (
              <pre className="opl-code-well">{String(t.body_preview).slice(0, 400)}</pre>
            )}
          </div>
        ))}

        {references.length > 0 && (
          <Card
            quiet
            title="Fragment references"
            description="A module reference keeps one shared definition; an inline copy drifts from it. The two behave differently under load, so anything not emitted as a reference is listed with the reason."
          >
            <Stack>
              {references.map((r, i) => (
                <div className="oui-row" key={i}>
                  <Code>{r.step}</Code>
                  <span className="oui-text-muted" aria-hidden="true">→</span>
                  <Code>{r.ref || '(unset)'}</Code>
                  <Badge tone={REFERENCE_TONE[r.mode] || 'warning'} dot>
                    {REFERENCE_LABEL[r.mode] || 'not emitted'}
                  </Badge>
                  {r.reason && <span className="oui-text-sm oui-text-muted">{r.reason}</span>}
                  {Array.isArray(r.params) && r.params.length > 0 && (
                    <span className="oui-text-sm oui-text-muted">{`inputs: ${r.params.join(', ')}`}</span>
                  )}
                </div>
              ))}
            </Stack>
          </Card>
        )}

        {suggestions.length > 0 && (
          <Card
            quiet
            title="Auto-correlation suggestions"
            description="Dynamic tokens were detected in the responses. Add an extractor for each before scaling, or every virtual user replays a stale value."
          >
            <Stack>
              {suggestions.map((s, i) => (
                <div className="oui-row" key={i}>
                  <Code>{s.var}</Code>
                  <span className="oui-text-sm oui-text-secondary">{`${s.engine}: ${s.expression}`}</span>
                  <span className="oui-text-sm oui-text-muted">{`(${s.reason})`}</span>
                  <span className="oui-spacer" />
                  <Button size="sm" onClick={() => applyCorrelationSuggestion(s)}>Add extractor</Button>
                </div>
              ))}
            </Stack>
          </Card>
        )}
      </Stack>
    </Card>
  )
}

/**
 * Steps — the virtual-user tree, its inspector, and the load shape the scenario
 * saves with. This was the `design` tab.
 */
export default function StepsTab() {
  const navigate = useNavigate()
  const {
    form, setForm, selectedId, busy, saveScenario, validateScenario,
    selectedStepPath, setSelectedStepPath, treeExpanded, setTreeExpanded,
  } = usePerfLab()

  const setField = (patch) => setForm({ ...form, ...patch })

  return (
    <Stack gap="sections">
      <Card
        title="Scenario"
        description="The shape of the load, and the objective the run is judged against."
      >
        <div className="opl-field-grid">
          <Field label="Scenario name" className="opl-span-2" htmlFor="scenario-name">
            <Input
              id="scenario-name"
              value={form.name}
              onChange={(e) => setField({ name: e.target.value })}
            />
          </Field>
          <Field label="Virtual users" htmlFor="scenario-vus">
            <Input
              id="scenario-vus"
              type="number"
              min={1}
              value={form.vus}
              onChange={(e) => setField({ vus: Number(e.target.value) })}
            />
          </Field>
          <Field label="Duration (s)" htmlFor="scenario-duration">
            <Input
              id="scenario-duration"
              type="number"
              min={1}
              value={form.duration_seconds}
              onChange={(e) => setField({ duration_seconds: Number(e.target.value) })}
            />
          </Field>
          <Field label="Ramp-up (s)" htmlFor="scenario-ramp">
            <Input
              id="scenario-ramp"
              type="number"
              min={0}
              value={form.schedule?.ramp_seconds ?? 10}
              onChange={(e) => setForm({
                ...form,
                schedule: { ...form.schedule, ramp_seconds: Number(e.target.value) },
              })}
            />
          </Field>
          <Field label="SLA p95 (ms)" htmlFor="scenario-p95">
            <Input
              id="scenario-p95"
              type="number"
              value={form.sla.p95_ms}
              onChange={(e) => setForm({ ...form, sla: { ...form.sla, p95_ms: Number(e.target.value) } })}
            />
          </Field>
          <Field label="Max error rate" hint="A fraction, so 0.05 is five per cent." htmlFor="scenario-err">
            <Input
              id="scenario-err"
              type="number"
              step="0.01"
              value={form.sla.error_rate_max}
              onChange={(e) => setForm({ ...form, sla: { ...form.sla, error_rate_max: Number(e.target.value) } })}
            />
          </Field>
        </div>
      </Card>

      <ValidationReport />

      <Card
        title="Virtual user"
        description="A nested journey tree — HTTP requests, transactions, If / While / Loop / ForEach controllers, extractors and asserts. Optional CSS or XPath selectors correlate a recorded UI action with the request it made."
        footer={(
          <div className="oui-row">
            <Button variant="primary" icon={<FiSave />} disabled={busy} onClick={saveScenario}>
              Save — generates the JMX
            </Button>
            <Button icon={<FiCheck />} disabled={busy || !selectedId} onClick={validateScenario}>
              Validate 1 VU
            </Button>
            <span className="oui-spacer" />
            <Button variant="ghost" icon={<FiUpload />} onClick={() => navigate('/scenarios/capture')}>
              Import from a capture
            </Button>
          </div>
        )}
      >
        <div className="opl-designer">
          <div className="opl-designer-tree">
            <VuTree
              steps={form.steps}
              selectedPath={selectedStepPath}
              onSelect={setSelectedStepPath}
              onChange={(steps) => setForm({ ...form, steps })}
              expanded={treeExpanded}
              setExpanded={setTreeExpanded}
            />
          </div>
          <div className="opl-designer-inspector">
            <h3 className="opl-subhead">Inspector</h3>
            <StepInspector />
          </div>
        </div>
      </Card>

      <ScenarioTable />
    </Stack>
  )
}
