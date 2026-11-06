import type { JSX, MouseEvent as ReactMouseEvent } from 'react'
import type { InstrumentDefinition } from '@core/instruments'
import { libraryAssetUrl } from '../../lib/assets'

/**
 * Bundled photographic instrument preset rendered only in the playback
 * preview. Catalog assets may include a second VideoScribe hand frame; the
 * frame and its calibrated nib anchor switch together from one shared pose.
 */
export function HandInstrumentArt({
  instrument,
  secondPose = false,
  onImageClick
}: {
  instrument: InstrumentDefinition
  secondPose?: boolean
  onImageClick?: (event: ReactMouseEvent<SVGImageElement>) => void
}): JSX.Element {
  const selectedAsset =
    secondPose && instrument.assetPath2 ? instrument.assetPath2 : instrument.assetPath
  return (
    <>
      <image
        href={selectedAsset ? libraryAssetUrl(selectedAsset) : undefined}
        x={0}
        y={0}
        width={instrument.aspect * 100}
        height={100}
        preserveAspectRatio="none"
        onClick={onImageClick}
        style={onImageClick ? { cursor: 'crosshair' } : undefined}
      />
    </>
  )
}
