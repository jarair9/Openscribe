# Bundled assets and whiteboard drawing

## Bundled catalog

`open-assets` is exposed to the renderer through the read-only `ows-library` protocol. The renderer receives catalog records and preview URLs; the main process validates every item ID and copies a selected file into the active project through the normal content-sniffing asset importer. Renderer code never supplies an arbitrary filesystem path.

The asset dialog's **Bundled library** tab covers characters, illustration styles, illustrations, and UI icons. Hand and pen tool files are kept out of the media library; users choose from the 336 metadata hands and four grouped tool presets in the animation inspector instead. The tool presets use all six supplied hand-and-pen-tools images (eraser and marker pairs plus the open hand and standalone pen). **Add & insert** copies a selected media item into the project and places it in the active scene using the normal SVG or image import flow.

Hand instrument presets are generated from `open-assets/hands/hands-metadata.json` by `npm run generate:hand-catalog`. The inspector groups 336 presets by their recorded category. Where present, the supplied second pose is alternated during the drawing and its second metadata offset is used with that frame. 312 of the 336 presets have a second frame. Invalid or out-of-canvas offsets use a neutral fallback; precise per-preset tip calibration is not yet exposed in the UI.

The source metadata identifies the hand catalog author as Sparkol. The catalog files are user-supplied assets; this project does not claim authorship of them. Review their provenance and redistribution terms before publishing an installer containing the full library. The current packaging configuration copies the supplied folders as-is (about 325 MB across the requested categories).

## Drawing and erasing behavior

- SVG hand and pen entrances share deterministic path sampling with the artwork reveal. The supplied hand PNGs are only displayed by the playback instrument overlay.
- Text defaults to the bundled Hershey Script single-stroke font. Its glyphs are real vector pen strokes, scheduled in order with invisible pen-up travel paths between disconnected strokes; the hand samples the exact path that draws the ink. **Selected font reveal** remains available when preserving a system font is more important than pen-stroke motion. Non-ASCII characters fall back to the selected-font reveal until stroke glyphs are available.
- Raster images have no source stroke data, so they use a directional reveal fallback.
- The new **Erase across** exit reverses a directional clip reveal, keeping opacity stable while a visible edge removes the object. It is a whiteboard-style erase sweep, not a simulated physical eraser rubbing surface texture.

The sibling Python project `whiteboard-animation-vi` is a frame renderer for raster images with subject/color grouping and scheduled hand frames. Its segmentation pipeline is not a drop-in replacement for this editor's editable SVG scene model; this integration reuses the deterministic trajectory and frame concepts without importing its Python runtime into the Electron app.

The bundled Hershey Script glyph coordinates are extracted from `hersheytextjs`; its upstream project identifies the font JSON data as public domain. Only the small cursive glyph table is bundled here, without its Node runtime dependency.
