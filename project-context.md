# MASTER ENGINEERING PROMPT — BUILD A COMPLETE OPEN-SOURCE WHITEBOARD ANIMATION EDITOR FROM SCRATCH

## 1. ROLE AND MISSION

You are an autonomous principal software architect, senior desktop application developer, graphics and rendering engineer, vector animation specialist, timeline systems engineer, video encoding engineer, UI/UX designer, QA engineer, and open-source maintainer.

Your mission is to design, implement, test, document, package, and deliver a complete, usable, production-quality whiteboard animation application from the ground up.

The application will be an independent, open-source alternative to professional whiteboard animation software such as VideoScribe. It must reproduce the major categories of user-visible functionality expected from a modern whiteboard animation editor, including:

- An interactive, virtually unlimited whiteboard canvas.
- SVG and raster illustration importing.
- Progressive vector drawing animations.
- Animated hand and pen overlays.
- Text and shape tools.
- Multiple scenes.
- Virtual cameras with pan, zoom, and transitions.
- A time-based animation engine.
- Simple and advanced timelines.
- Animation entrance, emphasis, and exit stages.
- Audio and narration editing.
- Backgrounds and scene transitions.
- Playback, timeline scrubbing, and deterministic rendering.
- High-quality local video and GIF export.
- A reusable local asset library.
- Save, open, autosave, recovery, undo, and redo.
- Professional desktop UI/UX.
- A complete offline workflow.
- Installation packages, tests, technical documentation, and contributor documentation.

This is an implementation assignment, not a research-only assignment.

You must actually build the software in the available repository, run it, verify it, fix defects, and deliver working functionality in incremental stages.

**Do not stop after writing an architecture document, producing mockups, creating a starter template, or implementing a visually impressive but nonfunctional interface.**

Every major feature must be connected to the real project model, animation engine, and rendering pipeline.

---

# 2. PRODUCT VISION AND PRINCIPLES

Create a desktop application with a working title of `OpenWhiteboard Studio`. Keep the product name configurable so that it can be changed later without rewriting the application.

The product should feel like a professional creative desktop application: predictable, responsive, visually polished, easy to learn, and powerful enough for complex projects.

The software must follow these principles.

### 2.1 Local-first

All core workflows must operate on the user's own computer.

The application must not require:

- An account.
- A subscription.
- A remote backend.
- A cloud database.
- Cloud project storage.
- Cloud synchronization.
- Online authentication.
- A remote media library.
- A mandatory AI API.
- Telemetry or analytics services.
- A network connection during normal operation.

Projects and imported media must remain under the user's control.

### 2.2 Open-source first

Build the application for public release, inspection, modification, redistribution, and community contributions.

Include:

- A recognized open-source license.
- Complete source code for the application.
- Dependency and third-party license notices.
- A reproducible build process.
- Contributor instructions.
- Installation instructions.
- Clear documentation of supported functionality and limitations.
- Sample projects and assets with appropriate licenses.

Do not build an architecture that requires a private hosted service to make the editor work.

### 2.3 Independent implementation

Use public documentation and visible behavior of existing applications as functional references.

You may study a legitimately available reference application through its normal UI and documented interfaces to understand how its workflows behave.

Do not copy proprietary source code, extract and redistribute commercial asset libraries, reuse proprietary branding, bypass access controls, or represent inferred internal implementation details as facts.

Implement independent code, original UI assets, and a documented project format.

The objective is functional parity across major editing workflows, not an unauthorized copy of proprietary internals.

### 2.4 Real functionality over superficial completion

Do not implement controls that merely look functional.

Every button, menu item, toolbar action, timeline interaction, inspector field, and keyboard shortcut must either perform its advertised operation or be clearly marked as unavailable.

Do not silently substitute placeholder implementations for difficult subsystems.

Do not claim that a feature is complete until its implementation has been tested.

---

# 3. AUTONOMOUS ENGINEERING WORKFLOW

Work directly in the available repository.

## Initial inspection

Before modifying anything:

1. Inspect the entire repository structure.
2. Read existing documentation, dependency manifests, configuration files, source code, and tests.
3. Identify the current framework, build system, installed dependencies, and existing application state.
4. Determine whether a functioning project already exists.
5. Preserve useful code and working features rather than replacing everything unnecessarily.
6. Identify the operating system and available build tools.
7. Inspect available reference applications and public documentation when accessible and useful.
8. Record major architectural decisions and constraints.
9. Establish the baseline by running existing tests and builds when possible.
10. Create an implementation plan based on what you actually find.

Do not assume that the repository is empty.

If you have access to authorized UI automation, application-inspection tools, or relevant installed skills, use them to examine observable reference behavior. Do not assume that any particular tool or MCP service exists unless it is actually available.

## Autonomous execution

After the initial inspection:

- Begin implementing the application.
- Work in small, verifiable increments.
- Run the relevant tests after every substantial change.
- Start the actual application and inspect its behavior.
- Fix problems discovered during testing.
- Keep project documentation updated as the architecture evolves.
- Maintain a list of completed features, known defects, and remaining work.
- Continue beyond the initial milestone until the available work is implemented or a genuine blocker prevents further progress.

Do not repeatedly ask the user to approve routine technical choices.

Make reasonable engineering decisions, document assumptions, and continue.

If a dependency, tool, operating-system limitation, or unimplemented capability blocks progress, explain the exact blocker, evaluate alternatives, and continue with the best practical solution.

Do not claim that you tested a feature when you have only read its source code.

---

# 4. RECOMMENDED TECHNOLOGY STACK

Use the following stack as the default unless repository inspection or a reproducible technical experiment demonstrates a compelling reason to change it.

Do not add technologies merely because they are popular.

## Desktop shell

- Electron.
- TypeScript.
- Node.js for privileged local operations.
- Vite for development and frontend builds.

Target Windows first because it is the primary development environment, but design the application so that macOS and Linux can be supported later.

Electron is chosen to make use of Chromium's SVG rendering capabilities and to simplify access to local files and native media-processing tools.

## Frontend

- React.
- TypeScript in strict mode.
- Vite.
- Zustand or another appropriately lightweight state-management solution.
- Zod or equivalent schema validation.
- CSS variables and reusable design tokens.
- Lucide icons or another suitably licensed icon library.

Use a consistent component architecture. Avoid giant components, duplicated business logic, and unstructured global state.

## Graphics

Use SVG as a central representation for editable vector content and vector drawing effects.

Use Canvas 2D where it provides a practical advantage for high-frequency interaction, selection overlays, or other performance-sensitive operations.

Use raster images for bitmap assets and rasterization where appropriate.

Do not unnecessarily convert vector assets into raster images because that would destroy information needed by the drawing animation engine.

