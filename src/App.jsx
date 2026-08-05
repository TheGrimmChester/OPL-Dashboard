import React, { useState, useEffect, Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import { Spinner, ToastProvider } from '@open-family/ui'
import ErrorBoundary from './components/ErrorBoundary'
import { TenantProvider } from './contexts/TenantContext'
import { TimeRangeProvider } from './contexts/TimeRangeContext'
import { PerfLabProvider } from './perflab/PerfLabContext'
import Shell from './components/shell/Shell'
import { apiUrl } from './utils/apiBase'

const Login = lazy(() => import('./pages/Login'))
const Overview = lazy(() => import('./pages/Overview'))
const Scenarios = lazy(() => import('./pages/Scenarios'))
const StepsTab = lazy(() => import('./pages/scenarios/StepsTab'))
const UsersTab = lazy(() => import('./pages/scenarios/UsersTab'))
const CaptureTab = lazy(() => import('./pages/scenarios/CaptureTab'))
const JmxTab = lazy(() => import('./pages/scenarios/JmxTab'))
const RunAndScale = lazy(() => import('./pages/RunAndScale'))
const Results = lazy(() => import('./pages/Results'))
const ResultDetail = lazy(() => import('./pages/ResultDetail'))
const SummaryTab = lazy(() => import('./pages/results/SummaryTab'))
const TimelineTab = lazy(() => import('./pages/results/TimelineTab'))
const ErrorsTab = lazy(() => import('./pages/results/ErrorsTab'))
const ResourcesTab = lazy(() => import('./pages/results/ResourcesTab'))
const Trends = lazy(() => import('./pages/Trends'))
const Comparison = lazy(() => import('./pages/Comparison'))
const SlaGates = lazy(() => import('./pages/SlaGates'))
const Account = lazy(() => import('./pages/Account'))
const NotFound = lazy(() => import('./pages/NotFound'))

let authProbe = null

function Pending({ label }) {
  return (
    <div className="opl-pending">
      <Spinner label={label} />
      <span className="oui-text-secondary">{label}</span>
    </div>
  )
}

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

  if (!allowed) return <Pending label="Checking session" />
  return children
}

/**
 * Four routes plus a pinned Overview, where there used to be one page holding
 * nine in-page tabs. Scenarios and a result each keep several views, and those are
 * tab strips over real URLs rather than extra rail rows.
 *
 * `/` redirects to `/overview` — the one redirect in the product. `/lab`, which
 * rendered the same component as `/`, is gone, and an unknown URL now says so
 * instead of quietly landing on the studio.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <TenantProvider>
          <TimeRangeProvider>
            <Suspense fallback={<Pending label="Loading" />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/*"
                  element={(
                    <RequireAuth>
                      <PerfLabProvider>
                        <Shell>
                          <Suspense fallback={<Pending label="Loading the page" />}>
                            <Routes>
                              <Route path="/" element={<Navigate to="/overview" replace />} />
                              <Route path="/overview" element={<Overview />} />

                              <Route path="/scenarios" element={<Scenarios />}>
                                <Route index element={<StepsTab />} />
                                <Route path="users" element={<UsersTab />} />
                                <Route path="capture" element={<CaptureTab />} />
                                <Route path="jmx" element={<JmxTab />} />
                              </Route>

                              <Route path="/run" element={<RunAndScale />} />

                              <Route path="/results" element={<Results />} />
                              <Route path="/results/:runId" element={<ResultDetail />}>
                                <Route index element={<SummaryTab />} />
                                <Route path="timeline" element={<TimelineTab />} />
                                <Route path="errors" element={<ErrorsTab />} />
                                <Route path="resources" element={<ResourcesTab />} />
                              </Route>

                              <Route path="/trends" element={<Trends />} />
                              <Route path="/compare" element={<Comparison />} />
                              <Route path="/sla" element={<SlaGates />} />

                              <Route path="/settings/account" element={<Account />} />

                              <Route path="*" element={<NotFound />} />
                            </Routes>
                          </Suspense>
                        </Shell>
                      </PerfLabProvider>
                    </RequireAuth>
                  )}
                />
              </Routes>
            </Suspense>
          </TimeRangeProvider>
        </TenantProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
