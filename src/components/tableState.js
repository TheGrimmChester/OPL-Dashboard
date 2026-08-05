/**
 * Resolve a table's state from one fetch.
 *
 * The whole reason this helper exists: OPL never passed an error anywhere, so a
 * failed request rendered as an empty result set with a cheerful hint — the table
 * said "start a run" when the truth was "the request failed". A table is in
 * exactly one state and the states look different.
 */
export function tableState({ loading, error, rows }) {
  if (loading) return 'loading'
  if (error) return 'error'
  return (rows?.length ?? 0) > 0 ? 'ready' : 'empty'
}
