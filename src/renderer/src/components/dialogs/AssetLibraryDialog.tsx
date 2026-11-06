import { useEffect, useMemo, useState, type JSX } from 'react'
import { ImagePlus, Music2, Plus, Star, Trash2 } from 'lucide-react'
import { removeAsset, updateAsset } from '@core/project/operations'
import type { Asset, AssetKindName, Project, Scene } from '@core/schema/project'
import { assetUrl, libraryAssetUrl } from '../../lib/assets'
import { importAssetPaths, importAssetsFromDialog } from '../../services/importAssets'
import { insertAssetAtPlayhead } from '../../services/insertAsset'
import { useProjectStore } from '../../state/projectStore'
import { useUiStore } from '../../state/uiStore'
import { Dialog } from './Dialog'
import type { LibraryItem } from '@shared/ipc'

type Filter = 'all' | AssetKindName

export function AssetLibraryDialog({ onClose }: { onClose: () => void }): JSX.Element | null {
  const project = useProjectStore((state) => state.project)
  const session = useProjectStore((state) => state.session)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'project' | 'bundled'>('project')
  const [library, setLibrary] = useState<LibraryItem[]>([])
  const [libraryCategory, setLibraryCategory] = useState<'all' | LibraryItem['category']>('all')
  const [loadingLibrary, setLoadingLibrary] = useState(false)

  useEffect(() => {
    if (source !== 'bundled' || library.length) return
    let live = true
    setLoadingLibrary(true)
    void window.api.library.list().then((items) => {
      if (live) setLibrary(items)
    }).catch((error: unknown) => {
      if (live) useUiStore.getState().toast(error instanceof Error ? error.message : 'Could not load bundled assets.', 'error')
    }).finally(() => {
      if (live) setLoadingLibrary(false)
    })
    return () => { live = false }
  }, [source, library.length])

  const assets = useMemo(() => {
    if (!project) return []
    const term = query.trim().toLowerCase()
    return project.assets.filter((asset) => {
      if (filter !== 'all' && asset.kind !== filter) return false
      if (term && !asset.name.toLowerCase().includes(term)) return false
      return true
    })
  }, [project, filter, query])

  const libraryAssets = useMemo(() => {
    const term = query.trim().toLowerCase()
    return library.filter((asset) => asset.category !== 'hands' && asset.category !== 'hand-and-pen-tools' &&
      (libraryCategory === 'all' || asset.category === libraryCategory) &&
      (!term || `${asset.name} ${asset.category} ${asset.group}`.toLowerCase().includes(term)))
  }, [library, libraryCategory, query])
  const visibleLibraryAssets = libraryAssets.slice(0, 160)

  if (!project || !session) return null

  return (
    <Dialog
      title="Asset library"
      subtitle="Add bundled artwork to this project or manage media already in your library."
      wide
      onClose={onClose}
      footer={
        <>
          <span className="footer-hint">
            {project.assets.length} asset{project.assets.length === 1 ? '' : 's'} in this project.
          </span>
          <button className="btn" onClick={() => void importAssetsFromDialog()}>
            <ImagePlus size={13} /> Import files
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="asset-toolbar">
        <input
          className="text-input"
          placeholder="Search assets"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="tabs" role="group" aria-label="Asset source">
          <button className={`tab ${source === 'project' ? 'active' : ''}`} aria-pressed={source === 'project'} onClick={() => setSource('project')}>Project</button>
          <button className={`tab ${source === 'bundled' ? 'active' : ''}`} aria-pressed={source === 'bundled'} onClick={() => setSource('bundled')}>Bundled library</button>
        </div>
        {source === 'project' ? <div className="tabs">
          {(['all', 'svg', 'image', 'audio'] as const).map((entry) => (
            <button
              key={entry}
              className={`tab ${filter === entry ? 'active' : ''}`}
              aria-pressed={filter === entry}
              onClick={() => setFilter(entry)}
            >
              {entry === 'all' ? 'All' : entry === 'svg' ? 'SVG' : entry === 'image' ? 'Images' : 'Audio'}
            </button>
          ))}
        </div> : <div className="tabs library-category-tabs">
          {(['all', 'characters', 'illustration-styles', 'illustrations', 'ui-icons'] as const).map((category) => (
            <button key={category} className={`tab ${libraryCategory === category ? 'active' : ''}`} aria-pressed={libraryCategory === category} onClick={() => setLibraryCategory(category)}>
              {category === 'all' ? 'All' : category.replaceAll('-', ' ')}
            </button>
          ))}
        </div>}
      </div>

      {source === 'project' ? (assets.length === 0 ? (
        <div className="recent-empty">
          {project.assets.length === 0
            ? 'No assets yet. Import SVG illustrations, images, or audio to get started.'
            : 'No assets match this filter.'}
        </div>
      ) : (
        <div className="asset-grid">
          {assets.map((asset) => (
            <AssetTile
              key={asset.id}
              project={project}
              asset={asset}
              token={session.assetToken}
              onInserted={onClose}
            />
          ))}
        </div>
      )) : loadingLibrary ? <div className="recent-empty">Loading bundled library…</div> : libraryAssets.length === 0 ? (
        <div className="recent-empty">No bundled items match this search.</div>
      ) : (
        <div className="asset-grid">
          {visibleLibraryAssets.map((item) => <BundledAssetTile key={item.id} item={item} onInserted={onClose} />)}
        </div>
      )}
      {source === 'bundled' && libraryAssets.length > visibleLibraryAssets.length ? (
        <div className="footer-hint" style={{ padding: '8px 2px' }}>
          Showing {visibleLibraryAssets.length} of {libraryAssets.length} matches. Search or choose a category to narrow the list.
        </div>
      ) : null}
    </Dialog>
  )
}

function BundledAssetTile({ item, onInserted }: { item: LibraryItem; onInserted: () => void }): JSX.Element {
  const [busy, setBusy] = useState(false)
  const token = useProjectStore((state) => state.session?.assetToken)
  const add = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      if (!token) throw new Error('Open a project before adding bundled assets.')
      const result = await window.api.library.importAsset(item.id, token)
      const count = await importAssetPaths([], result)
      if (count > 0) onInserted()
    } catch (error) {
      useUiStore.getState().toast(error instanceof Error ? error.message : 'Could not add this item.', 'error')
    } finally {
      setBusy(false)
    }
  }
  return <div className="asset-tile">
    <div className="asset-tile-preview"><img src={libraryAssetUrl(item.relativePath)} alt={item.name} loading="lazy" /></div>
    <div className="asset-tile-meta">
      <div className="asset-tile-name" title={item.name}>{item.name}</div>
      <div className="asset-tile-sub">{item.category.replaceAll('-', ' ')} · {item.group}</div>
      <button className="btn btn-sm" style={{ marginTop: 5, width: '100%' }} disabled={busy} onClick={() => void add()}>
        <Plus size={13} /> {busy ? 'Adding…' : 'Add & insert'}
      </button>
    </div>
  </div>
}

