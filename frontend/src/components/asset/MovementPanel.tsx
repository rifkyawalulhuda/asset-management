import { Link } from 'react-router-dom'
import type { AcquisitionDisposal } from '../../types'
import { toRow } from '../acquisitions/acqUtils'
import TypeChip from '../acquisitions/TypeChip'
import { formatDate } from '../../utils/format'
import { idrCell } from '../../utils/currency'

export default function MovementPanel({
  records,
  loading,
  assetNo,
  year,
}: {
  records: AcquisitionDisposal[] | undefined
  loading: boolean
  assetNo: string
  year: number
}) {
  const rows = (records ?? []).map(toRow)
  const openHref = `/acquisitions?${new URLSearchParams({ year: String(year), asset: assetNo }).toString()}`

  return (
    <section className="flex min-w-0 flex-col rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-[12px] font-semibold text-slate-800">Movement history</h2>
          <p className="text-[10.5px] text-slate-500">Acquisitions, disposals and transfers linked to this asset</p>
        </div>
        <Link
          to={openHref}
          title={`Open ${assetNo} in Acquisitions`}
          className="shrink-0 text-[10.5px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          Open
        </Link>
      </div>

      <div className="flex-1 px-3 py-2">
        {loading && (
          <div className="space-y-1.5">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-6 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <p className="py-2 text-[10.5px] text-slate-400">
            No movement recorded for this asset.
          </p>
        )}

        {!loading && rows.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {rows.map(row => (
              <li key={row.id} className="flex items-center justify-between gap-2 py-[5px]">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <TypeChip type={row.type} />
                    <span className="tabular text-[10.5px] text-slate-500">{formatDate(row.transaction_date)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[10.5px] text-slate-500" title={row.vendor_customer ?? undefined}>
                    {row.bookslip_no || row.application || '—'}
                    {row.vendor_customer ? ` · ${row.vendor_customer}` : ''}
                  </p>
                </div>
                <span className="tabular shrink-0 text-[11px] font-medium text-slate-800">
                  {idrCell(row.price)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
