# Openscribe threat model

Builds on the **Scope** section of `SECURITY.md` (user-provided). Items marked *(inferred)* come from reading the code, not from the maintainer.

## System overview and trust boundaries
Openscribe is a local-first Electron desktop app (Windows primary target, `electron-builder --win`). Per `SECURITY.md`, projects, assets and exports stay on the user's machine and the app makes no network requests. No backend, no accounts, no infrastructure code (no Terraform/K8s/etc.; none exists).

Trust boundaries:
1. **Untrusted files → app**: `.owsproj` project files (JSON + sibling `assets/` folder), imported SVG/raster/audio files.
2. **Renderer → main** over IPC (`src/preload/index.ts` exposes `window.api`; handlers in `src/main/ipc.ts`). The renderer is sandboxed (`sandbox`, `contextIsolation`, no `nodeIntegration`) and must be treated as potentially compromised.
3. **Main → OS**: filesystem writes (projects, assets, export frames), `child_process.spawn` of ffmpeg (`src/main/ffmpeg.ts`), `shell.openPath` / `shell.openExternal`.

## Components
| Name | Code | Notes |
| --- | --- | --- |
| **Main process** | `src/main/index.ts`, `window.ts`, `logger.ts` | Window config, navigation/permission handlers |
| **IPC bridge** | `src/preload/`, `src/main/ipc.ts`, `src/shared/ipc.ts`, `src/shared/api.ts` | Privileged API surface for the renderer |
| **Project & asset storage** | `src/main/projectStore.ts`, `assets.ts`, `sessions.ts`, `library.ts`, `protocol.ts` | File I/O, `ows-asset://` / `ows-library://` protocols |
| **Export & ffmpeg** | `src/main/export.ts`, `ffmpeg.ts` | Frame writing, ffmpeg spawn, system-PATH fallback |
| **Renderer** | `src/renderer/` | React UI, canvas, timeline; CSP in `src/renderer/index.html` |
| **Core engine** | `src/core/` | Schema/validation (zod), SVG sanitize/extract (`core/svg/extract.ts`), animation |
| **Build tooling** | `scripts/`, `tools/`, `electron-builder.yml`, `.github/` | Dev/build-time only |

## Entry points
- Opening a project file (`project:open`, `project:peek`) — JSON parsed, migrated, `parseProject` + `validateProject`.
- Importing assets (`asset:ingest`, drag-drop via `webUtils.getPathForFile`), voiceover save (`asset:save-audio`).
- SVG import: parsed with `DOMParser`, dangerous tags stripped, only geometry rendered (raw markup never injected).
- IPC handlers taking renderer-supplied paths: `project:open/peek/save/save-as/create`, `export:prepare/reveal`, `asset:ingest`.
- Custom protocols `ows-asset://asset/<token>/<file>` and `ows-library://asset/<path>`.
- `setWindowOpenHandler` → `shell.openExternal` for `https://` URLs.

## Assets
- User's local files and filesystem integrity (arbitrary read/write would be the worst outcome).
- Code execution on the user's machine (via ffmpeg args, `shell.openPath`, renderer escape).
- User project content and microphone access (permission handler allows `media`/audio only).

## Attacker profiles (from `SECURITY.md` scope)
1. **Crafted content author**: sends a victim a malicious `.owsproj` project or imported SVG aiming for code execution (SECURITY.md: "Code execution via crafted project files or imported SVGs").
2. **Compromised renderer**: escalates through the IPC bridge (SECURITY.md: "Privilege escalation through the IPC bridge"), e.g. path traversal in project/asset handling ("Path traversal in project/asset file handling").
3. **Configuration weaknesses**: unsafe Electron window or protocol configuration (SECURITY.md).
- **Maintainer answer:** attackers 1 (crafted files) and 2 (compromised renderer) matter equally.
- Remote network attackers: no network surface claimed *(inferred: confirm no fetches/auto-update)*.

## Existing controls (inferred from code)
- Sandboxed renderer, context isolation, `webSecurity`, navigation and webview blocked, permissions limited to audio.
- Asset access via unguessable per-project session token; `isSafeFileName` + resolve-and-prefix checks; library path realpath check.
- Project documents validated with zod schema before open/save.
- SVG sanitization strips dangerous tags before geometry extraction.
- Atomic project writes via temp file.

## Out of scope / accepted risk
- The maintainer ruled nothing out of scope and accepts no specific risk; all findings matter.

## Open questions
- IPC handlers accept arbitrary absolute paths from the renderer (e.g. `project:save`, `export:reveal`) — is renderer-chosen path access acceptable by design? *(inferred concern)*
