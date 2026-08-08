/**
 * Source contracts for the config-complete scenario editor (D2–D8, D11–D12).
 * Pins UI ↔ field presence without mounting React.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_FORM, ESSENTIAL_STEP_TYPES, LOGIC_STEP_TYPES } from '../src/perflab/model.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => readFileSync(join(root, rel), 'utf8')

describe('scenario editor contracts', () => {
  it('D2 StepInspector exposes Basics header table and Advanced sections', () => {
    const src = read('src/components/StepInspector.jsx')
    expect(src).toContain('KeyValueRows')
    expect(src).toContain('Add header')
    expect(src).toContain('Advanced — HTTPSamplerProxy')
    expect(src).toContain('Advanced — extractor')
    expect(src).toContain('Advanced — ResponseAssertion')
    expect(src).toContain('Advanced — TransactionController')
    expect(src).toMatch(/Advanced — .+controller/i)
  })

  it('D3 UsersTab Advanced CSV binds share_mode/quoted/ignore_first_line/encoding', () => {
    const src = read('src/pages/scenarios/UsersTab.jsx')
    for (const key of ['share_mode', 'quoted', 'ignore_first_line', 'encoding', 'stop_thread']) {
      expect(src).toContain(key)
    }
  })

  it('D4 DEFAULT_FORM and SLA UI carry rps_min', () => {
    expect(DEFAULT_FORM().sla.rps_min).toBe(0)
    expect(read('src/pages/scenarios/StepsTab.jsx')).toContain('form.sla.rps_min')
    expect(read('src/pages/SlaGates.jsx')).toContain('form.sla.rps_min')
  })

  it('D5 guided empty offers Blank, Capture, and JMX paths', () => {
    const src = read('src/components/VuTree.jsx')
    expect(src).toContain('Blank HTTP journey')
    expect(src).toContain('Import capture (HAR / Postman)')
    // JMX upload lives on Capture / import surfaces; empty state deep-links capture.
    expect(src).toContain('/scenarios/capture')
  })

  it('D6 palette separates Essentials from Logic', () => {
    expect(ESSENTIAL_STEP_TYPES).toEqual(['http', 'transaction', 'extract', 'assert'])
    expect(LOGIC_STEP_TYPES).toEqual(
      expect.arrayContaining(['if', 'while', 'loop', 'foreach', 'fragment', 'include', 'rendezvous']),
    )
    const src = read('src/components/VuTree.jsx')
    expect(src).toContain('Logic & reuse')
    expect(src).toContain('showLogic && LOGIC_STEP_TYPES')
  })

  it('D7 ValidationReport Open in tree uses resolveTriagePath', () => {
    const src = read('src/pages/scenarios/StepsTab.jsx')
    expect(src).toContain('resolveTriagePath')
    expect(src).toContain('Open in tree')
  })

  it('D8 ValidationReport surfaces unbound_variables', () => {
    const src = read('src/pages/scenarios/StepsTab.jsx')
    expect(src).toContain('unbound_variables')
    expect(src).toContain('Open Users & data')
  })

  it('D11 write actions require hasConcreteProject', () => {
    const src = read('src/pages/Scenarios.jsx')
    expect(src).toContain('!hasConcreteProject')
    expect(src).toContain('ProjectWriteBanner')
    expect(src).toContain('Save scenario')
  })

  it('D12 no connector/repo scope picker in scenario editor', () => {
    const files = [
      'src/components/VuTree.jsx',
      'src/components/StepInspector.jsx',
      'src/components/ProjectWriteBanner.jsx',
      'src/pages/Scenarios.jsx',
      'src/pages/scenarios/StepsTab.jsx',
      'src/pages/scenarios/UsersTab.jsx',
    ]
    for (const f of files) {
      const src = read(f)
      expect(src).not.toMatch(/connector_id|connectorId|ConnectorPicker|repo picker/i)
    }
  })
})