function AssetTile({
  project,
  asset,
  token,
  onInserted
}: {
  project: Project
  asset: Asset
  token: string
  onInserted: () => void
}): JSX.Element {
  const apply = useProjectStore((state) => state.apply)
  const askConfirm = useUiStore((state) => state.askConfirm)
  const used = assetInUse(project, asset.id)

  const insert = (): void => {
    if (insertAssetAtPlayhead(asset)) onInserted()
  }

  const remove = async (): Promise<void> => {
    if (used) {
      useUiStore
        .getState()
        .toast('This asset is used by the project. Remove its elements first.', 'error')
      return
    }
    const confirmed = await askConfirm({
      title: 'Remove asset?',
      message: `“${asset.name}” will be removed from the library. The file stays on disk.`,
      confirmLabel: 'Remove asset'
    })
    if (!confirmed) return
    apply('Remove asset', (current) => removeAsset(current, asset.id), { coalesce: false })
  }

  return (
    <div className="asset-tile">
      <button
        className={`asset-tile-preview ${asset.kind === 'audio' ? 'audio' : ''}`}
        style={{ width: '100%', border: 0, padding: 0, cursor: 'pointer' }}
        title={`Insert ${asset.name}`}
        onClick={insert}
      >
        {asset.kind === 'audio' ? (
          <Music2 size={30} />
        ) : (
          <img src={assetUrl(token, asset.fileName)} alt={asset.name} loading="lazy" />
        )}
      </button>
      <div className="asset-tile-meta">
        <div className="asset-tile-name" title={asset.name}>
          {asset.name}
        </div>
        <div className="asset-tile-sub">
          {asset.kind === 'svg' ? 'SVG' : asset.kind === 'image' ? 'Image' : 'Audio'} ·{' '}
          {(asset.byteSize / 1024).toFixed(0)} KB
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
          <button className="icon-btn" style={{ width: 24, height: 24 }} title="Insert into scene" onClick={insert}>
            <Plus size={13} />
          </button>
          <button
            className={`icon-btn ${asset.favorite ? 'active' : ''}`}
            style={{ width: 24, height: 24 }}
            title={asset.favorite ? 'Unfavorite' : 'Favorite'}
            onClick={() =>
              apply('Update asset', (current) =>
                updateAsset(current, asset.id, (item) => ({ ...item, favorite: !item.favorite }))
              )
            }
          >
            <Star size={13} fill={asset.favorite ? 'currentColor' : 'none'} />
          </button>
          <button
            className="icon-btn"
            style={{ width: 24, height: 24, marginLeft: 'auto' }}
            title={used ? 'Asset is in use' : 'Remove from library'}
            onClick={() => void remove()}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

function assetInUse(project: Project, assetId: string): boolean {
  return project.scenes.some((scene: Scene) => {
    if (scene.elements.some((element) => element.kind !== 'text' && element.kind !== 'shape' && element.assetId === assetId)) {
      return true
    }
    if (scene.audio.some((track) => track.assetId === assetId)) return true
    return scene.background.type === 'image' && scene.background.assetId === assetId
  })
}
