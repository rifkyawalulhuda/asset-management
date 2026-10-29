import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery } from '@tanstack/react-query'
import {
  fetchAcquisitions,
  fetchForecastTotals,
  fetchSiteLocations,
  fetchSummaryByDim,
  fetchSummaryMonthly,
  fetchSummaryTotals,
  fetchSummaryYears,
} from '../services/assets'
import DashboardToolbar from '../components/dashboard/DashboardToolbar'
import KpiBand from '../components/dashboard/KpiBand'
import Composition from '../components/dashboard/Composition'
import MovementStrip from '../components/dashboard/MovementStrip'
import Outlook from '../components/dashboard/Outlook'
import SitesTable from '../components/dashboard/SitesTable'
import type { DashTab, DashTotals, SiteMap } from '../components/dashboard/dashUtils'
import { movementOf } from '../components/dashboard/dashUtils'
import MonthChart from '../components/forecast/MonthChart'
import AnalysisTable from '../components/forecast/AnalysisTable'
import {
  DIM_LABEL,
  DIM_PARAM,
  MONTHS,
  buildChartRows,
} from '../components/forecast/forecastUtils'
import type { Dim, ForecastTotals, MonthlyMap, SummaryMap } from '../components/forecast/forecastUtils'
import { downloadCsv, idrCompact, idrFull } from '../utils/currency'
import type { AcquisitionDisposal } from '../types'

const FALLBACK_YEAR = 2026

type MatrixView = 'summary' | 'monthly'

