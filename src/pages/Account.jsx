import React from 'react'
import { FiLogOut } from 'react-icons/fi'
import {
  Button, Card, DefinitionList, PageHeader, Segmented, Stack, useTheme,
} from '@open-family/ui'
import { useTenant } from '../contexts/TenantContext'
import { API_BASE } from '../utils/apiBase'
import { opaConfigured, opaHubHref } from '../utils/entityLinks'
import { THEME_KEY } from '../nav'

/**
 * Administration — the signed-in identity, the scope every list is filtered by,
 * and where this dashboard is pointed. Read-only: OPL holds no user directory of
 * its own, and no credential ever reaches the browser.
 */
export default function Account() {
  const { theme, setTheme } = useTheme(THEME_KEY)
  const { organizationId, projectId, defaultOrganizationId, defaultProjectId } = useTenant()

  const username = localStorage.getItem('username') || '—'
  const role = localStorage.getItem('role') || '—'
  const hub = opaConfigured() ? opaHubHref() : null

  const signOut = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('username')
    localStorage.removeItem('role')
    window.location.assign('/login')
  }

  return (
    <Stack gap="sections">
      <PageHeader
        title="Account"
        description="Who you are signed in as, which scope the lab is reading, and where it is pointed. Identities are issued by the shared auth service, so they are changed there and not here."
      />

      <Card title="Signed in" description="From the session token this browser holds.">
        <Stack>
          <DefinitionList
            items={[
              { term: 'Username', value: username },
              { term: 'Role', value: role },
            ]}
          />
          <div className="oui-row">
            <Button variant="danger" icon={<FiLogOut />} onClick={signOut}>Sign out</Button>
          </div>
        </Stack>
      </Card>

      <Card
        title="Scope"
        description="Every scenario, run and report template is stored against this pair, and sent on each request as the organisation and project headers. Change it from the switcher in the top bar."
      >
        <DefinitionList
          items={[
            { term: 'Organisation', value: organizationId, mono: true },
            { term: 'Project', value: projectId, mono: true },
            { term: 'Deployment default', value: `${defaultOrganizationId} / ${defaultProjectId}`, mono: true },
          ]}
        />
      </Card>

      <Card title="Appearance" description="Stored in this browser. Match system follows the operating system in both directions.">
        <Segmented
          aria-label="Theme"
          value={theme}
          onChange={setTheme}
          items={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'Match system' },
          ]}
        />
      </Card>

      <Card title="Endpoints" description="Where this dashboard sends its requests.">
        <DefinitionList
          items={[
            { term: 'Perf Lab API', value: API_BASE || 'Same origin, proxied at /api/', mono: true },
            {
              term: 'Profiling deep links',
              value: hub || 'Not configured — trace links are hidden',
              mono: true,
            },
          ]}
        />
      </Card>
    </Stack>
  )
}
