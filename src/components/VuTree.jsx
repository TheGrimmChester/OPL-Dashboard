import React, { useMemo } from 'react'
import { FiChevronDown, FiChevronRight, FiPlus, FiTrash2 } from 'react-icons/fi'

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

export function updateAtPath(steps, path, patchOrFn) {
  const clone = structuredClone(steps)
  if (!path.length) return typeof patchOrFn === 'function' ? patchOrFn(clone) : clone
  let parent = clone
  let listPath = []
  for (let i = 0; i < path.length; i++) {
    const key = path[i]
    if (key === 'children') {
      listPath = path.slice(0, i)
      continue
    }
    if (i === path.length - 1) {
      const idx = key
      const list = listPath.length ? getAtPath(clone, [...listPath, 'children']) : clone
      const targetParent = listPath.length ? getAtPath(clone, listPath) : null
      const arr = listPath.length ? (targetParent.children || (targetParent.children = [])) : clone
      const next = typeof patchOrFn === 'function' ? patchOrFn(arr[idx]) : { ...arr[idx], ...patchOrFn }
      arr[idx] = next
      return clone
    }
    if (key === 'children') continue
    parent = Array.isArray(parent) ? parent[key] : parent
  }
  // Fallback simple top-level update
  const idx = path[path.length - 1]
  if (typeof idx === 'number' && path.length === 1) {
    clone[idx] = typeof patchOrFn === 'function' ? patchOrFn(clone[idx]) : { ...clone[idx], ...patchOrFn }
  }
  return clone
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
  // parentPath ends with ... 'children' conceptually: [0, 'children'] before idx
  // Our paths are like [0, 'children', 1]
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

function typeLabel(step) {
  const t = step?.type || 'http'
  if (t === 'container' || t === 'transaction') return 'Txn'
  if (t === 'extract') return 'Extract'
  if (t === 'assert') return 'Assert'
  return (step?.method || 'HTTP').toUpperCase()
}

function TreeNode({ step, path, depth, selectedPath, onSelect, expanded, onToggle }) {
  const key = path.join('.')
  const isSel = selectedPath && selectedPath.join('.') === key
  const kids = Array.isArray(step.children) ? step.children : []
  const canNest = (step.type || 'http') === 'http' || step.type === 'container' || step.type === 'transaction'
  // Default expanded unless explicitly collapsed
  const open = expanded[key] !== false
  return (
    <div className="vu-tree-node" style={{ marginLeft: depth * 12 }}>
      <button
        type="button"
        className={`vu-tree-row ${isSel ? 'selected' : ''}`}
        onClick={() => onSelect(path)}
      >
        {canNest && kids.length > 0 ? (
          <span
            className="vu-tree-twist"
            onClick={(e) => { e.stopPropagation(); onToggle(key) }}
            role="presentation"
          >
            {open ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
          </span>
        ) : <span className="vu-tree-twist spacer" />}
        <span className={`vu-tree-badge type-${step.type || 'http'}`}>{typeLabel(step)}</span>
        <span className="vu-tree-name">{step.name || step.url || '(unnamed)'}</span>
      </button>
      {canNest && open && kids.map((child, i) => (
        <TreeNode
          key={`${key}-${i}`}
          step={child}
          path={[...path, 'children', i]}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </div>
  )
}

/**
 * JMeter visual test case editor — VU tree.
 * Left: nested journey tree. Selection drives the inspector in the parent.
 */
export default function VuTree({
  steps,
  selectedPath,
  onSelect,
  onChange,
  expanded,
  setExpanded,
}) {
  const roots = useMemo(() => (Array.isArray(steps) ? steps : []), [steps])

  const addRoot = (type) => {
    const child = type === 'http'
      ? { type: 'http', name: 'Request', method: 'GET', url: '', body: '', think_ms: 50, headers: {}, children: [] }
      : type === 'container' || type === 'transaction'
        ? { type: 'transaction', name: 'Transaction', children: [] }
        : type === 'extract'
          ? { type: 'extract', name: 'Extract', engine: 'regex', expression: '', var: 'token' }
          : { type: 'assert', name: 'Assert', status: 200, body_contains: '' }
    onChange([...roots, child])
  }

  const addChild = (type) => {
    if (!selectedPath?.length) {
      addRoot(type)
      return
    }
    const node = getAtPath(roots, selectedPath)
    const ntype = node?.type || 'http'
    const parentPath = (ntype === 'http' || ntype === 'container' || ntype === 'transaction')
      ? selectedPath
      : selectedPath.slice(0, -1)
    const child = type === 'extract'
      ? { type: 'extract', name: 'Extract', engine: 'regex', expression: '', var: 'token' }
      : type === 'assert'
        ? { type: 'assert', name: 'Assert', status: 200, body_contains: '' }
        : type === 'http'
          ? { type: 'http', name: 'Request', method: 'GET', url: '', body: '', think_ms: 50, headers: {}, children: [] }
          : { type: 'transaction', name: 'Transaction', children: [] }
    // Nest extract/assert under HTTP; nest HTTP under transaction
    const parent = getAtPath(roots, parentPath)
    const ptype = parent?.type || 'http'
    if ((type === 'extract' || type === 'assert') && ptype !== 'http') {
      addRoot(type)
      return
    }
    if (type === 'http' && ptype !== 'transaction' && ptype !== 'container') {
      addRoot(type)
      return
    }
    onChange(insertChildAt(roots, parentPath, child))
  }

  const removeSelected = () => {
    if (!selectedPath?.length) return
    onChange(removeStepAt(roots, selectedPath))
    onSelect(null)
  }

  const moveSelected = (dir) => {
    if (!selectedPath?.length) return
    onChange(moveStepInList(roots, selectedPath, dir))
  }

  const toggleExpand = (k) => {
    setExpanded((e) => {
      const currentlyOpen = e[k] !== false
      return { ...e, [k]: currentlyOpen ? false : true }
    })
  }

  return (
    <div className="vu-tree">
      <div className="vu-tree-toolbar">
        <button type="button" className="opa-btn ghost" onClick={() => addRoot('http')} title="Add HTTP request"><FiPlus size={12} /> HTTP</button>
        <button type="button" className="opa-btn ghost" onClick={() => addRoot('transaction')} title="Add transaction container"><FiPlus size={12} /> Txn</button>
        <button type="button" className="opa-btn ghost" onClick={() => addChild('extract')} title="Nest extract under selected HTTP">Extract</button>
        <button type="button" className="opa-btn ghost" onClick={() => addChild('assert')} title="Nest assert under selected HTTP">Assert</button>
        <button type="button" className="opa-btn ghost" disabled={!selectedPath} onClick={() => moveSelected(-1)} aria-label="Move up">↑</button>
        <button type="button" className="opa-btn ghost" disabled={!selectedPath} onClick={() => moveSelected(1)} aria-label="Move down">↓</button>
        <button type="button" className="opa-btn ghost" disabled={!selectedPath} onClick={removeSelected} aria-label="Remove"><FiTrash2 size={12} /></button>
      </div>
      <p className="perf-hint" style={{ margin: '0 0 8px' }}>
        JMeter visual test case editor — VU tree: nest extractors/asserts under HTTP; transactions group requests. Saves to steps_json → JMX hashTree.
      </p>
      {!roots.length ? (
        <div className="perf-empty-cta">
          <div className="title">Empty virtual user</div>
          <div className="perf-hint">Add an HTTP request or Transaction to start the journey tree.</div>
        </div>
      ) : (
        <div className="vu-tree-list">
          {roots.map((step, i) => (
            <TreeNode
              key={`root-${i}`}
              step={step}
              path={[i]}
              depth={0}
              selectedPath={selectedPath}
              onSelect={onSelect}
              expanded={expanded}
              onToggle={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  )
}
