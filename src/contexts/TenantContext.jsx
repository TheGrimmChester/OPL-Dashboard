import React, { createContext, useContext, useState } from 'react'
import axios from 'axios'

const ALL = 'all'

const tenantHeaders = {
  organizationId: localStorage.getItem('organization_id') || ALL,
  projectId: localStorage.getItem('project_id') || ALL,
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
  const [organizationId, setOrganizationId] = useState(() => localStorage.getItem('organization_id') || ALL)
  const [projectId, setProjectId] = useState(() => localStorage.getItem('project_id') || ALL)

  const setOrg = (id) => {
    const v = id || ALL
    localStorage.setItem('organization_id', v)
    tenantHeaders.organizationId = v
    setOrganizationId(v)
  }
  const setProj = (id) => {
    const v = id || ALL
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
