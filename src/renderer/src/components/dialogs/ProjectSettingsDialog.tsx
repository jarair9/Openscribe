import { useState, type JSX } from 'react'
import { renameProject, setOutputSize } from '@core/project/operations'
import { OUTPUT_PRESETS } from '@core/schema/factories'
import { useProjectStore } from '../../state/projectStore'
import { NumberField, SelectField, TextField } from '../inspector/controls'
import { Dialog } from './Dialog'

export function ProjectSettingsDialog({ onClose }: { onClose: () => void }): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const apply = useProjectStore((state) => state.apply)

  const [name, setName] = useState(project?.name ?? '')
  const [width, setWidth] = useState(project?.output.width ?? 1920)
  const [height, setHeight] = useState(project?.output.height ?? 1080)
  const [fps, setFps] = useState(project?.output.fps ?? 30)

  if (!project) return null

  const preset = OUTPUT_PRESETS.find(
    (entry) => entry.width === width && entry.height === height
  )?.id

  const save = (): void => {
    apply(
      'Update project settings',
      (current) =>
        setOutputSize(
          renameProject(current, name.trim() || current.name),
          Math.max(16, Math.round(width)),
          Math.max(16, Math.round(height)),
          Math.max(1, Math.min(120, Math.round(fps)))
        ),
      { coalesce: false }
    )
    onClose()
  }

  return (
    <Dialog
      title="Project settings"
      subtitle="Document identity and output format."
      onClose={onClose}
      footer={
        <>
          <span className="footer-hint">
            Aspect ratio affects camera frames and the exported video.
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Apply
          </button>
        </>
      }
    >
      <TextField label="Project name" value={name} onChange={setName} />
      <SelectField
        label="Aspect preset"
        value={preset ?? 'custom'}
        options={[
          ...OUTPUT_PRESETS.map((entry) => ({ value: entry.id, label: entry.label })),
          { value: 'custom', label: 'Custom' }
        ]}
        onChange={(value) => {
          const match = OUTPUT_PRESETS.find((entry) => entry.id === value)
          if (match) {
            setWidth(match.width)
            setHeight(match.height)
          }
        }}
      />
      <div className="field-row cols-3">
        <NumberField label="Width" min={16} max={7680} value={width} onChange={setWidth} />
        <NumberField label="Height" min={16} max={7680} value={height} onChange={setHeight} />
        <NumberField label="Frame rate" min={1} max={120} value={fps} onChange={setFps} unit="fps" />
      </div>
      <div className="hint">
        {project.scenes.length} scene{project.scenes.length === 1 ? '' : 's'} · {project.assets.length}{' '}
        asset{project.assets.length === 1 ? '' : 's'} · Schema v{project.schemaVersion}
      </div>
    </Dialog>
  )
}
