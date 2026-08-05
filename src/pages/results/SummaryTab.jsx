import React from 'react'
import { useParams } from 'react-router-dom'
import { FiDownload, FiPackage } from 'react-icons/fi'
import {
  Banner, Button, Card, DefinitionList, EmptyState, Stack, Table,
} from '@open-family/ui'
import ReportTemplateBar, { AppliedTemplate } from '../../components/ReportTemplateBar'
import NotifyChannels from '../../components/NotifyChannels'
import { usePerfLab } from '../../perflab/PerfLabContext'
import { tableState } from '../../components/tableState'
import { fmtNum } from '../../theme/format'

/** Per-step statistics for the run. */
function StepStats() {
  const { stepStats, runDetail } = usePerfLab()
  // The poller has no error channel of its own, so "waiting" and "none" are the
  // only honest states here — a run with no detail yet is loading.
  const loading = !runDetail && !stepStats.length
  return (
    <Card title="Per-step statistics" description="One row per named journey step, as the engine reported it." flush>
      <Table
        aria-label="Per-step statistics"
        state={tableState({ loading, error: null, rows: stepStats })}
        columns={[
          { key: 'step_name', header: 'Step' },
          { key: 'samples', header: 'Samples', numeric: true, render: (r) => fmtNum(r.samples) },
          { key: 'avg_ms', header: 'Average', numeric: true, render: (r) => `${fmtNum(r.avg_ms)} ms` },
          { key: 'p95_ms', header: 'p95', numeric: true, render: (r) => `${fmtNum(r.p95_ms)} ms` },
          { key: 'error_rate', header: 'Errors', numeric: true, render: (r) => fmtNum(r.error_rate) },
        ]}
        rows={stepStats}
        getRowKey={(r) => r.step_name}
        emptyState={(
          <EmptyState
            inline
            title="No per-step statistics"
            description="The engine reports these once a run finishes with named transaction steps. A single unnamed request produces none."
          />
        )}
      />
    </Card>
  )
}

/** Summary — what the run measured, and the artifacts you can take away. */
export default function SummaryTab() {
  const { runId } = useParams()
  const {
    runDetail, summaryPreview, busy, scopeLabel, flash,
    reportTemplates, reportTemplateId, setReportTemplateId, activeReportTemplate,
    exportRunReport, downloadBenchPack, runNotify,
  } = usePerfLab()

  const runError = runDetail?.error || summaryPreview?.dispatch_error
  const hasSummary = summaryPreview && (summaryPreview.p95_ms != null || summaryPreview.engine || runError)

  return (
    <Stack gap="sections">
      {runError && (
        <Banner tone="critical" title="This run reported an error">
          {String(runError)}
        </Banner>
      )}

      <Card
        title="Report layout"
        description="A template selects which widgets and metrics an export renders. It never changes how the run was measured."
        actions={(
          <ReportTemplateBar
            kind="report"
            label="Report template"
            templates={reportTemplates.templates}
            selectedId={reportTemplateId}
            onSelect={setReportTemplateId}
            onChanged={(id) => { reportTemplates.reload(); setReportTemplateId(id || '') }}
            onError={(detail) => flash('error', 'Template save failed', detail)}
          />
        )}
      >
        <Stack>
          <AppliedTemplate template={activeReportTemplate} scopeLabel={scopeLabel} />
          <div className="oui-row">
            <Button icon={<FiDownload />} disabled={busy} onClick={() => exportRunReport('json')}>JSON</Button>
            <Button icon={<FiDownload />} disabled={busy} onClick={() => exportRunReport('csv')}>CSV</Button>
            <Button icon={<FiDownload />} disabled={busy} onClick={() => exportRunReport('html')}>HTML</Button>
            <Button icon={<FiDownload />} disabled={busy} onClick={() => exportRunReport('pdf')}>PDF</Button>
            <span className="oui-spacer" />
            <Button variant="primary" icon={<FiPackage />} disabled={busy} onClick={downloadBenchPack}>
              Bench pack (ZIP)
            </Button>
          </div>
        </Stack>
      </Card>

      <Card title="Run summary" description="The figures the engine reported for this run.">
        {hasSummary ? (
          <Stack>
            <DefinitionList
              items={[
                { term: 'Engine', value: summaryPreview.engine || '—' },
                { term: 'Mode', value: summaryPreview.mode || '—' },
                { term: 'p50', value: summaryPreview.p50_ms != null ? `${fmtNum(summaryPreview.p50_ms)} ms` : '—' },
                { term: 'p95', value: summaryPreview.p95_ms != null ? `${fmtNum(summaryPreview.p95_ms)} ms` : '—' },
                { term: 'p99', value: summaryPreview.p99_ms != null ? `${fmtNum(summaryPreview.p99_ms)} ms` : '—' },
                { term: 'Error rate', value: summaryPreview.error_rate != null ? fmtNum(summaryPreview.error_rate) : '—' },
                { term: 'Requests', value: summaryPreview.requests != null ? fmtNum(summaryPreview.requests) : '—' },
                { term: 'Workers', value: summaryPreview.workers != null ? fmtNum(summaryPreview.workers) : '—' },
                { term: 'Containers', value: summaryPreview.containers != null ? fmtNum(summaryPreview.containers) : '—' },
              ]}
            />
            <details className="opl-raw">
              <summary>Raw summary payload</summary>
              <pre className="opl-code-well">{JSON.stringify(summaryPreview, null, 2)}</pre>
            </details>
          </Stack>
        ) : (
          <EmptyState
            inline
            title="No summary yet"
            description="The engine writes a summary when the run reaches a terminal status. Until then the figures above the tabs are computed from the samples as they arrive."
          />
        )}
      </Card>

      <StepStats />

      <NotifyChannels
        runNotify={runNotify}
        runId={runId}
        onError={(detail) => flash('error', 'Notification test failed', detail)}
      />
    </Stack>
  )
}
