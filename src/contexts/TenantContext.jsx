import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import axios from 'axios'
import { projectScopeHeaders } from '@open-family/ui'

import { apiUrl } from '../utils/apiBase'
import {
  isPersonalAccount, lockedOrgId, readAccountType,
} from '../utils/accountType'
import {
  ALL,
  isMutatingMethod,
  isProjectDirectoryRequest,
  persistProjectSelection,
  projectIdFromSelection,
  readProjectSelection,
  tenantScopeKey,
} from '../utils/projectScope'

const SELECTION_KEY = 'project_selection'
const PROJECT_KEY = 'project_id'

export { ALL }

// One-time migration: "default-org"/"default-project" used to BE the
// "nothing selected" sentinel. Reset that exact pair to UI All — once.
const MIGRATED_KEY = 'opl_tenant_default_to_all_v1'
if (!localStorage.getItem(MIGRATED_KEY)) {
  const storedOrg = localStorage.getItem('organization_id')
  const storedProj = localStorage.getItem(PROJECT_KEY)
  if ((!storedOrg || storedOrg === 'default-org') && (!storedProj || storedProj === 'default-project')) {
    localStorage.setItem('organization_id', ALL)
    persistProjectSelection(SELECTION_KEY, PROJECT_KEY, ALL)
  } else if (storedProj && storedProj !== ALL && storedProj !== 'default-project' && !localStorage.getItem(SELECTION_KEY)) {
    persistProjectSelection(SELECTION_KEY, PROJECT_KEY, [storedProj])
  }
  localStorage.setItem(MIGRATED_KEY, '1')
}

function initialOrganizationId(accountType) {
  const locked = lockedOrgId()
  if (locked) return locked
  if (isPersonalAccount(accountType)) return ''
  return localStorage.getItem('organization_id') || ALL
}

const tenantHeaders = {
  organizationId: initialOrganizationId(readAccountType()),
  selection: readProjectSelection(SELECTION_KEY, PROJECT_KEY),
  enabledProjectIds: [],
}

function stampTenant(config) {
  config.headers = config.headers || {}
  delete config.headers['X-Project-ID']
  delete config.headers['X-Project-IDs']
  delete config.headers['X-Organization-ID']

  if (!isPersonalAccount()) {
    const org = lockedOrgId() || tenantHeaders.organizationId
    if (org) config.headers['X-Organization-ID'] = org
  }

  const url = config.url || ''
  if (isProjectDirectoryRequest(url)) return

  if (isMutatingMethod(config.method)) {
    if (
      tenantHeaders.selection !== ALL
      && Array.isArray(tenantHeaders.selection)
      && tenantHeaders.selection.length === 1
    ) {
      config.headers['X-Project-ID'] = tenantHeaders.selection[0]
    }
    return
  }

  if (
    tenantHeaders.selection === ALL
    && (!tenantHeaders.enabledProjectIds || tenantHeaders.enabledProjectIds.length === 0)
  ) {
    return
  }

  Object.assign(
    config.headers,
    projectScopeHeaders(tenantHeaders.selection, tenantHeaders.enabledProjectIds),
  )
}

axios.interceptors.request.use((config) => {
  stampTenant(config)
  return config
})

function projectRowId(p) {
  return String(p.project_id || p.id || '')
}

function orgRowId(o) {
  return String(o.org_id || o.id || '')
}

const TenantContext = createContext()

export const useTenant = () => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return context
}

/** OAM directory-backed tenant provider for the Perf Lab switcher. */
export const TenantProvider = ({ children }) => {
  const [accountType] = useState(() => readAccountType())
  const orgLocked = !!lockedOrgId()
  const [organizationId, setOrganizationIdState] = useState(() => initialOrganizationId(accountType))
  const [selection, setSelectionState] = useState(() => readProjectSelection(SELECTION_KEY, PROJECT_KEY))
  const [organizations, setOrganizations] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)

  const projectId = projectIdFromSelection(selection)
  const scopeKey = useMemo(
    () => tenantScopeKey(organizationId, selection),
    [organizationId, selection],
  )

  useEffect(() => {
    let active = true
    if (isPersonalAccount(accountType)) {
      setOrganizations([])
      return () => { active = false }
    }
    setLoading(true)
    const token = localStorage.getItem('auth_token')
    axios.get(apiUrl('/api/oam/organizations'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!active) return
        setOrganizations(r.data?.organizations || [])
      })
      .catch(() => {
        if (active) setOrganizations([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [accountType])

  useEffect(() => {
    let active = true
    const token = localStorage.getItem('auth_token')
    const personal = isPersonalAccount(accountType)
    const params = new URLSearchParams({ product: 'opl' })
    // Personal (incl. lab admin): omit org filter — OAM org lists exclude personal imports.
    if (!personal && organizationId && organizationId !== ALL) {
      params.set('organization_id', organizationId)
    }
    axios.get(apiUrl(`/api/oam/projects?${params}`), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!active) return
        const list = r.data?.projects || []
        setProjects(list)
        const ids = list.map(projectRowId).filter(Boolean)
        tenantHeaders.enabledProjectIds = ids
        if (tenantHeaders.selection !== ALL && Array.isArray(tenantHeaders.selection)) {
          const allowed = new Set(ids)
          const next = tenantHeaders.selection.filter((id) => allowed.has(id))
          if (next.length !== tenantHeaders.selection.length) {
            const saved = persistProjectSelection(SELECTION_KEY, PROJECT_KEY, next.length ? next : ALL)
            tenantHeaders.selection = saved
            setSelectionState(saved)
          }
        }
      })
      .catch(() => {
        if (!active) return
        setProjects([])
        tenantHeaders.enabledProjectIds = []
      })
    return () => { active = false }
  }, [organizationId, accountType])

  const setOrganizationId = useCallback((id) => {
    if (orgLocked || isPersonalAccount(accountType)) return
    const v = id || ALL
    localStorage.setItem('organization_id', v)
    tenantHeaders.organizationId = v
    setOrganizationIdState(v)
    const saved = persistProjectSelection(SELECTION_KEY, PROJECT_KEY, ALL)
    tenantHeaders.selection = saved
    setSelectionState(saved)
  }, [accountType, orgLocked])

  const setProjectSelection = useCallback((next) => {
    const saved = persistProjectSelection(SELECTION_KEY, PROJECT_KEY, next)
    tenantHeaders.selection = saved
    setSelectionState(saved)
  }, [])

  const setProjectId = useCallback((id) => {
    setProjectSelection(!id || id === ALL ? ALL : [String(id)])
  }, [setProjectSelection])

  tenantHeaders.organizationId = organizationId
  tenantHeaders.selection = selection

  const value = useMemo(() => ({
    organizationId,
    projectId,
    selection,
    scopeKey,
    setProjectSelection,
    setOrganizationId,
    setProjectId,
    organizations,
    projects,
    loading,
    accountType,
    isPersonalAccount: isPersonalAccount(accountType),
    orgLocked,
    hasConcreteProject: selection !== ALL && selection.length === 1,
    orgRowId,
    projectRowId,
  }), [
    organizationId, projectId, selection, scopeKey, setProjectSelection, setOrganizationId, setProjectId,
    organizations, projects, loading, accountType, orgLocked,
  ])

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}
