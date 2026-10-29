import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { fetchAssets, deleteAsset, fetchJobs, fetchSiteLocations } from '../services/assets'
import { formatDate } from '../utils/format'
import ColumnFilter from '../components/table/ColumnFilter'
import ColumnsPanel from '../components/table/ColumnsPanel'
import ViewsMenu from '../components/table/ViewsMenu'
import {
  CELL_TONE,
  COL_BY_KEY,
  COLUMNS,
  DEFAULT_WIDTH,
  HEAD_BLOCKS,
  HEAD_TONE,
  ROW3_SPANNED,
  blockLabel,
  headText,
} from '../components/table/columns'
import type { HeadBlock } from '../components/table/columns'
import { DEFAULT_PREFS, loadPrefs, loadViews, savePrefs, saveViews, widthOf } from '../components/table/gridPrefs'
import type { Density, GridPrefs, SavedView } from '../components/table/gridPrefs'
import { buildDelimited, copyText, downloadCsv } from '../components/table/tableExport'
import { getValue, isFilterActive, matchesFilter, monthAmount, monthTotal, uniqueValues } from '../components/table/filterUtils'
import type { FilterValue } from '../components/table/filterUtils'
import type { AssetFilters, FixedAsset } from '../types'

/* ── Metrics ────────────────────────────────────────────────────────────────── */

const SELECT_W = 34
const ROW1_H = 48
const ROW2_H = 58
const ROW3_H = 28
const HEADER_H = ROW1_H + ROW2_H + ROW3_H
const MIN_W = 40
const MAX_W = 600

