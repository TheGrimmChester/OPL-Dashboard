import React, { useMemo } from 'react'
import { FiPlus, FiTrash2 } from 'react-icons/fi'
import { Banner, Button, Field, Input, Segmented } from '@open-family/ui'

/**
 * Point-curve editor for schedule.curve.
 * Modes:
 *  - vus: { t, vus } → classic ThreadGroup peak/ramp/duration
 *  - arrivals: { t, rate } → open-model arrival segments (one journey per start)
 *
 * The preview is a single-series line, so it wears `--chart-mono` — the product
 * accent — and needs no legend: the panel title names it.
 */
export default function LoadCurveEditor({
  curve = [],
  curveMode = 'vus',
  onChange,
  onModeChange,
  onApplyPeak,
}) {
  const mode = curveMode === 'arrivals' ? 'arrivals' : 'vus'

  const defaultCurve = mode === 'arrivals'
    ? [{ t: 0, rate: 0 }, { t: 30, rate: 2 }, { t: 90, rate: 2 }, { t: 120, rate: 0 }]
    : [{ t: 0, vus: 0 }, { t: 30, vus: 10 }, { t: 90, vus: 10 }, { t: 120, vus: 0 }]

  const points = Array.isArray(curve) && curve.length ? curve : defaultCurve

  const yKey = mode === 'arrivals' ? 'rate' : 'vus'

  const peak = useMemo(
    () => points.reduce((m, p) => Math.max(m, Number(p[yKey]) || 0), 0),
    [points, yKey],
  )
  const duration = useMemo(
    () => points.reduce((m, p) => Math.max(m, Number(p.t) || 0), 0),
    [points],
  )
  const ramp = useMemo(() => {
    if (mode === 'arrivals') return 0
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
  }, [points, mode])

  const arrivalsCompiled = useMemo(() => {
    if (mode !== 'arrivals') return null
    const sorted = [...points].sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0))
    const segs = []
    let total = 0
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const dt = Math.max(0, (Number(b.t) || 0) - (Number(a.t) || 0))
      if (dt <= 0) continue
      const avg = ((Number(a.rate) || 0) + (Number(b.rate) || 0)) / 2
      const n = Math.max(0, Math.round(avg * dt))
      if (n > 0) {
        segs.push({ delay: Number(a.t) || 0, ramp: dt, arrivals: n, avg })
        total += n
      }
    }
    return { segs, total, peak, duration }
  }, [points, mode, peak, duration])

  const maxT = Math.max(duration, 1)
  const maxY = Math.max(peak, 1)

  const updatePoint = (i, patch) => {
    const next = points.map((p, idx) => (idx === i ? { ...p, ...patch } : { ...p }))
    onChange(next)
  }

  const addPoint = () => {
    const lastT = points.length ? Number(points[points.length - 1].t) || 0 : 0
    if (mode === 'arrivals') {
      onChange([...points, { t: lastT + 30, rate: Math.max(0.5, peak / 2 || 1) }])
    } else {
      onChange([...points, { t: lastT + 30, vus: Math.max(1, Math.round(peak / 2)) }])
    }
  }

  const removePoint = (i) => {
    if (points.length <= 2) return
    onChange(points.filter((_, idx) => idx !== i))
  }

  const setMode = (next) => {
    if (typeof onModeChange === 'function') onModeChange(next)
  }

  const sorted = points
    .slice()
    .sort((a, b) => (Number(a.t) || 0) - (Number(b.t) || 0))
  const poly = sorted
    .map((p) => {
      const x = ((Number(p.t) || 0) / maxT) * 100
      const y = 100 - ((Number(p[yKey]) || 0) / maxY) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className={`opl-curve opl-curve--${mode}`}>
      <Segmented
        aria-label="Curve mode"
        value={mode}
        onChange={setMode}
        items={[
          { value: 'vus', label: 'Concurrent VUs' },
          { value: 'arrivals', label: 'Arrivals / sec' },
        ]}
      />

      <div className="opl-curve-chart">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={mode === 'arrivals'
            ? `Arrival rate curve, peak ${peak} per second over ${duration} seconds`
            : `Virtual user curve, peak ${peak} users over ${duration} seconds`}
        >
          <polyline
            fill="none"
            stroke="var(--chart-mono)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={poly}
            vectorEffect="non-scaling-stroke"
          />
          {sorted.map((p, i) => (
            <circle
              key={i}
              cx={((Number(p.t) || 0) / maxT) * 100}
              cy={100 - ((Number(p[yKey]) || 0) / maxY) * 100}
              r="1.6"
              fill="var(--chart-mono)"
              stroke="var(--chart-surface)"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>

      {mode === 'arrivals' ? (
        <Banner tone="accent" title="Arrivals curve">
          {`Compiles to open-model ThreadGroup segments — one journey per arrival, rate-shaped starts. `}
          {`Total ${arrivalsCompiled?.total ?? 0} arrivals · peak ${peak}/s · ${duration}s. `}
          This is not a concurrent-VU approximation.
        </Banner>
      ) : (
        <Banner tone="warning" title="Custom load curve">
          {`Peak ${peak} VUs · duration ${duration}s · ramp-to-peak ${ramp}s. `}
          A ThreadGroup approximation — not arrivals-accurate.
        </Banner>
      )}

      {mode === 'arrivals' && arrivalsCompiled?.segs?.length > 0 && (
        <div className="opl-curve-segments" aria-live="polite">
          {arrivalsCompiled.segs.map((s, i) => (
            <div key={i}>
              t={s.delay}→{s.delay + s.ramp}s · {s.arrivals} starts · avg {Number(s.avg).toFixed(2)}/s
            </div>
          ))}
        </div>
      )}

      <div className="opl-curve-points">
        {points.map((p, i) => (
          <div className="opl-curve-row" key={i}>
            <Field label="t (s)">
              <Input
                type="number"
                min={0}
                value={p.t ?? 0}
                onChange={(e) => updatePoint(i, { t: Number(e.target.value) })}
                aria-label={`Point ${i + 1} time in seconds`}
              />
            </Field>
            <Field label={mode === 'arrivals' ? 'rate / s' : 'VUs'}>
              <Input
                type="number"
                min={0}
                step={mode === 'arrivals' ? 'any' : 1}
                value={mode === 'arrivals' ? (p.rate ?? 0) : (p.vus ?? 0)}
                onChange={(e) => updatePoint(i, mode === 'arrivals'
                  ? { rate: Number(e.target.value) }
                  : { vus: Number(e.target.value) })}
                aria-label={mode === 'arrivals'
                  ? `Point ${i + 1} arrivals per second`
                  : `Point ${i + 1} virtual users`}
              />
            </Field>
            <Button
              variant="ghost"
              icon={<FiTrash2 />}
              disabled={points.length <= 2}
              onClick={() => removePoint(i)}
              aria-label={`Remove point ${i + 1}`}
            />
          </div>
        ))}
      </div>

      <div className="oui-row">
        <Button icon={<FiPlus />} onClick={addPoint}>Add point</Button>
        {typeof onApplyPeak === 'function' && (
          <Button
            onClick={() => onApplyPeak({
              mode,
              peak: mode === 'arrivals' ? (arrivalsCompiled?.total || peak) : peak,
              duration,
              ramp,
              curve: points,
              totalArrivals: arrivalsCompiled?.total,
              peakRate: mode === 'arrivals' ? peak : undefined,
            })}
            title={mode === 'arrivals'
              ? 'Apply total arrivals + duration from the arrivals curve'
              : 'Apply peak VUs / duration / ramp from the curve'}
          >
            {mode === 'arrivals' ? 'Apply arrivals schedule' : 'Apply to VUs and duration'}
          </Button>
        )}
      </div>
    </div>
  )
}
