#!/usr/bin/env node
/**
 * Measure the real nib of every supplied hand sprite and rewrite
 * src/shared/hand-tips-calibrated.json, the anchor table src/core/instruments.ts
 * reads. VideoScribe's own offsets are authoring-space numbers, not image
 * coordinates, so the catalog anchors put ink hundreds of pixels off the art.
 *
 * Run after regenerating the hand catalog: node scripts/calibrate-hand-tips.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const library = JSON.parse(readFileSync(`${ROOT}/src/shared/hand-library.json`, 'utf8'))

function measure(png, isGesture, isBrush) {
  const { width: w, height: h, data } = png
  const A = 24
  // Integral image of transparent pixels, so "solid" is a four-lookup test.
  const IW = w + 1
  const integral = new Int32Array(IW * (h + 1))
  for (let y = 0; y < h; y += 1) {
    let run = 0
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] < A) run += 1
      integral[(y + 1) * IW + (x + 1)] = integral[y * IW + (x + 1)] + run
    }
  }
  const solid = (x, y) =>
    integral[(y + 3) * IW + (x + 3)] - integral[(y - 2) * IW + (x + 3)]
    - integral[(y + 3) * IW + (x - 2)] + integral[(y - 2) * IW + (x - 2)] === 0
  // Where the arm leaves the frame: the average x of the bottom-most dense rows.
  let armX = null, armY = null
  for (let y = h - 1; y >= 0 && armX === null; y -= 1) {
    let n = 0, sx = 0
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] >= A) { n += 1; sx += x }
    }
    if (n >= Math.max(24, w * 0.08)) { armX = sx / n; armY = y }
  }
  if (armX === null) { armX = w / 2; armY = h - 1 }
  // The tool is the extreme horizontal point of the sprite, as long as that
  // extreme sits in the upper half. When the left edge is the forearm instead,
  // the hand is mirrored and the tool is on the right.
  const scan = (fromLeft) => {
    let bx = fromLeft ? w : -1, by = 0
    for (let y = 2; y < h - 2; y += 1) {
      for (let x = fromLeft ? 2 : w - 3; fromLeft ? x < w - 2 : x >= 2; x += fromLeft ? 1 : -1) {
        if (!solid(x, y)) continue
        if (fromLeft ? x < bx : x > bx) { bx = x; by = y }
        break
      }
    }
    return bx === w || bx === -1 ? null : { x: bx, y: by }
  }
  const L = scan(true), R = scan(false)
  const top = () => {
    for (let y = 2; y < h - 2; y += 1) {
      for (let x = 2; x < w - 2; x += 1) if (solid(x, y)) return { x, y }
    }
    return null
  }
  const half = h / 2
  // Open-hand gestures have no tool: the gesture points from its topmost pixel.
  // Paintbrush sprites hold the brush the other way round: the working end is
  // the orange bristle block, not the pointed handle that wins the edge scan.
  if (isBrush) {
    // Skin is amber too, so the bristles need a tight colour gate plus a solid
    // neighbourhood; then their outer tip is the point furthest from the hand.
    const isBristle = (x, y) => {
      const i = (y * w + x) * 4
      if (data[i + 3] < 200) return false
      const r = data[i], g = data[i + 1], b = data[i + 2]
      return r > 170 && g > 110 && g < 200 && b < 90 && r - b > 110
    }
    let sx = 0, sy = 0, n = 0
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4
        if (data[i + 3] < A) continue
        sx += x; sy += y; n += 1
      }
    }
    const cx = sx / n, cy = sy / n
    const mask = new Uint8Array(w * h)
    let hits = 0
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (isBristle(x, y)) { mask[y * w + x] = 1; hits += 1 }
      }
    }
    if (hits > 120) {
      const miss = new Int32Array((w + 1) * (h + 1))
      const MW = w + 1
      for (let y = 0; y < h; y += 1) {
        let run = 0
        for (let x = 0; x < w; x += 1) {
          if (!mask[y * w + x]) run += 1
          miss[(y + 1) * MW + (x + 1)] = miss[y * MW + (x + 1)] + run
        }
      }
      const solidBristle = (x, y) =>
        miss[(y + 3) * MW + (x + 3)] - miss[(y - 2) * MW + (x + 3)]
        - miss[(y + 3) * MW + (x - 2)] + miss[(y - 2) * MW + (x - 2)] === 0
      let best = -1, bx2 = 0, by2 = 0, found = false
      // Skin can match the bristle colour exactly, so also require the pixel to
      // touch the black shaft the bristles are mounted on.
      const dark = (x, y) => {
        const i = (y * w + x) * 4
        if (data[i + 3] < 200) return false
        return Math.max(data[i], data[i + 1], data[i + 2]) < 105
      }
      const nearShaft = (x, y) => {
        for (let dy = -7; dy <= 7; dy += 1) {
          for (let dx = -7; dx <= 7; dx += 1) {
            const nx = x + dx, ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            if (dark(nx, ny)) return true
          }
        }
        return false
      }
      for (let y = 2; y < h - 2; y += 1) {
        for (let x = 2; x < w - 2; x += 1) {
          if (!mask[y * w + x] || !solidBristle(x, y)) continue
          if (!nearShaft(x, y)) continue
          const d = (x - cx) ** 2 + (y - cy) ** 2
          if (d > best) { best = d; bx2 = x; by2 = y; found = true }
        }
      }
      if (found) return { nx: bx2 / w, ny: by2 / h, arm: [armX / w, armY / h], w, h }
    }
  }
  const pick = isGesture ? top() : (L && L.y < half ? L : R && R.y < half ? R : top())
  const bx = pick?.x ?? Math.round(w / 2), by = pick?.y ?? 0
  return { nx: bx / w, ny: by / h, arm: [armX / w, armY / h], w, h }
}

const results = []
const flags = []
for (const hand of library) {
  const read = (p) => {
    try { return PNG.sync.read(readFileSync(`${ROOT}/${p}`)) } catch { return null }
  }
  const a = read(hand.hand1)
  if (!a) { flags.push(`MISSING ${hand.id} ${hand.name}`); continue }
  const gesture = /move in|move out|drag|point|hover|open|flat/i.test(hand.name)
  const brush = /brush/i.test(hand.name)
  const ma = measure(a, gesture, brush)
  const b = hand.hand2 ? read(hand.hand2) : null
  const mb = b ? measure(b, gesture, brush) : null
  results.push({
    id: String(hand.id),
    tip: [+ma.nx.toFixed(4), +ma.ny.toFixed(4)],
    tip2: mb ? [+mb.nx.toFixed(4), +mb.ny.toFixed(4)] : [+ma.nx.toFixed(4), +ma.ny.toFixed(4)],
    arm: [+ma.arm[0].toFixed(2), +ma.arm[1].toFixed(2)],
    gesture
  })
  // Sanity: the tool should sit above the arm and the sprite should be upright.
  if (ma.ny > 0.5 && !brush) flags.push(`LOW ${hand.id} ${hand.name} ${ma.nx.toFixed(3)},${ma.ny.toFixed(3)}`)
}

const lines = results.map((r) => `  "${r.id}": { "tip": [${r.tip.join(', ')}], "tip2": [${r.tip2.join(', ')}] }`)
writeFileSync(
  `${ROOT}/src/shared/hand-tips-calibrated.json`,
  `{\n${lines.join(',\n')}\n}\n`
)
console.log('measured', results.length, 'hands |', flags.length, 'flags')
console.log(flags.slice(0, 40).join('\n'))

// Cross-check the three hand-calibrated anchors.
const known = { 4817: [0.069, 0.093], 4818: [0.07, 0.08], 4861: [0.081, 0.054] }
for (const [id, want] of Object.entries(known)) {
  const got = results.find((r) => r.id === id)?.tip
  console.log(`check ${id}`, got, 'vs', want, got && Math.hypot(got[0] - want[0], got[1] - want[1]) < 0.02 ? 'OK' : 'DRIFT')
}
