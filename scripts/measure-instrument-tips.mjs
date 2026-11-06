#!/usr/bin/env node
/**
 * Measure the real nib of every supplied instrument sprite and rewrite
 * src/shared/hand-tips-calibrated.json, the anchor table
 * src/core/instruments.ts reads.
 *
 * VideoScribe's own tip offsets are authoring-space numbers, not image
 * coordinates, and the previous rule ("extreme horizontal pixel of the upper
 * half") only holds while the tool happens to point left: whenever it points
 * right the anchor landed on a knuckle and the hand wrote in the wrong place.
 *
 * The nib is measured as the point that is simultaneously
 *   - far from the arm root (where the forearm leaves the frame),
 *   - inside a THIN part of the sprite, so a forearm cannot win,
 *   - NOT skin, so a fingertip cannot win,
 * with the sprite's own skin colour fitted from its thick interior.
 * Paintbrushes are held bristles-down and gestures have no tool, so both keep
 * their dedicated rules.
 *
 * Run after regenerating the hand catalog: node scripts/measure-instrument-tips.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LIBRARY = JSON.parse(readFileSync(`${ROOT}/src/shared/hand-library.json`, 'utf8'))
const ALPHA = 24
const SOLID = 200

/* ------------------------------------------------------------------ */
/* masks and distances                                                 */
/* ------------------------------------------------------------------ */

function readPng(relative) {
  const path = `${ROOT}/${relative.replace(/^open-assets\//, 'open-assets/')}`
  try {
    return PNG.sync.read(readFileSync(path))
  } catch {
    return null
  }
}

function alphaMask(png, threshold = ALPHA) {
  const { width: w, height: h, data } = png
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i += 1) mask[i] = data[i * 4 + 3] >= threshold ? 1 : 0
  return { w, h, data, mask }
}

/** Two-pass chamfer distance to the nearest marked pixel, in pixels. */
function chamfer(w, h, feature) {
  const cap = w + h
  const d = new Float32Array(w * h).fill(cap + 1)
  for (let i = 0; i < w * h; i += 1) if (feature[i]) d[i] = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x
      let best = d[i]
      if (y > 0) best = Math.min(best, d[i - w] + 1)
      if (x > 0) best = Math.min(best, d[i - 1] + 1)
      if (y > 0 && x > 0) best = Math.min(best, d[i - w - 1] + 1.4142)
      if (y > 0 && x < w - 1) best = Math.min(best, d[i - w + 1] + 1.4142)
      d[i] = best
    }
  }
  for (let y = h - 1; y >= 0; y -= 1) {
    for (let x = w - 1; x >= 0; x -= 1) {
      const i = y * w + x
      let best = d[i]
      if (y < h - 1) best = Math.min(best, d[i + w] + 1)
      if (x < w - 1) best = Math.min(best, d[i + 1] + 1)
      if (y < h - 1 && x < w - 1) best = Math.min(best, d[i + w + 1] + 1.4142)
      if (y < h - 1 && x > 0) best = Math.min(best, d[i + w - 1] + 1.4142)
      d[i] = Math.min(best, cap + 1)
    }
  }
  return d
}

/** Where the forearm leaves the frame: the centroid of the lowest dense row. */
function armRoot({ w, h, mask }) {
  for (let y = h - 1; y >= 0; y -= 1) {
    let n = 0
    let sx = 0
    for (let x = 0; x < w; x += 1) {
      if (mask[y * w + x]) {
        n += 1
        sx += x
      }
    }
    if (n >= Math.max(24, w * 0.08)) return { x: sx / n, y }
  }
  return { x: w / 2, y: h - 1 }
}

/* ------------------------------------------------------------------ */
/* colour                                                             */
/* ------------------------------------------------------------------ */

/** Median colour of the sprite's thick interior, which for hands is skin. */
function interiorColour({ w, h, data }, inner, radius) {
  const rs = []
  const gs = []
  const bs = []
  for (let y = 0; y < h; y += 3) {
    for (let x = 0; x < w; x += 3) {
      const i = y * w + x
      if (inner[i] < radius || data[i * 4 + 3] < SOLID) continue
      rs.push(data[i * 4])
      gs.push(data[i * 4 + 1])
      bs.push(data[i * 4 + 2])
    }
  }
  if (rs.length < 40) return null
  const median = (list) => list.sort((a, b) => a - b)[Math.floor(list.length / 2)]
  return { r: median(rs), g: median(gs), b: median(bs) }
}

/* ------------------------------------------------------------------ */
/* fallback: the previous extreme-edge rule                            */
/* ------------------------------------------------------------------ */

function solidNeighbourhood({ w, h, mask }, x, y, reach = 2) {
  for (let dy = -reach; dy <= reach; dy += 1) {
    for (let dx = -reach; dx <= reach; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false
      if (!mask[ny * w + nx]) return false
    }
  }
  return true
}

