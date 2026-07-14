import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchAssets, deleteAsset, fetchSiteLocations } from '../services/assets'
import { formatDate } from '../utils/format'
import type { AssetFilters, FixedAsset } from '../types'

const GROUPS = ['Building', 'Structures', 'Machinary and Equipment', 'Tools Furniture Fixtures', 'Vehicles']
const CATEGORIES = ['WH1', 'WH2', 'TRP', 'BALI', 'MDN', 'PBG', 'MKS', 'SBY', 'OTHERS']

// Column group colors
const C = {
  id:    'bg-[#1e3a5f] text-white',
  gray:  'bg-[#374151] text-white',
  green: 'bg-[#14532d] text-white',
  yellow:'bg-[#713f12] text-white',
  orange:'bg-[#7c2d12] text-white',
  blue:  'bg-[#1e3a8a] text-white',
  purple:'bg-[#4c1d95] text-white',
  // data rows
  d_id:    'bg-blue-50',
  d_gray:  'bg-white',
  d_green: 'bg-green-50',
  d_yellow:'bg-yellow-50',
  d_orange:'bg-orange-50',
  d_blue:  'bg-blue-50',
  d_purple:'bg-purple-50',
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function n(v: number | null | undefined) {
  if (v == null) return ''
  return new Intl.NumberFormat('id-ID').format(Math.round(Number(v)))
}
function idr(v: number | null | undefined) {
  if (v == null || v === 0) return '-'
  return new Intl.NumberFormat('id-ID').format(Math.round(Number(v)))
}

const th = (extra = '') => `border border-gray-400 px-1 py-0.5 text-center text-[10px] font-bold whitespace-nowrap ${extra}`
const td = (extra = '') => `border border-gray-300 px-1 py-0.5 text-[10px] whitespace-nowrap ${extra}`
const tdR = (extra = '') => `border border-gray-300 px-1 py-0.5 text-[10px] whitespace-nowrap text-right ${extra}`
const stickyLeft = (left: number) => ({ position: 'sticky' as const, left, zIndex: 10 })

export default function AssetList() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<AssetFilters>({ year_ref: 2026, page: 1, size: 100 })
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['assets', filters],
    queryFn: () => fetchAssets(filters),
  })

  // Fetch site locations dynamically
  const { data: siteLocations } = useQuery({
    queryKey: ['site-locations', filters.year_ref],
    queryFn: () => fetchSiteLocations(filters.year_ref),
    staleTime: 60000,
  })

  const deleteMut = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  })

  const handleSearch = () => setFilters(f => ({ ...f, search, page: 1 }))
  const handleFilter = (key: keyof AssetFilters, value: string) =>
    setFilters(f => ({ ...f, [key]: value || undefined, page: 1 }))

  const year = filters.year_ref || 2026

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-bold">LIST OF FIXED ASSETS AND DEPRECIATION SCHEDULE</h1>
          <p className="text-gray-500 text-xs">PT. SANKYU INDONESIA INTERNATIONAL — {data?.total ?? 0} assets</p>
        </div>
        <Link to="/assets/new" className="bg-blue-700 text-white px-3 py-1.5 rounded hover:bg-blue-800 text-xs font-medium">
          + Add Asset
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border rounded p-2 mb-2 flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Search name / asset no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="border rounded px-2 py-1 text-xs w-48"
        />
        <button onClick={handleSearch} className="bg-blue-700 text-white px-2 py-1 rounded text-xs">Search</button>
        <select onChange={e => handleFilter('group_name', e.target.value)} className="border rounded px-2 py-1 text-xs">
          <option value="">All Groups</option>
          {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select onChange={e => handleFilter('category', e.target.value)} className="border rounded px-2 py-1 text-xs">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select onChange={e => handleFilter('site_location', e.target.value)} className="border rounded px-2 py-1 text-xs">
          <option value="">All Sites</option>
          {siteLocations?.map(s => (
            <option key={s.site_location} value={s.site_location}>
              {s.site_location} ({s.count})
            </option>
          ))}
        </select>
        <select onChange={e => handleFilter('year_ref', e.target.value)} className="border rounded px-2 py-1 text-xs">
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>
        <select onChange={e => setFilters(f => ({ ...f, size: Number(e.target.value), page: 1 }))} className="border rounded px-2 py-1 text-xs">
          <option value="50">50 rows</option>
          <option value="100">100 rows</option>
          <option value="200">200 rows</option>
        </select>
      </div>

      {/* Excel-style Table */}
      <div className="overflow-auto border border-gray-400 rounded" style={{ maxHeight: 'calc(100vh - 220px)' }}>
        <table className="border-collapse text-[10px]" style={{ minWidth: 3200 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 20 }}>
            {/* === ROW 1: Group Headers === */}
            <tr>
              {/* Frozen: No */}
              <th rowSpan={3} className={th(`${C.id} min-w-[32px]`)} style={stickyLeft(0)}>No.</th>
              {/* Frozen: Site */}
              <th rowSpan={3} className={th(`${C.id} min-w-[40px]`)} style={stickyLeft(32)}>Site/<br/>Loc.</th>
              {/* Frozen: Job */}
              <th rowSpan={3} className={th(`${C.id} min-w-[60px]`)} style={stickyLeft(72)}>Job</th>

              {/* Identity group */}
              <th rowSpan={2} className={th(`${C.gray} min-w-[40px]`)}>Account<br/>No.</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[50px]`)}>Category</th>
              {/* Frozen: Asset No */}
              <th rowSpan={2} className={th(`${C.id} min-w-[80px]`)} style={stickyLeft(132)}>Asset<br/>No.</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[80px]`)}>Fixed Asset No.<br/>(AX)</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[80px]`)}>Purchase<br/>Date</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[100px]`)}>Group</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[60px]`)}>Voucher<br/>No.</th>
              {/* Frozen: Name */}
              <th rowSpan={2} className={th(`${C.id} min-w-[200px]`)} style={stickyLeft(212)}>Name of Fixed Asset</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[150px]`)}>Maker/Type/Location</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[120px]`)}>Capacity/Size/User</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[40px]`)}>Year</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[70px]`)}>Police No.</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[70px]`)}>Machine No.</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[70px]`)}>Chasis No.</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[30px]`)}>Qty</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[40px]`)}>Valas</th>
              {/* Green: Purchase */}
              <th rowSpan={2} className={th(`${C.green} min-w-[110px]`)}>Purchase Price<br/>(a)</th>
              <th rowSpan={2} className={th(`${C.green} min-w-[110px]`)}>Monthly<br/>Depreciation<br/>(b=a÷c)</th>
              {/* Yellow: Period */}
              <th colSpan={5} className={th(C.yellow)}>Depreciation Period</th>
              {/* Orange: 2025 values */}
              <th colSpan={2} className={th(C.orange)}>31 Dec 2025</th>
              {/* Blue-dark: current expense */}
              <th rowSpan={2} className={th(`${C.blue} min-w-[110px]`)}>Depreciation<br/>Expense Current<br/>31 Dec {year}</th>
              {/* Blue: Monthly 2026 */}
              <th colSpan={13} className={th(C.blue)}>DEPRECIATION {year} ( MONTHLY )</th>
              {/* Purple: end values */}
              <th colSpan={2} className={th(C.purple)}>31 Dec {year}</th>
              {/* Status */}
              <th colSpan={2} className={th(C.gray)}>Status</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[80px]`)}>Condition</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[80px]`)}>Remark</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[50px]`)}>Photo<br/>Status</th>
              <th rowSpan={2} className={th(`${C.gray} min-w-[60px]`)}>Actions</th>
            </tr>

            {/* === ROW 2: Sub-headers === */}
            <tr>
              {/* Yellow: Period sub */}
              <th className={th(`${C.yellow} min-w-[50px]`)}>Total<br/>(c)</th>
              <th className={th(`${C.yellow} min-w-[50px]`)}>Acc.<br/>{year-1}<br/>(d)</th>
              <th className={th(`${C.yellow} min-w-[55px]`)}>Yearly<br/>{year}<br/>(e)</th>
              <th className={th(`${C.yellow} min-w-[55px]`)}>Until<br/>{year}<br/>(f=d+e)</th>
              <th className={th(`${C.yellow} min-w-[60px]`)}>Remain<br/>&gt;{year+1}<br/>(g=c-f)</th>
              {/* Orange: 2025 sub */}
              <th className={th(`${C.orange} min-w-[110px]`)}>Accumulated<br/>Depreciation (l)</th>
              <th className={th(`${C.orange} min-w-[110px]`)}>Net Book<br/>Value (m=a-l)</th>
              {/* Blue: months */}
              {MONTHS.map(m => <th key={m} className={th(`${C.blue} min-w-[90px]`)}>{m}<br/>(k)</th>)}
              <th className={th(`${C.blue} min-w-[110px]`)}>Total/<br/>Year</th>
              {/* Purple: end sub */}
              <th className={th(`${C.purple} min-w-[110px]`)}>Accumulated<br/>Depreciation</th>
              <th className={th(`${C.purple} min-w-[110px]`)}>Net Book<br/>Value</th>
              {/* Status sub */}
              <th className={th(`${C.gray} min-w-[60px]`)}>Additional</th>
              <th className={th(`${C.gray} min-w-[60px]`)}>Disposals</th>
            </tr>

            {/* === ROW 3: Formula labels === */}
            <tr className="bg-gray-100 text-gray-500">
              {/* frozen */}
              <td className={td('text-center bg-gray-100')} style={stickyLeft(0)}></td>
              <td className={td('text-center bg-gray-100')} style={stickyLeft(32)}></td>
              <td className={td('text-center bg-gray-100')} style={stickyLeft(72)}></td>
              {/* gray cols */}
              {Array(17).fill(0).map((_, i) => <td key={i} className={td('text-center bg-gray-100')}></td>)}
              {/* frozen asset no */}
              <td className={td('text-center bg-gray-100')} style={stickyLeft(132)}></td>
              {/* frozen name */}
              <td className={td('text-center bg-gray-100')} style={stickyLeft(212)}></td>
              {/* green */}
              <td className={td('text-center bg-green-50 font-bold')}>a</td>
              <td className={td('text-center bg-green-50 font-bold')}>b=a÷c</td>
              {/* yellow */}
              <td className={td('text-center bg-yellow-50 font-bold')}>c</td>
              <td className={td('text-center bg-yellow-50 font-bold')}>d</td>
              <td className={td('text-center bg-yellow-50 font-bold')}>e</td>
              <td className={td('text-center bg-yellow-50 font-bold')}>f=d+e</td>
              <td className={td('text-center bg-yellow-50 font-bold')}>g=c-f</td>
              {/* orange */}
              <td className={td('text-center bg-orange-50 font-bold')}>l=h+j</td>
              <td className={td('text-center bg-orange-50 font-bold')}>m=a-l</td>
              {/* blue dark */}
              <td className={td('text-center bg-blue-50 font-bold')}>j=Σk</td>
              {/* blue months */}
              {MONTHS.map(m => <td key={m} className={td('text-center bg-blue-50 font-bold')}>k</td>)}
              <td className={td('text-center bg-blue-50 font-bold')}>Σk</td>
              {/* purple */}
              <td className={td('text-center bg-purple-50 font-bold')}>l</td>
              <td className={td('text-center bg-purple-50 font-bold')}>m</td>
              {/* status */}
              <td className={td('text-center bg-gray-100')}></td>
              <td className={td('text-center bg-gray-100')}></td>
              <td className={td('text-center bg-gray-100')}></td>
              <td className={td('text-center bg-gray-100')}></td>
              <td className={td('text-center bg-gray-100')}></td>
              <td className={td('text-center bg-gray-100')}></td>
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr><td colSpan={50} className="text-center py-8 text-gray-400">Loading...</td></tr>
            )}
            {data?.items.map((asset, idx) => {
              const key = asset.fixed_asset_number_ax || String(asset.id)
              const isEven = idx % 2 === 0
              const rowBg = isEven ? '' : 'bg-gray-50'

              // Monthly values for current year
              const monthly = asset.depreciation_monthly.filter(d => d.year === year)
              const monthlyTotal = monthly.reduce((s, d) => s + (Number(d.amount) || 0), 0)

              return (
                <tr key={key} className={`hover:bg-yellow-50 ${rowBg}`}>
                  {/* No */}
                  <td className={td(`text-center ${C.d_id} sticky`)} style={stickyLeft(0)}>{asset.no}</td>
                  {/* Site */}
                  <td className={td(`text-center ${C.d_id} sticky`)} style={stickyLeft(32)}>{asset.site_location}</td>
                  {/* Job */}
                  <td className={td(`${C.d_id} sticky`)} style={stickyLeft(72)}>{asset.job}</td>
                  {/* Account */}
                  <td className={td('text-center')}>{asset.account_no}</td>
                  {/* Category */}
                  <td className={td('text-center')}>
                    <span className="bg-blue-100 text-blue-700 px-1 rounded">{asset.category}</span>
                  </td>
                  {/* Asset No (frozen) */}
                  <td className={td(`font-mono ${C.d_id} sticky`)} style={stickyLeft(132)}>{asset.asset_no}</td>
                  {/* Fixed Asset No AX */}
                  <td className={td('font-mono font-semibold text-blue-700')}>{asset.fixed_asset_number_ax}</td>
                  {/* Purchase Date */}
                  <td className={td('text-center')}>{formatDate(asset.purchase_date)}</td>
                  {/* Group */}
                  <td className={td()}>{asset.group_name}</td>
                  {/* Voucher */}
                  <td className={td('text-center')}>{asset.voucher_no}</td>
                  {/* Name (frozen) */}
                  <td className={td(`${C.d_id} sticky max-w-[200px]`)} style={stickyLeft(212)}>
                    <Link to={`/assets/${key}`} className="text-blue-700 hover:underline font-medium">
                      {asset.name}
                    </Link>
                  </td>
                  {/* Maker */}
                  <td className={td('max-w-[150px] truncate')} title={asset.maker_type_location || ''}>{asset.maker_type_location}</td>
                  {/* Capacity */}
                  <td className={td('max-w-[120px] truncate')} title={asset.capacity_size_user || ''}>{asset.capacity_size_user}</td>
                  {/* Year */}
                  <td className={td('text-center')}>{asset.year}</td>
                  {/* Police */}
                  <td className={td('text-center')}>{asset.police_no}</td>
                  {/* Machine */}
                  <td className={td('text-center')}>{asset.machine_no}</td>
                  {/* Chasis */}
                  <td className={td('text-center')}>{asset.chasis_no}</td>
                  {/* Qty */}
                  <td className={td('text-center')}>{asset.quantity}</td>
                  {/* Valas */}
                  <td className={td('text-center')}>{asset.valas}</td>
                  {/* Purchase Price */}
                  <td className={tdR(C.d_green)}>{idr(asset.purchase_price)}</td>
                  {/* Monthly Depreciation */}
                  <td className={tdR(C.d_green)}>{idr(asset.monthly_depreciation)}</td>
                  {/* Period Total */}
                  <td className={tdR(C.d_yellow)}>{n(asset.depreciation_period_total)}</td>
                  {/* Acc Period prev */}
                  <td className={tdR(C.d_yellow)}>{n(asset.dep_period_acc_prev_year)}</td>
                  {/* Yearly */}
                  <td className={tdR(C.d_yellow)}>{n(asset.dep_period_yearly)}</td>
                  {/* Until */}
                  <td className={tdR(C.d_yellow)}>{n(asset.dep_period_until_year)}</td>
                  {/* Remain */}
                  <td className={tdR(C.d_yellow)}>{n(asset.dep_period_remain)}</td>
                  {/* Acc Depr 2025 */}
                  <td className={tdR(C.d_orange)}>{idr(asset.acc_depreciation_prev)}</td>
                  {/* NBV 2025 */}
                  <td className={tdR(C.d_orange)}>{idr(asset.net_book_value_prev)}</td>
                  {/* Dep Expense Current */}
                  <td className={tdR(C.d_blue + ' font-semibold')}>{idr(asset.dep_expense_current)}</td>
                  {/* Monthly Jan-Dec */}
                  {MONTHS.map((_, mi) => {
                    const row = monthly.find(d => d.month === mi + 1)
                    const amt = row?.amount
                    return (
                      <td key={mi} className={tdR(C.d_blue)}>
                        {amt && Number(amt) > 0 ? idr(Number(amt)) : <span className="text-gray-300">-</span>}
                      </td>
                    )
                  })}
                  {/* Total/Year */}
                  <td className={tdR(C.d_blue + ' font-bold')}>{monthlyTotal > 0 ? idr(monthlyTotal) : '-'}</td>
                  {/* Acc Depr curr */}
                  <td className={tdR(C.d_purple)}>{idr(asset.acc_depreciation_curr)}</td>
                  {/* NBV curr */}
                  <td className={tdR(`${C.d_purple} font-bold`)}>
                    <span className={Number(asset.net_book_value_curr) === 0 ? 'text-gray-400' : 'text-blue-800'}>
                      {idr(asset.net_book_value_curr)}
                    </span>
                  </td>
                  {/* Status Additional */}
                  <td className={td('text-center')}>
                    {asset.status_additional ? <span className="text-green-600 font-bold">✓</span> : ''}
                  </td>
                  {/* Status Disposals */}
                  <td className={td('text-center')}>
                    {asset.status_disposals ? <span className="text-red-600 font-bold">✓</span> : ''}
                  </td>
                  {/* Condition */}
                  <td className={td('text-center')}>{asset.condition}</td>
                  {/* Remark */}
                  <td className={td('max-w-[80px] truncate')} title={asset.remark || ''}>{asset.remark}</td>
                  {/* Photo Status */}
                  <td className={td('text-center')}>
                    <span className={asset.photo_status === 'Ok' ? 'text-green-600 font-semibold' : 'text-red-500'}>
                      {asset.photo_status}
                    </span>
                  </td>
                  {/* Actions */}
                  <td className={td('text-center')}>
                    <div className="flex gap-1 justify-center">
                      <Link to={`/assets/${key}/edit`} className="text-blue-600 hover:underline">Edit</Link>
                      <button
                        onClick={() => { if (confirm(`Delete ${asset.name}?`)) deleteMut.mutate(asset.id) }}
                        className="text-red-500 hover:underline"
                      >Del</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* Grand Total Footer */}
          {data && data.items.length > 0 && (
            <tfoot>
              <TotalRow items={data.items} year={year} />
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > (filters.size || 50) && (
        <div className="flex gap-2 mt-2 justify-center">
          <button disabled={filters.page === 1}
            onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) - 1 }))}
            className="px-3 py-1 border rounded text-xs disabled:opacity-40">Prev</button>
          <span className="px-3 py-1 text-xs">Page {filters.page} / {Math.ceil(data.total / (filters.size || 50))}</span>
          <button disabled={(filters.page || 1) * (filters.size || 50) >= data.total}
            onClick={() => setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))}
            className="px-3 py-1 border rounded text-xs disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

