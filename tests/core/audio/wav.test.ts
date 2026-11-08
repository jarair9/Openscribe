import { describe, expect, it } from 'vitest'
import { peakLevel, writeWav } from '../../../src/core/audio/wav'

describe('writeWav', () => {
  it('writes a canonical 16-bit PCM header and samples', () => {
    const bytes = writeWav([Float32Array.from([0, 0.5, -0.5])], 8000)
    const view = new DataView(bytes.buffer)
    expect(bytes.length).toBe(44 + 6)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(8000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(16383)
    expect(view.getInt16(48, true)).toBe(-16384)
  })

  it('clamps out-of-range samples instead of wrapping', () => {
    const bytes = writeWav([Float32Array.from([1.5, -1.5])], 8000)
    const view = new DataView(bytes.buffer)
    expect(view.getInt16(44, true)).toBe(32767)
    expect(view.getInt16(46, true)).toBe(-32768)
  })
})

describe('peakLevel', () => {
  it('detects digital silence across channels', () => {
    expect(peakLevel([new Float32Array(64), new Float32Array(64)])).toBe(0)
  })

  it('returns the largest absolute sample', () => {
    expect(peakLevel([Float32Array.from([0.1, -0.7, 0.3]), Float32Array.from([0.2])])).toBeCloseTo(0.7)
  })
})