/**
 * The route contract. The nine in-page tabs became four routes plus two tab
 * strips, so the mapping is worth asserting: a dropped view is the one regression
 * this migration could plausibly cause.
 */
import { describe, expect, it } from 'vitest'
import { isNavItemActive, PRODUCTS } from '@open-family/ui'
import {
  navItems, OVERVIEW, PAGE_TITLES, PRODUCT_CODE, PRODUCT_NAME, RESULT_TABS,
  SCENARIO_TABS, SECTIONS, resultTabPath,
} from '../src/nav.js'
import { GLYPH_NAMES } from '../src/components/shell/icons.jsx'

/** Every view the tabbed page served, and the route it became. */
const TAB_TO_ROUTE = {
  design: '/scenarios',
  users: '/scenarios/users',
  capture: '/scenarios/capture',
  jmx: '/scenarios/jmx',
  run: '/run',
  results: '/results',
  trends: '/trends',
  compare: '/compare',
  sla: '/sla',
}

describe('information architecture', () => {
  it('pins Overview above the sections and puts Administration last', () => {
    expect(OVERVIEW.to).toBe('/overview')
    expect(OVERVIEW.exact).toBe(true)
    expect(SECTIONS[SECTIONS.length - 1].id).toBe('admin')
    expect(SECTIONS[SECTIONS.length - 1].label).toBe('Administration')
  })

  it('has three labelled sections plus Administration', () => {
    expect(SECTIONS).toHaveLength(4)
    expect(SECTIONS.map((s) => s.label)).toEqual([
      'Test design', 'Execution', 'Analysis', 'Administration',
    ])
    for (const section of SECTIONS) {
      expect(section.items.length).toBeGreaterThan(0)
      expect(section.items.length).toBeLessThanOrEqual(7)
    }
  })

  it('routes every one of the nine former in-page tabs', () => {
    const railRoutes = new Set(navItems().map((i) => i.to))
    const tabRoutes = new Set(SCENARIO_TABS.map((t) => t.to))
    for (const [tab, route] of Object.entries(TAB_TO_ROUTE)) {
      const reachable = railRoutes.has(route) || tabRoutes.has(route)
      expect(reachable, `the "${tab}" tab became ${route}, which nothing reaches`).toBe(true)
    }
    expect(Object.keys(TAB_TO_ROUTE)).toHaveLength(9)
  })

  it('gives every nav label a page title', () => {
    for (const item of navItems()) {
      expect(PAGE_TITLES[item.to], `${item.to} has no document title`).toBeTruthy()
    }
  })

  it('makes a nav label agree with its route name', () => {
    const byRoute = Object.fromEntries(navItems().map((i) => [i.to, i.label]))
    expect(byRoute['/scenarios']).toBe('Scenarios')
    expect(byRoute['/run']).toBe('Run and scale')
    expect(byRoute['/results']).toBe('Results')
    expect(byRoute['/trends']).toBe('Trends')
    expect(byRoute['/sla']).toBe('SLA gates')
  })

  it('gives one glyph to one destination, so the collapsed rail is legible', () => {
    const icons = navItems().map((i) => i.icon)
    expect(new Set(icons).size, 'two nav items share a glyph').toBe(icons.length)
    for (const name of icons) {
      expect(GLYPH_NAMES, `no glyph is registered for "${name}"`).toContain(name)
    }
  })

  it('anchors the active check so a sibling route cannot claim it', () => {
    const results = { to: '/results', label: 'Results' }
    expect(isNavItemActive('/results', results)).toBe(true)
    expect(isNavItemActive('/results/run-42', results)).toBe(true)
    expect(isNavItemActive('/results/run-42/errors', results)).toBe(true)
    expect(isNavItemActive('/resultsomething', results)).toBe(false)

    const run = { to: '/run', label: 'Run and scale' }
    expect(isNavItemActive('/run', run)).toBe(true)
    expect(isNavItemActive('/runners', run)).toBe(false)

    expect(isNavItemActive('/overview', OVERVIEW)).toBe(true)
    expect(isNavItemActive('/overview/anything', OVERVIEW)).toBe(false)
  })
})

describe('tab strips', () => {
  it('gives Scenarios the four IA views, with Steps at the bare route', () => {
    expect(SCENARIO_TABS.map((t) => t.label)).toEqual(['Steps', 'Users and data', 'Capture', 'JMX'])
    expect(SCENARIO_TABS[0].to).toBe('/scenarios')
    for (const tab of SCENARIO_TABS.slice(1)) {
      expect(tab.to.startsWith('/scenarios/')).toBe(true)
    }
  })

  it('gives a result the four IA views under its own run id', () => {
    expect(RESULT_TABS.map((t) => t.label)).toEqual(['Summary', 'Timeline', 'Errors', 'Resources'])
    expect(resultTabPath('run-1', '')).toBe('/results/run-1')
    expect(resultTabPath('run-1', 'errors')).toBe('/results/run-1/errors')
    // A run id is part of the path, so it has to survive one that needs escaping.
    expect(resultTabPath('run/1', 'timeline')).toBe('/results/run%2F1/timeline')
  })
})

describe('product identity', () => {
  it('claims the green accent from the family band', () => {
    expect(PRODUCT_CODE).toBe(PRODUCTS.opl.code)
    expect(PRODUCT_NAME).toBe(PRODUCTS.opl.name)
    expect(PRODUCTS.opl.accent.light).toBe('#007748')
    expect(PRODUCTS.opl.accent.dark).toBe('#00a768')
  })

  it('scopes its storage keys to itself', async () => {
    const nav = await import('../src/nav.js')
    expect(nav.THEME_KEY).toBe('opl_theme')
    expect(nav.RAIL_KEY).toBe('opl_rail')
  })
})
