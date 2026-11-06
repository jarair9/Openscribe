import type { JSX } from 'react'
import type { Project, Scene } from '@core/schema/project'
import type { ProjectSchedule } from '@core/timeline/schedule'
import { scenePreview } from '../../lib/scenePreview'
import { useProjectStore } from '../../state/projectStore'
import { SceneArtwork } from '../canvas/SceneArtwork'

interface SceneThumbnailProps {
  project: Project
  scene: Scene
  sceneIndex: number
  schedule: ProjectSchedule
  idPrefix: string
}

export function SceneThumbnail({
  project,
  scene,
  sceneIndex,
  schedule,
  idPrefix
}: SceneThumbnailProps): JSX.Element | null {
  const session = useProjectStore((state) => state.session)
  const visual = scenePreview(project, scene, sceneIndex, schedule)
  if (!visual) return null
  const frame = visual.camera.frame

  return (
    <svg
      viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <SceneArtwork
        project={project}
        scene={scene}
        visual={visual}
        token={session?.assetToken ?? ''}
        idPrefix={idPrefix}
      />
    </svg>
  )
}
