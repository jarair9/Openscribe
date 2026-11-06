import { createId, nowIso } from '../ids'
import { createScene } from '../schema/factories'
import type {
  Asset,
  AudioTrack,
  Background,
  Camera,
  Element,
  Project,
  Scene
} from '../schema/project'

export function touch(project: Project): Project {
  return { ...project, updatedAt: nowIso() }
}

export function mapScene(
  project: Project,
  sceneId: string,
  updater: (scene: Scene) => Scene
): Project {
  let changed = false
  const scenes = project.scenes.map((scene) => {
    if (scene.id !== sceneId) return scene
    changed = true
    return updater(scene)
  })
  return changed ? touch({ ...project, scenes }) : project
}

export function updateScene(
  project: Project,
  sceneId: string,
  updater: (scene: Scene) => Scene
): Project {
  return mapScene(project, sceneId, updater)
}

export function renameProject(project: Project, name: string): Project {
  const trimmed = name.trim()
  if (!trimmed) return project
  return touch({ ...project, name: trimmed })
}

export function renameScene(project: Project, sceneId: string, name: string): Project {
  const trimmed = name.trim()
  if (!trimmed) return project
  return mapScene(project, sceneId, (scene) => ({ ...scene, name: trimmed }))
}

/* ------------------------------------------------------------------ */
/* Elements                                                           */
/* ------------------------------------------------------------------ */

export function addElement(project: Project, sceneId: string, element: Element): Project {
  return mapScene(project, sceneId, (scene) => ({
    ...scene,
    elements: [...scene.elements, element]
  }))
}

export function updateElement(
  project: Project,
  sceneId: string,
  elementId: string,
  updater: (element: Element) => Element
): Project {
  return mapScene(project, sceneId, (scene) => ({
    ...scene,
    elements: scene.elements.map((element) =>
      element.id === elementId ? updater(element) : element
    )
  }))
}

export function updateElements(
  project: Project,
  sceneId: string,
  elementIds: ReadonlySet<string>,
  updater: (element: Element) => Element
): Project {
  return mapScene(project, sceneId, (scene) => ({
    ...scene,
    elements: scene.elements.map((element) =>
      elementIds.has(element.id) ? updater(element) : element
    )
  }))
}

export function moveElements(
  project: Project,
  sceneId: string,
  elementIds: ReadonlySet<string>,
  dx: number,
  dy: number
): Project {
  return updateElements(project, sceneId, elementIds, (element) => ({
    ...element,
    frame: {
      ...element.frame,
      x: element.frame.x + dx,
      y: element.frame.y + dy
    }
  }))
}

export function removeElements(
  project: Project,
  sceneId: string,
  elementIds: ReadonlySet<string>
): Project {
  return mapScene(project, sceneId, (scene) => ({
    ...scene,
    elements: scene.elements.filter((element) => !elementIds.has(element.id))
  }))
}

function cloneElement(element: Element): Element {
  return {
    ...(structuredClone(element) as Element),
    id: createId('el'),
    name: `${element.name} copy`
  }
}

export function duplicateElements(
  project: Project,
  sceneId: string,
  elementIds: ReadonlySet<string>,
  offset = 32
): { project: Project; newIds: string[] } {
  const newIds: string[] = []
  const updated = mapScene(project, sceneId, (scene) => {
    const copies: Element[] = []
    for (const element of scene.elements) {
      if (!elementIds.has(element.id)) continue
      const copy = cloneElement(element)
      copy.frame = {
        ...copy.frame,
        x: copy.frame.x + offset,
        y: copy.frame.y + offset
      }
      copies.push(copy)
      newIds.push(copy.id)
    }
    return { ...scene, elements: [...scene.elements, ...copies] }
  })
  return { project: updated, newIds }
}

