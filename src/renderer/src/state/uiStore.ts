import { create } from 'zustand'

export type DialogId =
  | 'newProject'
  | 'projectSettings'
  | 'preferences'
  | 'assetLibrary'
  | 'export'
  | 'shortcuts'
  | 'about'
  | null

export type ToastKind = 'info' | 'success' | 'error'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  message: string
  kind: ToastKind
  action?: ToastAction
}

export interface ToastOptions {
  /** A single follow-up the user can take straight from the toast. */
  action?: ToastAction
  /** Override the automatic dismissal time in milliseconds. */
  duration?: number
}

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  tone?: 'default' | 'danger'
}

export interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  tone: 'default' | 'danger'
}

/**
 * A load the user is waiting on, as opposed to `busy`'s incidental progress.
 * Rendered as a blocking scrim, so it carries its own headline and subtext.
 */
export interface LoadingState {
  title: string
  detail?: string
}

interface UiState {
  dialog: DialogId
  paletteOpen: boolean
  previewOpen: boolean
  busy: string | null
  loading: LoadingState | null
  toasts: Toast[]
  confirm: ConfirmState | null

  openDialog(dialog: DialogId): void
  closeDialog(): void
  openPalette(): void
  closePalette(): void
  togglePalette(): void
  openPreview(): void
  closePreview(): void
  setBusy(busy: string | null): void
  startLoading(loading: LoadingState): void
  stopLoading(): void
  toast(message: string, kind?: ToastKind, options?: ToastOptions): void
  dismissToast(id: number): void
  askConfirm(options: ConfirmOptions): Promise<boolean>
  resolveConfirm(value: boolean): void
}

let toastId = 0
let confirmResolver: ((value: boolean) => void) | null = null

export const useUiStore = create<UiState>((set, get) => ({
  dialog: null,
  paletteOpen: false,
  previewOpen: false,
  busy: null,
  loading: null,
  toasts: [],
  confirm: null,

  openDialog(dialog) {
    set({ dialog })
  },

  closeDialog() {
    set({ dialog: null })
  },

  openPalette() {
    set({ paletteOpen: true })
  },

  closePalette() {
    set({ paletteOpen: false })
  },

  togglePalette() {
    set({ paletteOpen: !get().paletteOpen })
  },

  openPreview() {
    set({ previewOpen: true, dialog: null, paletteOpen: false })
  },

  closePreview() {
    set({ previewOpen: false })
  },

  setBusy(busy) {
    set({ busy })
  },

  startLoading(loading) {
    set({ loading, busy: null })
  },

  stopLoading() {
    set({ loading: null })
  },

  toast(message, kind = 'info', options) {
    toastId += 1
    const toast: Toast = { id: toastId, message, kind, action: options?.action }
    set({ toasts: [...get().toasts, toast].slice(-4) })
    const duration = options?.duration ?? (kind === 'error' ? 7000 : 4200)
    window.setTimeout(() => get().dismissToast(toast.id), duration)
  },

  dismissToast(id) {
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
  },

  askConfirm(options) {
    confirmResolver?.(false)
    set({
      confirm: {
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Delete',
        tone: options.tone ?? 'danger'
      }
    })
    return new Promise<boolean>((resolve) => {
      confirmResolver = resolve
    })
  },

  resolveConfirm(value) {
    const resolver = confirmResolver
    confirmResolver = null
    set({ confirm: null })
    resolver?.(value)
  }
}))
