import React from 'react'
import { FiDownload, FiUpload } from 'react-icons/fi'
import {
  Button, Card, EmptyState, Field, Select, Stack, Table, TableCaption,
} from '@open-family/ui'
import { usePerfLab } from '../../perflab/PerfLabContext'
import { fmtNum } from '../../theme/format'

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
    capturePreview, applyCapturePreview,
    importCaptureFile, downloadCapture, selectedId,
  } = usePerfLab()

  const previewSteps = (capturePreview?.steps || capturePreview?.scenario?.steps || []).slice(0, 50)
  const warnings = capturePreview?.warnings || []

  return (
    <Stack gap="sections">
      <Card
        title="Import a capture"
        description="A browser HAR, an XHR / fetch JSON export, or a Postman collection (v2 or v2.1). Every entry becomes an HTTP step. Preview before persisting — a capture usually carries more requests than a journey needs."
      >
        <Stack>
          <div className="opl-field-grid">
            <Field label="Mode" hint="A dry run never writes a scenario.">
              <Select
                aria-label="Import mode"
                options={[
                  { value: 'dry', label: 'Dry-run preview' },
                  { value: 'save', label: 'Persist as a scenario' },
                ]}
                value={captureDryRun ? 'dry' : 'save'}
                onChange={(e) => setCaptureDryRun(e.target.value === 'dry')}
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

      <Card
        title="Preview"
        description={capturePreview
          ? `${fmtNum(capturePreview.count || previewSteps.length)} steps parsed${warnings.length ? ` · ${warnings.join(' · ')}` : ''}`
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
              title="No capture loaded"
              description="Export a HAR from the browser's network panel, or an XHR JSON array, and drop it in above. The first fifty steps are shown here."
            />
          )}
        />
        {previewSteps.length > 0 && (
          <TableCaption>
            <span>
              {'Showing the first '}
              <strong className="oui-num">{fmtNum(previewSteps.length)}</strong>
              {' of '}
              <strong className="oui-num">{fmtNum(capturePreview.count || previewSteps.length)}</strong>
              {' parsed steps'}
            </span>
          </TableCaption>
        )}
      </Card>
    </Stack>
  )
}
