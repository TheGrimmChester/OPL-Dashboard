import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  FiExternalLink, FiLogOut, FiMoon, FiRefreshCw, FiSun, FiUser, FiX,
} from 'react-icons/fi'
import {
  AppShell, Badge, Banner, Button, MenuHeader, MenuItem, MenuLabel, MenuSeparator,
  PageContent, Segmented, SearchTrigger, Sidebar, TopBar, TopBarDivider, UserMenu,
  isNavItemActive, productTitle, useSidebarCollapsed, useTheme,
} from '@open-family/ui'
import { useTimeRange } from '../../contexts/TimeRangeContext'
import { opaConfigured, opaHubHref } from '../../utils/entityLinks'
import { getOplClient } from '../../utils/oplClient'
import { usePerfLab } from '../../perflab/PerfLabContext'
import {
  navItems, OVERVIEW, PAGE_TITLES, PRODUCT_CODE, PRODUCT_NAME, RAIL_KEY, SECTIONS, THEME_KEY,
} from '../../nav'
import { navIcon } from './icons'
import ScopeSwitcher from './ScopeSwitcher'
import CommandMenu from './CommandMenu'

const withIcons = (items) => items.map((item) => ({ ...item, icon: navIcon(item.icon) }))

const SIDEBAR_SECTIONS = SECTIONS.map((section) => ({
  ...section,
  items: withIcons(section.items),
}))
const SIDEBAR_OVERVIEW = { ...OVERVIEW, icon: navIcon(OVERVIEW.icon) }

/**
 * Resolve the page name for the browser tab. The tab is read left to right, so
 * `productTitle` puts the page first — and it is recomputed on every route
 * change, not once at mount.
 */
export function pageNameFor(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  const match = navItems().find((item) => isNavItemActive(pathname, item))
  return match ? PAGE_TITLES[match.to] || match.label : undefined
}

export default function Shell({ children }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [collapsed, toggleCollapsed] = useSidebarCollapsed(RAIL_KEY)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const { theme, setTheme, toggle, resolved } = useTheme(THEME_KEY)
  const { range, ranges, setRange, refresh, tick } = useTimeRange()
  const { banner, setBanner } = usePerfLab()
  const [apiOk, setApiOk] = useState(null)

  const hub = opaConfigured() ? opaHubHref() : null
  const username = localStorage.getItem('username') || 'Operator'
  const role = localStorage.getItem('role') || ''

  useEffect(() => {
    let alive = true
    getOplClient().health()
      .then(() => { if (alive) setApiOk(true) })
      .catch(() => { if (alive) setApiOk(false) })
    return () => { alive = false }
  }, [tick])

  // One title per route. A title set once at mount leaves every page claiming to
  // be the landing page.
  useEffect(() => {
    document.title = productTitle({ productName: PRODUCT_NAME, page: pageNameFor(pathname) })
  }, [pathname])

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const signOut = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
    window.location.assign('/login')
  }

  return (
    <AppShell
      sidebarOpen={drawerOpen}
      onCloseSidebar={() => setDrawerOpen(false)}
      sidebar={(
        <Sidebar
          productCode={PRODUCT_CODE}
          productName={PRODUCT_NAME}
          overview={SIDEBAR_OVERVIEW}
          sections={SIDEBAR_SECTIONS}
          pathname={pathname}
          onNavigate={(to) => { navigate(to); setDrawerOpen(false) }}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          mobileOpen={drawerOpen}
          isAdmin={role === 'admin'}
        />
      )}
      topBar={(
        <TopBar
          onOpenSidebar={() => setDrawerOpen(true)}
          left={<ScopeSwitcher />}
          center={<SearchTrigger onOpen={() => setCommandOpen(true)} />}
          right={(
            <>
              {apiOk != null && (
                <Badge tone={apiOk ? 'good' : 'critical'} dot>
                  {apiOk ? 'API reachable' : 'API unreachable'}
                </Badge>
              )}
              <Segmented
                aria-label="Time range"
                value={range}
                onChange={setRange}
                items={ranges.map((r) => ({ value: r.value, label: r.label }))}
              />
              <Button variant="ghost" aria-label="Refresh" icon={<FiRefreshCw />} onClick={refresh} />
              <Button
                variant="ghost"
                aria-label={resolved === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme'}
                icon={resolved === 'dark' ? <FiSun /> : <FiMoon />}
                onClick={toggle}
              />
              {hub && (
                <Button
                  variant="ghost"
                  icon={<FiExternalLink />}
                  onClick={() => window.open(hub, '_blank', 'noopener,noreferrer')}
                >
                  Open in OPA
                </Button>
              )}
              <TopBarDivider />
              <UserMenu initials={username.slice(0, 2).toUpperCase()}>
                <MenuHeader>{username}{role ? ` · ${role}` : ''}</MenuHeader>
                <MenuItem icon={<FiUser />} onSelect={() => navigate('/settings/account')}>Account</MenuItem>
                <MenuSeparator />
                <MenuLabel>Appearance</MenuLabel>
                <MenuItem checked={theme === 'light'} onSelect={() => setTheme('light')}>Light</MenuItem>
                <MenuItem checked={theme === 'dark'} onSelect={() => setTheme('dark')}>Dark</MenuItem>
                <MenuItem checked={theme === 'system'} onSelect={() => setTheme('system')}>Match system</MenuItem>
                <MenuSeparator />
                <MenuItem icon={<FiLogOut />} danger onSelect={signOut}>Sign out</MenuItem>
              </UserMenu>
            </>
          )}
        />
      )}
    >
      <PageContent>
        {banner && (
          <div className="opl-notice">
          <Banner
            tone={banner.tone === 'error' ? 'critical' : banner.tone === 'warn' ? 'warning' : 'good'}
            title={banner.title}
            actions={(
              <Button
                size="sm"
                variant="ghost"
                aria-label="Dismiss notice"
                icon={<FiX />}
                onClick={() => setBanner(null)}
              />
            )}
          >
            {banner.detail == null
              ? null
              : (typeof banner.detail === 'string' ? banner.detail : JSON.stringify(banner.detail))}
          </Banner>
          </div>
        )}
        {children}
      </PageContent>
      <CommandMenu open={commandOpen} onClose={() => setCommandOpen(false)} />
    </AppShell>
  )
}
