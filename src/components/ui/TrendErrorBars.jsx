import React, { useMemo } from 'react'

/** Column bars for error_rate across runs (oldest → newest). */
export default function TrendErrorBars({ points = [], height = 96 }) {
  const max = useMemo(() => Math.max(...points.map((p) => Number(p.error_rate) || 0), 0.001), [points])
  if (!points.length) return null
  return (
    <div className="perf-trend-bars" style={{ height }} role="img" aria-label="Error rate by run">
      {points.map((p) => {
        const v = Number(p.error_rate) || 0
        const pct = Math.max(6, (v / max) * 100)
        return (
          <div key={p.id} className="perf-trend-bar" style={{ height: `${pct}%` }} title={`${p.id}: ${v}`}>
            <span className="perf-trend-bar-tip">{v}</span>
          </div>
        )
      })}
    </div>
  )
}
