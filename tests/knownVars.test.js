import { describe, expect, it } from 'vitest'
import {
  BUILTIN_VARS,
  EXPRESSION_SNIPPETS,
  collectKnownVars,
  buildAutocompleteCatalog,
  autocompleteQuery,
  applyAutocompleteInsert,
} from '../src/perflab/knownVars.js'

describe('collectKnownVars', () => {
  it('includes builtin, CSV columns, extractors, ForEach, and link params', () => {
    const steps = [
      {
        type: 'http',
        children: [
          { type: 'extract', var: 'session' },
          { type: 'foreach', input_var: 'items', return_var: 'item' },
        ],
      },
      { type: 'include', params: { user: 'alice', tier: 'gold' } },
    ]
    expect(collectKnownVars(steps, 'user,password')).toEqual([
      'LOAD_RUN_ID', 'item', 'items', 'password', 'session', 'tier', 'user',
    ].sort((a, b) => a.localeCompare(b)))
  })

  it('always includes LOAD_RUN_ID even with empty tree', () => {
    expect(collectKnownVars([], '')).toEqual([...BUILTIN_VARS])
  })
})

describe('buildAutocompleteCatalog', () => {
  it('expr mode wraps vars and includes curated snippets only', () => {
    const items = buildAutocompleteCatalog('expr', ['session', 'LOAD_RUN_ID'], '')
    expect(items.some((i) => i.insert === '${session}')).toBe(true)
    expect(items.some((i) => i.insert === '${LOAD_RUN_ID}')).toBe(true)
    for (const snip of EXPRESSION_SNIPPETS) {
      expect(items.some((i) => i.insert === snip.insert)).toBe(true)
    }
    expect(items.some((i) => /__Random|__time/.test(i.insert))).toBe(false)
  })

  it('bind mode inserts bare names without snippets', () => {
    const items = buildAutocompleteCatalog('bind', ['session'], 'ses')
    expect(items).toEqual([
      expect.objectContaining({ insert: 'session', group: 'Variables' }),
    ])
  })
})

describe('autocompleteQuery / applyAutocompleteInsert', () => {
  it('detects incomplete ${ token', () => {
    expect(autocompleteQuery('https://x/${sess', 16, 'expr')).toBe('sess')
    expect(autocompleteQuery('https://x/', 10, 'expr')).toBe(null)
  })

  it('replaces incomplete ${…} with chosen insert', () => {
    const next = applyAutocompleteInsert('Bearer ${tok', 12, 'expr', '${token}')
    expect(next.value).toBe('Bearer ${token}')
  })

  it('replaces bind partial with bare name', () => {
    const next = applyAutocompleteInsert('ses', 3, 'bind', 'session')
    expect(next.value).toBe('session')
  })
})
