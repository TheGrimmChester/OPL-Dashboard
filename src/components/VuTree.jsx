import React, { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiArrowDown, FiArrowUp, FiChevronDown, FiChevronRight, FiPlus, FiTrash2,
} from 'react-icons/fi'
import { Button, EmptyState, Input } from '@open-family/ui'
import { ESSENTIAL_STEP_TYPES, LOGIC_STEP_TYPES, makeNode } from '../perflab/model'
import {
  getAtPath,
  insertChildAt,
  isNestableType,
  matchesFilter,
  moveStepDnD,
  moveStepInList,
  nodeMatchesFilter,
  removeStepAt,
  replaceInTree,
  setEnabledAt,
} from '../perflab/treeOps'

export {
  getAtPath,
  patchStepAt,
  removeStepAt,
  insertChildAt,
  moveStepInList,
  moveStepDnD,
} from '../perflab/treeOps'

const TYPE_LABELS = {
  http: 'HTTP',
  transaction: 'Txn',
  container: 'Txn',
  extract: 'Extract',
  assert: 'Assert',
  if: 'If',
  if_controller: 'If',
  while: 'While',
  while_controller: 'While',
  loop: 'Loop',
  loop_controller: 'Loop',
  foreach: 'ForEach',
  foreach_controller: 'ForEach',
  for_each: 'ForEach',
  fragment: 'Frag',
  include: 'Link',
  link: 'Link',
  rendezvous: 'Burst',
}

function typeLabel(step) {
  const t = step?.type || 'http'
  if (TYPE_LABELS[t]) return TYPE_LABELS[t]
  return (step?.method || 'HTTP').toUpperCase()
}

function TreeNode({
  step, path, depth, selectedPath, onSelect, expanded, onToggle,
  dragPath, setDragPath, onDropMove, filter,
}) {
  const key = path.join('.')
  const isSel = selectedPath && selectedPath.join('.') === key
  const kids = Array.isArray(step.children) ? step.children : []
  const canNest = isNestableType(step.type)
  const open = expanded[key] !== false
  const [dropMode, setDropMode] = useState(null)
  const hit = filter && nodeMatchesFilter(step, filter)
  const hidden = filter && !matchesFilter(step, filter)
  if (hidden) return null

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

  const disabled = step.enabled === false

  return (
    <div className="opl-vu-node" data-depth={depth}>
      <button
        type="button"
        className={[
          'opl-vu-row',
          isSel ? 'is-selected' : '',
          dropMode ? `is-drop-${dropMode}` : '',
          disabled ? 'is-off' : '',
          hit ? 'is-hit' : '',
        ].filter(Boolean).join(' ')}
        aria-current={isSel ? 'true' : undefined}
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
            className="opl-vu-twist"
            onClick={(e) => { e.stopPropagation(); onToggle(key) }}
            role="presentation"
          >
            {open ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
          </span>
        ) : <span className="opl-vu-twist is-spacer" />}
        <span className={`opl-vu-badge is-${(step.type || 'http').replace('_controller', '')}`}>{typeLabel(step)}</span>
        <span className="opl-vu-name">
          {step.name || step.url || '(unnamed)'}
          {disabled ? ' · disabled' : ''}
        </span>
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
          filter={filter}
        />
      ))}
    </div>
  )
}

/**
 * JMeter visual test case editor — VU tree.
 * Nested journey tree with DnD reorder, Essentials vs Logic palette, filter, and find/replace.
 */
