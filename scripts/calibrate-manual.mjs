#!/usr/bin/env node
/**
 * Manual hand-tip calibrator.
 *
 * Serves a browser page that shows every hand sprite one at a time. The user
 * clicks the exact nib pixel; the page saves the anchors to tools/manual-tips.json
 * (kept separate from the shipped anchor table so it can be tested first).
 *
 *   node scripts/calibrate-manual.mjs [--port=8787] [--no-open]
 */
import { createServer } from 'node:http'
import { exec } from 'node:child_process'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.argv.find((a) => a.startsWith('--port='))?.split('=')[1] ?? 8787)
const NO_OPEN = process.argv.includes('--no-open')
const OUT = `${ROOT}/tools/manual-tips.json`

const LIBRARY = JSON.parse(readFileSync(`${ROOT}/src/shared/hand-library.json`, 'utf8'))
const SHIPPED = JSON.parse(readFileSync(`${ROOT}/src/shared/hand-tips-calibrated.json`, 'utf8'))

function kindOf(hand) {
  if (/move in|move out|drag|point|hover|open|flat/i.test(hand.name)) return 'gesture'
  if (/brush/i.test(hand.name)) return 'brush'
  if (/eras|wip/i.test(hand.name)) return 'eraser'
  return 'tool'
}

const items = []
let skipped = 0
for (const hand of LIBRARY) {
  const kind = kindOf(hand)
  if (existsSync(`${ROOT}/${hand.hand1}`)) {
    items.push({ id: String(hand.id), pose: 1, name: hand.name, group: hand.group, file: hand.hand1, kind })
    if (hand.hand2 && existsSync(`${ROOT}/${hand.hand2}`)) {
      items.push({ id: String(hand.id), pose: 2, name: hand.name, group: hand.group, file: hand.hand2, kind })
    }
  } else {
    skipped += 1
  }
}

const allowed = new Set(LIBRARY.flatMap((h) => [h.hand1, h.hand2].filter(Boolean)))

function readManual() {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8'))
  } catch {
    return {}
  }
}

function saveManual(value) {
  writeFileSync(`${OUT}.tmp`, `${JSON.stringify(value, null, 1)}\n`)
  renameSync(`${OUT}.tmp`, OUT)
}

const html = readFileSync(`${ROOT}/scripts/calibrate-manual.html`, 'utf8')

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const send = (code, body, type) => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' })
    res.end(body)
  }

  if (req.method === 'GET' && url.pathname === '/') {
    return send(200, html, 'text/html; charset=utf-8')
  }
  if (req.method === 'GET' && url.pathname === '/items') {
    return send(200, JSON.stringify({ items, shipped: SHIPPED }), 'application/json')
  }
  if (req.method === 'GET' && url.pathname === '/state') {
    return send(200, JSON.stringify(readManual()), 'application/json')
  }
  if (req.method === 'GET' && url.pathname === '/img') {
    const file = url.searchParams.get('f') ?? ''
    if (!allowed.has(file)) return send(404, 'not found', 'text/plain')
    try {
      const bytes = readFileSync(`${ROOT}/${file}`)
      const ext = file.split('.').pop()?.toLowerCase()
      const type = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      return send(200, bytes, type)
    } catch {
      return send(404, 'not found', 'text/plain')
    }
  }
  if (req.method === 'POST' && url.pathname === '/save') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        saveManual(JSON.parse(body || '{}'))
        send(200, JSON.stringify({ ok: true }), 'application/json')
      } catch (error) {
        send(400, JSON.stringify({ ok: false, error: String(error) }), 'application/json')
      }
    })
    return
  }
  send(404, 'not found', 'text/plain')
})

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`
  console.log(`Hand tip calibrator: ${url}`)
  console.log(`  ${items.length} poses across ${LIBRARY.length - skipped} hands${skipped ? ` (${skipped} missing file(s) skipped)` : ''}`)
  console.log(`  results -> ${OUT}`)
  if (!NO_OPEN && process.platform === 'win32') {
    exec(`start "" "${url}"`)
  } else if (!NO_OPEN && process.platform === 'darwin') {
    exec(`open "${url}"`)
  } else if (!NO_OPEN) {
    exec(`xdg-open "${url}"`)
  }
})
