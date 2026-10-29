import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchAssets } from '../../services/assets'
import type { FixedAsset } from '../../types'

export default function AssetPicker({
  year,
  value,
  onChange,
  onSelect,
}: {
  year: number
  value: string
  onChange: (value: string) => void
  onSelect: (asset: FixedAsset) => void
}) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const { data, isFetching } = useQuery({
    queryKey: ['acq-asset-search', year, debounced],
    queryFn: () => fetchAssets({ search: debounced, year_ref: year, size: 8 }),
    enabled: open && debounced.length >= 2,
    staleTime: 60_000,
  })

  const results = data?.items ?? []

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const choose = (asset: FixedAsset) => {
    onSelect(asset)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        value={value}
        placeholder="Search AX no. or asset name…"
        autoComplete="off"
        onChange={event => {
          onChange(event.target.value)
          setQuery(event.target.value)
          setCursor(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setCursor(current => Math.min(current + 1, Math.max(results.length - 1, 0)))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setCursor(current => Math.max(current - 1, 0))
          } else if (event.key === 'Enter' && open && results[cursor]) {
            event.preventDefault()
            choose(results[cursor])
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls="acq-asset-listbox"
        className="h-8 w-full rounded border border-slate-300 px-2 text-[12px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />

      {open && debounced.length >= 2 && (
        <div
          id="acq-asset-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-md border border-slate-300 bg-white py-1 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)]"
        >
          {isFetching && !results.length && (
            <p className="px-2 py-2 text-[11px] text-slate-400">Searching…</p>
          )}
          {!isFetching && !results.length && (
            <p className="px-2 py-2 text-[11px] text-slate-400">No asset matches "{debounced}"</p>
          )}
          {results.map((asset, index) => (
            <button
              key={asset.id}
              type="button"
              role="option"
              aria-selected={index === cursor}
              onMouseEnter={() => setCursor(index)}
              onClick={() => choose(asset)}
              className={`flex w-full items-start gap-2 px-2 py-1.5 text-left transition-colors ${
                index === cursor ? 'bg-blue-50' : 'hover:bg-slate-50'
              }`}
            >
              <span className="mt-[3px] shrink-0 font-mono text-[10px] text-slate-500">{asset.fixed_asset_number_ax || asset.asset_no}</span>
              <span className="min-w-0">
                <span className="block truncate text-[11.5px] font-medium text-slate-800">{asset.name}</span>
                <span className="block truncate text-[10px] text-slate-400">
                  {[asset.site_location, asset.job, asset.group_name].filter(Boolean).join(' · ')}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}