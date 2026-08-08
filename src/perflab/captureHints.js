/**
 * Capture-import feedback helpers (pure — safe for unit tests).
 */

/** True when import feedback mentions private / NAS-style hosts the URL policy skips. */
export function mentionsPrivateHosts(...parts) {
  const hay = parts.map((p) => String(p || '').toLowerCase()).join(' ')
  return /private|link-local|192\.168\.|10\.\d|172\.(1[6-9]|2\d|3[01])\.|opa_perf_internal|internal_hosts|blocked url|host not allowed/
    .test(hay)
}

export function asWarningList(warnings) {
  if (!warnings) return []
  if (Array.isArray(warnings)) return warnings.map((w) => String(w)).filter(Boolean)
  return [String(warnings)]
}

export function skipTallyFrom(preview, warnings) {
  const skipped = Number(preview?.skipped ?? preview?.skipped_count ?? preview?.skip_count)
  if (Number.isFinite(skipped) && skipped > 0) return skipped
  for (const w of warnings || []) {
    const m = String(w).match(/skipped\s+(\d+)/i)
    if (m) return Number(m[1])
  }
  return 0
}
