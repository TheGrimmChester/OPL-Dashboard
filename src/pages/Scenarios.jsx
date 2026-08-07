import React from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FiCheck, FiPlay, FiSave } from 'react-icons/fi'
import { Button, PageHeader, Stack, SubNav } from '@open-family/ui'
import { SCENARIO_TABS } from '../nav'
import { usePerfLab } from '../perflab/PerfLabContext'
import ProjectWriteBanner from '../components/ProjectWriteBanner'
import { fmtNum } from '../theme/format'

/**
 * Test design. Four views of one scenario — Steps, Users and data, Capture, JMX —
 * as a tab strip over four real URLs, because a page's views belong to the page.
 * They were the first four of the nine in-page tabs the whole product used to be.
 */
export default function Scenarios() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const {
    form, selectedId, busy, scnRows, engineLabel, scopeLabel, hasConcreteProject,
    saveScenario, validateScenario, startRun,
  } = usePerfLab()

  return (
    <Stack gap="sections">
      <PageHeader
        title="Scenarios"
        description="A scenario is a virtual-user journey, the data it is parameterised with, and the SLA it is judged against. Saving generates the JMX the Docker workers execute."
        meta={[
          { label: 'Editing', value: form.name || 'Untitled' },
          { label: 'Saved as', value: selectedId ? String(selectedId).slice(0, 18) : 'Not saved yet' },
          { label: 'In scope', value: `${fmtNum(scnRows.length)} scenarios` },
          { label: 'Engine', value: engineLabel },
          { label: 'Scope', value: scopeLabel },
        ]}
        actions={(
          <>
            <Button icon={<FiSave />} disabled={busy || !hasConcreteProject} onClick={saveScenario}>Save scenario</Button>
            <Button icon={<FiCheck />} disabled={busy || !selectedId || !hasConcreteProject} onClick={validateScenario}>
              Validate 1 VU
            </Button>
            <Button variant="primary" icon={<FiPlay />} disabled={busy || !selectedId || !hasConcreteProject} onClick={() => startRun()}>
              Start run
            </Button>
          </>
        )}
        flush
      />
      <ProjectWriteBanner hasConcreteProject={hasConcreteProject} />
      <SubNav
        aria-label="Scenario views"
        items={SCENARIO_TABS}
        pathname={pathname}
        onNavigate={navigate}
      />
      <Outlet />
    </Stack>
  )
}