## Project persistence

Use a versioned, JSON-based document schema with a local filesystem project directory.

Use ZIP or a comparable well-supported archive format for portable, self-contained project packages.

Treat the file format as a public interface that must remain documented and support schema migrations.

Do not require an external database server. SQLite may be used locally for application metadata or asset indexing if it offers a clear benefit, but it must not become a prerequisite for opening basic project files.

## Video and audio processing

Evaluate a local FFmpeg-based pipeline or another suitable local encoding system.

Use a rendering architecture capable of generating frames at precise timestamps and encoding those frames with the corresponding audio.

Before distributing media-processing binaries, inspect their actual licenses and compile-time dependencies. Include the required notices and source-code compliance material.

Do not silently introduce proprietary components or license obligations incompatible with the chosen open-source distribution model.

## Testing

Use appropriate tools such as:

- Vitest for unit and component-level testing.
- Playwright or equivalent for UI and end-to-end testing.
- Native integration tests for privileged filesystem and export operations.
- Golden-image or frame-comparison tests for rendering.
- Automated project save/load and migration tests.

The final choice of each library must be documented in the architecture decision records.

---

# 5. REQUIRED ARCHITECTURE

Implement the application as a collection of clearly separated subsystems.

At a minimum, define these modules:

1. Desktop application and lifecycle.
2. UI shell and navigation.
3. Project/document model.
4. Project persistence and migration.
5. Asset import and local asset management.
6. Canvas interaction and coordinate transforms.
7. Vector and raster graphics rendering.
8. Animation definitions and evaluation.
9. Hand and pen rendering.
10. Camera and scene management.
11. Timeline editor.
12. Timeline scheduler and playback clock.
13. Text and shape rendering.
14. Audio management and playback.
15. Frame rendering and compositing.
16. Video and GIF export.
17. Undo/redo and command history.
18. Autosave and crash recovery.
19. Settings and keyboard shortcuts.
20. Packaging, diagnostics, and testing.

These modules may be grouped into appropriate packages, but their responsibilities must remain clear.

## Core architectural rule

The editable project document is the source of truth.

The canvas, timeline, selection state, properties inspector, playback preview, and exported video must be different views of the same underlying project data.

An edit made in one part of the interface must propagate correctly to all other relevant parts.

The animation system must not exist independently of the project model, and export must not reconstruct the project from UI components or screenshots.

Create an architecture diagram and document the public interfaces between these modules.

---

# 6. PROFESSIONAL DESKTOP INTERFACE

Design the application as a modern desktop creative tool rather than a generic website placed inside a desktop window.

Use an understated professional design system.

Recommended characteristics:

- Dark or neutral professional editor chrome.
- Bright whiteboard canvas.
- Clear typography.
- Consistent spacing and alignment.
- Restrained accent colors.
- High-quality icons.
- Visible keyboard focus.
- Tooltips for unfamiliar controls.
- Resizable panels.
- Context menus.
- Useful loading, empty, error, and recovery states.
- Appropriate confirmation for destructive operations.
- No unnecessary gradients, oversized cards, excessive rounded corners, or distracting decoration.

Prefer a well-organized interface with compact controls and sufficient working space for the canvas.

## Required primary layout

Build an interface containing:

### Top application bar

- Application identity.
- Project name.
- Save state.
- Undo and redo.
- Project settings.
- Preview/playback.
- Export.
- Preferences.

### Left tool panel

- Selection tool.
- Pan tool.
- Text tool.
- Shape tools.
- Image/SVG import.
- Background controls.
- Local asset library.
- Other drawing or creation tools as they become available.

### Central canvas

- Editable whiteboard.
- Element selection.
- Transform handles.
- Camera objects.
- Camera viewport indicators.
- Guides and snapping.
- Zoom controls.
- Pan controls.
- Optional grid.
- Canvas context menu.

### Right properties inspector

Display context-sensitive properties for the current selection, including:

- Position.
- Size.
- Rotation.
- Opacity.
- Asset information.
- Animation settings.
- Layer order.
- Visibility.
- Lock state.
- Relevant object-specific properties.

### Scene manager

Provide a panel or strip for:

- Scene thumbnails.
- Scene creation.
- Scene duplication.
- Scene deletion.
- Scene reordering.
- Scene properties.
- Scene duration and transitions where appropriate.

### Timeline

Provide a resizable bottom panel containing a simple timeline and an advanced timeline mode.

### Dialogs and menus

Implement native-feeling open/save dialogs, asset-import dialogs, export settings, preferences, and context menus.

Use reusable components and shared design tokens throughout the interface.

---

# 7. PROJECT CREATION AND DOCUMENT MODEL

Create a complete project lifecycle.

## New project

Allow users to create projects with:

- Project name.
- Output aspect ratio.
- Output resolution.
- Frame rate.
- Background.
- Default scene.
- Default camera.
- Default animation settings.

Include common aspect ratios:

- 16:9 landscape.
- 1:1 square.
- 9:16 portrait.
- A custom ratio.

Support common video output resolutions, including 720p and 1080p. Design the system so higher resolutions can be added without changing the underlying project model.

## Recommended document structure

The document should contain:

Project:
- Schema version.
- Project identifier.
- Metadata.
- Output settings.
- Global settings.
- Scenes.
- Project-level audio.
- Asset references.
- Version information.

Scene:
- Identifier.
- Name.
- Background.
- Drawable elements.
- Camera positions or camera objects.
- Timeline events.
- Scene-level audio.
- Scene transition settings.

Element:
- Identifier.
- Asset reference or native content.
- Element type.
- World-space transform.
- Visibility.
- Lock state.
- Layer/order information.
- Animation settings.
- Additional type-specific properties.

Animation:
- Type.
- Start time or scheduling information.
- Duration.
- Delay or pause.
- Options.
- Easing where appropriate.
- Initial and final state where necessary.

Camera:
- Identifier.
- Scene association.
- World-space center.
- Viewport dimensions or equivalent zoom representation.
- Aspect ratio.
- Timeline position.
- Transition duration.
- Interpolation settings.

Audio track:
- Asset reference.
- Track type.
- Timeline offset.
- In-point.
- Out-point.
- Volume.
- Fade settings.
- Scene or project scope.

Define these models using strong TypeScript types and runtime validation.

Use stable IDs instead of relying on array positions as persistent identifiers.

## Save and load

Implement:

- New project.
- Open project.
- Save.
- Save as.
- Duplicate project.
- Import project package.
- Export portable project package.
- Validate document.
- Recover from interrupted saves.
- Migrate older schema versions.
- Handle missing assets gracefully.

Save the document using a safe atomic-write strategy wherever applicable.

