import React, { useMemo, useRef, useState } from 'react'
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

/**
 * Drag-and-drop move: remove from `fromPath`, insert into sibling list at
 * `toPath` (before that node) or into `intoPath`'s children when dropping on a container.
 */
export function moveStepDnD(steps, fromPath, toPath, mode = 'before') {
  if (!fromPath?.length || !toPath?.length) return steps
  if (fromPath.join('.') === toPath.join('.')) return steps
  if (pathIsUnder(toPath, fromPath)) return steps // cannot drop into self/descendant

  const node = getAtPath(steps, fromPath)
  if (!node || Array.isArray(node)) return steps

  let next = removeStepAt(steps, fromPath)

  // Adjust toPath indices if we removed an earlier sibling in the same list.
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

function isNestableType(type) {
  const t = type || 'http'
  return t === 'http' || t === 'transaction' || t === 'container'
    || t === 'if' || t === 'while' || t === 'loop' || t === 'foreach'
    || t === 'fragment'
    || t === 'if_controller' || t === 'while_controller' || t === 'loop_controller'
    || t === 'foreach_controller'
}

function typeLabel(step) {
  const t = step?.type || 'http'
  if (t === 'container' || t === 'transaction') return 'Txn'
  if (t === 'extract') return 'Extract'
  if (t === 'assert') return 'Assert'
  if (t === 'if' || t === 'if_controller') return 'If'
  if (t === 'while' || t === 'while_controller') return 'While'
  if (t === 'loop' || t === 'loop_controller') return 'Loop'
  if (t === 'foreach' || t === 'foreach_controller' || t === 'for_each') return 'ForEach'
  if (t === 'fragment') return 'Frag'
  if (t === 'include' || t === 'link') return 'Link'
  return (step?.method || 'HTTP').toUpperCase()
}

function makeNode(type) {
  if (type === 'http') {
    return { type: 'http', name: 'Request', method: 'GET', url: '', body: '', think_ms: 50, headers: {}, children: [] }
  }
  if (type === 'container' || type === 'transaction') {
    return { type: 'transaction', name: 'Transaction', children: [] }
  }
  if (type === 'if') {
    return { type: 'if', name: 'If', condition: '${__jexl3(true)}', children: [] }
  }
  if (type === 'while') {
    return { type: 'while', name: 'While', condition: '${__jexl3(false)}', children: [] }
  }
  if (type === 'loop') {
    return { type: 'loop', name: 'Loop', loops: 2, forever: false, children: [] }
  }
  if (type === 'foreach') {
    return { type: 'foreach', name: 'ForEach', input_var: 'items', return_var: 'item', use_separator: true, children: [] }
  }
  if (type === 'fragment') {
    return { type: 'fragment', name: 'SharedFragment', children: [] }
  }
  if (type === 'include' || type === 'link') {
    return { type: 'include', name: 'Include', ref: 'SharedFragment' }
  }
  if (type === 'extract') {
    return { type: 'extract', name: 'Extract', engine: 'regex', expression: '', var: 'token' }
  }
  return { type: 'assert', name: 'Assert', status: 200, body_contains: '' }
}

function TreeNode({
  step, path, depth, selectedPath, onSelect, expanded, onToggle,
  dragPath, setDragPath, onDropMove,
}) {
  const key = path.join('.')
  const isSel = selectedPath && selectedPath.join('.') === key
  const kids = Array.isArray(step.children) ? step.children : []
  const canNest = isNestableType(step.type)
  const open = expanded[key] !== false
  const [dropMode, setDropMode] = useState(null)

  const onDragStart = (e) => {
    e.stopPropagation()
    setDragPath(path)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
  }
  const onDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!dragPath?.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const third = rect.height / 3
    if (canNest && y > third && y < 2 * third) setDropMode('into')
    else if (y < rect.height / 2) setDropMode('before')
    else setDropMode('after')
  }
  const onDragLeave = () => setDropMode(null)
  const onDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const mode = dropMode || 'before'
    setDropMode(null)
    if (dragPath?.length) onDropMove(dragPath, path, mode)
    setDragPath(null)
  }

  return (
    <div className="vu-tree-node" style={{ marginLeft: depth * 12 }}>
      <button
        type="button"
        className={`vu-tree-row ${isSel ? 'selected' : ''} ${dropMode ? `drop-${dropMode}` : ''}`}
        onClick={() => onSelect(path)}
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={() => { setDragPath(null); setDropMode(null) }}
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
        <span className={`vu-tree-badge type-${(step.type || 'http').replace('_controller', '')}`}>{typeLabel(step)}</span>
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
          dragPath={dragPath}
          setDragPath={setDragPath}
          onDropMove={onDropMove}
        />
      ))}
    </div>
  )
}

