import React, { useMemo } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import {
  Button, EmptyState, Field, Input, Select,
} from '@open-family/ui'
import {
  HTTP_METHODS, STEP_TYPES,
  headersToRows, rowsToHeaders, paramsToRows, rowsToParams,
} from '../perflab/model'
import { collectKnownVars } from '../perflab/knownVars'
import { collectFragmentNames } from '../perflab/treeOps'
import { usePerfLab } from '../perflab/PerfLabContext'
import ExprAutocomplete from './ExprAutocomplete'

const asOptions = (values) => values.map((v) => (typeof v === 'string' ? { value: v, label: v } : v))

const YES_NO = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
]

function AdvSection({ title, children, defaultOpen = false }) {
  return (
    <details className="opl-adv" ref={(el) => {
      if (el && defaultOpen && el.dataset.opened !== '1') {
        el.open = true
        el.dataset.opened = '1'
      }
    }}
    >
      <summary>{title}</summary>
      <div className="opl-adv-body">{children}</div>
    </details>
  )
}

function KeyValueRows({
  rows, onChange, namePlaceholder = 'Name', valuePlaceholder = 'Value', addLabel = 'Add row',
  knownVars = [], valueMode = 'expr', nameMode = null,
}) {
  const list = rows.length ? rows : [{ name: '', value: '' }]
  const setRow = (i, patch) => {
    const next = list.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    onChange(next)
  }
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i))
  const add = () => onChange([...list, { name: '', value: '' }])

  return (
    <div className="opl-kv-rows">
      {list.map((row, i) => (
        <div className="opl-kv-row" key={i}>
          {nameMode ? (
            <ExprAutocomplete
              mode={nameMode}
              knownVars={knownVars}
              value={row.name}
              onChange={(e) => setRow(i, { name: e.target.value })}
              placeholder={namePlaceholder}
              aria-label={`${namePlaceholder} ${i + 1}`}
            />
          ) : (
            <Input
              value={row.name}
              onChange={(e) => setRow(i, { name: e.target.value })}
              placeholder={namePlaceholder}
              aria-label={`${namePlaceholder} ${i + 1}`}
            />
          )}
          <ExprAutocomplete
            mode={valueMode}
            knownVars={knownVars}
            className="oui-mono"
            value={row.value}
            onChange={(e) => setRow(i, { value: e.target.value })}
            placeholder={valuePlaceholder}
            aria-label={`${valuePlaceholder} ${i + 1}`}
          />
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Remove row ${i + 1}`}
            icon={<FiTrash2 />}
            onClick={() => remove(i)}
            disabled={list.length <= 1 && !row.name && !row.value}
          />
        </div>
      ))}
      <Button size="sm" icon={<FiPlus />} onClick={add}>{addLabel}</Button>
    </div>
  )
}

/**
 * Properties of the node selected in the virtual-user tree.
 * Basics always visible; Advanced discloses every supported JMeter prop for the type.
 */
export default function StepInspector() {
  const { selectedStep, patchSelectedStep, form } = usePerfLab()

  const fragmentNames = useMemo(
    () => collectFragmentNames(form?.steps || []),
    [form?.steps],
  )
  const knownVars = useMemo(
    () => collectKnownVars(form?.steps || [], form?.datasets?.csv?.variableNames),
    [form?.steps, form?.datasets?.csv?.variableNames],
  )

  if (!selectedStep) {
    return (
      <EmptyState
        inline
        title="Nothing selected"
        description="Pick a node in the virtual-user tree to edit its properties. Drag rows to reorder them, or drop one onto a container to nest it."
      />
    )
  }

  const type = selectedStep.type || 'http'
  const isController = (...names) => names.includes(type)
  const enabled = selectedStep.enabled !== false
  const headerRows = headersToRows(selectedStep.headers)
  const paramRows = paramsToRows(selectedStep.params)

  return (
    <div className="opl-inspector">
      <div className="opl-field-grid">
        <Field label="Type">
          <Select
            aria-label="Step type"
            options={STEP_TYPES}
            value={type}
            onChange={(e) => patchSelectedStep({ type: e.target.value })}
          />
        </Field>
        <Field label="Name" className="opl-span-2">
          <Input
            value={selectedStep.name || ''}
            onChange={(e) => patchSelectedStep({ name: e.target.value })}
            placeholder="Step name"
            aria-label="Step name"
          />
        </Field>
        <Field
          label="Enabled"
          hint="When off, the plan emits enabled=&quot;false&quot; and Validate skips the node."
          className="opl-span-4"
        >
          <Select
            aria-label="Step enabled"
            options={[
              { value: '1', label: 'Yes — emit enabled="true"' },
              { value: '0', label: 'No — emit enabled="false" (skipped in validate)' },
            ]}
            value={enabled ? '1' : '0'}
            onChange={(e) => patchSelectedStep({ enabled: e.target.value === '1' })}
          />
        </Field>
      </div>

      {type === 'http' && (
        <>
          <div className="opl-field-grid">
            <Field label="Method">
              <Select
                aria-label="HTTP method"
                options={asOptions(HTTP_METHODS)}
                value={selectedStep.method || 'GET'}
                onChange={(e) => patchSelectedStep({ method: e.target.value })}
              />
            </Field>
            <Field label="Think time (ms)">
              <Input
                type="number"
                value={selectedStep.think_ms ?? 0}
                onChange={(e) => patchSelectedStep({ think_ms: Number(e.target.value) })}
              />
            </Field>
            <Field
              label="URL"
              className="opl-span-4"
              hint={'Type ${ for variables & expressions'}
            >
              <ExprAutocomplete
                mode="expr"
                knownVars={knownVars}
                value={selectedStep.url || ''}
                onChange={(e) => patchSelectedStep({ url: e.target.value })}
                placeholder={'https://… or ${token}'}
                aria-label="URL"
              />
            </Field>
            <Field
              label="Body"
              className="opl-span-4"
              hint={'Type ${ for variables & expressions'}
            >
              <ExprAutocomplete
                as="textarea"
                mode="expr"
                knownVars={knownVars}
                className="oui-mono"
                rows={3}
                value={selectedStep.body || ''}
                onChange={(e) => patchSelectedStep({ body: e.target.value })}
                placeholder="Optional request body"
                aria-label="Body"
              />
            </Field>
          </div>

          <div>
            <p className="opl-kv-label">
              Headers
              <span className="oui-text-muted"> — emitted as HeaderManager under this sampler</span>
            </p>
            <KeyValueRows
              rows={headerRows}
              knownVars={knownVars}
              valuePlaceholder={'Value or ${var}'}
              onChange={(rows) => patchSelectedStep({ headers: rowsToHeaders(rows) })}
              addLabel="Add header"
            />
            <p className="oui-text-sm oui-text-muted opl-note">
              OPA correlation headers (X-OPA-Load-Run-Id, baggage) are always injected separately.
            </p>
          </div>

          <AdvSection title="Advanced — HTTPSamplerProxy">
            <div className="opl-field-grid">
              <Field label="Follow redirects">
                <Select
                  aria-label="Follow redirects"
                  options={YES_NO}
                  value={selectedStep.follow_redirects !== false ? '1' : '0'}
                  onChange={(e) => patchSelectedStep({ follow_redirects: e.target.value === '1' })}
                />
              </Field>
              <Field label="Always encode body">
                <Select
                  aria-label="Always encode body"
                  options={[
                    { value: '0', label: 'No (raw body)' },
                    { value: '1', label: 'Yes' },
                  ]}
                  value={selectedStep.always_encode ? '1' : '0'}
                  onChange={(e) => patchSelectedStep({ always_encode: e.target.value === '1' })}
                />
              </Field>
              <Field label="Connect timeout (ms)" hint="0 = JMeter default">
                <Input
                  type="number"
                  value={selectedStep.connect_timeout_ms ?? 0}
                  onChange={(e) => patchSelectedStep({ connect_timeout_ms: Number(e.target.value) })}
                />
              </Field>
              <Field label="Response timeout (ms)">
                <Input
                  type="number"
                  value={selectedStep.response_timeout_ms ?? 0}
                  onChange={(e) => patchSelectedStep({ response_timeout_ms: Number(e.target.value) })}
                />
              </Field>
              <Field label="Think random max (ms)" hint="When greater than think time → UniformRandomTimer">
                <Input
                  type="number"
                  value={selectedStep.think_ms_rand ?? 0}
                  onChange={(e) => patchSelectedStep({ think_ms_rand: Number(e.target.value) })}
                />
              </Field>
              <Field label="UI selector type">
                <Select
                  aria-label="UI selector type"
                  options={[{ value: '', label: '—' }, { value: 'css', label: 'CSS' }, { value: 'xpath', label: 'XPath' }]}
                  value={selectedStep.selector_type || ''}
                  onChange={(e) => patchSelectedStep({ selector_type: e.target.value })}
                />
              </Field>
              <Field label="Selector" className="opl-span-2">
                <Input
                  className="oui-mono"
                  value={selectedStep.selector || ''}
                  onChange={(e) => patchSelectedStep({ selector: e.target.value })}
                  placeholder="#login-btn or //button[@id='save']"
                />
              </Field>
              <Field label="UI action">
                <Select
                  aria-label="UI action"
                  options={asOptions([
                    { value: '', label: '—' }, { value: 'click', label: 'click' },
                    { value: 'fill', label: 'fill' }, { value: 'submit', label: 'submit' },
                    { value: 'navigate', label: 'navigate' },
                  ])}
                  value={selectedStep.ui_action || ''}
                  onChange={(e) => patchSelectedStep({ ui_action: e.target.value })}
                />
              </Field>
              <Field label="Page URL" hint="Context for a recorded UI action." className="opl-span-3">
                <Input
                  value={selectedStep.page_url || ''}
                  onChange={(e) => patchSelectedStep({ page_url: e.target.value })}
                  placeholder="https://app.example.com/login"
                />
              </Field>
            </div>
          </AdvSection>
        </>
      )}

      {type === 'extract' && (
        <>
          <div className="opl-field-grid">
            <Field label="Engine">
              <Select
                aria-label="Extractor engine"
                options={[{ value: 'regex', label: 'Regex' }, { value: 'jsonpath', label: 'JSONPath' }]}
                value={selectedStep.engine || 'regex'}
                onChange={(e) => patchSelectedStep({ engine: e.target.value })}
              />
            </Field>
            <Field label="Variable" hint="Suggests existing binder names">
              <ExprAutocomplete
                mode="bind"
                knownVars={knownVars}
                value={selectedStep.var || ''}
                onChange={(e) => patchSelectedStep({ var: e.target.value })}
                aria-label="Extracted variable name"
              />
            </Field>
            <Field label="Expression" className="opl-span-4">
              <Input
                className="oui-mono"
                value={selectedStep.expression || ''}
                onChange={(e) => patchSelectedStep({ expression: e.target.value })}
                aria-label="Extractor expression"
              />
            </Field>
          </div>
          <AdvSection title="Advanced — extractor" defaultOpen>
            <div className="opl-field-grid">
              <Field label="Match number">
                <Input
                  type="number"
                  value={selectedStep.match_number ?? 1}
                  onChange={(e) => patchSelectedStep({ match_number: Number(e.target.value) })}
                />
              </Field>
              <Field label="Template">
                <Input
                  className="oui-mono"
                  value={selectedStep.template ?? '$1$'}
                  onChange={(e) => patchSelectedStep({ template: e.target.value })}
                />
              </Field>
              <Field label="Default value" className="opl-span-4">
                <ExprAutocomplete
                  mode="expr"
                  knownVars={knownVars}
                  value={selectedStep.default_value || ''}
                  onChange={(e) => patchSelectedStep({ default_value: e.target.value })}
                  aria-label="Default value"
                />
              </Field>
            </div>
          </AdvSection>
        </>
      )}

      {type === 'assert' && (
        <>
          <div className="opl-field-grid">
            <Field label="Status code">
              <Input
                type="number"
                value={selectedStep.status || 200}
                onChange={(e) => patchSelectedStep({ status: Number(e.target.value) })}
              />
            </Field>
            <Field label="Body contains" className="opl-span-3" hint={'Type ${ for variables'}>
              <ExprAutocomplete
                mode="expr"
                knownVars={knownVars}
                value={selectedStep.body_contains || ''}
                onChange={(e) => patchSelectedStep({ body_contains: e.target.value })}
                aria-label="Body contains"
              />
            </Field>
          </div>
          <AdvSection title="Advanced — ResponseAssertion">
            <div className="opl-field-grid">
              <Field label="Assert type">
                <Select
                  aria-label="Assert type"
                  options={[
                    { value: 'contains', label: 'Contains' },
                    { value: 'equals', label: 'Equals' },
                    { value: 'regex', label: 'Regex' },
                  ]}
                  value={selectedStep.assert_type || 'contains'}
                  onChange={(e) => patchSelectedStep({ assert_type: e.target.value })}
                />
              </Field>
              <Field label="Field">
                <Select
                  aria-label="Assert field"
                  options={[
                    { value: 'response_code', label: 'Response code' },
                    { value: 'response_data', label: 'Response data' },
                    { value: 'response_headers', label: 'Headers' },
                  ]}
                  value={selectedStep.assert_field || 'response_code'}
                  onChange={(e) => patchSelectedStep({ assert_field: e.target.value })}
                />
              </Field>
              <Field label="Assume success" className="opl-span-2">
                <Select
                  aria-label="Assume success"
                  options={YES_NO}
                  value={selectedStep.assume_success ? '1' : '0'}
                  onChange={(e) => patchSelectedStep({ assume_success: e.target.value === '1' })}
                />
              </Field>
            </div>
          </AdvSection>
        </>
      )}

      {type === 'transaction' && (
        <>
          <p className="oui-text-sm oui-text-secondary">
            A transaction container groups its child HTTP requests in the JMX hashTree, so the
            report reads per journey step rather than per request.
          </p>
          <AdvSection title="Advanced — TransactionController" defaultOpen>
            <div className="opl-field-grid">
              <Field label="Include timers">
                <Select
                  aria-label="Include timers"
                  options={YES_NO}
                  value={selectedStep.include_timers ? '1' : '0'}
                  onChange={(e) => patchSelectedStep({ include_timers: e.target.value === '1' })}
                />
              </Field>
              <Field label="Generate parent sample">
                <Select
                  aria-label="Generate parent sample"
                  options={YES_NO}
                  value={selectedStep.generate_parent_sample ? '1' : '0'}
                  onChange={(e) => patchSelectedStep({ generate_parent_sample: e.target.value === '1' })}
                />
              </Field>
            </div>
          </AdvSection>
        </>
      )}

      {isController('if', 'if_controller', 'while', 'while_controller') && (
        <>
          <div className="opl-field-grid">
            <Field
              label="Condition"
              hint={type.startsWith('while')
                ? 'Emits a WhileController — keep the exit condition tight to avoid a runaway loop.'
                : 'A JMeter expression. Children run when it is true.'}
              className="opl-span-4"
            >
              <ExprAutocomplete
                mode="expr"
                knownVars={knownVars}
                className="oui-mono"
                value={selectedStep.condition || ''}
                onChange={(e) => patchSelectedStep({ condition: e.target.value })}
                placeholder={'${__jexl3("${status}"=="200")}'}
                aria-label="Condition"
              />
            </Field>
          </div>
          <AdvSection title="Advanced — controller">
            <div className="opl-field-grid">
              <Field label="Use expression">
                <Select
                  aria-label="Use expression"
                  options={YES_NO}
                  value={selectedStep.use_expression !== false ? '1' : '0'}
                  onChange={(e) => patchSelectedStep({ use_expression: e.target.value === '1' })}
                />
              </Field>
              {(type === 'if' || type === 'if_controller') && (
                <Field label="Evaluate all">
                  <Select
                    aria-label="Evaluate all"
                    options={YES_NO}
                    value={selectedStep.evaluate_all ? '1' : '0'}
                    onChange={(e) => patchSelectedStep({ evaluate_all: e.target.value === '1' })}
                  />
                </Field>
              )}
            </div>
          </AdvSection>
        </>
      )}

      {isController('loop', 'loop_controller') && (
        <div className="opl-field-grid">
          <Field label="Loops" hint="Emits a LoopController wrapping the child samplers.">
            <Input
              type="number"
              min={1}
              value={selectedStep.loops ?? 1}
              onChange={(e) => patchSelectedStep({ loops: Number(e.target.value) })}
            />
          </Field>
          <Field label="Forever">
            <Select
              aria-label="Loop forever"
              options={YES_NO}
              value={selectedStep.forever ? '1' : '0'}
              onChange={(e) => patchSelectedStep({ forever: e.target.value === '1' })}
            />
          </Field>
        </div>
      )}

      {isController('foreach', 'foreach_controller', 'for_each') && (
        <div className="opl-field-grid">
          <Field label="Input variable" hint="ForEachController iterates input_1…N.">
            <ExprAutocomplete
              mode="bind"
              knownVars={knownVars}
              className="oui-mono"
              value={selectedStep.input_var || ''}
              onChange={(e) => patchSelectedStep({ input_var: e.target.value })}
              placeholder="items"
              aria-label="Input variable"
            />
          </Field>
          <Field label="Return variable" hint="The name each iteration binds.">
            <ExprAutocomplete
              mode="bind"
              knownVars={knownVars}
              className="oui-mono"
              value={selectedStep.return_var || ''}
              onChange={(e) => patchSelectedStep({ return_var: e.target.value })}
              placeholder="item"
              aria-label="Return variable"
            />
          </Field>
          <Field label="Use separator" className="opl-span-2">
            <Select
              aria-label="Use separator"
              options={YES_NO}
              value={selectedStep.use_separator !== false ? '1' : '0'}
              onChange={(e) => patchSelectedStep({ use_separator: e.target.value === '1' })}
            />
          </Field>
        </div>
      )}

      {type === 'fragment' && (
        <p className="oui-text-sm oui-text-secondary">
          A named, reusable journey piece. It is stored once as a disabled test fragment at plan
          level, and every Link that names it points at that one copy — so editing it here changes
          every caller.
        </p>
      )}

      {isController('include', 'link') && (
        <div className="opl-field-grid">
          <Field label="Fragment reference" hint="The name of a fragment already in this tree.">
            <Select
              aria-label="Fragment reference"
              options={[
                { value: '', label: fragmentNames.length ? 'Select a fragment…' : '(no fragments in tree)' },
                ...fragmentNames.map((n) => ({ value: n, label: n })),
                ...(selectedStep.ref && !fragmentNames.includes(selectedStep.ref)
                  ? [{ value: selectedStep.ref, label: `${selectedStep.ref} (missing)` }]
                  : []),
              ]}
              value={selectedStep.ref || selectedStep.fragment || ''}
              onChange={(e) => patchSelectedStep({ ref: e.target.value })}
            />
          </Field>
          <Field
            label="Inputs"
            hint="Name / value rows. They let one fragment run with different values per reference."
            className="opl-span-4"
          >
            <KeyValueRows
              rows={paramRows}
              knownVars={knownVars}
              nameMode="bind"
              valueMode="expr"
              onChange={(rows) => patchSelectedStep({ params: rowsToParams(rows) })}
              addLabel="Add input"
            />
          </Field>
          <p className="oui-text-sm oui-text-secondary opl-span-4">
            Validate reports, per reference, whether the plan emitted a module reference or fell
            back to an inline copy.
          </p>
        </div>
      )}

      {type === 'rendezvous' && (
        <div className="opl-field-grid">
          <Field label="Group size" hint="0 means every thread in the group.">
            <Input
              type="number"
              min={0}
              value={selectedStep.group_size ?? 0}
              onChange={(e) => patchSelectedStep({ group_size: Number(e.target.value) })}
            />
          </Field>
          <Field label="Timeout (ms)" hint="0 waits forever.">
            <Input
              type="number"
              min={0}
              value={selectedStep.timeout_ms ?? 0}
              onChange={(e) => patchSelectedStep({ timeout_ms: Number(e.target.value) })}
            />
          </Field>
          <p className="oui-text-sm oui-text-secondary opl-span-4">
            A synchronising timer: threads wait here until the group fills, then fire together. A
            group larger than the virtual-user count never fills — with no timeout those threads
            wait out the whole run, so validation fails instead.
          </p>
        </div>
      )}
    </div>
  )
}