A corrupted or partially written project should not automatically destroy the last valid saved version.

---

# 8. CANVAS AND COORDINATE SYSTEM

Implement the canvas as a two-dimensional world viewed through an independently controlled editor viewport.

Do not confuse the editor viewport with the output camera.

Maintain distinct coordinate systems for:

1. Project world coordinates.
2. Editor viewport coordinates.
3. Screen and device-pixel coordinates.
4. Output video coordinates.
5. Animation-time-dependent coordinates.

All conversions must be centralized in a well-tested transform system.

## Required canvas interactions

- Click to select an element.
- Drag to move.
- Resize with handles.
- Rotate with a rotation handle.
- Multi-select.
- Add/remove items from selection.
- Select all.
- Delete selected elements.
- Copy, cut, paste, and duplicate.
- Bring forward and send backward.
- Lock and unlock.
- Hide and show.
- Pan the viewport.
- Zoom in and out.
- Fit all content.
- Center selected content.
- Snap and align elements.
- Display selection bounds.
- Display camera bounds.
- Support appropriate modifier keys.

A camera pan must not alter an object's world position.

Moving an object must not accidentally change the camera.

Zooming the editor viewport must not change the output video dimensions or the object's intended world transform.

Implement proper hit-testing, pointer capture, cancellation handling, selection behavior, and undoable editing commands.

Handle negative coordinates, large projects, resizing, and high-DPI displays without incorrect placement.

---

# 9. ASSET IMPORT AND MANAGEMENT

Create a robust local media pipeline.

## Supported core formats

Implement support for:

- SVG.
- PNG.
- JPEG/JPG.
- GIF.
- WAV.
- MP3.
- Other audio formats where support is practical and appropriately licensed.

Support text, native vector shapes, and generated application-native content as separate element types.

## Asset import sequence

For each imported file:

1. Check file accessibility and size.
2. Identify and validate its actual content format.
3. Reject malformed or unsupported files with helpful errors.
4. Sanitize SVG input.
5. Decode supported formats.
6. Extract dimensions and metadata.
7. Preserve vector geometry when possible.
8. Generate thumbnails.
9. Generate optional waveform metadata for audio.
10. Register a stable asset identifier.
11. Store or copy the asset into the project-managed asset directory as appropriate.
12. Create the corresponding editable document element.

Do not make projects depend accidentally on images stored in a temporary directory or at an arbitrary external path.

## SVG requirements

Preserve SVG path information needed by the drawing animation engine.

Handle viewBox, transforms, path styles, fills, strokes, opacity, supported clipping, and common SVG constructs.

Document unsupported SVG features.

Detect external resource references and unsafe content.

Do not execute embedded scripts or allow imported SVG content to gain arbitrary access to the filesystem.

For unsupported constructs, provide a deliberate fallback to rasterization or a clear warning.

Do not silently claim that all SVGs are fully supported.

## Asset library

Implement a local library containing:

- User-imported illustrations.
- Local categories or folders.
- Search.
- Tags.
- Preview thumbnails.
- Basic metadata.
- A favorites feature if practical.
- Safe deletion.
- Duplicate detection where feasible.
- Original asset file access.

Include only original or properly licensed sample assets.

The asset library must not rely on a commercial remote asset catalog.

---

# 10. SVG PATH REVEAL AND DRAWING ENGINE

Treat this as one of the core engineering systems, not a minor visual effect.

The purpose is to make vector illustrations appear as though a hand or pen is drawing them over time.

## 10.1 Separate assets from drawing instructions

A vector asset may contain several paths, shapes, groups, fills, and strokes.

The renderer must retain the structure needed to determine how each component is revealed.

Provide a normalized internal representation that can associate drawing instructions with specific vector geometry.

The original SVG remains a separate asset or source representation.

## 10.2 Path ordering

Support:

- SVG document/path order as a fallback.
- Explicit path order.
- Optional path grouping.
- Sequential path drawing.
- Concurrent path drawing where supported.
- Per-path timing weights or equivalent controls.
- Configurable gaps between paths when appropriate.

Do not rely solely on arbitrary DOM traversal if it creates visibly incorrect drawing order.

The architecture should permit later additions such as manually reordering the paths of an illustration.

## 10.3 Path progression

Use the actual path geometry to calculate reveal progress.

For a path of total length L, define progress p between 0 and 1.

A standard SVG stroke-reveal approach can use stroke-dash properties:

- At progress 0, the stroke is hidden.
- At intermediate progress, part of the path is visible.
- At progress 1, the full path is visible.

Evaluate progress from an absolute animation timestamp instead of incrementally revealing pixels according to elapsed wall-clock time.

Support curves and compound vector paths to the extent allowed by the renderer.

## 10.4 Drawing styles

Implement at least:

1. Hand draw.
2. Pen draw.
3. Draw without a visible hand.
4. Raster diagonal reveal.
5. Fade in.
6. Move in.

Additional styles may include wipe, erase, or other effects when they can be implemented robustly.

The selected style must be reflected consistently in the canvas, animation inspector, timeline, playback, and export.

## 10.5 Filled shapes

Filled vector shapes require special handling.

Implement a defined behavior for:

- Stroke-only paths.
- Closed paths.
- Filled paths.
- Filled paths with outlines.
- Compound paths.
- Groups with several shapes.
- Overlapping filled shapes.
- Clipped content where supported.

Do not assume that animating a filled silhouette's outline automatically creates a convincing interior reveal.

Use an appropriate clipping/reveal method or a deliberate fallback, and document any limitations.

## 10.6 Hand and pen synchronization

Implement separate hand/pen rendering that can follow the active path.

At the current animation timestamp:

1. Determine the active drawing path.
2. Determine progress along the path.
3. Find the current geometric position.
4. Calculate the local tangent and orientation.
5. Position the drawing instrument.
6. Apply the appropriate attachment-point offset.
7. Render the corresponding revealed stroke.

Handle discontinuities between separate paths, short paths, path direction changes, curved segments and end-of-path transitions.

Provide a configurable library of original hand and pen assets.

Keep hand assets separate from the underlying illustration and timeline event.

The hand should not drift away from the visible drawing tip.

When drawing begins, it should appear at the right position. When a path advances, the instrument should move coherently. When drawing finishes, the hand should transition out appropriately.

Use reproducible timestamps to ensure this behavior is consistent during export.

---

# 11. RASTER REVEAL PIPELINE

Raster images do not normally preserve the vector strokes needed to reproduce an authentic drawing process.

Do not pretend to recover original drawing instructions from every PNG or JPEG.

Implement raster animation as a separate rendering strategy.

Required initial raster behaviors:

