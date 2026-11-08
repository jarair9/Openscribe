import type { JSX } from 'react'
import { useUiStore } from '../../state/uiStore'
import { AboutDialog } from './AboutDialog'
import { AssetLibraryDialog } from './AssetLibraryDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { ExportDialog } from './ExportDialog'
import { NewProjectDialog } from './NewProjectDialog'
import { PreferencesDialog } from './PreferencesDialog'
import { ProjectSettingsDialog } from './ProjectSettingsDialog'
import { ShortcutsDialog } from './ShortcutsDialog'

export function DialogHost(): JSX.Element {
  const dialog = useUiStore((state) => state.dialog)
  const closeDialog = useUiStore((state) => state.closeDialog)

  return (
    <>
      {dialog === 'newProject' ? <NewProjectDialog onClose={closeDialog} /> : null}
      {dialog === 'projectSettings' ? <ProjectSettingsDialog onClose={closeDialog} /> : null}
      {dialog === 'preferences' ? <PreferencesDialog onClose={closeDialog} /> : null}
      {dialog === 'assetLibrary' ? <AssetLibraryDialog onClose={closeDialog} /> : null}
      {dialog === 'export' ? <ExportDialog onClose={closeDialog} /> : null}
      {dialog === 'shortcuts' ? <ShortcutsDialog onClose={closeDialog} /> : null}
      {dialog === 'about' ? <AboutDialog onClose={closeDialog} /> : null}
      <ConfirmDialog />
    </>
  )
}
