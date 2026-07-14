import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchAsset } from '../services/assets'
import { formatIDR, formatDate, formatNumber } from '../utils/format'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => fetchAsset(id!),
    enabled: !!id,
  })

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading...</div>
  if (!asset) return <div className="text-center py-12 text-gray-400">Asset not found</div>

  const monthly2026 = asset.depreciation_monthly
    .filter(d => d.year === (asset.year_ref || 2026))
    .sort((a, b) => a.month - b.month)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">← Back</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{asset.name}</h1>
          <div className="text-sm text-gray-500">{asset.asset_no} {asset.fixed_asset_number_ax && `· ${asset.fixed_asset_number_ax}`}</div>
        </div>
        <Link to={`/assets/${id}/edit`} className="bg-blue-700 text-white px-4 py-2 rounded text-sm">Edit</Link>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <InfoCard title="Asset Information">
          <Row label="Group" value={asset.group_name} />
          <Row label="Category" value={asset.category} />
          <Row label="Site/Location" value={asset.site_location} />
          <Row label="Job" value={asset.job} />
          <Row label="Account No" value={asset.account_no?.toString()} />
          <Row label="Voucher No" value={asset.voucher_no} />
          <Row label="Purchase Date" value={formatDate(asset.purchase_date)} />
          <Row label="Year" value={asset.year?.toString()} />
          <Row label="Quantity" value={asset.quantity?.toString()} />
          <Row label="Maker/Type" value={asset.maker_type_location} />
          <Row label="Capacity/User" value={asset.capacity_size_user} />
          <Row label="Police No" value={asset.police_no} />
          <Row label="Machine No" value={asset.machine_no} />
          <Row label="Chasis No" value={asset.chasis_no} />
        </InfoCard>

        <InfoCard title="Depreciation Summary">
          <Row label="Purchase Price" value={formatIDR(asset.purchase_price)} bold />
          <Row label="Monthly Depreciation" value={formatIDR(asset.monthly_depreciation)} />
          <Row label="Depreciation Period" value={asset.depreciation_period_total ? `${asset.depreciation_period_total} months` : '-'} />
          <Row label="Acc. Period (prev yr)" value={formatNumber(asset.dep_period_acc_prev_year)} />
          <Row label="Period Yearly 2026" value={formatNumber(asset.dep_period_yearly)} />
          <Row label="Period Until 2026" value={formatNumber(asset.dep_period_until_year)} />
          <Row label="Remaining Period" value={formatNumber(asset.dep_period_remain)} />
          <div className="mt-2 border-t pt-2">
            <Row label="Acc. Depr. (31 Dec 2025)" value={formatIDR(asset.acc_depreciation_prev)} />
            <Row label="NBV (31 Dec 2025)" value={formatIDR(asset.net_book_value_prev)} />
            <Row label="Depr. Expense 2026" value={formatIDR(asset.dep_expense_current)} />
            <Row label="Acc. Depr. (31 Dec 2026)" value={formatIDR(asset.acc_depreciation_curr)} />
            <Row label="NBV (31 Dec 2026)" value={formatIDR(asset.net_book_value_curr)} bold />
          </div>
          <div className="mt-2 border-t pt-2">
            <Row label="Photo Status" value={asset.photo_status} />
            <Row label="Condition" value={asset.condition} />
            <Row label="Remark" value={asset.remark} />
          </div>
        </InfoCard>
      </div>

      {/* Monthly Depreciation Schedule */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold mb-3">Depreciation Schedule {asset.year_ref}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {MONTHS.map(m => <th key={m} className="px-3 py-2 text-right font-semibold">{m}</th>)}
                <th className="px-3 py-2 text-right font-semibold bg-blue-50">Total/Year</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {MONTHS.map((_, i) => {
                  const row = monthly2026.find(d => d.month === i + 1)
                  return <td key={i} className="px-3 py-2 text-right text-xs">{formatIDR(row?.amount ?? 0)}</td>
                })}
                <td className="px-3 py-2 text-right text-xs font-bold bg-blue-50">
                  {formatIDR(monthly2026.reduce((s, d) => s + Number(d.amount || 0), 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <h2 className="font-semibold mb-3 text-gray-700 border-b pb-2">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value?: string | null; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm py-0.5">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-right ml-2 ${bold ? 'font-semibold' : ''}`}>{value || '-'}</span>
    </div>
  )
}