- Diagonal reveal.
- Directional wipe.
- Fade.
- Move in.
- Static display.

Where practical, support a configurable reveal direction, anchor or direction angle.

Ensure the image's alpha channel is preserved during reveals.

Avoid unintended stretching, clipping, or background-color artifacts.

For future extensions, design a replaceable adapter interface for optional vectorization or contour-extraction algorithms.

Do not make raster vectorization mandatory for the basic application.

---

# 12. HAND AND PEN ASSET SYSTEM

Implement a reusable instrument system.

Each instrument definition should contain:

- ID.
- Display name.
- Asset reference.
- Drawing-tip attachment point.
- Orientation offset.
- Scale settings.
- Optional color or visual variants.
- Supported drawing modes.

The attachment point must be configurable so that the actual tip, rather than the center of the hand image, aligns with the current path position.

Support different instrument sizes and orientations.

The system should be independent of the particular SVG illustration being drawn.

Allow the user to choose an instrument per animation where supported.

Use only original or appropriately licensed instrument assets.

---

# 13. ANIMATION ENGINE

Create a reusable animation model with three conceptual stages.

## Entrance

Controls how an element becomes visible.

Implement relevant types such as:

- Hand draw.
- Pen draw.
- Draw without a hand.
- Fade in.
- Move in.
- Directional reveal.
- Pop or scale in.
- Other compatible transitions.

## Emphasis

Controls temporary animation after the element is visible.

Implement appropriate effects, such as:

- Pulse.
- Bounce.
- Shake.
- Spin.
- Scale emphasis.
- Other clearly defined effects.

Each effect needs consistent behavior at its start, during its duration, and at completion.

## Exit

Controls how an element disappears or moves away.

Implement appropriate effects such as:

- Fade out.
- Move out.
- Scale out.
- Erase or wipe where supported.

Objects must remain editable in the project after their animation has completed.

## Animation evaluation

All animations must be evaluable from an absolute project timestamp.

Given a project state and time t, the animation engine must calculate:

- Element visibility.
- Geometry reveal progress.
- Transform state.
- Opacity.
- Active emphasis effects.
- Exit behavior.
- Hand/pen state.
- Relevant camera or scene state.

Do not depend on the number of frames previously rendered.

Repeated evaluation at the same timestamp must produce the same visual state, barring explicitly documented nondeterministic effects.

## Animation defaults and editing

Provide suitable default durations while allowing users to edit animation settings.

Make entrance, emphasis, and exit options accessible from the properties inspector.

Replacing the underlying asset should preserve compatible animation settings when appropriate.

Do not force the user to reconfigure every animation after replacing an illustration.

---

# 14. CAMERA AND VIEWPORT ENGINE

Implement a virtual 2D camera system independent of the editor's temporary viewport.

The project output aspect ratio determines the camera's frame proportions.

## Camera data

Represent a camera with:

- Stable ID.
- Scene ID.
- World-space center.
- Viewport width and height, or an equivalent scale representation.
- Output aspect ratio.
- Transition duration.
- Easing/interpolation.
- Associated timeline position.

## Required behavior

- Create a camera.
- Move a camera.
- Resize its viewport or change its zoom.
- Duplicate a camera.
- Reorder camera events.
- Transition between camera positions.
- Pan across the whiteboard.
- Zoom in and out.
- Frame selected elements.
- Fit content.
- Maintain the correct output aspect ratio.
- Display camera frames in the editor.
- Preview camera movement over time.

A camera is a view into the scene, not an instruction to move the underlying artwork.

## Camera transforms

Implement and test the mapping between world and output coordinates.

Ensure that:

- A camera pan changes the visible view without moving elements.
- Zoom behaves consistently at different output resolutions.
- Editor zoom is independent from output zoom.
- Camera transitions do not distort the output aspect ratio.
- Objects retain their intended positions after camera edits.
- Backward scrubbing works.
- Exported frames use the expected camera transform.

## Camera interpolation

Support linear and smooth eased transitions.

Use interpolation based on project time.

For zoom, evaluate whether logarithmic interpolation of viewport width or scale produces a smoother perceptual transition.

Add camera keyframes or equivalent camera events to the timeline.

Document camera semantics, particularly the difference between camera transitions inside a scene and scene transitions between separate scenes.

---

# 15. SCENE MANAGEMENT

Scenes are first-class document objects.

Implement:

- Scene creation.
- Scene duplication.
- Scene deletion.
- Scene selection.
- Scene renaming.
- Scene reordering.
- Scene thumbnails.
- Per-scene background.
- Scene-specific elements.
- Scene-associated cameras.
- Scene-level audio.
- Scene transition settings.
- Appropriate scene-level playback controls.

Each scene should have a predictable starting state.

Duplicating a scene should duplicate its editable contents and associated settings, while assigning new stable IDs where required.

Deleting a scene must update dependent timeline events and camera associations safely.

Do not allow a scene deletion to leave broken references elsewhere in the document.

Provide clear behavior for copied elements and assets shared between scenes.

---

# 16. BACKGROUNDS, SHAPES, AND LAYERS

Implement background controls for:

- White.
- Solid colors.
- Supported gradient backgrounds.
- Imported background images where appropriate.

Keep backgrounds independent from ordinary animated elements unless the user explicitly converts them.

Implement common editable shapes such as:

- Line.
- Rectangle.
- Rounded rectangle.
- Ellipse.
- Arrow.
- Basic polygon.
- Freeform path where practical.

Each shape should have editable fill, stroke, stroke width, dimensions, rotation, and position.

Where appropriate, shape objects should be able to participate in the same animation engine as imported vector artwork.

Provide layer ordering and a practical mechanism for selecting or locking overlapping elements.

Ensure that the canvas renderer and export renderer use the same geometry and ordering rules.

---

# 17. TEXT EDITOR AND TYPOGRAPHY

Implement text as a native editable project element.

Required functionality:

- Insert text.
- Edit content.
- Select fonts available locally.
- Set font size.
- Set weight and style.
- Set alignment.
- Change fill or text color.
- Set line spacing.
- Control line wrapping.
- Resize and position.
- Rotate when supported.
- Duplicate.
- Change layer order.
- Apply suitable entrance, emphasis, and exit animations.

Separate text content, text layout and rendered glyph geometry.

Provide a mechanism for drawing-style text animation where practical. This may use glyph outlines or another explicitly documented reveal strategy.

For deterministic rendering, ensure the project can identify the fonts it needs.

Do not silently substitute an unrelated font if a required font is unavailable. Warn the user and offer a reasonable fallback.

Respect font licensing and avoid including unlicensed commercial font files in the repository.

---

# 18. TIMELINE ENGINE

