/**
 * A failed request must never render as an empty result set. This repository had
 * no error path at all — `Panel`'s `error` prop was never passed anywhere — so a
 * failed fetch showed "Start a run from Run & scale", which is a wrong answer
 * rather than a missing one.
 */
import { describe, expect, it } from 'vitest'
import { tableState } from '../src/components/tableState.js'
import { liveKpisFor, parseJSONField, parseSummary, percentile, sampleFailed } from '../src/perflab/model.js'

describe('tableState', () => {
  it('reports loading while a request is in flight, even with stale rows', () => {
    expect(tableState({ loading: true, error: null, rows: [] })).toBe('loading')
    expect(tableState({ loading: true, error: null, rows: [{ id: 1 }] })).toBe('loading')
  })

  it('reports error rather than empty when a request failed', () => {
    expect(tableState({ loading: false, error: 'boom', rows: [] })).toBe('error')
    // The regression this whole helper exists to stop.
    expect(tableState({ loading: false, error: 'boom', rows: [] })).not.toBe('empty')
  })

  it('prefers error over stale rows, so a failure is never dressed as data', () => {
    expect(tableState({ loading: false, error: 'boom', rows: [{ id: 1 }] })).toBe('error')
  })

  it('distinguishes a genuinely empty result from a failure', () => {
    expect(tableState({ loading: false, error: null, rows: [] })).toBe('empty')
    expect(tableState({ loading: false, error: null, rows: [{ id: 1 }] })).toBe('ready')
  })

  it('treats a missing rows array as empty rather than throwing', () => {
    expect(tableState({ loading: false, error: null })).toBe('empty')
  })
})

describe('run model', () => {
  it('parses a summary held as a JSON string, and survives a broken one', () => {
    expect(parseSummary({ summary_json: '{"p95_ms":214}' })).toEqual({ p95_ms: 214 })
    expect(parseSummary({ summary_json: 'not json' })).toEqual({})
    expect(parseSummary(null)).toEqual({})
    expect(parseJSONField('', 'fallback')).toBe('fallback')
    expect(parseJSONField(null, 7)).toBe(7)
  })

  it('counts a sample as failed unless it says otherwise', () => {
    expect(sampleFailed({ ok: true })).toBe(false)
    expect(sampleFailed({ ok: 1 })).toBe(false)
    expect(sampleFailed({ ok: false })).toBe(true)
    expect(sampleFailed({ ok: 0 })).toBe(true)
    expect(sampleFailed({})).toBe(true)
  })

  it('computes percentiles the way the tabbed page did', () => {
    const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    expect(percentile(sorted, 0.5)).toBe(50)
    expect(percentile(sorted, 0.95)).toBe(100)
    expect(percentile([], 0.95)).toBe(0)
  })

  it('prefers the engine summary, and says which source it used', () => {
    const fromSummary = liveKpisFor({ summary_json: '{"requests":1200,"p95_ms":214,"error_rate":0.01}' }, [])
    expect(fromSummary.source).toBe('summary')
    expect(fromSummary.n).toBe(1200)
    expect(fromSummary.p95).toBe(214)

    const fromSamples = liveKpisFor(null, [
      { latency_ms: 10, ok: true },
      { latency_ms: 20, ok: true },
      { latency_ms: 30, ok: false },
      { latency_ms: 40, ok: true },
    ])
    expect(fromSamples.source).toBe('samples')
    expect(fromSamples.n).toBe(4)
    expect(fromSamples.err).toBeCloseTo(0.25)

    // No summary and no samples is a third, distinct state — not zero data
    // dressed as a measurement of zero.
    expect(liveKpisFor(null, []).source).toBe('none')
  })
})
