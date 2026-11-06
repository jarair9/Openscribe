import type { JSX } from 'react'
import {
  Camera,
  Images,
  LayoutGrid,
  Magnet,
  Maximize2,
  Music2,
  Settings,
  Shapes,
  Type,
  Clapperboard
} from 'lucide-react'
import { useEditorStore, type SectionPanelId } from '../../state/editorStore'
import { useUiStore } from '../../state/uiStore'

const SECTIONS: Array<{
  id: SectionPanelId
  label: string
  title: string
  icon: JSX.Element
}> = [
  { id: 'scenes', label: 'Scenes', title: 'Scenes panel', icon: <Clapperboard size={18} /> },
  { id: 'text', label: 'Text', title: 'Text panel', icon: <Type size={18} /> },
  { id: 'image', label: 'Media', title: 'Media panel', icon: <Images size={18} /> },
  { id: 'shapes', label: 'Shapes', title: 'Shapes panel', icon: <Shapes size={18} /> },
  { id: 'camera', label: 'Camera', title: 'Camera panel', icon: <Camera size={18} /> },
  { id: 'music', label: 'Music', title: 'Music panel', icon: <Music2 size={18} /> }
]

export function ToolRail(): JSX.Element {
  const sectionPanel = useEditorStore((state) => state.sectionPanel)
  const toggleSectionPanel = useEditorStore((state) => state.toggleSectionPanel)
  const showGrid = useEditorStore((state) => state.showGrid)
  const snapping = useEditorStore((state) => state.snapping)
  const toggleGrid = useEditorStore((state) => state.toggleGrid)
  const toggleSnapping = useEditorStore((state) => state.toggleSnapping)
  const requestFit = useEditorStore((state) => state.requestFit)
  const openDialog = useUiStore((state) => state.openDialog)

  return (
    <nav className="tool-rail" aria-label="Panels">
      {SECTIONS.map((section) => (
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
      ))}

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