const ROW_PAD: Record<Density, string> = {
  compact: 'py-[3px] text-[11.5px]',
  comfortable: 'py-[6px] text-[12px]',
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null
type Pane = 'frozen' | 'main'
type GroupBlock = Extract<HeadBlock, { kind: 'group' }>

/* ── Formatting ─────────────────────────────────────────────────────────────── */

const NUM = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

const money = (value: number | string | null | undefined) => {
  if (value == null) return '-'
  const num = Number(value)
  if (!num) return '-'
  return NUM.format(Math.round(num))
}

const plain = (value: number | string | null | undefined) => {
  if (value == null || value === '') return ''
  const num = Number(value)
  return Number.isNaN(num) ? String(value) : NUM.format(Math.round(num))
}

function describeFilter(filter: FilterValue): string {
  if (filter.kind === 'values') {
    const parts: string[] = []
    if (filter.text.trim()) parts.push(`"${filter.text.trim()}"`)
    if (filter.values.length) parts.push(`${filter.values.length} dipilih`)
    return parts.join(' · ')
  }
  if (filter.kind === 'range') {
    if (filter.min && filter.max) return `${filter.min} – ${filter.max}`
    if (filter.min) return `≥ ${filter.min}`
    return `≤ ${filter.max}`
  }
  if (filter.from && filter.to) return `${filter.from} → ${filter.to}`
  if (filter.from) return `≥ ${filter.from}`
  return `≤ ${filter.to}`
}

/* ── Icons ──────────────────────────────────────────────────────────────────── */

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5">
      <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10.6 10.6 3.2 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function SortGlyph({ state }: { state: 'none' | 'asc' | 'desc' }) {
  return (
    <svg viewBox="0 0 8 12" aria-hidden="true" className="h-[9px] w-[6px] shrink-0">
      <path d="M4 .6 7.4 5H.6L4 .6Z" fill="currentColor" opacity={state === 'asc' ? 1 : 0.28} />
      <path d="M4 11.4.6 7h6.8L4 11.4Z" fill="currentColor" opacity={state === 'desc' ? 1 : 0.28} />
    </svg>
  )
}

/* ── Header cells ───────────────────────────────────────────────────────────── */

function ResizeHandle({
  colKey,
  width,
  getColEl,
  onCommit,
}: {
  colKey: string
  width: number
  getColEl: (key: string) => HTMLTableColElement | null
  onCommit: (key: string, width: number) => void
}) {
  const origin = useRef({ x: 0, width: 0, tableWidth: 0 })

  const handlePointerDown = (event: ReactPointerEvent<HTMLSpanElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const colEl = getColEl(colKey)
    const table = colEl?.closest('table')
    if (!colEl || !table) return

    origin.current = { x: event.clientX, width, tableWidth: table.getBoundingClientRect().width }
    const clamp = (delta: number) => Math.min(MAX_W, Math.max(MIN_W, Math.round(origin.current.width + delta)))

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (moveEvent: PointerEvent) => {
      const next = clamp(moveEvent.clientX - origin.current.x)
      colEl.style.width = `${next}px`
      table.style.width = `${origin.current.tableWidth + (next - origin.current.width)}px`
    }
    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      onCommit(colKey, clamp(upEvent.clientX - origin.current.x))
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <span
      role="separator"
      aria-hidden="true"
      onPointerDown={handlePointerDown}
      onDoubleClick={() => onCommit(colKey, DEFAULT_WIDTH[colKey] ?? width)}
      className="fx-resizer"
    >
      <span className="fx-resizer-line" />
    </span>
  )
}

type LeafHeadProps = {
  colKey: string
  rowSpan: number
  stickyTop: number
  year: number
  sort: SortState
  onSort: (key: string) => void
  filter?: FilterValue
  options: string[]
  onFilter: (key: string, value: FilterValue | undefined) => void
  width: number
  resizable: boolean
  getColEl: (key: string) => HTMLTableColElement | null
  onResize: (key: string, width: number) => void
}

function LeafHead({
  colKey,
  rowSpan,
  stickyTop,
  year,
  sort,
  onSort,
  filter,
  options,
  onFilter,
  width,
  resizable,
  getColEl,
  onResize,
}: LeafHeadProps) {
  const def = COL_BY_KEY[colKey]
  const direction = sort?.key === colKey ? sort.dir : 'none'
  const ariaSort = direction === 'none' ? 'none' : direction === 'asc' ? 'ascending' : 'descending'
  const label = headText(colKey, year)

  return (
    <th
      scope="col"
      rowSpan={rowSpan}
      aria-sort={ariaSort}
      title={label.replace(/\n/g, ' ')}
      style={{ top: stickyTop, height: rowSpan === 3 ? HEADER_H : rowSpan === 2 ? ROW1_H + ROW2_H : ROW2_H }}
      className={`sticky z-20 border-b border-r border-white/15 px-1 py-1 align-middle text-center text-white ${HEAD_TONE[def.tone]}`}
    >
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className="mx-auto inline-flex max-w-full items-center justify-center gap-1 rounded-sm px-1 py-0.5 text-[10.5px] font-semibold leading-[1.2] tracking-[0.01em] transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        <span className="whitespace-pre-line">{label}</span>
        <SortGlyph state={direction} />
      </button>

      {def.filter && (
        <ColumnFilter
          label={def.label}
          kind={def.filter}
          options={options}
          value={filter}
          onChange={next => onFilter(colKey, next)}
          searchOnly={def.searchOnly}
        />
      )}

      {resizable && <ResizeHandle colKey={colKey} width={width} getColEl={getColEl} onCommit={onResize} />}
    </th>
  )
}

function GroupHead({ block, year, colSpan }: { block: GroupBlock; year: number; colSpan: number }) {
  return (
    <th
      scope="colgroup"
      colSpan={colSpan}
      style={{ top: 0, height: ROW1_H }}
      className={`sticky z-20 border-b border-r border-white/15 px-1 py-1 text-center align-middle text-[10.5px] font-semibold leading-[1.2] tracking-[0.01em] text-white ${HEAD_TONE[block.tone]}`}
    >
      <span className="whitespace-pre-line">{blockLabel(block, year)}</span>
    </th>
  )
}

function FormulaCell({ col, width }: { col: string; width: number }) {
  const chip = COL_BY_KEY[col]?.formula
  return (
    <td
      style={{ top: ROW1_H + ROW2_H, height: ROW3_H, width }}
      className="sticky z-20 border-b border-r border-slate-200 bg-slate-50 px-1 py-[2px] text-center leading-none"
    >
      {chip && (
        <span className="inline-block rounded-sm bg-white/85 px-1 py-px font-mono text-[9px] font-medium leading-[1.35] tracking-tight text-slate-600 ring-1 ring-inset ring-slate-200">
          {chip}
        </span>
      )}
    </td>
  )
}

/* ── Body cells ─────────────────────────────────────────────────────────────── */

function cellContent(
  asset: FixedAsset,
  col: string,
  year: number,
  monthly: Map<number, number>,
  onDelete: (asset: FixedAsset) => void,
): ReactNode {
  const def = COL_BY_KEY[col]
  if (!def) return null

  if (def.format === 'month') {
    const amount = monthly.get(Number(col.slice(2)))
    return amount && amount > 0 ? money(amount) : <span className="text-slate-300">–</span>
  }

  if (def.format === 'actions') {
    return (
      <div className="flex items-center justify-center gap-1">
        <Link
          to={`/assets/${asset.fixed_asset_number_ax || asset.id}/edit`}
          className="rounded px-1 text-[11px] font-medium text-blue-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={() => onDelete(asset)}
          className="rounded px-1 text-[11px] font-medium text-red-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          Del
        </button>
      </div>
    )
  }

  if (def.format === 'check') {
    const value = (asset as unknown as Record<string, unknown>)[col]
    if (!value) return null
    return (
      <span className={`font-semibold ${col === 'status_disposals' ? 'text-red-600' : 'text-green-700'}`}>
        ✓
      </span>
    )
  }

  if (def.format === 'photo') {
    return (
      <span className={asset.photo_status === 'Ok' ? 'font-semibold text-green-700' : 'font-medium text-red-600'}>
        {asset.photo_status}
      </span>
    )
  }

  if (def.format === 'category') {
    return asset.category ? (
      <span className="inline-block rounded bg-slate-200/80 px-1 text-[10.5px] font-semibold text-slate-700">
        {asset.category}
      </span>
    ) : null
  }

  if (def.format === 'name') {
    return (
      <Link
        to={`/assets/${asset.fixed_asset_number_ax || asset.id}`}
        title={asset.name}
        className="font-medium text-blue-800 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {asset.name}
      </Link>
    )
  }

  if (def.format === 'asset_no') return <span className="font-mono text-[11px]">{asset.asset_no}</span>
  if (def.format === 'ax') {
    return <span className="font-mono text-[11px] font-semibold text-blue-800">{asset.fixed_asset_number_ax}</span>
  }
  if (def.format === 'date') return formatDate(asset.purchase_date)

  const value = getValue(asset, col, year)
  if (def.format === 'money') return money(value as number | null)
  if (def.format === 'int') return plain(value as number | null)

  const text = value == null ? '' : String(value)
  return text.length > 14 ? <span title={text}>{text}</span> : text
}

const BodyRow = memo(function BodyRow({
  asset,
  cols,
  year,
  density,
  selected,
  hasSelect,
  onToggle,
  onDelete,
}: {
  asset: FixedAsset
  cols: string[]
  year: number
  density: Density
  selected: boolean
  hasSelect: boolean
  onToggle: (id: number) => void
  onDelete: (asset: FixedAsset) => void
}) {
  const monthly = useMemo(() => {
    const map = new Map<number, number>()
    for (const row of asset.depreciation_monthly) {
      if (row.year === year) map.set(row.month, Number(row.amount ?? 0))
    }
    return map
  }, [asset, year])

  return (
    <tr className="fx-row">
      {hasSelect && (
        <td
          className={`w-[34px] overflow-hidden border-b border-r border-slate-200 px-1 text-center leading-[1.35] ${ROW_PAD[density]} ${selected ? 'bg-blue-100' : 'bg-[#eef4fa]'}`}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(asset.id)}
            aria-label={`Select asset ${asset.name}`}
            className="h-3.5 w-3.5 rounded border-slate-300 align-middle accent-blue-700"
          />
        </td>
      )}
      {cols.map(col => {
        const def = COL_BY_KEY[col]
        return (
          <td
            key={col}
            className={`overflow-hidden text-ellipsis whitespace-nowrap border-b border-r border-slate-200 px-1.5 leading-[1.35] ${ROW_PAD[density]} ${
              def.align === 'right' ? 'text-right tabular' : def.align === 'center' ? 'text-center' : 'text-left'
            } ${CELL_TONE[def.tone]}`}
          >
            {cellContent(asset, col, year, monthly, onDelete)}
          </td>
        )
      })}
    </tr>
  )
})

