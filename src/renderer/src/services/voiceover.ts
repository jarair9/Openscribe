import { createId } from '@core/ids'
import { writeWav, peakLevel } from '@core/audio/wav'
import { addAsset, addSceneAudioTrack } from '@core/project/operations'
import { createAsset } from '@core/schema/factories'
import type { AudioTrack } from '@core/schema/project'
import { formatSeconds } from '@core/math'
import { useEditorStore } from '../state/editorStore'
import { useProjectStore } from '../state/projectStore'
import { useUiStore } from '../state/uiStore'
import { sceneLocalTime } from './insertAsset'

export interface EncodedWav {
  buffer: Uint8Array
  duration: number
  sampleRate: number
  peak: number
}

/**
 * MediaRecorder produces compressed audio (WebM/Opus in Chromium). Decode it
 * and write a canonical 16-bit PCM WAV so the project stays portable offline
 * and matches the formats the importer already validates.
 */
export async function encodeWav(blob: Blob): Promise<EncodedWav> {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())
    const sources = Array.from({ length: decoded.numberOfChannels }, (_, channel) =>
      decoded.getChannelData(channel)
    )
    return {
      buffer: writeWav(sources, decoded.sampleRate),
      duration: decoded.duration,
      sampleRate: decoded.sampleRate,
      peak: peakLevel(sources)
    }
  } finally {
    void context.close()
  }
}

/** Persist a recording into the active project and place it at the playhead. */
export async function saveVoiceover(blob: Blob): Promise<boolean> {
  const { project, session, apply } = useProjectStore.getState()
  const ui = useUiStore.getState()
  if (!project || !session) {
    ui.toast('Open a project before recording.', 'error')
    return false
  }

  const sceneId = useEditorStore.getState().activeSceneId ?? project.scenes[0]?.id
  const scene = project.scenes.find((candidate) => candidate.id === sceneId) ?? project.scenes[0]
  if (!scene) return false

  try {
    const wav = await encodeWav(blob)
    if (wav.duration < 0.15) {
      ui.toast('The recording was too short to keep.', 'info')
      return false
    }
    if (wav.peak < 0.002) {
      ui.toast(
        'The microphone recorded silence. Check your input device and its mute switch, then record again.',
        'error'
      )
      return false
    }

    const stamp = new Date()
      .toLocaleTimeString('en-GB', { hour12: false })
      .replace(/:/g, '.')
    const name = `Voiceover ${stamp}`
    const saved = await window.api.assets.saveAudio(
      session.assetToken,
      wav.buffer,
      `${name}.wav`
    )
    const asset = createAsset('audio', {
      name,
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      byteSize: saved.byteSize,
      contentHash: saved.contentHash,
      audio: { duration: wav.duration, sampleRate: wav.sampleRate }
    })

    const startTime = sceneLocalTime(project, scene)
    const track: AudioTrack = {
      id: createId('aud'),
      name,
      assetId: asset.id,
      startTime,
      inPoint: 0,
      outPoint: null,
      volume: 1,
      fadeIn: 0.03,
      fadeOut: 0.1
    }

    apply(
      'Add voiceover',
      (current) => addSceneAudioTrack(addAsset(current, asset), scene.id, track),
      { coalesce: false }
    )
    ui.toast(
      `Voiceover added at ${formatSeconds(startTime)} in “${scene.name}”.`,
      'success'
    )
    return true
  } catch (error) {
    ui.toast(
      error instanceof Error ? error.message : 'The voiceover could not be saved.',
      'error'
    )
    return false
  }
}