const DIRECTIONS = [
  ['left', -1, 0],
  ['right', 1, 0],
  ['top', 0, -1],
  ['bottom', 0, 1],
  ['top-left', -0.7071, -0.7071],
  ['top-right', 0.7071, -0.7071],
  ['bottom-left', -0.7071, 0.7071],
  ['bottom-right', 0.7071, 0.7071]
]

/**
 * The silhouette extreme in each of eight directions. The working end of a tool
 * is always the furthest solid point along the direction the tool is held in, so
 * one of these eight is the nib; which one depends on how the hand grips it.
 */
function extremes(sprite) {
  const { w, h, mask, data } = sprite
  const best = DIRECTIONS.map(([side, ux, uy]) => ({ side, ux, uy, dot: -Infinity, x: 0, y: 0 }))
  for (let y = 2; y < h - 2; y += 1) {
    for (let x = 2; x < w - 2; x += 1) {
      const i = y * w + x
      if (!mask[i] || data[i * 4 + 3] < SOLID) continue
      if (!solidNeighbourhood(sprite, x, y)) continue
      for (const c of best) {
        const d = x * c.ux + y * c.uy
        if (d > c.dot) {
          c.dot = d
          c.x = x
          c.y = y
        }
      }
    }
  }
  return best
}

/* ------------------------------------------------------------------ */
/* paintbrushes: the working end is the bristle block, not the handle   */
/* ------------------------------------------------------------------ */

function bristleTip({ w, h, data, mask }) {
  const isBristle = (x, y) => {
    const i = (y * w + x) * 4
    if (data[i + 3] < SOLID) return false
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    return r > 170 && g > 110 && g < 200 && b < 90 && r - b > 110
  }
  const isShaft = (x, y) => {
    const i = (y * w + x) * 4
    return data[i + 3] >= SOLID && Math.max(data[i], data[i + 1], data[i + 2]) < 105
  }
  const bristle = new Uint8Array(w * h)
  let hits = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!mask[y * w + x]) continue
      if (isBristle(x, y)) {
        bristle[y * w + x] = 1
        hits += 1
      }
    }
  }
  if (hits < 120) return null
  const toMiss = chamfer(w, h, bristle.map((v) => (v ? 0 : 1)))
  // Skin is amber too, so the block only counts where it meets the black ferrule.
  const nearShaft = (x, y) => {
    for (let dy = -7; dy <= 7; dy += 1) {
      for (let dx = -7; dx <= 7; dx += 1) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        if (isShaft(nx, ny)) return true
      }
    }
    return false
  }
  let sx = 0
  let sy = 0
  let n = 0
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!mask[y * w + x]) continue
      sx += x
      sy += y
      n += 1
    }
  }
  const cx = sx / n
  const cy = sy / n
  let best = -1
  let point = null
  for (let y = 2; y < h - 2; y += 1) {
    for (let x = 2; x < w - 2; x += 1) {
      const i = y * w + x
      if (!bristle[i] || toMiss[i] > 3) continue
      if (!nearShaft(x, y)) continue
      const d = (x - cx) ** 2 + (y - cy) ** 2
      if (d > best) {
        best = d
        point = { x, y }
      }
    }
  }
  return point
}

/**
 * How thin the sprite is along the axis through a silhouette extreme, measured
 * a little way INLAND. A nib sits at the end of a shaft, so inland from it the
 * sprite stays only as wide as the barrel; a blunt cap end or a forearm edge
 * immediately becomes its own mass.
 */
function inlandThickness(sprite, inner, c, ux, uy) {
  const { w, h, mask, data } = sprite
  const size = Math.max(w, h)
  const seen = []
  for (let t = size * 0.02; t <= size * 0.05; t += size * 0.01) {
    for (let o = -1; o <= 1; o += 1) {
      const x = Math.round(c.x - ux * t - uy * o)
      const y = Math.round(c.y - uy * t + ux * o)
      if (x < 0 || y < 0 || x >= w || y >= h) continue
      const i = y * w + x
      if (!mask[i] || data[i * 4 + 3] < SOLID) continue
      seen.push(inner[i])
    }
  }
  if (seen.length < 3) return Infinity
  seen.sort((a, b) => a - b)
  return seen[Math.floor(seen.length / 2)]
}

/* ------------------------------------------------------------------ */
/* nib                                                                */
/* ------------------------------------------------------------------ */

