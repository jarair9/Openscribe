import { create } from 'zustand'

interface PlaybackState {
  /** Project-absolute time in seconds. */
  time: number
  playing: boolean
  rate: number
  muted: boolean
  loop: boolean
  setTime(time: number): void
  play(): void
  pause(): void
  toggle(): void
  stop(): void
  setRate(rate: number): void
  toggleMuted(): void
  toggleLoop(): void
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  time: 0,
  playing: false,
  rate: 1,
  muted: false,
  loop: false,

  setTime(time) {
    set({ time: Math.max(0, time) })
  },

  play() {
    set({ playing: true })
  },

  pause() {
    set({ playing: false })
  },

  toggle() {
    set({ playing: !usePlaybackStore.getState().playing })
  },

  stop() {
    set({ playing: false, time: 0 })
  },

  setRate(rate) {
    set({ rate: Math.max(0.1, Math.min(4, rate)) })
  },

  toggleMuted() {
    set({ muted: !usePlaybackStore.getState().muted })
  },

  toggleLoop() {
    set({ loop: !usePlaybackStore.getState().loop })
  }
}))
