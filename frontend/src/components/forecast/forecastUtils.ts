export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

export type Dim = 'job' | 'group' | 'category'

export const DIMS: Dim[] = ['job', 'group', 'category']

export const DIM_LABEL: Record<Dim, string> = {
  job: 'Job',
  group: 'Asset group',
  category: 'Category',
}

/** Assets with no value in the chosen dimension are bucketed as UNKNOWN. */
export const labelOf = (key: string): string => (key.toUpperCase() === 'UNKNOWN' ? 'Unassigned' : key)

/** Dimension value used by the backend `group_by` parameter. */
export const DIM_PARAM: Record<Dim, 'job' | 'group_name' | 'category'> = {
  job: 'job',
  group: 'group_name',
  category: 'category',
}

/** Dimension value used by the `/forecast/assets` filter parameter. */
export const ASSET_FILTER: Record<Dim, 'job' | 'group_name' | 'category'> = DIM_PARAM

export const PALETTE = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#65a30d']
export const OTHER_KEY = 'Other'
export const OTHER_COLOR = '#94a3b8'

export interface PlannedAsset {
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

export interface ForecastTotals {
  forecast_year: number
  total_assets: number
  excluded_assets: number
  excluded_missing_data: number
  excluded_non_depreciable: number
  forecasted_assets: number
  total_purchase_price: number
  total_yearly_depreciation: number
  total_acc_depreciation: number
  total_net_book_value: number
  planned_count: number
  planned_yearly_depreciation: number
  planned_net_book_value: number
  combined_yearly_depreciation: number
  combined_net_book_value: number
}

export interface SummaryBucket {
  yearly_depreciation: number
  purchase_price: number
  acc_depreciation: number
  net_book_value: number
  count: number
  planned_yearly?: number
  planned_count?: number
  planned_purchase_price?: number
  planned_acc_depreciation?: number
  planned_net_book_value?: number
}

export type SummaryMap = Record<string, SummaryBucket>

export interface MonthlyRow {
  total: number
  planned_total?: number
  planned?: Record<string, number>
  [month: string]: number | Record<string, number> | undefined
}

export type MonthlyMap = Record<string, MonthlyRow>

export type PlannedPayload = {
  forecast_year: number
  name: string
  group_name?: string
  category?: string
  site_location?: string
  job?: string
  purchase_price?: number
  depreciation_period_total?: number
  planned_purchase_month: number
  planned_purchase_year: number
}

export interface ForecastAsset {
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
  excluded?: boolean
  excluded_reason?: 'non_depreciable' | 'missing_data'
  is_planned?: boolean
}

export interface ForecastAssetsResponse {
  forecast_year: number
  total: number
  page: number
  size: number
  items: ForecastAsset[]
}

/* ── Formatting ──────────────────────────────────────────────────────────── */

export const idrFull = (value: number | null | undefined): string => {
  if (value == null) return 'Rp 0'
  return 'Rp ' + Math.round(Number(value)).toLocaleString('id-ID')
}

export const idrCompact = (value: number | null | undefined): string => {
  const amount = Number(value ?? 0)
  if (!amount) return 'Rp 0'
  const sign = amount < 0 ? '-' : ''
  const n = Math.abs(amount)
  const trim = (x: number) => x.toLocaleString('id-ID', { maximumFractionDigits: x >= 100 ? 0 : 1 })
  if (n >= 1e12) return `${sign}Rp ${trim(n / 1e12)} T`
  if (n >= 1e9) return `${sign}Rp ${trim(n / 1e9)} M`
  if (n >= 1e6) return `${sign}Rp ${trim(n / 1e6)} jt`
  if (n >= 1e3) return `${sign}Rp ${trim(n / 1e3)} rb`
  return `${sign}Rp ${trim(n)}`
}

export const idrCell = (value: number | null | undefined): string => {
  if (value == null || Number(value) === 0) return '—'
  return idrFull(value)
}

export const pct = (value: number, total: number): number => (total > 0 ? (value / total) * 100 : 0)

export const deltaPct = (current: number, previous: number): number | null => {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

export const monthSeries = (row: MonthlyRow | undefined, includePlanned: boolean): number[] =>
  MONTH_KEYS.map(key => {
    const base = Number((row?.[key] as number) ?? 0)
    if (!includePlanned) return base
    const planned = (row?.planned as Record<string, number> | undefined)?.[key] ?? 0
    return base + planned
  })

export const rowTotal = (months: number[]): number => months.reduce((sum, value) => sum + value, 0)

export type ChartRow = { key: string; months: number[]; total: number }

export const buildChartRows = (map: MonthlyMap | undefined, includePlanned: boolean): ChartRow[] =>
  Object.entries(map ?? {}).map(([key, row]) => {
    const months = monthSeries(row, includePlanned)
    return { key, months, total: rowTotal(months) }
  })

export type SummaryItem = {
  key: string
  count: number
  purchase: number
  acc: number
  nbv: number
  yearly: number
  plannedYearly: number
  plannedCount: number
}

export const buildSummaryItems = (summary: SummaryMap | undefined): SummaryItem[] =>
  Object.entries(summary ?? {}).map(([key, bucket]) => ({
    key,
    count: bucket.count + (bucket.planned_count ?? 0),
    purchase: bucket.purchase_price + (bucket.planned_purchase_price ?? 0),
    acc: bucket.acc_depreciation + (bucket.planned_acc_depreciation ?? 0),
    nbv: bucket.net_book_value + (bucket.planned_net_book_value ?? 0),
    yearly: bucket.yearly_depreciation + (bucket.planned_yearly ?? 0),
    plannedYearly: bucket.planned_yearly ?? 0,
    plannedCount: bucket.planned_count ?? 0,
  }))

export function downloadCsv(
  filename: string,
  header: string[],
  rows: (string | number | null | undefined)[][],
) {
  const escape = (value: string | number | null | undefined) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const content = [header, ...rows].map(row => row.map(escape).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}