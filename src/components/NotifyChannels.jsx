import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { FiRefreshCw, FiSend } from 'react-icons/fi'
import {
  Banner, Button, Card, Code, EmptyState, Stack, Table, TableCaption,
} from '@open-family/ui'
import { apiUrl } from '../utils/apiBase'
import { fmtAgo, fmtNum } from '../theme/format'
import { tableState } from './tableState'

// Terminal-run notification channels + delivery history.
//
// Honesty rules this component exists to enforce visually:
//  - a channel that is not configured says so in plain words, with the reason,
//    in a muted state — never hidden, never dressed as success or as an error;
//  - `log` mode is visibly distinct from `deliver` (nothing leaves the box);
//  - every attempt is listed, including `skipped` ones.
//
// State is carried by shape as well as colour, so the meaning survives grayscale:
// filled dot = left the box, ring = intentional no-send, dash = nothing attempted.
// That is also why these badges are local rather than the kit's `Badge` — the kit
// gives four status tones, and "configured but deliberately not sending" is not one
// of them.

const CHANNEL_LABELS = {
  webhook: 'Webhook',
  chat: 'Chat',
  email: 'Email',
}

const CHANNEL_PAYLOADS = {
  webhook: 'raw JSON POST',
  chat: 'chat message payload',
  email: 'SMTP',
}

const RESULT_TONES = {
  sent: 'ok',
  failed: 'error',
  logged: 'info',
  skipped: 'skipped',
}

function channelLabel(name) {
  return CHANNEL_LABELS[name] || name
}

function ResultBadge({ result }) {
  const tone = RESULT_TONES[result] || 'neutral'
  return (
    <span className={`opl-notify-result is-${tone}`}>
      <span className="opl-notify-mark" aria-hidden="true" />
      {result || '—'}
    </span>
  )
}

function ChannelCard({ channel, active, onToggle }) {
  const configured = channel.configured === true
  const enabled = channel.enabled !== false
  const logOnly = configured && enabled && channel.mode === 'log'
  const state = !enabled
    ? `disabled — ${channel.reason || 'excluded by OPL_RUN_NOTIFY_CHANNELS'}`
    : !configured
      ? `not configured — ${channel.reason || 'no destination set on opl-api'}`
      : logOnly
        ? 'configured, not sending — mode is log'
        : 'configured and sending'
  const badge = !enabled ? 'disabled' : !configured ? 'not configured' : logOnly ? 'configured · log' : 'configured'
  const cls = [
    'opl-notify-card',
    configured && enabled ? (logOnly ? 'is-log' : 'is-on') : 'is-off',
    active ? 'is-active' : '',
  ].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={cls}
      aria-pressed={active}
      onClick={() => onToggle(channel.name)}
      title={channel.target ? `Target: ${channel.target}` : state}
    >
      <span className="opl-notify-card-head">
        <span className="opl-notify-card-name">{channelLabel(channel.name)}</span>
        <span className="opl-notify-card-badge">
          <span className="opl-notify-mark" aria-hidden="true" />
          {badge}
        </span>
        <span className="oui-text-sm oui-text-muted">{CHANNEL_PAYLOADS[channel.name] || ''}</span>
      </span>
      <span className="oui-text-sm oui-text-secondary">{state}</span>
      {(channel.target || channel.signed) && (
        <span className="oui-text-sm oui-text-muted oui-mono opl-notify-target">
          {channel.target || ''}
          {channel.signed ? ' · signed' : ''}
        </span>
      )}
    </button>
  )
}

