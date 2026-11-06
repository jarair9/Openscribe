import { SCHEMA_VERSION, type Project } from '../schema/project'

export interface ProjectIssue {
  severity: 'error' | 'warning'
  message: string
}

export interface ValidationResult {
  errors: ProjectIssue[]
  warnings: ProjectIssue[]
}

/**
 * Structural, cross-reference validation that Zod cannot express.
 * Returns issues instead of throwing so the UI can offer repairs.
 */
export function validateProject(project: Project): ValidationResult {
  const errors: ProjectIssue[] = []
  const warnings: ProjectIssue[] = []

  const assetIds = new Set<string>()
  for (const asset of project.assets) {
    if (assetIds.has(asset.id)) {
      errors.push({ severity: 'error', message: `Duplicate asset id "${asset.id}".` })
    }
    assetIds.add(asset.id)
    if (asset.kind === 'svg' && !asset.svg) {
      errors.push({ severity: 'error', message: `SVG asset "${asset.name}" has no geometry.` })
    }
    if (asset.kind === 'image' && !asset.image) {
      errors.push({ severity: 'error', message: `Image asset "${asset.name}" has no dimensions.` })
    }
    if (asset.kind === 'audio' && !asset.audio) {
      errors.push({ severity: 'error', message: `Audio asset "${asset.name}" has no metadata.` })
    }
  }

  const sceneIds = new Set<string>()
  const elementIds = new Set<string>()
  const cameraIds = new Set<string>()
  const audioIds = new Set<string>()

  project.scenes.forEach((scene, sceneIndex) => {
    if (sceneIds.has(scene.id)) {
      errors.push({ severity: 'error', message: `Duplicate scene id "${scene.id}".` })
    }
    sceneIds.add(scene.id)

    if (scene.cameras.length === 0) {
      errors.push({ severity: 'error', message: `Scene "${scene.name}" has no camera.` })
    }
    let previousStart = -Infinity
    scene.cameras.forEach((camera, cameraIndex) => {
      if (cameraIds.has(camera.id)) {
        errors.push({ severity: 'error', message: `Duplicate camera id "${camera.id}".` })
      }
      cameraIds.add(camera.id)
      if (cameraIndex === 0 && camera.startTime !== 0) {
        warnings.push({
          severity: 'warning',
          message: `Camera "${camera.name}" starts at ${camera.startTime}s; the first camera should start at 0.`
        })
      }
      if (camera.startTime < previousStart) {
        warnings.push({
          severity: 'warning',
          message: `Cameras in scene "${scene.name}" are not ordered by start time.`
        })
      }
      previousStart = camera.startTime
    })

    scene.elements.forEach((element) => {
      if (elementIds.has(element.id)) {
        errors.push({ severity: 'error', message: `Duplicate element id "${element.id}".` })
      }
      elementIds.add(element.id)

      if (element.kind === 'svg' || element.kind === 'image') {
        const asset = project.assets.find((candidate) => candidate.id === element.assetId)
        if (!asset) {
          errors.push({
            severity: 'error',
            message: `Element "${element.name}" references a missing asset.`
          })
        } else if (element.kind === 'svg' && asset.kind !== 'svg') {
          errors.push({
            severity: 'error',
            message: `Element "${element.name}" expects an SVG asset but references a ${asset.kind}.`
          })
        } else if (element.kind === 'image' && asset.kind !== 'image') {
          errors.push({
            severity: 'error',
            message: `Element "${element.name}" expects an image asset but references a ${asset.kind}.`
          })
        }
      }

      if (element.kind === 'svg' && element.drawOrder) {
        const asset = project.assets.find((candidate) => candidate.id === element.assetId)
        const known = new Set(asset?.svg?.drawables.map((drawable) => drawable.id) ?? [])
        for (const id of element.drawOrder) {
          if (!known.has(id)) {
            warnings.push({
              severity: 'warning',
              message: `Element "${element.name}" references unknown drawable "${id}".`
            })
          }
        }
      }

      if (
        (element.animation.entrance.type === 'handDraw' ||
          element.animation.entrance.type === 'penDraw') &&
        element.kind === 'image'
      ) {
        warnings.push({
          severity: 'warning',
          message: `Image element "${element.name}" uses a directional reveal because raster images do not contain drawable paths.`
        })
      }
    })

    if (scene.background.type === 'image' && !assetIds.has(scene.background.assetId)) {
      errors.push({
        severity: 'error',
        message: `Scene "${scene.name}" background references a missing asset.`
      })
    }

    scene.audio.forEach((track) => {
      if (audioIds.has(track.id)) {
        errors.push({ severity: 'error', message: `Duplicate audio track id "${track.id}".` })
      }
      audioIds.add(track.id)
      const asset = project.assets.find((candidate) => candidate.id === track.assetId)
      if (!asset) {
        errors.push({
          severity: 'error',
          message: `Audio track "${track.name}" in scene "${scene.name}" references a missing asset.`
        })
      } else if (asset.kind !== 'audio') {
        errors.push({
          severity: 'error',
          message: `Audio track "${track.name}" references a non-audio asset.`
        })
      }
    })

    if (sceneIndex > 0 && scene.cameras[0]?.startTime !== 0) {
      warnings.push({
        severity: 'warning',
        message: `Scene "${scene.name}" starts with a delayed camera.`
      })
    }
  })

  project.audio.forEach((track) => {
    const asset = project.assets.find((candidate) => candidate.id === track.assetId)
    if (!asset || asset.kind !== 'audio') {
      errors.push({
        severity: 'error',
        message: `Project audio track "${track.name}" references a missing audio asset.`
      })
    }
  })

  return { errors, warnings }
}

/* ------------------------------------------------------------------ */
/* Migration                                                          */
/* ------------------------------------------------------------------ */

export interface MigrationResult {
  ok: boolean
  project: Project | null
  error: string | null
  migrated: boolean
}

/**
 * File format migration entry point. The format is versioned; when the schema
 * changes, add a step that upgrades version N to N+1 here.
 */
export function migrateProject(raw: unknown): MigrationResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, project: null, error: 'Project file is not a JSON object.', migrated: false }
  }
  const version = (raw as { schemaVersion?: unknown }).schemaVersion
  if (typeof version !== 'number') {
    return { ok: false, project: null, error: 'Project file has no schemaVersion.', migrated: false }
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      project: null,
      error: `Project was created by a newer version (schema ${version}).`,
      migrated: false
    }
  }
  if (version < 1) {
    return {
      ok: false,
      project: null,
      error: `Unsupported project schema version ${version}.`,
      migrated: false
    }
  }
  return { ok: true, project: raw as Project, error: null, migrated: version !== SCHEMA_VERSION }
}
