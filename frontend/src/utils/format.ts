const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const NUM = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

export const formatIDR = (value: number | string | null | undefined): string => {
  if (value == null) return '-'
  const n = Number(value)
  if (isNaN(n)) return '-'
  return IDR.format(n)
}

export const formatNumber = (value: number | string | null | undefined): string => {
  if (value == null) return '-'
  const n = Number(value)
  if (isNaN(n)) return '-'
  return NUM.format(n)
}

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