/**
 * JMeter visual test case editor — VU tree.
 * Nested journey tree with DnD reorder and If/While/Loop controllers.
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
  const [dragPath, setDragPath] = useState(null)
  const listRef = useRef(null)

  const addRoot = (type) => {
    onChange([...roots, makeNode(type)])
  }

  const addChild = (type) => {
    if (!selectedPath?.length) {
      addRoot(type)
      return
    }
    const node = getAtPath(roots, selectedPath)
    const ntype = node?.type || 'http'
    let parentPath = selectedPath
    if (!isNestableType(ntype)) {
      parentPath = selectedPath.slice(0, -1)
      if (parentPath[parentPath.length - 1] === 'children') {
        parentPath = parentPath.slice(0, -1)
      }
    }
    const parent = getAtPath(roots, parentPath)
    const ptype = parent?.type || 'http'
    if ((type === 'extract' || type === 'assert') && ptype !== 'http') {
      addRoot(type)
      return
    }
    if (type === 'http' && !isNestableType(ptype)) {
      addRoot(type)
      return
    }
    // Nest HTTP under txn/if/while/loop/foreach/fragment; nest extract/assert under HTTP; nest controllers under nestable.
    if (['if', 'while', 'loop', 'foreach', 'fragment', 'transaction', 'http', 'include'].includes(type) && isNestableType(ptype)) {
      onChange(insertChildAt(roots, parentPath, makeNode(type)))
      return
    }
    if ((type === 'extract' || type === 'assert') && ptype === 'http') {
      onChange(insertChildAt(roots, parentPath, makeNode(type)))
      return
    }
    addRoot(type)
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

  const onDropMove = (from, to, mode) => {
    onChange(moveStepDnD(roots, from, to, mode))
    setDragPath(null)
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
        <button type="button" className="opa-btn ghost" onClick={() => addRoot('if')} title="Add If controller">If</button>
        <button type="button" className="opa-btn ghost" onClick={() => addRoot('while')} title="Add While controller">While</button>
        <button type="button" className="opa-btn ghost" onClick={() => addRoot('loop')} title="Add Loop controller">Loop</button>
        <button type="button" className="opa-btn ghost" onClick={() => addRoot('foreach')} title="Add ForEach controller">ForEach</button>
        <button type="button" className="opa-btn ghost" onClick={() => addRoot('fragment')} title="Add reusable fragment">Frag</button>
        <button type="button" className="opa-btn ghost" onClick={() => addRoot('include')} title="Link to a named fragment">Link</button>
        <button type="button" className="opa-btn ghost" onClick={() => addChild('extract')} title="Nest extract under selected HTTP">Extract</button>
        <button type="button" className="opa-btn ghost" onClick={() => addChild('assert')} title="Nest assert under selected HTTP">Assert</button>
        <button type="button" className="opa-btn ghost" disabled={!selectedPath} onClick={() => moveSelected(-1)} aria-label="Move up">↑</button>
        <button type="button" className="opa-btn ghost" disabled={!selectedPath} onClick={() => moveSelected(1)} aria-label="Move down">↓</button>
        <button type="button" className="opa-btn ghost" disabled={!selectedPath} onClick={removeSelected} aria-label="Remove"><FiTrash2 size={12} /></button>
      </div>
      <p className="perf-hint" style={{ margin: '0 0 8px' }}>
        Drag to reorder (or drop onto If/While/Loop/ForEach/Txn/Frag/HTTP to nest). Fragments are definitions; Link expands them. Controllers round-trip through JMX.
      </p>
      {!roots.length ? (
        <div className="perf-empty-cta">
          <div className="title">Empty virtual user</div>
          <div className="perf-hint">Add an HTTP request, Transaction, or logic controller to start the journey tree.</div>
        </div>
      ) : (
        <div
          className="vu-tree-list"
          ref={listRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (dragPath?.length) {
              // Drop on empty list area → move to end of roots
              onChange(moveStepDnD(roots, dragPath, [roots.length - 1], 'after'))
              setDragPath(null)
            }
          }}
        >
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
              dragPath={dragPath}
              setDragPath={setDragPath}
              onDropMove={onDropMove}
            />
          ))}
        </div>
      )}
    </div>
  )
}
