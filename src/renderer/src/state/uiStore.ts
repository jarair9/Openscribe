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

export interface Toast {
  id: number
  message: string
  kind: ToastKind
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
  previewOpen: boolean
  busy: string | null
  loading: LoadingState | null
  toasts: Toast[]
  confirm: ConfirmState | null

  openDialog(dialog: DialogId): void
  closeDialog(): void
  openPreview(): void
  closePreview(): void
  setBusy(busy: string | null): void
  startLoading(loading: LoadingState): void
  stopLoading(): void
  toast(message: string, kind?: ToastKind): void
  dismissToast(id: number): void
  askConfirm(options: ConfirmOptions): Promise<boolean>
  resolveConfirm(value: boolean): void
}

let toastId = 0
let confirmResolver: ((value: boolean) => void) | null = null

export const useUiStore = create<UiState>((set, get) => ({
  dialog: null,
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

  openPreview() {
    set({ previewOpen: true, dialog: null })
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

  toast(message, kind = 'info') {
    toastId += 1
    const toast: Toast = { id: toastId, message, kind }
    set({ toasts: [...get().toasts, toast].slice(-4) })
    window.setTimeout(() => get().dismissToast(toast.id), kind === 'error' ? 7000 : 4200)
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
