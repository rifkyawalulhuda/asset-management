import { useEffect, useRef, useState } from 'react'

export default function DeleteAssetDialog({
  open,
  name,
  assetNo,
  deleting,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean
  name: string
  assetNo: string
  deleting: boolean
  error: string | null
  onClose: () => void
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setTyped('')
    const timer = window.setTimeout(() => inputRef.current?.focus(), 60)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, deleting, onClose])

  // Nothing is rendered while closed: the card must not linger on screen behind
  // an inert overlay, and re-mounting resets the typed confirmation.
  if (!open) return null

  const matches = typed.trim() === assetNo

  return (
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => !deleting && onClose()} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-asset-title"
          className="w-full max-w-[400px] rounded-lg border border-slate-200 bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.5)]"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 id="delete-asset-title" className="text-[13px] font-semibold text-slate-900">
              Delete this asset?
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              The asset and its depreciation schedule are removed permanently. This cannot be undone.
            </p>
          </div>

          <div className="px-4 py-3">
            <p className="text-[11.5px] text-slate-700">
              Type <span className="rounded bg-slate-100 px-1 py-[1px] font-mono text-[11px] text-slate-800">{assetNo}</span> to confirm.
            </p>
            <p className="mt-0.5 truncate text-[10.5px] text-slate-400" title={name}>{name}</p>
            <input
              ref={inputRef}
              value={typed}
              onChange={event => setTyped(event.target.value)}
              disabled={deleting}
              aria-label={`Type ${assetNo} to confirm deletion`}
              placeholder={assetNo}
              className="mt-2 h-8 w-full rounded border border-slate-300 px-2 font-mono text-[11.5px] text-slate-800 placeholder:text-slate-300 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-200 disabled:opacity-50"
            />
            {error && (
              <p role="alert" className="mt-2 rounded bg-rose-50 px-2 py-1 text-[10.5px] text-rose-700">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="h-7 rounded border border-slate-300 bg-white px-3 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!matches || deleting}
              className="h-7 rounded bg-rose-600 px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deleting ? 'Deleting…' : 'Delete asset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
