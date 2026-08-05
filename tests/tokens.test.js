/**
 * The token contract, ported from `Open-UI-JS/tests/tokens.test.js`.
 *
 * Every assertion here failed at least once in this repository: custom properties
 * referenced but never defined (three that the audit found, plus eleven more in
 * the crash screen's own stylesheet), a hard-coded accent, and raw pixel values
 * in spatial declarations.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const kit = join(root, 'node_modules', '@open-family', 'ui')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const sourceFiles = walk(join(root, 'src'))
const productCss = sourceFiles.filter((f) => extname(f) === '.css')
const productCode = sourceFiles.filter((f) => ['.js', '.jsx'].includes(extname(f)))

/** Comments explain the rules; they are not the rules. Scan without them. */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

const read = (f) => stripComments(readFileSync(f, 'utf8'))

/** Every `--name: value` declaration in a stylesheet. */
function declaredVars(css) {
  const found = new Set()
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:/gi)) found.add(match[1])
  return found
}

/** Every `var(--name…)` reference, with the file it came from. */
function referencedVars(text, file) {
  const found = []
  for (const match of text.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,)?/gi)) {
    found.push({ name: match[1], hasFallback: Boolean(match[2]), file })
  }
  return found
}

const kitTokens = read(join(kit, 'styles', 'tokens.css'))
const kitComponents = read(join(kit, 'styles', 'components.css'))

const declared = new Set([
  ...declaredVars(kitTokens),
  ...declaredVars(kitComponents),
  ...productCss.flatMap((f) => [...declaredVars(read(f))]),
])

const referenced = [
  ...productCss.flatMap((f) => referencedVars(read(f), f)),
  ...productCode.flatMap((f) => referencedVars(read(f), f)),
]

