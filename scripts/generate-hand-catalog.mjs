import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

const root = resolve('open-assets/hands')
const out = resolve('src/shared/hand-library.json')
const records = JSON.parse(readFileSync(join(root, 'hands-metadata.json'), 'utf8'))

function walk(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : []
  })
}

const files = walk(root)
const catalog = records.flatMap((record) => {
  const stem = new RegExp(`(?:^|[\\\\/])${record.id}-.+_hand1\\.png$`, 'i')
  const hand1 = files.find((path) => stem.test(path))
  if (!hand1) return []
  const base = hand1.replace(/_hand1\.png$/i, '')
  const attr = (key) => Number(record.metadata.match(new RegExp(`${key}='(-?\\d+)'`))?.[1] ?? Number.NaN)
  const width = hand1 && readFileSync(hand1).readUInt32BE(16)
  const height = hand1 && readFileSync(hand1).readUInt32BE(20)
  const aspect = width / height
  const handedness = (x) => x < 0 ? 'left' : 'right'
  const tip = (x, y, sourceHandedness) => {
    // Most VideoScribe hand offsets use the 192px authoring coordinate space.
    // Out-of-canvas offsets are common for photographic hand assets. Their
    // nib is at the upper outer corner: right for left-handed source art and
    // left for right-handed source art. Keep that source orientation in sync
    // with the renderer so the correct corner remains attached after a flip.
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || y > 192 || x > 192 * aspect) {
      return { x: sourceHandedness === 'left' ? 0.95 : 0.05, y: 0.06 }
    }
    return { x: x / Math.max(1, 192 * aspect), y: y / 192 }
  }
  const offset1X = attr('offset1X')
  const offset2X = attr('offset2X')
  const sourceHandedness = handedness(offset1X)
  const sourceHandedness2 = handedness(offset2X)
  const tip1 = tip(offset1X, attr('offset1Y'), sourceHandedness)
  const tip2 = tip(offset2X, attr('offset2Y'), sourceHandedness2)
  return [{
    id: String(record.id),
    name: String(record.name).replace(/[_-]+/g, ' ').trim(),
    group: record.group,
    hand1: relative(resolve('.'), hand1).split(sep).join('/'),
    hand2: existsSync(`${base}_hand2.png`) ? relative(resolve('.'), `${base}_hand2.png`).split(sep).join('/') : null,
    thumbnail: existsSync(`${base}_thumb.jpg`) ? relative(resolve('.'), `${base}_thumb.jpg`).split(sep).join('/') : null,
    aspect,
    tipX: tip1.x,
    tipY: tip1.y,
    tip2X: tip2.x,
    tip2Y: tip2.y,
    sourceHandedness,
    sourceHandedness2,
    author: record.author
  }]
})

writeFileSync(out, `${JSON.stringify(catalog)}\n`)
console.log(`Generated ${catalog.length} local hand presets.`)
