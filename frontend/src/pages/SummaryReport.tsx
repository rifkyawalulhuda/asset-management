import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSummaryTotals, fetchSummaryByGroup, fetchSummaryByCategory, fetchSiteLocations } from '../services/assets'
import api from '../services/api'

const YEARS = [2026, 2025]

function idr(v: number | null | undefined) {
  if (v == null) return '-'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(v)))
}

function idrShort(v: number) {
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)}M`
  return new Intl.NumberFormat('id-ID').format(Math.round(v))
}

const SHEETS = [
  { icon: '📋', label: 'Asset List', desc: 'Semua kolom fixed asset (35 kolom)', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  { icon: '📅', label: 'Monthly Depreciation', desc: 'Jan–Des per Job/Category', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
  { icon: '🏗️', label: 'Summary by Group', desc: 'Purchase Price, Acc Dep, NBV per Group', color: 'bg-gray-50 border-gray-200 text-gray-800' },
  { icon: '🏷️', label: 'Summary by Category', desc: 'Purchase Price, Acc Dep, NBV per Category + %', color: 'bg-cyan-50 border-cyan-200 text-cyan-800' },
  { icon: '🔄', label: 'Acquisitions & Disposals', desc: 'Data akuisisi dan disposal', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
]

export default function SummaryReport() {
  const [year, setYear] = useState(2026)
  const [site, setSite] = useState<string | undefined>(undefined)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

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

  const handleDownload = async () => {
    setDownloading(true)
    setDownloadError(null)
    try {
      const params: Record<string, string> = { year_ref: String(year) }
      if (site) params.site_location = site

      const response = await api.get('/export/excel', {
        params,
        responseType: 'blob',
      })

      const siteLabel = site || 'All'
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const filename = `depreciation_${year}_${siteLabel}_${today}.xlsx`

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setDownloadError('Download gagal. Pastikan backend berjalan dan coba lagi.')
    } finally {
      setDownloading(false)
    }
  }

  const siteLabel = site || 'All Sites'
  const filename = `depreciation_${year}_${site || 'All'}_YYYYMMDD.xlsx`

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Export Center</h1>
        <p className="text-gray-500 text-xs mt-1">PT. Sankyu Indonesia International — Download data ke Excel</p>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-sm text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">1</span>
          Pilih Filter Export
        </h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tahun</label>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Site / Lokasi</label>
            <select
              value={site || ''}
              onChange={e => setSite(e.target.value || undefined)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sites</option>
              {siteLocations?.map(s => (
                <option key={s.site_location} value={s.site_location}>
                  {s.site_location} ({s.count} assets)
                </option>
              ))}
            </select>
          </div>
          {site && (
            <button
              onClick={() => setSite(undefined)}
              className="text-xs text-red-500 border border-red-200 rounded-md px-2.5 py-1.5 hover:bg-red-50 transition-colors"
            >
              Clear ✕
            </button>
          )}
        </div>
      </div>

      {/* Preview Cards */}
      <div className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-sm text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">2</span>
          Preview Data yang Akan Di-export
          <span className="ml-1 text-xs font-normal text-gray-400">({siteLabel}, {year})</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <PreviewCard
            label="Total Assets"
            value={loadingTotals ? '...' : `${totals?.total_assets?.toLocaleString('id-ID') || 0}`}
            sub="assets"
            color="slate"
          />
          <PreviewCard
            label="Purchase Price"
            value={loadingTotals ? '...' : idrShort(totals?.total_purchase_price || 0)}
            sub="total nilai perolehan"
            color="gray"
          />
          <PreviewCard
            label={`Yearly Dep. ${year}`}
            value={loadingTotals ? '...' : idrShort(totals?.total_yearly_depreciation || 0)}
            sub="depresiasi tahun berjalan"
            color="blue"
          />
          <PreviewCard
            label="Net Book Value"
            value={loadingTotals ? '...' : idrShort(totals?.total_net_book_value || 0)}
            sub="nilai buku bersih"
            color="green"
          />
        </div>

        {/* Preview by Group */}
        {byGroup && Object.keys(byGroup).length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 font-medium mb-2">By Asset Group</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="px-3 py-1.5 text-left">Group</th>
                  <th className="px-3 py-1.5 text-right">Assets</th>
                  <th className="px-3 py-1.5 text-right">Purchase Price</th>
                  <th className="px-3 py-1.5 text-right">Yearly Dep.</th>
                  <th className="px-3 py-1.5 text-right">NBV</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byGroup as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number}>)
                  .map(([group, d], idx) => (
                    <tr key={group} className={`border-t ${idx % 2 === 0 ? '' : 'bg-gray-50'}`}>
                      <td className="px-3 py-1.5 font-medium">{group}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{d.count}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{idr(d.purchase_price)}</td>
                      <td className="px-3 py-1.5 text-right text-blue-700 font-medium">{idr(d.yearly_depreciation)}</td>
                      <td className="px-3 py-1.5 text-right text-gray-600">{idr(d.net_book_value)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Preview by Category */}
        {byCategory && Object.keys(byCategory).length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 font-medium mb-2">By Category</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(byCategory as Record<string, {yearly_depreciation: number; count: number}>)
                .filter(([, d]) => d.count > 0)
                .map(([cat, d]) => (
                  <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-[11px] font-medium border border-blue-100">
                    {cat}
                    <span className="text-blue-400 font-normal">({d.count})</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Sheet List */}
      <div className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-sm text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">3</span>
          Isi File Excel
        </h2>
        <div className="space-y-2">
          {SHEETS.map((sheet, idx) => (
            <div key={idx} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${sheet.color}`}>
              <span className="text-base">{sheet.icon}</span>
              <div className="flex-1">
                <p className="text-xs font-semibold">Sheet {idx + 1}: {sheet.label}</p>
                <p className="text-[11px] opacity-70">{sheet.desc}</p>
              </div>
              <span className="text-[10px] opacity-50 font-mono">✓</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          Filename: <span className="font-mono text-gray-600">{filename}</span>
        </p>
      </div>

      {/* Download Button */}
      <div className="bg-white border rounded-lg p-5">
        <h2 className="font-semibold text-sm text-gray-700 mb-4 flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold">4</span>
          Download
        </h2>

        {downloadError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {downloadError}
          </div>
        )}

        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full flex items-center justify-center gap-3 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-3.5 px-6 rounded-lg transition-colors text-sm shadow-sm"
        >
          {downloading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Generating Excel...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
              </svg>
              Download Excel — {year} ({siteLabel})
            </>
          )}
        </button>
        <p className="text-[11px] text-gray-400 text-center mt-2">
          File berisi {SHEETS.length} sheets • Format .xlsx • Data dari database
        </p>
      </div>
    </div>
  )
}

function PreviewCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: 'blue' | 'green' | 'gray' | 'slate'
}) {
  const colors = {
    blue:  'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    gray:  'bg-gray-50 border-gray-200',
    slate: 'bg-slate-50 border-slate-200',
  }
  return (
    <div className={`rounded-lg border p-3 ${colors[color]}`}>
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      <div className="font-bold text-base leading-tight">{value}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
    </div>
  )
}
