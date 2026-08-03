import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FiZap, FiChevronsLeft, FiChevronsRight, FiActivity } from 'react-icons/fi'
import { productTitle } from '@open-family/ui'

const NAV = [
  { to: '/', label: 'Perf Lab', icon: FiZap, exact: true },
  { to: '/lab', label: 'Studio', icon: FiActivity },
]

export default function SideRail({ collapsed, onToggle }) {
  const { pathname } = useLocation()
  const brand = productTitle({ productName: 'Open Perf Lab', tagline: 'OPL' })
  const isActive = (item) => {
    if (item.exact) return pathname === item.to
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  }
  return (
    <nav className={`opa-rail ${collapsed ? 'collapsed' : ''}`}>
      <div className="opa-rail-brand" title={brand}>
        <FiZap />
        <span>Open Perf Lab</span>
      </div>
      <div className="opa-rail-nav">
        <div className="opa-rail-group-label">Lab</div>
        {NAV.map((it) => {
          const Icon = it.icon
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`opa-rail-item ${isActive(it) ? 'active' : ''}`}
              title={collapsed ? it.label : undefined}
            >
              <Icon />
              <span className="opa-rail-item-label">{it.label}</span>
            </Link>
          )
        })}
      </div>
      <button type="button" className="opa-rail-collapse" onClick={onToggle} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
      </button>
    </nav>
  )
}
