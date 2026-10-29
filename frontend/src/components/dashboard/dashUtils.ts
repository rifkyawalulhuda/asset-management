import type { AcquisitionDisposal } from '../../types'
import { toRow } from '../acquisitions/acqUtils'

export type DashTab = 'overview' | 'breakdown' | 'sites'

export const DASH_TABS: { key: DashTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'breakdown', label: 'Breakdown' },
  { key: 'sites', label: 'Sites' },
]

export interface DashTotals {
  total_assets: number
  total_purchase_price: number
  total_acc_depreciation: number
  total_net_book_value: number
  total_yearly_depreciation: number
}

export interface SiteBucket {
  yearly_depreciation: number
  purchase_price: number
  acc_depreciation: number
  net_book_value: number
  count: number
}

export type SiteMap = Record<string, SiteBucket>

export interface MovementSummary {
  acquired: number
  acquiredValue: number
  disposed: number
  disposedValue: number
  net: number
  transfers: number
  incomplete: number
}

export function movementOf(records: AcquisitionDisposal[]): MovementSummary {
  let acquired = 0
  let acquiredValue = 0
  let disposed = 0
  let disposedValue = 0
  let transfers = 0
  let incomplete = 0

  for (const record of records) {
    const row = toRow(record)
    // Records missing a date or price are still booked movements; the count says
    // so rather than silently dropping them (the Acquisitions page hides them).
    if (row.missing.length > 0) incomplete += 1
    if (row.type === 'Acquisition') {
      acquired += 1
      acquiredValue += Number(row.price ?? 0)
    } else if (row.type === 'Disposal') {
      disposed += 1
      disposedValue += Number(row.price ?? 0)
    } else if (row.type === 'Transfer') {
      transfers += 1
    }
  }

  return { acquired, acquiredValue, disposed, disposedValue, net: acquired - disposed, transfers, incomplete }
}

/** Assets with no value in the chosen dimension are bucketed as UNKNOWN. */
export const bucketLabel = (key: string): string => (key.toUpperCase() === 'UNKNOWN' ? 'Unassigned' : key)
