import type { FixedAsset } from '../../types'
import { MONTH_COLS, getValue } from './filterUtils'
import type { FilterKind } from './filterUtils'

export type Tone = 'id' | 'gray' | 'green' | 'yellow' | 'orange' | 'blue' | 'purple'

/**
 * Soft-tint header palette: the group band carries the colour, leaf cells stay
 * neutral, and a 2px baseline repeats the segment colour under every column.
 */
export const TONE_STYLE: Record<Tone, { band: string; accent: string; leaf: string; dot: string }> = {
  id: {
    band: 'bg-sky-100 text-sky-900',
    accent: 'border-b-sky-600',
    leaf: 'border-b-sky-300',
    dot: 'bg-sky-500',
  },
  gray: {
    band: 'bg-slate-100 text-slate-700',
    accent: 'border-b-slate-400',
    leaf: 'border-b-slate-300',
    dot: 'bg-slate-400',
  },
  green: {
    band: 'bg-emerald-100 text-emerald-900',
    accent: 'border-b-emerald-600',
    leaf: 'border-b-emerald-300',
    dot: 'bg-emerald-500',
  },
  yellow: {
    band: 'bg-amber-100 text-amber-900',
    accent: 'border-b-amber-600',
    leaf: 'border-b-amber-300',
    dot: 'bg-amber-500',
  },
  orange: {
    band: 'bg-orange-100 text-orange-900',
    accent: 'border-b-orange-600',
    leaf: 'border-b-orange-300',
    dot: 'bg-orange-500',
  },
  blue: {
    band: 'bg-blue-100 text-blue-900',
    accent: 'border-b-blue-600',
    leaf: 'border-b-blue-300',
    dot: 'bg-blue-500',
  },
  purple: {
    band: 'bg-violet-100 text-violet-900',
    accent: 'border-b-violet-600',
    leaf: 'border-b-violet-300',
    dot: 'bg-violet-500',
  },
}

export const CELL_TONE: Record<Tone, string> = {
  id: '',
  gray: '',
  green: 'bg-emerald-50',
  yellow: 'bg-amber-50',
  orange: 'bg-orange-50',
  blue: 'bg-blue-50',
  purple: 'bg-violet-50',
}

export type ColumnFormat =
  | 'text'
  | 'int'
  | 'money'
  | 'date'
  | 'category'
  | 'asset_no'
  | 'ax'
  | 'name'
  | 'month'
  | 'check'
  | 'photo'
  | 'actions'

