#!/usr/bin/env node
/**
 * Convert a tegaki-generator bundle directory into the app's stroke-font JSON.
 *
 * The generator is a Bun tool kept outside the app bundle; this step is the
 * reproducible bridge between its output and fonts/bundles. After running it,
 * add the new file to fonts/index.ts to make the face selectable.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

const input = arg('input')
const id = arg('id')
const family = arg('family')
const license = arg('license')
const output = resolve(arg('output', 'fonts/bundles'))
const licenseDir = resolve(arg('license-dir', 'fonts'))
if (!input || !id || !family) {
  console.error(
    'Usage: node scripts/prepare-stroke-font.mjs --input <bundle-dir> --id <slug> --family <name> [--license <file>] [--output <dir>]'
  )
  process.exit(1)
}

const bundleSource = readFileSync(join(input, 'bundle.ts'), 'utf8')
const numberField = (field) => {
  const match = bundleSource.match(new RegExp(`${field}:\\s*(-?[\\d.]+)`))
  if (!match) throw new Error(`Missing ${field} in ${join(input, 'bundle.ts')}`)
  return Number(match[1])
}
const stringField = (field) => {
  const match = bundleSource.match(new RegExp(`${field}:\\s*'([^']+)'`))
  return match ? match[1] : undefined
}
const glyphs = JSON.parse(readFileSync(join(input, 'glyphData.json'), 'utf8'))

const bundle = {
  id,
  family,
  unitsPerEm: numberField('unitsPerEm'),
  ascender: numberField('ascender'),
  descender: numberField('descender'),
  lineCap: stringField('lineCap') ?? 'round',
  glyphs
}

mkdirSync(output, { recursive: true })
const target = join(output, `${id}.json`)
writeFileSync(target, JSON.stringify(bundle))
if (license) {
  mkdirSync(licenseDir, { recursive: true })
  copyFileSync(license, join(licenseDir, `${id}.LICENSE.txt`))
}
console.log(
  `Wrote ${target} (${Object.keys(glyphs).length} glyphs, ${basename(license ?? 'no license')}, ${bundle.unitsPerEm} upm)`
)
