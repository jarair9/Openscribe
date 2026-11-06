import { useEffect, useState, type JSX } from 'react'
import { PenLine } from 'lucide-react'
import { PRODUCT } from '@shared/product'
import type { AppInfo } from '@shared/ipc'
import { Dialog } from './Dialog'

export function AboutDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let active = true
    void window.api.app.info().then((value) => {
      if (active) setInfo(value)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <Dialog
      title={`About ${PRODUCT.name}`}
      subtitle="An independent, open-source whiteboard animation editor."
      onClose={onClose}
      footer={
        <>
          <button
            className="btn"
            onClick={() => void window.api.app.openLogsFolder()}
          >
            Open logs folder
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div className="welcome-mark" style={{ width: 42, height: 42, borderRadius: 11 }}>
          <PenLine size={20} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{PRODUCT.name}</div>
          <div className="hint">
            Version {info?.version ?? PRODUCT.version} · {PRODUCT.license} license
          </div>
        </div>
      </div>

      <div className="hint">
        Local-first by design: no accounts, no cloud sync, no telemetry, and no required network
        access. Projects are plain JSON documents with an assets folder you can back up yourself.
      </div>

      <div className="hint">
        Built with Electron, React, TypeScript, Zustand, Zod, svgpath, and Lucide icons. All artwork
        and drawing instruments are original; no proprietary VideoScribe code, assets, or branding
        are used.
      </div>

      {info ? (
        <div className="hint">
          Platform: {info.platform} · {info.isDev ? 'Development build' : 'Packaged build'}
          <br />
          Logs: {info.logsDir}
        </div>
      ) : null}
    </Dialog>
  )
}
