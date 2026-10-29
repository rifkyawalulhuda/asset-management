import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createAcquisition, deleteAcquisition, fetchAcquisitions, updateAcquisition } from '../services/assets'
import { formatDate } from '../utils/format'
import type { AcquisitionDisposal } from '../types'
import AcqToolbar from '../components/acquisitions/AcqToolbar'
import KpiStrip from '../components/acquisitions/KpiStrip'
import TrendChart from '../components/acquisitions/TrendChart'
import TypeChip from '../components/acquisitions/TypeChip'
import RecordDrawer from '../components/acquisitions/RecordDrawer'
import {
  EMPTY_FILTERS,
  batchOf,
  compactIDR,
  countByType,
  downloadCSV,
  fullIDR,
  isIncomplete,
  matchesSearch,
  toRow,
} from '../components/acquisitions/acqUtils'
import type { AcqFilters, AcqRow } from '../components/acquisitions/acqUtils'

type SortState = { key: 'date' | 'price'; dir: 'asc' | 'desc' }

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 6 }, (_, index) => CURRENT_YEAR - index)

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}>
      <path d="M4 2.5 8 6l-4 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
      <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Acquisitions() {
  const qc = useQueryClient()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [filters, setFilters] = useState<AcqFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' })
  const [chartMode, setChartMode] = useState<'count' | 'value'>('count')
  const [grouped, setGrouped] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [drawer, setDrawer] = useState<{ record: AcquisitionDisposal | null } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['acquisitions', year],
    queryFn: () => fetchAcquisitions({ year_ref: year }),
  })

  const allRows = useMemo<AcqRow[]>(() => (data ?? []).map(toRow), [data])

  const typeCounts = useMemo(() => countByType(allRows), [allRows])

  const sites = useMemo(
    () => [...new Set(allRows.map(row => row.site).filter((value): value is string => Boolean(value)))].sort(),
    [allRows],
  )
  const jobs = useMemo(
    () => [...new Set(allRows.map(row => row.job).filter((value): value is string => Boolean(value)))].sort(),
    [allRows],
  )

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['acquisitions'] })
  }, [qc])

  const createMut = useMutation({
    mutationFn: createAcquisition,
    onSuccess: () => {
      invalidate()
      setDrawer(null)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<AcquisitionDisposal> }) => updateAcquisition(id, payload),
    onSuccess: () => {
      invalidate()
      setDrawer(null)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => deleteAcquisition(id))),
    onSuccess: invalidate,
  })

  /* ── Deferred delete with undo ─────────────────────────────────────────── */

  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const pendingRef = useRef<Map<number, AcqRow>>(new Map())
  const timerRef = useRef<number | null>(null)
  const deleteRef = useRef(deleteMut.mutate)
  deleteRef.current = deleteMut.mutate

  const commitDelete = useCallback(() => {
    const ids = [...pendingRef.current.keys()]
    pendingRef.current.clear()
    setPendingIds(new Set())
    timerRef.current = null
    if (ids.length) deleteRef.current(ids)
  }, [])

  useEffect(() => () => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    const ids = [...pendingRef.current.keys()]
    pendingRef.current.clear()
    if (ids.length) deleteRef.current(ids)
  }, [])

  const scheduleDelete = useCallback((ids: number[]) => {
    for (const id of ids) {
      const row = allRows.find(item => item.id === id)
      if (row) pendingRef.current.set(id, row)
    }
    setPendingIds(new Set(pendingRef.current.keys()))
    setSelected(new Set())
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(commitDelete, 5000)
  }, [allRows, commitDelete])

  const undoDelete = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    pendingRef.current.clear()
    setPendingIds(new Set())
  }

  /* ── Derived rows ──────────────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    return allRows.filter(row => {
      if (pendingIds.has(row.id)) return false
      if (filters.types.length && !filters.types.includes(row.type)) return false
      if (filters.site && row.site !== filters.site) return false
      if (filters.job && row.job !== filters.job) return false
      if (filters.from && (!row.transaction_date || row.transaction_date < filters.from)) return false
      if (filters.to && (!row.transaction_date || row.transaction_date > filters.to)) return false
      if (!filters.showIncomplete && isIncomplete(row)) return false
      return matchesSearch(row, filters.search)
    })
  }, [allRows, filters, pendingIds])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      if (sort.key === 'date') {
        const left = a.transaction_date ?? ''
        const right = b.transaction_date ?? ''
        const compare = left.localeCompare(right)
        return sort.dir === 'asc' ? compare : -compare
      }
      const compare = Number(a.price ?? 0) - Number(b.price ?? 0)
      return sort.dir === 'asc' ? compare : -compare
    })
    return copy
  }, [filtered, sort])

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; rows: AcqRow[]; total: number }>()
    for (const row of sorted) {
      const key = batchOf(row)
      const group = map.get(key) ?? { key, rows: [], total: 0 }
      group.rows.push(row)
      group.total += Number(row.price ?? 0)
      map.set(key, group)
    }
    return [...map.values()]
  }, [sorted])

  const rowNumber = useMemo(() => {
    const map = new Map<number, number>()
    sorted.forEach((row, index) => map.set(row.id, index + 1))
    return map
  }, [sorted])

  const incompleteCount = useMemo(() => allRows.filter(isIncomplete).length, [allRows])

  const hasFilters =
    filters.search !== '' ||
    filters.types.length > 0 ||
    filters.from !== '' ||
    filters.to !== '' ||
    filters.site !== '' ||
    filters.job !== '' ||
    filters.showIncomplete

  const patchFilters = (patch: Partial<AcqFilters>) => setFilters(current => ({ ...current, ...patch }))

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setSelected(new Set())
  }

  const toggleSelect = (id: number) => {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(current =>
      current.size === sorted.length ? new Set() : new Set(sorted.map(row => row.id)),
    )
  }

  const toggleGroup = (key: string) => {
    setCollapsed(current => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const submitDrawer = (payload: Partial<AcquisitionDisposal>) => {
    if (drawer?.record) updateMut.mutate({ id: drawer.record.id, payload })
    else createMut.mutate(payload)
  }

  const exportCsv = () => {
    const today = new Date().toISOString().slice(0, 10)
    downloadCSV(sorted, `movements_${year}_${today}.csv`)
  }

  const saving = createMut.isPending || updateMut.isPending
  const allSelected = sorted.length > 0 && selected.size === sorted.length

  const renderRow = (row: AcqRow) => (
    <tr
      key={row.id}
      onClick={() => setDrawer({ record: row })}
      className={`group cursor-pointer border-t border-slate-100 transition-colors hover:bg-amber-50/70 ${isIncomplete(row) ? 'bg-amber-50/40' : ''}`}
    >
      <td className="px-2 py-[5px]" onClick={event => event.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected.has(row.id)}
          onChange={() => toggleSelect(row.id)}
          aria-label={`Select ${row.asset_name ?? row.fixed_asset_no ?? 'record'}`}
          className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-200"
        />
      </td>
      <td className="px-2 py-[5px] tabular text-[10.5px] text-slate-500">{rowNumber.get(row.id)}</td>
      <td className="px-2 py-[5px] tabular text-[11px] text-slate-600">
        {row.transaction_date ? formatDate(row.transaction_date) : <span className="text-amber-600">no date</span>}
      </td>
      <td className="px-2 py-[5px]"><TypeChip type={row.type} /></td>
      <td className="px-2 py-[5px]">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-slate-800">{row.asset_name ?? '—'}</span>
          {isIncomplete(row) && (
            <span
              title={`Missing: ${row.missing.join(', ')}`}
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            />
          )}
        </div>
        <div className="truncate font-mono text-[10px] text-slate-400">{row.fixed_asset_no ?? 'no AX'}</div>
      </td>
      <td className="px-2 py-[5px] text-[11px] text-slate-600">{row.site ?? '—'}</td>
      <td className="px-2 py-[5px] text-[11px] text-slate-600">{row.job ?? '—'}</td>
      <td className="px-2 py-[5px] truncate font-mono text-[10px] text-slate-500">{row.bookslip_no ?? '—'}</td>
      <td className="px-2 py-[5px] truncate text-[11px] text-slate-600">{row.vendor_customer ?? '—'}</td>
      <td className="px-2 py-[5px] text-right tabular text-[11px] font-medium text-slate-800">
        {row.price ? fullIDR(row.price) : <span className="text-slate-300">—</span>}
      </td>
      <td className="px-1 py-[5px] text-right" onClick={event => event.stopPropagation()}>
        <button
          type="button"
          onClick={() => scheduleDelete([row.id])}
          aria-label={`Delete ${row.asset_name ?? 'record'}`}
          className="rounded p-1 text-slate-300 opacity-0 transition-colors hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100"
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  )

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-2">
      {/* Title */}
      <div className="mb-1 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Asset movement</p>
          <h1 className="mt-0.5 truncate text-[19px] font-semibold leading-tight text-slate-900">
            Acquisitions &amp; Disposals
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-slate-500">
            <span>PT. Sankyu Indonesia International</span>
            <span className="text-slate-300">·</span>
            <span className="tabular font-medium text-slate-700">{sorted.length.toLocaleString('id-ID')}</span>
            <span>{hasFilters ? ` of ${allRows.length.toLocaleString('id-ID')} movements` : ' movements'}</span>
            <span className="text-slate-300">·</span>
            <span>Year {year}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            disabled={!sorted.length}
            className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => setDrawer({ record: null })}
            className="rounded bg-slate-800 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-900"
          >
            + Add Record
          </button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)]">
        <KpiStrip rows={filtered} filtered={hasFilters} />

        <TrendChart rows={filtered} mode={chartMode} onMode={setChartMode} />
      </div>

      <AcqToolbar
        filters={filters}
        onChange={patchFilters}
        year={year}
        years={YEARS}
        onYear={value => {
          setYear(value)
          setSelected(new Set())
        }}
        sites={sites}
        jobs={jobs}
        typeCounts={typeCounts}
        incompleteCount={incompleteCount}
        grouped={grouped}
        onGrouped={setGrouped}
        onClear={clearFilters}
        hasFilters={hasFilters}
      />

      {selected.size > 0 && (
        <div className="flex shrink-0 items-center gap-3 rounded-md border border-slate-300 bg-slate-800 px-3 py-1.5 text-[11.5px] text-white shadow-sm">
          <span className="tabular">{selected.size} selected</span>
          <button
            type="button"
            onClick={() => scheduleDelete([...selected])}
            className="rounded bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white transition-colors hover:bg-rose-600"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[11px] text-slate-300 underline-offset-2 hover:text-white hover:underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="min-h-0 flex-1 overflow-auto fx-scroll">
          <table className="w-full table-fixed text-left text-[11.5px]">
            <colgroup>
              <col style={{ width: 30 }} />
              <col style={{ width: 34 }} />
              <col style={{ width: 86 }} />
              <col style={{ width: 104 }} />
              <col />
              <col style={{ width: 64 }} />
              <col style={{ width: 76 }} />
              <col style={{ width: 132 }} />
              <col style={{ width: 150 }} />
              <col style={{ width: 132 }} />
              <col style={{ width: 34 }} />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-1.5" scope="col">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all rows"
                    className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-200"
                  />
                </th>
                <th className="px-2 py-1.5 font-semibold" scope="col">#</th>
                <th className="px-2 py-1.5 font-semibold" scope="col" aria-sort={sort.key === 'date' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button
                    type="button"
                    onClick={() => setSort(current => ({ key: 'date', dir: current.key === 'date' && current.dir === 'desc' ? 'asc' : 'desc' }))}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.08em] hover:text-slate-800"
                  >
                    Date{sort.key === 'date' && <span aria-hidden="true">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
                <th className="px-2 py-1.5 font-semibold" scope="col">Type</th>
                <th className="px-2 py-1.5 font-semibold" scope="col">Asset</th>
                <th className="px-2 py-1.5 font-semibold" scope="col">Site</th>
                <th className="px-2 py-1.5 font-semibold" scope="col">Job</th>
                <th className="px-2 py-1.5 font-semibold" scope="col">Bookslip</th>
                <th className="px-2 py-1.5 font-semibold" scope="col">Vendor / Customer</th>
                <th className="px-2 py-1.5 text-right font-semibold" scope="col" aria-sort={sort.key === 'price' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button
                    type="button"
                    onClick={() => setSort(current => ({ key: 'price', dir: current.key === 'price' && current.dir === 'desc' ? 'asc' : 'desc' }))}
                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-[0.08em] hover:text-slate-800"
                  >
                    Price{sort.key === 'price' && <span aria-hidden="true">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
                  </button>
                </th>
                <th className="px-1 py-1.5" scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index} className="border-t border-slate-100">
                    <td colSpan={11} className="px-2 py-2">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              )}

              {!isLoading && sorted.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center">
                    <p className="text-[12px] font-medium text-slate-600">No movements match these filters</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {allRows.length === 0
                        ? `No records stored for ${year}.`
                        : 'Try clearing the date range or the type filter.'}
                    </p>
                    {hasFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-2 rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Clear all filters
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {!isLoading && (grouped
                ? groups.map(group => {
                    const open = !collapsed.has(group.key)
                    return (
                      <GroupBlock
                        key={group.key}
                        group={group}
                        open={open}
                        onToggle={() => toggleGroup(group.key)}
                        rows={open ? group.rows.map(renderRow) : null}
                      />
                    )
                  })
                : sorted.map(renderRow))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-3 py-1.5 text-[10.5px] text-slate-500">
          <span>
            <span className="tabular font-medium text-slate-700">{sorted.length.toLocaleString('id-ID')}</span> movements
            {hasFilters && <span> · filtered from {allRows.length.toLocaleString('id-ID')}</span>}
            {' · '}
            <span className="tabular font-medium text-slate-700">{compactIDR(sorted.reduce((total, row) => total + Number(row.price ?? 0), 0))}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            incomplete rows hidden
          </span>
        </div>
      </div>

      {pendingIds.size > 0 && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-md bg-slate-900 px-3 py-2 text-[11.5px] text-white shadow-[0_18px_40px_-12px_rgba(15,23,42,0.6)]"
        >
          <span className="tabular">{pendingIds.size} record{pendingIds.size === 1 ? '' : 's'} deleted</span>
          <button
            type="button"
            onClick={undoDelete}
            className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/25"
          >
            Undo
          </button>
        </div>
      )}

      <RecordDrawer
        open={drawer !== null}
        record={drawer?.record ?? null}
        year={year}
        sites={sites}
        jobs={jobs}
        saving={saving}
        onClose={() => setDrawer(null)}
        onSubmit={submitDrawer}
      />
    </div>
  )
}

function GroupBlock({
  group,
  open,
  onToggle,
  rows,
}: {
  group: { key: string; rows: AcqRow[]; total: number }
  open: boolean
  onToggle: () => void
  rows: ReactNode
}) {
  const label = group.key.startsWith('single-') ? 'No bookslip' : group.key
  return (
    <>
      <tr className="border-t border-slate-200 bg-slate-50/80">
        <td colSpan={11} className="px-2 py-1">
          <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-left" aria-expanded={open}>
            <Chevron open={open} />
            <span className="font-mono text-[10.5px] text-slate-600">{label}</span>
            <span className="text-[10px] text-slate-400">{group.rows.length} item{group.rows.length === 1 ? '' : 's'}</span>
            <span className="ml-auto tabular text-[10.5px] font-medium text-slate-600">{compactIDR(group.total)}</span>
          </button>
        </td>
      </tr>
      {rows}
    </>
  )
}