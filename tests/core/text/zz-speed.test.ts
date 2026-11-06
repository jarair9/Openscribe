import { it } from 'vitest'
import { createTextElement } from '@core/schema/factories'
import { strokeWritingPlanForText } from '@core/text/strokeWriting'

it('prints travel speed versus writing speed', () => {
  const text = createTextElement('Teach', { frame: { x: -600, y: -220, width: 1200, height: 320 } })
  const plan = strokeWritingPlanForText(text)!
  const entrance = 2.4
  const rows = plan.strokes.map((stroke, index) => {
    const previous = plan.strokes[index - 1]
    const travel = index > 0 ? plan.travels[index - 1]! : null
    const drawSeconds = (stroke.end - stroke.start) * entrance
    const travelSeconds = previous ? (stroke.start - previous.end) * entrance : 0
    return {
      glyph: stroke.glyphChar,
      ink: Number(stroke.length.toFixed(1)),
      drawS: Number(drawSeconds.toFixed(3)),
      unitsPerSecond: Number((stroke.length / Math.max(1e-6, drawSeconds)).toFixed(0)),
      hop: Number((travel?.distance ?? 0).toFixed(1)),
      liftS: Number(travelSeconds.toFixed(3)),
      liftUnitsPerSecond: Number(((travel?.distance ?? 0) / Math.max(1e-6, travelSeconds)).toFixed(0))
    }
  })
  console.log(JSON.stringify(rows, null, 1))
  console.log(`normalisedDuration=${plan.strokes.length} bounds=${JSON.stringify(plan.bounds)}`)
})