export function reorderElement(
  project: Project,
  sceneId: string,
  elementId: string,
  targetIndex: number
): Project {
  return mapScene(project, sceneId, (scene) => {
    const index = scene.elements.findIndex((element) => element.id === elementId)
    if (index === -1) return scene
    const clamped = Math.max(0, Math.min(scene.elements.length - 1, targetIndex))
    if (clamped === index) return scene
    const next = [...scene.elements]
    const [moved] = next.splice(index, 1)
    next.splice(clamped, 0, moved!)
    return { ...scene, elements: next }
  })
}

export function bringElementForward(
  project: Project,
  sceneId: string,
  elementId: string
): Project {
  return mapScene(project, sceneId, (scene) => {
    const index = scene.elements.findIndex((element) => element.id === elementId)
    if (index === -1 || index === scene.elements.length - 1) return scene
    const next = [...scene.elements]
    const temp = next[index]!
    next[index] = next[index + 1]!
    next[index + 1] = temp
    return { ...scene, elements: next }
  })
}

export function sendElementBackward(
  project: Project,
  sceneId: string,
  elementId: string
): Project {
  return mapScene(project, sceneId, (scene) => {
    const index = scene.elements.findIndex((element) => element.id === elementId)
    if (index <= 0) return scene
    const next = [...scene.elements]
    const temp = next[index]!
    next[index] = next[index - 1]!
    next[index - 1] = temp
    return { ...scene, elements: next }
  })
}

export function replaceElementAsset(
  project: Project,
  sceneId: string,
  elementId: string,
  assetId: string
): Project {
  return updateElement(project, sceneId, elementId, (element) => {
    if (element.kind !== 'svg' && element.kind !== 'image') return element
    return { ...element, assetId }
  })
}

/* ------------------------------------------------------------------ */
/* Scenes                                                             */
/* ------------------------------------------------------------------ */

export function addScene(
  project: Project,
  options: { afterSceneId?: string; template?: Scene; name?: string } = {}
): { project: Project; sceneId: string } {
  const template = options.template
  const scene = createScene(project.output, project.scenes.length)
  if (template) {
    scene.background = structuredClone(template.background)
    const camera = template.cameras[template.cameras.length - 1]
    if (camera) {
      scene.cameras = [
        {
          ...structuredClone(camera),
          id: createId('cam'),
          startTime: 0,
          name: 'Camera 1'
        }
      ]
    }
    scene.transition = structuredClone(template.transition)
  }
  if (options.name) scene.name = options.name
  const scenes = [...project.scenes]
  let index = scenes.length
  if (options.afterSceneId) {
    const found = scenes.findIndex((candidate) => candidate.id === options.afterSceneId)
    if (found !== -1) index = found + 1
  }
  scenes.splice(index, 0, scene)
  return { project: touch({ ...project, scenes }), sceneId: scene.id }
}

export function duplicateScene(
  project: Project,
  sceneId: string
): { project: Project; sceneId: string } | null {
  const source = project.scenes.find((scene) => scene.id === sceneId)
  if (!source) return null
  const clone = structuredClone(source) as Scene
  clone.id = createId('scene')
  clone.name = `${source.name} copy`
  clone.elements = clone.elements.map((element) => ({
    ...element,
    id: createId('el')
  }))
  clone.cameras = clone.cameras.map((camera) => ({ ...camera, id: createId('cam') }))
  clone.audio = clone.audio.map((track) => ({ ...track, id: createId('aud') }))
  const index = project.scenes.findIndex((scene) => scene.id === sceneId)
  const scenes = [...project.scenes]
  scenes.splice(index + 1, 0, clone)
  return { project: touch({ ...project, scenes }), sceneId: clone.id }
}

export function removeScene(
  project: Project,
  sceneId: string
): Project {
  if (project.scenes.length <= 1) {
    const only = project.scenes[0]!
    if (only.elements.length === 0) return project
    return mapScene(project, only.id, (scene) => ({ ...scene, elements: [] }))
  }
  return touch({
    ...project,
    scenes: project.scenes.filter((scene) => scene.id !== sceneId)
  })
}

