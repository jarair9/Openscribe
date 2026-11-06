#!/usr/bin/env node
/**
 * Audit the shipped nib anchors against the sprites they name.
 *
 * A photographed nib is always on the silhouette: the tool sticks out of the
 * hand, so its tip pixel has transparent pixels a few steps away. An anchor that
 * sits inside a thick mass is not a nib at all, it is a knuckle or a forearm, and
 * the hand writes with that point on the stroke instead.
 *
 * node scripts/audit-shipped-tips.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'
import { measureTip } from './measure-instrument-tips.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY = JSON.parse(readFileSync(`${ROOT}/src/shared/hand-library.json`, 'utf8'))
const SHIPPED = JSON.parse(readFileSync(`${ROOT}/src/shared/hand-tips-calibrated.json`, 'utf8'))

function innerAt(png, x, y) {
  const { width: w, height: h, data } = png
  let r = 0
  for (;;) {
    r += 1
    let clear = false
    for (let d = -r; d <= r && !clear; d += 1) {
      for (const [nx, ny] of [[x + d, y - r], [x + d, y + r], [x - r, y + d], [x + r, y + d]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        if (data[(ny * w + nx) * 4 + 3] < 24) clear = true
      }
    }
    if (!clear) return r
  }
}

const buckets = new Map()
const rows = []
for (const hand of LIBRARY) {
  const shipped = SHIPPED[String(hand.id)]
  if (!shipped) continue
  let png
  try {
    png = PNG.sync.read(readFileSync(`${ROOT}/${hand.hand1.replace(/^open-assets\//, 'open-assets/')}`))
  } catch {
    continue
  }
  const { width: w, height: h } = png
  const ax = Math.round(shipped.tip[0] * (w - 1))
  const ay = Math.round(shipped.tip[1] * (h - 1))
  const solid = png.data[(ay * w + ax) * 4 + 3] >= 24
  const thickness = solid ? innerAt(png, ax, ay) : 0
  const gesture = /move in|move out|drag|point|hover|open|flat/i.test(hand.name)
  buckets.set(thickness, (buckets.get(thickness) ?? 0) + 1)
  if (thickness >= 8 && !gesture) {
    const kind = /brush/i.test(hand.name) ? 'brush' : 'tool'
    const m = measureTip(png, kind)
    rows.push(
      `${hand.id} ${String(hand.group).padEnd(8)} ${hand.name.padEnd(30)} shipped=${shipped.tip}` +
        ` buried=${thickness}px ${m.mode}=${m.tip.map((v) => v.toFixed(3))}`
    )
  }
}

const thick = [...buckets.entries()].sort((a, b) => a[0] - b[0])
console.log('shipped-anchor local thickness histogram (px to nearest transparent pixel):')
console.log(thick.map(([t, n]) => `  ${String(t).padStart(3)}px ${'#'.repeat(Math.min(60, n))} ${n}`).join('\n'))
console.log(`\nanchors buried 8px or deeper, tool sprites: ${rows.length}`)
console.log(rows.join('\n'))
