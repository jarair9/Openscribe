const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
}

export function createId(prefix: string): string {
  let suffix = ''
  for (const byte of randomBytes(10)) suffix += ALPHABET[byte % ALPHABET.length]
  return `${prefix}_${suffix}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
