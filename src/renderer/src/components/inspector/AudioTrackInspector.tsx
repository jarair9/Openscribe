import type { JSX } from 'react'
import { Music2, Trash2 } from 'lucide-react'
import { removeSceneAudioTrack, updateSceneAudioTrack } from '@core/project/operations'
import type { AudioTrack, Scene } from '@core/schema/project'
import { useEditorStore } from '../../state/editorStore'
import { useProjectStore } from '../../state/projectStore'
import { Section, SliderField, StepperField } from './controls'

export function AudioTrackInspector({
  scene,
  track
}: {
  scene: Scene
  track: AudioTrack
}): JSX.Element {
  const apply = useProjectStore((state) => state.apply)
  const project = useProjectStore((state) => state.project)
  const selectAudioTrack = useEditorStore((state) => state.selectAudioTrack)

  const asset = project?.assets.find((candidate) => candidate.id === track.assetId)
  const duration = asset?.audio?.duration ?? 0

  const patch = (label: string, value: Partial<AudioTrack>): void => {
    apply(
      label,
      (current) => updateSceneAudioTrack(current, scene.id, track.id, (item) => ({ ...item, ...value }))
    )
  }

  return (
    <>
      <header className="inspector-header">
        <div className="inspector-title">
          <span style={{ color: 'var(--text-muted)', display: 'grid', placeItems: 'center' }}>
            <Music2 size={15} />
          </span>
          <span className="inspector-title-text">{track.name}</span>
          <span className="inspector-kind">Audio</span>
        </div>
      </header>

      <div className="inspector-scroll">
        <Section title="Playback" hint="Where the clip sits and how loud it plays.">
          <SliderField
            label="Volume"
            value={track.volume}
            min={0}
            max={2}
            step={0.05}
            onChange={(volume) => patch('Change audio volume', { volume })}
          />
          <div className="field-row cols-2">
            <StepperField
              label="Start (s)"
              min={0}
              max={3600}
              step={0.1}
              value={track.startTime}
              onChange={(startTime) => patch('Move audio', { startTime })}
            />
            <StepperField
              label="Fade in (s)"
              min={0}
              max={30}
              step={0.05}
              value={track.fadeIn}
              onChange={(fadeIn) => patch('Change audio fade in', { fadeIn })}
            />
          </div>
          <div className="field-row cols-2">
            <StepperField
              label="Fade out (s)"
              min={0}
              max={30}
              step={0.05}
              value={track.fadeOut}
              onChange={(fadeOut) => patch('Change audio fade out', { fadeOut })}
            />
            {duration > 0 ? (
              <StepperField
                label="Trim in (s)"
                min={0}
                max={Math.max(0, duration - 0.1)}
                step={0.1}
                value={track.inPoint}
                onChange={(inPoint) => patch('Trim audio in', { inPoint })}
              />
            ) : null}
          </div>
          {duration > 0 ? (
            <StepperField
              label="Trim out (s)"
              min={0.1}
              max={duration}
              step={0.1}
              value={track.outPoint ?? duration}
              onChange={(outPoint) =>
                patch('Trim audio out', {
                  outPoint: outPoint >= duration - 0.05 ? null : outPoint
                })
              }
            />
          ) : null}
        </Section>

        <Section title="Clip">
          <button
            className="btn btn-sm track-remove"
            onClick={() => {
              selectAudioTrack(null)
              apply(
                'Remove audio',
                (current) => removeSceneAudioTrack(current, scene.id, track.id),
                { coalesce: false }
              )
            }}
          >
            <Trash2 size={13} /> Remove from scene
          </button>
        </Section>
      </div>
    </>
  )
}