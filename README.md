# Openscribe

A local-first, open-source whiteboard animation studio — an independent alternative to tools like VideoScribe. Draw, animate, narrate, and export whiteboard videos entirely offline.

Built with Electron, React 19, TypeScript, and Vite.

## Features

- Interactive, effectively unbounded whiteboard canvas
- SVG and raster illustration import
- Progressive vector drawing animations
- Animated hand and pen overlays
- Text and shape tools with bundled fonts
- Multiple scenes and virtual cameras (pan, zoom, transitions)
- Time-based animation engine with simple and advanced timelines
- Entrance, emphasis, and exit animation stages
- Audio and narration editing
- Backgrounds, transitions, and deterministic playback/scrubbing
- Local video and GIF export via bundled FFmpeg
- Reusable local asset library
- Save, open, autosave, crash recovery, undo, and redo
- 100% offline workflow

## Requirements

- Node.js 20 or newer
- Windows (primary target; packaging is configured with `electron-builder --win`)

## Getting started

```bash
npm install
npm run dev
```

The dev server regenerates the hand catalog before starting.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the app in development mode |
| `npm run build` | Typecheck and build the production bundle |
| `npm run typecheck` | Typecheck main and renderer projects |
| `npm test` | Run the Vitest suite |
| `npm run package` | Build and produce a Windows installer |

## Project layout

```
src/
  main/        Electron main process (windows, files, export, IPC)
  preload/     Preload bridge
  renderer/    React UI, canvas, timeline, inspector, styles
resources/     Icons, fonts, bundled binaries
scripts/       Build-time generators
tests/         Vitest test suites
docs/          Engine and asset documentation
```

## Documentation

- [`project-context.md`](project-context.md) — product and engineering scope
- [`docs/bundled-assets-and-drawing.md`](docs/bundled-assets-and-drawing.md) — drawing engine and assets
- [`docs/drawing-engine-status.md`](docs/drawing-engine-status.md) — current engine status
- [`videoscribe-analysis.md`](videoscribe-analysis.md) — feature comparison notes

## License

MIT
