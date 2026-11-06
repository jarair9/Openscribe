import { cameraFrame } from '@core/camera/sample'
import { rotatedRectBounds, unionRects } from '@core/geometry'
import type { Rect } from '@core/schema/primitives'
import type { OutputSettings, Project, Scene } from '@core/schema/project'

/** The artboard is larger than the output frame so the camera can pan and crop. */
const PAGE_SCALE = 1.25

/** The full white artboard for a project, centered on the world origin. */
export function pageFrameOf(output: OutputSettings): Rect {
  const width = output.width * PAGE_SCALE
  const height = output.height * PAGE_SCALE
  return { x: -width / 2, y: -height / 2, width, height }
}

/**
 * World-space rectangle that should be visible when fitting a scene in the
 * editor: the whole artboard plus every camera frame and element, so off-page
 * artwork and cameras can be framed without hunting for them.
 */
export function fitBoundsOfScene(project: Project, scene: Scene): Rect {
  const rects: Rect[] = [pageFrameOf(project.output)]
  for (const element of scene.elements) {
    if (!element.visible) continue
    rects.push(rotatedRectBounds(element.frame, element.rotation))
  }
  for (const camera of scene.cameras) {
    rects.push(cameraFrame(camera, project.output))
  }
  return unionRects(rects) ?? pageFrameOf(project.output)
}

/** Content bounds only, used for thumbnails and zoom-to-fit. */
export function contentBoundsOf(scene: Scene): Rect | null {
  const rects = scene.elements
    .filter((element) => element.visible)
    .map((element) => rotatedRectBounds(element.frame, element.rotation))
  return unionRects(rects)
}
