/**
 * Scenario binders + curated JMeter snippets for inspector autocomplete.
 * Mirrors OPL-API perfScenarioKnownVars / perfBuiltinVars — only document what
 * validate can bind or what the engine/docs already emit.
 */

export const BUILTIN_VARS = ['LOAD_RUN_ID']

/** Insert-as-is expressions (no undocumented __Random / __time marketplace). */
export const EXPRESSION_SNIPPETS = [
  { insert: '${__jexl3(true)}', label: 'Always true', group: 'Expressions' },
  { insert: '${__jexl3(false)}', label: 'Always false', group: 'Expressions' },
  { insert: '${__jexl3("${status}"=="200")}', label: 'Compare status var', group: 'Expressions' },
  { insert: '${__P(LOAD_RUN_ID,)}', label: 'Property: run id', group: 'Expressions' },
  { insert: '${__P(OPA_THREADS,1)}', label: 'Property: thread count', group: 'Expressions' },
]

/**
 * @param {unknown[]} steps
 * @param {string} [csvVariableNames]
 * @returns {string[]}
 */
export function collectKnownVars(steps, csvVariableNames) {
  const out = new Set(BUILTIN_VARS)
  String(csvVariableNames || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((c) => out.add(c))

  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (!n || typeof n !== 'object') continue
      for (const k of ['var', 'input_var', 'return_var']) {
        const v = String(n[k] ?? '').trim()
        if (v && v !== 'undefined' && v !== 'null') out.add(v)
      }
      const params = n.params
      if (params && typeof params === 'object' && !Array.isArray(params)) {
        Object.keys(params).forEach((k) => {
          const name = String(k || '').trim()
          if (name) out.add(name)
        })
      } else if (Array.isArray(params)) {
        for (const p of params) {
          const name = String(p?.name ?? '').trim()
          if (name) out.add(name)
        }
      }
      walk(n.children)
    }
  }
  walk(steps)
  return [...out].filter(Boolean).sort((a, b) => a.localeCompare(b))
}

/**
 * @param {'expr'|'bind'} mode
 * @param {string[]} knownVars
 * @param {string} [query]
 */
export function buildAutocompleteCatalog(mode, knownVars, query = '') {
  const q = String(query || '').toLowerCase()
  const vars = (knownVars || []).map((name) => ({
    insert: mode === 'bind' ? name : `\${${name}}`,
    label: name,
    hint: name === 'LOAD_RUN_ID' ? 'Plan builtin' : 'Known binder',
    group: 'Variables',
  }))
  const snippets = mode === 'expr'
    ? EXPRESSION_SNIPPETS.map((s) => ({
      insert: s.insert,
      label: s.insert,
      hint: s.label,
      group: s.group,
    }))
    : []
  const all = [...vars, ...snippets]
  if (!q) return all
  return all.filter((item) => (
    item.insert.toLowerCase().includes(q)
    || item.hint.toLowerCase().includes(q)
    || item.label.toLowerCase().includes(q)
  ))
}

/** Partial query after `${` for expression mode; trailing token for bind mode. */
export function autocompleteQuery(value, caret, mode) {
  const v = String(value || '')
  const c = typeof caret === 'number' ? caret : v.length
  if (mode === 'bind') {
    return v.slice(0, c).split(/[^A-Za-z0-9_.-]/).pop() || ''
  }
  const before = v.slice(0, c)
  const m = before.match(/\$\{([^}]*)$/)
  return m ? m[1] : null
}

export function applyAutocompleteInsert(value, caret, mode, insert) {
  const v = String(value || '')
  const c = typeof caret === 'number' ? caret : v.length
  const after = v.slice(c)
  if (mode === 'bind') {
    const before = v.slice(0, c)
    const partial = before.split(/[^A-Za-z0-9_.-]/).pop() || ''
    const start = c - partial.length
    return { value: v.slice(0, start) + insert + after, caret: start + insert.length }
  }
  const before = v.slice(0, c)
  const open = before.lastIndexOf('${')
  const from = open >= 0 ? open : c
  return { value: v.slice(0, from) + insert + after, caret: from + insert.length }
}
