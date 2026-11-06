import { useMemo, useState, type JSX } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { ERASER_INSTRUMENTS, INSTRUMENTS, getInstrument, type InstrumentDefinition } from '@core/instruments'
import { libraryAssetUrl } from '../../lib/assets'
import { Dialog } from '../dialogs/Dialog'

/** Rendering every pose at once made the grid crawl; search narrows the rest. */
const MAX_CARDS = 240

/** The preview picture: the catalog thumbnail, else the first photographic pose. */
function thumbnailOf(instrument: InstrumentDefinition): string | null {
  const path = instrument.thumbnail ?? instrument.assetPath
  return path ? libraryAssetUrl(path) : null
}

/** Catalog groups are lowercase ids; the picker shows them as proper names. */
function groupOf(instrument: InstrumentDefinition): string {
  const raw = instrument.group?.trim()
  if (!raw) return 'Built-in'
  return raw
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * The hand choice, opened the way the asset library opens: a full-screen picker
 * over the stage, because a photographed hand has to be judged at a size where
 * you can actually see it — a 30px chip in the sidebar cannot carry that.
 */
export function HandTypePicker({
  label = 'Hand',
  subtitle = 'Pick the hand or pen that draws this element.',
  scope = 'all',
  value,
  onChange
}: {
  label?: string
  /** The picker is shared by the writer and the eraser, and they are not the same question. */
  subtitle?: string
  /** 'erasers' narrows the library to the hands that clean the board. */
  scope?: 'all' | 'erasers'
  value: string
  onChange: (id: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const [group, setGroup] = useState('All')
  const [query, setQuery] = useState('')

  const catalog = scope === 'erasers' ? ERASER_INSTRUMENTS : INSTRUMENTS
  const selected = getInstrument(value)
  const groups = useMemo(() => {
    const names = [...new Set(catalog.map(groupOf))].sort((a, b) => a.localeCompare(b))
    return ['All', ...names.filter((name) => name !== 'All')]
  }, [catalog])

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    return catalog.filter(
      (instrument) =>
        (group === 'All' || groupOf(instrument) === group) &&
        (!term || `${instrument.name} ${groupOf(instrument)}`.toLowerCase().includes(term))
    )
  }, [catalog, group, query])

  const visible = matches.slice(0, MAX_CARDS)

  const choose = (id: string): void => {
    onChange(id)
    setOpen(false)
  }

  const preview = thumbnailOf(selected)

  return (
    <div className="field hand-picker">
      <span className="field-label">{label}</span>
      <button
        type="button"
        className="hand-picker-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="hand-picker-current">
          {preview ? (
            <img className="hand-picker-current-thumb" src={preview} alt="" draggable={false} />
          ) : (
            <span className="hand-picker-current-thumb hand-picker-current-fallback">
              {selected.name.slice(0, 1)}
            </span>
          )}
          <span className="hand-picker-current-name">{selected.name}</span>
        </span>
        <ChevronDown size={13} />
      </button>

      {open ? (
        <Dialog
          title={label}
          subtitle={subtitle}
          wide
          onClose={() => setOpen(false)}
          footer={
            <>
              <span className="footer-hint">
                {matches.length === visible.length
                  ? `${matches.length} of ${catalog.length} poses.`
                  : `Showing ${visible.length} of ${matches.length} matches — search to narrow it down.`}
              </span>
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </>
          }
        >
          <div className="asset-toolbar">
            <input
              className="text-input"
              placeholder={scope === 'erasers' ? 'Search erasers and wipers' : 'Search hands and pens'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="tabs hand-group-tabs" role="group" aria-label="Hand groups">
              {groups.map((name) => (
                <button
                  type="button"
                  key={name}
                  className={`tab ${name === group ? 'active' : ''}`}
                  aria-pressed={name === group}
                  onClick={() => setGroup(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="recent-empty">
              {scope === 'erasers' ? 'No eraser matches this search.' : 'No hand or pen matches this search.'}
            </div>
          ) : (
            <div className="hand-picker-grid">
              {visible.map((instrument) => {
                const thumb = thumbnailOf(instrument)
                return (
                  <button
                    type="button"
                    key={instrument.id}
                    className={`hand-card ${instrument.id === value ? 'selected' : ''}`}
                    title={`${instrument.name} · ${groupOf(instrument)}`}
                    aria-pressed={instrument.id === value}
                    onClick={() => choose(instrument.id)}
                  >
                    <span className="hand-card-shot">
                      {thumb ? (
                        <img className="hand-card-image" src={thumb} alt="" loading="lazy" draggable={false} />
                      ) : (
                        <span className="hand-card-fallback">{instrument.name}</span>
                      )}
                      {instrument.id === value ? (
                        <span className="hand-card-check">
                          <Check size={11} />
                        </span>
                      ) : null}
                    </span>
                    <span className="hand-card-name">{instrument.name}</span>
                  </button>
                )
              })}
            </div>
          )}
        </Dialog>
      ) : null}
    </div>
  )
}
