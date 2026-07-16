import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchForecastTotals,
  fetchForecastMonthly,
  fetchForecastByGroup,
  fetchForecastByCategory,
  fetchForecastAssets,
  fetchSiteLocations,
  fetchJobs,
  fetchPlannedAssets,
  createPlannedAsset,
  updatePlannedAsset,
  deletePlannedAsset,
} from '../services/assets'

interface PlannedAsset {
  id: number
  forecast_year: number
  site_location: string | null
  job: string | null
  category: string | null
  group_name: string | null
  name: string
  purchase_price: number | null
  depreciation_period_total: number | null
  planned_purchase_month: number
  planned_purchase_year: number
  created_at: string | null
  updated_at: string | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export default function ForecastPage() {
  const [year, setYear] = useState(2027)
  const [site, setSite] = useState<string | undefined>(undefined)
  const [groupView, setGroupView] = useState<'summary' | 'monthly'>('summary')
  const [categoryView, setCategoryView] = useState<'summary' | 'monthly'>('summary')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(100)
  const [activeTab, setActiveTab] = useState<'forecast' | 'planned'>('forecast')
  const [includePlanned, setIncludePlanned] = useState(false)
  const [showPlannedForm, setShowPlannedForm] = useState(false)
  const [editingPlanned, setEditingPlanned] = useState<PlannedAsset | null>(null)
  const [siteSearch, setSiteSearch] = useState('')
  const [showSiteDropdown, setShowSiteDropdown] = useState(false)
  const [plannedForm, setPlannedForm] = useState({
    name: '',
    group_name: '',
    category: '',
    site_location: '',
    job: '',
    purchase_price: '',
    depreciation_period_total: '',
    planned_purchase_month: 1,
    planned_purchase_year: year,
  })

  const qc = useQueryClient()

  const { data: siteLocations } = useQuery({
    queryKey: ['site-locations', 2026],
    queryFn: () => fetchSiteLocations(2026),
    staleTime: 60000,
  })

  // Jobs dependent on selected site in form
  const { data: jobOptions = [] } = useQuery({
    queryKey: ['jobs', plannedForm.site_location],
    queryFn: () => fetchJobs(plannedForm.site_location || undefined, 2026),
    enabled: true,
    staleTime: 60000,
  })

  // Fetch ALL planned assets (no filter) to calculate dynamic year range
  const { data: allPlannedAssets = [] } = useQuery({
    queryKey: ['planned-assets-all'],
    queryFn: () => fetchPlannedAssets(),
    staleTime: 30000,
  })

  // Dynamic forecast years based on planned assets depreciation end dates
  const forecastYears = useMemo(() => {
    const baseMin = 2027
    let maxYear = 2030
    for (const asset of allPlannedAssets as PlannedAsset[]) {
      if (asset.purchase_price && asset.depreciation_period_total) {
        const endYear = asset.planned_purchase_year + Math.ceil(asset.depreciation_period_total / 12)
        maxYear = Math.max(maxYear, endYear)
      }
    }
    const years: number[] = []
    for (let y = baseMin; y <= maxYear; y++) years.push(y)
    return years
  }, [allPlannedAssets])

  // Reset year if it falls outside the new dynamic range
  useEffect(() => {
    if (forecastYears.length > 0 && !forecastYears.includes(year)) {
      setYear(forecastYears[0])
    }
  }, [forecastYears])

  const { data: totals, isLoading: loadingTotals } = useQuery({
    queryKey: ['forecast-totals', year, site, includePlanned],
    queryFn: () => fetchForecastTotals(year, site, includePlanned),
    retry: 1,
  })

  const { data: monthly, isLoading: loadingMonthly } = useQuery({
    queryKey: ['forecast-monthly', year, site, includePlanned],
    queryFn: () => fetchForecastMonthly(year, site, 'job', includePlanned),
    retry: 1,
  })

  const { data: byGroup } = useQuery({
    queryKey: ['forecast-group', year, site, includePlanned],
    queryFn: () => fetchForecastByGroup(year, site, includePlanned),
    retry: 1,
  })

  const { data: byCategory } = useQuery({
    queryKey: ['forecast-category', year, site, includePlanned],
    queryFn: () => fetchForecastByCategory(year, site, includePlanned),
    retry: 1,
  })

  const { data: groupMonthly, isLoading: loadingGroupMonthly } = useQuery({
    queryKey: ['forecast-monthly-group', year, site, includePlanned],
    queryFn: () => fetchForecastMonthly(year, site, 'group_name', includePlanned),
    enabled: groupView === 'monthly',
    retry: 1,
  })

  const { data: categoryMonthly, isLoading: loadingCategoryMonthly } = useQuery({
    queryKey: ['forecast-monthly-category', year, site, includePlanned],
    queryFn: () => fetchForecastMonthly(year, site, 'category', includePlanned),
    enabled: categoryView === 'monthly',
    retry: 1,
  })

  const { data: assets } = useQuery({
    queryKey: ['forecast-assets', year, site, search, page, size, includePlanned],
    queryFn: () => fetchForecastAssets(year, { site_location: site, search, page, size, include_planned: includePlanned }),
    retry: 1,
  })

  const { data: plannedAssets = [], isLoading: loadingPlanned } = useQuery({
    queryKey: ['planned-assets', year, site],
    queryFn: () => fetchPlannedAssets(year, site),
    retry: 1,
  })

  const createMut = useMutation({
    mutationFn: createPlannedAsset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned-assets'] })
      qc.invalidateQueries({ queryKey: ['forecast-totals'] })
      qc.invalidateQueries({ queryKey: ['forecast-monthly'] })
      setShowPlannedForm(false)
      resetForm()
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updatePlannedAsset>[1] }) =>
      updatePlannedAsset(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned-assets'] })
      qc.invalidateQueries({ queryKey: ['forecast-totals'] })
      qc.invalidateQueries({ queryKey: ['forecast-monthly'] })
      setEditingPlanned(null)
      setShowPlannedForm(false)
      resetForm()
    },
  })

  const deleteMut = useMutation({
    mutationFn: deletePlannedAsset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['planned-assets'] })
      qc.invalidateQueries({ queryKey: ['forecast-totals'] })
      qc.invalidateQueries({ queryKey: ['forecast-monthly'] })
    },
  })

  const resetForm = () => setPlannedForm({
    name: '', group_name: '', category: '', site_location: site || '',
    job: '', purchase_price: '', depreciation_period_total: '',
    planned_purchase_month: 1, planned_purchase_year: year,
  })

  const handleSubmitPlanned = () => {
    const payload = {
      forecast_year: year,
      name: plannedForm.name,
      group_name: plannedForm.group_name || undefined,
      category: plannedForm.category || undefined,
      site_location: plannedForm.site_location || undefined,
      job: plannedForm.job || undefined,
      purchase_price: plannedForm.purchase_price ? Number(plannedForm.purchase_price) : undefined,
      depreciation_period_total: plannedForm.depreciation_period_total ? Number(plannedForm.depreciation_period_total) : undefined,
      planned_purchase_month: Number(plannedForm.planned_purchase_month),
      planned_purchase_year: Number(plannedForm.planned_purchase_year),
    }
    if (editingPlanned) {
      updateMut.mutate({ id: editingPlanned.id, payload })
    } else {
      createMut.mutate(payload)
    }
  }

  const handleEditPlanned = (asset: PlannedAsset) => {
    setEditingPlanned(asset)
    setPlannedForm({
      name: asset.name,
      group_name: asset.group_name || '',
      category: asset.category || '',
      site_location: asset.site_location || '',
      job: asset.job || '',
      purchase_price: asset.purchase_price ? String(asset.purchase_price) : '',
      depreciation_period_total: asset.depreciation_period_total ? String(asset.depreciation_period_total) : '',
      planned_purchase_month: asset.planned_purchase_month,
      planned_purchase_year: asset.planned_purchase_year,
    })
    setShowPlannedForm(true)
  }

  const jobs = monthly ? Object.keys(monthly).sort() : []

  const monthlyTableRows = jobs.map(job => {
    const row = monthly![job] as Record<string, unknown>
    const planned = (row.planned || {}) as Record<string, number>
    const months = MONTH_KEYS.map(k => (row[k] as number || 0) + (includePlanned ? (planned[k] || 0) : 0))
    const total = months.reduce((s, v) => s + v, 0)
    const plannedMonths = MONTH_KEYS.map(k => planned[k] || 0)
    const plannedTotal = plannedMonths.reduce((s, v) => s + v, 0)
    return { job, months, total, plannedMonths, plannedTotal }
  })
  const monthlyGrandRow = {
    months: MONTH_KEYS.map((_, mi) => monthlyTableRows.reduce((s, r) => s + r.months[mi], 0)),
    total: monthlyTableRows.reduce((s, r) => s + r.total, 0),
  }

  const groupMonthlyRows = useMemo(() => {
    if (!groupMonthly) return []
    return Object.keys(groupMonthly).sort().map(grp => {
      const row = groupMonthly[grp] as Record<string, unknown>
      const planned = (row.planned || {}) as Record<string, number>
      const months = MONTH_KEYS.map(k => (row[k] as number || 0) + (includePlanned ? (planned[k] || 0) : 0))
      const total = months.reduce((s, v) => s + v, 0)
      return { grp, months, total }
    })
  }, [groupMonthly, includePlanned])
  const groupMonthlyGrand = useMemo(() => ({
    months: MONTH_KEYS.map((_, mi) => groupMonthlyRows.reduce((s, r) => s + r.months[mi], 0)),
    total: groupMonthlyRows.reduce((s, r) => s + r.total, 0),
  }), [groupMonthlyRows])

  const categoryMonthlyRows = useMemo(() => {
    if (!categoryMonthly) return []
    return Object.keys(categoryMonthly).sort().map(cat => {
      const row = categoryMonthly[cat] as Record<string, unknown>
      const planned = (row.planned || {}) as Record<string, number>
      const months = MONTH_KEYS.map(k => (row[k] as number || 0) + (includePlanned ? (planned[k] || 0) : 0))
      const total = months.reduce((s, v) => s + v, 0)
      return { cat, months, total }
    })
  }, [categoryMonthly, includePlanned])
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
            {forecastYears.map(y => <option key={y} value={y}>{y}</option>)}
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
          {/* Include Planned toggle */}
          <div className="ml-2 flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <div
                onClick={() => setIncludePlanned(v => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${includePlanned ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${includePlanned ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-gray-600">Include Planned Assets</span>
              {includePlanned && (plannedAssets as PlannedAsset[]).length > 0 && (
                <span className="text-xs text-green-600 font-medium">({(plannedAssets as PlannedAsset[]).length} planned)</span>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('forecast')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'forecast'
              ? 'bg-white border border-b-white border-gray-200 text-blue-700 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Forecast
        </button>
        <button
          onClick={() => setActiveTab('planned')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-1.5 ${
            activeTab === 'planned'
              ? 'bg-white border border-b-white border-gray-200 text-blue-700 -mb-px'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Planned Assets
          {(plannedAssets as PlannedAsset[]).length > 0 && (
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {(plannedAssets as PlannedAsset[]).length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'planned' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-base">Planned Assets — {year}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Asset yang direncanakan untuk dibeli di {year}</p>
              </div>
              <button
                onClick={() => { resetForm(); setEditingPlanned(null); setShowPlannedForm(v => !v) }}
                className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              >
                <span>+</span> Add Planned Asset
              </button>
            </div>

            {showPlannedForm && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-800 mb-3">
                  {editingPlanned ? 'Edit Planned Asset' : 'Add Planned Asset'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="col-span-2 md:col-span-3">
                    <label className="block text-xs text-gray-600 mb-1">Asset Name *</label>
                    <input
                      type="text"
                      value={plannedForm.name}
                      onChange={e => setPlannedForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Forklift Toyota 3 Ton"
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Group</label>
                    <select
                      value={plannedForm.group_name}
                      onChange={e => setPlannedForm(f => ({ ...f, group_name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select group...</option>
                      {['Building','Structures','Machinary and Equipment','Tools Furniture Fixtures','Vehicles'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Category</label>
                    <select
                      value={plannedForm.category}
                      onChange={e => setPlannedForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select category...</option>
                      {['WH1','WH2','TRP','BALI','MDN','PBG','MKS','SBY','OTHERS'].map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <label className="block text-xs text-gray-600 mb-1">Site</label>
                    <input
                      type="text"
                      value={siteSearch || plannedForm.site_location}
                      onChange={e => {
                        setSiteSearch(e.target.value)
                        setShowSiteDropdown(true)
                        setPlannedForm(f => ({ ...f, site_location: e.target.value, job: '' }))
                      }}
                      onFocus={() => setShowSiteDropdown(true)}
                      onBlur={() => setTimeout(() => setShowSiteDropdown(false), 150)}
                      placeholder="Search site..."
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {showSiteDropdown && (
                      <div className="absolute z-50 mt-0.5 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {(siteLocations || [])
                          .filter(s => !plannedForm.site_location || s.site_location.toLowerCase().includes((siteSearch || plannedForm.site_location).toLowerCase()))
                          .map(s => (
                            <div
                              key={s.site_location}
                              onMouseDown={() => {
                                setPlannedForm(f => ({ ...f, site_location: s.site_location, job: '' }))
                                setSiteSearch('')
                                setShowSiteDropdown(false)
                              }}
                              className="px-3 py-1.5 text-xs hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                            >
                              <span className="font-medium">{s.site_location}</span>
                              <span className="text-gray-400 text-[10px]">{s.count} assets</span>
                            </div>
                          ))}
                        {(siteLocations || []).filter(s => s.site_location.toLowerCase().includes((siteSearch || '').toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs text-gray-400">No sites found</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Job</label>
                    <select
                      value={plannedForm.job}
                      onChange={e => setPlannedForm(f => ({ ...f, job: e.target.value }))}
                      disabled={!plannedForm.site_location}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      <option value="">{plannedForm.site_location ? 'Select job...' : 'Select site first'}</option>
                      {(jobOptions as { job: string; count: number }[]).map(j => (
                        <option key={j.job} value={j.job}>{j.job} ({j.count})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Purchase Price (IDR) *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={plannedForm.purchase_price
                        ? new Intl.NumberFormat('id-ID').format(Number(plannedForm.purchase_price))
                        : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '')
                        setPlannedForm(f => ({ ...f, purchase_price: raw }))
                      }}
                      placeholder="e.g. 150.000.000"
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {plannedForm.purchase_price && (
                      <p className="text-[10px] text-blue-600 mt-0.5">
                        Rp {new Intl.NumberFormat('id-ID').format(Number(plannedForm.purchase_price))}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Depreciation Period (months) *</label>
                    <input
                      type="number"
                      value={plannedForm.depreciation_period_total}
                      onChange={e => setPlannedForm(f => ({ ...f, depreciation_period_total: e.target.value }))}
                      placeholder="e.g. 60"
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Planned Purchase Month *</label>
                    <select
                      value={plannedForm.planned_purchase_month}
                      onChange={e => setPlannedForm(f => ({ ...f, planned_purchase_month: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Planned Purchase Year *</label>
                    <select
                      value={plannedForm.planned_purchase_year}
                      onChange={e => setPlannedForm(f => ({ ...f, planned_purchase_year: Number(e.target.value) }))}
                      className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {[2026, 2027, 2028, 2029, 2030].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {plannedForm.purchase_price && plannedForm.depreciation_period_total && (
                  <div className="mt-3 p-3 bg-white border border-blue-100 rounded-lg">
                    <p className="text-[11px] text-gray-500 mb-1 font-medium">Quick Preview</p>
                    <div className="flex gap-6 text-xs">
                      <span>Monthly Dep: <strong className="text-blue-700">
                        {idr(Number(plannedForm.purchase_price) / Number(plannedForm.depreciation_period_total))}
                      </strong></span>
                      <span>Total Period: <strong>{plannedForm.depreciation_period_total} mo</strong></span>
                      <span>Start: <strong>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][plannedForm.planned_purchase_month - 1]} {plannedForm.planned_purchase_year}</strong></span>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSubmitPlanned}
                    disabled={!plannedForm.name || !plannedForm.purchase_price || !plannedForm.depreciation_period_total || createMut.isPending || updateMut.isPending}
                    className="bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    {(createMut.isPending || updateMut.isPending) ? 'Saving...' : editingPlanned ? 'Update' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setShowPlannedForm(false); setEditingPlanned(null); resetForm() }}
                    className="border border-gray-300 text-gray-600 px-4 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loadingPlanned ? (
              <div className="text-gray-400 text-sm py-6 text-center">Loading...</div>
            ) : (plannedAssets as PlannedAsset[]).length === 0 ? (
              <div className="text-center py-10">
                <div className="text-gray-300 text-4xl mb-3">📋</div>
                <p className="text-gray-500 text-sm">Belum ada planned asset untuk {year}</p>
                <p className="text-gray-400 text-xs mt-1">Klik "Add Planned Asset" untuk menambahkan</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#1e3a5f] text-white">
                      <th className="px-3 py-2 text-left min-w-[160px]">Name</th>
                      <th className="px-3 py-2 text-left">Group</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">Site</th>
                      <th className="px-3 py-2 text-left">Job</th>
                      <th className="px-3 py-2 text-right">Purchase Price</th>
                      <th className="px-3 py-2 text-right">Period</th>
                      <th className="px-3 py-2 text-right bg-[#14532d]">Monthly Dep.</th>
                      <th className="px-3 py-2 text-center">Purchase Date</th>
                      <th className="px-3 py-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(plannedAssets as PlannedAsset[]).map((asset, idx) => {
                      const monthly = asset.purchase_price && asset.depreciation_period_total
                        ? Number(asset.purchase_price) / Number(asset.depreciation_period_total)
                        : null
                      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                      return (
                        <tr key={asset.id} className={`hover:bg-amber-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-3 py-2 font-medium">{asset.name}</td>
                          <td className="px-3 py-2 text-gray-600">{asset.group_name || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2">
                            {asset.category
                              ? <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">{asset.category}</span>
                              : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2 text-gray-600">{asset.site_location || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-gray-600">{asset.job || <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-right">{asset.purchase_price ? idr(Number(asset.purchase_price)) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-right">{asset.depreciation_period_total ? `${asset.depreciation_period_total} mo` : <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-right font-semibold text-green-700 bg-green-50">{monthly ? idr(monthly) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-3 py-2 text-center">
                            <span className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-[10px] font-medium border border-orange-100">
                              {monthNames[asset.planned_purchase_month - 1]} {asset.planned_purchase_year}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleEditPlanned(asset)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Edit"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => { if (confirm(`Hapus "${asset.name}"?`)) deleteMut.mutate(asset.id) }}
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold text-xs border-t-2 border-gray-300">
                      <td className="px-3 py-2" colSpan={5}>TOTAL ({(plannedAssets as PlannedAsset[]).length} planned assets)</td>
                      <td className="px-3 py-2 text-right">{idr((plannedAssets as PlannedAsset[]).reduce((s, a) => s + Number(a.purchase_price || 0), 0))}</td>
                      <td className="px-3 py-2 text-right">—</td>
                      <td className="px-3 py-2 text-right text-green-700 bg-green-50">
                        {idr((plannedAssets as PlannedAsset[]).reduce((s, a) =>
                          s + (a.purchase_price && a.depreciation_period_total
                            ? Number(a.purchase_price) / Number(a.depreciation_period_total)
                            : 0), 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (<>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Assets" value={totals ? `${totals.total_assets} assets` : '-'} sub={site || 'All Sites'} color="slate" loading={loadingTotals} />
        <StatCard label="Purchase Price" value={totals ? idr(totals.total_purchase_price) : '-'} color="gray" loading={loadingTotals} />
        <StatCard label="Acc. Depreciation" value={totals ? idr(totals.total_acc_depreciation) : '-'} color="orange" loading={loadingTotals} />
        <StatCard
          label="NBV Projected"
          value={loadingTotals ? '...' : idr(totals?.combined_net_book_value ?? totals?.total_net_book_value ?? 0)}
          sub={includePlanned && (totals?.planned_net_book_value ?? 0) > 0 ? `+${idrShort(totals.planned_net_book_value)} planned` : undefined}
          color="green"
          loading={loadingTotals}
          highlight={includePlanned && (totals?.planned_net_book_value ?? 0) > 0}
        />
        <StatCard
          label={`Yearly Depr. ${year}`}
          value={loadingTotals ? '...' : idr(totals?.combined_yearly_depreciation ?? totals?.total_yearly_depreciation ?? 0)}
          sub={includePlanned && (totals?.planned_yearly_depreciation ?? 0) > 0 ? `+${idrShort(totals.planned_yearly_depreciation)} planned` : undefined}
          color="blue"
          loading={loadingTotals}
          highlight={includePlanned && (totals?.planned_yearly_depreciation ?? 0) > 0}
        />
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
                {Object.entries(byGroup as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number; planned_yearly?: number; planned_count?: number}>).map(([group, d], idx) => (
                  <tr key={group} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 font-medium">{group}</td>
                    <td className="px-3 py-2 text-right">{d.count}{includePlanned && (d.planned_count ?? 0) > 0 && <span className="text-green-600 text-[10px] ml-1">+{d.planned_count}</span>}</td>
                    <td className="px-3 py-2 text-right">{idr(d.purchase_price)}</td>
                    <td className="px-3 py-2 text-right">{idr(d.acc_depreciation)}</td>
                    <td className="px-3 py-2 text-right">{idr(d.net_book_value)}</td>
                    <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50">
                      {idr(d.yearly_depreciation + (includePlanned ? (d.planned_yearly ?? 0) : 0))}
                      {includePlanned && (d.planned_yearly ?? 0) > 0 && <div className="text-green-600 text-[10px] font-normal">+{idrShort(d.planned_yearly ?? 0)} planned</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(() => {
                  const vals = Object.values(byGroup as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number; planned_yearly?: number; planned_count?: number}>)
                  return (
                    <tr className="bg-gray-100 font-bold text-sm border-t-2 border-gray-300">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right">{vals.reduce((s, d) => s + d.count, 0)}{includePlanned && vals.reduce((s, d) => s + (d.planned_count ?? 0), 0) > 0 && <span className="text-green-600 text-[10px] ml-1">+{vals.reduce((s, d) => s + (d.planned_count ?? 0), 0)}</span>}</td>
                      <td className="px-3 py-2 text-right">{idr(vals.reduce((s, d) => s + d.purchase_price, 0))}</td>
                      <td className="px-3 py-2 text-right">{idr(vals.reduce((s, d) => s + d.acc_depreciation, 0))}</td>
                      <td className="px-3 py-2 text-right">{idr(vals.reduce((s, d) => s + d.net_book_value, 0))}</td>
                      <td className="px-3 py-2 text-right bg-blue-100">{idr(vals.reduce((s, d) => s + d.yearly_depreciation + (includePlanned ? (d.planned_yearly ?? 0) : 0), 0))}</td>
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
                  const entries = Object.entries(byCategory as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number; planned_yearly?: number; planned_count?: number}>)
                  const totalYearly = entries.reduce((s, [, d]) => s + d.yearly_depreciation + (includePlanned ? (d.planned_yearly ?? 0) : 0), 0)
                  return entries.map(([cat, d], idx) => {
                    const combined = d.yearly_depreciation + (includePlanned ? (d.planned_yearly ?? 0) : 0)
                    const pct = totalYearly > 0 ? (combined / totalYearly * 100) : 0
                    return (
                      <tr key={cat} className={idx % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                        <td className="px-3 py-2 font-medium"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />{cat}</span></td>
                        <td className="px-3 py-2 text-right">{d.count}{includePlanned && (d.planned_count ?? 0) > 0 && <span className="text-green-600 text-[10px] ml-1">+{d.planned_count}</span>}</td>
                        <td className="px-3 py-2 text-right">{idr(d.purchase_price)}</td>
                        <td className="px-3 py-2 text-right">{idr(d.acc_depreciation)}</td>
                        <td className="px-3 py-2 text-right">{idr(d.net_book_value)}</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-700 bg-blue-50">
                          {idr(combined)}
                          {includePlanned && (d.planned_yearly ?? 0) > 0 && <div className="text-green-600 text-[10px] font-normal">+{idrShort(d.planned_yearly ?? 0)} planned</div>}
                        </td>
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
                  const cats = byCategory as Record<string, {yearly_depreciation: number; purchase_price: number; acc_depreciation: number; net_book_value: number; count: number; planned_yearly?: number; planned_count?: number}>
                  return (
                    <tr className="bg-gray-100 font-bold text-sm border-t-2 border-gray-300">
                      <td className="px-3 py-2">TOTAL</td>
                      <td className="px-3 py-2 text-right">{Object.values(cats).reduce((s, d) => s + d.count, 0)}{includePlanned && Object.values(cats).reduce((s, d) => s + (d.planned_count ?? 0), 0) > 0 && <span className="text-green-600 text-[10px] ml-1">+{Object.values(cats).reduce((s, d) => s + (d.planned_count ?? 0), 0)}</span>}</td>
                      <td className="px-3 py-2 text-right">{idr(Object.values(cats).reduce((s, d) => s + d.purchase_price, 0))}</td>
                      <td className="px-3 py-2 text-right">{idr(Object.values(cats).reduce((s, d) => s + d.acc_depreciation, 0))}</td>
                      <td className="px-3 py-2 text-right">{idr(Object.values(cats).reduce((s, d) => s + d.net_book_value, 0))}</td>
                      <td className="px-3 py-2 text-right bg-blue-100">{idr(Object.values(cats).reduce((s, d) => s + d.yearly_depreciation + (includePlanned ? (d.planned_yearly ?? 0) : 0), 0))}</td>
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

      </>)}
    </div>
  )
}

function idr(v: number | null | undefined) {
  if (v == null) return 'Rp 0'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(v)))
}

function idrShort(v: number | null | undefined) {
  if (v == null || Number(v) === 0) return 'Rp 0'
  const n = Math.round(Number(v))
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M`
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

function idrCell(v: number | null | undefined) {
  if (v == null || Number(v) === 0) return '—'
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(Number(v)))
}

function StatCard({ label, value, sub, color, loading, highlight }: {
  label: string; value: string; sub?: string; color: 'blue' | 'green' | 'orange' | 'gray' | 'slate'; loading?: boolean; highlight?: boolean
}) {
  const colors = {
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    green:  'bg-green-50 border-green-200 text-green-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    gray:   'bg-gray-50 border-gray-200 text-gray-800',
    slate:  'bg-slate-50 border-slate-200 text-slate-800',
  }
  return (
    <div className={`rounded-lg border p-3 ${colors[color]} ${highlight ? 'ring-2 ring-green-400' : ''}`}>
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      {loading ? <div className="h-5 bg-gray-200 animate-pulse rounded w-3/4" /> : <div className="font-bold text-sm leading-tight">{value}</div>}
      {sub && <div className={`text-[10px] mt-1 ${highlight ? 'text-green-600 font-medium' : 'text-gray-400'}`}>{sub}</div>}
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
