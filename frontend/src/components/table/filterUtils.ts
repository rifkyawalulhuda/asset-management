import type { FixedAsset } from '../../types'

export type FilterKind = 'text' | 'number' | 'date'

export type FilterValue =
  | { kind: 'values'; values: string[]; text: string }
  | { kind: 'range'; min: string; max: string }
  | { kind: 'date'; from: string; to: string }

export const MONTH_COLS = Array.from({ length: 12 }, (_, i) => `m_${i + 1}`)

export function monthAmount(asset: FixedAsset, year: number, month: number): number | null {
  const row = asset.depreciation_monthly.find(d => d.year === year && d.month === month)
  if (!row) return null
  return Number(row.amount ?? 0)
}

export function monthTotal(asset: FixedAsset, year: number): number {
  return asset.depreciation_monthly
    .filter(d => d.year === year)
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
}

export function getValue(asset: FixedAsset, key: string, year: number): unknown {
  if (key.startsWith('m_')) return monthAmount(asset, year, Number(key.slice(2)))
  if (key === 'monthly_total') return monthTotal(asset, year)
  if (key === 'status_additional' || key === 'status_disposals') {
    return asset[key] ? 'Yes' : 'No'
  }
  return (asset as unknown as Record<string, unknown>)[key]
}

export function defaultFilter(kind: FilterKind): FilterValue {
  if (kind === 'number') return { kind: 'range', min: '', max: '' }
  if (kind === 'date') return { kind: 'date', from: '', to: '' }
  return { kind: 'values', values: [], text: '' }
}

export function isFilterActive(filter: FilterValue | undefined): boolean {
  if (!filter) return false
  if (filter.kind === 'values') return filter.values.length > 0 || filter.text.trim() !== ''
  if (filter.kind === 'range') return filter.min.trim() !== '' || filter.max.trim() !== ''
  return filter.from !== '' || filter.to !== ''
}

export function matchesFilter(raw: unknown, filter: FilterValue): boolean {
  if (filter.kind === 'values') {
    const value = raw == null ? '' : String(raw)
    const needle = filter.text.trim().toLowerCase()
    if (needle && !value.toLowerCase().includes(needle)) return false
    if (filter.values.length > 0 && !filter.values.includes(value)) return false
    return true
  }

  if (filter.kind === 'range') {
    const num = raw == null || raw === '' ? Number.NaN : Number(raw)
    if (filter.min.trim() !== '') {
      const min = Number(filter.min)
      if (Number.isNaN(num) || Number.isNaN(min) || num < min) return false
    }
    if (filter.max.trim() !== '') {
      const max = Number(filter.max)
      if (Number.isNaN(num) || Number.isNaN(max) || num > max) return false
    }
    return true
  }

  const date = raw ? String(raw).slice(0, 10) : ''
  if (filter.from && (!date || date < filter.from)) return false
  if (filter.to && (!date || date > filter.to)) return false
  return true
}

export function uniqueValues(rows: FixedAsset[], key: string, year: number): string[] {
  const set = new Set<string>()
  for (const row of rows) {
    const value = getValue(row, key, year)
    if (value == null || value === '') continue
    set.add(String(value))
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}