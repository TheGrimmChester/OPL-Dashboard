import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiKey, FiLogIn } from 'react-icons/fi'
import axios from 'axios'
import { Banner, Button, Card, Divider, Field, Input, Textarea } from '@open-family/ui'
import { decodeJwtPayload, persistAccountFromLogin, persistAccountFromToken } from '../utils/accountType'

const API_URL = import.meta.env.VITE_API_URL || ''
const OAM_URL = (import.meta.env.VITE_OAM_URL || '').replace(/\/$/, '')

// Post-login redirect target: honor a ?next= query param (set by the 401
// interceptor) but only allow same-app relative paths; fall back to '/'.
function nextTarget() {
  const next = new URLSearchParams(window.location.search).get('next')
  if (next && next.startsWith('/') && !next.startsWith('//')) return next
  return '/'
}

function storeSession(data) {
  localStorage.setItem('auth_token', data.token)
  const user = data.user || data
  if (user.username) localStorage.setItem('username', user.username)
  if (user.role) localStorage.setItem('role', user.role)
  persistAccountFromLogin(data)
}

/**
 * OAM issues JWTs when codeployed; product /api/auth/login returns 503.
 * Prefer same-origin /oam-auth so CSP connect-src 'self' allows login XHR.
 * Absolute VITE_OAM_URL is for deep-links only — never for browser auth.
 */
async function resolveAuthBase() {
  try {
    const { data } = await axios.get(`${API_URL}/api/auth/status`)
    if (data?.mode === 'codeployed' || data?.mode === 'hub' || data?.standalone === false) {
      return '/oam-auth'
    }
  } catch {
    /* standalone or status unavailable — fall through */
  }
  try {
    await axios.get('/oam-auth/api/auth/status')
    return '/oam-auth'
  } catch {
    /* bridge absent */
  }
  if (OAM_URL) return OAM_URL
  return API_URL
}

function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoEnabled, setSsoEnabled] = useState(false)
  const [authBase, setAuthBase] = useState(API_URL)
  const [showToken, setShowToken] = useState(false)
  const [token, setToken] = useState(() => localStorage.getItem('auth_token') || '')

  // Capture the token the OIDC callback puts in the URL fragment (#token=...&
  // dnonce=...). Only accept it if dnonce matches the value this SPA stored
  // before initiating login — this proves the token belongs to a login WE
  // started and blocks token-fixation via a crafted /login#token=... link.
  // username/role come from the token's own signed claims, not spoofable params.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (window.location.hash && window.location.hash.includes('token=')) {
        const p = new URLSearchParams(window.location.hash.slice(1))
        const token = p.get('token')
        const dnonce = p.get('dnonce')
        const expected = sessionStorage.getItem('oidc_dnonce')
        // Preserve any ?next= before we strip the fragment from the URL.
        const target = nextTarget()
        // Strip the token from the URL immediately regardless of outcome.
        window.history.replaceState(null, '', window.location.pathname)
        sessionStorage.removeItem('oidc_dnonce')
        if (token && expected && dnonce && dnonce === expected) {
          const claims = decodeJwtPayload(token)
          if (claims) {
            localStorage.setItem('auth_token', token)
            if (claims.username) localStorage.setItem('username', claims.username)
            if (claims.role) localStorage.setItem('role', claims.role)
            persistAccountFromLogin(claims)
            navigate(target)
            return
          }
        }
        setError('SSO login could not be verified. Please try again.')
      }

      const base = await resolveAuthBase()
      if (cancelled) return
      setAuthBase(base)
      try {
        const r = await axios.get(`${base}/api/auth/oidc/status`)
        if (!cancelled) setSsoEnabled(!!r.data?.enabled)
      } catch {
        if (!cancelled) setSsoEnabled(false)
      }
    })()
    return () => { cancelled = true }
  }, [navigate])

  // Begin SSO: generate a one-time delivery nonce, remember it, and hand it to
  // the OPA-Hub login endpoint, which echoes it back in the post-login fragment.
  const startSso = () => {
    const nonce = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Date.now()}`
    sessionStorage.setItem('oidc_dnonce', nonce)
    window.location.href = `${authBase}/api/auth/oidc/login?dnonce=${encodeURIComponent(nonce)}`
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const base = authBase || await resolveAuthBase()
      const response = await axios.post(`${base}/api/auth/login`, {
        username,
        password,
      })
      storeSession(response.data)
      navigate(nextTarget())
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Invalid credentials'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const saveToken = (e) => {
    e.preventDefault()
    const value = token.trim()
    if (value) {
      localStorage.setItem('auth_token', value)
      persistAccountFromToken(value)
      const claims = decodeJwtPayload(value)
      if (claims?.username) localStorage.setItem('username', claims.username)
      if (claims?.role) localStorage.setItem('role', claims.role)
    } else {
      localStorage.removeItem('auth_token')
    }
    navigate(nextTarget())
  }

  return (
    <div className="opl-login">
      <div className="opl-login-card">
        <div className="opl-login-brand">
          <span className="oui-brand-mark">OPL</span>
          <span className="opl-login-brand-text">
            <h1>Open Perf Lab</h1>
            <p className="oui-text-secondary">Sign in to continue.</p>
          </span>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="opl-login-form">
            {error && <Banner tone="critical" title="Sign-in failed">{error}</Banner>}

            <Field label="Username" htmlFor="login-username">
              <Input
                id="login-username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                // eslint-disable-next-line jsx-a11y/no-autofocus -- the page exists to be typed into
                autoFocus
              />
            </Field>

            <Field label="Password" htmlFor="login-password">
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            <Button type="submit" variant="primary" block loading={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>

            {ssoEnabled && (
              <>
                <Divider />
                <Button type="button" block icon={<FiLogIn />} onClick={startSso}>
                  Sign in with SSO
                </Button>
              </>
            )}
          </form>
        </Card>

        <Button variant="ghost" icon={<FiKey />} block onClick={() => setShowToken((v) => !v)}>
          {showToken ? 'Hide token paste' : 'Paste a bearer token instead'}
        </Button>

        {showToken ? (
          <Card>
            <form onSubmit={saveToken} className="opl-login-form">
              <Field
                label="Bearer token"
                htmlFor="opl-login-token"
                hint="An OAM-issued JWT. Saving it here signs this browser in without a password round-trip."
              >
                <Textarea
                  id="opl-login-token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste an OAM-issued JWT"
                  rows={4}
                />
              </Field>
              <Button type="submit" variant="primary" icon={<FiLogIn />} block>
                {token.trim() ? 'Save and continue' : 'Continue without a token'}
              </Button>
            </form>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

export default Login