describe('custom property contract', () => {
  it('resolves every custom property the product references', () => {
    const missing = [...new Set(
      referenced.filter((r) => !declared.has(r.name)).map((r) => `${r.name} (${r.file.replace(root, '.')})`),
    )].sort()
    expect(missing, 'a referenced-but-undefined custom property silently drops the whole declaration').toEqual([])
  })

  it('references at least one custom property, so the scan is not vacuously green', () => {
    // The negative control for the assertion above: if the walker or the regex
    // broke, `referenced` would be empty and "no missing tokens" would be a lie.
    expect(referenced.length).toBeGreaterThan(40)
    expect(declared.has('--accent')).toBe(true)
    expect(declared.has('--table-row-h')).toBe(true)
    expect(declared.has('--this-token-does-not-exist')).toBe(false)
  })

  it('actually reaches the files the tab-to-route split created', () => {
    /*
     * The scan walks the filesystem on purpose. `git grep` cannot see an
     * untracked file, so a scan built on it would come back clean while missing
     * every page this migration added — a false pass with nothing to signal it.
     * These paths are the proof that the walker reaches the new tree.
     */
    const scanned = new Set([...productCss, ...productCode].map((f) => f.replace(`${root}/`, '')))
    for (const file of [
      'src/perflab.css',
      'src/perflab/PerfLabContext.jsx',
      'src/perflab/model.js',
      'src/components/shell/Shell.jsx',
      'src/components/charts/LatencyBandChart.jsx',
      'src/components/charts/ErrorRateBars.jsx',
      'src/pages/Overview.jsx',
      'src/pages/ResultDetail.jsx',
      'src/pages/results/ErrorsTab.jsx',
      'src/pages/scenarios/StepsTab.jsx',
    ]) {
      expect(scanned.has(file), `the token scan never opened ${file}`).toBe(true)
    }
    expect(scanned.has('src/never-existed.jsx')).toBe(false)
  })

  it('has no src/theme token files and no :root token block left', () => {
    const themeCss = productCss.filter((f) => f.includes(join('src', 'theme')))
    expect(themeCss).toEqual([])
    for (const file of productCss) {
      expect(read(file), `${file} still declares a :root token block`).not.toMatch(/:root\s*\{/)
    }
  })

  it('uses none of the retired local tokens', () => {
    /*
     * Exact names, not prefixes. Several retired names are one hyphen away from a
     * live kit token — `--warn` is gone but `--warn-text` is current, `--radius`
     * is gone but `--radius-md` is current — so a family regex would fail on
     * correct code. These are the names the deleted `src/theme/*.css` declared,
     * plus the three the audit found referenced and never defined anywhere.
     */
    const retired = new Set([
      // scales whose numeric names lied about their values
      '--sp-1', '--sp-2', '--sp-3', '--sp-4', '--sp-5', '--sp-6', '--sp-8',
      '--fs-10', '--fs-11', '--fs-12', '--fs-13', '--fs-14', '--fs-15', '--fs-16',
      '--fs-18', '--fs-20', '--fs-24', '--fs-32', '--fs-48',
      '--fw-regular', '--fw-medium', '--fw-semibold', '--fw-bold',
      '--spacing-sm', '--spacing-md', '--spacing-lg', '--spacing-xl',
      '--font-size-xs', '--font-size-sm',
      '--font-weight-medium', '--font-weight-semibold',
      // per-repo palettes that the family palette replaces
      '--series-1', '--series-2', '--series-3', '--series-4',
      '--series-5', '--series-6', '--series-7', '--series-8',
      '--tier-app', '--tier-db', '--tier-redis', '--tier-http', '--tier-cache',
      '--p50', '--p95', '--p99',
      '--ok', '--ok-dim', '--warn', '--warn-dim', '--error', '--error-dim',
      '--down', '--info', '--info-dim', '--neutral',
      '--accent-subtle', '--accent-2', '--accent-color', '--danger',
      // layout and chrome names the kit renamed
      '--rail-w', '--rail-w-collapsed', '--bg-base', '--bg-sunken', '--grid',
      '--font-ui', '--font-family-base', '--radius', '--shadow-drawer',
      '--transition-base', '--text-inverse', '--shadow-md',
      // legacy alias layer
      '--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-elevated',
      '--bg-hover', '--bg-overlay', '--border-light', '--border-medium',
      '--border-dark', '--border-focus', '--border-color',
    ])
    const offenders = []
    for (const ref of referenced) {
      if (retired.has(ref.name)) offenders.push(`${ref.name} (${ref.file.replace(root, '.')})`)
    }
    expect([...new Set(offenders)].sort()).toEqual([])
  })

  it('would notice a retired token if one came back', () => {
    // The negative control for the assertion above.
    const retired = new Set(['--fs-10', '--danger', '--shadow-lg'])
    const sample = [{ name: '--danger', file: 'x' }, { name: '--accent', file: 'y' }]
    expect(sample.filter((r) => retired.has(r.name)).map((r) => r.name)).toEqual(['--danger'])
  })

  it('hard-codes no accent hex anywhere', () => {
    for (const file of [...productCss, ...productCode]) {
      const text = read(file)
      // The four dashboards' shared indigo, OPM's teal, and OPL's own green.
      expect(text, `${file.replace(root, '.')} hard-codes an accent`).not.toMatch(/#7C6CFF|#7c6cff|#1aa6a0|#007748|#00a768/)
    }
  })

  it('puts no raw pixel value in a spatial declaration', () => {
    const offenders = []
    for (const file of productCss) {
      const css = read(file)
      for (const match of css.matchAll(
        /(padding|padding-block|padding-inline|gap|row-gap|column-gap|font-size)\s*:\s*([^;{}]+);/gi,
      )) {
        const [, property, value] = match
        for (const px of value.matchAll(/(\d+(?:\.\d+)?)px/g)) {
          // Sub-4px optical corrections are the documented exception.
          if (Number(px[1]) > 3) offenders.push(`${file.replace(root, '.')} — ${property}: ${value.trim()}`)
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([])
  })
})

describe('density', () => {
  /**
   * Resolve a token to a literal. The kit expresses its geometry in terms of the
   * spacing scale (`--card-pad: var(--space-6)`), so a one-level dereference is
   * what turns the declaration into the number the density decision names.
   */
  const value = (name, depth = 0) => {
    const match = kitTokens.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'))
    if (!match) return null
    const raw = match[1].trim()
    const ref = raw.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i)
    if (ref && depth < 4) return value(ref[1], depth + 1)
    return raw
  }

  it('inherits the family density rather than restating it', () => {
    expect(value('--text-base')).toBe('15px')
    expect(value('--table-font-size')).toBe('14px')
    expect(value('--table-row-h')).toBe('52px')
    expect(value('--nav-item-h')).toBe('40px')
    expect(value('--control-h')).toBe('40px')
    expect(value('--card-pad')).toBe('24px')
    expect(value('--section-gap')).toBe('32px')
    expect(value('--content-max')).toBe('1440px')
    expect(value('--sidebar-w')).toBe('268px')
  })

  it('centres the content column', () => {
    const rule = kitComponents.match(/\.oui-content\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule[1]).toMatch(/margin-inline:\s*auto/)
  })
})
