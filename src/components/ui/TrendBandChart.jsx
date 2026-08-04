import React, { useMemo } from 'react'

/** Multi-series latency band (p50/p95/p99) + optional SLA dashed line. */
export default function TrendBandChart({
  points = [],
  width = 520,
  height = 180,
  slaP95 = null,
}) {
  const geom = useMemo(() => {
    const vals = []
    points.forEach((p) => {
      ;[p.p50_ms, p.p95_ms, p.p99_ms].forEach((v) => {
        const n = Number(v)
        if (!isNaN(n)) vals.push(n)
      })
    })
    if (slaP95 != null && !isNaN(Number(slaP95))) vals.push(Number(slaP95))
    const min = 0
    const max = Math.max(...vals, 1) * 1.08
    const pad = { t: 14, r: 10, b: 22, l: 36 }
    const iw = width - pad.l - pad.r
    const ih = height - pad.t - pad.b
    const n = Math.max(points.length - 1, 1)
    const x = (i) => pad.l + (i / n) * iw
    const y = (v) => pad.t + ih - ((Number(v) || 0) - min) / (max - min) * ih
    const pathFor = (key) => {
      if (points.length < 2) return ''
      return points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join('')
    }
    return { pad, x, y, pathFor, max, slaY: slaP95 != null ? y(slaP95) : null }
  }, [points, width, height, slaP95])

  if (!points.length) {
    return <div className="perf-hint" style={{ padding: 12 }}>No trend points yet — run the scenario more than once.</div>
  }

  return (
    <div className="perf-trend-chart">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Latency trend band">
        {geom.slaY != null && (
          <line x1={geom.pad.l} y1={geom.slaY} x2={width - geom.pad.r} y2={geom.slaY} stroke="var(--accent-2, #17C0C0)" strokeDasharray="4 4" strokeWidth="1" />
        )}
        <path d={geom.pathFor('p50_ms')} fill="none" stroke="var(--p50, #2FD98A)" strokeWidth="2" strokeLinejoin="round" />
        <path d={geom.pathFor('p95_ms')} fill="none" stroke="var(--p95, #F5C451)" strokeWidth="2" strokeLinejoin="round" />
        <path d={geom.pathFor('p99_ms')} fill="none" stroke="var(--p99, #FF5C6C)" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={p.id || i} cx={geom.x(i)} cy={geom.y(p.p95_ms)} r="3" fill="var(--p95, #F5C451)">
            <title>{`${p.id}: p95 ${p.p95_ms}`}</title>
          </circle>
        ))}
      </svg>
      <div className="perf-trend-legend">
        <span className="leg-p50">p50</span>
        <span className="leg-p95">p95</span>
        <span className="leg-p99">p99</span>
        {slaP95 != null && <span className="leg-sla">SLA p95 {slaP95}</span>}
      </div>
    </div>
  )
}
