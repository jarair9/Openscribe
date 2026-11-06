import { useEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode } from 'react'
import { Check, ChevronDown, Info, Minus, Plus } from 'lucide-react'
import { clamp } from '@core/math'

export function Section({
  title,
  hint,
  actions,
  children,
  defaultOpen = true
}: {
  title: string
  /** Explained in a tooltip on the ⓘ marker, the way VideoScribe labels its groups. */
  hint?: string
  actions?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`section ${open ? '' : 'collapsed'}`}>
      <div className="section-head">
        <button
          className="section-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronDown size={13} className="section-chevron" />
          <span className="section-title">{title}</span>
          {hint ? (
            <span className="section-hint" title={hint} role="img" aria-label={hint}>
              <Info size={12} />
            </span>
          ) : null}
        </button>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </div>
      {open ? <div className="section-body">{children}</div> : null}
    </section>
  )
}

function display(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0'
}

const round2 = (value: number): number => Math.round(value * 100) / 100

interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  disabled?: boolean
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled
}: NumberFieldProps): JSX.Element {
  const [draft, setDraft] = useState(display(value))
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // The wheel listener is bound once, so it reads the newest props through a ref.
  const live = useRef({ value, step, min, max, disabled })
  live.current = { value, step, min, max, disabled }

  useEffect(() => {
    if (!focused) setDraft(display(value))
  }, [value, focused])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const scrub = (event: WheelEvent): void => {
      const { value: current, step: inc, min: lo, max: hi, disabled: off } = live.current
      if (off || event.ctrlKey) return
      const next = clamp(
        round2(current + (event.deltaY < 0 ? 1 : -1) * inc * (event.shiftKey ? 10 : 1)),
        lo ?? -Infinity,
        hi ?? Infinity
      )
      // Without this the inspector scrolls instead, and the scrub is lost.
      event.preventDefault()
      if (next === current) return
      setDraft(display(next))
      onChange(next)
    }
    el.addEventListener('wheel', scrub, { passive: false })
    return () => el.removeEventListener('wheel', scrub)
  }, [onChange])

  const commit = (raw: string): void => {
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) {
      setDraft(display(value))
      return
    }
    let next = parsed
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    onChange(next)
    setDraft(display(next))
  }

  const input = (
    <input
      ref={inputRef}
      className="number-input"
      type="number"
      value={draft}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      title="Scroll to adjust · Shift-scroll for coarse steps"
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        setDraft(event.target.value)
        const parsed = Number(event.target.value)
        if (event.target.value.trim() !== '' && Number.isFinite(parsed)) {
          let next = parsed
          if (min !== undefined) next = Math.max(min, next)
          if (max !== undefined) next = Math.min(max, next)
          if (next !== value) onChange(next)
        }
      }}
      onBlur={(event) => {
        setFocused(false)
        commit(event.target.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit((event.target as HTMLInputElement).value)
          ;(event.target as HTMLInputElement).blur()
        } else if (event.key === 'Escape') {
          setDraft(display(value))
          ;(event.target as HTMLInputElement).blur()
        }
      }}
    />
  )

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {unit ? (
        <div className="input-with-unit">
          {input}
          <span className="unit">{unit}</span>
        </div>
      ) : (
        input
      )}
    </label>
  )
}

export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}): JSX.Element {
  return (
    <label className="field">
      <span className="field-label">
        {label} <span style={{ color: 'var(--text-secondary)' }}>{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ accentColor: 'var(--accent)' }}
      />
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}): JSX.Element {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        className="text-input"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3
}: {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
}): JSX.Element {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <textarea
        className="text-input"
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

export interface SelectOption<T extends string> {
  value: T
  label: string
  group?: string
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled
}: {
  label: string
  value: T
  options: ReadonlyArray<SelectOption<T>>
  onChange: (value: T) => void
  disabled?: boolean
}): JSX.Element {
  const groups = options.reduce<Array<{ label: string; options: SelectOption<T>[] }>>((result, option) => {
    const label = option.group ?? ''
    let group = result.find((item) => item.label === label)
    if (!group) {
      group = { label, options: [] }
      result.push(group)
    }
    group.options.push(option)
    return result
  }, [])
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select
        className="select-input"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {groups.map((group) => group.label ? (
          <optgroup key={group.label} label={group.label}>{group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>
        ) : group.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>))}
      </select>
    </label>
  )
}

