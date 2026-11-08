import type { JSX } from 'react'
import { RotateCcw } from 'lucide-react'
import type { ExportFormat } from '@shared/ipc'
import {
  ACCENTS,
  usePreferencesStore,
  type AccentId,
  type ExportQuality
} from '../../state/preferencesStore'
import { CheckField, SelectField } from '../inspector/controls'
import { Dialog } from './Dialog'

const ACCENT_ORDER: AccentId[] = ['magenta', 'cyan', 'amber', 'violet']

const QUALITIES: Array<{ value: ExportQuality; label: string }> = [
  { value: 'draft', label: 'Draft (smallest)' },
  { value: 'standard', label: 'Standard' },
  { value: 'high', label: 'High' },
  { value: 'maximum', label: 'Maximum (largest)' }
]

export function PreferencesDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const preferences = usePreferencesStore()
  const {
    autosave,
    autosaveDelay,
    accent,
    exportFormat,
    exportQuality,
    exportScale,
    keepFrames,
    setAutosave,
    setAutosaveDelay,
    setAccent,
    setExportFormat,
    setExportQuality,
    setExportScale,
    setKeepFrames,
    reset
  } = preferences

  return (
    <Dialog
      title="Preferences"
      subtitle="Editor behaviour is remembered on this computer."
      onClose={onClose}
      footer={
        <>
          <span className="footer-hint">Preferences never touch the project file.</span>
          <button className="btn" onClick={reset}>
            <RotateCcw size={13} />
            Reset to defaults
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="preferences">
        <section className="pref-group">
          <h3 className="pref-heading">Saving</h3>
          <CheckField
            label="Autosave the project while I work"
            checked={autosave}
            onChange={setAutosave}
          />
          <SelectField
            label="Write a checkpoint after"
            value={String(autosaveDelay)}
            options={[2, 3, 5, 10, 20, 30, 60].map((seconds) => ({
              value: String(seconds),
              label: `${seconds} seconds of quiet`
            }))}
            onChange={(value) => setAutosaveDelay(Number(value))}
            disabled={!autosave}
          />
          <p className="pref-hint">
            Autosave writes in place using the same atomic save as Ctrl+S. Unsaved edits made during
            a save stay marked dirty and are written on the next pass.
          </p>
        </section>

        <section className="pref-group">
          <h3 className="pref-heading">Accent</h3>
          <div className="accent-grid" role="radiogroup" aria-label="Interface accent">
            {ACCENT_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={accent === id}
                className={`accent-swatch ${accent === id ? 'selected' : ''}`}
                onClick={() => setAccent(id)}
              >
                <span className="accent-chip" style={{ background: ACCENTS[id].accent }} />
                {ACCENTS[id].label}
              </button>
            ))}
          </div>
          <p className="pref-hint">
            The accent marks selection and focus. Cameras keep their own colour so framing stays
            readable.
          </p>
        </section>

        <section className="pref-group">
          <h3 className="pref-heading">Export defaults</h3>
          <div className="field-row cols-2">
            <SelectField
              label="Format"
              value={exportFormat}
              options={[
                { value: 'mp4', label: 'MP4 video' },
                { value: 'webm', label: 'WebM video' },
                { value: 'frames', label: 'PNG frames' }
              ]}
              onChange={(value) => setExportFormat(value as ExportFormat)}
            />
            <SelectField
              label="Size"
              value={String(exportScale)}
              options={[50, 100, 150, 200].map((scale) => ({
                value: String(scale),
                label: `${scale}%`
              }))}
              onChange={(value) => setExportScale(Number(value))}
            />
          </div>
          <SelectField
            label="Quality"
            value={exportQuality}
            options={QUALITIES.map((entry) => ({ value: entry.value, label: entry.label }))}
            onChange={(value) => setExportQuality(value as ExportQuality)}
          />
          <CheckField
            label="Keep the PNG frames after encoding"
            checked={keepFrames}
            onChange={setKeepFrames}
          />
          <p className="pref-hint">These choices pre-fill the export dialog; you can change them per export.</p>
        </section>
      </div>
    </Dialog>
  )
}
