import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  createPlannedAsset,
  deletePlannedAsset,
  downloadForecastExcel,
  fetchForecastAssets,
  fetchForecastByGroup,
  fetchForecastMonthly,
  fetchForecastTotals,
  fetchPlannedAssets,
  fetchSiteLocations,
  updatePlannedAsset,
} from '../services/assets'
import ForecastToolbar from '../components/forecast/ForecastToolbar'
import type { ForecastTab } from '../components/forecast/ForecastToolbar'
import KpiStrip from '../components/forecast/KpiStrip'
import YearStrip from '../components/forecast/YearStrip'
import MonthChart from '../components/forecast/MonthChart'
import TopJobs from '../components/forecast/TopJobs'
import AnalysisTable from '../components/forecast/AnalysisTable'
import AssetsGrid from '../components/forecast/AssetsGrid'
import PlannedDrawer from '../components/forecast/PlannedDrawer'
import {
  DIM_LABEL,
  DIM_PARAM,
  MONTHS,
  buildChartRows,
  buildSummaryItems,
  downloadCsv,
  idrCell,
  idrCompact,
  labelOf,
} from '../components/forecast/forecastUtils'
import type { Dim, ForecastAsset, ForecastTotals, MonthlyMap, PlannedAsset, PlannedPayload, SummaryMap } from '../components/forecast/forecastUtils'

const BASE_YEAR = 2026
const DEFAULT_YEAR = 2027

type AnalysisView = 'summary' | 'monthly'

