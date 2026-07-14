import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import {
  fetchSummaryMonthly,
  fetchSummaryByGroup,
  fetchSummaryTotals,
  fetchSiteLocations,
} from '../services/assets'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// Color palette for multi-job bars
const JOB_COLORS = [
  '#1d4ed8', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#65a30d', '#c2410c', '#9333ea', '#0284c7',
  '#16a34a', '#ca8a04', '#b91c1c', '#6d28d9', '#0369a1',
]

function idr(v: number | null | undefined) {
  if (v == null) return 'Rp 0'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(v)))
}

function idrShort(v: number) {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  return new Intl.NumberFormat('id-ID').format(Math.round(v))
}

export default function Dashboard() {
  const [year, setYear] = useState(2026)
  const [site, setSite] = useState<string | undefined>(undefined)

  // Fetch site locations
  const { data: siteLocations } = useQuery({
    queryKey: ['site-locations', year],
    queryFn: () => fetchSiteLocations(year),
    staleTime: 60000,
  })

  // Fetch summary data
  const { data: totals, isLoading: loadingTotals } = useQuery({
    queryKey: ['summary-totals', year, site],
    queryFn: () => fetchSummaryTotals(year, site),
  })

  const { data: monthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ['summary-monthly', year, site],
    queryFn: () => fetchSummaryMonthly(year, site),
  })

  const { data: byGroup } = useQuery({
    queryKey: ['summary-group', year, site],
    queryFn: () => fetchSummaryByGroup(year, site),
  })

  // Build chart data: one entry per month, one key per job
  const jobs = monthly ? Object.keys(monthly).sort() : []

  const chartData = MONTHS.map((name, i) => {
    const entry: Record<string, number | string> = { name }
    let total = 0
    jobs.forEach(job => {
      const jobData = monthly![job]
      const v = (jobData as Record<string, number>)[MONTH_KEYS[i]] || 0
      entry[job] = v
      total += v
    })
    entry['_total'] = total
    return entry
  })

  const grandYearlyTotal = chartData.reduce((s, d) => s + (d._total as number), 0)

  // Monthly detail table: rows=jobs, cols=months
  const monthlyTableRows = jobs.map(job => {
    const row = monthly![job]
    const months = MONTH_KEYS.map(k => (row[k as keyof typeof row] as number) || 0)
    const total = months.reduce((s, v) => s + v, 0)
    return { job, months, total }
  })
  const monthlyGrandRow = {
    months: MONTH_KEYS.map((_, mi) => monthlyTableRows.reduce((s, r) => s + r.months[mi], 0)),
    total: monthlyTableRows.reduce((s, r) => s + r.total, 0),
  }

  return (
    <div className="space-y-5">
      {/* Header + Filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-xs">PT. Sankyu Indonesia International — Depreciation Report</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="text-xs text-gray-500">Year:</label>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm font-medium"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>

          <label className="text-xs text-gray-500 ml-2">Site/Location:</label>
          <select
            value={site || ''}
            onChange={e => setSite(e.target.value || undefined)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">All Sites</option>
            {siteLocations?.map(s => (
              <option key={s.site_location} value={s.site_location}>
                {s.site_location} ({s.count})
              </option>
            ))}
          </select>

          {site && (
            <button
              onClick={() => setSite(undefined)}
              className="text-xs text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-50"
            >
              Clear Filter ✕
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="Total Assets"
          value={totals ? `${totals.total_assets} assets` : '-'}
          sub={site ? `Site: ${site}` : 'All Sites'}
          color="slate"
          loading={loadingTotals}
        />
        <StatCard
          label="Purchase Price"
          value={totals ? idr(totals.total_purchase_price) : '-'}
          color="gray"
          loading={loadingTotals}
        />
        <StatCard
          label="Acc. Depreciation"
          value={totals ? idr(totals.total_acc_depreciation) : '-'}
          color="orange"
          loading={loadingTotals}
        />
        <StatCard
          label="Net Book Value"
          value={totals ? idr(totals.total_net_book_value) : '-'}
          color="green"
          loading={loadingTotals}
        />
        <StatCard
          label={`Yearly Depr. ${year}`}
          value={totals ? idr(totals.total_yearly_depreciation) : '-'}
          color="blue"
          loading={loadingTotals}
        />
      </div>

      {/* Bar Chart Monthly */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-base">Monthly Depreciation {year}</h2>
            <p className="text-xs text-gray-400">
              Grand Total: <span className="font-semibold text-blue-700">{idr(grandYearlyTotal)}</span>
              {site && <span className="ml-2 text-orange-500">· Filtered: {site}</span>}
            </p>
          </div>
        </div>
        {loadingMonthly ? (
          <div className="h-64 flex items-center justify-center text-gray-400">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={idrShort} tick={{ fontSize: 10 }} width={70} />
              <Tooltip
                formatter={(v: number, name: string) => [idr(v), name]}
                labelFormatter={l => `Month: ${l}`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {jobs.map((job, i) => (
                <Bar
                  key={job}
                  dataKey={job}
                  stackId="a"
                  fill={JOB_COLORS[i % JOB_COLORS.length]}
                  name={job}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly Detail Table */}
      <div className="bg-white rounded-lg border p-4 overflow-x-auto">
        <h2 className="font-semibold text-base mb-3">
          Monthly Depreciation Detail — {year}
          {site && <span className="ml-2 text-sm font-normal text-orange-500">(Site: {site})</span>}
        </h2>
        {loadingMonthly ? (
          <div className="text-gray-400 text-sm py-4">Loading...</div>
        ) : (
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="bg-[#1e3a8a] text-white">
                <th className="px-3 py-2 text-left sticky left-0 bg-[#1e3a8a] min-w-[100px]">Job / Category</th>
                {MONTHS.map(m => (
                  <th key={m} className="px-2 py-2 text-right min-w-[90px]">{m}</th>
                ))}
                <th className="px-3 py-2 text-right min-w-[110px] bg-[#1e40af]">Total / Year</th>
              </tr>
            </thead>
            <tbody>
              {monthlyTableRows.map((row, idx) => (
                <tr key={row.job} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                  <td className="px-3 py-1.5 font-medium sticky left-0 bg-inherit border-r">{row.job || '-'}</td>
                  {row.months.map((v, mi) => (
                    <td key={mi} className="px-2 py-1.5 text-right">
                      {v > 0 ? idr(v) : <span className="text-gray-300">-</span>}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-bold text-blue-700 bg-blue-50">
                    {idr(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#1e3a5f] text-white font-bold">
                <td className="px-3 py-2 sticky left-0 bg-[#1e3a5f]">GRAND TOTAL</td>
                {monthlyGrandRow.months.map((v, mi) => (
                  <td key={mi} className="px-2 py-2 text-right">{v > 0 ? idr(v) : '-'}</td>
                ))}
                <td className="px-3 py-2 text-right bg-[#1e40af]">{idr(monthlyGrandRow.total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* By Group Table */}
      {byGroup && Object.keys(byGroup).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold text-base mb-3">
            Summary by Asset Group — {year}
            {site && <span className="ml-2 text-sm font-normal text-orange-500">(Site: {site})</span>}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#374151] text-white text-xs">
                <th className="px-3 py-2 text-left">Group</th>
                <th className="px-3 py-2 text-right">Assets</th>
                <th className="px-3 py-2 text-right">Purchase Price</th>
                <th className="px-3 py-2 text-right">Acc. Depreciation</th>
                <th className="px-3 py-2 text-right">Net Book Value</th>
                <th className="px-3 py-2 text-right bg-[#1e3a8a]">Yearly Depreciation</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byGroup).map(([group, d], idx) => (
                <tr key={group} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-medium">{group}</td>
                  <td className="px-3 py-2 text-right">{d.count}</td>
                  <td className="px-3 py-2 text-right">{idr(d.purchase_price)}</td>
                  <td className="px-3 py-2 text-right">{idr(d.acc_depreciation)}</td>
                  <td className="px-3 py-2 text-right">{idr(d.net_book_value)}</td>
                  <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50">{idr(d.yearly_depreciation)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold text-sm border-t-2 border-gray-300">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-right">
                  {Object.values(byGroup).reduce((s, d) => s + d.count, 0)}
                </td>
                <td className="px-3 py-2 text-right">
                  {idr(Object.values(byGroup).reduce((s, d) => s + d.purchase_price, 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {idr(Object.values(byGroup).reduce((s, d) => s + d.acc_depreciation, 0))}
                </td>
                <td className="px-3 py-2 text-right">
                  {idr(Object.values(byGroup).reduce((s, d) => s + d.net_book_value, 0))}
                </td>
                <td className="px-3 py-2 text-right bg-blue-100">
                  {idr(Object.values(byGroup).reduce((s, d) => s + d.yearly_depreciation, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({
  label, value, sub, color, loading
}: {
  label: string
  value: string
  sub?: string
  color: 'blue' | 'green' | 'orange' | 'gray' | 'slate'
  loading?: boolean
}) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    green:  'bg-green-50 border-green-200 text-green-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    gray:   'bg-gray-50 border-gray-200 text-gray-800',
    slate:  'bg-slate-50 border-slate-200 text-slate-800',
  }
  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      {loading ? (
        <div className="h-6 bg-gray-200 animate-pulse rounded w-3/4"></div>
      ) : (
        <div className="font-bold text-sm leading-tight">{value}</div>
      )}
      {sub && <div className="text-[10px] text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}