export function measureTip(png, kind = 'tool', shipped = null) {
  const sprite = readPng2(png)
  const { w, h, data, mask } = sprite
  const size = Math.max(w, h)
  const arm = armRoot(sprite)
  const inner = chamfer(w, h, mask.map((v) => (v ? 0 : 1)))
  const fatRadius = Math.max(3, size * 0.011)
  const skin = interiorColour(sprite, inner, fatRadius * 1.6)
  // A hand sprite has an amber mass to fit; a standalone pen only has its own
  // barrel, and calling that "skin" would make every correct pen anchor look
  // wrong. Skin colour is only trusted when the fitted mass really is skin-hued.
  const skinHued = Boolean(skin) && skin.r > skin.g && skin.r - skin.b > 40
  const isSkin = (x, y) => {
    if (!skin || !skinHued) return false
    const i = (y * w + x) * 4
    if (data[i + 3] < SOLID) return false
    return (
      Math.abs(data[i] - skin.r) +
        Math.abs(data[i + 1] - skin.g) +
        Math.abs(data[i + 2] - skin.b) <
      80
    )
  }

  const cands = extremes(sprite)
  // An open-hand gesture has no tool: it points from its topmost pixel.
  if (kind === 'gesture') {
    const p = cands.find((c) => c.side === 'top') ?? cands[0]
    return { tip: [p.x / w, p.y / h], arm, mode: 'gesture' }
  }
  // A paintbrush is held with the handle end in the fist, so the tapered bristle
  // block - not the pointed handle that wins the silhouette scan - is the nib.
  if (kind === 'brush') {
    const p = bristleTip(sprite, fatRadius)
    if (p) return { tip: [p.x / w, p.y / h], arm, mode: 'bristle' }
  }

  // The hand and forearm are the only mass in the sprite thick enough to grip
  // something with, so measure how far each silhouette extreme sits from that
  // mass. A tool's working end is the far end of a long thin protrusion and
  // wins by a distance; knuckles, wrists and the cropped arm edge sit on the
  // mass itself and score nothing.
  let maxInner = 0
  for (let i = 0; i < w * h; i += 1) if (inner[i] > maxInner) maxInner = inner[i]
  const hasGripMass = maxInner >= size * 0.03
  const gripRadius = maxInner * 0.5
  const fat = new Uint8Array(w * h)
  if (hasGripMass) {
    for (let i = 0; i < w * h; i += 1) fat[i] = inner[i] > gripRadius ? 1 : 0
  }
  const toGrip = hasGripMass ? chamfer(w, h, fat) : null

  const rank = []
  const border = hasGripMass ? 3 : 0
  for (const c of cands) {
    const i = c.y * w + c.x
    const thin = inlandThickness(sprite, inner, c, c.ux, c.uy)
    const atFrameEdge = c.x <= border || c.y <= border || c.x >= w - 1 - border || c.y >= h - 1 - border
    rank.push({
      side: c.side,
      x: c.x,
      y: c.y,
      grip: toGrip ? toGrip[i] : 0,
      thin,
      skin: isSkin(c.x, c.y),
      reach: Math.hypot(c.x - arm.x, c.y - arm.y),
      // A tool end is a thin protrusion that stands clear of the hand's mass,
      // so both have to hold: reach alone finds the cropped arm corner, and
      // thickness alone finds a fingertip. Pixels the frame cut off are not
      // protrusions at all.
      score:
        atFrameEdge || thin === Infinity
          ? -Infinity
          : hasGripMass
            ? toGrip[i] - thin * 2
            : -thin
    })
  }
  // Two pixels of difference in the primary signal is noise; after that the
  // point further from the arm wins.
  const bucket = Math.max(2, size * 0.002)
  const key = (r) => [
    Number.isFinite(r.score) ? Math.round(r.score / bucket) : -Infinity,
    Math.round(Math.min(r.thin, size)),
    -Math.round(r.reach)
  ]
  rank.sort((a, b) => {
    const ka = key(a)
    const kb = key(b)
    for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return kb[i] - ka[i]
    return 0
  })
  const winner = rank[0]

  // Keep the shipped anchor when it already measures like a free tool end: an
  // anchor on a blunt cap end, or buried in the hand, sits nowhere near as
  // clear of the grip mass as the real nib does.
  if (shipped) {
    const p = { x: Math.round(shipped[0] * (w - 1)), y: Math.round(shipped[1] * (h - 1)) }
    let sx = 0
    let sy = 0
    let n = 0
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        if (!mask[y * w + x]) continue
        sx += x
        sy += y
        n += 1
      }
    }
    const dx = p.x - sx / Math.max(1, n)
    const dy = p.y - sy / Math.max(1, n)
    const len = Math.hypot(dx, dy) || 1
    const ownThin = inlandThickness(sprite, inner, p, dx / len, dy / len)
    const ownGrip = toGrip ? toGrip[p.y * w + p.x] : 0
    const ownScore =
      ownThin === Infinity ? -Infinity : hasGripMass ? ownGrip - ownThin * 2 : -ownThin
    if (ownScore >= winner.score * 0.8 - size * 0.01) {
      return {
        tip: [shipped[0], shipped[1]],
        arm,
        mode: 'shipped-ok',
        candidates: rank,
        own: Number(ownScore.toFixed(1)),
        grip: { maxInner: Number(maxInner.toFixed(1)), hasMass: hasGripMass, radius: Number(gripRadius.toFixed(1)) },
        skin: skin ? [skin.r, skin.g, skin.b] : null
      }
    }
  }
  return {
    tip: [winner.x / w, winner.y / h],
    arm,
    mode: kind === 'brush' ? 'brush-fallback' : winner.side,
    candidates: rank,
    grip: { maxInner: Number(maxInner.toFixed(1)), hasMass: hasGripMass, radius: Number(gripRadius.toFixed(1)) },
    skin: skin ? [skin.r, skin.g, skin.b] : null
  }
}

