import type { FixedAsset } from '../../types'
import { rawText } from './columns'

function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function buildDelimited(
  rows: FixedAsset[],
  cols: string[],
  year: number,
  separator: ',' | '\t',
): string {
  const header = cols.join(separator)
  const body = rows.map(asset =>
    cols.map(key => escapeCsv(rawText(asset, key, year))).join(separator),
  )
  return [header, ...body].join('\r\n')
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  } catch {
    return false
  }
}

export function downloadCsv(rows: FixedAsset[], cols: string[], year: number, filename: string): void {
  const csv = `\uFEFF${buildDelimited(rows, cols, year, ',')}`
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}