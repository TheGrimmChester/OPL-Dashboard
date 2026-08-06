import React, { createContext, useContext, useState } from 'react'
import axios from 'axios'

import {
  isPersonalAccount, lockedOrgId, readAccountType,
} from '../utils/accountType'

const ALL = 'all'
const DEFAULT_ORG = 'default-org'
const DEFAULT_PROJECT = 'default-project'

// Co-deployed NAS / AUTH_REQUIRED=1 strips picker "all" and scopes lists to the
// write tenant (default-org / default-project). Default the slim OPL picker to
// that pair so Perf Lab is not empty until the user opens OPA and picks a tenant.
const MIGRATED_KEY = 'opl_tenant_default_org_v1'
if (!localStorage.getItem(MIGRATED_KEY)) {
  const storedOrg = localStorage.getItem('organization_id')
  const storedProj = localStorage.getItem('project_id')
  if (!storedOrg || storedOrg === ALL) {
    localStorage.setItem('organization_id', DEFAULT_ORG)
  }
  if (!storedProj || storedProj === ALL) {
    localStorage.setItem('project_id', DEFAULT_PROJECT)
  }
  localStorage.setItem(MIGRATED_KEY, '1')
}

const tenantHeaders = {
  organizationId: localStorage.getItem('organization_id') || DEFAULT_ORG,
  projectId: localStorage.getItem('project_id') || DEFAULT_PROJECT,
}

// Every scoped list on the API keys off these two headers. The switcher in the
// top bar changes their values; it never stops sending them.
axios.interceptors.request.use((config) => {
  if (isPersonalAccount()) {
    if (tenantHeaders.projectId) config.headers['X-Project-ID'] = tenantHeaders.projectId
    return config
  }
  const org = lockedOrgId() || tenantHeaders.organizationId
  if (org) config.headers['X-Organization-ID'] = org
  if (tenantHeaders.projectId) config.headers['X-Project-ID'] = tenantHeaders.projectId
  return config
})

// OPL-API exposes no organisation or project directory — the authoritative
// picker lives in OPA when the stack is co-deployed. So the switcher offers the
// default pair plus whatever scope the operator has actually used here, which is
// remembered locally. It is a shortcut list, never a claim of completeness.
const KNOWN_KEY = 'opl_known_scopes'

function readKnown(kind, current) {
  let stored = []
  try {
    const raw = JSON.parse(localStorage.getItem(KNOWN_KEY) || '{}')
    if (Array.isArray(raw[kind])) stored = raw[kind].filter((v) => typeof v === 'string' && v)
  } catch {
    /* corrupt entry — fall back to the defaults below */
  }
  const seed = kind === 'organizations' ? DEFAULT_ORG : DEFAULT_PROJECT
  return [...new Set([seed, current, ...stored])].filter(Boolean)
}

function remember(kind, value) {
  try {
    const raw = JSON.parse(localStorage.getItem(KNOWN_KEY) || '{}')
    const list = Array.isArray(raw[kind]) ? raw[kind] : []
    localStorage.setItem(KNOWN_KEY, JSON.stringify({
      ...raw,
      [kind]: [...new Set([...list, value])].filter(Boolean).slice(-12),
    }))
  } catch {
    /* storage unavailable — the header still changed for this session */
  }
}

const TenantContext = createContext()

export const useTenant = () => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return context
}

/** Headers-only tenant provider, plus the shortcut list the top-bar switcher shows. */
export const TenantProvider = ({ children }) => {
  const [accountType] = useState(() => readAccountType())
  const orgLocked = !!lockedOrgId()
  const [organizationId, setOrganizationId] = useState(() => {
    const locked = lockedOrgId()
    if (locked) return locked
    if (isPersonalAccount(accountType)) return DEFAULT_ORG
    return localStorage.getItem('organization_id') || DEFAULT_ORG
  })
  const [projectId, setProjectId] = useState(
    () => localStorage.getItem('project_id') || DEFAULT_PROJECT,
  )
  const [organizations, setOrganizations] = useState(
    () => readKnown('organizations', localStorage.getItem('organization_id') || DEFAULT_ORG),
  )
  const [projects, setProjects] = useState(
    () => readKnown('projects', localStorage.getItem('project_id') || DEFAULT_PROJECT),
  )

  const setOrg = (id) => {
    if (orgLocked || isPersonalAccount(accountType)) return
    const v = id || DEFAULT_ORG
    localStorage.setItem('organization_id', v)
    tenantHeaders.organizationId = v
    remember('organizations', v)
    setOrganizations((list) => [...new Set([...list, v])])
    setOrganizationId(v)
  }
  const setProj = (id) => {
    const v = id || DEFAULT_PROJECT
    localStorage.setItem('project_id', v)
    tenantHeaders.projectId = v
    remember('projects', v)
    setProjects((list) => [...new Set([...list, v])])
    setProjectId(v)
  }

  return (
    <TenantContext.Provider value={{
      organizationId,
      projectId,
      setOrganizationId: setOrg,
      setProjectId: setProj,
      organizations,
      projects,
      defaultOrganizationId: DEFAULT_ORG,
      defaultProjectId: DEFAULT_PROJECT,
      loading: false,
      accountType,
      isPersonalAccount: isPersonalAccount(accountType),
      orgLocked,
    }}
    >
      {children}
    </TenantContext.Provider>
  )
}
