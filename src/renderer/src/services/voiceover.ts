import { createId } from '@core/ids'
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
    const channels = Math.min(2, Math.max(1, decoded.numberOfChannels))
    const frames = decoded.length
    const sampleRate = decoded.sampleRate
    const bytesPerSample = 2
    const dataSize = frames * channels * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)

    const writeAscii = (offset: number, text: string): void => {
      for (let index = 0; index < text.length; index += 1) {
        view.setUint8(offset + index, text.charCodeAt(index))
      }
    }

    writeAscii(0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeAscii(8, 'WAVE')
    writeAscii(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * channels * bytesPerSample, true)
    view.setUint16(32, channels * bytesPerSample, true)
    view.setUint16(34, 16, true)
    writeAscii(36, 'data')
    view.setUint32(40, dataSize, true)

    const sources = Array.from({ length: channels }, (_, channel) =>
      decoded.getChannelData(channel)
    )
    let offset = 44
    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, sources[channel]![frame] ?? 0))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
        offset += bytesPerSample
      }
    }

    return {
      buffer: new Uint8Array(buffer),
      duration: decoded.duration,
      sampleRate
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