/* ── Total row ──────────────────────────────────────────────────────────────── */

function totalValue(col: string, rows: FixedAsset[], year: number): string {
  const def = COL_BY_KEY[col]
  if (!def) return ''
  if (col === 'no' || col === 'year') return ''
  if (def.format === 'check') {
    const count = rows.filter(asset => (asset as unknown as Record<string, unknown>)[col]).length
    return count ? String(count) : ''
  }
  if (def.format === 'month') {
    const index = Number(col.slice(2))
    const sum = rows.reduce((total, asset) => total + (monthAmount(asset, year, index) ?? 0), 0)
    return sum ? money(sum) : '-'
  }
  if (def.format === 'money' || def.format === 'int') {
    if (col === 'monthly_total') {
      const sum = rows.reduce((total, asset) => total + monthTotal(asset, year), 0)
      return sum ? money(sum) : '-'
    }
    const sum = rows.reduce((total, asset) => total + (Number(getValue(asset, col, year)) || 0), 0)
    return def.format === 'money' ? money(sum) : plain(sum)
  }
  return ''
}

function TotalRow({
  cols,
  rows,
  year,
  labelCol,
  hasSelect,
}: {
  cols: string[]
  rows: FixedAsset[]
  year: number
  labelCol: string | null
  hasSelect: boolean
}) {
  return (
    <tr>
      {hasSelect && (
        <td className="w-[34px] border-b border-r border-slate-200 bg-[#dbe4ee] px-1" />
      )}
      {cols.map(col => {
        const def = COL_BY_KEY[col]
        const align = def.align === 'right' ? 'text-right tabular' : def.align === 'center' ? 'text-center' : 'text-left'
        return (
          <td
            key={col}
            className={`border-b border-r border-slate-200 bg-slate-100 px-1.5 py-1 text-[11px] font-semibold leading-[1.35] ${align}`}
          >
            {col === labelCol ? 'TOTAL' : totalValue(col, rows, year)}
          </td>
        )
      })}
    </tr>
  )
}

