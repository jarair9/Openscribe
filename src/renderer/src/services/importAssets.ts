import { sampleCamera } from '@core/camera/sample'
import { clamp } from '@core/math'
import {
  addAsset,
  addElement,
  addSceneAudioTrack
} from '@core/project/operations'
import { createAsset, createImageElement, createSvgElement } from '@core/schema/factories'
import type { Asset, Element, Scene, AudioTrack } from '@core/schema/project'
import { analyzeSvg } from '@core/svg/extract'
import { buildSchedule } from '@core/timeline/schedule'
import { createId } from '@core/ids'
import { assetUrl, loadAudioDuration, loadImageSize, measureSvgPath } from '../lib/assets'
import { useEditorStore } from '../state/editorStore'
import { usePlaybackStore } from '../state/playbackStore'
import { useProjectStore } from '../state/projectStore'
import { useUiStore } from '../state/uiStore'
import type { IngestAssetsResult } from '@shared/ipc'

function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return (dot === -1 ? fileName : fileName.slice(0, dot)).replace(/[_-]+/g, ' ').trim() || 'Asset'
}

function importFrame(
  scene: Scene,
  aspect: number,
  centerX: number,
  centerY: number,
  contentWidth: number,
  contentHeight: number
): { x: number; y: number; width: number; height: number } {
  const camera = scene.cameras[0]
  const viewWidth = camera?.viewWidth ?? 1920
  const viewHeight = viewWidth / Math.max(0.01, aspect)
  const fraction = 0.45
  const scale = Math.min(
    (viewWidth * fraction) / Math.max(1, contentWidth),
    (viewHeight * fraction) / Math.max(1, contentHeight),
    4
  )
  const width = Math.max(16, contentWidth * scale)
  const height = Math.max(16, contentHeight * scale)
  return { x: centerX - width / 2, y: centerY - height / 2, width, height }
}

async function probeAudio(
  url: string,
  base64: string | null
): Promise<{ duration: number; sampleRate: number }> {
  const fallbackDuration = await loadAudioDuration(url).catch(() => 0)
  try {
    const buffer = base64
      ? (Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)).buffer as ArrayBuffer)
      : await fetch(url).then((response) => response.arrayBuffer())
    const context = new AudioContext()
    try {
      const decoded = await context.decodeAudioData(buffer)
      return {
        duration: decoded.duration || fallbackDuration,
        sampleRate: decoded.sampleRate || 44100
      }
    } finally {
      void context.close()
    }
  } catch {
    return { duration: fallbackDuration, sampleRate: 44100 }
  }
}

