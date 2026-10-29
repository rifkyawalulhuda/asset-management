export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Categorical series colours. Seven hues plus a neutral "Other" bucket. */
export const PALETTE = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#0891b2', '#65a30d']

export const OTHER_KEY = 'Other'
export const OTHER_COLOR = '#94a3b8'

export const idrFull = (value: number | null | undefined): string => {
  if (value == null) return 'Rp 0'
  return 'Rp ' + Math.round(Number(value)).toLocaleString('id-ID')
}

const trim = (value: number) => value.toLocaleString('id-ID', { maximumFractionDigits: value >= 100 ? 0 : 1 })

export const idrCompact = (value: number | null | undefined): string => {
  const amount = Number(value ?? 0)
  if (!amount) return 'Rp 0'
  const sign = amount < 0 ? '-' : ''
  const n = Math.abs(amount)
  if (n >= 1e12) return `${sign}Rp ${trim(n / 1e12)} T`
  if (n >= 1e9) return `${sign}Rp ${trim(n / 1e9)} M`
  if (n >= 1e6) return `${sign}Rp ${trim(n / 1e6)} jt`
  if (n >= 1e3) return `${sign}Rp ${trim(n / 1e3)} rb`
  return `${sign}Rp ${trim(n)}`
}

/** Table cell variant: an absent value renders as an em dash instead of "Rp 0". */
export const idrCell = (value: number | null | undefined): string => {
  if (value == null || Number(value) === 0) return '—'
  return idrFull(value)
}

/** Compact table cell: keeps 138px columns readable while the tooltip holds the exact figure. */
export const idrCompactCell = (value: number | null | undefined): string => {
  if (value == null || Number(value) === 0) return '—'
  return idrCompact(value)
}

export const pct = (value: number, total: number): number => (total > 0 ? (value / total) * 100 : 0)

export const deltaPct = (current: number, previous: number): number | null => {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

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
