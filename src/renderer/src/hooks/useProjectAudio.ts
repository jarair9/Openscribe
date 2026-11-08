import { useEffect, useMemo, useRef } from 'react'
import { clamp, clamp01 } from '@core/math'
import type { Project } from '@core/schema/project'
import type { ProjectSchedule } from '@core/timeline/schedule'
import { readAssetBytes } from '../lib/assets'
import { usePlaybackStore } from '../state/playbackStore'
import { useUiStore } from '../state/uiStore'

interface ProjectAudioEntry {
  id: string
  name: string
  fileName: string
  mime: string
  start: number
  duration: number
  inPoint: number
  volume: number
  fadeIn: number
  fadeOut: number
}

/**
 * Single playback audio engine for editor and full-screen preview alike.
 * Media is loaded into memory and played from blob URLs: same-origin and fully
 * seekable, unlike the custom asset scheme which Chromium's media pipeline
 * cannot range-request. Tracks at or below 100% play straight from the media
 * element; boosts above 100% route through a GainNode.
 */
export function useProjectAudio(
  project: Project | null,
  schedule: ProjectSchedule,
  token: string
): void {
  const time = usePlaybackStore((state) => state.time)
  const playing = usePlaybackStore((state) => state.playing)
  const rate = usePlaybackStore((state) => state.rate)
  const muted = usePlaybackStore((state) => state.muted)
  const audios = useRef<Map<string, HTMLAudioElement>>(new Map())
  const gainsRef = useRef<Map<string, GainNode>>(new Map())
  const contextRef = useRef<AudioContext | null>(null)
  const entriesRef = useRef<ProjectAudioEntry[]>([])
  const reportedRef = useRef<Set<string>>(new Set())

  const entries = useMemo<ProjectAudioEntry[]>(() => {
    if (!project) return []
    const list: ProjectAudioEntry[] = []
    const push = (
      track: Project['scenes'][number]['audio'][number],
      absoluteStart: number
    ): void => {
      const asset = project.assets.find((candidate) => candidate.id === track.assetId)
      if (!asset || asset.kind !== 'audio') return
      const sourceDuration = asset.audio?.duration ?? 0
      const outPoint = track.outPoint ?? sourceDuration
      const duration = Math.max(0, outPoint - track.inPoint)
      if (duration <= 0) return
      list.push({
        id: track.id,
        name: track.name,
        fileName: asset.fileName,
        mime: asset.mimeType || 'audio/wav',
        start: absoluteStart,
        duration,
        inPoint: track.inPoint,
        volume: clamp(track.volume, 0, 2),
        fadeIn: track.fadeIn,
        fadeOut: track.fadeOut
      })
    }

    schedule.scenes.forEach((sceneSchedule, index) => {
      const scene = project.scenes[index]
      if (!scene) return
      for (const track of scene.audio) push(track, sceneSchedule.start + track.startTime)
    })
    for (const track of project.audio) push(track, track.startTime)
    return list
  }, [project, schedule, token])

  entriesRef.current = entries
  // Rebuild elements only when the media or its window changes, not on every
  // project edit or volume nudge.
  const rebuildKey = entries
    .map((entry) => `${entry.id}:${entry.fileName}:${entry.start}:${entry.duration}:${entry.inPoint}:${entry.volume > 1}`)
    .join('|')

  useEffect(() => {
    const list = entriesRef.current
    let cancelled = false
    const urls: string[] = []
    let context = contextRef.current
    if (!context && list.some((entry) => entry.volume > 1)) {
      try {
        context = new AudioContext()
        contextRef.current = context
      } catch {
        context = null
      }
    }
    const report = (entry: ProjectAudioEntry): void => {
      if (reportedRef.current.has(entry.id)) return
      reportedRef.current.add(entry.id)
      useUiStore.getState().toast(`“${entry.name}” could not be played — the audio file is unreadable.`, 'error')
    }
    const map = new Map<string, HTMLAudioElement>()
    const gains = new Map<string, GainNode>()
    for (const entry of list) {
      const audio = new Audio()
      audio.preload = 'auto'
      audio.onerror = () => report(entry)
      map.set(entry.id, audio)
      if (context && entry.volume > 1) {
        try {
          const gain = context.createGain()
          gain.gain.value = 0
          context.createMediaElementSource(audio).connect(gain)
          gain.connect(context.destination)
          gains.set(entry.id, gain)
        } catch {
          // Stay on the direct element output with capped volume.
        }
      }
      void readAssetBytes(token, entry.fileName)
        .then((bytes) => {
          if (cancelled) return
          const url = URL.createObjectURL(new Blob([bytes], { type: entry.mime }))
          urls.push(url)
          audio.src = url
          if (usePlaybackStore.getState().playing) {
            void audio.play().catch((error: unknown) => {
              if (error instanceof DOMException && error.name === 'NotSupportedError') report(entry)
            })
          }
        })
        .catch(() => report(entry))
    }
    audios.current = map
    gainsRef.current = gains
    return () => {
      cancelled = true
      for (const url of urls) URL.revokeObjectURL(url)
      for (const gain of gains.values()) gain.disconnect()
      for (const audio of map.values()) {
        audio.onerror = null
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      audios.current = new Map()
      gainsRef.current = new Map()
    }
  }, [rebuildKey, token])

  useEffect(() => {
    return () => {
      const context = contextRef.current
      contextRef.current = null
      if (context && context.state !== 'closed') void context.close()
    }
  }, [])

  useEffect(() => {
    const context = contextRef.current
    if (playing && context && context.state === 'suspended') void context.resume()
    for (const entry of entries) {
      const audio = audios.current.get(entry.id)
      if (!audio) continue
      const gainNode = gainsRef.current.get(entry.id)
      audio.playbackRate = clamp(rate, 0.25, 4)
      const local = time - entry.start
      if (local < 0 || local >= entry.duration) {
        audio.pause()
        if (Number.isFinite(audio.duration) || audio.readyState > 0) {
          audio.currentTime = entry.inPoint
        }
        if (gainNode) gainNode.gain.value = 0
        continue
      }
      const expected = entry.inPoint + local
      let gain = entry.volume
      if (entry.fadeIn > 0.01) gain *= clamp01(local / entry.fadeIn)
      const remaining = entry.duration - local
      if (entry.fadeOut > 0.01) gain *= clamp01(remaining / entry.fadeOut)
      if (gainNode) {
        audio.volume = 1
        audio.muted = false
        gainNode.gain.value = muted ? 0 : gain
      } else {
        audio.muted = muted
        audio.volume = clamp01(gain)
      }

      if (playing) {
        if (audio.readyState > 0 && Math.abs(audio.currentTime - expected) > 0.35) {
          audio.currentTime = expected
        }
        if (audio.paused && audio.src) void audio.play().catch(() => {})
      } else {
        audio.pause()
        if (audio.readyState > 0 && Math.abs(audio.currentTime - expected) > 0.05) {
          audio.currentTime = expected
        }
      }
    }
  }, [entries, time, playing, rate, muted])
}