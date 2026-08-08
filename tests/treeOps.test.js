import { describe, expect, it } from 'vitest'
import {
  headersToRows, rowsToHeaders, headersToText, textToHeaders,
  paramsToRows, rowsToParams, makeNode,
} from '../src/perflab/model.js'
import {
  getAtPath,
  patchStepAt,
  replaceInTree,
  setEnabledAt,
  resolveTriagePath,
  matchesFilter,
  nodeMatchesFilter,
} from '../src/perflab/treeOps.js'
import { mentionsPrivateHosts } from '../src/perflab/captureHints.js'

describe('header rows ↔ object', () => {
  it('round-trips object headers through editable rows', () => {
    const headers = { Authorization: 'Bearer ${token}', Accept: 'application/json' }
    const rows = headersToRows(headers)
    expect(rows).toEqual([
      { name: 'Authorization', value: 'Bearer ${token}' },
      { name: 'Accept', value: 'application/json' },
    ])
    expect(rowsToHeaders(rows)).toEqual(headers)
  })

  it('drops blank names when converting rows to an object', () => {
    expect(rowsToHeaders([
      { name: 'X-A', value: '1' },
      { name: '  ', value: 'ignore' },
      { name: 'X-B', value: '2' },
    ])).toEqual({ 'X-A': '1', 'X-B': '2' })
  })

  it('still supports Name: value text helpers', () => {
    const text = 'A: 1\nB: two'
    expect(headersToText(textToHeaders(text))).toBe('A: 1\nB: two')
  })

  it('accepts array-shaped headers from prototypes', () => {
    expect(headersToRows([{ name: 'H', value: 'v' }])).toEqual([{ name: 'H', value: 'v' }])
    expect(rowsToHeaders([{ name: 'H', value: 'v' }])).toEqual({ H: 'v' })
  })
})

describe('params rows ↔ object', () => {
  it('round-trips fragment inputs', () => {
    const params = { user: 'alice', tier: 'gold' }
    expect(rowsToParams(paramsToRows(params))).toEqual(params)
  })
})

describe('makeNode defaults', () => {
  it('sets enabled and HTTP advanced defaults', () => {
    const http = makeNode('http')
    expect(http.enabled).toBe(true)
    expect(http.follow_redirects).toBe(true)
    expect(http.think_ms_rand).toBe(0)
    expect(http.headers).toEqual({})
  })

  it('sets extract and assert advanced defaults', () => {
    expect(makeNode('extract')).toMatchObject({
      match_number: 1, template: '$1$', default_value: '', enabled: true,
    })
    expect(makeNode('assert')).toMatchObject({
      assert_type: 'contains', assert_field: 'response_code', assume_success: false,
    })
  })
})

describe('treeOps enable / replace / triage', () => {
  const tree = [
    {
      type: 'transaction',
      name: 'Login',
      enabled: true,
      children: [
        {
          type: 'http',
          name: 'POST /login',
          url: 'https://api.example.com/login',
          body: '{"user":"${user}"}',
          headers: { 'Content-Type': 'application/json', Host: 'api.example.com' },
          enabled: true,
          children: [],
        },
      ],
    },
    {
      type: 'http',
      name: 'GET /me',
      url: 'https://api.example.com/me',
      headers: { Authorization: 'Bearer x' },
      enabled: true,
    },
  ]

  it('setEnabledAt patches the selected path', () => {
    const next = setEnabledAt(tree, [0, 'children', 0], false)
    expect(getAtPath(next, [0, 'children', 0]).enabled).toBe(false)
    expect(getAtPath(tree, [0, 'children', 0]).enabled).toBe(true)
  })

  it('replaceInTree rewrites url, body, name, and header values', () => {
    const { steps, count } = replaceInTree(tree, 'api.example.com', 'lab.local')
    expect(count).toBeGreaterThan(0)
    expect(getAtPath(steps, [0, 'children', 0]).url).toBe('https://lab.local/login')
    expect(getAtPath(steps, [0, 'children', 0]).headers.Host).toBe('lab.local')
    expect(getAtPath(steps, [1]).url).toBe('https://lab.local/me')
  })

  it('patchStepAt merges fields immutably', () => {
    const next = patchStepAt(tree, [1], { think_ms: 100 })
    expect(getAtPath(next, [1]).think_ms).toBe(100)
    expect(getAtPath(tree, [1]).think_ms).toBeUndefined()
  })

  it('resolveTriagePath prefers triage.path then falls back to index', () => {
    expect(resolveTriagePath(tree, { path: [0, 'children', 0] })).toEqual([0, 'children', 0])
    expect(resolveTriagePath(tree, { index: 1 })).toEqual([1])
    expect(resolveTriagePath(tree, {})).toBeNull()
  })

  it('filter helpers match name/url/headers', () => {
    const http = getAtPath(tree, [0, 'children', 0])
    expect(nodeMatchesFilter(http, 'login')).toBe(true)
    expect(nodeMatchesFilter(http, 'Authorization')).toBe(false)
    expect(matchesFilter(tree[0], 'login')).toBe(true)
    expect(matchesFilter(tree[0], 'nope')).toBe(false)
  })
})

describe('capture private-host hint', () => {
  it('detects private / NAS host language in import feedback', () => {
    expect(mentionsPrivateHosts('skipped blocked URL http://192.168.100.101/ (private/link-local address not allowed)')).toBe(true)
    expect(mentionsPrivateHosts('no HTTP requests found')).toBe(false)
    expect(mentionsPrivateHosts('set OPA_PERF_INTERNAL_HOSTS')).toBe(true)
  })
})
