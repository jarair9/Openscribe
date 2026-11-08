import type { JSX } from 'react'
import {
  Camera,
  Clapperboard,
  Hand,
  Images,
  Layers,
  LayoutGrid,
  Magnet,
  Maximize2,
  MousePointer2,
  Music2,
  Settings,
  Shapes,
  Type
} from 'lucide-react'
import { useEditorStore, type SectionPanelId, type Tool } from '../../state/editorStore'
import { useUiStore } from '../../state/uiStore'

interface RailSection {
  id: SectionPanelId
  label: string
  title: string
  icon: JSX.Element
}

/** Structure first, then the things you add to a scene. */
const STRUCTURE: RailSection[] = [
  { id: 'scenes', label: 'Scenes', title: 'Scenes panel', icon: <Clapperboard size={18} /> },
  { id: 'layers', label: 'Layers', title: 'Layers panel', icon: <Layers size={18} /> }
]

const ASSETS: RailSection[] = [
  { id: 'text', label: 'Text', title: 'Text panel', icon: <Type size={18} /> },
  { id: 'image', label: 'Media', title: 'Media panel', icon: <Images size={18} /> },
  { id: 'shapes', label: 'Shapes', title: 'Shapes panel', icon: <Shapes size={18} /> },
  { id: 'camera', label: 'Camera', title: 'Camera panel', icon: <Camera size={18} /> },
  { id: 'music', label: 'Music', title: 'Music panel', icon: <Music2 size={18} /> }
]

const TOOLS: Array<{ id: Tool; label: string; title: string; icon: JSX.Element }> = [
  { id: 'select', label: 'Select', title: 'Select and move (V)', icon: <MousePointer2 size={18} /> },
  { id: 'pan', label: 'Pan', title: 'Pan the canvas (H)', icon: <Hand size={18} /> }
]

export function ToolRail(): JSX.Element {
  const tool = useEditorStore((state) => state.tool)
  const setTool = useEditorStore((state) => state.setTool)
  const sectionPanel = useEditorStore((state) => state.sectionPanel)
  const toggleSectionPanel = useEditorStore((state) => state.toggleSectionPanel)
  const showGrid = useEditorStore((state) => state.showGrid)
  const snapping = useEditorStore((state) => state.snapping)
  const toggleGrid = useEditorStore((state) => state.toggleGrid)
  const toggleSnapping = useEditorStore((state) => state.toggleSnapping)
  const requestFit = useEditorStore((state) => state.requestFit)
  const openDialog = useUiStore((state) => state.openDialog)

  const renderSection = (section: RailSection): JSX.Element => (
    <button
      key={section.id}
      className={`tool-btn ${sectionPanel === section.id ? 'active' : ''}`}
      title={section.title}
      aria-pressed={sectionPanel === section.id}
      onClick={() => toggleSectionPanel(section.id)}
    >
      {section.icon}
      <span className="tool-label">{section.label}</span>
    </button>
  )

  return (
    <nav className="tool-rail" aria-label="Tools and panels">
      {TOOLS.map((entry) => (
        <button
          key={entry.id}
          className={`tool-btn ${tool === entry.id ? 'active' : ''}`}
          title={entry.title}
          aria-pressed={tool === entry.id}
          onClick={() => setTool(entry.id)}
        >
          {entry.icon}
          <span className="tool-label">{entry.label}</span>
        </button>
      ))}

      <div className="rail-sep" />

      {STRUCTURE.map(renderSection)}

      <div className="rail-sep" />

      {ASSETS.map(renderSection)}

      <div className="rail-spacer" />

      <div className="rail-utilities">
        <button
          className={`tool-btn utility ${showGrid ? 'active' : ''}`}
          title="Toggle grid (G)"
          aria-label="Toggle grid"
          aria-pressed={showGrid}
          onClick={toggleGrid}
        >
          <LayoutGrid size={16} />
        </button>
        <button
          className={`tool-btn utility ${snapping ? 'active' : ''}`}
          title="Toggle snapping"
          aria-label="Toggle snapping"
          aria-pressed={snapping}
          onClick={toggleSnapping}
        >
          <Magnet size={16} />
        </button>
        <button
          className="tool-btn utility"
          title="Fit scene (Shift+1)"
          aria-label="Fit scene"
          onClick={requestFit}
        >
          <Maximize2 size={16} />
        </button>
        <button
          className="tool-btn utility"
          title="Project settings"
          aria-label="Project settings"
          onClick={() => openDialog('projectSettings')}
        >
          <Settings size={16} />
        </button>
      </div>
    </nav>
  )
}
