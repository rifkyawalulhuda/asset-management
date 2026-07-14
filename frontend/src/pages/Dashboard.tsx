import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchSummaryMonthly,
  fetchSummaryByGroup,
  fetchSummaryTotals,
  fetchSiteLocations,
  fetchSummaryByCategory,
} from '../services/assets'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

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
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return String(Math.round(v))
}

export default function Dashboard() {
  const [year, setYear] = useState(2026)
  const [site, setSite] = useState<string | undefined>(undefined)

  const { data: siteLocations } = useQuery({
    queryKey: ['site-locations', year],
    queryFn: () => fetchSiteLocations(year),
    staleTime: 60000,
  })

  const { data: totals, isLoading: loadingTotals } = useQuery({
    queryKey: ['summary-totals', year, site],
    queryFn: () => fetchSummaryTotals(year, site),
    retry: 1,
  })

  const { data: monthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ['summary-monthly', year, site],
    queryFn: () => fetchSummaryMonthly(year, site),
    retry: 1,
  })

  const { data: byGroup } = useQuery({
    queryKey: ['summary-group', year, site],
    queryFn: () => fetchSummaryByGroup(year, site),
    retry: 1,
  })

  const { data: byCategory } = useQuery({
    queryKey: ['summary-category', year, site],
    queryFn: () => fetchSummaryByCategory(year, site),
    retry: 1,
  })

  const jobs = monthly ? Object.keys(monthly).sort() : []

  // Monthly totals per month (sum of all jobs)
  const monthlyTotals = MONTH_KEYS.map(k =>
    jobs.reduce((s, job) => s + ((monthly![job] as Record<string, number>)[k] || 0), 0)
  )
  const maxMonthlyTotal = Math.max(...monthlyTotals, 1)
  const grandYearlyTotal = monthlyTotals.reduce((s, v) => s + v, 0)

  // Monthly detail table rows
  const monthlyTableRows = jobs.map(job => {
    const row = monthly![job] as Record<string, number>
    const months = MONTH_KEYS.map(k => row[k] || 0)
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
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded px-2 py-1 text-sm font-medium">
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
          <label className="text-xs text-gray-500 ml-2">Site/Location:</label>
          <select value={site || ''} onChange={e => setSite(e.target.value || undefined)} className="border rounded px-2 py-1 text-sm">
            <option value="">All Sites</option>
            {siteLocations?.map(s => (
              <option key={s.site_location} value={s.site_location}>{s.site_location} ({s.count})</option>
            ))}
          </select>
          {site && (
            <button onClick={() => setSite(undefined)} className="text-xs text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-50">
              Clear ✕
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Assets" value={totals ? `${totals.total_assets} assets` : '-'} sub={site || 'All Sites'} color="slate" loading={loadingTotals} />
        <StatCard label="Purchase Price" value={totals ? idr(totals.total_purchase_price) : '-'} color="gray" loading={loadingTotals} />
        <StatCard label="Acc. Depreciation" value={totals ? idr(totals.total_acc_depreciation) : '-'} color="orange" loading={loadingTotals} />
        <StatCard label="Net Book Value" value={totals ? idr(totals.total_net_book_value) : '-'} color="green" loading={loadingTotals} />
        <StatCard label={`Yearly Depr. ${year}`} value={totals ? idr(totals.total_yearly_depreciation) : '-'} color="blue" loading={loadingTotals} />
      </div>

      {/* SVG Bar Chart */}
      <div className="bg-white rounded-lg border p-4">
        <div className="mb-3">
          <h2 className="font-semibold text-base">Monthly Depreciation {year}</h2>
          <p className="text-xs text-gray-400">
            Grand Total: <span className="font-semibold text-blue-700">{idr(grandYearlyTotal)}</span>
            {site && <span className="ml-2 text-orange-500">· {site}</span>}
          </p>
        </div>

        {loadingMonthly ? (
          <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
        ) : jobs.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <SvgBarChart
            months={MONTHS}
            monthKeys={MONTH_KEYS}
            jobs={jobs}
            monthly={monthly!}
            maxTotal={maxMonthlyTotal}
          />
        )}

        {/* Legend */}
        {!loadingMonthly && jobs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 border-t pt-3">
            {jobs.slice(0, 15).map((job, i) => (
              <div key={job} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: JOB_COLORS[i % JOB_COLORS.length] }} />
                <span className="text-[11px] text-gray-600">{job}</span>
              </div>
            ))}
          </div>
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
                {MONTHS.map(m => <th key={m} className="px-2 py-2 text-right min-w-[90px]">{m}</th>)}
                <th className="px-3 py-2 text-right min-w-[110px] bg-[#1e40af]">Total/Year</th>
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
                  <td className="px-3 py-1.5 text-right font-bold text-blue-700 bg-blue-50">{idr(row.total)}</td>
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
                <td className="px-3 py-2 text-right">{Object.values(byGroup).reduce((s, d) => s + d.count, 0)}</td>
                <td className="px-3 py-2 text-right">{idr(Object.values(byGroup).reduce((s, d) => s + d.purchase_price, 0))}</td>
                <td className="px-3 py-2 text-right">{idr(Object.values(byGroup).reduce((s, d) => s + d.acc_depreciation, 0))}</td>
                <td className="px-3 py-2 text-right">{idr(Object.values(byGroup).reduce((s, d) => s + d.net_book_value, 0))}</td>
                <td className="px-3 py-2 text-right bg-blue-100">{idr(Object.values(byGroup).reduce((s, d) => s + d.yearly_depreciation, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Summary by Category */}
      {byCategory && Object.keys(byCategory).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold text-base mb-3">
            Summary by Category — {year}
            {site && <span className="ml-2 text-sm font-normal text-orange-500">(Site: {site})</span>}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0f4c81] text-white text-xs">
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-right">Assets</th>
                <th className="px-3 py-2 text-right">Purchase Price</th>
                <th className="px-3 py-2 text-right">Acc. Depreciation</th>
                <th className="px-3 py-2 text-right">Net Book Value</th>
                <th className="px-3 py-2 text-right bg-[#1e3a8a]">Yearly Depreciation</th>
                <th className="px-3 py-2 text-right bg-[#1e3a8a]">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const totalYearly = Object.values(byCategory as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number}>)
                  .reduce((s, d) => s + d.yearly_depreciation, 0)
                return Object.entries(byCategory as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number}>)
                  .map(([cat, d], idx) => {
                    const pct = totalYearly > 0 ? (d.yearly_depreciation / totalYearly * 100) : 0
                    return (
                      <tr key={cat} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                        <td className="px-3 py-2 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                            {cat}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">{d.count}</td>
                        <td className="px-3 py-2 text-right">{idr(d.purchase_price)}</td>
                        <td className="px-3 py-2 text-right">{idr(d.acc_depreciation)}</td>
                        <td className="px-3 py-2 text-right">{idr(d.net_book_value)}</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50">{idr(d.yearly_depreciation)}</td>
                        <td className="px-3 py-2 text-right bg-blue-50">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-1.5 rounded-full bg-blue-500"
                                style={{ width: `${pct.toFixed(1)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              })()}
            </tbody>
            <tfoot>
              {(() => {
                const cats = byCategory as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number}>
                return (
                  <tr className="bg-gray-100 font-bold text-sm border-t-2 border-gray-300">
                    <td className="px-3 py-2">TOTAL</td>
                    <td className="px-3 py-2 text-right">{Object.values(cats).reduce((s, d) => s + d.count, 0)}</td>
                    <td className="px-3 py-2 text-right">{idr(Object.values(cats).reduce((s, d) => s + d.purchase_price, 0))}</td>
                    <td className="px-3 py-2 text-right">{idr(Object.values(cats).reduce((s, d) => s + d.acc_depreciation, 0))}</td>
                    <td className="px-3 py-2 text-right">{idr(Object.values(cats).reduce((s, d) => s + d.net_book_value, 0))}</td>
                    <td className="px-3 py-2 text-right bg-blue-100">{idr(Object.values(cats).reduce((s, d) => s + d.yearly_depreciation, 0))}</td>
                    <td className="px-3 py-2 text-right bg-blue-100">100%</td>
                  </tr>
                )
              })()}
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub, color, loading }: {
  label: string; value: string; sub?: string; color: 'blue' | 'green' | 'orange' | 'gray' | 'slate'; loading?: boolean
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
      {loading ? <div className="h-5 bg-gray-200 animate-pulse rounded w-3/4" /> : <div className="font-bold text-sm leading-tight">{value}</div>}
      {sub && <div className="text-[10px] text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

// SVG Stacked Bar Chart — deterministic, fully reactive to data changes
function SvgBarChart({
  months,
  monthKeys,
  jobs,
  monthly,
  maxTotal,
}: {
  months: string[]
  monthKeys: string[]
  jobs: string[]
  monthly: Record<string, Record<string, number>>
  maxTotal: number
}) {
  const W = 800
  const H = 240
  const PAD_L = 72
  const PAD_R = 16
  const PAD_T = 24
  const PAD_B = 28
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B
  const groupW = chartW / months.length
  const barW = Math.max(groupW * 0.65, 18)
  const barOffset = (groupW - barW) / 2

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: 'block', height: 240 }}
    >
      {/* Background */}
      <rect x={PAD_L} y={PAD_T} width={chartW} height={chartH} fill="#f8fafc" rx={4} />

      {/* Y-axis gridlines + labels */}
      {yTicks.map((t, i) => {
        const y = PAD_T + chartH * (1 - t)
        const val = maxTotal * t
        return (
          <g key={i}>
            <line
              x1={PAD_L} y1={y}
              x2={PAD_L + chartW} y2={y}
              stroke={t === 0 ? '#cbd5e1' : '#e2e8f0'}
              strokeWidth={t === 0 ? 1.5 : 1}
              strokeDasharray={t === 0 ? 'none' : '4 3'}
            />
            <text
              x={PAD_L - 8} y={y + 4}
              textAnchor="end"
              fontSize={9}
              fill="#94a3b8"
              fontFamily="system-ui, sans-serif"
            >
              {idrShort(val)}
            </text>
          </g>
        )
      })}

      {/* Stacked bars per month */}
      {months.map((month, mi) => {
        const monthKey = monthKeys[mi]
        const x = PAD_L + mi * groupW + barOffset
        const baseY = PAD_T + chartH

        // Build segments from bottom to top
        let stackedH = 0
        const total = jobs.reduce((s, job) => s + ((monthly[job]?.[monthKey]) || 0), 0)

        const segments = jobs.map((job, ji) => {
          const val = (monthly[job]?.[monthKey]) || 0
          const segH = maxTotal > 0 ? (val / maxTotal) * chartH : 0
          return { job, val, segH, color: JOB_COLORS[ji % JOB_COLORS.length] }
        }).filter(s => s.segH > 0.5) // skip segments too small to show

        return (
          <g key={`${month}-${mi}`}>
            {/* Render segments bottom-to-top */}
            {segments.map(seg => {
              const y = baseY - stackedH - seg.segH
              stackedH += seg.segH
              return (
                <rect
                  key={seg.job}
                  x={x}
                  y={y}
                  width={barW}
                  height={seg.segH}
                  fill={seg.color}
                  opacity={0.88}
                >
                  <title>{month} · {seg.job}: {idr(seg.val)}</title>
                </rect>
              )
            })}

            {/* Rounded top cap on last segment */}
            {stackedH > 4 && (
              <rect
                x={x}
                y={baseY - stackedH}
                width={barW}
                height={Math.min(4, stackedH)}
                fill={segments[segments.length - 1]?.color || '#1d4ed8'}
                rx={3}
                opacity={0.88}
              />
            )}

            {/* Total label above bar */}
            {stackedH > 14 && (
              <text
                x={x + barW / 2}
                y={baseY - stackedH - 4}
                textAnchor="middle"
                fontSize={8}
                fill="#475569"
                fontFamily="system-ui, sans-serif"
              >
                {idrShort(total)}
              </text>
            )}

            {/* X-axis month label */}
            <text
              x={x + barW / 2}
              y={PAD_T + chartH + 18}
              textAnchor="middle"
              fontSize={11}
              fill="#64748b"
              fontWeight="600"
              fontFamily="system-ui, sans-serif"
            >
              {month}
            </text>
          </g>
        )
      })}

      {/* Left axis border */}
      <line
        x1={PAD_L} y1={PAD_T}
        x2={PAD_L} y2={PAD_T + chartH}
        stroke="#cbd5e1"
        strokeWidth={1.5}
      />
    </svg>
  )
}