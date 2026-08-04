import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { FiSend } from 'react-icons/fi'
import { apiUrl } from '../utils/apiBase'
import { Panel, DataTable, EmptyState } from './ui'
import { fmtAgo } from '../theme/format'

// Terminal-run notification channels + delivery history.
//
// Honesty rules this component exists to enforce visually:
//  - a channel that is not configured says so in plain words, with the reason,
//    in a muted state — never hidden, never dressed as success or as an error;
//  - `log` mode is visibly distinct from `deliver` (nothing leaves the box);
//  - every attempt is listed, including `skipped` ones.

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

// ResultBadge distinguishes results by shape as well as colour so the meaning
// survives grayscale: filled dot = left the box, ring = intentional no-send,
// dash = nothing was attempted.
function ResultBadge({ result }) {
  const tone = RESULT_TONES[result] || 'neutral'
  return (
    <span className={`perf-notify-result ${tone}`}>
      <span className="perf-notify-result-mark" aria-hidden="true" />
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
  const badge = !enabled ? 'disabled' : !configured ? '— not configured' : logOnly ? 'configured · log' : 'configured'
  const cls = [
    'perf-notify-card',
    configured && enabled ? (logOnly ? 'log' : 'on') : 'off',
    active ? 'active' : '',
  ].filter(Boolean).join(' ')
  return (
    <button
      type="button"
      className={cls}
      aria-pressed={active}
      onClick={() => onToggle(channel.name)}
      title={channel.target ? `Target: ${channel.target}` : state}
    >
      <span className="perf-notify-card-head">
        <span className="perf-notify-card-name">{channelLabel(channel.name)}</span>
        <span className="perf-notify-card-badge">
          <span className="perf-notify-result-mark" aria-hidden="true" />
          {badge}
        </span>
        <span className="perf-notify-card-payload">{CHANNEL_PAYLOADS[channel.name] || ''}</span>
      </span>
      <span className="perf-notify-card-state">{state}</span>
      {(channel.target || channel.signed) && (
        <span className="perf-notify-card-target opa-mono">
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
    const params = { limit: 100 }
    if (runId) params.run_id = runId
    axios.get(apiUrl('/api/perf/notifications'), { params })
      .then(({ data }) => { if (!cancelled) setHistory(data) })
      .catch(() => { if (!cancelled) setHistory(null) })
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

  const cols = [
    { key: 'created_at', header: 'Time', render: (r) => fmtAgo(r.created_at) },
    {
      key: 'run_id',
      header: 'Run',
      render: (r) => <span className="opa-mono perf-notify-run">{String(r.run_id || '—').slice(0, 18)}</span>,
    },
    { key: 'result', header: 'Status', render: (r) => <ResultBadge result={r.result} /> },
    { key: 'channel', header: 'Channel', render: (r) => channelLabel(r.channel) },
    { key: 'run_status', header: 'Run status' },
    {
      key: 'target',
      header: 'Target',
      render: (r) => <span className="opa-mono perf-notify-target">{r.target || '—'}</span>,
    },
    { key: 'detail', header: 'Detail', render: (r) => <span className="perf-notify-detail">{r.detail || '—'}</span> },
  ]

  const filterChip = (label, value, current, setter, count) => (
    <button
      key={`${label}-${value}`}
      type="button"
      className={`perf-notify-chip ${current === value ? 'active' : ''}`}
      aria-pressed={current === value}
      onClick={() => setter(value)}
    >
      {label}
      {count != null && <span className="perf-notify-chip-count">{count}</span>}
    </button>
  )

  return (
    <>
      <Panel
        title="Notification channels"
        actions={(
          <span className="perf-notify-head">
            <span className={`perf-notify-mode ${mode === 'log' ? 'log' : 'deliver'}`}>
              <span className="perf-notify-result-mark" aria-hidden="true" />
              mode: {mode}
            </span>
            <span className="perf-notify-statuses">on {runNotify?.statuses || 'terminal'}</span>
          </span>
        )}
      >
        <div className="perf-notify-body">
          {mode === 'log' && (
            <div className="perf-notify-banner log">
              Delivery mode is <strong>log</strong> — attempts are recorded as <code>logged</code> and nothing
              leaves this deployment. Set <code>OPL_RUN_NOTIFY_MODE=deliver</code> on opl-api to send for real.
            </div>
          )}
          {channels.length === 0 && (
            <p className="perf-hint">
              Channel status unavailable — <code>/api/health</code> did not report <code>run_notify.channels</code>.
            </p>
          )}
          <div className="perf-notify-strip">
            {channels.map((c) => (
              <ChannelCard
                key={c.name}
                channel={c}
                active={channelFilter === c.name}
                onToggle={(name) => setChannelFilter((cur) => (cur === name ? '' : name))}
              />
            ))}
          </div>
          <p className="perf-hint">
            {notConfigured.length === 0
              ? 'All channels are configured. Every terminal run records one history row per channel.'
              : `${notConfigured.length} of ${channels.length} channel${channels.length === 1 ? '' : 's'} `
                + `${notConfigured.length === 1 ? 'is' : 'are'} not configured. Unconfigured channels are listed `
                + 'with the reason rather than hidden — nothing is sent on them.'}
          </p>
          <div>
            <button type="button" className="opa-btn ghost" disabled={testing} onClick={sendTest}>
              <FiSend size={12} /> Send test notification
            </button>
            <span className="perf-hint" style={{ marginLeft: 8 }}>
              Synthetic terminal event with zeroed metrics — proves channel wiring, not a load run.
            </span>
          </div>
        </div>
      </Panel>

      <Panel
        title="Notification history"
        loading={loading}
        actions={(
          <span className="perf-notify-head">
            <span className="perf-notify-statuses">{rows.length} of {counts.total} attempts</span>
            {(channelFilter || resultFilter) && (
              <button
                type="button"
                className="opa-btn ghost"
                style={{ padding: '0 6px', fontSize: 11 }}
                onClick={() => { setChannelFilter(''); setResultFilter('') }}
              >
                Reset filters
              </button>
            )}
          </span>
        )}
      >
        <div className="perf-notify-filters">
          <div className="perf-notify-filter-row">
            <span className="perf-notify-filter-label">Channel</span>
            {filterChip('All', '', channelFilter, setChannelFilter, counts.total)}
            {['webhook', 'chat', 'email'].map((c) => filterChip(channelLabel(c), c, channelFilter, setChannelFilter, counts.byChannel[c] || 0))}
          </div>
          <div className="perf-notify-filter-row">
            <span className="perf-notify-filter-label">Result</span>
            {filterChip('All', '', resultFilter, setResultFilter, counts.total)}
            {['sent', 'failed', 'logged', 'skipped'].map((s) => filterChip(s, s, resultFilter, setResultFilter, counts.byResult[s] || 0))}
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            title="No delivery attempts recorded yet"
            hint={counts.total > 0
              ? 'No attempt matches the current filters.'
              : 'A row is written for every channel the moment a run reaches a notified terminal status.'}
          />
        ) : (
          <DataTable columns={cols} rows={rows} rowKey={(r, i) => r.id || i} maxHeight={320} />
        )}
        <p className="perf-hint" style={{ padding: '8px 12px 0' }}>
          <code>sent</code> reached the destination · <code>failed</code> the destination errored ·{' '}
          <code>logged</code> intentional no-send · <code>skipped</code> channel not configured (reason in Detail).
          History is a record of what happened and is not rewritten when configuration changes.
        </p>
      </Panel>
    </>
  )
}
