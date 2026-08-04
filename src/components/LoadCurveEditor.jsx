import React, { useMemo } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'

/**
 * Point-curve editor for schedule.curve → load-policies custom path.
 * Points are { t: seconds from start, vus: concurrent VUs }.
 */
export default function LoadCurveEditor({
  curve = [],
  onChange,
  onApplyPeak,
}) {
  const points = Array.isArray(curve) && curve.length
    ? curve
    : [{ t: 0, vus: 0 }, { t: 30, vus: 10 }, { t: 90, vus: 10 }, { t: 120, vus: 0 }]

  const peak = useMemo(() => points.reduce((m, p) => Math.max(m, Number(p.vus) || 0), 0), [points])
  const duration = useMemo(() => points.reduce((m, p) => Math.max(m, Number(p.t) || 0), 0), [points])
  const ramp = useMemo(() => {
    let bestT = 0
    let bestV = -1
    points.forEach((p) => {
      const v = Number(p.vus) || 0
      if (v > bestV) {
        bestV = v
        bestT = Number(p.t) || 0
      }
    })
    return bestT
  }, [points])

  const maxT = Math.max(duration, 1)
  const maxV = Math.max(peak, 1)

  const updatePoint = (i, patch) => {
    const next = points.map((p, idx) => (idx === i ? { ...p, ...patch } : { ...p }))
    onChange(next)
  }

  const addPoint = () => {
    const lastT = points.length ? Number(points[points.length - 1].t) || 0 : 0
    onChange([...points, { t: lastT + 30, vus: Math.max(1, Math.round(peak / 2)) }])
  }

  const removePoint = (i) => {
    if (points.length <= 2) return
    onChange(points.filter((_, idx) => idx !== i))
  }

  // Simple polyline for the spark chart
  const poly = points
    .slice()
    .sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0))
    .map((p) => {
      const x = ((Number(p.t) || 0) / maxT) * 100
      const y = 100 - ((Number(p.vus) || 0) / maxV) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="load-curve-editor">
      <div className="load-curve-chart" aria-hidden>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={poly} vectorEffect="non-scaling-stroke" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={((Number(p.t) || 0) / maxT) * 100}
              cy={100 - ((Number(p.vus) || 0) / maxV) * 100}
              r="2"
              fill="currentColor"
            />
          ))}
        </svg>
      </div>
      <p className="perf-hint">
        Custom load curve → peak {peak} VUs · duration {duration}s · ramp-to-peak {ramp}s
        (ThreadGroup approximation — not arrivals-accurate injectors).
      </p>
      <div className="load-curve-points">
        {points.map((p, i) => (
          <div className="load-curve-row" key={i}>
            <label>
              t (s)
              <input
                className="opa-input"
                type="number"
                min={0}
                value={p.t ?? 0}
                onChange={(e) => updatePoint(i, { t: Number(e.target.value) })}
                aria-label={`Point ${i + 1} time seconds`}
              />
            </label>
            <label>
              VUs
              <input
                className="opa-input"
                type="number"
                min={0}
                value={p.vus ?? 0}
                onChange={(e) => updatePoint(i, { vus: Number(e.target.value) })}
                aria-label={`Point ${i + 1} virtual users`}
              />
            </label>
            <button
              type="button"
              className="opa-btn ghost"
              disabled={points.length <= 2}
              onClick={() => removePoint(i)}
              aria-label={`Remove point ${i + 1}`}
            >
              <FiTrash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="opa-btn ghost" onClick={addPoint}>
          <FiPlus size={12} /> Add point
        </button>
        {typeof onApplyPeak === 'function' && (
          <button
            type="button"
            className="opa-btn ghost"
            onClick={() => onApplyPeak({ peak, duration, ramp, curve: points })}
            title="Apply peak VUs / duration / ramp from curve"
          >
            Apply to VUs &amp; duration
          </button>
        )}
      </div>
    </div>
  )
}
