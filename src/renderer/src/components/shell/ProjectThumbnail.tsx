import { useEffect, useMemo, useState, type JSX } from 'react'
import type { PeekedProject } from '@shared/ipc'
import { scheduleFor } from '@core/timeline/scheduleCache'
import { scenePreview } from '../../lib/scenePreview'
import { SceneArtwork } from '../canvas/SceneArtwork'

/**
 * Standalone first-scene preview for a project on disk. Peeking registers a
 * read-only session so image assets resolve, without opening the editor.
 */
export function ProjectThumbnail({
  filePath,
  idPrefix
}: {
  filePath: string
  idPrefix: string
}): JSX.Element {
  const [peeked, setPeeked] = useState<PeekedProject | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPeeked(null)
    setFailed(false)
    window.api.project
      .peek(filePath)
      .then((result) => {
        if (!cancelled) setPeeked(result)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [filePath])

  const preview = useMemo(() => {
    if (!peeked) return null
    const scene = peeked.document.scenes[0]
    if (!scene) return null
    try {
      return {
        scene,
        visual: scenePreview(peeked.document, scene, 0, scheduleFor(peeked.document))
      }
    } catch {
      return null
    }
  }, [peeked])

  if (failed) return <div className="project-thumb project-thumb-fallback" aria-hidden="true" />
  if (!peeked) return <div className="project-thumb project-thumb-loading" aria-hidden="true" />

  const scene = preview?.scene
  const visual = preview?.visual
  if (!scene || !visual) return <div className="project-thumb project-thumb-fallback" aria-hidden="true" />

  const frame = visual.camera.frame
  // An empty scene renders as a blank page, which is easy to confuse with a
  // broken project. Label it so the card still says something.
  const empty = scene.elements.length === 0
  return (
    <>
      <svg
        className="project-thumb"
        viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <SceneArtwork
          project={peeked.document}
          scene={scene}
          visual={visual}
          token={peeked.assetToken}
          idPrefix={idPrefix}
        />
      </svg>
      {empty ? (
        <span className="project-thumb-empty" aria-hidden="true">
          Empty scene
        </span>
      ) : null}
    </>
  )
}
