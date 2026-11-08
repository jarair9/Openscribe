/** Largest absolute sample across channels; 0 means digital silence. */
export function peakLevel(channels: Float32Array[]): number {
  let peak = 0
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i += 1) {
      const value = Math.abs(channel[i]!)
      if (value > peak) peak = value
    }
  }
  return peak
}

/** Canonical 16-bit PCM WAV bytes for recorded voiceovers. */
export function writeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const sources = channels.slice(0, 2)
  const channelCount = Math.max(1, sources.length)
  const frames = sources[0]?.length ?? 0
  const bytesPerSample = 2
  const dataSize = frames * channelCount * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channelCount * bytesPerSample, true)
  view.setUint16(32, channelCount * bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let frame = 0; frame < frames; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, sources[channel]?.[frame] ?? 0))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += bytesPerSample
    }
  }
  return new Uint8Array(buffer)
}