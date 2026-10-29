import { useState } from 'react'
import Popover from './Popover'
import type { SavedView } from './gridPrefs'

type Props = {
  views: SavedView[]
  onApply: (view: SavedView) => void
  onSave: (name: string) => void
  onDelete: (name: string) => void
  onReset: () => void
}

export default function ViewsMenu({ views, onApply, onSave, onDelete, onReset }: Props) {
  const [name, setName] = useState('')

  return (
    <Popover
      width={288}
      align="right"
      trigger={({ ref, toggle, open }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`inline-flex h-7 items-center gap-1.5 rounded border px-2 text-[11px] font-medium transition-colors ${
            open
              ? 'border-slate-400 bg-slate-100 text-slate-900'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
            <path d="M1.5 2.2h9M1.5 6h9M1.5 9.8h5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Views
          {views.length > 0 && (
            <span className="tabular rounded bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">
              {views.length}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="font-semibold text-slate-700">Saved views</span>
            <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
              Menyimpan kolom tampil, freeze, lebar, density, dan filter.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-1">
            {views.length === 0 && (
              <p className="px-3 py-4 text-center text-[11px] text-slate-400">
                Belum ada view tersimpan.
              </p>
            )}
            {views.map(view => (
              <div key={view.name} className="flex items-center gap-1 px-2 py-0.5 hover:bg-slate-50">
                <button
                  type="button"
                  onClick={() => {
                    onApply(view)
                    close()
                  }}
                  className="flex-1 truncate rounded px-1 py-1 text-left text-[11.5px] text-slate-700 hover:text-slate-900"
                  title={`${view.name} · ${view.prefs.frozen.length} frozen · ${view.prefs.hidden.length} hidden`}
                >
                  {view.name}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(view.name)}
                  aria-label={`Delete view ${view.name}`}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2.5 w-2.5">
                    <path d="m2 2 6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 bg-slate-50 p-2">
            <div className="flex gap-1">
              <input
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                placeholder="Nama view baru…"
                aria-label="Nama view baru"
                className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-[11.5px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => {
                  onSave(name.trim())
                  setName('')
                }}
                className="rounded bg-slate-800 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-900 disabled:opacity-40"
              >
                Save
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                onReset()
                close()
              }}
              className="mt-1.5 w-full rounded px-2 py-1 text-[10.5px] font-medium text-slate-500 hover:bg-slate-200"
            >
              Reset ke layout default
            </button>
          </div>
        </>
      )}
    </Popover>
  )
}