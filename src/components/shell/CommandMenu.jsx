import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiCornerDownLeft, FiMoon, FiRefreshCw, FiSun } from 'react-icons/fi'
import { Input, Kbd, useTheme } from '@open-family/ui'
import { useTimeRange } from '../../contexts/TimeRangeContext'
import { navItems, SCENARIO_TABS, THEME_KEY } from '../../nav'
import { navIcon } from './icons'

/**
 * The command menu behind the top bar's search trigger. Navigation and view
 * actions only — nothing here calls the API except the refresh the top bar
 * already offers, so opening it can never change data.
 */
export default function CommandMenu({ open, onClose }) {
  const navigate = useNavigate()
  const { refresh } = useTimeRange()
  const { resolved, toggle } = useTheme(THEME_KEY)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const commands = useMemo(() => {
    const pages = navItems().map((item) => ({
      id: `go:${item.to}`,
      group: 'Go to',
      label: item.label,
      icon: navIcon(item.icon),
      run: () => navigate(item.to),
    }))
    const views = SCENARIO_TABS.slice(1).map((tab) => ({
      id: `go:${tab.to}`,
      group: 'Scenario views',
      label: `Scenarios · ${tab.label}`,
      icon: navIcon('layers'),
      run: () => navigate(tab.to),
    }))
    return [
      ...pages,
      ...views,
      {
        id: 'act:theme',
        group: 'Actions',
        label: resolved === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme',
        icon: resolved === 'dark' ? <FiSun /> : <FiMoon />,
        run: toggle,
      },
      {
        id: 'act:refresh',
        group: 'Actions',
        label: 'Refresh the current window',
        icon: <FiRefreshCw />,
        run: refresh,
      },
    ]
  }, [navigate, refresh, resolved, toggle])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
  }, [open])

  useEffect(() => {
    setCursor(0)
  }, [query])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const pick = (command) => {
    onClose()
    command.run()
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((c) => Math.min(matches.length - 1, c + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((c) => Math.max(0, c - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const command = matches[cursor]
      if (command) pick(command)
    }
  }

  let lastGroup = null

  return (
    <div className="opl-cmd-scrim" role="presentation" onMouseDown={onClose}>
      <div
        className="opl-cmd"
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="opl-cmd-field">
          <Input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- the dialog exists to be typed into
            autoFocus
            aria-label="Search pages and actions"
            placeholder="Search pages and actions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
        </div>
        <div className="opl-cmd-list">
          {matches.length === 0 && (
            <p className="opl-cmd-none oui-text-sm oui-text-muted">
              Nothing matches “{query}”. Every page in the rail is reachable from here.
            </p>
          )}
          {matches.map((command, index) => {
            const heading = command.group !== lastGroup ? command.group : null
            lastGroup = command.group
            return (
              <React.Fragment key={command.id}>
                {heading && <div className="opl-cmd-group">{heading}</div>}
                <button
                  type="button"
                  className="opl-cmd-item"
                  aria-selected={index === cursor}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => pick(command)}
                >
                  <span className="opl-cmd-item-icon">{command.icon}</span>
                  <span className="opl-cmd-item-label">{command.label}</span>
                  {index === cursor && (
                    <span className="opl-cmd-item-hint"><FiCornerDownLeft size={13} /></span>
                  )}
                </button>
              </React.Fragment>
            )
          })}
        </div>
        <div className="opl-cmd-foot oui-text-sm oui-text-muted">
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> to move</span>
          <span><Kbd>↵</Kbd> to open</span>
          <span><Kbd>Esc</Kbd> to close</span>
        </div>
      </div>
    </div>
  )
}
