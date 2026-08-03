import React, { useEffect, useState } from 'react'
import { FiExternalLink, FiRefreshCw } from 'react-icons/fi'
import { useTimeRange } from '../../contexts/TimeRangeContext'
import { opaConfigured, opaHubHref } from '../../utils/entityLinks'
import { getOplClient } from '../../utils/oplClient'
import ThemeToggle from './ThemeToggle'

export default function TopBar() {
  const { refresh, tick } = useTimeRange()
  const [apiOk, setApiOk] = useState(null)
  const hub = opaConfigured() ? opaHubHref() : null

  useEffect(() => {
    let alive = true
    getOplClient().health()
      .then(() => { if (alive) setApiOk(true) })
      .catch(() => { if (alive) setApiOk(false) })
    return () => { alive = false }
  }, [tick])

  return (
    <header className="opa-topbar">
      <div className="opa-breadcrumb">
        <span className="crumb-current">Open Perf Lab</span>
        {apiOk != null && (
          <span className="opa-muted" style={{ marginLeft: 8, fontSize: 12 }}>
            API {apiOk ? 'ok' : 'unreachable'}
          </span>
        )}
      </div>
      <div className="opa-topbar-right">
        <button type="button" className="opa-btn ghost" onClick={refresh} title="Refresh">
          <FiRefreshCw size={14} />
        </button>
        {hub && (
          <a className="opa-btn ghost" href={hub} target="_blank" rel="noopener noreferrer" title="Open OPA hub">
            <FiExternalLink size={14} /> Open in OPA
          </a>
        )}
        <ThemeToggle />
      </div>
    </header>
  )
}