export type ColumnDef = {
  key: string
  label: string
  head: string
  width: number
  tone: Tone
  align: 'left' | 'center' | 'right'
  format: ColumnFormat
  filter?: FilterKind
  /** Filter is applied server-side (whole dataset) instead of the loaded page. */
  serverFilter?: boolean
  /** Popover search only narrows the value list, it does not filter rows. */
  searchOnly?: boolean
  group: string
  formula?: string
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type Def = Omit<ColumnDef, 'key'>

const DEFS: Record<string, Def> = {
  no: { label: 'No.', head: 'No.', width: 38, tone: 'id', align: 'center', format: 'int', group: 'identity' },
  site_location: {
    label: 'Site/Loc.', head: 'Site/\nLoc.', width: 46, tone: 'id', align: 'center', format: 'text',
    filter: 'text', serverFilter: true, searchOnly: true, group: 'identity',
  },
  job: {
    label: 'Job', head: 'Job', width: 68, tone: 'id', align: 'left', format: 'text',
    filter: 'text', serverFilter: true, searchOnly: true, group: 'identity',
  },
  account_no: { label: 'Account No.', head: 'Account\nNo.', width: 56, tone: 'gray', align: 'center', format: 'text', filter: 'text', group: 'identity' },
  category: { label: 'Category', head: 'Category', width: 62, tone: 'gray', align: 'center', format: 'category', filter: 'text', group: 'identity' },

  asset_no: { label: 'Asset No.', head: 'Asset\nNo.', width: 92, tone: 'id', align: 'left', format: 'asset_no', filter: 'text', group: 'asset' },
  fixed_asset_number_ax: { label: 'Fixed Asset No. (AX)', head: 'Fixed Asset No.\n(AX)', width: 96, tone: 'gray', align: 'center', format: 'ax', filter: 'text', group: 'asset' },
  purchase_date: { label: 'Purchase Date', head: 'Purchase\nDate', width: 86, tone: 'gray', align: 'center', format: 'date', filter: 'date', group: 'asset' },
  group_name: { label: 'Group', head: 'Group', width: 116, tone: 'gray', align: 'left', format: 'text', filter: 'text', group: 'asset' },
  voucher_no: { label: 'Voucher No.', head: 'Voucher\nNo.', width: 72, tone: 'gray', align: 'center', format: 'text', filter: 'text', group: 'asset' },
  name: { label: 'Name of Fixed Asset', head: 'Name of Fixed Asset', width: 200, tone: 'id', align: 'left', format: 'name', filter: 'text', group: 'asset' },
  maker_type_location: { label: 'Maker/Type/Location', head: 'Maker/Type/\nLocation', width: 168, tone: 'gray', align: 'left', format: 'text', filter: 'text', group: 'asset' },
  capacity_size_user: { label: 'Capacity/Size/User', head: 'Capacity/Size/\nUser', width: 140, tone: 'gray', align: 'left', format: 'text', filter: 'text', group: 'asset' },
  year: { label: 'Year', head: 'Year', width: 54, tone: 'gray', align: 'center', format: 'int', filter: 'number', group: 'asset' },
  police_no: { label: 'Police No.', head: 'Police No.', width: 84, tone: 'gray', align: 'center', format: 'text', filter: 'text', group: 'asset' },
  machine_no: { label: 'Machine No.', head: 'Machine No.', width: 84, tone: 'gray', align: 'center', format: 'text', filter: 'text', group: 'asset' },
  chasis_no: { label: 'Chasis No.', head: 'Chasis No.', width: 84, tone: 'gray', align: 'center', format: 'text', filter: 'text', group: 'asset' },
  quantity: { label: 'Qty', head: 'Qty', width: 54, tone: 'gray', align: 'center', format: 'int', filter: 'number', group: 'asset' },
  valas: { label: 'Valas', head: 'Valas', width: 56, tone: 'gray', align: 'center', format: 'text', filter: 'text', group: 'asset' },

  purchase_price: { label: 'Purchase Price', head: 'Purchase Price', width: 124, tone: 'green', align: 'right', format: 'money', filter: 'number', group: 'cost', formula: 'a' },
  monthly_depreciation: { label: 'Monthly Depreciation', head: 'Monthly\nDepreciation', width: 124, tone: 'green', align: 'right', format: 'money', filter: 'number', group: 'cost', formula: 'b = a ÷ c' },

  depreciation_period_total: { label: 'Period Total (c)', head: 'Total', width: 62, tone: 'yellow', align: 'right', format: 'int', filter: 'number', group: 'period', formula: 'c' },
  dep_period_acc_prev_year: { label: 'Acc. prev year (d)', head: 'Acc. 2025', width: 62, tone: 'yellow', align: 'right', format: 'int', filter: 'number', group: 'period', formula: 'd' },
  dep_period_yearly: { label: 'Yearly (e)', head: 'Yearly\n2026', width: 70, tone: 'yellow', align: 'right', format: 'int', filter: 'number', group: 'period', formula: 'e' },
  dep_period_until_year: { label: 'Until year (f)', head: 'Until\n2026', width: 74, tone: 'yellow', align: 'right', format: 'int', filter: 'number', group: 'period', formula: 'f = d + e' },
  dep_period_remain: { label: 'Remain (g)', head: 'Remain\n>2027', width: 70, tone: 'yellow', align: 'right', format: 'int', filter: 'number', group: 'period', formula: 'g = c − f' },

  acc_depreciation_prev: { label: 'Accumulated Depreciation (prior)', head: 'Accumulated\nDepreciation', width: 126, tone: 'orange', align: 'right', format: 'money', filter: 'number', group: 'prior', formula: 'l = h + j' },
  net_book_value_prev: { label: 'Net Book Value (prior)', head: 'Net Book\nValue', width: 126, tone: 'orange', align: 'right', format: 'money', filter: 'number', group: 'prior', formula: 'm = a − l' },

  dep_expense_current: { label: 'Depreciation Expense Current', head: 'Dep. Expense\n31 Dec 2026', width: 126, tone: 'blue', align: 'right', format: 'money', filter: 'number', group: 'current', formula: 'j = Σk' },
  monthly_total: { label: 'Total/Year', head: 'Total/\nYear', width: 116, tone: 'blue', align: 'right', format: 'money', filter: 'number', group: 'current', formula: 'Σk' },

  acc_depreciation_curr: { label: 'Accumulated Depreciation', head: 'Accumulated\nDepreciation', width: 126, tone: 'purple', align: 'right', format: 'money', filter: 'number', group: 'closing', formula: 'l' },
  net_book_value_curr: { label: 'Net Book Value', head: 'Net Book\nValue', width: 126, tone: 'purple', align: 'right', format: 'money', filter: 'number', group: 'closing', formula: 'm' },

  status_additional: { label: 'Additional', head: 'Additional', width: 74, tone: 'gray', align: 'center', format: 'check', filter: 'text', group: 'status' },
  status_disposals: { label: 'Disposals', head: 'Disposals', width: 70, tone: 'gray', align: 'center', format: 'check', filter: 'text', group: 'status' },
  condition: { label: 'Condition', head: 'Condition', width: 92, tone: 'gray', align: 'center', format: 'text', filter: 'text', group: 'status' },
  remark: { label: 'Remark', head: 'Remark', width: 108, tone: 'gray', align: 'left', format: 'text', filter: 'text', group: 'status' },
  photo_status: { label: 'Photo Status', head: 'Photo\nStatus', width: 84, tone: 'gray', align: 'center', format: 'photo', filter: 'text', group: 'status' },
  actions: { label: 'Actions', head: 'Actions', width: 92, tone: 'gray', align: 'center', format: 'actions', group: 'status' },
}

MONTHS.forEach((month, index) => {
  DEFS[MONTH_COLS[index]] = {
    label: `Month ${index + 1}`,
    head: `${month}\n(k)`,
    width: 92,
    tone: 'blue',
    align: 'right',
    format: 'month',
    filter: 'number',
    group: 'current',
    formula: 'k',
  }
})

export type HeadBlock =
  | { kind: 'span3'; col: string }
  | { kind: 'span2'; col: string }
  | { kind: 'group'; key: string; label: string | ((year: number) => string); tone: Tone; cols: string[] }

const PERIOD_COLS = [
  'depreciation_period_total',
  'dep_period_acc_prev_year',
  'dep_period_yearly',
  'dep_period_until_year',
  'dep_period_remain',
]

export const HEAD_BLOCKS: HeadBlock[] = [
  { kind: 'span3', col: 'no' },
  { kind: 'span3', col: 'site_location' },
  { kind: 'span3', col: 'job' },
  { kind: 'span2', col: 'account_no' },
  { kind: 'span2', col: 'category' },
  { kind: 'span2', col: 'asset_no' },
  { kind: 'span2', col: 'fixed_asset_number_ax' },
  { kind: 'span2', col: 'purchase_date' },
  { kind: 'span2', col: 'group_name' },
  { kind: 'span2', col: 'voucher_no' },
  { kind: 'span2', col: 'name' },
  { kind: 'span2', col: 'maker_type_location' },
  { kind: 'span2', col: 'capacity_size_user' },
  { kind: 'span2', col: 'year' },
  { kind: 'span2', col: 'police_no' },
  { kind: 'span2', col: 'machine_no' },
  { kind: 'span2', col: 'chasis_no' },
  { kind: 'span2', col: 'quantity' },
  { kind: 'span2', col: 'valas' },
  { kind: 'span2', col: 'purchase_price' },
  { kind: 'span2', col: 'monthly_depreciation' },
  { kind: 'group', key: 'period', label: 'Depreciation Period', tone: 'yellow', cols: PERIOD_COLS },
  { kind: 'group', key: 'prior', label: year => `31 Dec ${year - 1}`, tone: 'orange', cols: ['acc_depreciation_prev', 'net_book_value_prev'] },
  { kind: 'span2', col: 'dep_expense_current' },
  { kind: 'group', key: 'monthly', label: year => `DEPRECIATION ${year} ( MONTHLY )`, tone: 'blue', cols: [...MONTH_COLS, 'monthly_total'] },
  { kind: 'group', key: 'closing', label: year => `31 Dec ${year}`, tone: 'purple', cols: ['acc_depreciation_curr', 'net_book_value_curr'] },
  { kind: 'group', key: 'status', label: 'Status', tone: 'gray', cols: ['status_additional', 'status_disposals'] },
  { kind: 'span2', col: 'condition' },
  { kind: 'span2', col: 'remark' },
  { kind: 'span2', col: 'photo_status' },
  { kind: 'span2', col: 'actions' },
]

function blockCols(block: HeadBlock): string[] {
  return block.kind === 'group' ? block.cols : [block.col]
}

/** Column order is derived from the header blocks so header and body can never drift. */
export const COLUMNS: ColumnDef[] = HEAD_BLOCKS.flatMap(blockCols).map(key => {
  const def = DEFS[key]
  if (!def) throw new Error(`Missing column definition for "${key}"`)
  return { key, ...def }
})

export const COL_BY_KEY: Record<string, ColumnDef> = Object.fromEntries(COLUMNS.map(col => [col.key, col]))
export const COL_ORDER: string[] = COLUMNS.map(col => col.key)
export const DEFAULT_WIDTH: Record<string, number> = Object.fromEntries(COLUMNS.map(col => [col.key, col.width]))
/** Columns whose header cell spans all three header rows (no formula cell on row 3). */
export const ROW3_SPANNED = HEAD_BLOCKS.filter(block => block.kind === 'span3').map(block =>
  blockCols(block)[0],
)

export const GROUP_ORDER = ['identity', 'asset', 'cost', 'period', 'prior', 'current', 'closing', 'status']
export const GROUP_LABEL: Record<string, string> = {
  identity: 'Identity & location',
  asset: 'Asset detail',
  cost: 'Cost & lifetime',
  period: 'Depreciation period',
  prior: 'Prior year closing',
  current: 'Current year schedule',
  closing: 'Current year closing',
  status: 'Status & notes',
}

const YEAR_HEAD: Record<string, (year: number) => string> = {
  dep_period_acc_prev_year: year => `Acc. ${year - 1}`,
  dep_period_yearly: year => `Yearly\n${year}`,
  dep_period_until_year: year => `Until\n${year}`,
  dep_period_remain: year => `Remain\n>${year + 1}`,
  dep_expense_current: year => `Dep. Expense\n31 Dec ${year}`,
}

export function headText(key: string, year: number): string {
  const dynamic = YEAR_HEAD[key]
  if (dynamic) return dynamic(year)
  return COL_BY_KEY[key]?.head ?? key
}

export function blockLabel(block: Extract<HeadBlock, { kind: 'group' }>, year: number): string {
  return typeof block.label === 'function' ? block.label(year) : block.label
}

/** Plain value used for CSV / clipboard export (no thousand separators, ISO dates). */
export function rawText(asset: FixedAsset, key: string, year: number): string {
  const def = COL_BY_KEY[key]
  if (!def) return ''
  if (def.format === 'actions') return ''
  if (def.format === 'check') {
    const value = (asset as unknown as Record<string, unknown>)[key]
    return value ? 'YES' : 'NO'
  }
  if (def.format === 'date') return asset.purchase_date ? String(asset.purchase_date).slice(0, 10) : ''

  const value = getValue(asset, key, year)
  if (value == null || value === '') return ''
  if (def.format === 'money' || def.format === 'int' || def.format === 'month') {
    const num = Number(value)
    return Number.isFinite(num) ? String(Math.round(num)) : ''
  }
  return String(value)
}