const spriteCache = new Map()
function readPng2(png) {
  const hit = spriteCache.get(png)
  if (hit) return hit
  const made = alphaMask(png)
  spriteCache.set(png, made)
  return made
}

/* ------------------------------------------------------------------ */
/* driver                                                             */
/* ------------------------------------------------------------------ */

const MAIN = resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')
if (MAIN) {
  const DRY = process.argv.includes('--dry')
  const sampleArg = process.argv.find((a) => a.startsWith('--sample='))
  const limit = sampleArg ? Number(sampleArg.split('=')[1]) : Infinity
  const explain = process.argv.find((a) => a.startsWith('--explain='))?.split('=')[1]
  const shipped = JSON.parse(readFileSync(`${ROOT}/src/shared/hand-tips-calibrated.json`, 'utf8'))

  const kindOf = (hand) =>
    /move in|move out|drag|point|hover|open|flat/i.test(hand.name)
      ? 'gesture'
      : /brush/i.test(hand.name)
        ? 'brush'
        : 'tool'

  if (explain) {
    const hand = LIBRARY.find((h) => String(h.id) === explain)
    if (!hand) throw new Error(`no library entry ${explain}`)
    const png = readPng(hand.hand1)
    const ma = measureTip(png, kindOf(hand), shipped[String(hand.id)]?.tip)
    console.log(hand.name, hand.group, 'kind', kindOf(hand), 'canvas', png.width + 'x' + png.height)
    console.log('arm', ma.arm, 'skin', ma.skin, 'grip', ma.grip)
    console.table(ma.candidates)
    console.log('chosen', ma.mode, ma.tip, '| shipped', shipped[String(hand.id)]?.tip)
    process.exit(0)
  }

  const results = []
  const flags = []
  const modes = new Map()
  const moved = []
  for (const hand of LIBRARY.slice(0, limit)) {
    const a = readPng(hand.hand1)
    if (!a) {
      flags.push(`MISSING ${hand.id} ${hand.name}`)
      continue
    }
    const kind = kindOf(hand)
    const ma = measureTip(a, kind, shipped[String(hand.id)]?.tip)
    const b = hand.hand2 ? readPng(hand.hand2) : null
    const mb = b ? measureTip(b, kind, shipped[String(hand.id)]?.tip2) : null
    modes.set(ma.mode, (modes.get(ma.mode) ?? 0) + 1)
    const tip = ma.tip.map((v) => Number(v.toFixed(4)))
    results.push({
      id: String(hand.id),
      name: hand.name,
      group: hand.group,
      mode: ma.mode,
      tip,
      tip2: (mb ?? ma).tip.map((v) => Number(v.toFixed(4))),
      arm: [Number((ma.arm.x / a.width).toFixed(3)), Number((ma.arm.y / a.height).toFixed(3))]
    })
    const was = shipped[String(hand.id)]?.tip
    if (was) {
      const d = Math.hypot(tip[0] - was[0], tip[1] - was[1])
      if (d > 0.05) moved.push(`${hand.id} ${hand.group} ${hand.name} ${was} -> ${tip} d=${d.toFixed(3)} ${ma.mode}`)
    }
  }

  const lines = results.map(
    (r) => `  "${r.id}": { "tip": [${r.tip.join(', ')}], "tip2": [${r.tip2.join(', ')}] }`
  )
  if (!DRY) {
    writeFileSync(`${ROOT}/src/shared/hand-tips-calibrated.json`, `{\n${lines.join(',\n')}\n}\n`)
  }
  writeFileSync(`${ROOT}/tools/instrument-tips-measured.json`, JSON.stringify(results, null, 1))
  console.log(`measured ${results.length} | modes ${JSON.stringify(Object.fromEntries(modes))} | ${flags.length} flags${DRY ? ' (dry)' : ''}`)
  console.log(flags.slice(0, 30).join('\n'))
  console.log(`moved ${moved.length}:`)
  console.log(moved.join('\n'))

}
