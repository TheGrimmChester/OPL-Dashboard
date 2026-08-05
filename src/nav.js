/**
 * Open Perf Lab information architecture — one pinned Overview, three labelled
 * sections, Administration last. See Open-UI-JS `docs/ia.md`.
 *
 * This module is data only (no JSX) so the route contract can be asserted by the
 * test suite without a DOM. Icons are attached in `components/shell/Shell.jsx`,
 * where one glyph means exactly one destination — the collapsed rail is
 * icon-only, so a shared glyph makes two destinations indistinguishable.
 */

export const PRODUCT_CODE = 'OPL'
export const PRODUCT_NAME = 'Open Perf Lab'

/** localStorage keys. Product-scoped: OPL must not fight OPA over one entry. */
export const THEME_KEY = 'opl_theme'
export const RAIL_KEY = 'opl_rail'

export const OVERVIEW = { to: '/overview', label: 'Overview', icon: 'grid', exact: true }

export const SECTIONS = [
  {
    id: 'design',
    label: 'Test design',
    items: [
      { to: '/scenarios', label: 'Scenarios', icon: 'layers' },
    ],
  },
  {
    id: 'execution',
    label: 'Execution',
    items: [
      { to: '/run', label: 'Run and scale', icon: 'play' },
      { to: '/results', label: 'Results', icon: 'chart' },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    items: [
      { to: '/trends', label: 'Trends', icon: 'trend' },
      { to: '/compare', label: 'Comparison', icon: 'columns' },
      { to: '/sla', label: 'SLA gates', icon: 'shield' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { to: '/settings/account', label: 'Account', icon: 'user' },
    ],
  },
]

/**
 * Scenarios sub-navigation. Each view is a real URL, so a step the operator is
 * editing survives a reload and the back button works.
 */
export const SCENARIO_TABS = [
  { to: '/scenarios', label: 'Steps' },
  { to: '/scenarios/users', label: 'Users and data' },
  { to: '/scenarios/capture', label: 'Capture' },
  { to: '/scenarios/jmx', label: 'JMX' },
]

/** Results detail sub-navigation, relative to `/results/:runId`. */
export const RESULT_TABS = [
  { segment: '', label: 'Summary' },
  { segment: 'timeline', label: 'Timeline' },
  { segment: 'errors', label: 'Errors' },
  { segment: 'resources', label: 'Resources' },
]

export function resultTabPath(runId, segment) {
  const base = `/results/${encodeURIComponent(runId)}`
  return segment ? `${base}/${segment}` : base
}

/** Every page title, keyed by route. Used for `document.title` per route. */
export const PAGE_TITLES = {
  '/overview': 'Overview',
  '/scenarios': 'Scenarios',
  '/run': 'Run and scale',
  '/results': 'Results',
  '/trends': 'Trends',
  '/compare': 'Comparison',
  '/sla': 'SLA gates',
  '/settings/account': 'Account',
}

/** Flat list of every nav destination, for the command menu and the tests. */
export function navItems() {
  return [OVERVIEW, ...SECTIONS.flatMap((s) => s.items)]
}
