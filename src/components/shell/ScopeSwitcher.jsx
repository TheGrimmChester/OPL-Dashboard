import React, { useMemo } from 'react'
import {
  MenuItem, MenuLabel, MenuSeparator, OrgSwitcher,
  ProjectScopeMenu, formatProjectScopeLabel,
} from '@open-family/ui'
import { ALL, useTenant } from '../../contexts/TenantContext'

/**
 * Organisation and project switcher — OAM directory (`?product=opl`), multi-select.
 * Free-text scope entry is no longer the primary control.
 */
export default function ScopeSwitcher() {
  const {
    organizationId, selection, setOrganizationId, setProjectSelection,
    organizations, projects,
    isPersonalAccount: personal, orgLocked, orgRowId, projectRowId,
  } = useTenant()

  const projectItems = useMemo(
    () => projects
      .map((p) => {
        const id = projectRowId(p)
        return id ? { id, label: p.name || id } : null
      })
      .filter(Boolean),
    [projects, projectRowId],
  )

  const uniqueOrgs = useMemo(() => {
    const rows = organizations.filter((o, i, all) => {
      const id = orgRowId(o)
      return id && i === all.findIndex((x) => orgRowId(x) === id)
    })
    return rows
  }, [organizations, orgRowId])

  const orgLabel = personal
    ? 'My account'
    : (organizationId === ALL || !organizationId
      ? 'All organisations'
      : (uniqueOrgs.find((o) => orgRowId(o) === organizationId)?.name || organizationId))

  return (
    <OrgSwitcher
      contextLabel={orgLabel}
      value={formatProjectScopeLabel(selection, projectItems)}
      initials={String(orgLabel).slice(0, 2)}
    >
      {!personal && !orgLocked ? (
        <>
          <MenuLabel>Organisation</MenuLabel>
          <MenuItem
            checked={organizationId === ALL || !organizationId}
            onSelect={() => setOrganizationId(ALL)}
          >
            All organisations
          </MenuItem>
          {uniqueOrgs.map((o) => {
            const id = orgRowId(o)
            return (
              <MenuItem
                key={id}
                checked={id === organizationId}
                onSelect={() => setOrganizationId(id)}
              >
                {o.name || id}
              </MenuItem>
            )
          })}
          <MenuSeparator />
        </>
      ) : null}
      <ProjectScopeMenu
        projects={projectItems}
        selection={selection}
        onChange={setProjectSelection}
      />
    </OrgSwitcher>
  )
}
