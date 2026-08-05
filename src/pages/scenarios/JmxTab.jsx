import React from 'react'
import { FiDownload, FiSave, FiUpload } from 'react-icons/fi'
import { Button, Card, Field, Stack, Textarea } from '@open-family/ui'
import { usePerfLab } from '../../perflab/PerfLabContext'

/**
 * JMX — the exportable source of truth. This was the `jmx` tab.
 * Prefer Steps and Capture; this view exists for a plan that already exists.
 */
export default function JmxTab() {
  const { form, setForm, busy, selectedId, importJmxFile, downloadJmx, saveScenario } = usePerfLab()

  return (
    <Stack gap="sections">
      <Card
        title="JMX plan"
        description="Saving a scenario regenerates this from the journey tree. Paste or import a plan only when you already have one — hand edits are overwritten on the next save."
        actions={(
          <>
            <input
              id="opl-import-jmx"
              type="file"
              accept=".jmx,application/xml,text/xml"
              className="oui-visually-hidden"
              onChange={(e) => { importJmxFile(e.target.files?.[0]); e.target.value = '' }}
            />
            <Button
              icon={<FiUpload />}
              onClick={() => document.getElementById('opl-import-jmx')?.click()}
            >
              Import .jmx
            </Button>
            <Button variant="ghost" icon={<FiDownload />} disabled={!selectedId} onClick={downloadJmx}>
              Export .jmx
            </Button>
          </>
        )}
        footer={(
          <Button variant="primary" icon={<FiSave />} disabled={busy} onClick={saveScenario}>
            Save JMX
          </Button>
        )}
      >
        <Field
          label="Plan XML"
          hint="Generated on save, or paste a plan here. The Docker workers execute exactly this."
          htmlFor="opl-jmx"
        >
          <Textarea
            id="opl-jmx"
            className="oui-mono opl-jmx-source"
            rows={22}
            value={form.jmx_xml}
            onChange={(e) => setForm({ ...form, jmx_xml: e.target.value })}
            placeholder="Generated on save, or paste JMX XML here"
            aria-label="JMX plan XML"
          />
        </Field>
      </Card>
    </Stack>
  )
}
