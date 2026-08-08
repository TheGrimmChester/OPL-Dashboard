/**
 * Pure helpers for the virtual-user tree: path reads/writes, DnD, enable, find/replace.
 * Kept out of React so unit tests can exercise them without mounting VuTree.
 */

/** Path into nested steps: e.g. [0, 'children', 1] */
export function getAtPath(steps, path) {
  let cur = steps
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    if (key === 'children') {
      cur = cur?.children || []
      continue
    }
    cur = Array.isArray(cur) ? cur[key] : undefined
  }
  return cur
}

function setAtPathImmutable(steps, path, updater) {
  if (!path.length) return updater(steps)
  const [head, ...rest] = path
  if (head === 'children') {
    return updater(steps)
  }
  return steps.map((s, i) => {
    if (i !== head) return s
    if (!rest.length) return updater(s)
    if (rest[0] === 'children') {
      const childPath = rest.slice(1)
      const children = Array.isArray(s.children) ? s.children : []
      if (!childPath.length) {
        return { ...s, children: updater(children) }
      }
      return { ...s, children: setAtPathImmutable(children, childPath, updater) }
    }
    return s
  })
}

export function patchStepAt(steps, path, patch) {
  return setAtPathImmutable(steps, path, (node) => {
    if (Array.isArray(node)) return node
    return { ...node, ...patch }
  })
}

export function removeStepAt(steps, path) {
  if (!path.length) return steps
  const idx = path[path.length - 1]
  const parentPath = path.slice(0, -1)
  if (!parentPath.length) {
    return steps.filter((_, i) => i !== idx)
  }
  const withoutIdx = path.slice(0, -1)
  return setAtPathImmutable(steps, withoutIdx, (children) => {
    if (!Array.isArray(children)) return children
    return children.filter((_, i) => i !== idx)
  })
}

export function insertChildAt(steps, parentPath, child) {
  if (!parentPath.length) {
    return [...steps, child]
  }
  return setAtPathImmutable(steps, [...parentPath, 'children'], (children) => {
    const list = Array.isArray(children) ? children : []
    return [...list, child]
  })
}

export function moveStepInList(steps, path, dir) {
  const idx = path[path.length - 1]
  const j = idx + dir
  if (typeof idx !== 'number') return steps
  const parentPath = path.slice(0, -1)
  const rewrite = (list) => {
    if (!Array.isArray(list) || j < 0 || j >= list.length) return list
    const next = [...list]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    return next
  }
  if (!parentPath.length) return rewrite(steps)
  return setAtPathImmutable(steps, parentPath, rewrite)
}

/** True when `descendant` is the same as or nested under `ancestor`. */
function pathIsUnder(descendant, ancestor) {
  if (!ancestor?.length) return false
  if (descendant.length < ancestor.length) return false
  return ancestor.every((v, i) => descendant[i] === v)
}

export function isNestableType(type) {
  const t = type || 'http'
  return t === 'http' || t === 'transaction' || t === 'container'
    || t === 'if' || t === 'while' || t === 'loop' || t === 'foreach'
    || t === 'fragment'
    || t === 'if_controller' || t === 'while_controller' || t === 'loop_controller'
    || t === 'foreach_controller'
}

/**
 * Drag-and-drop move: remove from `fromPath`, insert into sibling list at
 * `toPath` (before that node) or into `intoPath`'s children when dropping on a container.
 */
export function moveStepDnD(steps, fromPath, toPath, mode = 'before') {
  if (!fromPath?.length || !toPath?.length) return steps
  if (fromPath.join('.') === toPath.join('.')) return steps
  if (pathIsUnder(toPath, fromPath)) return steps

  const node = getAtPath(steps, fromPath)
  if (!node || Array.isArray(node)) return steps

  let next = removeStepAt(steps, fromPath)

  const adjustedTo = [...toPath]
  const fromParent = fromPath.slice(0, -1)
  const toParent = toPath.slice(0, -1)
  if (fromParent.join('.') === toParent.join('.')) {
    const fromIdx = fromPath[fromPath.length - 1]
    const toIdx = toPath[toPath.length - 1]
    if (typeof fromIdx === 'number' && typeof toIdx === 'number' && fromIdx < toIdx) {
      adjustedTo[adjustedTo.length - 1] = toIdx - 1
    }
  }

  if (mode === 'into') {
    const parent = getAtPath(next, adjustedTo)
    if (!parent || Array.isArray(parent) || !isNestableType(parent.type)) return steps
    return insertChildAt(next, adjustedTo, structuredClone(node))
  }

  const idx = adjustedTo[adjustedTo.length - 1]
  const parentPath = adjustedTo.slice(0, -1)
  const insertAt = (list) => {
    if (!Array.isArray(list)) return list
    const out = [...list]
    const at = mode === 'after' ? idx + 1 : idx
    out.splice(Math.max(0, Math.min(at, out.length)), 0, structuredClone(node))
    return out
  }
  if (!parentPath.length) return insertAt(next)
  return setAtPathImmutable(next, parentPath, insertAt)
}

