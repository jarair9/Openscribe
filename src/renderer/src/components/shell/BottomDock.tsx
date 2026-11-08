import { useEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import type { ProjectSchedule } from '@core/timeline/schedule'
import { useEditorStore } from '../../state/editorStore'
import { usePlaybackStore } from '../../state/playbackStore'
import { SceneStrip } from './SceneStrip'
import { Transport } from './Transport'
import { Timeline } from '../timeline/Timeline'

const SIMPLE_HEIGHT = 146
const ADVANCED_HEIGHT = 268

export function BottomDock({ schedule }: { schedule: ProjectSchedule }): JSX.Element | null {
  const dockHeight = useEditorStore((state) => state.dockHeight)
  const setDockHeight = useEditorStore((state) => state.setDockHeight)
  const mode = useEditorStore((state) => state.timelineMode)
  const setMode = useEditorStore((state) => state.setTimelineMode)
  const timelinePps = useEditorStore((state) => state.timelinePps)
  const setTimelinePps = useEditorStore((state) => state.setTimelinePps)
  const [collapsed, setCollapsed] = useState(false)
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null)

  const rate = usePlaybackStore((state) => state.rate)
  const setRate = usePlaybackStore((state) => state.setRate)

  useEffect(() => {
    setDockHeight(mode === 'simple' ? SIMPLE_HEIGHT : ADVANCED_HEIGHT)
  }, [mode, setDockHeight])

  const startResize = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    dragRef.current = { startY: event.clientY, startHeight: dockHeight }
    const move = (moveEvent: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      setDockHeight(drag.startHeight + (drag.startY - moveEvent.clientY))
    }
    const up = (): void => {
      dragRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <section
      className={`dock mode-${mode} ${collapsed ? 'collapsed' : ''}`}
      style={{ height: collapsed ? 34 : dockHeight, flex: 'none' }}
    >
      {!collapsed ? <div className="dock-resizer" onPointerDown={startResize} /> : null}
      <div className="dock-header">
        <div className="dock-mode-toggle" role="tablist" aria-label="Timeline mode">
          <button
            role="tab"
            aria-selected={mode === 'simple'}
            className={mode === 'simple' ? 'active' : ''}
            title="Simple: scene storyboard"
            onClick={() => setMode('simple')}
          >
            Simple
          </button>
          <button
            role="tab"
            aria-selected={mode === 'advanced'}
            className={mode === 'advanced' ? 'active' : ''}
            title="Advanced: clip timing"
            onClick={() => setMode('advanced')}
          >
            Advanced
          </button>
        </div>

        {mode === 'advanced' ? (
          <div className="dock-zoom" aria-label="Timeline zoom">
            <button
              className="dock-zoom-btn"
              title="Zoom timeline out"
              onClick={() => setTimelinePps(timelinePps / 1.4)}
            >
              <Minus size={12} />
            </button>
            <button
              className="dock-zoom-btn"
              title="Zoom timeline in"
              onClick={() => setTimelinePps(timelinePps * 1.4)}
            >
              <Plus size={12} />
            </button>
          </div>
        ) : null}

        <span className="dock-header-spacer" />

        <Transport duration={schedule.duration} />

        <select
          className="select-input dock-rate"
          value={String(rate)}
          title="Preview speed"
          onChange={(event) => setRate(Number(event.target.value))}
        >
          <option value="0.5">0.5×</option>
          <option value="1">1×</option>
          <option value="1.5">1.5×</option>
          <option value="2">2×</option>
        </select>

        <button
          className="icon-btn dock-collapse"
          title={collapsed ? 'Expand dock' : 'Collapse dock'}
          aria-label={collapsed ? 'Expand dock' : 'Collapse dock'}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>
      {!collapsed ? (
        <div className="dock-body">
          {mode === 'simple' ? (
            <SceneStrip schedule={schedule} />
          ) : (
            <Timeline schedule={schedule} />
          )}
        </div>
      ) : null}
    </section>
  )
}
