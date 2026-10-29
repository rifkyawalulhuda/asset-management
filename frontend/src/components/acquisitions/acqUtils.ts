import type { AcquisitionDisposal, AcquisitionType } from '../../types'

export const TYPES: AcquisitionType[] = ['Acquisition', 'Disposal', 'Transfer', 'Adjustment']

const TYPE_ALIASES: Record<string, AcquisitionType> = {
  acquisition: 'Acquisition',
  acquisitions: 'Acquisition',
  disposal: 'Disposal',
  disposals: 'Disposal',
  transfer: 'Transfer',
  transfers: 'Transfer',
  withdrawal: 'Disposal',
  withdrawals: 'Disposal',
  adjustment: 'Adjustment',
  adjustments: 'Adjustment',
}

const APPLICATION_MARKERS: [string, AcquisitionType][] = [
  ['FA-PURC', 'Acquisition'],
  ['FA-DISP', 'Disposal'],
  ['FA-TRF', 'Transfer'],
]

export type AcqRow = AcquisitionDisposal & {
  type: AcquisitionType
  missing: string[]
}

export type AcqFilters = {
  search: string
  /** Exact asset number, used when arriving from an asset page. */
  asset: string
  types: AcquisitionType[]
  from: string
  to: string
  site: string
  job: string
  showIncomplete: boolean
}

export const EMPTY_FILTERS: AcqFilters = {
  search: '',
  asset: '',
  types: [],
  from: '',
  to: '',
  site: '',
  job: '',
  showIncomplete: false,
}

function typeFromApplication(application: string | null): AcquisitionType | null {
  const upper = (application ?? '').toUpperCase()
  for (const [marker, type] of APPLICATION_MARKERS) {
    if (upper.includes(marker)) return type
  }
  return null
}

export function toRow(record: AcquisitionDisposal): AcqRow {
  const status = (record.status ?? '').trim().toLowerCase()
  const type = TYPE_ALIASES[status] ?? typeFromApplication(record.application) ?? 'Adjustment'

  const missing: string[] = []
  if (!record.transaction_date) missing.push('date')
  // A price of 0 is a legitimate amount (e.g. an asset written off for nothing),
  // so only a null/absent price counts as incomplete.
  if (record.price == null && (type === 'Acquisition' || type === 'Disposal')) missing.push('price')

  return { ...record, type, missing }
}

export const isIncomplete = (row: AcqRow) => row.missing.length > 0

export const batchOf = (row: AcqRow) => row.bookslip_no || row.application || `single-${row.id}`

export const monthOf = (value: string | null): number | null => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.getMonth()
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const trim = (value: number) =>
  value.toLocaleString('id-ID', { maximumFractionDigits: value >= 100 ? 0 : 1 })

export function compactIDR(value: number | string | null | undefined): string {
  const amount = Number(value)
  if (value == null || Number.isNaN(amount)) return '-'
  const sign = amount < 0 ? '-' : ''
  const n = Math.abs(amount)
  if (n >= 1e12) return `${sign}Rp ${trim(n / 1e12)} T`
  if (n >= 1e9) return `${sign}Rp ${trim(n / 1e9)} M`
  if (n >= 1e6) return `${sign}Rp ${trim(n / 1e6)} jt`
  if (n >= 1e3) return `${sign}Rp ${trim(n / 1e3)} rb`
  return `${sign}Rp ${trim(n)}`
}

export function fullIDR(value: number | string | null | undefined): string {
  const amount = Number(value)
  if (value == null || Number.isNaN(amount)) return '-'
  return 'Rp ' + amount.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

export const countByType = (rows: AcqRow[]) => {
  const counts: Record<AcquisitionType, number> = {
    Acquisition: 0,
    Disposal: 0,
    Transfer: 0,
    Adjustment: 0,
  }
  for (const row of rows) counts[row.type] += 1
  return counts
}

export const sumPrice = (rows: AcqRow[], type: AcquisitionType) =>
  rows.reduce((total, row) => (row.type === type ? total + Number(row.price ?? 0) : total), 0)

export function matchesSearch(row: AcqRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [row.asset_name, row.fixed_asset_no, row.bookslip_no, row.application, row.vendor_customer, row.site, row.job]
    .some(value => (value ?? '').toLowerCase().includes(q))
}

export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function downloadCSV(rows: AcqRow[], filename: string) {
  const header = ['Date', 'Type', 'AX No', 'Asset', 'Site', 'Job', 'Bookslip', 'Application', 'Vendor/Customer', 'Price']
  const lines = rows.map(row => [
    row.transaction_date ?? '',
    row.type,
    row.fixed_asset_no ?? '',
    row.asset_name ?? '',
    row.site ?? '',
    row.job ?? '',
    row.bookslip_no ?? '',
    row.application ?? '',
    row.vendor_customer ?? '',
    row.price == null ? '' : Number(row.price),
  ].map(csvCell).join(','))

  const blob = new Blob([`${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}