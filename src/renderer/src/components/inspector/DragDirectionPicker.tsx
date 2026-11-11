import type { CSSProperties, JSX } from 'react'
import { ArrowDown } from 'lucide-react'

/** Clockwise from the top, the twelve places a hand can enter from. */
const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

const SIDE_OF: Record<number, string> = {
  12: 'top',
  1: 'top right',
  2: 'right',
  3: 'right',
  4: 'right',
  5: 'bottom right',
  6: 'bottom',
  7: 'bottom left',
  8: 'left',
  9: 'left',
  10: 'left',
  11: 'top left'
}

/**
 * The twelve-point ring from VideoScribe's drag-in: three entry angles per
 * side, laid out like a clock. The arrow in the middle points the way the
 * element travels, so the choice reads without a legend.
 */
export function DragDirectionPicker({
  value,
  onChange
}: {
  value: number
  onChange: (hour: number) => void
}): JSX.Element {
  const hour = ((Math.round(value) % 12) + 12) % 12 || 12
  return (
    <div className="field drag-direction">
      <span className="field-label">Entry direction</span>
      <div className="drag-dial" role="group" aria-label="Hand entry direction">
        <span className="drag-dial-ring" aria-hidden="true" />
        <span className="drag-dial-center" aria-hidden="true">
          <ArrowDown size={15} style={{ transform: `rotate(${hour * 30}deg)` }} />
        </span>
        {HOURS.map((candidate) => (
          <button
            type="button"
            key={candidate}
            className={`drag-dial-hour ${candidate === hour ? 'active' : ''}`}
            style={{ '--hour': candidate } as CSSProperties}
            aria-label={`Enter from ${candidate} o'clock, ${SIDE_OF[candidate]}`}
            aria-pressed={candidate === hour}
            title={`From ${candidate} o'clock (${SIDE_OF[candidate]})`}
            onClick={() => onChange(candidate)}
          >
            {candidate}
          </button>
        ))}
      </div>
      <span className="hint drag-direction-hint">
        Hand enters from the {SIDE_OF[hour]} — 12 is above, 3 right, 6 below, 9 left.
      </span>
    </div>
  )
}
