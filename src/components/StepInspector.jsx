import React from 'react'
import { EmptyState, Field, Input, Select, Textarea } from '@open-family/ui'
import {
  headersToText, HTTP_METHODS, paramsToText, STEP_TYPES, textToHeaders, textToParams,
} from '../perflab/model'
import { usePerfLab } from '../perflab/PerfLabContext'

const asOptions = (values) => values.map((v) => (typeof v === 'string' ? { value: v, label: v } : v))

/**
 * Properties of the node selected in the virtual-user tree. Every field is the
 * field the tabbed designer had; the difference is that the labels now come from
 * `Field`, so the label, the control and its hint share one rhythm.
 */
export default function StepInspector() {
  const { selectedStep, patchSelectedStep } = usePerfLab()

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
  const isHttp = type === 'http'
  const isController = (...names) => names.includes(type)

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
      </div>

      {isHttp && (
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
            <Field label="URL" className="opl-span-3">
              <Input
                value={selectedStep.url || ''}
                onChange={(e) => patchSelectedStep({ url: e.target.value })}
                placeholder={'https://… or ${token}'}
              />
            </Field>
            <Field label="Think time (ms)">
              <Input
                type="number"
                value={selectedStep.think_ms || 0}
                onChange={(e) => patchSelectedStep({ think_ms: Number(e.target.value) })}
              />
            </Field>
            <Field label="Body" className="opl-span-3">
              <Input
                value={selectedStep.body || ''}
                onChange={(e) => patchSelectedStep({ body: e.target.value })}
                placeholder="Optional request body"
              />
            </Field>
            <Field label="Headers" hint="One per line, as Name: value." className="opl-span-4">
              <Textarea
                className="oui-mono"
                rows={3}
                value={headersToText(selectedStep.headers)}
                onChange={(e) => patchSelectedStep({ headers: textToHeaders(e.target.value) })}
                placeholder={'Authorization: Bearer ${token}\nContent-Type: application/json'}
                aria-label="Headers"
              />
            </Field>
          </div>

          <div className="opl-field-grid">
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
        </>
      )}

      {type === 'extract' && (
        <div className="opl-field-grid">
          <Field label="Engine">
            <Select
              aria-label="Extractor engine"
              options={[{ value: 'regex', label: 'Regex' }, { value: 'jsonpath', label: 'JSONPath' }]}
              value={selectedStep.engine || 'regex'}
              onChange={(e) => patchSelectedStep({ engine: e.target.value })}
            />
          </Field>
          <Field label="Expression" className="opl-span-2">
            <Input
              className="oui-mono"
              value={selectedStep.expression || ''}
              onChange={(e) => patchSelectedStep({ expression: e.target.value })}
              aria-label="Extractor expression"
            />
          </Field>
          <Field label="Variable">
            <Input
              value={selectedStep.var || ''}
              onChange={(e) => patchSelectedStep({ var: e.target.value })}
              aria-label="Extracted variable name"
            />
          </Field>
        </div>
      )}

      {type === 'assert' && (
        <div className="opl-field-grid">
          <Field label="Status code">
            <Input
              type="number"
              value={selectedStep.status || 200}
              onChange={(e) => patchSelectedStep({ status: Number(e.target.value) })}
            />
          </Field>
          <Field label="Body contains" className="opl-span-3">
            <Input
              value={selectedStep.body_contains || ''}
              onChange={(e) => patchSelectedStep({ body_contains: e.target.value })}
            />
          </Field>
        </div>
      )}

      {type === 'transaction' && (
        <p className="oui-text-sm oui-text-secondary">
          A transaction container groups its child HTTP requests in the JMX hashTree, so the
          report reads per journey step rather than per request.
        </p>
      )}

      {isController('if', 'if_controller') && (
        <div className="opl-field-grid">
          <Field
            label="Condition"
            hint="A JMeter expression. Children run when it is true."
            className="opl-span-4"
          >
            <Input
              className="oui-mono"
              value={selectedStep.condition || ''}
              onChange={(e) => patchSelectedStep({ condition: e.target.value })}
              placeholder={'${__jexl3("${status}"=="200")}'}
            />
          </Field>
        </div>
      )}

      {isController('while', 'while_controller') && (
        <div className="opl-field-grid">
          <Field
            label="Condition"
            hint="Emits a WhileController — keep the exit condition tight to avoid a runaway loop."
            className="opl-span-4"
          >
            <Input
              className="oui-mono"
              value={selectedStep.condition || ''}
              onChange={(e) => patchSelectedStep({ condition: e.target.value })}
              placeholder={'${__jexl3("${more}"=="true")}'}
            />
          </Field>
        </div>
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
              options={[{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }]}
              value={selectedStep.forever ? '1' : '0'}
              onChange={(e) => patchSelectedStep({ forever: e.target.value === '1' })}
            />
          </Field>
        </div>
      )}

      {isController('foreach', 'foreach_controller', 'for_each') && (
        <div className="opl-field-grid">
          <Field label="Input variable" hint="ForEachController iterates input_1…N.">
            <Input
              className="oui-mono"
              value={selectedStep.input_var || ''}
              onChange={(e) => patchSelectedStep({ input_var: e.target.value })}
              placeholder="items"
            />
          </Field>
          <Field label="Return variable" hint="The name each iteration binds.">
            <Input
              className="oui-mono"
              value={selectedStep.return_var || ''}
              onChange={(e) => patchSelectedStep({ return_var: e.target.value })}
              placeholder="item"
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
          <Field label="Fragment reference" hint="The name of the fragment to expand here.">
            <Input
              value={selectedStep.ref || selectedStep.fragment || ''}
              onChange={(e) => patchSelectedStep({ ref: e.target.value })}
              placeholder="SharedFragment"
            />
          </Field>
          <Field
            label="Inputs"
            hint="One name=value per line. They let one fragment run with different values per reference."
            className="opl-span-2"
          >
            <Textarea
              className="oui-mono"
              rows={3}
              value={paramsToText(selectedStep.params)}
              onChange={(e) => patchSelectedStep({ params: textToParams(e.target.value) })}
              placeholder={'user=alice\ntier=gold'}
              aria-label="Fragment inputs"
            />
          </Field>
          <p className="oui-text-sm oui-text-secondary opl-span-4">
            Validate reports, per reference, whether the plan emitted a reference to the shared
            fragment or fell back to an inline copy of it.
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