/* ── Pane ───────────────────────────────────────────────────────────────────── */

type PaneProps = {
  pane: Pane
  cols: string[]
  year: number
  rows: FixedAsset[]
  density: Density
  loading: boolean
  sort: SortState
  onSort: (key: string) => void
  columnFilters: Record<string, FilterValue>
  onFilter: (key: string, value: FilterValue | undefined) => void
  optionsByColumn: Record<string, string[]>
  prefs: GridPrefs
  onResize: (key: string, width: number) => void
  getColEl: (key: string) => HTMLTableColElement | null
  registerCol: (pane: Pane, key: string, el: HTMLTableColElement | null) => void
  selected: Set<number>
  onToggleRow: (id: number) => void
  onToggleAll: () => void
  allSelected: boolean
  someSelected: boolean
  onDelete: (asset: FixedAsset) => void
  labelCol: string | null
  showTotal: boolean
}

function Pane({
  pane,
  cols,
  year,
  rows,
  density,
  loading,
  sort,
  onSort,
  columnFilters,
  onFilter,
  optionsByColumn,
  prefs,
  onResize,
  getColEl,
  registerCol,
  selected,
  onToggleRow,
  onToggleAll,
  allSelected,
  someSelected,
  onDelete,
  labelCol,
  showTotal,
}: PaneProps) {
  const present = new Set(cols)
  const hasSelect = pane === 'frozen'
  const widthOfCol = (key: string) => widthOf(prefs, key)
  const tableWidth = (hasSelect ? SELECT_W : 0) + cols.reduce((sum, key) => sum + widthOfCol(key), 0)

  const headRow1: ReactNode[] = []
  const headRow2: ReactNode[] = []
  for (const block of HEAD_BLOCKS) {
    if (block.kind === 'group') {
      const subs = block.cols.filter(key => present.has(key))
      if (subs.length === 0) continue
      headRow1.push(<GroupHead key={block.key} block={block} year={year} colSpan={subs.length} />)
      for (const key of subs) {
        headRow2.push(
          <LeafHead
            key={key}
            colKey={key}
            rowSpan={1}
            stickyTop={ROW1_H}
            year={year}
            sort={sort}
            onSort={onSort}
            filter={columnFilters[key]}
            options={optionsByColumn[key] ?? []}
            onFilter={onFilter}
            width={widthOfCol(key)}
            resizable
            getColEl={getColEl}
            onResize={onResize}
          />,
        )
      }
      continue
    }

    if (!present.has(block.col)) continue
    headRow1.push(
      <LeafHead
        key={block.col}
        colKey={block.col}
        rowSpan={block.kind === 'span3' ? 3 : 2}
        stickyTop={0}
        year={year}
        sort={sort}
        onSort={onSort}
        filter={columnFilters[block.col]}
        options={optionsByColumn[block.col] ?? []}
        onFilter={onFilter}
        width={widthOfCol(block.col)}
        resizable
        getColEl={getColEl}
        onResize={onResize}
      />,
    )
  }

  return (
    <table className="table-fixed border-separate border-spacing-0" style={{ width: tableWidth }}>
      <colgroup>
        {hasSelect && <col style={{ width: SELECT_W }} />}
        {cols.map(key => (
          <col
            key={key}
            ref={el => registerCol(pane, key, el)}
            style={{ width: widthOfCol(key) }}
          />
        ))}
      </colgroup>

      <thead>
        <tr>
          {hasSelect && (
            <th
              scope="col"
              style={{ top: 0, height: ROW1_H }}
              className="sticky z-20 w-[34px] border-b border-r border-slate-300 bg-[#eef4fa] px-1 text-center align-middle"
            >
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => {
                  if (el) el.indeterminate = !allSelected && someSelected
                }}
                onChange={onToggleAll}
                aria-label="Select all rows"
                className="h-3.5 w-3.5 rounded border-slate-300 align-middle accent-blue-700"
              />
            </th>
          )}
          {headRow1}
        </tr>
        <tr>
          {hasSelect && (
            <th
              scope="col"
              style={{ top: ROW1_H, height: ROW2_H }}
              className="sticky z-20 w-[34px] border-b border-r border-slate-300 bg-[#eef4fa]"
            />
          )}
          {headRow2}
        </tr>
        <tr>
          {hasSelect && (
            <td
              style={{ top: ROW1_H + ROW2_H, height: ROW3_H }}
              className="sticky z-20 w-[34px] border-b border-r border-slate-300 bg-[#eef4fa]"
            />
          )}
          {cols
            .filter(key => !ROW3_SPANNED.includes(key))
            .map(key => (
              <FormulaCell key={key} col={key} width={widthOfCol(key)} />
            ))}
        </tr>
      </thead>

      <tbody>
        {loading &&
          Array.from({ length: 8 }).map((_, index) => (
            <tr key={`skeleton-${index}`} className="animate-pulse">
              {hasSelect && (
                <td className="w-[34px] border-b border-r border-slate-200 bg-[#eef4fa] px-1 py-2" />
              )}
              {cols.length > 0 && (
                <td colSpan={cols.length} className="border-b border-slate-100 px-3 py-2">
                  <div className="h-3 rounded bg-slate-100" style={{ width: `${55 + (index % 4) * 9}%` }} />
                </td>
              )}
            </tr>
          ))}

        {!loading &&
          rows.map(asset => (
            <BodyRow
              key={asset.id}
              asset={asset}
              cols={cols}
              year={year}
              density={density}
              selected={selected.has(asset.id)}
              hasSelect={hasSelect}
              onToggle={onToggleRow}
              onDelete={onDelete}
            />
          ))}
      </tbody>

      {showTotal && rows.length > 0 && (
        <tfoot>
          <TotalRow cols={cols} rows={rows} year={year} labelCol={labelCol} hasSelect={hasSelect} />
        </tfoot>
      )}
    </table>
  )
}