The timeline is a core system, not a decorative strip at the bottom of the window.

Create one shared timeline model that drives the editor, playback and video export.

## Simple timeline

Provide:

- Element ordering.
- Animation-stage indicators.
- Start-time visualization.
- Duration visualization.
- Pause indicators.
- Scrubbing.
- Playback.
- Reordering.
- Quick adjustment of timing.

## Advanced timeline

Provide:

- Multiple element rows.
- Separate audio rows.
- Camera events or keyframes.
- Scene boundaries.
- Entrance, emphasis, and exit stages.
- Waveforms for audio tracks.
- Drag-to-move events.
- Drag-to-resize durations.
- Zoom in and out.
- Horizontal scrolling.
- Track selection.
- Playhead movement.
- Time ruler.
- Context menus.
- Precise numeric timing adjustments.

## Timeline event model

Every event must have clearly defined timing and dependencies.

Define how the following interact:

- Animation start.
- Duration.
- Delay.
- Pause after an element.
- Sequential events.
- Parallel events.
- Camera transitions.
- Scene transitions.
- Audio track offsets.
- Audio trimming.
- Element exit events.

Support sequential and overlapping events without requiring the user to calculate total video duration manually.

The project duration must be derived from the actual schedule and the relevant end times.

The simple and advanced timeline must use the same document data and scheduler.

Moving an event in either interface must produce consistent playback and export.

---

# 19. PLAYBACK CLOCK AND SCHEDULER

Build a central playback clock.

It must support:

- Play.
- Pause.
- Resume.
- Stop.
- Seek.
- Single-time evaluation.
- Restart from the beginning.
- Jump to scene.
- Jump to selected element.
- Playback from the current position.
- Backward scrubbing.
- Playback at different preview speeds where supported.

The playback clock supplies project time to the animation evaluator, camera system, scene manager and audio playback system.

Do not allow each subsystem to maintain an incompatible clock.

## Deterministic evaluation requirement

The renderer must be able to answer:

"What should the complete project look like at precisely time t?"

The result must be independent of whether the user previously played the project or jumped straight to that timestamp.

This requirement is fundamental to consistent preview and export.

Handle events that begin or end exactly on a frame boundary without inconsistent states.

Define and test behavior at time zero, event boundaries, scene boundaries and the final timestamp.

---

# 20. AUDIO ENGINE

Implement local audio handling without cloud services.

## Audio import

Allow users to import supported local audio files.

Store imported media with the project or maintain a clearly defined portable asset reference.

Generate waveform thumbnails and metadata when useful.

## Audio editing

Provide:

- Add track.
- Delete track.
- Duplicate track.
- Move track.
- Change start time.
- Adjust in-point.
- Adjust out-point.
- Trim.
- Split.
- Change volume.
- Fade in.
- Fade out.
- Preview playback.
- Scene-level and project-level audio placement.
- Overlapping tracks.

## Audio preview

Use the same project timeline used by the animation system.

Support seeking and playback without permanently changing the source asset.

Handle the end of an audio clip correctly.

## Export audio

Combine project audio according to the document's timing and mix settings.

Ensure the encoded video's audio duration and alignment match the rendered timeline.

Prevent clipping where possible and document any supported audio-mixing limitations.

Do not require a remote speech provider.

A future optional local text-to-speech adapter may be added, but normal audio editing must work independently.

---

# 21. LOCAL ASSET LIBRARY AND RESOURCE MANAGEMENT

Build an asset manager that is useful without an online service.

Include:

- Project-local assets.
- A user-configurable local asset directory.
- Search and filtering.
- Thumbnail generation.
- Tags.
- Categories.
- Favorites where practical.
- Safe rename and delete workflows.
- Asset usage information.
- Duplicate detection where feasible.
- Missing-asset diagnostics.
- Reference validation.

Keep asset metadata separate from original file bytes.

Use caching for thumbnails and waveform data.

Avoid decoding large images on every canvas redraw.

Use explicit memory-management and resource-release strategies where needed.

When a media file is removed, do not allow the project to silently render an unrelated file at the same path.

Include an original, properly licensed starter asset collection and at least one example project.

---

# 22. PREVIEW RENDERER

Build an interactive renderer that can display the full project at a requested timestamp.

It must handle:

- Background.
- Scene selection.
- Scene transitions.
- Camera transforms.
- Image and SVG rendering.
- Progressive path revelation.
- Hand and pen overlays.
- Text.
- Shapes.
- Element transforms.
- Animation stages.
- Opacity.
- Layer ordering.
- Audio playback coordination.

Separate rendering logic from UI interaction logic.

Selection outlines, bounding boxes and editor controls should not appear in exported frames unless explicitly intended as part of the content.

Provide a clean rendering mode that uses the output resolution and camera viewport rather than the visible editor-window size.

Optimize the preview with cached geometry, memoized path data, thumbnail caching and incremental updates.

Preserve correctness before implementing aggressive caching.

---

# 23. EXPORT AND ENCODING ENGINE

The application must export usable media files locally.

Implement MP4 export as the primary target, along with animated GIF export.

Additional formats can be added later.

## Export settings

Allow the user to select:

- Output resolution.
- Frame rate.
- Output filename.
- Output location.
- Supported output format.
- Optional quality or bitrate settings.

Validate export settings before beginning.

Estimate or display progress where practical.

Allow cancellation and clean up temporary files safely.

Show actionable errors if the export fails.

## Frame rendering

The exporter must evaluate the project at fixed timestamps based on the selected output frame rate.

For frame rate F, the intended frame timestamps should follow the chosen consistent frame-index convention, for example:

t(n) = n / F

Use the same time-dependent renderer as preview.

Do not export by simply recording the screen while a real-time preview plays.

Do not let processing speed determine animation speed.

## Rendering and encoding architecture

Evaluate a dedicated local rendering worker or isolated rendering context.

If the chosen implementation uses Chromium, make sure it can render frames at exact project timestamps without needing real-time playback.

Render each frame deterministically and feed the output to a local encoder.

Use temporary files or streaming between components based on which approach is most reliable and efficient.

The exporter must manage:

- Frame dimensions.
- Pixel format.
- Alpha handling where relevant.
- Frame timestamps.
- Audio offsets.
- Audio duration.
- Scene boundaries.
- Codec compatibility.
- Temporary files.
- Process cancellation.
- Process failures.
- Final-file validation.

## GIF export

Generate animated GIFs from the rendered timeline.

Provide a predictable conversion and palette strategy so that output does not exhibit avoidable severe color banding or flickering.

Define how GIF transparency is handled.

## Quality requirements

Confirm that:

