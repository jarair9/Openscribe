import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { basename, extname, join, relative, resolve, sep } from 'node:path'
import { app } from 'electron'
import type { LibraryItem } from '@shared/ipc'

const CATEGORIES: LibraryItem['category'][] = [
  'hands', 'hand-and-pen-tools', 'characters', 'illustration-styles', 'illustrations', 'ui-icons'
]
const ALLOWED_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp'])

export function libraryRoot(): string {
  const root = app.isPackaged ? join(process.resourcesPath, 'open-assets') : join(app.getAppPath(), 'open-assets')
  return resolve(root)
}

let cachedCatalog: LibraryItem[] | null = null

function walk(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : []
  })
}

function displayName(path: string): string {
  return basename(path, extname(path)).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function handItems(root: string): LibraryItem[] {
  const handRoot = join(root, 'hands')
  const metadataPath = join(handRoot, 'hands-metadata.json')
  if (!existsSync(metadataPath)) return []
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as Array<{ id: number; name: string; group: string }>
  const paths = walk(handRoot)
  return metadata.flatMap((hand) => {
    const file = paths.find((candidate) => {
      const fileName = basename(candidate).toLowerCase()
      return fileName.startsWith(`${hand.id}-`) && fileName.endsWith('_hand1.png')
    })
    if (!file) return []
    return [{
      id: `hands:${hand.id}`,
      name: hand.name,
      category: 'hands' as const,
      group: hand.group,
      relativePath: relative(root, file).split(sep).join('/'),
      kind: 'image' as const
    }]
  })
}

export function listLibraryItems(): LibraryItem[] {
  if (cachedCatalog) return cachedCatalog
  const root = libraryRoot()
  const items: LibraryItem[] = handItems(root)
  for (const category of CATEGORIES) {
    if (category === 'hands') continue
    for (const path of walk(join(root, category))) {
      const extension = extname(path).toLowerCase()
      if (!ALLOWED_EXTENSIONS.has(extension)) continue
      const relativePath = relative(root, path).split(sep).join('/')
      items.push({
        id: `${category}:${relativePath}`,
        name: displayName(path),
        category,
        group: category,
        relativePath,
        kind: extension === '.svg' ? 'svg' : 'image'
      })
    }
  }
  cachedCatalog = items.sort((a, b) => a.category.localeCompare(b.category) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
  return cachedCatalog
}

export function libraryItemById(id: string): { item: LibraryItem; filePath: string } | null {
  const item = listLibraryItems().find((candidate) => candidate.id === id)
  if (!item) return null
  const root = libraryRoot()
  const filePath = resolve(root, item.relativePath)
  if (!filePath.startsWith(`${root}${sep}`) || !statSync(filePath, { throwIfNoEntry: false })?.isFile()) return null
  return { item, filePath }
}

export function resolveLibraryPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..' || segment.includes('\\'))) return null
  const root = libraryRoot()
  const candidate = resolve(root, ...segments)
  if (!candidate.startsWith(`${root}${sep}`)) return null
  const category = segments[0]
  if (!CATEGORIES.includes(category as LibraryItem['category'])) return null
  const info = statSync(candidate, { throwIfNoEntry: false })
  if (!info?.isFile()) return null
  const realRoot = realpathSync(root)
  const realCandidate = realpathSync(candidate)
  return realCandidate.startsWith(`${realRoot}${sep}`) ? realCandidate : null
}
