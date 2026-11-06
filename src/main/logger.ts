import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export function logsDir(): string {
  return join(app.getPath('userData'), 'logs')
}

export function log(level: 'info' | 'warn' | 'error', message: string, detail?: unknown): void {
  const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${
    detail === undefined ? '' : ` ${safeString(detail)}`
  }\n`
  if (level === 'error') console.error(line.trimEnd())
  else if (level === 'warn') console.warn(line.trimEnd())
  else console.log(line.trimEnd())
  try {
    mkdirSync(logsDir(), { recursive: true })
    appendFileSync(join(logsDir(), 'main.log'), line)
  } catch {
    // Logging must never take the application down.
  }
}

function safeString(detail: unknown): string {
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}