export default function ForecastPage() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [analysisView, setAnalysisView] = useState<AnalysisView>('summary')
  const [drawer, setDrawer] = useState<{ record: PlannedAsset | null } | null>(null)
  const [exporting, setExporting] = useState(false)

  const update = useCallback((patch: Record<string, string | number | null | undefined>) => {
    setParams(previous => {
      const next = new URLSearchParams(previous)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === '') next.delete(key)
        else next.set(key, String(value))
      }
      return next
    }, { replace: true })
  }, [setParams])

  const tab = (params.get('tab') as ForecastTab) || 'overview'
  const site = params.get('site') ?? ''
  const planned = params.get('planned') === '1'
  const dim = (params.get('dim') as Dim) || 'group'
  const search = params.get('q') ?? ''
  const page = Number(params.get('page')) || 1
  const size = Number(params.get('size')) || 100
  const includeExcluded = params.get('excluded') === '1'
  const drill = {
    job: params.get('job') ?? '',
    group: params.get('group') ?? '',
    category: params.get('category') ?? '',
  }

  /* ── Reference data ────────────────────────────────────────────────────── */

  const { data: siteLocations = [] } = useQuery({
    queryKey: ['site-locations', BASE_YEAR],
    queryFn: () => fetchSiteLocations(BASE_YEAR),
    staleTime: 60_000,
  })

  const { data: allPlanned = [] } = useQuery({
    queryKey: ['planned-assets-all'],
    queryFn: () => fetchPlannedAssets(),
    staleTime: 30_000,
  })

  const maxYear = useMemo(() => {
    let max = 2030
    for (const asset of allPlanned as PlannedAsset[]) {
      if (asset.purchase_price && asset.depreciation_period_total) {
        max = Math.max(max, asset.planned_purchase_year + Math.ceil(asset.depreciation_period_total / 12))
      }
    }
    return max
  }, [allPlanned])

  const forecastYears = useMemo(() => {
    const years: number[] = []
    for (let value = DEFAULT_YEAR; value <= maxYear; value += 1) years.push(value)
    return years
  }, [maxYear])

  const yearOptions = useMemo(() => [BASE_YEAR, ...forecastYears], [forecastYears])
  const stripYears = useMemo(() => {
    const years: number[] = []
    for (let value = BASE_YEAR; value <= Math.max(2030, maxYear); value += 1) years.push(value)
    return years
  }, [maxYear])

  const requestedYear = Number(params.get('year'))
  const year = yearOptions.includes(requestedYear) ? requestedYear : DEFAULT_YEAR
  const yearIndex = stripYears.indexOf(year)

  /* ── Totals per year (KPI + trajectory strip) ──────────────────────────── */

  const seriesQueries = useQueries({
    queries: stripYears.map(value => ({
      queryKey: ['forecast-totals', value, site, planned],
      queryFn: () => fetchForecastTotals(value, site || undefined, planned),
      staleTime: 30_000,
    })),
  })

  const totalsByYear = seriesQueries.map(item => item.data as ForecastTotals | undefined)
  const totals = yearIndex >= 0 ? totalsByYear[yearIndex] : undefined
  const previous = yearIndex > 0 ? totalsByYear[yearIndex - 1] : undefined
  const loadingTotals = yearIndex >= 0 ? seriesQueries[yearIndex]?.isPending ?? true : false

  /* ── Monthly matrices ──────────────────────────────────────────────────── */

  const jobMonthly = useQuery({
    queryKey: ['forecast-monthly', year, site, planned, 'job'],
    queryFn: () => fetchForecastMonthly(year, site || undefined, 'job', planned),
    staleTime: 30_000,
  })

  const dimMonthly = useQuery({
    queryKey: ['forecast-monthly', year, site, planned, DIM_PARAM[dim]],
    queryFn: () => fetchForecastMonthly(year, site || undefined, DIM_PARAM[dim], planned),
    enabled: dim !== 'job',
    staleTime: 30_000,
  })

  const jobRows = useMemo(() => buildChartRows(jobMonthly.data as MonthlyMap | undefined, planned), [jobMonthly.data, planned])
  const dimRows = useMemo(() => {
    if (dim === 'job') return jobRows
    return buildChartRows(dimMonthly.data as MonthlyMap | undefined, planned)
  }, [dim, dimMonthly.data, jobRows, planned])

  /* ── Analysis summary ──────────────────────────────────────────────────── */

  const summaryQuery = useQuery({
    queryKey: ['forecast-summary', year, site, planned, DIM_PARAM[dim]],
    queryFn: () => fetchForecastByGroup(year, site || undefined, planned, DIM_PARAM[dim]),
    enabled: tab === 'analysis',
    staleTime: 30_000,
  })
  const summary = summaryQuery.data as SummaryMap | undefined

  /* ── Asset grid ────────────────────────────────────────────────────────── */

  const assetsQuery = useQuery({
    queryKey: ['forecast-assets', year, site, drill.job, drill.group, drill.category, search, page, size, planned, includeExcluded],
    queryFn: () => fetchForecastAssets(year, {
      site_location: site || undefined,
      job: drill.job || undefined,
      group_name: drill.group || undefined,
      category: drill.category || undefined,
      search: search || undefined,
      page,
      size,
      include_planned: planned,
      include_excluded: includeExcluded,
    }),
    enabled: tab === 'assets',
    staleTime: 15_000,
  })

  /* ── Planned assets ────────────────────────────────────────────────────── */

  const plannedQuery = useQuery({
    queryKey: ['planned-assets', year, site],
    queryFn: () => fetchPlannedAssets(year, site || undefined),
    staleTime: 15_000,
  })
  const plannedRows = plannedQuery.data as PlannedAsset[] | undefined
  const plannedCount = plannedRows?.length ?? 0

  // "Include planned" only means something when the selected year/site actually
  // has planned assets. Switching to a year without any used to leave the switch
  // visibly on while changing nothing, so the flag is dropped instead.
  useEffect(() => {
    if (!planned || !plannedQuery.isSuccess || plannedCount > 0) return
    update({ planned: null })
  }, [planned, plannedQuery.isSuccess, plannedCount, update])

  const invalidate = () => {
    qc.invalidateQueries({
      predicate: query => {
        const root = String(query.queryKey[0])
        return root.startsWith('forecast') || root.startsWith('planned')
      },
    })
  }

  const createMut = useMutation({
    mutationFn: createPlannedAsset,
    onSuccess: () => { invalidate(); setDrawer(null) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof updatePlannedAsset>[1] }) =>
      updatePlannedAsset(id, payload),
    onSuccess: () => { invalidate(); setDrawer(null) },
  })
  const deleteMut = useMutation({
    mutationFn: deletePlannedAsset,
    onSuccess: invalidate,
  })

  /* ── Derived UI state ──────────────────────────────────────────────────── */

  const totalYearly = useMemo(() => dimRows.reduce((sum, row) => sum + row.total, 0), [dimRows])
  const chips = useMemo(() => {
    const list: { key: 'job' | 'group' | 'category'; label: string; value: string }[] = []
    if (drill.job) list.push({ key: 'job', label: 'Job', value: drill.job })
    if (drill.group) list.push({ key: 'group', label: 'Group', value: drill.group })
    if (drill.category) list.push({ key: 'category', label: 'Category', value: drill.category })
    return list
  }, [drill.category, drill.group, drill.job])

  const drillTo = (target: Dim, key: string) => {
    update({
      tab: 'assets',
      job: target === 'job' ? key : null,
      group: target === 'group' ? key : null,
      category: target === 'category' ? key : null,
      page: 1,
    })
  }

  const exportExcel = () => {
    setExporting(true)
    try {
      downloadForecastExcel(year, site || undefined)
    } finally {
      window.setTimeout(() => setExporting(false), 800)
    }
  }

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10)

    if (tab === 'planned') {
      downloadCsv(
        `planned_assets_${year}_${stamp}.csv`,
        ['Name', 'Group', 'Category', 'Site', 'Job', 'Purchase price', 'Period (months)', 'Monthly depreciation', 'Purchase month', 'Purchase year'],
        (plannedRows ?? []).map(asset => [
          asset.name,
          asset.group_name,
          asset.category,
          asset.site_location,
          asset.job,
          asset.purchase_price,
          asset.depreciation_period_total,
          asset.purchase_price && asset.depreciation_period_total
            ? Number(asset.purchase_price) / Number(asset.depreciation_period_total)
            : null,
          asset.planned_purchase_month,
          asset.planned_purchase_year,
        ]),
      )
      return
    }

    if (tab === 'assets') {
      const items: ForecastAsset[] = assetsQuery.data?.items ?? []
      downloadCsv(
        `forecast_assets_${year}_${stamp}.csv`,
        ['AX no', 'Name', 'Group', 'Category', 'Site', 'Job', 'Purchase price', 'Period', 'Remain', ...MONTHS, 'Total / year', 'NBV'],
        items.map(asset => [
          asset.fixed_asset_number_ax,
          asset.name,
          asset.group_name,
          asset.category,
          asset.site_location,
          asset.job,
          asset.purchase_price,
          asset.depreciation_period_total,
          asset.dep_period_remain,
          ...MONTHS.map(month => asset.months[month.toLowerCase()] ?? 0),
          asset.dep_expense_current,
          asset.nbv_curr,
        ]),
      )
      return
    }

    if (tab === 'analysis' && analysisView === 'summary') {
      const items = buildSummaryItems(summary)
      downloadCsv(
        `forecast_by_${dim}_${year}_${stamp}.csv`,
        [DIM_LABEL[dim], 'Assets', 'Purchase price', 'Acc. depreciation', 'NBV', 'Yearly depreciation'],
        items.map(item => [item.key, item.count, item.purchase, item.acc, item.nbv, item.yearly]),
      )
      return
    }

    downloadCsv(
      `forecast_monthly_${dim}_${year}_${stamp}.csv`,
      [DIM_LABEL[dim], ...MONTHS, 'Total'],
      dimRows.map(row => [row.key, ...row.months, row.total]),
    )
  }

  const csvEnabled = tab === 'planned'
    ? Boolean(plannedRows?.length)
    : tab === 'assets'
      ? Boolean(assetsQuery.data?.items.length)
      : dimRows.length > 0

  const tabContent = (() => {
    if (tab === 'analysis') {
      return (
        <AnalysisTable
          dim={dim}
          onDim={value => update({ dim: value })}
          view={analysisView}
          onView={setAnalysisView}
          summary={summary}
          monthly={dimRows}
          loading={summaryQuery.isPending || (dim !== 'job' && dimMonthly.isPending)}
          year={year}
          onDrill={drillTo}
        />
      )
    }

    if (tab === 'assets') {
      return (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {chips.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <span className="text-[10.5px] text-slate-500">Filtered by</span>
              {chips.map(chip => (
                <span key={chip.key} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-1.5 py-[2px] text-[10.5px] text-slate-700">
                  <span className="text-slate-400">{chip.label}</span>
                  <span className="font-medium">{labelOf(chip.value)}</span>
                  <button
                    type="button"
                    onClick={() => update({ [chip.key]: null, page: 1 })}
                    aria-label={`Remove ${chip.label} filter`}
                    className="ml-0.5 text-slate-400 hover:text-slate-700"
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => update({ job: null, group: null, category: null, page: 1 })}
                className="text-[10.5px] text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
          <AssetsGrid
            data={assetsQuery.data}
            loading={assetsQuery.isPending}
            page={page}
            size={size}
            onPage={value => update({ page: value })}
            onSize={value => update({ size: value, page: 1 })}
            search={search}
            onSearch={value => update({ q: value, page: 1 })}
            includeExcluded={includeExcluded}
            onIncludeExcluded={value => update({ excluded: value ? '1' : null, page: 1 })}
            excludedCount={totals?.excluded_assets ?? 0}
            excludedReasons={totals?.excluded_reasons}
          />
        </div>
      )
    }

    if (tab === 'planned') {
      const rows = plannedRows ?? []
      const totalPrice = rows.reduce((sum, asset) => sum + Number(asset.purchase_price ?? 0), 0)
      const totalMonthly = rows.reduce((sum, asset) => (
        sum + (asset.purchase_price && asset.depreciation_period_total
          ? Number(asset.purchase_price) / Number(asset.depreciation_period_total)
          : 0)
      ), 0)

      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <div>
              <h2 className="text-[12px] font-semibold text-slate-800">Planned assets · {year}</h2>
              <p className="text-[10.5px] text-slate-500">Assets expected to be purchased in this forecast year</p>
            </div>
            <button
              type="button"
              onClick={() => setDrawer({ record: null })}
              className="rounded bg-slate-800 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition-colors hover:bg-slate-900"
            >
              + Add planned asset
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto fx-scroll">
            <table className="w-full text-left text-[11.5px]">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-3 py-1.5 font-semibold" scope="col">Name</th>
                  <th className="px-2 py-1.5 font-semibold" scope="col">Group / Category</th>
                  <th className="px-2 py-1.5 font-semibold" scope="col">Site / Job</th>
                  <th className="px-2 py-1.5 text-right font-semibold" scope="col">Purchase</th>
                  <th className="px-2 py-1.5 text-right font-semibold" scope="col">Period</th>
                  <th className="px-2 py-1.5 text-right font-semibold" scope="col">Monthly dep.</th>
                  <th className="px-2 py-1.5 font-semibold" scope="col">Starts</th>
                  <th className="px-2 py-1.5" scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {plannedQuery.isPending && Array.from({ length: 4 }).map((_, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td colSpan={8} className="px-3 py-2"><div className="h-4 animate-pulse rounded bg-slate-100" /></td>
                  </tr>
                ))}

                {!plannedQuery.isPending && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-12 text-center">
                      <p className="text-[12px] font-medium text-slate-600">No planned assets for {year}</p>
                      <p className="mt-1 text-[11px] text-slate-400">Add one to see its effect on the forecast.</p>
                    </td>
                  </tr>
                )}

                {!plannedQuery.isPending && rows.map(asset => {
                  const monthly = asset.purchase_price && asset.depreciation_period_total
                    ? Number(asset.purchase_price) / Number(asset.depreciation_period_total)
                    : 0
                  return (
                    <tr
                      key={asset.id}
                      onClick={() => setDrawer({ record: asset })}
                      className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-amber-50/60"
                    >
                      <td className="px-3 py-[6px] font-medium text-slate-800">{asset.name}</td>
                      <td className="px-2 py-[6px] text-slate-600">
                        {[asset.group_name, asset.category].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-2 py-[6px] text-slate-600">
                        {[asset.site_location, asset.job].filter(Boolean).join(' / ') || '—'}
                      </td>
                      <td className="px-2 py-[6px] text-right tabular text-slate-700">{idrCell(asset.purchase_price)}</td>
                      <td className="px-2 py-[6px] text-right tabular text-slate-600">
                        {asset.depreciation_period_total ? `${asset.depreciation_period_total} mo` : '—'}
                      </td>
                      <td className="px-2 py-[6px] text-right tabular font-semibold text-emerald-700">{idrCell(monthly)}</td>
                      <td className="px-2 py-[6px] text-slate-600">
                        {MONTHS[asset.planned_purchase_month - 1]} {asset.planned_purchase_year}
                      </td>
                      <td className="px-2 py-[6px] text-right" onClick={event => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDrawer({ record: asset })}
                            aria-label={`Edit ${asset.name}`}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                              <path d="M11.5 2.5l2 2L6 12l-2.5.5L4 10l7.5-7.5z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => { if (confirm(`Delete "${asset.name}"?`)) deleteMut.mutate(asset.id) }}
                            aria-label={`Delete ${asset.name}`}
                            className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                          >
                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                              <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {rows.length > 0 && (
                <tfoot className="sticky bottom-0">
                  <tr className="border-t border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-800">
                    <td className="px-3 py-1.5" colSpan={3}>TOTAL · {rows.length} planned</td>
                    <td className="px-2 py-1.5 text-right tabular">{idrCell(totalPrice)}</td>
                    <td className="px-2 py-1.5" />
                    <td className="px-2 py-1.5 text-right tabular text-emerald-700">{idrCell(totalMonthly)}</td>
                    <td className="px-2 py-1.5" colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto fx-scroll pr-0.5">
        <KpiStrip totals={totals} previous={previous} site={site} loading={loadingTotals} />
        <YearStrip years={stripYears} totals={totalsByYear} selected={year} onSelect={value => update({ year: value })} />
        <div className="grid min-h-[250px] gap-2 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
          <MonthChart
            rows={dimRows}
            dim={dim}
            year={year}
            onDrill={drillTo}
            onDim={value => update({ dim: value })}
          />
          <TopJobs rows={jobRows} total={jobRows.reduce((sum, row) => sum + row.total, 0)} onDrill={key => drillTo('job', key)} />
        </div>
      </div>
    )
  })()

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Planning</p>
          <h1 className="mt-0.5 truncate text-[19px] font-semibold leading-tight text-slate-900">Depreciation Forecast</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-slate-500">
            <span>PT. Sankyu Indonesia International</span>
            <span className="text-slate-300">·</span>
            <span className="tabular font-medium text-slate-700">
              {totals ? totals.forecasted_assets.toLocaleString('id-ID') : '—'}
            </span>
            <span>assets</span>
            <span className="text-slate-300">·</span>
            <span>Year {year}</span>
            {site && <><span className="text-slate-300">·</span><span>{site}</span></>}
            {planned && <><span className="text-slate-300">·</span><span className="text-emerald-700">incl. planned</span></>}
            <span className="text-slate-300">·</span>
            <span>{idrCompact(totalYearly)} yearly depreciation</span>
          </p>
        </div>
      </div>

      <ForecastToolbar
        tab={tab}
        onTab={value => update({ tab: value })}
        plannedCount={plannedCount}
        year={year}
        years={yearOptions}
        onYear={value => update({ year: value, page: 1 })}
        site={site}
        sites={siteLocations as { site_location: string; count: number }[]}
        onSite={value => update({ site: value, page: 1 })}
        planned={planned}
        onPlanned={value => update({ planned: value ? '1' : null })}
        onExportExcel={exportExcel}
        onExportCsv={exportCsv}
        csvEnabled={csvEnabled}
        exporting={exporting}
      />

      {tabContent}

      <PlannedDrawer
        open={drawer !== null}
        record={drawer?.record ?? null}
        year={year}
        defaultSite={site}
        purchaseYears={forecastYears}
        sites={siteLocations as { site_location: string; count: number }[]}
        saving={createMut.isPending || updateMut.isPending}
        onClose={() => setDrawer(null)}
        onSubmit={(payload: PlannedPayload) => {
          if (drawer?.record) updateMut.mutate({ id: drawer.record.id, payload })
          else createMut.mutate(payload)
        }}
      />
    </div>
  )
}