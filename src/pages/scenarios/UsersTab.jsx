import React from 'react'
import { FiSave } from 'react-icons/fi'
import {
  Banner, Button, Card, Code, Field, Input, Select, Stack, Textarea,
} from '@open-family/ui'
import { usePerfLab } from '../../perflab/PerfLabContext'

const SHARE_MODES = [
  { value: 'shareMode.all', label: 'All threads' },
  { value: 'shareMode.group', label: 'Current thread group' },
  { value: 'shareMode.thread', label: 'Current thread' },
]

/**
 * Users and data — virtual-user count, ramp, and the inline CSV dataset. This was
 * the `users` tab.
 *
 * These columns *do* reach the executed test: `opl-api` writes `data.csv` beside the
 * plan and emits a matching CSV Data Set element, so `${column}` binds at run time.
 */
export default function UsersTab() {
  const { form, setForm, busy, saveScenario } = usePerfLab()
  const csv = form.datasets.csv || {}

  const setCsv = (patch) => setForm({
    ...form,
    datasets: { ...form.datasets, csv: { ...csv, ...patch } },
  })

  const shareValue = (() => {
    const raw = csv.share_mode || 'shareMode.all'
    if (raw === 'all' || raw === 'shareMode.all') return 'shareMode.all'
    if (raw === 'group' || raw === 'shareMode.group') return 'shareMode.group'
    if (raw === 'thread' || raw === 'shareMode.thread') return 'shareMode.thread'
    return raw
  })()

  return (
    <Stack gap="sections">
      <Banner tone="accent" title="These columns reach the run">
        The values below are written as a data file beside the generated plan, with a matching CSV
        Data Set element, so a journey using
        {' '}
        <Code>{'${user}'}</Code>
        {' '}
        binds at run time. This editor does not check the columns itself — run Validate, which
        cross-checks every
        {' '}
        <Code>{'${…}'}</Code>
        {' '}
        reference against the declared columns and reports what nothing can bind rather than
        guessing.
      </Banner>

      <Card
        title="Virtual users"
        description="How many journeys run at once, and how quickly they arrive."
      >
        <div className="opl-field-grid">
          <Field label="Virtual users" htmlFor="users-vus">
            <Input
              id="users-vus"
              type="number"
              min={1}
              value={form.vus}
              onChange={(e) => setForm({ ...form, vus: Number(e.target.value) })}
            />
          </Field>
          <Field label="Ramp-up (s)" htmlFor="users-ramp">
            <Input
              id="users-ramp"
              type="number"
              min={0}
              value={form.schedule?.ramp_seconds ?? 10}
              onChange={(e) => setForm({
                ...form,
                schedule: { ...form.schedule, ramp_seconds: Number(e.target.value) },
              })}
            />
          </Field>
          <Field label="Duration (s)" htmlFor="users-duration">
            <Input
              id="users-duration"
              type="number"
              min={1}
              value={form.duration_seconds}
              onChange={(e) => setForm({ ...form, duration_seconds: Number(e.target.value) })}
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Dataset"
        description="An inline CSV, written with this delimiter and read back by the plan with the same one. Every field maps to datasets_json.csv and the emitted CSVDataSet."
        footer={(
          <Button variant="primary" icon={<FiSave />} disabled={busy} onClick={saveScenario}>
            Save users and datasets
          </Button>
        )}
      >
        <Stack>
          <div className="opl-field-grid">
            <Field label="Recycle rows" htmlFor="users-recycle">
              <Select
                id="users-recycle"
                options={[
                  { value: '1', label: 'Yes — loop the rows' },
                  { value: '0', label: 'No — stop when exhausted' },
                ]}
                value={csv.recycle !== false ? '1' : '0'}
                onChange={(e) => setCsv({ recycle: e.target.value === '1' })}
              />
            </Field>
            <Field
              label="Stop thread when exhausted"
              hint="Mutually exclusive with recycle — the API drops stop_thread when recycle is on."
              htmlFor="users-stop"
            >
              <Select
                id="users-stop"
                options={[
                  { value: '0', label: 'No' },
                  { value: '1', label: 'Yes' },
                ]}
                value={csv.stop_thread ? '1' : '0'}
                onChange={(e) => setCsv({ stop_thread: e.target.value === '1' })}
              />
            </Field>
            <Field
              label="Delimiter"
              hint="Use \t or the word tab for tab-separated data."
              htmlFor="users-delimiter"
            >
              <Input
                id="users-delimiter"
                className="oui-mono"
                maxLength={4}
                value={csv.delimiter ?? ','}
                onChange={(e) => setCsv({ delimiter: e.target.value })}
                placeholder=","
              />
            </Field>
            <Field label="Column names" className="opl-span-2" htmlFor="users-columns">
              <Input
                id="users-columns"
                value={csv.variableNames || ''}
                onChange={(e) => setCsv({ variableNames: e.target.value })}
                placeholder="user,password,token"
              />
            </Field>
          </div>

          <details className="opl-adv" open>
            <summary>Advanced — CSVDataSet</summary>
            <div className="opl-adv-body">
              <div className="opl-field-grid">
                <Field label="Share mode" htmlFor="users-share">
                  <Select
                    id="users-share"
                    options={SHARE_MODES}
                    value={shareValue}
                    onChange={(e) => setCsv({ share_mode: e.target.value })}
                  />
                </Field>
                <Field label="Quoted data" htmlFor="users-quoted">
                  <Select
                    id="users-quoted"
                    options={[
                      { value: '1', label: 'Yes' },
                      { value: '0', label: 'No' },
                    ]}
                    value={csv.quoted !== false ? '1' : '0'}
                    onChange={(e) => setCsv({ quoted: e.target.value === '1' })}
                  />
                </Field>
                <Field label="Ignore first line" htmlFor="users-ignore-first">
                  <Select
                    id="users-ignore-first"
                    options={[
                      { value: '0', label: 'No' },
                      { value: '1', label: 'Yes' },
                    ]}
                    value={csv.ignore_first_line ? '1' : '0'}
                    onChange={(e) => setCsv({ ignore_first_line: e.target.value === '1' })}
                  />
                </Field>
                <Field label="Encoding" htmlFor="users-encoding">
                  <Input
                    id="users-encoding"
                    value={csv.encoding || 'UTF-8'}
                    onChange={(e) => setCsv({ encoding: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </details>

          <Field
            label="CSV rows"
            hint={'Reference a column as ${user} in a URL, a header or a body once the scenario is saved.'}
            htmlFor="users-rows"
          >
            <Textarea
              id="users-rows"
              className="oui-mono"
              rows={10}
              value={csv.inline || ''}
              onChange={(e) => setCsv({ inline: e.target.value })}
              placeholder={'user1,secret1,tok1\nuser2,secret2,tok2'}
            />
          </Field>
        </Stack>
      </Card>
    </Stack>
  )
}
