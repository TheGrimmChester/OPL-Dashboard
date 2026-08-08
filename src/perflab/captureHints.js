/**
 * Capture-import feedback helpers (pure — safe for unit tests).
 */

/** True when import feedback mentions private / NAS-style hosts (kept on import; dial-pin at run). */
export function mentionsPrivateHosts(...parts) {
  const hay = parts.map((p) => String(p || '').toLowerCase()).join(' ')
  return /private|link-local|192\.168\.|10\.\d|172\.(1[6-9]|2\d|3[01])\.|opa_perf_internal|internal_hosts|blocked url|host not allowed|kept.?private/
    .test(hay)
}

export function asWarningList(warnings) {
  if (!warnings) return []
  if (Array.isArray(warnings)) return warnings.map((w) => String(w)).filter(Boolean)
  return [String(warnings)]
}

/**
 * Sum entries that were dropped (static / OPTIONS / blocked / empty).
 * Lab-private hosts are kept with warnings — do not count `private=N` as skipped.
 */
export function skipTallyFrom(preview, warnings) {
  const skipped = Number(preview?.skipped ?? preview?.skipped_count ?? preview?.skip_count)
  if (Number.isFinite(skipped) && skipped > 0) return skipped
  let total = 0
  for (const w of warnings || []) {
    const s = String(w)
    // Legacy: "skipped N …"
    const legacy = s.match(/skipped\s+(\d+)\b/i)
    if (legacy) {
      total += Number(legacy[1]) || 0
      continue
    }
    // Current: "skipped static=N private=N OPTIONS=N blocked=N empty=N"
    for (const key of ['static', 'OPTIONS', 'blocked', 'empty']) {
      const m = s.match(new RegExp(`${key}=(\\d+)`, 'i'))
      if (m) total += Number(m[1]) || 0
    }
  }
  return total
}
