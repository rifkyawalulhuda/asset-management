import type { DashTab } from './dashUtils'
import { DASH_TABS } from './dashUtils'

export default function DashboardToolbar({
  tab,
  onTab,
  year,
  years,
  onYear,
  site,
  sites,
  onSite,
  onExport,
  exportEnabled,
}: {
  tab: DashTab
  onTab: (tab: DashTab) => void
  year: number
  years: number[]
  onYear: (year: number) => void
  site: string
  sites: { site_location: string; count: number }[]
  onSite: (site: string) => void
  onExport: () => void
  exportEnabled: boolean
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
      <div className="flex rounded border border-slate-300 p-[1px]" role="tablist" aria-label="Dashboard sections">
        {DASH_TABS.map(item => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => onTab(item.key)}
            className={`rounded px-2.5 py-[4px] text-[11px] font-semibold transition-colors ${
              tab === item.key ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {item.label}
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
          className="h-7 max-w-[130px] rounded border border-slate-300 bg-white px-1.5 text-[11.5px] text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
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

      <span className="ml-auto" />

      <button
        type="button"
        onClick={onExport}
        disabled={!exportEnabled}
        className="inline-flex h-7 items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Export
        <span className="text-[10px] font-normal text-slate-400">.csv</span>
      </button>
    </div>
  )
}