/** Set `enabled` on the node at `path`. */
export function setEnabledAt(steps, path, enabled) {
  if (!path?.length) return steps
  return patchStepAt(steps, path, { enabled: !!enabled })
}

function replaceInString(value, find, replace) {
  if (typeof value !== 'string' || !find || !value.includes(find)) {
    return { value, count: 0 }
  }
  const parts = value.split(find)
  return { value: parts.join(replace), count: parts.length - 1 }
}

function replaceInHeaders(headers, find, replace) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    if (!Array.isArray(headers)) return { headers, count: 0 }
    let count = 0
    const next = headers.map((h) => {
      const name = replaceInString(h?.name || '', find, replace)
      const value = replaceInString(h?.value || '', find, replace)
      count += name.count + value.count
      return { ...h, name: name.value, value: value.value }
    })
    return { headers: next, count }
  }
  let count = 0
  const next = {}
  for (const [k, v] of Object.entries(headers)) {
    const key = replaceInString(k, find, replace)
    const val = replaceInString(String(v ?? ''), find, replace)
    count += key.count + val.count
    next[key.value] = val.value
  }
  return { headers: next, count }
}

/**
 * Find/replace across url, headers, body, and name for every node in the tree.
 * Returns `{ steps, count }` where count is the number of field substitutions.
 */
export function replaceInTree(steps, find, replace) {
  if (!find) return { steps, count: 0 }
  let count = 0
  const walk = (nodes) => (nodes || []).map((n) => {
    const next = { ...n }
    for (const f of ['url', 'body', 'name']) {
      const r = replaceInString(next[f], find, replace)
      next[f] = r.value
      count += r.count
    }
    if (next.headers != null) {
      const r = replaceInHeaders(next.headers, find, replace)
      next.headers = r.headers
      count += r.count
    }
    if (next.children) next.children = walk(next.children)
    return next
  })
  return { steps: walk(steps), count }
}

export function collectFragmentNames(steps, out = []) {
  for (const s of steps || []) {
    if (s.type === 'fragment' && s.name) out.push(s.name)
    if (s.children?.length) collectFragmentNames(s.children, out)
  }
  return [...new Set(out)]
}

/** Whether a node (or any descendant) matches the filter query. */
export function matchesFilter(node, q) {
  if (!q) return true
  const needle = q.toLowerCase()
  const headerBits = []
  if (node.headers && typeof node.headers === 'object') {
    if (Array.isArray(node.headers)) {
      for (const h of node.headers) headerBits.push(`${h.name || ''}${h.value || ''}`)
    } else {
      for (const [k, v] of Object.entries(node.headers)) headerBits.push(`${k}${v}`)
    }
  }
  const hay = [node.name, node.url, node.type, node.body, ...headerBits].join(' ').toLowerCase()
  if (hay.includes(needle)) return true
  return (node.children || []).some((c) => matchesFilter(c, q))
}

export function nodeMatchesFilter(node, q) {
  if (!q) return false
  const needle = q.toLowerCase()
  const headerBits = []
  if (node.headers && typeof node.headers === 'object') {
    if (Array.isArray(node.headers)) {
      for (const h of node.headers) headerBits.push(`${h.name || ''}${h.value || ''}`)
    } else {
      for (const [k, v] of Object.entries(node.headers)) headerBits.push(`${k}${v}`)
    }
  }
  const hay = [node.name, node.url, node.type, node.body, ...headerBits].join(' ').toLowerCase()
  return hay.includes(needle)
}

/**
 * Resolve a validation triage item to a tree path.
 * Prefers `triage.path` when present; otherwise best-effort from `triage.index`.
 */
export function resolveTriagePath(steps, triage) {
  if (Array.isArray(triage?.path) && triage.path.length) return triage.path
  const idx = Number(triage?.index)
  if (!Number.isFinite(idx) || idx < 0) return null
  if (Array.isArray(steps) && idx < steps.length) return [idx]
  let flat = 0
  let found = null
  const walk = (nodes, path) => {
    for (let i = 0; i < (nodes || []).length; i++) {
      const p = [...path, i]
      if (flat === idx) {
        found = p
        return true
      }
      flat += 1
      const kids = nodes[i]?.children
      if (kids?.length && walk(kids, [...p, 'children'])) return true
    }
    return false
  }
  walk(steps, [])
  return found
}
