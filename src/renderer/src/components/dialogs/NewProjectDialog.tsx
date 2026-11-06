import { useState, type JSX } from 'react'
import { FolderOpen } from 'lucide-react'
import { OUTPUT_PRESETS, OUTPUT_RESOLUTIONS, type AspectPreset } from '@core/schema/factories'
import { createNewProject } from '../../services/projectFiles'
import { useProjectStore } from '../../state/projectStore'
import { useUiStore } from '../../state/uiStore'
import { NumberField, SelectField, TextField } from '../inspector/controls'
import { Dialog } from './Dialog'

export function NewProjectDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const dirty = useProjectStore((state) => state.dirty)
  const hasProject = useProjectStore((state) => Boolean(state.project))
  const askConfirm = useUiStore((state) => state.askConfirm)

  const [name, setName] = useState('Untitled project')
  const [parentDir, setParentDir] = useState('')
  const [preset, setPreset] = useState<AspectPreset>('16:9')
  const [resolutionIndex, setResolutionIndex] = useState(1)
  const [fps, setFps] = useState(30)
  const [creating, setCreating] = useState(false)

  const base = OUTPUT_PRESETS.find((entry) => entry.id === preset) ?? OUTPUT_PRESETS[0]!
  const resolution = OUTPUT_RESOLUTIONS[resolutionIndex] ?? OUTPUT_RESOLUTIONS[1]!
  const scale = resolution.height / 1080
  const width = Math.round((base.width * scale) / 2) * 2
  const height = Math.round((base.height * scale) / 2) * 2

  const create = async (): Promise<void> => {
    if (!name.trim() || !parentDir || creating) return
    if (hasProject && dirty) {
      const confirmed = await askConfirm({
        title: 'Discard unsaved changes?',
        message: 'Creating a new project will close the current one without saving its changes.',
        confirmLabel: 'Discard and create'
      })
      if (!confirmed) return
    }
    setCreating(true)
    const created = await createNewProject({ name: name.trim(), parentDir, width, height, fps })
    setCreating(false)
    if (created) onClose()
  }

  return (
    <Dialog
      title="New project"
      subtitle="Everything is stored locally in a project folder you choose."
      onClose={onClose}
      footer={
        <>
          <span className="footer-hint">
            Creates a .owsproj document and an assets/ directory.
          </span>
          <button className="btn" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!name.trim() || !parentDir || creating}
            onClick={() => void create()}
          >
            {creating ? 'Creating…' : 'Create project'}
          </button>
        </>
      }
    >
      <TextField label="Project name" value={name} onChange={setName} />

      <div className="field">
        <span className="field-label">Location</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="text-input"
            value={parentDir}
            placeholder="Choose a parent folder"
            readOnly
          />
          <button
            className="btn"
            style={{ flex: 'none' }}
            onClick={() => {
              void window.api.dialogs.pickParentDir().then((dir) => {
                if (dir) setParentDir(dir)
              })
            }}
          >
            <FolderOpen size={13} /> Browse
          </button>
        </div>
        <span className="hint">A new subfolder named after the project will be created here.</span>
      </div>

      <div className="field-row cols-3">
        <SelectField
          label="Aspect"
          value={preset}
          options={OUTPUT_PRESETS.map((entry) => ({ value: entry.id, label: entry.label }))}
          onChange={setPreset}
        />
        <SelectField
          label="Resolution"
          value={String(resolutionIndex)}
          options={OUTPUT_RESOLUTIONS.map((entry, index) => ({
            value: String(index),
            label: entry.label
          }))}
          onChange={(value) => setResolutionIndex(Number(value))}
        />
        <NumberField label="Frame rate" min={1} max={120} value={fps} onChange={setFps} unit="fps" />
      </div>

      <div className="hint">
        Output: {width} × {height} at {fps} fps. You can change this later in Project settings.
      </div>
    </Dialog>
  )
}
