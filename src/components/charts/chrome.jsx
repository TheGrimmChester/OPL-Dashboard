import React, { useEffect, useRef, useState } from 'react'

/**
 * Shared chart chrome. The kit ships the CSS (`oui-chart*`), the palette and the
 * mark specs; the marks themselves are drawn here because OPL's charts are
 * hand-rolled SVG and stay that way.
 *
 * Series colours come from `--chart-1` … `--chart-8`, assigned in fixed order and
 * never cycled, so a theme switch is free and the palette matches every sibling
 * dashboard. Axis and value text wears text tokens, never a series colour.
 */

/** Charts render at their real pixel width so one SVG unit is one CSS pixel —
 *  scaling a fixed viewBox into a narrow card shrinks the axis text with it. */
export function useMeasuredWidth(fallback = 640) {
  const ref = useRef(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0].contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10
  const out = []
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v)
  return out
}

/**
 * An axis label for one run.
 *
 * Run identifiers share a long prefix, so truncating from the front produces a
 * row of identical labels that tell the reader nothing. Take the distinguishing
 * tail instead, and keep the full identifier for the hover readout and the table
 * view, where there is room for it.
 */
export function runTick(point, index) {
  const id = String(point?.id ?? '')
  if (!id) return String(index + 1)
  const tail = id.split('-').pop()
  return tail && tail.length <= 8 ? tail : id.slice(-8)
}

export const compact = (n) => {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(v % 1e3 ? 1 : 0)}k`
  return String(Math.round(v * 100) / 100)
}

/**
 * A legend is present whenever there are two or more series — colour is never the
 * only identity channel. One series is named by the card title and gets no box.
 */
export function ChartLegend({ series, lineStyle = false }) {
  if (series.length < 2) return null
  return (
    <div className="oui-chart-legend">
      {series.map((s) => (
        <span className="oui-chart-legend-item" key={s.key}>
          <span
            className={`oui-chart-swatch${lineStyle ? ' is-line' : ''}`}
            style={{ background: s.color }}
          />
          {s.label}
        </span>
      ))}
    </div>
  )
}

/**
 * The table view. Three light-mode categorical slots sit below 3:1 on the light
 * surface, so every chart that uses them ships direct labels *and* a way to read
 * the numbers as text.
 */
export function ChartTable({ rows, series, xLabel, xOf, format = compact }) {
  return (
    <div className="oui-table-wrap">
      <table className="oui-table is-compact">
        <thead>
          <tr>
            <th>{xLabel}</th>
            {series.map((s) => <th key={s.key} className="oui-cell-num">{s.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={xOf(row, i)}>
              <td className="oui-cell-mono">{xOf(row, i)}</td>
              {series.map((s) => (
                <td key={s.key} className="oui-cell-num">{format(row[s.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
