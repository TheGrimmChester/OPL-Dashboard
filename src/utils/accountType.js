export const ACCOUNT_TYPE_KEY = 'account_type'
const ORG_KEY = 'organization_id'

export function readAccountType() {
  try {
    return localStorage.getItem(ACCOUNT_TYPE_KEY) || ''
  } catch {
    return ''
  }
}

export function isPersonalAccount(type = readAccountType()) {
  return type === 'personal'
}

export function isOrganizationAccount(type = readAccountType()) {
  return type === 'organization'
}

export function inferAccountType(data) {
  const user = data?.user || data || {}
  if (data?.account_type) return data.account_type
  if (user.account_type) return user.account_type
  const orgId = data?.org_id || user.org_id || ''
  return orgId ? 'organization' : 'personal'
}

/** Decode a JWT payload (no verification — the API verifies on use). */
export function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1]
    if (!part) return null
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function persistAccountFromLogin(data) {
  const accountType = inferAccountType(data)
  localStorage.setItem(ACCOUNT_TYPE_KEY, accountType)
  const orgId = data?.org_id || data?.user?.org_id || ''
  if (accountType === 'organization' && orgId) {
    localStorage.setItem(ORG_KEY, orgId)
  } else if (accountType === 'personal') {
    localStorage.removeItem(ORG_KEY)
  }
  return { accountType, orgId }
}

/** Persist account_type and org_id from a pasted or stored bearer token. */
export function persistAccountFromToken(token) {
  const claims = decodeJwtPayload(token)
  if (!claims) return { accountType: '', orgId: '' }
  return persistAccountFromLogin(claims)
}

export function lockedOrgId() {
  if (!isOrganizationAccount()) return null
  try {
    const org = localStorage.getItem(ORG_KEY)
    return org && org !== 'all' ? org : null
  } catch {
    return null
  }
}