- Output duration matches the schedule.
- Output dimensions match settings.
- Audio is included and synchronized.
- Camera transitions are visible.
- All animation stages render correctly.
- No selection handles or editor UI leak into the output.
- The file can be reopened or played by a standard media player.

Never claim successful export based solely on the existence of a file. Validate that it is a real, playable media file.

---

# 24. LOCAL PROJECT STORAGE, AUTOSAVE, AND RECOVERY

All normal project storage must be local.

Implement:

- Explicit Save.
- Save As.
- Autosave.
- Safe atomic project writes.
- Recovery checkpoints.
- Recent local projects.
- Versioned project schema.
- Asset validation.
- Import and export of portable project packages.
- Detection of interrupted writes.
- Recovery from a corrupted latest checkpoint where possible.
- Useful error messages.

Define how project directories and portable project packages are structured.

A recommended project directory contains:

- The project manifest or document.
- An assets directory.
- Optional thumbnails.
- Optional waveform metadata.
- Optional recovery checkpoints.
- Version metadata.

Document the portable packaging format, including path normalization and asset integrity checks.

Prevent path traversal attacks when opening archives.

When a project is saved, its required assets must remain available in the project-managed storage.

Do not implement cloud sync or remote project storage.

---

# 25. UNDO, REDO, AND COMMAND HISTORY

Implement reliable undo and redo across ordinary editing operations.

Supported actions should include:

- Add object.
- Remove object.
- Move.
- Resize.
- Rotate.
- Edit text.
- Change colors.
- Change animation settings.
- Add/delete/reorder scenes.
- Add/delete/move camera events.
- Change timeline timing.
- Import and remove assets where reversible.

Use a command-based approach or another appropriately designed reversible state-update strategy.

Avoid recording every pointer movement as a separate undo step if that would create an unusable history.

Group drag operations into coherent transactions.

For destructive multi-object operations, ensure that undo restores the original state correctly.

Test operations involving dependencies, including deleted elements, cameras, asset references and timeline events.

---

# 26. KEYBOARD SHORTCUTS AND ACCESSIBILITY

Implement a documented, consistent set of shortcuts.

At minimum, consider:

- Undo.
- Redo.
- Save.
- Open.
- Copy.
- Cut.
- Paste.
- Duplicate.
- Delete.
- Select all.
- Grouping if implemented.
- Zoom in/out.
- Fit to screen.
- Play/pause.
- Timeline navigation.
- Escape to cancel operations.

Avoid overriding native text-editing shortcuts while the user is typing.

Support visible keyboard focus and sensible tab navigation for dialogs and controls.

Provide tooltips and clear status feedback.

Ensure that basic editing tasks are not dependent on precise mouse movements alone.

---

# 27. LOCAL APPLICATION SECURITY

Treat imported projects and media files as untrusted input.

Follow Electron security best practices.

Requirements:

- Context isolation enabled.
- Renderer Node integration disabled.
- Restricted and validated IPC channels.
- Strict control of privileged filesystem operations.
- No arbitrary renderer-to-main process code execution.
- No dynamic execution of untrusted code.
- Sanitize imported SVG and metadata.
- Prevent path traversal.
- Validate file extensions and actual content.
- Set reasonable file-size and resource limits.
- Handle malformed media safely.
- Avoid loading arbitrary remote content into the privileged application.
- Keep the preload API minimal and explicit.

Document the trust boundaries between the renderer, preload layer and main process.

The app should not become an arbitrary code execution environment simply because a project contains an SVG or imported media file.

---

# 28. NO-CLOUD REQUIREMENTS

These requirements are mandatory.

Do not implement:

- User accounts.
- Sign-in or registration.
- Cloud storage.
- Cloud project syncing.
- Hosted databases.
- Mandatory network APIs.
- Hosted asset-library dependencies.
- Remote telemetry.
- Usage tracking.
- Mandatory online AI features.
- Network-based activation.
- Remote license validation.
- Required subscription services.

The app must launch, create projects, edit media, save projects, reopen projects, preview animations and export videos without network access.

Do not add a hidden telemetry mechanism.

Do not send project content, filenames, audio, images, diagnostic information or other user data to external services.

Any future optional extension that requires network access must be clearly separated from core functionality, disabled by default, documented, and incapable of breaking the offline workflow.

Do not include cloud code simply because an existing dependency or template supplies it.

---

# 29. AI FEATURES: OPTIONAL AND LOCAL-FIRST

AI generation is not a prerequisite for the core product.

Do not make the project dependent on paid AI APIs.

Design extension interfaces only where they are genuinely useful.

Possible future extensions include:

- Script assistance.
- Storyboard generation.
- Image generation.
- Local speech synthesis.
- Automatic timing suggestions.
- Asset tagging.

However, implement these only after the core editor, animation engine and export system are working.

Any initial AI capability must operate locally or require an explicitly installed, optional provider extension selected by the user.

No remote generation request may occur without explicit user action and configuration.

The editor must remain complete and useful without any AI features installed.

---

# 30. ERROR HANDLING AND DIAGNOSTICS

Implement understandable error handling across the application.

Handle:

- Invalid projects.
- Missing assets.
- Unsupported file types.
- Malformed SVG.
- Media decoding errors.
- Filesystem permission errors.
- Insufficient disk space.
- Save failures.
- Export process failures.
- Unsupported codecs.
- Missing fonts.
- Interrupted operations.
- Resource exhaustion.
- Unexpected application shutdown.

Do not swallow exceptions silently.

Where appropriate, provide actionable diagnostics and an option to inspect local logs.

Keep diagnostics local. Do not upload crash reports or logs automatically.

Distinguish recoverable errors from unrecoverable ones.

Preserve user work before attempting risky repairs.

---

# 31. PERFORMANCE AND SCALABILITY

The editor should remain responsive as project complexity increases.

Establish a benchmark suite using representative projects, including:

- A small project with several elements.
- A scene containing numerous vector paths.
- Several scenes with many objects.
- Long timelines with overlapping events.
- Multiple audio tracks.
- Large raster images.
- Complex SVG illustrations.
- Long animation sequences.
- Projects with frequent camera movement.

Optimize based on measurements rather than intuition.

Use:

- Thumbnail caching.
- SVG parsing and geometry caching.
- Incremental rendering where appropriate.
- Debounced autosave.
- Efficient timeline virtualization when needed.
- Resource cleanup.
- Asynchronous file processing.
- Background encoding.
- Appropriate memory limits.
- Avoidance of unnecessary React re-renders.

The editor must not redraw or decode every asset needlessly during a small interaction.

Keep canvas interactions responsive while performing nonblocking background work.

If a particularly complex operation is expensive, expose progress and cancellation where appropriate.

Record benchmarks and document known scaling limits.

---

