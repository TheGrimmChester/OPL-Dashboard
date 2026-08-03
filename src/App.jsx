import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import ErrorBoundary from './components/ErrorBoundary'
import { TenantProvider } from './contexts/TenantContext'
import { TimeRangeProvider } from './contexts/TimeRangeContext'
import AppShell from './components/shell/AppShell'
import { apiUrl } from './utils/apiBase'

const PerfLab = lazy(() => import('./pages/PerfLab'))
const Login = lazy(() => import('./pages/Login'))

let authProbe = null

function RequireAuth({ children }) {
  const [allowed, setAllowed] = useState(() => !!localStorage.getItem('auth_token'))

  useEffect(() => {
    if (allowed) return undefined
    if (!authProbe) {
      // OPL-API has no /api/auth/status; a 401 on a viewer route means auth is on.
      authProbe = axios
        .get(apiUrl('/api/perf/scenarios'))
        .then(() => true)
        .catch((err) => {
          const status = err?.response?.status
          return status !== 401 && status !== 403
        })
    }
    let active = true
    authProbe.then((ok) => {
      if (!active) return
      if (ok) {
        setAllowed(true)
      } else {
        const back = encodeURIComponent(window.location.pathname + window.location.search)
        window.location.assign(`/login?next=${back}`)
      }
    })
    return () => { active = false }
  }, [allowed])

  if (!allowed) {
    return <div className="opa-muted" style={{ padding: 24 }}>Checking session…</div>
  }
  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <TenantProvider>
        <TimeRangeProvider>
          <Suspense fallback={<div className="opa-muted" style={{ padding: 24 }}>Loading…</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={(
                  <RequireAuth>
                    <AppShell>
                      <Routes>
                        <Route path="/" element={<PerfLab />} />
                        <Route path="/lab" element={<PerfLab />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </AppShell>
                  </RequireAuth>
                )}
              />
            </Routes>
          </Suspense>
        </TimeRangeProvider>
      </TenantProvider>
    </ErrorBoundary>
  )
}
