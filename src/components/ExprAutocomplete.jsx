import React, { useMemo, useRef, useState } from 'react'
import { Input, Textarea } from '@open-family/ui'
import {
  autocompleteQuery,
  applyAutocompleteInsert,
  buildAutocompleteCatalog,
} from '../perflab/knownVars'

/**
 * Expression / binder autocomplete over Input or Textarea.
 * mode=expr opens on `${` (or Ctrl/Cmd-Space); mode=bind suggests bare names on focus/type.
 */
export default function ExprAutocomplete({
  mode = 'expr',
  knownVars = [],
  as = 'input',
  value = '',
  onChange,
  className = '',
  hint,
  ...rest
}) {
  const fieldRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [query, setQuery] = useState('')

  const items = useMemo(
    () => (open ? buildAutocompleteCatalog(mode, knownVars, query) : []),
    [open, mode, knownVars, query],
  )

  const refresh = (nextValue, caret) => {
    const q = autocompleteQuery(nextValue, caret, mode)
    if (mode === 'expr' && q === null) {
      setOpen(false)
      setQuery('')
      return
    }
    setQuery(q === null ? '' : q)
    setActive(0)
    setOpen(true)
  }

  const commit = (item) => {
    if (!item) return
    const el = fieldRef.current
    const caret = el && typeof el.selectionStart === 'number' ? el.selectionStart : String(value || '').length
    const next = applyAutocompleteInsert(value, caret, mode, item.insert)
    onChange?.({ target: { value: next.value } })
    setOpen(false)
    requestAnimationFrame(() => {
      if (el) {
        el.focus()
        try { el.setSelectionRange(next.caret, next.caret) } catch { /* ignore */ }
      }
    })
  }

  const onInput = (e) => {
    onChange?.(e)
    const el = e.target
    refresh(el.value, el.selectionStart)
  }

  const onFocus = (e) => {
    rest.onFocus?.(e)
    if (mode === 'bind') refresh(e.target.value, e.target.selectionStart)
    else if (String(e.target.value || '').includes('${')) refresh(e.target.value, e.target.selectionStart)
  }

  const onBlur = (e) => {
    rest.onBlur?.(e)
    setTimeout(() => setOpen(false), 120)
  }

  const onKeyDown = (e) => {
    rest.onKeyDown?.(e)
    if ((!open || !items.length) && (e.key === ' ' || e.code === 'Space') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      const el = e.target
      if (mode === 'expr' && autocompleteQuery(el.value, el.selectionStart, mode) === null) {
        const caret = el.selectionStart || 0
        const next = `${el.value.slice(0, caret)}\${${el.value.slice(caret)}`
        onChange?.({ target: { value: next } })
        requestAnimationFrame(() => {
          try { el.setSelectionRange(caret + 2, caret + 2) } catch { /* ignore */ }
          refresh(next, caret + 2)
        })
        return
      }
      refresh(el.value, el.selectionStart)
      return
    }
    if (!open || !items.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + items.length) % items.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      commit(items[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const Control = as === 'textarea' ? Textarea : Input
  const groups = {}
  for (const it of items) {
    (groups[it.group] ||= []).push(it)
  }

  let idx = 0
  return (
    <div className="opl-ac-wrap">
      <Control
        {...rest}
        ref={fieldRef}
        className={className || undefined}
        value={value}
        onChange={onInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
      {hint ? <span className="opl-ac-hint">{hint}</span> : null}
      {open && items.length > 0 && (
        <ul className="opl-ac-list" role="listbox" aria-label="Variable and expression suggestions">
          {Object.entries(groups).map(([g, arr]) => (
            <React.Fragment key={g}>
              <li className="opl-ac-group">{g}</li>
              {arr.map((it) => {
                const i = idx++
                return (
                  <li key={`${g}-${it.insert}-${i}`}>
                    <button
                      type="button"
                      className={`opl-ac-item${i === active ? ' is-active' : ''}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(ev) => {
                        ev.preventDefault()
                        commit(it)
                      }}
                    >
                      <code>{it.insert}</code>
                      <span className="opl-ac-item-hint">{it.hint}</span>
                    </button>
                  </li>
                )
              })}
            </React.Fragment>
          ))}
        </ul>
      )}
    </div>
  )
}