# 32. TESTING STRATEGY

Testing is a mandatory development activity.

Create unit, integration, UI, export and regression tests.

## Unit tests

Test:

- Project schema validation.
- Project migration.
- Coordinate transformations.
- Camera calculations.
- Animation progress.
- Path reveal evaluation.
- Timeline scheduling.
- Scene duration calculations.
- Audio timing.
- Undo/redo.
- Asset-reference validation.

## Integration tests

Test:

- Importing and editing SVG.
- Importing raster images.
- Saving and reopening projects.
- Replacing assets.
- Duplicating scenes.
- Editing camera positions.
- Editing timeline events.
- Importing audio.
- Creating a rendered frame.
- Exporting a small MP4.
- Exporting a short GIF.

## End-to-end tests

Automate common user workflows:

1. Launch the app.
2. Create a project.
3. Import an SVG.
4. Position and resize it.
5. Configure a drawing animation.
6. Add another element.
7. Add a camera transition.
8. Scrub and play the timeline.
9. Save the project.
10. Close and reopen it.
11. Export a video.
12. Validate the exported media.

## Rendering tests

Create controlled reference projects with known timestamps.

Compare rendered frames against expected results.

Test:

- Time zero.
- Mid-animation.
- Completed animation.
- Camera transition midpoint.
- Scene boundaries.
- Final frame.
- Backward scrubbing.
- Multiple output resolutions.

Use numeric comparisons and visual inspection where appropriate.

## Regression requirements

A fix to one animation type must not silently break others.

A camera change must not move the underlying illustration.

A text edit must not corrupt a project.

A project saved by the current version must reopen correctly.

A failed export must not corrupt the source project.

Document failures that remain unresolved.

---

# 33. REFERENCE-BEHAVIOR VALIDATION

Where a legitimate reference application is available, use a controlled, evidence-based process to understand its observable functionality.

Do not guess at behavior when it can be tested.

Construct small reference scenarios:

- One SVG containing several paths.
- The same illustration imported as an SVG and a PNG.
- A hand-draw animation versus a pen-draw animation.
- Two cameras with different centers and zoom levels.
- Several animations with pauses.
- An animation overlapping audio.
- A scene transition with an active camera move.
- A project rendered at more than one output resolution.

For each scenario, document:

- Input and settings.
- User actions.
- Observable results.
- Timing.
- Edge cases.
- Remaining uncertainties.

Use the results to define behavioral acceptance tests for the independent implementation.

Do not assume that matching visible behavior requires copying an existing program's source, resource files, or internal implementation.

Clearly distinguish tested facts from engineering inferences.

---

# 34. REQUIRED PROJECT STRUCTURE

Organize the repository according to actual module responsibilities.

A possible initial structure is:

    openwhiteboard-studio/
    ├── apps/
    │   └── desktop/
    │       ├── main/
    │       ├── preload/
    │       └── renderer/
    ├── packages/
    │   ├── project-model/
    │   ├── project-storage/
    │   ├── asset-manager/
    │   ├── graphics-engine/
    │   ├── animation-engine/
    │   ├── camera-engine/
    │   ├── timeline-engine/
    │   ├── audio-engine/
    │   ├── render-engine/
    │   └── shared-types/
    ├── tests/
    │   ├── unit/
    │   ├── integration/
    │   ├── e2e/
    │   └── fixtures/
    ├── sample-projects/
    ├── sample-assets/
    ├── docs/
    ├── scripts/
    ├── LICENSE
    ├── README.md
    ├── CONTRIBUTING.md
    └── package.json

Adapt this layout if the existing repository or chosen tooling justifies a different structure.

Do not create meaningless packages just to match the example.

The final structure must remain understandable and maintainable for open-source contributors.

---

# 35. DOCUMENTATION REQUIREMENTS

Write comprehensive documentation throughout development.

## README.md

Include:

- Product description.
- Screenshots when available.
- Features.
- Supported operating systems.
- Installation.
- Development setup.
- Build commands.
- Test commands.
- Export dependencies.
- Limitations.
- License.

## Architecture documentation

Describe:

- Application process model.
- Module boundaries.
- Project schema.
- Canvas coordinate system.
- Asset pipeline.
- SVG path-reveal algorithm.
- Animation scheduling.
- Camera mathematics.
- Timeline behavior.
- Audio mixing.
- Export rendering.
- Project persistence.
- Error recovery.
- Security boundaries.

## User documentation

Document:

- Creating a project.
- Importing assets.
- Creating text and shapes.
- Configuring hand-draw animations.
- Controlling the camera.
- Using scenes.
- Editing the timeline.
- Adding audio.
- Exporting videos.
- Managing project files.
- Troubleshooting.

## Contributor documentation

Describe:

- Development environment.
- Repository structure.
- Coding conventions.
- Test strategy.
- Adding an animation type.
- Adding a new asset format.
- Modifying the project schema.
- Updating dependencies.
- Packaging the application.
- License requirements.

Do not document functionality as available until it actually exists.

---

# 36. RELEASE ENGINEERING AND OPEN-SOURCE DISTRIBUTION

Prepare the application for public distribution.

Implement an appropriate packaging process for Windows.

Where practical, prepare the architecture for later macOS and Linux packaging.

Provide:

- Development build.
- Production build.
- Installable package.
- Clear installation instructions.
- Local sample projects.
- Original sample assets.
- Project format documentation.
- Dependency license inventory.
- Third-party notices.
- Version information.
- A reproducible build procedure.
- A basic release checklist.

Choose the application license after reviewing the dependencies and intended distribution model.

Do not assume that every packaged executable or media encoder permits redistribution under any license.

Include required notices for bundled tools and libraries.

Do not include commercial asset libraries or unlicensed fonts in the release.

No hosted service should be necessary to install, launch, edit, save or export.

---

# 37. IMPLEMENTATION PHASES AND EXIT CRITERIA

Work in phases, but do not treat the phases as an excuse to stop after planning.

## Phase 1 — Repository and application foundation

Deliver:

- Working desktop shell.
- Professional application layout.
- Project creation.
- Local save/open.
- Versioned project model.
- Basic asset import.
- Canvas selection and manipulation.
- Undo/redo foundation.

Exit criteria:

A user can create a project, import an image, move and resize it, save the project, close the application, reopen it, and recover the same content and transforms.

## Phase 2 — Vector graphics and animation core

Deliver:

- SVG import and sanitization.
- Vector rendering.
- Path extraction and ordering.
- Drawing-style animation.
- Hand and pen overlays.
- Raster-reveal fallback.
- Fade and move-in animations.
- Basic property inspector.

Exit criteria:

