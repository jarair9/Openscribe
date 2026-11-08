import type { JSX } from 'react'
import { Pause, Play, Repeat, RotateCcw, Square, Volume2, VolumeX } from 'lucide-react'
import { formatSeconds } from '@core/math'
import { usePlaybackStore } from '../../state/playbackStore'

/**
 * The single place playback is controlled. The dock used to scatter this
 * across the title bar and a rate select; one instrument cluster makes the
 * project clock obvious and gives Space/loop a visible home.
 */
export function Transport({ duration }: { duration: number }): JSX.Element {
  const time = usePlaybackStore((state) => state.time)
  const playing = usePlaybackStore((state) => state.playing)
  const muted = usePlaybackStore((state) => state.muted)
  const loop = usePlaybackStore((state) => state.loop)
  const toggleLoop = usePlaybackStore((state) => state.toggleLoop)
  const toggleMuted = usePlaybackStore((state) => state.toggleMuted)

  const toggle = (): void => {
    const store = usePlaybackStore.getState()
    if (!store.playing && store.time >= duration - 0.01) store.setTime(0)
    store.toggle()
  }

  const restart = (): void => {
    const store = usePlaybackStore.getState()
    store.setTime(0)
    if (!store.playing) store.play()
  }

  return (
    <div className="transport" role="group" aria-label="Playback">
      <button
        className="transport-btn primary"
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
        aria-label={playing ? 'Pause' : 'Play'}
        aria-pressed={playing}
        onClick={toggle}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        className="transport-btn"
        title="Stop (return to start)"
        aria-label="Stop"
        onClick={() => usePlaybackStore.getState().stop()}
      >
        <Square size={11} />
      </button>
      <button
        className="transport-btn"
        title="Restart from the beginning"
        aria-label="Restart"
        onClick={restart}
      >
        <RotateCcw size={12} />
      </button>

      <span className="transport-clock" aria-live="off">
        <span className="transport-time">{formatSeconds(time, true)}</span>
        <span className="transport-total">/ {formatSeconds(duration, true)}</span>
      </span>

      <button
        className={`transport-btn ${loop ? 'active' : ''}`}
        title={loop ? 'Loop is on' : 'Loop playback'}
        aria-label="Loop playback"
        aria-pressed={loop}
        onClick={toggleLoop}
      >
        <Repeat size={12} />
      </button>
      <button
        className={`transport-btn ${muted ? 'active' : ''}`}
        title={muted ? 'Unmute audio' : 'Mute audio'}
        aria-label={muted ? 'Unmute audio' : 'Mute audio'}
        aria-pressed={muted}
        onClick={toggleMuted}
      >
        {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
      </button>
    </div>
  )
}
