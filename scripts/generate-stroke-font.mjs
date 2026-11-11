#!/usr/bin/env node
/**
 * Extract handwriting strokes from a font installed on this machine and write
 * an app-importable stroke bundle.
 *
 * The app ships its own stroke faces; this script is the local path for fonts
 * it cannot bundle — Arial, Calibri, Georgia, Times New Roman and every other
 * proprietary system face. It runs the vendored Tegaki generator (Bun) over the
 * TTF/OTF, then converts its output with prepare-stroke-font.mjs.
 *
 * Usage:
 *   node scripts/generate-stroke-font.mjs --font "C:/Windows/Fonts/arial.ttf"
 *   npm run generate:stroke-font -- --font <file> [--family Arial] [--id arial]
 *                                   [--chars "ABC…"] [--pipeline geometry|raster]
 *                                   [--output out/stroke-fonts] [--debug]
 *
 * Import the resulting JSON with Text → Add custom font. The output lives under
 * `out/` (gitignored) on purpose: stroke data derived from a proprietary font
 * is fine to use locally but must not be committed or redistributed.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GENERATOR_DIR = join(ROOT, 'tools', 'tegaki', 'packages', 'generator')
const PREPARE_SCRIPT = join(ROOT, 'scripts', 'prepare-stroke-font.mjs')

/**
 * Letters, digits and the punctuation handwriting needs. Pass --chars to widen
 * it (the generator also accepts every glyph in the font with --chars all).
 */
const DEFAULT_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,;:!?'-()/@#%&*+=<>[]{}"

function usage() {
  console.log(`Extract stroke data from a local font with Tegaki.

  node scripts/generate-stroke-font.mjs --font <path.ttf|.otf> [options]

Options:
  --font <path>        Font file to read (required).
  --family <name>      Family name shown in the font picker. Defaults to the
                       name Tegaki reads from the font.
  --id <slug>          Bundle id used for the output file name. Defaults to a
                       slug of the family name.
  --chars <string>     Characters to extract. Defaults to Latin letters, digits
                       and punctuation; --chars all takes every glyph.
  --pipeline <mode>    geometry (default: traces the outline) or raster
                       (skeletonizes a bitmap; better for heavily filled faces).
  --output <dir>       Output folder. Defaults to out/stroke-fonts.
  --license <file>     Copy this licence next to the bundle.
  --debug              Keep Tegaki's per-glyph intermediate files.
  --keep-bundle        Keep the raw Tegaki bundle folder.

The finished JSON is imported in the editor with Text → Add custom font.`)
}

function readArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const [rawKey, inline] = token.slice(2).split('=', 2)
    if (inline !== undefined) {
      parsed[rawKey] = inline
      continue
    }
    const next = argv[index + 1]
    if (next !== undefined && !next.startsWith('--')) {
      parsed[rawKey] = next
      index += 1
    } else {
      parsed[rawKey] = true
    }
  }
  return parsed
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function humanName(value) {
  return value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function familyFromBundle(filePath) {
  if (!existsSync(filePath)) return undefined
  const source = readFileSync(filePath, 'utf8')
  const match = source.match(/family:\s*'([^']+)'/)
  return match ? match[1] : undefined
}

function run(command, commandArgs, cwd) {
  const result = spawnSync(command, commandArgs, { cwd, stdio: 'inherit', windowsHide: true })
  if (result.error) {
    if (result.error.code === 'ENOENT') return false
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`\`${command}\` exited with ${result.status ?? 'a signal'}.`)
  }
  return true
}

/**
 * Locate the real Bun binary. Both bun.sh and npm install a shell shim on
 * Windows (`bun.cmd`), which spawnSync cannot execute directly, so the known
 * install locations are checked for the executable before falling back to
 * PATH entries.
 */
