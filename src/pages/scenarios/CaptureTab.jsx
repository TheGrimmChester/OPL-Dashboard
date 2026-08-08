import React, { useEffect } from 'react'
import { FiDownload, FiUpload } from 'react-icons/fi'
import {
  Banner, Button, Card, Code, EmptyState, Field, Select, Stack, Table, TableCaption,
} from '@open-family/ui'
import { usePerfLab } from '../../perflab/PerfLabContext'
import { fmtNum } from '../../theme/format'
import {
  asWarningList, mentionsPrivateHosts, skipTallyFrom,
} from '../../perflab/captureHints'

/** A hidden file input dressed as a button, so the control matches every other one. */
function ImportButton({ label, accept, onFile, variant = 'secondary' }) {
  const id = `opl-import-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <>
      <input
        id={id}
        type="file"
        accept={accept}
        className="oui-visually-hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <Button
        variant={variant}
        icon={<FiUpload />}
        onClick={() => document.getElementById(id)?.click()}
      >
        {label}
      </Button>
    </>
  )
}

/**
 * Capture — turn a recorded browser session into journey steps. This was the
 * `capture` tab.
 */
export default function CaptureTab() {
  const {
    captureDryRun, setCaptureDryRun,
    captureIncludeStatic, setCaptureIncludeStatic,
    capturePreview, captureImportError, applyCapturePreview,
    importCaptureFile, downloadCapture, selectedId,
    hasConcreteProject,
  } = usePerfLab()

  // Persist uses WriteTenant — force dry-run when All projects / multi-select.
  useEffect(() => {
    if (!hasConcreteProject && !captureDryRun) setCaptureDryRun(true)
  }, [hasConcreteProject, captureDryRun, setCaptureDryRun])

  const previewSteps = (capturePreview?.steps || capturePreview?.scenario?.steps || []).slice(0, 50)
  const warnings = asWarningList(capturePreview?.warnings)
  const errorText = (() => {
    const err = captureImportError
    if (!err) return ''
    if (typeof err === 'string') return err
    if (typeof err === 'object') return err.error || err.message || JSON.stringify(err)
    return String(err)
  })()
  const skipped = skipTallyFrom(capturePreview, warnings)
  const count = Number(capturePreview?.count || previewSteps.length) || 0
  const emptySuccess = Boolean(capturePreview) && count === 0
  const showPrivateHint = mentionsPrivateHosts(errorText, ...warnings)
  const modeOptions = hasConcreteProject
    ? [
        { value: 'dry', label: 'Dry-run preview' },
        { value: 'save', label: 'Persist as a scenario' },
      ]
    : [{ value: 'dry', label: 'Dry-run preview (select one project to persist)' }]

  return (
    <Stack gap="sections">
      <Card
        title="Import a capture"
        description="A browser HAR, an XHR / fetch JSON export, or a Postman collection (v2 or v2.1). Every entry becomes an HTTP step. Preview before persisting — a capture usually carries more requests than a journey needs."
      >
        <Stack>
          <div className="opl-field-grid">
            <Field
              label="Mode"
              hint={hasConcreteProject
                ? 'A dry run never writes a scenario.'
                : 'All projects is list-only — persist needs one project selected.'}
            >
              <Select
                aria-label="Import mode"
                options={modeOptions}
                value={captureDryRun || !hasConcreteProject ? 'dry' : 'save'}
                onChange={(e) => {
                  if (!hasConcreteProject) {
                    setCaptureDryRun(true)
                    return
                  }
                  setCaptureDryRun(e.target.value === 'dry')
                }}
              />
            </Field>
            <Field label="Static assets" hint="CSS, JS and images are rarely the journey.">
              <Select
                aria-label="Static assets"
                options={[
                  { value: '0', label: 'Skip CSS, JS and images' },
                  { value: '1', label: 'Include static assets' },
                ]}
                value={captureIncludeStatic ? '1' : '0'}
                onChange={(e) => setCaptureIncludeStatic(e.target.value === '1')}
              />
            </Field>
          </div>

          <div className="oui-row">
            <ImportButton
              label="Import .har"
              accept=".har,application/json,text/json"
              onFile={(f) => importCaptureFile('har', f)}
              variant="primary"
            />
            <ImportButton
              label="Import XHR JSON"
              accept=".json,application/json"
              onFile={(f) => importCaptureFile('xhr', f)}
            />
            <ImportButton
              label="Import Postman"
              accept=".json,application/json"
              onFile={(f) => importCaptureFile('postman', f)}
            />
            <span className="oui-spacer" />
            <Button variant="ghost" icon={<FiDownload />} disabled={!selectedId} onClick={() => downloadCapture('har')}>
              Export HAR
            </Button>
            <Button variant="ghost" icon={<FiDownload />} disabled={!selectedId} onClick={() => downloadCapture('xhr')}>
              Export XHR
            </Button>
          </div>
        </Stack>
      </Card>

      {errorText ? (
        <Banner tone="critical" title="Import failed">
          {errorText}
        </Banner>
      ) : null}

      {emptySuccess ? (
        <Banner tone="warning" title="No HTTP steps left after import">
          Every entry was skipped or empty. Check the warnings below — metadata hosts stay blocked;
          static/OPTIONS/empty URLs are dropped. Lab private hosts are kept when present (see allowlist hint).
        </Banner>
      ) : null}

      {skipped > 0 && (
        <Banner tone="warning" title={`${fmtNum(skipped)} entries skipped`}>
          Static assets, OPTIONS, empty URLs, or blocked metadata hosts were dropped before the journey was built.
          Lab private hosts are imported with warnings (not counted here).
        </Banner>
      )}

      {warnings.length > 0 && (
        <Banner tone="warning" title={`${warnings.length} import warning${warnings.length === 1 ? '' : 's'}`}>
          <ul className="opl-warn-list">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Banner>
      )}

      {showPrivateHint && (
        <Banner tone="accent" title="Private hosts need an allowlist to run">
          Lab or NAS addresses (for example
          {' '}
          <Code>192.168.100.101</Code>
          ) are imported with warnings. Before validate or run, set
          {' '}
          <Code>OPA_PERF_INTERNAL_HOSTS</Code>
          {' '}
          on
          {' '}
          <Code>opl-api</Code>
          {' '}
          (comma-separated hostnames or IPs). No re-import needed after allowlisting.
        </Banner>
      )}

      <Card
        title="Preview"
        description={capturePreview
          ? `${fmtNum(count)} steps parsed${skipped ? ` · ${fmtNum(skipped)} skipped` : ''}${warnings.length ? ` · ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}`
          : 'What the importer read, before anything is written.'}
        actions={capturePreview && captureDryRun && previewSteps.length > 0
          ? <Button variant="primary" onClick={applyCapturePreview}>Apply to the designer</Button>
          : undefined}
        flush
      >
        <Table
          aria-label="Captured steps"
          state={capturePreview ? (previewSteps.length ? 'ready' : 'empty') : 'empty'}
          columns={[
            { key: 'method', header: 'Method', width: 110, render: (r) => r.method || 'GET' },
            { key: 'url', header: 'URL', mono: true, render: (r) => r.url },
            { key: 'selector', header: 'Selector', render: (r) => r.selector || '—' },
          ]}
          rows={previewSteps}
          getRowKey={(_r, i) => String(i)}
          emptyState={(
            <EmptyState
              title={capturePreview ? 'No steps to show' : 'No capture loaded'}
              description={capturePreview
                ? 'The importer returned zero HTTP steps. Review the warnings above — metadata blocks or all-static captures are common causes.'
                : 'Export a HAR from the browser\'s network panel, or an XHR JSON array, and drop it in above. The first fifty steps are shown here.'}
            />
          )}
        />
        {previewSteps.length > 0 && (
          <TableCaption>
            <span>
              {'Showing the first '}
              <strong className="oui-num">{fmtNum(previewSteps.length)}</strong>
              {' of '}
              <strong className="oui-num">{fmtNum(count)}</strong>
              {' parsed steps'}
            </span>
          </TableCaption>
        )}
      </Card>
    </Stack>
  )
}
