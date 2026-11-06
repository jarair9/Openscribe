# Drawing Engine: Architecture and Gap Report

This report records the state of the drawing system in OpenWhiteboard Studio and the engineering work started from the supplied drawing-engine brief. It separates observed project behavior from the planned implementation.

## Current architecture

- `src/core/svg/extract.ts` sanitizes imported SVG and normalizes path commands and transforms. The project stores individual drawable paths, their order, bounds, lengths and style data.
- `src/core/animation/evaluate.ts` evaluates entrance, emphasis and exit states from scene-local time. `src/core/animation/scene.ts` combines those results with the scene camera.
- SVG strokes reveal by dash offset. Text defaults to ordered Hershey Script single-line strokes, with explicit pen-up travel segments and a hand that samples the same path used for the ink. Users can switch to a selected-system-font reveal when they need their chosen font family; unsupported non-ASCII text also falls back to that mode.
- Raster images do not contain drawing trajectories. They use a directional reveal fallback.
- Preview derives its playhead from the shared schedule. The hand overlay used to sample DOM path length and point-at-length directly.
- Hand art is a single transparent PNG pose referenced by a static import. Its tip anchor, size, aspect ratio and rotation behavior are fixed in `src/core/instruments.ts`. A second built-in instrument is a vector pen. There is no custom-hand import or calibration UI.
- The inspected renderer code contains no frame-to-video export pipeline. Preview and an export renderer therefore cannot yet be compared for parity.

## Work implemented in this pass

Added `src/core/drawing/trajectory.ts`, a deterministic geometry evaluator for normalized SVG paths. It samples lines, quadratic and cubic curves, arcs converted to cubics, closed contours and separate subpaths. It returns position and tangent at a normalized progress value. Separate subpaths remain separate and no synthetic connecting line is generated.

`InstrumentOverlay` now uses that evaluator to place and orient the hand from the active path's evaluated progress. DOM geometry is used only to convert the local path point into the active SVG/canvas coordinate space. Trajectories are cached by path element and path data.

Added focused tests for line sampling, cubic tangents, disconnected subpaths, arcs and closed contours.

## Requirements still missing

1. **Hand asset system:** versioned manifest, multiple compatible poses, original/licensed production art, hand import, crop, tip and pivot calibration, per-pose preview and local reusable presets.
2. **Stroke scheduler:** explicit stroke groups, pen-up travel duration, natural pauses, per-stroke motion profiles and path order editing. Multiple subpaths inside one SVG path currently reveal as one drawable even though the hand trajectory recognizes the subpaths separately.
3. **Text trajectories:** the default Latin writing path now uses Hershey Script single-line strokes with pen-up travel and deterministic hand alignment. Broader language coverage, custom stroke-font import, and per-glyph stroke order editing remain open. Ordinary system fonts retain the clearly labeled glyph reveal fallback.
4. **Raster processing:** line-art classification, centerline extraction, color/filled-image fallback selection and editable trajectory metadata.
5. **Materials and fill:** pen/marker/pencil materials, variable-width strokes, ink compositing and better fill reveal behavior.
6. **Export:** deterministic frame renderer, video encoder, audio muxing and visual parity checks with Preview.
7. **Persistence and calibration:** save custom hand asset references and calibration values in versioned project data, with schema migration and undo/redo support.

## Engineering sequence

1. Build the hand manifest and local preset/calibration workflow.
2. Split SVG subpaths into separately scheduled strokes and animate pen lifts deterministically.
3. Connect ink and hand transforms to the same trajectory evaluator.
4. Add stroke fonts and ordinary-font conversion as separate, clearly labeled text modes.
5. Add raster line-art processing and intentional fallbacks for color images.
6. Add frame export, audio muxing and preview/export comparisons.
7. Complete pose coverage, license inventory, performance profiling and visual fixtures.

## Asset and validation notes

### Hand image authoring and calibration

Hand artwork is rendered at its authored angle. Do not rotate the image to make it follow a path: the pen-tip anchor follows the evaluated writing point, while the hand and forearm only translate. The default hand target is 40% of stage width; it grows as needed to put the authored cuff edge beyond the clipped stage.

Use a transparent PNG with the pen tip near the upper-left and the forearm running toward the lower-right. The image should show a complete, natural hand and a long forearm, with the bottom edge located beyond the stage at the intended display scale. Avoid a short wrist-only crop. Keep the PNG canvas tight enough that its pen tip can be calibrated precisely, and record its normalized `tip` (x and y from 0 to 1), aspect ratio, and asset provenance in the corresponding instrument definition/catalog record. Paired poses need a separately calibrated anchor for each frame.

For visual calibration, open preview with `?debugHand=1`. The red dot is the evaluated writing point and the red rectangle is the current sprite bounds. Click the pen tip in the sprite to pick a temporary anchor; the normalized anchor is printed in the developer console for copying into the hand definition. Debug picking is session-only. Left-handed text mirrors the fixed-angle sprite around the calibrated tip; the image is never rotated. `Write right-to-left` independently controls glyph order and reveal direction.

The current hand PNG has transparent pixels at its corners; the checker pattern shown by image viewers is a transparency preview rather than part of the PNG. Its original source and redistribution license are not documented, so it should remain a development asset until provenance is recorded. An attempt to generate a new original pose with the available image-generation service returned HTTP 403; no replacement asset was added.

The new trajectory tests pass (4 tests). `npm run build` and its TypeScript checks pass. These checks establish geometry and build correctness, not photorealism or VideoScribe parity. Visual validation still needs straight-line, curved-line and multi-stroke scenes plus Preview/export comparison after an export renderer exists.