function resolveBun() {
  const exe = process.platform === 'win32' ? 'bun.exe' : 'bun'
  const candidates = []
  if (process.env.BUN_INSTALL) candidates.push(join(process.env.BUN_INSTALL, 'bin', exe))
  candidates.push(join(homedir(), '.bun', 'bin', exe))
  if (process.env.APPDATA) {
    candidates.push(join(process.env.APPDATA, 'npm', 'node_modules', 'bun', 'bin', exe))
  }
  if (process.env.LOCALAPPDATA) {
    candidates.push(join(process.env.LOCALAPPDATA, 'npm', 'node_modules', 'bun', 'bin', exe))
  }
  const separator = process.platform === 'win32' ? ';' : ':'
  for (const entry of (process.env.PATH ?? '').split(separator)) {
    if (entry) candidates.push(join(entry, exe))
  }
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function main() {
  const args = readArgs(process.argv.slice(2))
  if (args.help || args.h) {
    usage()
    return
  }

  const fontArg = typeof args.font === 'string' ? args.font : null
  if (!fontArg) {
    usage()
    process.exitCode = 1
    return
  }

  const fontPath = resolve(fontArg)
  const fontInfo = statSync(fontPath, { throwIfNoEntry: false })
  if (!fontInfo || !fontInfo.isFile()) throw new Error(`No font file at ${fontPath}.`)
  const extension = extname(fontPath).toLowerCase()
  if (extension !== '.ttf' && extension !== '.otf') {
    throw new Error(`Expected a .ttf or .otf font, got ${extension || 'no extension'}.`)
  }

  const baseId = slugify(typeof args.id === 'string' ? args.id : basename(fontPath, extension))
  if (!baseId) throw new Error('Could not derive a bundle id; pass --id.')

  const outputDir = resolve(typeof args.output === 'string' ? args.output : join(ROOT, 'out', 'stroke-fonts'))
  const bundleDir = join(outputDir, '.tegaki', baseId)
  mkdirSync(bundleDir, { recursive: true })

  const charsArg =
    args.chars === 'all' || args.chars === true
      ? 'true'
      : typeof args.chars === 'string'
        ? args.chars
        : DEFAULT_CHARS
  const pipeline = args.pipeline === 'raster' ? 'raster' : 'geometry'

  console.log(`== Reading ${fontPath}`)
  const generateArgs = [
    '--conditions=tegaki@dev',
    'src/cli/index.ts',
    'generate',
    '--font-file',
    fontPath,
    '--pipeline',
    pipeline,
    '--chars',
    charsArg,
    '--output',
    bundleDir
  ]
  if (args.debug) generateArgs.push('--debug')

  const bun = resolveBun()
  if (!bun) {
    throw new Error(
      'Bun was not found. The Tegaki generator is a Bun tool — install Bun from https://bun.sh and run this again.'
    )
  }
  run(bun, generateArgs, GENERATOR_DIR)

  const glyphFile = join(bundleDir, 'glyphData.json')
  const bundleFile = join(bundleDir, 'bundle.ts')
  if (!existsSync(glyphFile) || !existsSync(bundleFile)) {
    throw new Error(`Tegaki did not write a bundle in ${bundleDir}. Check the generator output above.`)
  }

  const family =
    typeof args.family === 'string'
      ? args.family
      : (familyFromBundle(bundleFile) ?? humanName(baseId))
  const id = slugify(baseId)

  const prepareArgs = [
    PREPARE_SCRIPT,
    '--input',
    bundleDir,
    '--id',
    id,
    '--family',
    family,
    '--output',
    outputDir,
    '--license-dir',
    outputDir
  ]
  if (typeof args.license === 'string') prepareArgs.push('--license', resolve(args.license))

  console.log(`== Converting to ${id}.json`)
  run(process.execPath, prepareArgs, ROOT)

  const target = join(outputDir, `${id}.json`)
  const bundle = JSON.parse(readFileSync(target, 'utf8'))
  const glyphCount = Object.keys(bundle.glyphs ?? {}).length
  if (glyphCount === 0) throw new Error('The bundle contains no glyphs.')

  if (!args['keep-bundle']) rmSync(bundleDir, { recursive: true, force: true })

  const kilobytes = Math.max(1, Math.round(statSync(target).size / 1024))
  console.log(`\nWrote ${target}`)
  console.log(`  ${glyphCount} glyphs · ${kilobytes} KB · family “${family}”`)
  console.log('  Import it in the editor: select a text element → Add custom font → choose that JSON.')
  console.log('  Keep it local — do not commit stroke data extracted from a proprietary font.')
}

try {
  main()
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
