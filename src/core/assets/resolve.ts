import type { Asset, Drawable, Project, SvgElement } from '../schema/project'
import type { Element } from '../schema/project'

export function findAsset(project: Project, assetId: string): Asset | undefined {
  return project.assets.find((asset) => asset.id === assetId)
}

export function drawablesForElement(
  project: Project,
  element: Element
): Drawable[] {
  if (element.kind !== 'svg') return []
  const asset = findAsset(project, (element as SvgElement).assetId)
  return asset?.svg?.drawables ?? []
}

/** Asset ids referenced anywhere in the document. */
export function collectReferencedAssetIds(project: Project): Set<string> {
  const ids = new Set<string>()
  for (const scene of project.scenes) {
    if (scene.background.type === 'image') ids.add(scene.background.assetId)
    for (const element of scene.elements) {
      if (element.kind === 'svg' || element.kind === 'image') ids.add(element.assetId)
    }
    for (const track of scene.audio) ids.add(track.assetId)
  }
  for (const track of project.audio) ids.add(track.assetId)
  return ids
}
