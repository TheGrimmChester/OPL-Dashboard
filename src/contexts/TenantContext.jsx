import React, { createContext, useContext, useState } from 'react'
import axios from 'axios'

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

axios.interceptors.request.use((config) => {
  if (tenantHeaders.organizationId) config.headers['X-Organization-ID'] = tenantHeaders.organizationId
  if (tenantHeaders.projectId) config.headers['X-Project-ID'] = tenantHeaders.projectId
  return config
})

const TenantContext = createContext()

export const useTenant = () => {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider')
  }
  return context
}

/** Slim tenant provider — headers only; org/project pickers live in OPA when co-deployed. */
export const TenantProvider = ({ children }) => {
  const [organizationId, setOrganizationId] = useState(
    () => localStorage.getItem('organization_id') || DEFAULT_ORG,
  )
  const [projectId, setProjectId] = useState(
    () => localStorage.getItem('project_id') || DEFAULT_PROJECT,
  )

  const setOrg = (id) => {
    const v = id || DEFAULT_ORG
    localStorage.setItem('organization_id', v)
    tenantHeaders.organizationId = v
    setOrganizationId(v)
  }
  const setProj = (id) => {
    const v = id || DEFAULT_PROJECT
    localStorage.setItem('project_id', v)
    tenantHeaders.projectId = v
    setProjectId(v)
  }

  return (
    <TenantContext.Provider value={{
      organizationId,
      projectId,
      setOrganizationId: setOrg,
      setProjectId: setProj,
      organizations: [],
      projects: [],
      loading: false,
    }}
    >
      {children}
    </TenantContext.Provider>
  )
}
