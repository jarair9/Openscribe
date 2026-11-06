#!/usr/bin/env node
/**
 * Merge manually calibrated tips (tools/manual-tips.json) into the shipped
 * anchor table (src/shared/hand-tips-calibrated.json) that the app reads.
 *
 *   node scripts/apply-manual-tips.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DRY = process.argv.includes('--dry')

const manual = JSON.parse(readFileSync(`${ROOT}/tools/manual-tips.json`, 'utf8'))
const shipped = JSON.parse(readFileSync(`${ROOT}/src/shared/hand-tips-calibrated.json`, 'utf8'))

let changed = 0
let pose2 = 0
for (const [id, rec] of Object.entries(manual)) {
  if (!shipped[id]) {
    shipped[id] = { tip: rec.tip ?? [0, 0], tip2: rec.tip2 ?? rec.tip ?? [0, 0] }
    changed += 1
    continue
  }
  if (Array.isArray(rec.tip)) {
    if (!shipped[id].tip || shipped[id].tip[0] !== rec.tip[0] || shipped[id].tip[1] !== rec.tip[1]) changed += 1
    shipped[id].tip = rec.tip
  }
  if (Array.isArray(rec.tip2)) {
    if (!shipped[id].tip2 || shipped[id].tip2[0] !== rec.tip2[0] || shipped[id].tip2[1] !== rec.tip2[1]) pose2 += 1
    shipped[id].tip2 = rec.tip2
  }
}

if (!DRY) {
  writeFileSync(
    `${ROOT}/src/shared/hand-tips-calibrated.json`,
    `${JSON.stringify(shipped, null, 1)}\n`
  )
}
console.log(`merged ${Object.keys(manual).length} manual hands (${changed} entries changed, ${pose2} pose-2 updates)${DRY ? ' (dry)' : ''}`)
