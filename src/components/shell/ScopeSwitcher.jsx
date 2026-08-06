import React, { useState } from 'react'
import {
  Button, Input, MenuItem, MenuLabel, MenuSeparator, OrgSwitcher,
} from '@open-family/ui'
import { useTenant } from '../../contexts/TenantContext'

/**
 * Organisation and project switcher.
 *
 * The two values are the `X-Organization-ID` / `X-Project-ID` headers every
 * scoped list on the API keys off, so this control is the only thing standing
 * between the operator and an empty lab. It starts on the deployment default
 * (`default-org` / `default-project`) and stays there until the operator moves
 * it — a co-deployed stack scopes writes to that pair.
 *
 * OPL-API publishes no scope directory, so the list is the default pair plus the
 * scopes used here before, with a free-text row for anything else.
 */
export default function ScopeSwitcher() {
  const {
    organizationId, projectId, setOrganizationId, setProjectId,
    organizations, projects, defaultOrganizationId, defaultProjectId,
    isPersonalAccount: personal, orgLocked,
  } = useTenant()
  const [draftOrg, setDraftOrg] = useState('')
  const [draftProject, setDraftProject] = useState('')

  if (personal) return null

  const applyDraft = () => {
    if (draftOrg.trim()) setOrganizationId(draftOrg.trim())
    if (draftProject.trim()) setProjectId(draftProject.trim())
    setDraftOrg('')
    setDraftProject('')
  }

  return (
    <OrgSwitcher
      contextLabel={organizationId}
      value={projectId}
      initials={organizationId.slice(0, 2)}
    >
      <MenuLabel>Organisation</MenuLabel>
      {!orgLocked ? (
        <>
          {organizations.map((id) => (
            <MenuItem key={id} checked={id === organizationId} onSelect={() => setOrganizationId(id)}>
              {id}
              {id === defaultOrganizationId ? ' · default' : ''}
            </MenuItem>
          ))}
          <MenuSeparator />
        </>
      ) : (
        <MenuItem checked disabled>{organizationId}</MenuItem>
      )}
      <MenuLabel>Project</MenuLabel>
      {projects.map((id) => (
        <MenuItem key={id} checked={id === projectId} onSelect={() => setProjectId(id)}>
          {id}
          {id === defaultProjectId ? ' · default' : ''}
        </MenuItem>
      ))}
      <MenuSeparator />
      {!orgLocked ? (
        <>
          <MenuLabel>Another scope</MenuLabel>
          <div className="opl-scope-form">
            <Input
              aria-label="Organisation identifier"
              placeholder={organizationId}
              value={draftOrg}
              onChange={(e) => setDraftOrg(e.target.value)}
            />
            <Input
              aria-label="Project identifier"
              placeholder={projectId}
              value={draftProject}
              onChange={(e) => setDraftProject(e.target.value)}
            />
            <Button
              size="sm"
              variant="primary"
              block
              disabled={!draftOrg.trim() && !draftProject.trim()}
              onClick={applyDraft}
            >
              Switch scope
            </Button>
            <p className="oui-text-sm oui-text-muted">
              Every lab object — scenarios, runs, report templates — is stored per scope.
              Changing it reloads the lists against the new headers.
            </p>
          </div>
        </>
      ) : null}
    </OrgSwitcher>
  )
}