function TotalRow({ items, year }: { items: FixedAsset[], year: number }) {
  const sum = (fn: (a: FixedAsset) => number) => items.reduce((s, a) => s + fn(a), 0)

  const purchaseTotal = sum(a => Number(a.purchase_price) || 0)
  const monthlyTotal = sum(a => Number(a.monthly_depreciation) || 0)
  const accPrevTotal = sum(a => Number(a.acc_depreciation_prev) || 0)
  const nbvPrevTotal = sum(a => Number(a.net_book_value_prev) || 0)
  const depExpTotal  = sum(a => Number(a.dep_expense_current) || 0)
  const accCurrTotal = sum(a => Number(a.acc_depreciation_curr) || 0)
  const nbvCurrTotal = sum(a => Number(a.net_book_value_curr) || 0)

  const idr = (v: number) => v > 0 ? new Intl.NumberFormat('id-ID').format(Math.round(v)) : '-'
  const ftd = (extra = '') => `border border-gray-400 px-1 py-1 text-[10px] whitespace-nowrap font-bold bg-gray-200 text-right ${extra}`

  const monthTotals = Array.from({ length: 12 }, (_, mi) =>
    items.reduce((s, a) => {
      const row = a.depreciation_monthly.find(d => d.year === year && d.month === mi + 1)
      return s + (Number(row?.amount) || 0)
    }, 0)
  )
  const grandMonthly = monthTotals.reduce((s, v) => s + v, 0)

  return (
    <tr className="bg-gray-200">
      <td colSpan={3} className={ftd('text-center')}>TOTAL</td>
      <td colSpan={17} className={ftd('text-center')}></td>
      <td className={ftd()}>{idr(purchaseTotal)}</td>
      <td className={ftd()}>{idr(monthlyTotal)}</td>
      <td colSpan={5} className={ftd('text-center')}></td>
      <td className={ftd()}>{idr(accPrevTotal)}</td>
      <td className={ftd()}>{idr(nbvPrevTotal)}</td>
      <td className={ftd()}>{idr(depExpTotal)}</td>
      {monthTotals.map((v, i) => <td key={i} className={ftd()}>{idr(v)}</td>)}
      <td className={ftd()}>{idr(grandMonthly)}</td>
      <td className={ftd()}>{idr(accCurrTotal)}</td>
      <td className={ftd()}>{idr(nbvCurrTotal)}</td>
      <td colSpan={6} className={ftd('text-center')}></td>
    </tr>
  )
}
