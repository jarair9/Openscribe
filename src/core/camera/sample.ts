import { ease, lerpLog, progress as progressOf } from '../math'
import type { Rect } from '../schema/primitives'
import type { Camera, OutputSettings } from '../schema/project'

export function cameraFrameHeight(viewWidth: number, output: OutputSettings): number {
  return (viewWidth * output.height) / output.width
}

export function cameraFrame(camera: Camera, output: OutputSettings): Rect {
  const height = cameraFrameHeight(camera.viewWidth, output)
  return {
    x: camera.center.x - camera.viewWidth / 2,
    y: camera.center.y - height / 2,
    width: camera.viewWidth,
    height
  }
}

export interface CameraSample {
  cameraId: string
  frame: Rect
  /** 0..1 progress of the transition into this camera, or 1 when settled. */
  transitionProgress: number
  transitioning: boolean
}

/**
 * Evaluate camera state at a scene-local timestamp.
 *
 * Cameras are ordered by activation time (maintained by document operations).
 * A camera transition moves the viewport from the previous camera to the
 * active one; the artwork never moves.
 */
export function sampleCamera(
  cameras: Camera[],
  localTime: number,
  output: OutputSettings
): CameraSample {
  const first = cameras[0]
  if (!first) {
    return {
      cameraId: '',
      frame: { x: 0, y: 0, width: output.width, height: output.height },
      transitionProgress: 1,
      transitioning: false
    }
  }
  let activeIndex = 0
  for (let index = 1; index < cameras.length; index += 1) {
    if (cameras[index]!.startTime <= localTime) activeIndex = index
  }
  const active = cameras[activeIndex]!
  if (activeIndex === 0) {
    return {
      cameraId: active.id,
      frame: cameraFrame(active, output),
      transitionProgress: 1,
      transitioning: false
    }
  }

  const previous = cameras[activeIndex - 1]!
  const duration = active.transition.duration
  const raw = progressOf(active.startTime, active.startTime + duration, localTime)
  if (raw >= 1 || duration <= 0) {
    return {
      cameraId: active.id,
      frame: cameraFrame(active, output),
      transitionProgress: 1,
      transitioning: false
    }
  }

  const eased = ease(active.transition.easing, raw)
  const viewWidth = lerpLog(previous.viewWidth, active.viewWidth, eased)
  const height = cameraFrameHeight(viewWidth, output)
  return {
    cameraId: active.id,
    frame: {
      x: previous.center.x + (active.center.x - previous.center.x) * eased - viewWidth / 2,
      y: previous.center.y + (active.center.y - previous.center.y) * eased - height / 2,
      width: viewWidth,
      height
    },
    transitionProgress: eased,
    transitioning: true
  }
}

/** Build a camera framing a world rectangle with some breathing room. */
export function cameraFramingRect(
  rect: Rect,
  output: OutputSettings,
  padding = 1.25
): { center: { x: number; y: number }; viewWidth: number } {
  const aspect = output.width / output.height
  const width = Math.max(rect.width * padding, rect.height * padding * aspect, 64)
  return {
    center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
    viewWidth: width
  }
}
