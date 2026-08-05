import React, { useMemo, useState } from 'react'
import { EmptyState, Segmented } from '@open-family/ui'
import {
  ChartLegend, ChartTable, compact, niceTicks, runTick, useMeasuredWidth,
} from './chrome'

/**
 * Latency band across runs — p50 / p95 / p99, one y-axis, with the SLA p95
 * threshold drawn as a reference line rather than a fourth series.
 *
 * Three series, so the first three categorical slots are used in order and never
 * cycled. Slot 3 (aqua) is below 3:1 on the light surface, which is why each line
 * carries a direct end label and the panel offers a table view — colour is never
 * the only channel.
 */

const SERIES = [
  { key: 'p50_ms', label: 'p50', color: 'var(--chart-1)' },
  { key: 'p95_ms', label: 'p95', color: 'var(--chart-2)' },
  { key: 'p99_ms', label: 'p99', color: 'var(--chart-3)' },
]

export default function LatencyBandChart({ points = [], slaP95 = null, height = 260 }) {
  const [view, setView] = useState('chart')
  const [hover, setHover] = useState(null)
  const [wrapRef, width] = useMeasuredWidth()

  const geom = useMemo(() => {
    const values = points.flatMap((p) => SERIES.map((s) => Number(p[s.key]) || 0))
    if (slaP95 != null && Number.isFinite(Number(slaP95))) values.push(Number(slaP95))
    // 8% headroom, so the threshold line is never pinned to the plot's top edge
    // with nowhere to put its label.
    const ticks = niceTicks(Math.max(...values, 1) * 1.08)
    const top = ticks[ticks.length - 1]
    const pad = { top: 18, right: 74, bottom: 30, left: 56 }
    const iw = Math.max(80, width - pad.left - pad.right)
    const ih = Math.max(60, height - pad.top - pad.bottom)
    const n = Math.max(points.length - 1, 1)
    const x = (i) => pad.left + (i / n) * iw
    const y = (v) => pad.top + ih - ((Number(v) || 0) / top) * ih
    return { pad, iw, ih, ticks, x, y }
  }, [points, slaP95, width, height])

  if (!points.length) {
    return (
      <EmptyState
        inline
        title="No trend points yet"
        description="Run this scenario more than once and the band fills in — one point per finished run, oldest on the left."
      />
    )
  }

  const { pad, iw, ih, ticks, x, y } = geom
  const lastIndex = points.length - 1
  const tickEvery = Math.max(1, Math.ceil((points.length * 56) / Math.max(iw, 1)))
  const slaY = slaP95 != null && Number.isFinite(Number(slaP95)) ? y(slaP95) : null
  const runLabel = runTick

  return (
    <div className="oui-chart" ref={wrapRef}>
      <div className="oui-row is-between">
        <ChartLegend series={SERIES} lineStyle />
        <Segmented
          aria-label="Latency band view"
          value={view}
          onChange={setView}
          items={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]}
        />
      </div>

      {view === 'table' ? (
        <ChartTable
          rows={points}
          series={SERIES}
          xLabel="Run"
          xOf={(p, i) => runLabel(p, i)}
          format={(v) => `${compact(v)} ms`}
        />
      ) : (
        <>
          <svg
            className="oui-chart-canvas"
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Latency percentiles p50, p95 and p99 across runs"
            onMouseLeave={() => setHover(null)}
          >
            <g className="oui-chart-grid">
              {ticks.map((t) => (
                <line key={t} x1={pad.left} x2={pad.left + iw} y1={y(t)} y2={y(t)} />
              ))}
            </g>
            <g className="oui-chart-axis">
              <line x1={pad.left} x2={pad.left + iw} y1={pad.top + ih} y2={pad.top + ih} />
              {ticks.map((t) => (
                <text key={t} className="oui-chart-tick" x={pad.left - 10} y={y(t) + 4} textAnchor="end">
                  {compact(t)} ms
                </text>
              ))}
              {points.map((p, i) => (i % tickEvery === 0 ? (
                <text
                  key={`tick-${p.id || i}`}
                  className="oui-chart-tick"
                  x={x(i)}
                  y={pad.top + ih + 20}
                  textAnchor="middle"
                >
                  {runLabel(p, i)}
                </text>
              ) : null))}
            </g>

            {/* The SLA threshold is a reference line, not a series — status ink,
                dashed so it cannot be mistaken for measured data, and labelled. */}
            {slaY != null && (
              <g>
                <line
                  x1={pad.left}
                  x2={pad.left + iw}
                  y1={slaY}
                  y2={slaY}
                  stroke="var(--critical-text)"
                  strokeWidth="1"
                  strokeDasharray="5 4"
                />
                <text
                  className="oui-chart-label"
                  x={pad.left + iw}
                  // Sit under the line when it runs close to the plot's top edge,
                  // so the label never lands on the legend above the canvas.
                  y={slaY < pad.top + 14 ? slaY + 16 : slaY - 7}
                  textAnchor="end"
                >
                  SLA p95 {compact(slaP95)} ms
                </text>
              </g>
            )}

            {SERIES.map((s) => (
              <path
                key={s.key}
                d={points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p[s.key]).toFixed(1)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {/* End marker plus one direct label per series — sparing by design,
                and the relief the light-mode contrast warning requires. */}
            {SERIES.map((s) => (
              <g key={`end-${s.key}`}>
                <circle
                  cx={x(lastIndex)}
                  cy={y(points[lastIndex][s.key])}
                  r="4.5"
                  fill={s.color}
                  stroke="var(--chart-surface)"
                  strokeWidth="2"
                />
                <text className="oui-chart-label" x={x(lastIndex) + 12} y={y(points[lastIndex][s.key]) + 4}>
                  {compact(points[lastIndex][s.key])}
                </text>
              </g>
            ))}

            {/* Crosshair hit targets span the plot height, not the marks. */}
            {points.map((p, i) => (
              <rect
                key={`hit-${p.id || i}`}
                x={x(i) - iw / Math.max(points.length - 1, 1) / 2}
                y={pad.top}
                width={iw / Math.max(points.length - 1, 1)}
                height={ih}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            ))}
            {hover != null && (
              <g pointerEvents="none">
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={pad.top}
                  y2={pad.top + ih}
                  stroke="var(--chart-axis)"
                  strokeWidth="1"
                />
                {SERIES.map((s) => (
                  <circle
                    key={`hv-${s.key}`}
                    cx={x(hover)}
                    cy={y(points[hover][s.key])}
                    r="5"
                    fill={s.color}
                    stroke="var(--chart-surface)"
                    strokeWidth="2"
                  />
                ))}
              </g>
            )}
          </svg>

          <div className="oui-row is-between">
            {hover != null ? (
              <div className="oui-row oui-text-sm opl-chart-readout">
                <span className="oui-text-muted oui-mono">{runLabel(points[hover], hover)}</span>
                {SERIES.map((s) => (
                  <span className="oui-chart-legend-item" key={`ro-${s.key}`}>
                    <span className="oui-chart-swatch is-line" style={{ background: s.color }} />
                    <span className="oui-num">{compact(points[hover][s.key])} ms</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="oui-text-sm oui-text-muted">Hover the plot for exact values.</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
