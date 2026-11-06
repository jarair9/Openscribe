import { it } from 'vitest'
import { createProject, createTextElement } from '@core/schema/factories'
import { strokeWritingPlanForText } from '@core/text/strokeWriting'
import { evaluateStrokeWriting } from '@core/text/strokeWriting'

it('reports the pen-up gaps of a written word', () => {
  const project = createProject({ name: 'Gap', width: 1920, height: 1080 })
  const text = createTextElement('Teach', {
    frame: { x: -600, y: -220, width: 1200, height: 320 }
  })
  project.scenes[0]!.elements = [text]
  const plan = strokeWritingPlanForText(text)
  if (!plan) {
    console.log('no plan')
    return
  }
  console.log(`strokes=${plan.strokes.length} travels=${plan.travels.length}`)
  const rows = plan.strokes.map((stroke, index) => {
    const previous = plan.strokes[index - 1]
    const gap = previous ? stroke.start - previous.end : 0
    const travel = index > 0 ? plan.travels[index - 1] : undefined
    return {
      i: index,
      glyph: stroke.glyphChar,
      start: Number(stroke.start.toFixed(4)),
      end: Number(stroke.end.toFixed(4)),
      gap: Number(gap.toFixed(4)),
      travelDistance: Number((travel?.distance ?? 0).toFixed(1)),
      fromToMatch: travel
        ? Math.hypot(
            travel.from.x - plan.strokes[index - 1]!.points.at(-1)!.x,
            travel.from.y - plan.strokes[index - 1]!.points.at(-1)!.y
          ).toFixed(2)
        : 'n/a'
    }
  })
  console.log(JSON.stringify(rows, null, 1))

  // Cursor continuity: the largest single-frame hop across the whole write.
  const duration = 6
  const fps = 30
  let worst = { hop: 0, at: 0 }
  let last: { x: number; y: number } | null = null
  for (let frame = 0; frame <= duration * fps; frame += 1) {
    const t = frame / (duration * fps)
    const cursor = evaluateStrokeWriting(plan, t)
    if (!cursor) continue
    if (last) {
      const hop = Math.hypot(cursor.point.x - last.x, cursor.point.y - last.y)
      if (hop > worst.hop) worst = { hop, at: Number(t.toFixed(3)) }
    }
    last = cursor.point
  }
  console.log(
    `worst per-frame hop=${worst.hop.toFixed(2)} local units at t=${worst.at} (frame ${Math.round(worst.at * fps)})`
  )
})
