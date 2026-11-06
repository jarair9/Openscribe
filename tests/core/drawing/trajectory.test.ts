import { describe, expect, it } from 'vitest'
import { buildDrawingTrajectory, evaluateDrawingTrajectory } from '../../../src/core/drawing/trajectory'

describe('SVG drawing trajectories', () => {
  it('samples a straight line with a stable tangent', () => {
    const trajectory = buildDrawingTrajectory('M 0 4 L 100 4')
    const middle = evaluateDrawingTrajectory(trajectory, 0.5)

    expect(trajectory.length).toBeCloseTo(100, 6)
    expect(middle?.point.x).toBeCloseTo(50, 5)
    expect(middle?.point.y).toBeCloseTo(4, 5)
    expect(middle?.tangent.x).toBeCloseTo(1, 6)
    expect(middle?.tangent.y).toBeCloseTo(0, 6)
  })

  it('follows a cubic curve and returns its local tangent', () => {
    const trajectory = buildDrawingTrajectory('M 0 0 C 0 100 100 100 100 0')
    const middle = evaluateDrawingTrajectory(trajectory, 0.5)

    expect(middle?.point.x).toBeCloseTo(50, 1)
    expect(middle?.point.y).toBeCloseTo(75, 1)
    expect(middle?.tangent.y).toBeCloseTo(0, 2)
    expect(trajectory.length).toBeGreaterThan(150)
  })

  it('keeps disconnected subpaths separate without a phantom connector', () => {
    const trajectory = buildDrawingTrajectory('M 0 0 L 10 0 M 100 0 L 110 0')
    const firstEnd = evaluateDrawingTrajectory(trajectory, 0.5)
    const nextStroke = evaluateDrawingTrajectory(trajectory, 0.51)

    expect(trajectory.strokes).toHaveLength(2)
    expect(trajectory.length).toBeCloseTo(20, 6)
    expect(firstEnd?.point.x).toBeCloseTo(10, 5)
    expect(nextStroke?.strokeIndex).toBe(1)
    expect(nextStroke?.point.x).toBeGreaterThan(100)
  })

  it('normalizes arcs and closed contours into sampleable geometry', () => {
    const arc = buildDrawingTrajectory('M 0 0 A 25 25 0 0 1 50 0')
    const closed = buildDrawingTrajectory('M 0 0 H 10 V 10 Z')

    expect(arc.length).toBeGreaterThan(50)
    expect(evaluateDrawingTrajectory(arc, 0.5)?.point.y).toBeLessThan(0)
    expect(closed.length).toBeCloseTo(34.142, 2)
  })
})
