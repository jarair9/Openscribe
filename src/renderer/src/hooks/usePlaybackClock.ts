import { useEffect } from 'react'
import { buildSchedule } from '@core/timeline/schedule'
import { usePlaybackStore } from '../state/playbackStore'
import { useProjectStore } from '../state/projectStore'

/**
 * Advances project-absolute playback time with requestAnimationFrame while
 * playing. Time is stored centrally so the canvas, timeline, and thumbnails
 * always agree on the current instant.
 */
export function usePlaybackClock(duration: number): void {
  const playing = usePlaybackStore((state) => state.playing)
  const rate = usePlaybackStore((state) => state.rate)

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()

    const tick = (now: number): void => {
      const store = usePlaybackStore.getState()
      if (!store.playing) return
      const next = store.time + ((now - last) / 1000) * store.rate
      last = now
      if (next >= duration) {
        store.setTime(duration)
        store.pause()
        return
      }
      store.setTime(next)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, rate, duration])
}

/** Start playback from the beginning when the playhead is already at the end. */
export function togglePlayback(duration: number): void {
  const store = usePlaybackStore.getState()
  if (!store.playing && store.time >= duration - 0.02) store.setTime(0)
  store.toggle()
}

/** Seek to the first frame of a scene using the project's derived schedule. */
export function seekToScene(sceneId: string): void {
  const project = useProjectStore.getState().project
  if (!project) return
  const schedule = buildSchedule(project)
  const scene = schedule.scenes.find((entry) => entry.sceneId === sceneId)
  if (!scene) return
  usePlaybackStore.getState().pause()
  usePlaybackStore.getState().setTime(scene.start)
}