export default function NotifyChannels({ runNotify, runId, onError }) {
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [channelFilter, setChannelFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [testing, setTesting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const mode = runNotify?.mode || 'deliver'
  const channels = useMemo(() => {
    const list = Array.isArray(runNotify?.channels) ? runNotify.channels : []
    return list.map((c) => ({ ...c, mode }))
  }, [runNotify, mode])

  const notConfigured = channels.filter((c) => c.configured !== true || c.enabled === false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = { limit: 100 }
    if (runId) params.run_id = runId
    axios.get(apiUrl('/api/perf/notifications'), { params })
      .then(({ data }) => { if (!cancelled) setHistory(data) })
      .catch((e) => {
        if (cancelled) return
        setHistory(null)
        // Previously swallowed, so a failed history request rendered as
        // "no delivery attempts recorded yet" — the opposite of the truth.
        setError(e.response?.data?.error || e.message || 'Request failed')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [runId, reloadKey])

  const rows = useMemo(() => {
    const all = Array.isArray(history?.notifications) ? history.notifications : []
    return all.filter((r) => (!channelFilter || r.channel === channelFilter)
      && (!resultFilter || r.result === resultFilter))
  }, [history, channelFilter, resultFilter])

  const counts = useMemo(() => {
    const all = Array.isArray(history?.notifications) ? history.notifications : []
    const byChannel = {}
    const byResult = {}
    all.forEach((r) => {
      byChannel[r.channel] = (byChannel[r.channel] || 0) + 1
      byResult[r.result] = (byResult[r.result] || 0) + 1
    })
    return { total: all.length, byChannel, byResult }
  }, [history])

  const sendTest = async () => {
    setTesting(true)
    try {
      await axios.post(apiUrl('/api/perf/notifications/test'), { status: 'failed' })
      setReloadKey((k) => k + 1)
    } catch (e) {
      if (onError) onError(e.response?.data || e.message)
    } finally {
      setTesting(false)
    }
  }

  const columns = [
    { key: 'created_at', header: 'When', render: (r) => fmtAgo(r.created_at) },
    { key: 'run_id', header: 'Run', mono: true, render: (r) => String(r.run_id || '—').slice(0, 18) },
    { key: 'result', header: 'Result', render: (r) => <ResultBadge result={r.result} /> },
    { key: 'channel', header: 'Channel', render: (r) => channelLabel(r.channel) },
    { key: 'run_status', header: 'Run status' },
    { key: 'target', header: 'Target', mono: true, render: (r) => r.target || '—' },
    { key: 'detail', header: 'Detail', render: (r) => r.detail || '—' },
  ]

  const filterChip = (label, value, current, setter, count) => (
    <button
      key={`${label}-${value}`}
      type="button"
      className={`opl-chip${current === value ? ' is-active' : ''}`}
      aria-pressed={current === value}
      onClick={() => setter(value)}
    >
      {label}
      {count != null && <span className="opl-chip-count oui-num">{count}</span>}
    </button>
  )

  return (
    <>
      <Card
        title="Notification channels"
        description={`Where a terminal run reports to. Delivery mode is ${mode}, on ${runNotify?.statuses || 'terminal'} statuses.`}
      >
        <Stack>
          {mode === 'log' && (
            <Banner tone="warning" title="Delivery mode is log">
              Attempts are recorded as
              {' '}
              <Code>logged</Code>
              {' '}
              and nothing leaves this deployment. Set
              {' '}
              <Code>OPL_RUN_NOTIFY_MODE=deliver</Code>
              {' '}
              on opl-api to send for real.
            </Banner>
          )}
          {channels.length === 0 && (
            <p className="oui-text-sm oui-text-muted">
              Channel status unavailable —
              {' '}
              <Code>/api/health</Code>
              {' '}
              did not report
              {' '}
              <Code>run_notify.channels</Code>
              .
            </p>
          )}
          <div className="opl-notify-strip">
            {channels.map((c) => (
              <ChannelCard
                key={c.name}
                channel={c}
                active={channelFilter === c.name}
                onToggle={(name) => setChannelFilter((cur) => (cur === name ? '' : name))}
              />
            ))}
          </div>
          <p className="oui-text-sm oui-text-muted">
            {notConfigured.length === 0
              ? 'All channels are configured. Every terminal run records one history row per channel.'
              : `${notConfigured.length} of ${channels.length} channel${channels.length === 1 ? '' : 's'} `
                + `${notConfigured.length === 1 ? 'is' : 'are'} not configured. Unconfigured channels are listed `
                + 'with the reason rather than hidden — nothing is sent on them.'}
          </p>
          <div className="oui-row">
            <Button icon={<FiSend />} disabled={testing} onClick={sendTest}>Send a test notification</Button>
            <span className="oui-text-sm oui-text-muted">
              A synthetic terminal event with zeroed metrics. It proves the channel wiring, not a load run.
            </span>
          </div>
        </Stack>
      </Card>

      <Card
        title="Notification history"
        description="Every delivery attempt, including the ones that were deliberately not sent. History is a record of what happened and is not rewritten when the configuration changes."
        actions={(channelFilter || resultFilter)
          ? (
            <Button size="sm" variant="ghost" onClick={() => { setChannelFilter(''); setResultFilter('') }}>
              Reset filters
            </Button>
          )
          : undefined}
        flush
      >
        <div className="opl-notify-filters">
          <div className="opl-notify-filter-row">
            <span className="opl-notify-filter-label">Channel</span>
            {filterChip('All', '', channelFilter, setChannelFilter, counts.total)}
            {['webhook', 'chat', 'email'].map((c) => filterChip(channelLabel(c), c, channelFilter, setChannelFilter, counts.byChannel[c] || 0))}
          </div>
          <div className="opl-notify-filter-row">
            <span className="opl-notify-filter-label">Result</span>
            {filterChip('All', '', resultFilter, setResultFilter, counts.total)}
            {['sent', 'failed', 'logged', 'skipped'].map((s) => filterChip(s, s, resultFilter, setResultFilter, counts.byResult[s] || 0))}
          </div>
        </div>
        <Table
          aria-label="Notification delivery attempts"
          compact
          state={tableState({ loading, error, rows })}
          columns={columns}
          rows={rows}
          getRowKey={(r, i) => String(r.id ?? i)}
          emptyState={(
            <EmptyState
              inline
              title="No delivery attempts recorded yet"
              description={counts.total > 0
                ? 'No attempt matches the current filters.'
                : 'A row is written for every channel the moment a run reaches a notified terminal status.'}
            />
          )}
          errorState={(
            <EmptyState
              inline
              title="The delivery history failed to load"
              description={`${error || 'Request failed'} — this is a read of the history table, so nothing was sent or lost.`}
              actions={(
                <Button variant="primary" icon={<FiRefreshCw />} onClick={() => setReloadKey((k) => k + 1)}>
                  Retry
                </Button>
              )}
            />
          )}
        />
        <TableCaption>
          <span>
            {'Showing '}
            <strong className="oui-num">{fmtNum(rows.length)}</strong>
            {' of '}
            <strong className="oui-num">{fmtNum(counts.total)}</strong>
            {' attempts · '}
            <Code>sent</Code>
            {' reached the destination · '}
            <Code>failed</Code>
            {' the destination errored · '}
            <Code>logged</Code>
            {' intentional no-send · '}
            <Code>skipped</Code>
            {' channel not configured'}
          </span>
        </TableCaption>
      </Card>
    </>
  )
}
