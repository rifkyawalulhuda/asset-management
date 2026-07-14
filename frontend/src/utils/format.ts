const IDR = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const NUM = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

export const formatIDR = (value: number | null | undefined): string => {
  if (value == null) return '-'
  return IDR.format(value)
}

export const formatNumber = (value: number | null | undefined): string => {
  if (value == null) return '-'
  return NUM.format(value)
}

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}