export function moveScene(
  project: Project,
  sceneId: string,
  offset: number
): Project {
  const index = project.scenes.findIndex((scene) => scene.id === sceneId)
  const target = index + offset
  if (index === -1 || target < 0 || target >= project.scenes.length) return project
  const scenes = [...project.scenes]
  const [moved] = scenes.splice(index, 1)
  scenes.splice(target, 0, moved!)
  return touch({ ...project, scenes })
}

export function setSceneBackground(
  project: Project,
  sceneId: string,
  background: Background
): Project {
  return mapScene(project, sceneId, (scene) => ({ ...scene, background }))
}

/* ------------------------------------------------------------------ */
/* Cameras                                                            */
/* ------------------------------------------------------------------ */

function normalizeCameraOrder(cameras: Camera[]): Camera[] {
  const sorted = [...cameras].sort((a, b) => a.startTime - b.startTime)
  if (sorted[0]) sorted[0] = { ...sorted[0], startTime: 0 }
  return sorted
}

export function addCamera(project: Project, sceneId: string, camera: Camera): Project {
  return mapScene(project, sceneId, (scene) => ({
    ...scene,
    cameras: normalizeCameraOrder([...scene.cameras, camera])
  }))
}

export function updateCamera(
  project: Project,
  sceneId: string,
  cameraId: string,
  updater: (camera: Camera) => Camera
): Project {
  return mapScene(project, sceneId, (scene) => ({
    ...scene,
    cameras: normalizeCameraOrder(
      scene.cameras.map((camera) => (camera.id === cameraId ? updater(camera) : camera))
    )
  }))
}

export function removeCamera(
  project: Project,
  sceneId: string,
  cameraId: string
): Project {
  return mapScene(project, sceneId, (scene) => {
    if (scene.cameras.length <= 1) return scene
    return {
      ...scene,
      cameras: normalizeCameraOrder(scene.cameras.filter((camera) => camera.id !== cameraId))
    }
  })
}

/* ------------------------------------------------------------------ */
/* Assets, audio, document-level settings                             */
/* ------------------------------------------------------------------ */

export function addAsset(project: Project, asset: Asset): Project {
  return touch({ ...project, assets: [...project.assets, asset] })
}

export function removeAsset(project: Project, assetId: string): Project {
  return touch({
    ...project,
    assets: project.assets.filter((asset) => asset.id !== assetId)
  })
}

export function updateAsset(
  project: Project,
  assetId: string,
  updater: (asset: Asset) => Asset
): Project {
  return touch({
    ...project,
    assets: project.assets.map((asset) => (asset.id === assetId ? updater(asset) : asset))
  })
}

export function addSceneAudioTrack(
  project: Project,
  sceneId: string,
  track: AudioTrack
): Project {
  return mapScene(project, sceneId, (scene) => ({
    ...scene,
    audio: [...scene.audio, track]
  }))
}

export function updateSceneAudioTrack(
  project: Project,
  sceneId: string,
  trackId: string,
  updater: (track: AudioTrack) => AudioTrack
): Project {
  return mapScene(project, sceneId, (scene) => ({
    ...scene,
    audio: scene.audio.map((track) => (track.id === trackId ? updater(track) : track))
  }))
}

export function removeSceneAudioTrack(
  project: Project,
  sceneId: string,
  trackId: string
): Project {
  return mapScene(project, sceneId, (scene) => ({
    ...scene,
    audio: scene.audio.filter((track) => track.id !== trackId)
  }))
}

export function setOutputSize(
  project: Project,
  width: number,
  height: number,
  fps?: number
): Project {
  return touch({
    ...project,
    output: { width, height, fps: fps ?? project.output.fps }
  })
}

export function updateProjectSettings(
  project: Project,
  updater: (settings: Project['settings']) => Project['settings']
): Project {
  return touch({ ...project, settings: updater(project.settings) })
}
