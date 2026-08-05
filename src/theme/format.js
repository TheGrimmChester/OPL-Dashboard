// Shared value formatters. Every metric render goes through these so units and
// rounding are uniform across the lab.
//
// The colour helpers that used to live here are gone: they mapped statuses onto
// `--ok` / `--warn` / `--error` and series onto `--series-1…8` and `--tier-*`,
// none of which exist any more. Status ink is now a `Badge` tone and series
// colour comes from `--chart-1` … `--chart-8`, both theme-resolved.

export function fmtNum(v) {
  if (v == null || isNaN(v)) return '—'
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}k`
  return `${Math.round(v)}`
}

// Relative time for "last seen" style columns.
// API timestamps are naive UTC ("YYYY-MM-DD HH:MM:SS[.mmm]"). Date.parse reads
// that space-separated form as LOCAL time, skewing "ago" by the viewer's UTC
// offset (a just-created row shows "2h ago" in UTC+2). Mark it UTC so it is
// parsed correctly; leave numbers and already-zoned ISO strings untouched.
export function toUtcIso(ts) {
  if (typeof ts !== 'string') return ts
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(ts) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(ts)) {
    return `${ts.replace(' ', 'T')}Z`
  }
  return ts
}

export function fmtAgo(ts) {
  if (!ts) return '—'
  const t = typeof ts === 'number' ? ts : Date.parse(toUtcIso(ts))
  // Treat missing / epoch-zero sentinels (e.g. "1970-01-01 00:00:00") as no data
  // rather than rendering a nonsensical "20000d ago".
  if (isNaN(t) || t < 946684800000) return '—'
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return `${Math.floor(s)}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