export async function importAssetPaths(paths: string[], preloaded?: IngestAssetsResult): Promise<number> {
  const store = useProjectStore.getState()
  const ui = useUiStore.getState()
  const project = store.project
  const session = store.session
  if (!project || !session) {
    ui.toast('Open or create a project before importing assets.', 'error')
    return 0
  }
  if (paths.length === 0 && !preloaded) return 0

  const sceneId = useEditorStore.getState().activeSceneId ?? project.scenes[0]?.id
  const scene = project.scenes.find((candidate) => candidate.id === sceneId) ?? project.scenes[0]
  if (!scene) return 0

  ui.setBusy('Importing assets…')
  try {
    const result = preloaded ?? await window.api.assets.ingest(session.assetToken, paths)
    const assets: Asset[] = []
    const elements: Element[] = []
    const tracks: AudioTrack[] = []
    const failures: string[] = result.rejected.map((entry) => entry.reason)

    const schedule = buildSchedule(project)
    const sceneIndex = project.scenes.findIndex((candidate) => candidate.id === scene.id)
    const sceneSchedule = schedule.scenes[Math.max(0, sceneIndex)]
    const localTime = clamp(
      usePlaybackStore.getState().time - (sceneSchedule?.start ?? 0),
      0,
      sceneSchedule?.duration ?? 0
    )
    const camera = sampleCamera(scene.cameras, localTime, project.output)
    const centerX = camera.frame.x + camera.frame.width / 2
    const centerY = camera.frame.y + camera.frame.height / 2
    const step = Math.max(24, camera.frame.width * 0.035)
    const outputAspect = project.output.width / project.output.height

    let slot = 0
    for (const file of result.files) {
      const name = baseName(file.originalName)
      const offset = slot * step
      const center = { x: centerX + offset, y: centerY + offset }
      const url = assetUrl(session.assetToken, file.fileName)

      try {
        if (file.kind === 'svg') {
          if (!file.text) throw new Error('The SVG is too large to import.')
          const analyzed = analyzeSvg(file.text, { measure: measureSvgPath, maxDrawables: 4000 })
          const asset = createAsset('svg', {
            name,
            fileName: file.fileName,
            mimeType: file.mimeType,
            byteSize: file.byteSize,
            contentHash: file.contentHash,
            svg: analyzed
          })
          const frame = importFrame(
            scene,
            outputAspect,
            center.x,
            center.y,
            analyzed.viewBox.width,
            analyzed.viewBox.height
          )
          assets.push(asset)
          elements.push(createSvgElement(asset, { name, frame }))
          slot += 1
          if (analyzed.warnings.length > 0) {
            ui.toast(`${name}: ${analyzed.warnings[0]}`, 'info')
          }
        } else if (file.kind === 'image') {
          const size = await loadImageSize(url)
          const asset = createAsset('image', {
            name,
            fileName: file.fileName,
            mimeType: file.mimeType,
            byteSize: file.byteSize,
            contentHash: file.contentHash,
            image: { width: size.width, height: size.height }
          })
          const frame = importFrame(scene, outputAspect, center.x, center.y, size.width, size.height)
          assets.push(asset)
          elements.push(createImageElement(asset, { name, frame }))
          slot += 1
        } else {
          const audio = await probeAudio(url, file.dataBase64)
          const asset = createAsset('audio', {
            name,
            fileName: file.fileName,
            mimeType: file.mimeType,
            byteSize: file.byteSize,
            contentHash: file.contentHash,
            audio
          })
          assets.push(asset)
          tracks.push({
            id: createId('aud'),
            name,
            assetId: asset.id,
            startTime: localTime,
            inPoint: 0,
            outPoint: null,
            volume: 1,
            fadeIn: 0.15,
            fadeOut: 0.3
          })
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : `${name} could not be imported.`)
      }
    }

    if (assets.length > 0) {
      const targetSceneId = scene.id
      useProjectStore.getState().apply(
        'Import assets',
        (current) => {
          let next = current
          for (const asset of assets) next = addAsset(next, asset)
          for (const element of elements) next = addElement(next, targetSceneId, element)
          for (const track of tracks) next = addSceneAudioTrack(next, targetSceneId, track)
          return next
        },
        { coalesce: false }
      )
      useEditorStore.getState().select(elements.map((element) => element.id))
    }

    const audioCount = tracks.length
    const visualCount = elements.length
    if (visualCount > 0 || audioCount > 0) {
      const summary = [
        visualCount > 0 ? `${visualCount} illustration${visualCount === 1 ? '' : 's'}` : null,
        audioCount > 0 ? `${audioCount} audio track${audioCount === 1 ? '' : 's'}` : null
      ]
        .filter(Boolean)
        .join(' and ')
      ui.toast(`Imported ${summary}.`, 'success')
    }
    if (failures.length > 0) {
      ui.toast(failures[0]!, 'error')
    }
    return elements.length + tracks.length
  } catch (error) {
    ui.toast(error instanceof Error ? error.message : 'The import failed.', 'error')
    return 0
  } finally {
    ui.setBusy(null)
  }
}

export async function importAssetsFromDialog(): Promise<void> {
  const paths = await window.api.dialogs.importAssets()
  if (paths.length === 0) return
  await importAssetPaths(paths)
}
