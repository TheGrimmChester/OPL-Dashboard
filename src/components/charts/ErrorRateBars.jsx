import React, { useMemo, useState } from 'react'
import { FiAlertTriangle } from 'react-icons/fi'
import { EmptyState } from '@open-family/ui'
import { compact, niceTicks, runTick, useMeasuredWidth } from './chrome'

/**
 * Error rate per run, oldest to newest.
 *
 * One measure, so one hue for every column: `--chart-mono`, which follows the
 * product accent.
 *
 * A breach is deliberately **not** a second fill colour. The first draft painted
 * breaching columns in `--critical-text` and left them at that; the palette
 * validator puts that pair at ΔE 5.2 (deutan, light) and 4.9 (protan, dark),
 * below even the 6–8 floor — green against red is the textbook confusion, so a
 * red-vs-green column pair is unreadable for a red/green-deficient viewer.
 *
 * So a breach is carried by three channels that do not depend on hue at all: the
 * column crosses a labelled dashed threshold line, it gains a notched marker
 * above its cap, and the count is stated in words beneath the plot. The critical
 * ink on the marker is reinforcement, never the signal.
 *
 * Columns are capped at 24px with a 4px rounded cap and a square baseline, and
 * neighbours are separated by a surface-coloured gap rather than a stroke.
 */
export default function ErrorRateBars({ points = [], maxErrorRate = null, height = 220 }) {
  const [hover, setHover] = useState(null)
  const [wrapRef, width] = useMeasuredWidth()

  const limit = Number.isFinite(Number(maxErrorRate)) ? Number(maxErrorRate) : null

  const geom = useMemo(() => {
    const values = points.map((p) => Number(p.error_rate) || 0)
    if (limit != null) values.push(limit)
    // Headroom for the breach marker and the threshold label.
    const ticks = niceTicks(Math.max(...values, 0.001) * 1.15)
    const top = ticks[ticks.length - 1]
    const pad = { top: 18, right: 20, bottom: 30, left: 56 }
    const iw = Math.max(80, width - pad.left - pad.right)
    const ih = Math.max(60, height - pad.top - pad.bottom)
    const band = iw / Math.max(points.length, 1)
    const barWidth = Math.max(3, Math.min(24, band * 0.56))
    const y = (v) => pad.top + ih - ((Number(v) || 0) / top) * ih
    return { pad, iw, ih, ticks, band, barWidth, y }
  }, [points, limit, width, height])

  if (!points.length) {
    return (
      <EmptyState
        inline
        title="No runs to chart"
        description="Each finished run of this scenario adds one column. Start a run from Run and scale."
      />
    )
  }

  const { pad, iw, ih, ticks, band, barWidth, y } = geom
  const breaching = limit != null ? points.filter((p) => (Number(p.error_rate) || 0) > limit).length : 0
  const runLabel = runTick
  const tickEvery = Math.max(1, Math.ceil((points.length * 56) / Math.max(iw, 1)))
  const R = 4

  return (
    <div className="oui-chart" ref={wrapRef}>
      <svg
        className="oui-chart-canvas"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Error rate by run"
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
              {compact(t * 100)}%
            </text>
          ))}
          {points.map((p, i) => (i % tickEvery === 0 ? (
            <text
              key={`tick-${p.id || i}`}
              className="oui-chart-tick"
              x={pad.left + band * i + band / 2}
              y={pad.top + ih + 20}
              textAnchor="middle"
            >
              {runLabel(p, i)}
            </text>
          ) : null))}
        </g>

        {limit != null && (
          <g>
            <line
              x1={pad.left}
              x2={pad.left + iw}
              y1={y(limit)}
              y2={y(limit)}
              stroke="var(--critical-text)"
              strokeWidth="1"
              strokeDasharray="5 4"
            />
            <text
              className="oui-chart-label"
              x={pad.left + iw}
              y={y(limit) < pad.top + 14 ? y(limit) + 16 : y(limit) - 7}
              textAnchor="end"
            >
              Max {compact(limit * 100)}%
            </text>
          </g>
        )}

        {points.map((p, i) => {
          const v = Number(p.error_rate) || 0
          const over = limit != null && v > limit
          const top = y(v)
          const barHeight = Math.max(0, pad.top + ih - top)
          const cx = pad.left + band * i + band / 2
          const x0 = cx - barWidth / 2
          return (
            <g key={`bar-${p.id || i}`} opacity={hover == null || hover === i ? 1 : 0.5}>
              <rect x={x0} y={top} width={barWidth} height={barHeight} rx={R} fill="var(--chart-mono)" />
              {/* Square the cap's lower edge so only the data-end is rounded. */}
              {barHeight > R && (
                <rect x={x0} y={top + R} width={barWidth} height={barHeight - R} fill="var(--chart-mono)" />
              )}
              {/* A breach is marked by shape: a notched cap above the column,
                  separated from it by a surface-coloured gap. It reads in
                  grayscale, in print and under any colour-vision deficiency. */}
              {over && (
                <path
                  d={`M${cx - 5} ${top - 5} L${cx + 5} ${top - 5} L${cx} ${top - 13} Z`}
                  fill="var(--critical-text)"
                  stroke="var(--chart-surface)"
                  strokeWidth="2"
                  paintOrder="stroke"
                >
                  <title>{`Over the ${compact(limit * 100)}% maximum`}</title>
                </path>
              )}
              <rect
                x={pad.left + band * i}
                y={pad.top}
                width={band}
                height={ih}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          )
        })}

        {/* One direct label: the worst run. Never a number on every column. */}
        {(() => {
          const worst = points.reduce(
            (acc, p, i) => ((Number(p.error_rate) || 0) > acc.v ? { v: Number(p.error_rate) || 0, i } : acc),
            { v: -1, i: 0 },
          )
          if (worst.v <= 0) return null
          const over = limit != null && worst.v > limit
          return (
            <text
              className="oui-chart-label"
              x={pad.left + band * worst.i + band / 2}
              // Clear the breach marker rather than overlapping it.
              y={y(worst.v) - (over ? 18 : 8)}
              textAnchor="middle"
            >
              {compact(worst.v * 100)}%
            </text>
          )
        })()}
      </svg>

      <div className="oui-row is-between">
        {hover != null ? (
          <span className="oui-text-sm">
            <span className="oui-text-muted oui-mono">{runLabel(points[hover], hover)}</span>
            {' · '}
            <strong className="oui-num">{compact((Number(points[hover].error_rate) || 0) * 100)}%</strong>
            {' errors'}
            {limit != null && (Number(points[hover].error_rate) || 0) > limit
              ? ` — over the ${compact(limit * 100)}% maximum`
              : ''}
          </span>
        ) : (
          <span className="oui-text-sm oui-text-muted">Hover a column for its exact rate.</span>
        )}
        {breaching > 0 && (
          <span className="oui-text-sm opl-chart-flag">
            <FiAlertTriangle size={14} aria-hidden="true" />
            {breaching} run{breaching === 1 ? '' : 's'} over the maximum error rate
          </span>
        )}
      </div>
    </div>
  )
}