export default function VuTree({
  steps,
  selectedPath,
  onSelect,
  onChange,
  expanded,
  setExpanded,
}) {
  const navigate = useNavigate()
  const roots = useMemo(() => (Array.isArray(steps) ? steps : []), [steps])
  const [dragPath, setDragPath] = useState(null)
  const [showLogic, setShowLogic] = useState(false)
  const [filter, setFilter] = useState('')
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
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
    if (['if', 'while', 'loop', 'foreach', 'fragment', 'transaction', 'http', 'include', 'rendezvous'].includes(type) && isNestableType(ptype)) {
      onChange(insertChildAt(roots, parentPath, makeNode(type)))
      return
    }
    if ((type === 'extract' || type === 'assert') && ptype === 'http') {
      onChange(insertChildAt(roots, parentPath, makeNode(type)))
      return
    }
    addRoot(type)
  }

  const addType = (type) => {
    if (type === 'extract' || type === 'assert' || type === 'rendezvous') addChild(type)
    else addRoot(type)
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

  const setSelectedEnabled = (enabled) => {
    if (!selectedPath?.length) return
    onChange(setEnabledAt(roots, selectedPath, enabled))
  }

  const runReplace = () => {
    if (!find) return
    const { steps: next } = replaceInTree(roots, find, replace)
    onChange(next)
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

  const addLabels = {
    http: 'HTTP',
    transaction: 'Txn',
    extract: 'Extract',
    assert: 'Assert',
    if: 'If',
    while: 'While',
    loop: 'Loop',
    foreach: 'ForEach',
    fragment: 'Frag',
    include: 'Link',
    rendezvous: 'Burst',
  }

  return (
    <div className="opl-vu">
      <div className="opl-vu-toolbar">
        {ESSENTIAL_STEP_TYPES.map((t) => (
          <Button key={t} size="sm" icon={<FiPlus />} onClick={() => addType(t)} title={`Add ${addLabels[t]}`}>
            {addLabels[t]}
          </Button>
        ))}
        <Button
          size="sm"
          variant={showLogic ? 'primary' : 'ghost'}
          onClick={() => setShowLogic((v) => !v)}
        >
          {showLogic ? 'Hide logic' : 'Logic & reuse'}
        </Button>
        {showLogic && LOGIC_STEP_TYPES.map((t) => (
          <Button key={t} size="sm" variant="ghost" onClick={() => addType(t)} title={`Add ${addLabels[t]}`}>
            {addLabels[t]}
          </Button>
        ))}
        <span className="oui-spacer" />
        <Input
          className="opl-vu-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter name, URL, header…"
          aria-label="Filter tree"
        />
      </div>

      <div className="opl-vu-toolbar">
        <Button size="sm" variant="ghost" disabled={!selectedPath} onClick={() => setSelectedEnabled(false)}>
          Disable
        </Button>
        <Button size="sm" variant="ghost" disabled={!selectedPath} onClick={() => setSelectedEnabled(true)}>
          Enable
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setReplaceOpen((v) => !v)}>
          Find / replace
        </Button>
        <span className="oui-spacer" />
        <Button size="sm" variant="ghost" aria-label="Move selected node up" icon={<FiArrowUp />} disabled={!selectedPath} onClick={() => moveSelected(-1)} />
        <Button size="sm" variant="ghost" aria-label="Move selected node down" icon={<FiArrowDown />} disabled={!selectedPath} onClick={() => moveSelected(1)} />
        <Button size="sm" variant="ghost" aria-label="Remove selected node" icon={<FiTrash2 />} disabled={!selectedPath} onClick={removeSelected} />
      </div>

      {replaceOpen && (
        <div className="opl-vu-toolbar">
          <Input
            className="opl-vu-filter"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find in URL / headers / body / name"
            aria-label="Find text"
          />
          <Input
            className="opl-vu-filter"
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Replace with"
            aria-label="Replace text"
          />
          <Button size="sm" variant="primary" disabled={!find} onClick={runReplace}>
            Replace all
          </Button>
        </div>
      )}

      <p className="oui-text-sm oui-text-muted opl-vu-hint">
        Drag a row to reorder it, or drop it onto an If / While / Loop / ForEach / Txn / Frag / HTTP
        row to nest it inside. Fragments are definitions kept once in the plan; Link references one by
        name. Burst holds threads until the group fills, then releases them together.
      </p>

      {!roots.length ? (
        <EmptyState
          inline
          title="Start a journey"
          description="Pick how you want to build the virtual-user tree for this project."
          actions={(
            <>
              <Button variant="primary" onClick={() => addRoot('http')}>Blank HTTP journey</Button>
              <Button onClick={() => navigate('/scenarios/capture')}>Import capture (HAR / Postman)</Button>
              <Button onClick={() => navigate('/scenarios/jmx')}>Upload / paste JMX</Button>
            </>
          )}
        />
      ) : (
        <div
          className="opl-vu-list"
          ref={listRef}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            if (dragPath?.length) {
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
              filter={filter}
            />
          ))}
        </div>
      )}
    </div>
  )
}