export default function Dashboard() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [matrixView, setMatrixView] = useState<MatrixView>('monthly')

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

  /* ── Reference data ────────────────────────────────────────────────────── */

  const { data: years = [] } = useQuery({
    queryKey: ['summary-years'],
    queryFn: fetchSummaryYears,
    staleTime: 300_000,
  })
  const ready = years.length > 0

  // Newest fiscal year that actually holds assets, so the page opens on
  // current data instead of a hardcoded year that may have been rolled over.
  const requestedYear = Number(params.get('year'))
  const year = years.includes(requestedYear) ? requestedYear : (years[0] ?? FALLBACK_YEAR)
  const previousYear = year - 1
  const hasPrevious = years.includes(previousYear)

  const tab = (params.get('tab') as DashTab) || 'overview'
  const site = params.get('site') ?? ''
  const dim = (params.get('dim') as Dim) || 'group'

  const { data: siteLocations = [] } = useQuery({
    queryKey: ['site-locations', year],
    queryFn: () => fetchSiteLocations(year),
    enabled: ready,
    staleTime: 60_000,
  })

  // A site that has no assets in the selected year would silently zero out every
  // figure, so the filter is dropped instead of being left pointing at nothing.
  useEffect(() => {
    if (!site) return
    const options = siteLocations as { site_location: string }[]
    if (options.length === 0) return
    if (!options.some(item => item.site_location === site)) update({ site: null })
  }, [site, siteLocations, update])

  /* ── Totals (current + previous year) ──────────────────────────────────── */

  const totalsQuery = useQuery({
    queryKey: ['summary-totals', year, site],
    queryFn: () => fetchSummaryTotals(year, site || undefined),
    enabled: ready,
  })

  const previousQuery = useQuery({
    queryKey: ['summary-totals', previousYear, site],
    queryFn: () => fetchSummaryTotals(previousYear, site || undefined),
    enabled: ready && hasPrevious,
  })

  const totals = totalsQuery.data as DashTotals | undefined
  const previous = previousQuery.data as DashTotals | undefined

  /* ── Movement (acquisitions / disposals) ───────────────────────────────── */

  const movementQuery = useQuery({
    queryKey: ['acquisitions', year],
    queryFn: () => fetchAcquisitions({ year_ref: year }),
    enabled: ready,
    staleTime: 30_000,
  })
  const movement = useMemo(
    () => (movementQuery.data ? movementOf(movementQuery.data as AcquisitionDisposal[]) : undefined),
    [movementQuery.data],
  )

  /* ── Chart + composition (one dimension at a time) ─────────────────────── */

  const monthlyQuery = useQuery({
    queryKey: ['summary-monthly', year, site, DIM_PARAM[dim]],
    queryFn: () => fetchSummaryMonthly(year, site || undefined, DIM_PARAM[dim]),
    enabled: ready,
  })
  const chartRows = useMemo(
    () => buildChartRows(monthlyQuery.data as MonthlyMap | undefined, false),
    [monthlyQuery.data],
  )

  const dimSummaryQuery = useQuery({
    queryKey: ['summary-dim', year, site, DIM_PARAM[dim]],
    queryFn: () => fetchSummaryByDim(year, DIM_PARAM[dim], site || undefined),
    enabled: ready,
  })
  const dimSummary = dimSummaryQuery.data as SummaryMap | undefined

  const compositionRows = useMemo(
    () => Object.entries(dimSummary ?? {}).map(([key, bucket]) => ({ key, total: bucket.yearly_depreciation })),
    [dimSummary],
  )

  /* ── Sites tab ─────────────────────────────────────────────────────────── */

  const sitesQuery = useQuery({
    queryKey: ['summary-dim', year, 'site_location'],
    queryFn: () => fetchSummaryByDim(year, 'site_location'),
    enabled: ready && tab === 'sites',
  })

  /* ── Outlook (next three forecast years) ───────────────────────────────── */

  const outlookYears = useMemo(() => [year + 1, year + 2, year + 3], [year])
  const outlookQueries = useQueries({
    queries: outlookYears.map(value => ({
      queryKey: ['forecast-totals', value, site],
      queryFn: () => fetchForecastTotals(value, site || undefined),
      enabled: ready && tab === 'overview',
      staleTime: 60_000,
    })),
  })
  const outlookTotals = outlookQueries.map(item => item.data as ForecastTotals | undefined)
  const outlookLoading = outlookQueries.some(item => item.isPending)

  /* ── Drill-down ────────────────────────────────────────────────────────── */

  const openAssets = useCallback((filters: Record<string, string>) => {
    const search = new URLSearchParams({ year_ref: String(year) })
    if (site) search.set('site_location', site)
    for (const [key, value] of Object.entries(filters)) search.set(key, value)
    navigate(`/assets?${search.toString()}`)
  }, [navigate, site, year])

  const drillDimension = useCallback((target: Dim, key: string) => {
    // "UNKNOWN" is passed through as-is: the API maps it to a NULL lookup, so the
    // Unassigned bucket opens the assets that have no value in that dimension.
    openAssets({ [DIM_PARAM[target]]: key })
  }, [openAssets])

  /* ── Export ────────────────────────────────────────────────────────────── */

  const stamp = new Date().toISOString().slice(0, 10)

  const exportCurrent = () => {
    if (tab === 'sites') {
      const rows = Object.entries((sitesQuery.data ?? {}) as SiteMap)
      downloadCsv(
        `sites_${year}_${stamp}.csv`,
        ['Site', 'Assets', 'Purchase price', 'Acc. depreciation', 'Net book value', 'Yearly depreciation'],
        rows.map(([key, bucket]) => [
          key, bucket.count, bucket.purchase_price, bucket.acc_depreciation, bucket.net_book_value, bucket.yearly_depreciation,
        ]),
      )
      return
    }

    if (tab === 'breakdown') {
      if (matrixView === 'summary') {
        const rows = Object.entries(dimSummary ?? {})
        downloadCsv(
          `summary_by_${DIM_PARAM[dim]}_${year}_${stamp}.csv`,
          [DIM_LABEL[dim], 'Assets', 'Purchase price', 'Acc. depreciation', 'Net book value', 'Yearly depreciation'],
          rows.map(([key, bucket]) => [
            key, bucket.count, bucket.purchase_price, bucket.acc_depreciation, bucket.net_book_value, bucket.yearly_depreciation,
          ]),
        )
        return
      }
      downloadCsv(
        `monthly_by_${DIM_PARAM[dim]}_${year}_${stamp}.csv`,
        [DIM_LABEL[dim], ...MONTHS, 'Total'],
        chartRows.map(row => [row.key, ...row.months, row.total]),
      )
      return
    }

    downloadCsv(
      `dashboard_${year}_${stamp}.csv`,
      [DIM_LABEL[dim], 'Yearly depreciation', 'Share'],
      chartRows.map(row => {
        const total = chartRows.reduce((sum, item) => sum + item.total, 0)
        return [row.key, row.total, total > 0 ? ((row.total / total) * 100).toFixed(1) : '0']
      }),
    )
  }

  const exportEnabled = tab === 'sites'
    ? Boolean(Object.keys((sitesQuery.data ?? {}) as SiteMap).length)
    : chartRows.length > 0

  /* ── Content ───────────────────────────────────────────────────────────── */

  const content = (() => {
    if (tab === 'breakdown') {
      return (
        <AnalysisTable
          dim={dim}
          onDim={value => update({ dim: value })}
          view={matrixView}
          onView={setMatrixView}
          summary={dimSummary}
          monthly={chartRows}
          loading={dimSummaryQuery.isPending || monthlyQuery.isPending}
          year={year}
          onDrill={drillDimension}
        />
      )
    }

    if (tab === 'sites') {
      return (
        <SitesTable
          data={sitesQuery.data as SiteMap | undefined}
          loading={sitesQuery.isPending}
          year={year}
          onDrill={value => openAssets({ site_location: value })}
        />
      )
    }

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto fx-scroll pr-0.5">
        <KpiBand
          totals={totals}
          previous={previous}
          previousYear={previousYear}
          movement={movement}
          site={site}
          loading={totalsQuery.isPending}
        />

        <div className="grid min-h-[250px] gap-2 xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
          <MonthChart
            rows={chartRows}
            dim={dim}
            year={year}
            onDrill={drillDimension}
            onDim={value => update({ dim: value })}
          />
          <Composition
            rows={compositionRows}
            label={DIM_LABEL[dim]}
            onDrill={key => drillDimension(dim, key)}
          />
        </div>

        <div className="grid gap-2 xl:grid-cols-2">
          <MovementStrip movement={movement} year={year} loading={movementQuery.isPending} />
          <Outlook years={outlookYears} totals={outlookTotals} loading={outlookLoading} />
        </div>
      </div>
    )
  })()

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Reporting</p>
          <h1 className="mt-0.5 truncate text-[19px] font-semibold leading-tight text-slate-900">Depreciation Dashboard</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-slate-500">
            <span>PT. Sankyu Indonesia International</span>
            <span className="text-slate-300">·</span>
            <span className="tabular font-medium text-slate-700">
              {totals ? totals.total_assets.toLocaleString('id-ID') : '—'}
            </span>
            <span>assets</span>
            <span className="text-slate-300">·</span>
            <span>Year {year}</span>
            {site && <><span className="text-slate-300">·</span><span>{site}</span></>}
            <span className="text-slate-300">·</span>
            <span title={totals ? idrFull(totals.total_yearly_depreciation) : undefined}>
              {totals ? idrCompact(totals.total_yearly_depreciation) : '—'} yearly depreciation
            </span>
          </p>
        </div>
      </div>

      <DashboardToolbar
        tab={tab}
        onTab={value => update({ tab: value })}
        year={year}
        years={years.length ? years : [year]}
        onYear={value => update({ year: value })}
        site={site}
        sites={siteLocations as { site_location: string; count: number }[]}
        onSite={value => update({ site: value })}
        onExport={exportCurrent}
        exportEnabled={exportEnabled}
      />

      {content}
    </div>
  )
}
