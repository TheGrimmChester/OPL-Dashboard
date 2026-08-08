import React from 'react'
import { FiUpload } from 'react-icons/fi'
import { Button, PageHeader, Stack } from '@open-family/ui'
import { usePerfLab } from '../perflab/PerfLabContext'
import RunsTable from '../components/RunsTable'
import { fmtNum } from '../theme/format'

/**
 * Results — the run list. This was the top half of the `results` tab; a single
 * run's detail now lives at `/results/:runId`, so it is linkable.
 */
export default function Results() {
  const { runRows, importJtlFile, busy, scopeLabel, hasConcreteProject } = usePerfLab()

  return (
    <Stack gap="sections">
      <PageHeader
        title="Results"
        description="Every load run recorded in this scope. Open one for its samples, per-step stats and runner containers, or import a JTL produced elsewhere."
        meta={[
          { label: 'Runs', value: fmtNum(runRows.length) },
          { label: 'Scope', value: scopeLabel },
        ]}
        actions={(
          <>
            <input
              id="opl-import-jtl"
              type="file"
              accept=".jtl,.csv,text/csv,text/xml,application/xml"
              className="oui-visually-hidden"
              onChange={(e) => { importJtlFile(e.target.files?.[0]); e.target.value = '' }}
            />
            <Button
              icon={<FiUpload />}
              disabled={busy || !hasConcreteProject}
              onClick={() => document.getElementById('opl-import-jtl')?.click()}
            >
              Import JTL
            </Button>
          </>
        )}
      />
      <RunsTable title="All runs" />
    </Stack>
  )
}