A test SVG with multiple paths can be progressively revealed in the intended order, with a synchronized drawing instrument where applicable.

The same animation produces consistent results when replayed or scrubbed to an exact timestamp.

## Phase 3 — Camera and timeline

Deliver:

- World-space canvas.
- Camera objects.
- Pan and zoom.
- Camera interpolation.
- Timeline scheduler.
- Simple timeline.
- Basic advanced timeline.
- Scrubbing and playback.
- Scene management.

Exit criteria:

Elements remain fixed in world coordinates when the camera moves. Playing and seeking reproduce the intended scene and camera state consistently.

## Phase 4 — Complete animation workflow

Deliver:

- Entrance stages.
- Emphasis animations.
- Exit animations.
- Configurable durations and pauses.
- Shape animations.
- Text rendering and editing.
- Scene backgrounds.
- Scene transitions.
- Animation properties.

Exit criteria:

A multi-element scene plays correctly through all configured stages, and the properties inspector modifies the actual rendered result.

## Phase 5 — Audio and advanced timeline

Deliver:

- Audio import.
- Waveforms.
- Multiple audio tracks.
- Trimming and splitting.
- Start offsets.
- Volume and fades.
- Advanced timeline interactions.
- Audio/animation synchronization.

Exit criteria:

A project containing overlapping visual events and audio tracks has predictable timing and can be scrubbed without corrupting track placement.

## Phase 6 — Export engine

Deliver:

- Deterministic frame renderer.
- Export progress.
- Cancellation.
- MP4 output.
- GIF output.
- Local audio mixing.
- Export validation.
- Error recovery.

Exit criteria:

A multi-element project containing drawing animations, a camera move, a scene transition and audio exports to a playable file with the intended timing, resolution and soundtrack.

## Phase 7 — Product completion

Deliver:

- Asset library.
- Autosave and recovery.
- Robust project packaging.
- Keyboard shortcuts.
- Improved accessibility.
- Performance optimizations.
- Automated regression tests.
- Packaging and installer.
- Documentation.
- Dependency and license audit.
- Sample projects.

Exit criteria:

The application can be installed and used offline by someone who did not participate in development, following the provided documentation.

## Phase 8 — Stabilization and release validation

Run the complete build and test suite.

Inspect the packaged application rather than relying exclusively on development mode.

Test the core workflows with network access disabled.

Fix release-blocking defects.

Verify that the documented features match the delivered product.

Prepare a release report with honest coverage, known limitations, and remaining work.

---

# 38. NON-NEGOTIABLE QUALITY RULES

Follow these rules throughout implementation.

1. Do not produce only a plan.
2. Do not build a static mockup and call it the application.
3. Do not make the interface the source of truth for the project.
4. Do not use real-time screen recording as a substitute for deterministic rendering.
5. Do not assume that every raster image contains recoverable drawing instructions.
6. Do not assume that all SVG features are supported without testing.
7. Do not mix editor zoom with the output camera.
8. Do not allow unrelated components to maintain conflicting timelines.
9. Do not use placeholder controls for essential functions.
10. Do not leave core functions as empty handlers or fake success messages.
11. Do not ignore failed tests.
12. Do not hide known failures.
13. Do not claim completion without running the application and its relevant tests.
14. Do not bundle unlicensed proprietary resources.
15. Do not add cloud requirements or hidden network dependencies.
16. Do not silently discard user work during failed operations.
17. Do not overengineer features that are not required to establish a reliable core.
18. Do not delay testing until the end of the project.
19. Do not refactor large working subsystems without a clear reason.
20. Do not stop at an intermediate milestone when additional implementation work can be completed.

When trade-offs are necessary, prioritize correctness, reliability, data integrity, testability, and a functioning end-to-end workflow.

---

# 39. FINAL ACCEPTANCE TEST

Before declaring the application ready, create a real test project that includes:

- At least two scenes.
- Several SVG elements.
- One raster image.
- A multi-path hand-draw animation.
- A pen-draw animation.
- At least one emphasis animation.
- At least one exit animation.
- A text element.
- A camera movement with zoom.
- A scene transition.
- A local audio track.
- A second overlapping audio or visual event.
- Custom timeline timing.
- A background setting.

Then complete the following workflow:

1. Create the project.
2. Add the assets.
3. Configure the animations.
4. Configure the camera movements.
5. Create and order the scenes.
6. Add and edit audio.
7. Adjust the timeline.
8. Preview the project.
9. Scrub backward and forward.
10. Save.
11. Close and reopen the project.
12. Confirm that the project state is preserved.
13. Export an MP4.
14. Export a short GIF.
15. Validate the generated files.
16. Reopen the project again.
17. Confirm that the exported media and saved project have not changed the original editing state.
18. Repeat the principal workflow without an internet connection.

Record the results and fix all release-blocking defects found during the process.

This acceptance project is mandatory because it exercises the complete architecture rather than testing disconnected features individually.

---

# 40. REQUIRED FINAL DELIVERY REPORT

When the implementation work is complete, provide a factual delivery report with these sections:

### A. Application summary

What was built, how it works, and which operating systems are supported.

### B. Architecture

The actual frameworks, major modules, rendering design, project model, and export approach used in the implementation.

### C. Completed features

List only features that are implemented and tested.

### D. Partially implemented features

Clearly describe what works, what does not, and which limitations remain.

### E. Files and repository structure

Identify the major modules and their responsibilities.

### F. How to run

Provide exact commands for installing dependencies, starting development mode, running tests and building the application.

### G. How to package

Describe how to generate the distributable installer and where its output is created.

### H. Testing results

Report which tests were run, whether they passed, which workflows were completed, and which failures remain.

### I. Sample project

Identify the included sample project and explain how to open and play it.

### J. Open-source readiness

Report the selected license, dependency audit, third-party notices, packaging readiness and reproducibility considerations.

### K. Known limitations

Report any unsupported formats, animation edge cases, performance limitations or incomplete features.

### L. Next engineering priorities

Identify the next concrete work items in descending order of importance.

Do not report hypothetical success. Base every status claim on the actual repository, execution results and tests.

---

# START NOW

Inspect the existing repository and environment.

Determine the most appropriate implementation strategy, document the initial architecture decisions, and immediately begin building the working application.

Implement the project model and editor foundation first, then build the graphics and animation engine, camera, timeline, audio and rendering pipeline.

Keep the application runnable throughout development.

Make practical decisions autonomously, verify each subsystem through tests, and continue implementing until the available scope is complete or a genuine technical blocker is reached.

**The final goal is not a demo that resembles whiteboard animation software. The goal is a maintainable, offline-capable, open-source desktop application in which users can genuinely create, edit, save, animate, preview and export whiteboard animation projects.**