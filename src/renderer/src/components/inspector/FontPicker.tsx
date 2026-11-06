import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { strokeSample } from '@core/text/strokeWriting'
import type { StrokeFontBundle } from '@core/text/strokeFont'

/**
 * A word drawn by the font itself, so each row previews the handwriting it
 * will produce rather than a plain text label.
 */
function StrokePreview({
  font,
  text,
  height
}: {
  font: StrokeFontBundle
  text: string
  height: number
}): JSX.Element | null {
  const plan = useMemo(() => strokeSample(font, text, height * 1.2), [font, text, height])
  const bounds = plan.bounds
  if (plan.strokes.length === 0 || bounds.width <= 0 || bounds.height <= 0) return null
  return (
    <svg
      className="font-preview"
      viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
      width={(bounds.width / bounds.height) * height}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {plan.strokes.map((stroke) => (
        <path
          key={stroke.id}
          d={stroke.d}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

export function FontPicker({
  label,
  value,
  fonts,
  customIds,
  onChange
}: {
  label: string
  value: string
  fonts: StrokeFontBundle[]
  customIds: ReadonlySet<string>
  onChange: (id: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)

  const selected = fonts.find((font) => font.id === value) ?? fonts[0]
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const list = needle
      ? fonts.filter(
          (font) =>
            font.family.toLowerCase().includes(needle) || font.id.toLowerCase().includes(needle)
        )
      : fonts
    return [...list].sort((a, b) => a.family.localeCompare(b.family))
  }, [fonts, query])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', dismiss)
    return () => window.removeEventListener('pointerdown', dismiss)
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
    else setQuery('')
  }, [open])

  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(0, matches.length - 1)))
  }, [matches.length])

  useEffect(() => {
    if (!open) return
    const row = listRef.current?.children[active]
    row?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const choose = (id: string): void => {
    onChange(id)
    setOpen(false)
  }

  return (
    <div className="field font-picker" ref={rootRef}>
      <span className="field-label">{label}</span>
      <button
        type="button"
        className="select-input font-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((state) => !state)}
      >
        <span className="font-picker-current">
          {selected ? <StrokePreview font={selected} text={selected.family} height={17} /> : null}
          <span className="font-picker-current-name">{selected?.family ?? 'No font'}</span>
        </span>
        <ChevronDown size={13} />
      </button>

      {open ? (
        <div className="font-picker-pop" role="dialog" aria-label={label}>
          <div className="font-picker-search">
            <Search size={12} />
            <input
              ref={searchRef}
              className="text-input font-picker-query"
              type="text"
              placeholder="Search fonts…"
              role="combobox"
              aria-expanded="true"
              aria-controls="font-picker-list"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActive((index) => Math.min(index + 1, matches.length - 1))
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActive((index) => Math.max(index - 1, 0))
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  const font = matches[active]
                  if (font) choose(font.id)
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setOpen(false)
                }
              }}
            />
          </div>
          <div className="font-picker-list" id="font-picker-list" role="listbox" ref={listRef}>
            {matches.map((font, index) => (
              <button
                type="button"
                key={font.id}
                role="option"
                aria-selected={font.id === value}
                className={`font-picker-row ${font.id === value ? 'selected' : ''} ${
                  index === active ? 'active' : ''
                }`}
                onPointerEnter={() => setActive(index)}
                onClick={() => choose(font.id)}
              >
                <StrokePreview font={font} text={font.family} height={22} />
                <span className="font-picker-tail">
                  {customIds.has(font.id) ? <span className="font-picker-tag">custom</span> : null}
                  {font.id === value ? <Check size={13} /> : null}
                </span>
              </button>
            ))}
            {matches.length === 0 ? <p className="font-picker-empty">No font matches “{query}”.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
