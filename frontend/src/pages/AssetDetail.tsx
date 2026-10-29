import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteAsset,
  fetchAcquisitions,
  fetchAsset,
  fetchAssetNeighbors,
} from '../services/assets'
import { formatDate } from '../utils/format'
import { downloadCsv, idrCell, idrCompact, idrFull, pct } from '../utils/currency'
import MonthSchedule from '../components/asset/MonthSchedule'
import MovementPanel from '../components/asset/MovementPanel'
import DeleteAssetDialog from '../components/asset/DeleteAssetDialog'
import { apiErrorMessage } from '../utils/apiError'

function Kpi({
  label,
  value,
  hint,
  title,
  progress,
  accent,
}: {
  label: string
  value: string
  hint?: string
  title?: string
  progress?: number
  accent?: boolean
}) {
  return (
    <div className="flex h-full flex-col justify-between rounded-md border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p>
        <p
          className={`tabular mt-1 text-[18px] font-semibold leading-none ${accent ? 'text-emerald-700' : 'text-slate-900'}`}
          title={title}
        >
          {value}
        </p>
        {progress != null && (
          <div className="mt-1.5 h-1 overflow-hidden rounded bg-slate-100">
            <div className="h-1 rounded bg-slate-700" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
        )}
      </div>
      {hint && <p className="mt-1.5 truncate text-[10.5px] text-slate-500">{hint}</p>}
    </div>
  )
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <dt className="shrink-0 text-[10.5px] text-slate-500">{label}</dt>
      <dd className={`truncate text-right text-[11.5px] text-slate-800 ${mono ? 'font-mono text-[11px]' : ''}`} title={value}>
        {value}
      </dd>
    </div>
  )
}