export function ColorField({
  label,
  value,
  onChange,
  nullable = false
}: {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  nullable?: boolean
}): JSX.Element {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          className="text-input"
          type="color"
          value={value ?? '#ffffff'}
          disabled={nullable && value === null}
          onChange={(event) => onChange(event.target.value)}
          style={{ width: 46, padding: 2, flex: 'none' }}
        />
        {nullable ? (
          <label className="checkbox-row" style={{ height: 26, gap: 5 }}>
            <input
              type="checkbox"
              checked={value === null}
              onChange={(event) => onChange(event.target.checked ? null : '#16181d')}
            />
            None
          </label>
        ) : (
          <input
            className="text-input"
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </div>
    </div>
  )
}

export function CheckField({
  label,
  checked,
  onChange,
  disabled
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <label className={`checkbox-row ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

/** Number entry with the boxed − / + steppers VideoScribe puts on every measure. */
export function StepperField({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  unit
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}): JSX.Element {
  const nudge = (direction: -1 | 1): void => {
    const next = Math.round((value + direction * step) * 1000) / 1000
    onChange(clamp(next, min, max))
  }

  return (
    <div className="field stepper-field">
      <span className="field-label">{label}</span>
      <div className="stepper">
        <button type="button" className="stepper-btn" aria-label={`Decrease ${label}`} onClick={() => nudge(-1)}>
          <Minus size={12} />
        </button>
        <NumberField label="" value={value} min={min} max={max} step={step} onChange={onChange} />
        <button type="button" className="stepper-btn" aria-label={`Increase ${label}`} onClick={() => nudge(1)}>
          <Plus size={12} />
        </button>
        {unit ? <span className="stepper-unit">{unit}</span> : null}
      </div>
    </div>
  )
}

export interface TileOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  /** Photographic preview (a hand pose) instead of a drawn icon. */
  image?: string
  title?: string
}

/** Icon-or-image tiles with the label underneath — VideoScribe's choice rows. */
export function TileGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 3
}: {
  label?: string
  value: T
  options: ReadonlyArray<TileOption<T>>
  onChange: (value: T) => void
  columns?: number
}): JSX.Element {
  return (
    <div className="field tile-field">
      {label ? <span className="field-label">{label}</span> : null}
      <div className="tile-grid" style={{ '--tile-columns': columns } as CSSProperties}>
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            className={`tile ${option.value === value ? 'selected' : ''}`}
            title={option.title ?? option.label}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
          >
            {option.image ? (
              <img className="tile-image" src={option.image} alt="" draggable={false} />
            ) : (
              <span className="tile-icon">{option.icon}</span>
            )}
            <span className="tile-label">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * The same choice set as TileGroup, but folded into the one box that shows the
 * effect in use — clicking it opens the grid, exactly like VideoScribe's
 * "Type" popup. Keeps three animation stages from stacking dozens of tiles.
 */
export function TilePickerField<T extends string>({
  label = 'Type',
  value,
  options,
  onChange,
  columns = 3
}: {
  label?: string
  value: T
  options: ReadonlyArray<TileOption<T>>
  onChange: (value: T) => void
  columns?: number
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const selected = options.find((option) => option.value === value) ?? null

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const escape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    // The panel scrolls under the open grid, so any scroll closes it rather
    // than leaving it stranded away from the box it belongs to.
    const close = (): void => setOpen(false)
    window.addEventListener('pointerdown', dismiss)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('pointerdown', dismiss)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', escape)
    }
  }, [open])

  const choose = (next: T): void => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="field tile-picker" ref={rootRef}>
      <span className="field-label">{label}</span>
      <button
        type="button"
        className={`tile tile-picker-trigger ${open ? 'open' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={selected?.title ?? selected?.label ?? String(value)}
        onClick={() => setOpen((state) => !state)}
      >
        {selected?.image ? (
          <img className="tile-image" src={selected.image} alt="" draggable={false} />
        ) : (
          <span className="tile-icon">{selected?.icon}</span>
        )}
        <span className="tile-label">{selected?.label ?? String(value)}</span>
      </button>

      {open ? (
        <div className="tile-picker-pop" role="dialog" aria-label={label}>
          <div className="tile-picker-head">{label}</div>
          <div
            className="tile-grid tile-picker-grid"
            style={{ '--tile-columns': columns } as CSSProperties}
          >
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                className={`tile ${option.value === value ? 'selected' : ''}`}
                title={option.title ?? option.label}
                aria-pressed={option.value === value}
                onClick={() => choose(option.value)}
              >
                {option.image ? (
                  <img className="tile-image" src={option.image} alt="" draggable={false} />
                ) : (
                  <span className="tile-icon">{option.icon}</span>
                )}
                <span className="tile-label">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** A row of square icon buttons that stay lit while their state holds. */
export function IconToggleRow({
  label,
  items
}: {
  label?: string
  items: ReadonlyArray<{
    key: string
    icon: ReactNode
    title: string
    active?: boolean
    disabled?: boolean
    onClick: () => void
  }>
}): JSX.Element {
  return (
    <div className="field icon-row-field">
      {label ? <span className="field-label">{label}</span> : null}
      <div className="icon-row">
        {items.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`icon-btn icon-row-btn ${item.active ? 'active' : ''}`}
            title={item.title}
            aria-label={item.title}
            aria-pressed={Boolean(item.active)}
            disabled={item.disabled}
            onClick={item.onClick}
          >
            {item.icon}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Colour choice as a swatch grid: the fixed palette, the colours the user added,
 * a "+" that opens the system picker, and the current value always reachable.
 */
export function SwatchField({
  label,
  value,
  colors,
  custom,
  onChange,
  onAddCustom,
  onRemoveCustom,
  onNone,
  noneLabel
}: {
  label?: string
  value: string | null
  colors: ReadonlyArray<string>
  custom: ReadonlyArray<string>
  onChange: (value: string) => void
  onAddCustom: (value: string) => void
  onRemoveCustom?: (value: string) => void
  onNone?: () => void
  noneLabel?: string
}): JSX.Element {
  const picker = useRef<HTMLInputElement | null>(null)
  const addCustom = useRef(onAddCustom)
  useEffect(() => {
    addCustom.current = onAddCustom
  })
  useEffect(() => {
    const node = picker.current
    if (!node) return
    // React's onChange is the native `input` event, which the colour dialog
    // fires on every drag. Saving once at `change` keeps one colour per pick.
    const commit = (): void => addCustom.current(node.value)
    node.addEventListener('change', commit)
    return () => node.removeEventListener('change', commit)
  }, [])

  return (
    <div className="field swatch-field">
      {label ? <span className="field-label">{label}</span> : null}
      <div className="swatch-grid">
        {colors.map((color) => (
          <Swatch key={color} color={color} active={value?.toLowerCase() === color.toLowerCase()} onSelect={onChange} />
        ))}
      </div>
      <div className="swatch-sublabel">Custom colours</div>
      <div className="swatch-grid">
        {custom.map((color) => (
          <Swatch
            key={color}
            color={color}
            active={value?.toLowerCase() === color.toLowerCase()}
            onSelect={onChange}
            onRemove={onRemoveCustom}
          />
        ))}
        <button
          type="button"
          className="swatch swatch-add"
          title="Add a custom colour"
          aria-label="Add a custom colour"
          onClick={() => picker.current?.click()}
        >
          <Plus size={13} />
        </button>
        <input
          ref={picker}
          className="font-import-input"
          type="color"
          value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#ff3fd0'}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      {noneLabel && onNone ? (
        <button
          type="button"
          className={`btn btn-sm swatch-none ${value === null ? 'active' : ''}`}
          onClick={onNone}
        >
          {noneLabel}
        </button>
      ) : null}
    </div>
  )
}

function Swatch({
  color,
  active,
  onSelect,
  onRemove
}: {
  color: string
  active: boolean
  onSelect: (value: string) => void
  onRemove?: (value: string) => void
}): JSX.Element {
  return (
    <button
      type="button"
      className={`swatch ${active ? 'active' : ''}`}
      style={{ background: color }}
      title={active ? `${color} — in use` : color}
      aria-label={color}
      aria-pressed={active}
      onClick={(event) => {
        if (event.shiftKey && onRemove) onRemove(color)
        else onSelect(color)
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        onRemove?.(color)
      }}
    >
      {active ? <Check size={12} className="swatch-check" /> : null}
    </button>
  )
}
