import Popover from '../table/Popover'

export type ForecastTab = 'overview' | 'analysis' | 'assets' | 'planned'

const TABS: { key: ForecastTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'assets', label: 'Assets' },
  { key: 'planned', label: 'Planned' },
]

export default function ForecastToolbar({
  tab,
  onTab,
  plannedCount,
  year,
  years,
  onYear,
  site,
  sites,
  onSite,
  planned,
  onPlanned,
  onExportExcel,
  onExportCsv,
  csvEnabled,
  exporting,
}: {
  tab: ForecastTab
  onTab: (tab: ForecastTab) => void
  plannedCount: number
  year: number
  years: number[]
  onYear: (year: number) => void
  site: string
  sites: { site_location: string; count: number }[]
  onSite: (site: string) => void
  planned: boolean
  onPlanned: (value: boolean) => void
  onExportExcel: () => void
  onExportCsv: () => void
  csvEnabled: boolean
  exporting: boolean
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
      <div className="flex rounded border border-slate-300 p-[1px]" role="tablist" aria-label="Forecast sections">
        {TABS.map(item => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => onTab(item.key)}
            className={`inline-flex items-center gap-1.5 rounded px-2.5 py-[4px] text-[11px] font-semibold transition-colors ${
              tab === item.key ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {item.label}
            {item.key === 'planned' && plannedCount > 0 && (
              <span className={`tabular rounded-full px-1 text-[9.5px] ${tab === item.key ? 'bg-white/20' : 'bg-slate-200 text-slate-600'}`}>
                {plannedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <span className="mx-1 h-5 w-px bg-slate-200" />

      <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
        Year
        <select
          value={year}
          onChange={event => onYear(Number(event.target.value))}
          className="h-7 rounded border border-slate-300 bg-white px-1.5 text-[11.5px] font-medium text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          {years.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>

      <label className="inline-flex items-center gap-1 text-[10.5px] font-medium text-slate-500">
        Site
        <select
          value={site}
          onChange={event => onSite(event.target.value)}
          className="h-7 max-w-[120px] rounded border border-slate-300 bg-white px-1.5 text-[11.5px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          <option value="">All sites</option>
          {sites.map(item => (
            <option key={item.site_location} value={item.site_location}>
              {item.site_location} ({item.count})
            </option>
          ))}
        </select>
      </label>

      {site && (
        <button
          type="button"
          onClick={() => onSite('')}
          className="h-7 rounded px-1.5 text-[10.5px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        >
          Clear site
        </button>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={planned}
        aria-label="Include planned assets in the forecast"
        disabled={plannedCount === 0}
        onClick={() => onPlanned(!planned)}
        title={
          plannedCount === 0
            ? 'No planned assets for this year and site'
            : planned
              ? 'Exclude planned assets'
              : `Include ${plannedCount} planned asset${plannedCount === 1 ? '' : 's'}`
        }
        className={`inline-flex h-7 items-center gap-2 rounded border px-2 text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-50 ${
          planned
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-4 w-7 shrink-0 items-center rounded-full p-[2px] transition-colors motion-reduce:transition-none ${
            planned ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out motion-reduce:transition-none ${
              planned ? 'translate-x-3' : 'translate-x-0'
            }`}
          />
        </span>
        <span>Include planned</span>
        {plannedCount > 0 && (
          <span
            className={`tabular rounded-full px-1 text-[9.5px] font-semibold ${
              planned ? 'bg-emerald-600/15 text-emerald-800' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {plannedCount}
          </span>
        )}
      </button>

      <span className="ml-auto" />

      <Popover
        width={224}
        align="right"
        trigger={({ ref, toggle, open }) => (
          <button
            ref={ref}
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="menu"
            disabled={exporting}
            className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting ? 'Preparing…' : 'Export'}
            <svg viewBox="0 0 10 10" aria-hidden="true" className="h-2 w-2 text-slate-400">
              <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      >
        {({ close }) => (
          <div className="p-1">
            <button
              type="button"
              onClick={() => { onExportExcel(); close() }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11.5px] text-slate-700 hover:bg-slate-100"
            >
              <span className="font-medium">Forecast workbook</span>
              <span className="ml-auto text-[10px] text-slate-400">.xlsx</span>
            </button>
            <button
              type="button"
              onClick={() => { onExportCsv(); close() }}
              disabled={!csvEnabled}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11.5px] text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="font-medium">Current view</span>
              <span className="ml-auto text-[10px] text-slate-400">.csv</span>
            </button>
          </div>
        )}
      </Popover>
    </div>
  )
}