function Card({
  title,
  description,
  aside,
  children,
}: {
  title: string
  description?: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-slate-800">{title}</h2>
          {description && <p className="text-[10.5px] text-slate-500">{description}</p>}
        </div>
        {aside}
      </div>
      <dl className="px-3 py-2">{children}</dl>
    </section>
  )
}

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showAll, setShowAll] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: asset, isPending, isError } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => fetchAsset(id!),
    enabled: Boolean(id),
  })

  const { data: neighbors } = useQuery({
    queryKey: ['asset-neighbors', id],
    queryFn: () => fetchAssetNeighbors(id!),
    enabled: Boolean(asset),
    staleTime: 60_000,
  })

  const { data: movements, isPending: loadingMovements } = useQuery({
    // Matching on the number as well as the foreign key catches records whose
    // asset_id was never linked during import.
    queryKey: ['asset-movements', asset?.id, asset?.fixed_asset_number_ax, asset?.asset_no],
    queryFn: () => fetchAcquisitions({
      asset_id: asset!.id,
      asset_no: [asset!.fixed_asset_number_ax, asset!.asset_no].filter(Boolean).join(',') || undefined,
    }),
    enabled: Boolean(asset?.id),
    staleTime: 30_000,
  })

  const year = asset?.year_ref ?? 2026

  const removeMut = useMutation({
    mutationFn: () => deleteAsset(asset!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      qc.invalidateQueries({ queryKey: ['summary-totals'] })
      navigate('/assets')
    },
  })

  // [ and ] step through the register without going back to the list.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (event.key === '[' && neighbors?.previous) navigate(`/assets/${neighbors.previous}`)
      if (event.key === ']' && neighbors?.next) navigate(`/assets/${neighbors.next}`)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [neighbors, navigate])

  const months = useMemo(() => {
    if (!asset) return []
    return Array.from({ length: 12 }, (_, index) => {
      const row = asset.depreciation_monthly.find(item => item.year === year && item.month === index + 1)
      return Number(row?.amount ?? 0)
    })
  }, [asset, year])

  if (isPending) {
    return (
      <div className="flex h-[calc(100vh-9rem)] flex-col gap-2">
        <div className="h-[62px] animate-pulse rounded-md border border-slate-200 bg-white" />
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-[80px] animate-pulse rounded-md border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="h-40 animate-pulse rounded-md border border-slate-200 bg-white" />
      </div>
    )
  }

  if (isError || !asset) {
    return (
      <div className="flex h-[calc(100vh-9rem)] items-center justify-center">
        <div className="max-w-[380px] rounded-md border border-slate-200 bg-white px-5 py-6 text-center shadow-sm">
          <p className="text-[13px] font-semibold text-slate-800">Asset not found</p>
          <p className="mt-1 text-[11.5px] text-slate-500">
            The asset <span className="font-mono">{id}</span> may have been deleted or belongs to another fiscal year.
          </p>
          <Link
            to="/assets"
            className="mt-3 inline-flex h-7 items-center rounded bg-slate-800 px-3 text-[11.5px] font-semibold text-white hover:bg-slate-900"
          >
            Back to fixed assets
          </Link>
        </div>
      </div>
    )
  }

  const price = Number(asset.purchase_price ?? 0)
  const accCurr = Number(asset.acc_depreciation_curr ?? 0)
  const nbvCurr = Number(asset.net_book_value_curr ?? 0)
  const monthly = Number(asset.monthly_depreciation ?? 0)
  const periodTotal = Number(asset.depreciation_period_total ?? 0)
  const periodUntil = Number(asset.dep_period_until_year ?? 0)
  const remain = Number(asset.dep_period_remain ?? 0)
  const yearsLeft = periodTotal > 0 ? remain / 12 : 0

  const exportRow = () => {
    downloadCsv(
      `asset_${asset.fixed_asset_number_ax || asset.asset_no}_${year}.csv`,
      [
        'Asset no', 'AX no', 'Name', 'Group', 'Category', 'Site', 'Job', 'Purchase date',
        'Purchase price', 'Useful life (months)', 'Monthly depreciation',
        'Acc. depreciation', 'Net book value', 'Remaining (months)',
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ],
      [[
        asset.asset_no,
        asset.fixed_asset_number_ax,
        asset.name,
        asset.group_name,
        asset.category,
        asset.site_location,
        asset.job,
        asset.purchase_date ? String(asset.purchase_date).slice(0, 10) : null,
        price,
        periodTotal,
        monthly,
        accCurr,
        nbvCurr,
        remain,
        ...months,
      ]],
    )
  }

  const chips = [asset.group_name, asset.category, asset.site_location, asset.job].filter(
    (value): value is string => Boolean(value),
  )

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            <Link to="/assets" className="hover:text-slate-600">Fixed assets</Link>
            <span aria-hidden="true">/</span>
            <span className="font-mono text-[10px] normal-case tracking-normal text-slate-500">
              {asset.fixed_asset_number_ax || asset.asset_no}
            </span>
          </p>
          <h1 className="mt-0.5 truncate text-[19px] font-semibold leading-tight text-slate-900" title={asset.name}>
            {asset.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {chips.map(chip => (
              <span
                key={chip}
                className="inline-flex items-center rounded border border-slate-300 bg-white px-1.5 py-[1px] text-[10.5px] text-slate-600"
              >
                {chip}
              </span>
            ))}
            {asset.status_disposals && (
              <span className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1.5 py-[1px] text-[10.5px] font-medium text-rose-700">
                Disposed
              </span>
            )}
            {asset.status_additional && (
              <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-[1px] text-[10.5px] font-medium text-emerald-700">
                Additional
              </span>
            )}
            {asset.is_active === false && (
              <span
                className="inline-flex items-center rounded border border-amber-300 bg-amber-50 px-1.5 py-[1px] text-[10.5px] font-medium text-amber-800"
                title="No longer present in the latest imported workbook"
              >
                Inactive — not in latest import
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowAll(value => !value)}
              aria-pressed={showAll}
              className="text-[10.5px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              {showAll ? 'Hide optional fields' : 'Show all fields'}
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex overflow-hidden rounded border border-slate-300 bg-white">
            {neighbors?.previous ? (
              <Link
                to={`/assets/${neighbors.previous}`}
                title="Previous asset  ["
                aria-label="Previous asset"
                className="flex h-7 w-7 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
                  <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center text-slate-300">
                <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
                  <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
            <span className="my-1 w-px bg-slate-200" />
            {neighbors?.next ? (
              <Link
                to={`/assets/${neighbors.next}`}
                title="Next asset  ]"
                aria-label="Next asset"
                className="flex h-7 w-7 items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
                  <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center text-slate-300">
                <svg viewBox="0 0 12 12" aria-hidden="true" className="h-3 w-3">
                  <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={exportRow}
            className="h-7 rounded border border-slate-300 bg-white px-2.5 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Export
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="h-7 rounded border border-rose-200 bg-white px-2.5 text-[11.5px] font-medium text-rose-700 transition-colors hover:bg-rose-50"
          >
            Delete
          </button>
          <Link
            to={`/assets/${id}/edit`}
            className="inline-flex h-7 items-center rounded bg-slate-800 px-3 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-900"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto fx-scroll pr-0.5">
        <div className="grid shrink-0 grid-cols-2 gap-2 xl:grid-cols-5">
          <Kpi
            label="Purchase price"
            value={idrCompact(price)}
            hint={asset.purchase_date ? `Purchased ${formatDate(asset.purchase_date)}` : 'Purchase date missing'}
            title={idrFull(price)}
          />
          <Kpi
            label="Acc. depreciation"
            value={idrCompact(accCurr)}
            hint={`${pct(accCurr, price).toFixed(1)}% of cost`}
            title={idrFull(accCurr)}
          />
          <Kpi
            label="Net book value"
            value={idrCompact(nbvCurr)}
            hint={`31 Dec ${year}`}
            title={idrFull(nbvCurr)}
          />
          <Kpi
            label="Monthly depreciation"
            value={monthly > 0 ? idrCompact(monthly) : '—'}
            hint={periodTotal > 0 ? `${(periodTotal / 12).toFixed(1)} years of life` : 'Not depreciated'}
            title={idrFull(monthly)}
          />
          <Kpi
            label="Remaining period"
            value={periodTotal > 0 ? `${remain} mo` : '—'}
            hint={
              periodTotal > 0
                ? remain > 0
                  ? `${yearsLeft.toFixed(1)} years left`
                  : 'Fully depreciated'
                : 'Non-depreciable'
            }
            progress={periodTotal > 0 ? (periodUntil / periodTotal) * 100 : 0}
            accent
          />
        </div>

        <div className="grid gap-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <MonthSchedule year={year} values={months} monthly={monthly} />

          <section className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-3 py-2">
              <h2 className="text-[12px] font-semibold text-slate-800">Photo</h2>
              <p className="text-[10.5px] text-slate-500">Physical verification</p>
            </div>
            <div className="flex flex-1 flex-col gap-2 px-3 py-2">
              <div className="flex flex-1 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50/60 px-3 py-6 text-center">
                <div>
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto h-6 w-6 text-slate-300">
                    <path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <p className="mt-1.5 text-[10.5px] text-slate-400">No photo on file</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-slate-500">Photo status</span>
                <span
                  className={`rounded px-1.5 py-[1px] font-medium ${
                    asset.photo_status === 'Ok'
                      ? 'bg-emerald-50 text-emerald-700'
                      : asset.photo_status
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {asset.photo_status || 'Not set'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-slate-500">Condition</span>
                <span className="text-[11.5px] text-slate-800">{asset.condition || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-slate-500">Last updated</span>
                <span className="text-[11.5px] text-slate-800">
                  {asset.updated_at ? formatDate(asset.updated_at) : '—'}
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-2 xl:grid-cols-2">
          <Card title="Registration" description="Grouping used by every report">
            <Meta label="Asset group" value={asset.group_name || '—'} />
            <Meta label="Category" value={asset.category || '—'} />
            <Meta label="Site / location" value={asset.site_location || '—'} />
            <Meta label="Job" value={asset.job || '—'} />
            <Meta label="Purchase date" value={asset.purchase_date ? formatDate(asset.purchase_date) : '—'} />
            <Meta label="Fiscal year" value={String(year)} />
            {showAll && (
              <>
                <Meta label="Account no" value={asset.account_no != null ? String(asset.account_no) : '—'} />
                <Meta label="Voucher no" value={asset.voucher_no || '—'} mono />
                <Meta label="Year on document" value={asset.year != null ? String(asset.year) : '—'} />
                <Meta label="Quantity" value={asset.quantity != null ? String(asset.quantity) : '—'} />
                <Meta label="Sheet row" value={asset.no != null ? String(asset.no) : '—'} />
                <Meta label="Record id" value={String(asset.id)} />
              </>
            )}
          </Card>

          <Card title="Specification" description="Identification of the physical item">
            <Meta label="Maker / type" value={asset.maker_type_location || '—'} />
            <Meta label="Capacity / size / user" value={asset.capacity_size_user || '—'} />
            <Meta label="Police no" value={asset.police_no || '—'} mono />
            <Meta label="Machine no" value={asset.machine_no || '—'} mono />
            <Meta label="Chasis no" value={asset.chasis_no || '—'} mono />
            {showAll && <Meta label="Currency" value={asset.valas || '—'} />}
          </Card>
        </div>

        <div className="grid gap-2 xl:grid-cols-2">
          <MovementPanel
            records={movements}
            loading={loadingMovements}
            assetNo={asset.fixed_asset_number_ax || asset.asset_no}
            year={year}
          />

          <Card title="Depreciation detail" description={`Position at 31 December ${year}`}>
            <Meta label="Monthly depreciation" value={idrCell(monthly)} mono />
            <Meta label="Useful life" value={periodTotal > 0 ? `${periodTotal} months` : '—'} />
            <Meta label={`Period to 31 Dec ${year - 1}`} value={`${Number(asset.dep_period_acc_prev_year ?? 0)} mo`} />
            <Meta label={`Period in ${year}`} value={`${Number(asset.dep_period_yearly ?? 0)} mo`} />
            <Meta label="Remaining period" value={periodTotal > 0 ? `${remain} mo` : '—'} />
            <Meta label={`Acc. depreciation ${year - 1}`} value={idrCell(asset.acc_depreciation_prev)} mono />
            <Meta label={`Net book value ${year - 1}`} value={idrCell(asset.net_book_value_prev)} mono />
            <Meta label={`Depreciation expense ${year}`} value={idrCell(asset.dep_expense_current)} mono />
            <Meta label={`Acc. depreciation ${year}`} value={idrCell(accCurr)} mono />
            <Meta label={`Net book value ${year}`} value={idrCell(nbvCurr)} mono />
            <Meta label="Remark" value={asset.remark || '—'} />
          </Card>
        </div>
      </div>

      <DeleteAssetDialog
        open={confirmDelete}
        name={asset.name}
        assetNo={asset.fixed_asset_number_ax || asset.asset_no}
        deleting={removeMut.isPending}
        error={apiErrorMessage(removeMut.error)}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => removeMut.mutate()}
      />
    </div>
  )
}
