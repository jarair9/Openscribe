import type { JSX, ReactNode } from 'react'
import { Dialog } from './Dialog'

const GROUPS: Array<{ title: string; items: Array<[string, string]> }> = [
  {
    title: 'Tools',
    items: [
      ['Select', 'V'],
      ['Pan', 'H'],
      ['Text', 'T'],
      ['Rectangle / rounded', 'R / U'],
      ['Ellipse', 'O'],
      ['Line / arrow', 'L / A']
    ]
  },
  {
    title: 'Edit',
    items: [
      ['Undo / redo', 'Ctrl+Z / Ctrl+Shift+Z'],
      ['Cut / copy / paste', 'Ctrl+X / C / V'],
      ['Duplicate', 'Ctrl+D'],
      ['Select all', 'Ctrl+A'],
      ['Delete selection', 'Delete'],
      ['Nudge selection', 'Arrow keys (+Shift for 10)']
    ]
  },
  {
    title: 'Preview & timing',
    items: [
      ['Open preview', 'Space / Ctrl+Enter'],
      ['Pause / resume in preview', 'Space'],
      ['Go to start / end', 'Home / End'],
      ['Scrub timeline', 'Drag the ruler']
    ]
  },
  {
    title: 'Canvas & project',
    items: [
      ['Zoom', 'Ctrl + mouse wheel'],
      ['Pan', 'Mouse wheel / middle drag'],
      ['Fit scene', 'Shift+1'],
      ['Toggle grid', 'G'],
      ['Save / save as', 'Ctrl+S / Ctrl+Shift+S'],
      ['Export video', 'Ctrl+E'],
      ['Open project', 'Ctrl+O'],
      ['Back to projects', 'Ctrl+Shift+H']
    ]
  },
  {
    title: 'Projects screen',
    items: [
      ['New / open project', 'Ctrl+N / Ctrl+O'],
      ['Back to projects', 'Ctrl+Shift+H'],
      ['Rename a project', 'Double-click / F2']
    ]
  }
]

export function ShortcutsDialog({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <Dialog
      title="Keyboard shortcuts"
      subtitle="Shortcuts are ignored while typing in a field."
      wide
      onClose={onClose}
      footer={
        <button className="btn btn-primary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 18
        }}
      >
        {GROUPS.map((group) => (
          <div key={group.title}>
            <div className="section-title" style={{ marginBottom: 8 }}>
              {group.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {group.items.map(([label, keys]) => (
                <Row key={label}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span className="kbd">{keys}</span>
                </Row>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  )
}

function Row({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12 }}>
      {children}
    </div>
  )
}
