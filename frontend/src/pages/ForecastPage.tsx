import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchForecastTotals,
  fetchForecastMonthly,
  fetchForecastByGroup,
  fetchForecastByCategory,
  fetchForecastAssets,
  fetchSiteLocations,
} from '../services/assets'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const FORECAST_YEARS = [2027, 2028, 2029, 2030]

export default function ForecastPage() {
  const [year, setYear] = useState(2027)
  const [site, setSite] = useState<string | undefined>(undefined)
  const [groupView, setGroupView] = useState<'summary' | 'monthly'>('summary')
  const [categoryView, setCategoryView] = useState<'summary' | 'monthly'>('summary')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(100)

  const { data: siteLocations } = useQuery({
    queryKey: ['site-locations', 2026],
    queryFn: () => fetchSiteLocations(2026),
    staleTime: 60000,
  })

  const { data: totals, isLoading: loadingTotals } = useQuery({
    queryKey: ['forecast-totals', year, site],
    queryFn: () => fetchForecastTotals(year, site),
    retry: 1,
  })

  const { data: monthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ['forecast-monthly', year, site],
    queryFn: () => fetchForecastMonthly(year, site, 'job'),
    retry: 1,
  })

  const { data: byGroup } = useQuery({
    queryKey: ['forecast-group', year, site],
    queryFn: () => fetchForecastByGroup(year, site),
    retry: 1,
  })

  const { data: byCategory } = useQuery({
    queryKey: ['forecast-category', year, site],
    queryFn: () => fetchForecastByCategory(year, site),
    retry: 1,
  })

  const { data: groupMonthly, isLoading: loadingGroupMonthly } = useQuery({
    queryKey: ['forecast-monthly-group', year, site],
    queryFn: () => fetchForecastMonthly(year, site, 'group_name'),
    enabled: groupView === 'monthly',
    retry: 1,
  })

  const { data: categoryMonthly, isLoading: loadingCategoryMonthly } = useQuery({
    queryKey: ['forecast-monthly-category', year, site],
    queryFn: () => fetchForecastMonthly(year, site, 'category'),
    enabled: categoryView === 'monthly',
    retry: 1,
  })

  const { data: assets } = useQuery({
    queryKey: ['forecast-assets', year, site, search, page, size],
    queryFn: () => fetchForecastAssets(year, { site_location: site, search, page, size }),
    retry: 1,
  })

  const jobs = monthly ? Object.keys(monthly).sort() : []

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

  const groupMonthlyRows = useMemo(() => {
    if (!groupMonthly) return []
    return Object.keys(groupMonthly).sort().map(grp => {
      const row = groupMonthly[grp] as Record<string, number>
      const months = MONTH_KEYS.map(k => row[k] || 0)
      const total = months.reduce((s, v) => s + v, 0)
      return { grp, months, total }
    })
  }, [groupMonthly])
  const groupMonthlyGrand = useMemo(() => ({
    months: MONTH_KEYS.map((_, mi) => groupMonthlyRows.reduce((s, r) => s + r.months[mi], 0)),
    total: groupMonthlyRows.reduce((s, r) => s + r.total, 0),
  }), [groupMonthlyRows])

  const categoryMonthlyRows = useMemo(() => {
    if (!categoryMonthly) return []
    return Object.keys(categoryMonthly).sort().map(cat => {
      const row = categoryMonthly[cat] as Record<string, number>
      const months = MONTH_KEYS.map(k => row[k] || 0)
      const total = months.reduce((s, v) => s + v, 0)
      return { cat, months, total }
    })
  }, [categoryMonthly])
  const categoryMonthlyGrand = useMemo(() => ({
    months: MONTH_KEYS.map((_, mi) => categoryMonthlyRows.reduce((s, r) => s + r.months[mi], 0)),
    total: categoryMonthlyRows.reduce((s, r) => s + r.total, 0),
  }), [categoryMonthlyRows])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">Depreciation Forecast</h1>
          <p className="text-gray-500 text-xs">PT. Sankyu Indonesia International — Projected Depreciation</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <label className="text-xs text-gray-500">Forecast Year:</label>
          <select value={year} onChange={e => { setYear(Number(e.target.value)); setPage(1) }} className="border rounded px-2 py-1 text-sm font-medium">
            {FORECAST_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <label className="text-xs text-gray-500 ml-2">Site/Location:</label>
          <select value={site || ''} onChange={e => { setSite(e.target.value || undefined); setPage(1) }} className="border rounded px-2 py-1 text-sm">
            <option value="">All Sites</option>
            {siteLocations?.map(s => (
              <option key={s.site_location} value={s.site_location}>{s.site_location} ({s.count})</option>
            ))}
          </select>
          {site && (
            <button onClick={() => setSite(undefined)} className="text-xs text-red-500 border border-red-200 rounded px-2 py-1 hover:bg-red-50">Clear ✕</button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Assets" value={totals ? `${totals.total_assets} assets` : '-'} sub={site || 'All Sites'} color="slate" loading={loadingTotals} />
        <StatCard label="Purchase Price" value={totals ? idr(totals.total_purchase_price) : '-'} color="gray" loading={loadingTotals} />
        <StatCard label="Acc. Depreciation" value={totals ? idr(totals.total_acc_depreciation) : '-'} color="orange" loading={loadingTotals} />
        <StatCard label="NBV Projected" value={totals ? idr(totals.total_net_book_value) : '-'} color="green" loading={loadingTotals} />
        <StatCard label={`Yearly Depr. ${year}`} value={totals ? idr(totals.total_yearly_depreciation) : '-'} color="blue" loading={loadingTotals} />
      </div>

      {/* Monthly Forecast Table */}
      <div className="bg-white rounded-lg border p-4 overflow-x-auto">
        <h2 className="font-semibold text-base mb-3">
          Monthly Forecast — {year}
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
                    <td key={mi} className="px-2 py-1.5 text-right">{v > 0 ? idr(v) : <span className="text-gray-300">-</span>}</td>
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

      {/* By Asset Group */}
      {byGroup && Object.keys(byGroup).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base">
              By Asset Group — {year}
              {site && <span className="ml-2 text-sm font-normal text-orange-500">(Site: {site})</span>}
            </h2>
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs font-medium">
              <button onClick={() => setGroupView('summary')} className={`px-3 py-1.5 transition-colors ${groupView === 'summary' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Summary</button>
              <button onClick={() => setGroupView('monthly')} className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${groupView === 'monthly' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Monthly</button>
            </div>
          </div>
          {groupView === 'summary' && (
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
                {Object.entries(byGroup as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number}>).map(([group, d], idx) => (
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
                {(() => {
                  const vals = Object.values(byGroup as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number}>)
                  return (
                    <tr className="bg-gray-100 font-bold text-sm border-t-2 border-gray-300">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right">{vals.reduce((s, d) => s + d.count, 0)}</td>
                      <td className="px-3 py-2 text-right">{idr(vals.reduce((s, d) => s + d.purchase_price, 0))}</td>
                      <td className="px-3 py-2 text-right">{idr(vals.reduce((s, d) => s + d.acc_depreciation, 0))}</td>
                      <td className="px-3 py-2 text-right">{idr(vals.reduce((s, d) => s + d.net_book_value, 0))}</td>
                      <td className="px-3 py-2 text-right bg-blue-100">{idr(vals.reduce((s, d) => s + d.yearly_depreciation, 0))}</td>
                    </tr>
                  )
                })()}
              </tfoot>
            </table>
          )}
          {groupView === 'monthly' && (
            <div className="overflow-x-auto">
              {loadingGroupMonthly ? (
                <div className="text-gray-400 text-sm py-4">Loading...</div>
              ) : (
                <table className="w-full text-xs min-w-[900px]">
                  <thead>
                    <tr className="bg-[#374151] text-white">
                      <th className="px-3 py-2 text-left sticky left-0 bg-[#374151] min-w-[160px]">Group</th>
                      {MONTHS.map(m => <th key={m} className="px-2 py-2 text-right min-w-[90px]">{m}</th>)}
                      <th className="px-3 py-2 text-right min-w-[110px] bg-[#1e3a8a]">Total/Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupMonthlyRows.map((r, idx) => (
                      <tr key={r.grp} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-2 font-medium sticky left-0 bg-inherit">{r.grp}</td>
                        {r.months.map((v, mi) => (
                          <td key={mi} className="px-2 py-2 text-right tabular-nums">{v > 0 ? idr(v) : <span className="text-gray-300">—</span>}</td>
                        ))}
                        <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50 tabular-nums">{idr(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-xs border-t-2 border-gray-300">
                      <td className="px-3 py-2 sticky left-0 bg-gray-100">GRAND TOTAL</td>
                      {groupMonthlyGrand.months.map((v, mi) => <td key={mi} className="px-2 py-2 text-right tabular-nums">{idr(v)}</td>)}
                      <td className="px-3 py-2 text-right bg-blue-100 tabular-nums">{idr(groupMonthlyGrand.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* By Category */}
      {byCategory && Object.keys(byCategory).length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-base">
              By Category — {year}
              {site && <span className="ml-2 text-sm font-normal text-orange-500">(Site: {site})</span>}
            </h2>
            <div className="flex rounded-md border border-gray-200 overflow-hidden text-xs font-medium">
              <button onClick={() => setCategoryView('summary')} className={`px-3 py-1.5 transition-colors ${categoryView === 'summary' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Summary</button>
              <button onClick={() => setCategoryView('monthly')} className={`px-3 py-1.5 border-l border-gray-200 transition-colors ${categoryView === 'monthly' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Monthly</button>
            </div>
          </div>
          {categoryView === 'summary' && (
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
                  const entries = Object.entries(byCategory as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number}>)
                  const totalYearly = entries.reduce((s, [, d]) => s + d.yearly_depreciation, 0)
                  return entries.map(([cat, d], idx) => {
                    const pct = totalYearly > 0 ? (d.yearly_depreciation / totalYearly * 100) : 0
                    return (
                      <tr key={cat} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                        <td className="px-3 py-2 font-medium"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />{cat}</span></td>
                        <td className="px-3 py-2 text-right">{d.count}</td>
                        <td className="px-3 py-2 text-right">{idr(d.purchase_price)}</td>
                        <td className="px-3 py-2 text-right">{idr(d.acc_depreciation)}</td>
                        <td className="px-3 py-2 text-right">{idr(d.net_book_value)}</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50">{idr(d.yearly_depreciation)}</td>
                        <td className="px-3 py-2 text-right bg-blue-50">
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(pct, 100)}%` }} />
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
          )}
          {categoryView === 'monthly' && (
            <div className="overflow-x-auto">
              {loadingCategoryMonthly ? (
                <div className="text-gray-400 text-sm py-4">Loading...</div>
              ) : (
                <table className="w-full text-xs min-w-[900px]">
                  <thead>
                    <tr className="bg-[#0f4c81] text-white">
                      <th className="px-3 py-2 text-left sticky left-0 bg-[#0f4c81] min-w-[100px]">Category</th>
                      {MONTHS.map(m => <th key={m} className="px-2 py-2 text-right min-w-[90px]">{m}</th>)}
                      <th className="px-3 py-2 text-right min-w-[110px] bg-[#1e3a8a]">Total/Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryMonthlyRows.map((r, idx) => (
                      <tr key={r.cat} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                        <td className="px-3 py-2 font-medium sticky left-0 bg-inherit">{r.cat}</td>
                        {r.months.map((v, mi) => (
                          <td key={mi} className="px-2 py-2 text-right tabular-nums">{v > 0 ? idr(v) : <span className="text-gray-300">—</span>}</td>
                        ))}
                        <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50 tabular-nums">{idr(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-xs border-t-2 border-gray-300">
                      <td className="px-3 py-2 sticky left-0 bg-gray-100">GRAND TOTAL</td>
                      {categoryMonthlyGrand.months.map((v, mi) => <td key={mi} className="px-2 py-2 text-right tabular-nums">{idr(v)}</td>)}
                      <td className="px-3 py-2 text-right bg-blue-100 tabular-nums">{idr(categoryMonthlyGrand.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Asset Detail */}
      <div className="bg-white rounded-lg border p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-base">
              Asset Detail — {year}
              {site && <span className="ml-2 text-sm font-normal text-orange-500">(Site: {site})</span>}
            </h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {(assets as ForecastAssetsResponse | undefined)
                ? `${(assets as ForecastAssetsResponse).total.toLocaleString('id-ID')} assets`
                : 'Loading...'}
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="text"
              placeholder="Search name / asset no..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && setPage(1)}
              className="border border-gray-300 rounded-md px-2.5 py-1.5 text-xs w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={() => setPage(1)}
              className="bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            >
              Search
            </button>
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <select
              value={size}
              onChange={e => { setSize(Number(e.target.value)); setPage(1) }}
              className="border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
              <option value="200">200 rows</option>
              <option value="350">350 rows</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-md border border-gray-200" style={{ maxHeight: '520px', overflowY: 'auto' }}>
          <table className="border-collapse text-[10px]" style={{ minWidth: 2200 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
              {/* ROW 1: Group headers */}
              <tr>
                <th rowSpan={2} className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#1e3a5f] text-white whitespace-nowrap" style={{ position: 'sticky', left: 0, zIndex: 30 }}>No</th>
                <th colSpan={6} className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#1e3a5f] text-white whitespace-nowrap">Identity</th>
                <th colSpan={3} className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#374151] text-white whitespace-nowrap">Depreciation Info</th>
                <th colSpan={12} className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#1e3a8a] text-white whitespace-nowrap">Monthly Depreciation — {year}</th>
                <th rowSpan={2} className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#1e40af] text-white whitespace-nowrap min-w-[100px]">Total/Year</th>
                <th rowSpan={2} className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#4c1d95] text-white whitespace-nowrap min-w-[100px]">NBV<br/>Projected</th>
              </tr>
              {/* ROW 2: Sub headers */}
              <tr>
                <th className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#1e3a5f] text-white whitespace-nowrap min-w-[80px]">AX No.</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#1e3a5f] text-white whitespace-nowrap min-w-[180px]" style={{ position: 'sticky', left: 40, zIndex: 29 }}>Name</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#374151] text-white whitespace-nowrap min-w-[100px]">Group</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#374151] text-white whitespace-nowrap min-w-[60px]">Category</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#374151] text-white whitespace-nowrap min-w-[50px]">Site</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#374151] text-white whitespace-nowrap min-w-[70px]">Job</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#374151] text-white whitespace-nowrap min-w-[100px]">Purchase Price</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#4b5563] text-white whitespace-nowrap min-w-[55px]">Period</th>
                <th className="border border-gray-400 px-2 py-1 text-center font-bold bg-[#4b5563] text-white whitespace-nowrap min-w-[55px]">Remain</th>
                {MONTHS.map(m => <th key={m} className="border border-gray-400 px-1 py-1 text-center font-bold bg-[#1e3a8a] text-white whitespace-nowrap min-w-[80px]">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {(assets as ForecastAssetsResponse | undefined)?.items.map((asset: ForecastAsset, idx: number) => (
                <tr key={asset.fixed_asset_number_ax || asset.id} className={`hover:bg-amber-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  {/* No — sticky */}
                  <td className="border border-gray-200 px-2 py-1 text-center text-gray-500 bg-inherit" style={{ position: 'sticky', left: 0, zIndex: 10 }}>
                    {(page - 1) * size + idx + 1}
                  </td>
                  {/* AX No */}
                  <td className="border border-gray-200 px-2 py-1 font-mono text-blue-700 font-medium">{asset.fixed_asset_number_ax || '—'}</td>
                  {/* Name — sticky */}
                  <td className="border border-gray-200 px-2 py-1 font-medium max-w-[180px] truncate bg-inherit" style={{ position: 'sticky', left: 40, zIndex: 10 }} title={asset.name}>{asset.name}</td>
                  {/* Group */}
                  <td className="border border-gray-200 px-2 py-1 text-gray-600">{asset.group_name || '—'}</td>
                  {/* Category */}
                  <td className="border border-gray-200 px-2 py-1 text-center">
                    {asset.category
                      ? <span className="inline-block px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-medium">{asset.category}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  {/* Site */}
                  <td className="border border-gray-200 px-2 py-1 text-center text-gray-600">{asset.site_location || '—'}</td>
                  {/* Job */}
                  <td className="border border-gray-200 px-2 py-1 text-gray-600">{asset.job || '—'}</td>
                  {/* Purchase Price */}
                  <td className="border border-gray-200 px-2 py-1 text-right text-gray-700">{idrCell(asset.purchase_price)}</td>
                  {/* Period */}
                  <td className="border border-gray-200 px-2 py-1 text-center text-gray-600">
                    {asset.depreciation_period_total} <span className="text-gray-400">mo</span>
                  </td>
                  {/* Remain */}
                  <td className="border border-gray-200 px-2 py-1 text-center">
                    {asset.dep_period_remain <= 0
                      ? <span className="inline-block px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[9px] font-semibold">Done</span>
                      : <span className="text-gray-700">{asset.dep_period_remain} <span className="text-gray-400">mo</span></span>}
                  </td>
                  {/* Monthly Jan-Des */}
                  {MONTH_KEYS.map(mk => (
                    <td key={mk} className="border border-gray-200 px-1 py-1 text-right bg-blue-50 tabular-nums">
                      {asset.months[mk] > 0 ? idrCell(asset.months[mk]) : <span className="text-gray-300">—</span>}
                    </td>
                  ))}
                  {/* Total/Year */}
                  <td className="border border-gray-200 px-2 py-1 text-right font-bold text-blue-700 bg-blue-50 tabular-nums">{idrCell(asset.dep_expense_current)}</td>
                  {/* NBV */}
                  <td className="border border-gray-200 px-2 py-1 text-right font-bold bg-purple-50 tabular-nums">{idrCell(asset.nbv_curr)}</td>
                </tr>
              ))}
              {(assets as ForecastAssetsResponse | undefined)?.items.length === 0 && (
                <tr>
                  <td colSpan={23} className="text-center py-8 text-gray-400 text-xs">No assets found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(assets as ForecastAssetsResponse | undefined) && (
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-xs text-gray-500">
              Showing {Math.min(((assets as ForecastAssetsResponse).page - 1) * size + 1, (assets as ForecastAssetsResponse).total)}–{Math.min((assets as ForecastAssetsResponse).page * size, (assets as ForecastAssetsResponse).total)} of <strong>{(assets as ForecastAssetsResponse).total.toLocaleString('id-ID')}</strong> assets
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(1)}
                className="px-2 py-1 border rounded text-xs disabled:opacity-30 hover:bg-gray-50 transition-colors"
              >«</button>
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 border rounded text-xs disabled:opacity-30 hover:bg-gray-50 transition-colors"
              >← Prev</button>
              <span className="px-3 py-1 text-xs text-gray-600 font-medium">
                Page {page} of {Math.ceil((assets as ForecastAssetsResponse).total / size)}
              </span>
              <button
                disabled={page * size >= (assets as ForecastAssetsResponse).total}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 border rounded text-xs disabled:opacity-30 hover:bg-gray-50 transition-colors"
              >Next →</button>
              <button
                disabled={page * size >= (assets as ForecastAssetsResponse).total}
                onClick={() => setPage(Math.ceil((assets as ForecastAssetsResponse).total / size))}
                className="px-2 py-1 border rounded text-xs disabled:opacity-30 hover:bg-gray-50 transition-colors"
              >»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function idr(v: number | null | undefined) {
  if (v == null) return 'Rp 0'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(v)))
}

function idrCell(v: number | null | undefined) {
  if (v == null || Number(v) === 0) return '—'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(v)))
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

interface ForecastAsset {
  id: number
  fixed_asset_number_ax: string | null
  asset_no: string
  name: string
  group_name: string | null
  category: string | null
  site_location: string | null
  job: string | null
  purchase_price: number
  purchase_date: string | null
  depreciation_period_total: number
  monthly_depreciation: number
  dep_period_remain: number
  dep_expense_current: number
  nbv_curr: number
  total_year: number
  months: Record<string, number>
}

interface ForecastAssetsResponse {
  forecast_year: number
  total: number
  page: number
  size: number
  items: ForecastAsset[]
}