/* ── Page ───────────────────────────────────────────────────────────────────── */

export default function AssetList() {
  const qc = useQueryClient()
  const colRefs = useRef<Record<string, { pane: Pane; el: HTMLTableColElement }>>({})

  const [filters, setFilters] = useState<AssetFilters>({ year_ref: 2026, page: 1, size: 100 })
  const [search, setSearch] = useState('')
  const [sortConfig, setSortConfig] = useState<SortState>(null)
  const [depFilter, setDepFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [columnFilters, setColumnFilters] = useState<Record<string, FilterValue>>({})
  const [prefs, setPrefs] = useState<GridPrefs>(() => loadPrefs())
  const [views, setViews] = useState<SavedView[]>(() => loadViews())
  const [selected, setSelected] = useState<Set<number>>(() => new Set())

  const year = filters.year_ref ?? 2026

  useEffect(() => {
    savePrefs(prefs)
  }, [prefs])

  const { data, isLoading } = useQuery({
    queryKey: ['assets', filters],
    queryFn: () => fetchAssets(filters),
  })

  const { data: siteOptions } = useQuery({
    queryKey: ['site-options', year],
    queryFn: () => fetchSiteLocations(year),
    staleTime: 300000,
  })

  const { data: jobOptions } = useQuery({
    queryKey: ['job-options', year],
    queryFn: () => fetchJobs(undefined, year),
    staleTime: 300000,
  })

  const deleteMut = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })

  const deleteRef = useRef(deleteMut.mutate)
  deleteRef.current = deleteMut.mutate

  const items = useMemo(() => data?.items ?? [], [data])
  const total = data?.total ?? 0
  const size = filters.size ?? 100

  useEffect(() => {
    setSelected(new Set())
  }, [items])

  /* Site & Job filter the whole dataset through the API. */
  const serverParams = useMemo(() => {
    const pick = (key: string) => {
      const filter = columnFilters[key]
      if (!filter || filter.kind !== 'values' || filter.values.length === 0) return undefined
      return [...filter.values].sort().join(',')
    }
    return { site_location: pick('site_location'), job: pick('job') }
  }, [columnFilters])

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(current => {
        if (current.site_location === serverParams.site_location && current.job === serverParams.job) {
          return current
        }
        return { ...current, site_location: serverParams.site_location, job: serverParams.job, page: 1 }
      })
    }, 250)
    return () => clearTimeout(timer)
  }, [serverParams])

  const optionsByColumn = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const col of COLUMNS) {
      if (col.filter !== 'text') continue
      if (col.key === 'site_location') {
        map[col.key] = (siteOptions ?? []).map(option => option.site_location).sort((a, b) => a.localeCompare(b))
      } else if (col.key === 'job') {
        map[col.key] = (jobOptions ?? []).map(option => option.job).sort((a, b) => a.localeCompare(b))
      } else {
        map[col.key] = uniqueValues(items, col.key, year)
      }
    }
    return map
  }, [items, year, siteOptions, jobOptions])

  const rows = useMemo(() => {
    let list = items

    if (depFilter === 'active') list = list.filter(asset => (asset.dep_period_remain ?? 0) > 0)
    else if (depFilter === 'completed') list = list.filter(asset => (asset.dep_period_remain ?? 0) <= 0)

    const active = Object.entries(columnFilters).filter(([, filter]) => isFilterActive(filter))
    if (active.length > 0) {
      list = list.filter(asset =>
        active.every(([key, filter]) => matchesFilter(getValue(asset, key, year), filter)),
      )
    }

    if (!sortConfig) return list

    const { key, dir } = sortConfig
    const factor = dir === 'asc' ? 1 : -1
    return [...list].sort((a, b) => {
      const aValue = getValue(a, key, year)
      const bValue = getValue(b, key, year)
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1
      if (typeof aValue === 'number' && typeof bValue === 'number') return (aValue - bValue) * factor
      return String(aValue).localeCompare(String(bValue), undefined, { numeric: true }) * factor
    })
  }, [items, depFilter, columnFilters, sortConfig, year])

  const hiddenSet = useMemo(() => new Set(prefs.hidden), [prefs.hidden])
  const frozenSet = useMemo(() => new Set(prefs.frozen), [prefs.frozen])

  const frozenCols = useMemo(
    () => COLUMNS.filter(col => !hiddenSet.has(col.key) && frozenSet.has(col.key)).map(col => col.key),
    [hiddenSet, frozenSet],
  )
  const mainCols = useMemo(
    () => COLUMNS.filter(col => !hiddenSet.has(col.key) && !frozenSet.has(col.key)).map(col => col.key),
    [hiddenSet, frozenSet],
  )
  const displayCols = useMemo(() => [...frozenCols, ...mainCols], [frozenCols, mainCols])

  const activeFilters = Object.entries(columnFilters).filter(([, filter]) => isFilterActive(filter))
  const activeCount = activeFilters.length
  const pageCount = Math.max(1, Math.ceil(total / size))
  const selectedRows = useMemo(() => rows.filter(asset => selected.has(asset.id)), [rows, selected])
  const allSelected = rows.length > 0 && selectedRows.length === rows.length

  const handleSearch = () => setFilters(current => ({ ...current, search, page: 1 }))

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }
      if (prev.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  const setColumnFilter = (key: string, value: FilterValue | undefined) => {
    setColumnFilters(prev => {
      const next = { ...prev }
      if (!value || !isFilterActive(value)) delete next[key]
      else next[key] = value
      return next
    })
  }

  const clearAllFilters = () => {
    setColumnFilters({})
    setDepFilter('all')
    setSearch('')
    setFilters(current => ({ ...current, search: undefined, page: 1 }))
  }

  const toggleHidden = (key: string) => {
    setPrefs(prev => {
      const hidden = prev.hidden.includes(key)
        ? prev.hidden.filter(candidate => candidate !== key)
        : [...prev.hidden, key]
      if (COLUMNS.length - hidden.length < 1) return prev
      return { ...prev, hidden, frozen: prev.frozen.filter(candidate => !hidden.includes(candidate)) }
    })
  }

  const toggleFrozen = (key: string) => {
    setPrefs(prev => ({
      ...prev,
      frozen: prev.frozen.includes(key)
        ? prev.frozen.filter(candidate => candidate !== key)
        : [...prev.frozen, key],
    }))
  }

  const resizeColumn = useCallback((key: string, nextWidth: number) => {
    setPrefs(prev => ({ ...prev, widths: { ...prev.widths, [key]: nextWidth } }))
  }, [])

  const getColEl = useCallback((key: string) => colRefs.current[key]?.el ?? null, [])

  const registerCol = useCallback((pane: Pane, key: string, el: HTMLTableColElement | null) => {
    if (el) {
      colRefs.current[key] = { pane, el }
      return
    }
    if (colRefs.current[key]?.pane === pane) delete colRefs.current[key]
  }, [])

  const toggleRow = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = () => {
    setSelected(prev => (prev.size === rows.length && rows.length > 0 ? new Set() : new Set(rows.map(asset => asset.id))))
  }

  const handleDelete = useCallback((asset: FixedAsset) => {
    if (confirm(`Delete ${asset.name}?`)) deleteRef.current(asset.id)
  }, [])

  const applyView = (view: SavedView) => {
    setPrefs(view.prefs)
    setColumnFilters(view.columnFilters as Record<string, FilterValue>)
    setDepFilter(view.depFilter)
  }

  const saveView = (name: string) => {
    const next = [
      ...views.filter(view => view.name !== name),
      { name, prefs, columnFilters, depFilter, savedAt: new Date().toISOString() },
    ]
    setViews(next)
    saveViews(next)
  }

  const deleteView = (name: string) => {
    const next = views.filter(view => view.name !== name)
    setViews(next)
    saveViews(next)
  }

  const copySelection = async () => {
    const text = buildDelimited(selectedRows, displayCols, year, '\t')
    const ok = await copyText(text)
    if (!ok) alert('Gagal menyalin ke clipboard. Coba lagi atau gunakan Export CSV.')
  }

  const labelCol = frozenCols[0] ?? mainCols[0] ?? null

  return (
    <div className="flex h-full flex-col">
      {/* Title */}
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Fixed Asset Register
          </p>
          <h1 className="mt-0.5 truncate text-[19px] font-semibold leading-tight text-slate-900">
            List of Fixed Assets and Depreciation Schedule
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-slate-500">
            <span>PT. Sankyu Indonesia International</span>
            <span className="text-slate-300">·</span>
            <span className="tabular font-medium text-slate-700">{rows.length.toLocaleString('id-ID')}</span>
            <span>
              {activeCount > 0 || depFilter !== 'all'
                ? `dari ${items.length.toLocaleString('id-ID')} baris dimuat`
                : `dari ${total.toLocaleString('id-ID')} aset`}
            </span>
            <span className="text-slate-300">·</span>
            <span>Year {year}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            to="/summary"
            className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Export
          </Link>
          <Link
            to="/assets/new"
            className="rounded bg-slate-800 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-900"
          >
            + Add Asset
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            type="text"
            aria-label="Search name or asset number"
            placeholder="Search name / asset no…"
            value={search}
            onChange={event => setSearch(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && handleSearch()}
            className="h-7 w-52 rounded border border-slate-300 pl-7 pr-2 text-[11.5px] text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          className="h-7 rounded bg-slate-800 px-2.5 text-[11.5px] font-medium text-white transition-colors hover:bg-slate-900"
        >
          Search
        </button>

        <span className="mx-1 h-5 w-px bg-slate-200" />

        <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
          Year
          <select
            value={year}
            onChange={event => setFilters(current => ({ ...current, year_ref: Number(event.target.value), page: 1 }))}
            className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[11.5px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
          Rows
          <select
            value={size}
            onChange={event => setFilters(current => ({ ...current, size: Number(event.target.value), page: 1 }))}
            className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[11.5px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={350}>350</option>
          </select>
        </label>

        <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
          Depreciation
          <select
            value={depFilter}
            onChange={event => setDepFilter(event.target.value as 'all' | 'active' | 'completed')}
            className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[11.5px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">All</option>
            <option value="active">Active (remain &gt; 0)</option>
            <option value="completed">Completed (remain = 0)</option>
          </select>
        </label>

        {(activeCount > 0 || depFilter !== 'all' || search) && (
          <button
            type="button"
            onClick={clearAllFilters}
            className="h-7 rounded px-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            Clear all
          </button>
        )}

        <span className="mx-1 h-5 w-px bg-slate-200" />

        <ColumnsPanel
          hidden={hiddenSet}
          frozen={frozenSet}
          onToggleHidden={toggleHidden}
          onToggleFrozen={toggleFrozen}
          onShowAll={() => setPrefs(prev => ({ ...prev, hidden: [] }))}
          onReset={() => setPrefs(DEFAULT_PREFS)}
        />

        <ViewsMenu
          views={views}
          onApply={applyView}
          onSave={saveView}
          onDelete={deleteView}
          onReset={() => setPrefs(DEFAULT_PREFS)}
        />

        <div className="inline-flex h-7 overflow-hidden rounded border border-slate-300">
          {(['compact', 'comfortable'] as Density[]).map(density => (
            <button
              key={density}
              type="button"
              onClick={() => setPrefs(prev => ({ ...prev, density }))}
              aria-pressed={prefs.density === density}
              className={`px-2 text-[10.5px] font-medium transition-colors ${
                prefs.density === density
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {density === 'compact' ? 'Compact' : 'Comfort'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => downloadCsv(rows, displayCols, year, `assets_${year}_${new Date().toISOString().slice(0, 10)}.csv`)}
          className="h-7 rounded border border-slate-300 bg-white px-2 text-[10.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
          title="Export CSV dari kolom yang terlihat"
        >
          CSV
        </button>

        {selectedRows.length > 0 && (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={copySelection}
              className="h-7 rounded bg-blue-800 px-2 text-[10.5px] font-semibold text-white transition-colors hover:bg-blue-900"
              title="Copy baris terpilih sebagai TSV (tempel ke Excel)"
            >
              Copy {selectedRows.length}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="h-7 rounded px-1.5 text-[10.5px] font-medium text-slate-500 hover:bg-slate-100"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Active filters */}
      {activeCount > 0 && (
        <div className="mb-2 rounded-md border border-blue-200 bg-blue-50/60 px-2 py-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-800">
              {activeCount} filter
            </span>
            {activeFilters.map(([key, filter]) => (
              <span
                key={key}
                className="inline-flex max-w-[280px] items-center gap-1 rounded-full border border-blue-200 bg-white py-0.5 pl-2 pr-1 text-[10.5px] text-slate-700"
              >
                <span className="shrink-0 font-semibold text-slate-800">{COL_BY_KEY[key]?.label ?? key}</span>
                <span className="truncate text-slate-500">· {describeFilter(filter)}</span>
                <button
                  type="button"
                  onClick={() => setColumnFilter(key, undefined)}
                  aria-label={`Remove filter on ${COL_BY_KEY[key]?.label ?? key}`}
                  className="ml-0.5 shrink-0 rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                >
                  <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2.5 w-2.5">
                    <path d="m2 2 6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setColumnFilters({})}
              className="rounded px-1.5 py-0.5 text-[10.5px] font-medium text-blue-800 underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          </div>

          {total > items.length && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1 text-[10.5px] text-amber-800">
              <span>Filter kolom menyaring</span>
              <span className="tabular font-semibold">{items.length}</span>
              <span>baris yang dimuat; Site &amp; Job menyaring seluruh data.</span>
              {size < 350 && (
                <button
                  type="button"
                  onClick={() => setFilters(current => ({ ...current, size: 350, page: 1 }))}
                  className="font-semibold text-blue-800 underline underline-offset-2 hover:text-blue-900"
                >
                  Muat 350 baris
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {/* Grid */}
      <div className="relative">
        <div
          className="fx-scroll overflow-auto rounded-md border border-slate-300 bg-white shadow-sm"
          style={{ maxHeight: 'calc(100vh - 268px)' }}
        >
          <div className="flex w-max items-start">
            <div className="fx-frozen sticky left-0 z-30 shrink-0 bg-white">
              <Pane
                pane="frozen"
                cols={frozenCols}
                year={year}
                rows={rows}
                density={prefs.density}
                loading={isLoading}
                sort={sortConfig}
                onSort={handleSort}
                columnFilters={columnFilters}
                onFilter={setColumnFilter}
                optionsByColumn={optionsByColumn}
                prefs={prefs}
                onResize={resizeColumn}
                getColEl={getColEl}
                registerCol={registerCol}
                selected={selected}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                allSelected={allSelected}
                someSelected={selected.size > 0}
                onDelete={handleDelete}
                labelCol={labelCol}
                showTotal
              />
            </div>

            {mainCols.length > 0 && (
              <div className="shrink-0">
                <Pane
                  pane="main"
                  cols={mainCols}
                  year={year}
                  rows={rows}
                  density={prefs.density}
                  loading={isLoading}
                  sort={sortConfig}
                  onSort={handleSort}
                  columnFilters={columnFilters}
                  onFilter={setColumnFilter}
                  optionsByColumn={optionsByColumn}
                  prefs={prefs}
                  onResize={resizeColumn}
                  getColEl={getColEl}
                  registerCol={registerCol}
                  selected={selected}
                  onToggleRow={toggleRow}
                  onToggleAll={toggleAll}
                  allSelected={allSelected}
                  someSelected={selected.size > 0}
                  onDelete={handleDelete}
                  labelCol={labelCol}
                  showTotal
                />
              </div>
            )}
          </div>
        </div>

        {!isLoading && rows.length === 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-white/90"
            style={{ top: HEADER_H + 2 }}
          >
            <div className="pointer-events-auto px-4 py-10 text-center">
              <p className="text-[13px] font-semibold text-slate-700">Tidak ada aset yang cocok</p>
              <p className="mx-auto mt-1 max-w-md text-[11.5px] leading-relaxed text-slate-500">
                Filter yang aktif tidak menghasilkan baris. Longgarkan filter, atau muat lebih banyak baris
                untuk mencari di seluruh register.
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded border border-slate-300 bg-white px-3 py-1.5 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Hapus semua filter
                </button>
                {size < 350 && (
                  <button
                    type="button"
                    onClick={() => setFilters(current => ({ ...current, size: 350, page: 1 }))}
                    className="rounded bg-slate-800 px-3 py-1.5 text-[11.5px] font-semibold text-white hover:bg-slate-900"
                  >
                    Muat 350 baris
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > size && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <button
            type="button"
            disabled={(filters.page ?? 1) <= 1}
            onClick={() => setFilters(current => ({ ...current, page: Math.max(1, (current.page ?? 1) - 1) }))}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="px-2 text-[11px] text-slate-600 tabular">
            Page {filters.page ?? 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={(filters.page ?? 1) >= pageCount}
            onClick={() => setFilters(current => ({ ...current, page: (current.page ?? 1) + 1 }))}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      <p className="mt-1.5 text-center text-[10px] text-slate-400">
        {frozenCols.length} kolom dibekukan · {displayCols.length} dari {COLUMNS.length} kolom tampil ·
        site &amp; job difilter di server
      </p>
    </div>
  )
}