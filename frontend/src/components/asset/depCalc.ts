/** months elapsed from purchase_date up to end of target_month/year (inclusive) */
export function monthsElapsed(purchaseDate: Date, targetYear: number, targetMonth: number): number {
  const startYear = purchaseDate.getFullYear()
  const startMonth = purchaseDate.getMonth() + 1
  const elapsed = (targetYear - startYear) * 12 + (targetMonth - startMonth) + 1
  return Math.max(0, elapsed)
}

export interface DepCalc {
  monthly: number
  accPrev: number
  yearly: number
  untilYear: number
  remain: number
  accDepPrev: number
  nbvPrev: number
  depExpCurrent: number
  accDepCurr: number
  nbvCurr: number
  periodTotal: number
  /** Share of the depreciation period already consumed, 0–100. */
  progress: number
}

/**
 * Straight-line preview. Mirrors `backend/app/services/depreciation.py` so the
 * form shows the number the server is about to store.
 */
export function calcDepreciation(
  purchasePrice: number,
  periodTotal: number,
  purchaseDateStr: string | null | undefined,
  yearRef: number,
): DepCalc | null {
  if (!purchasePrice || !periodTotal || periodTotal <= 0) return null
  const monthly = purchasePrice / periodTotal

  let accPrev = 0
  let yearly = 0
  let untilYear = 0
  let remain = 0

  if (purchaseDateStr) {
    const purchaseDate = new Date(purchaseDateStr)
    if (!Number.isNaN(purchaseDate.getTime())) {
      const previousYear = yearRef - 1
      const upToPrevious = Math.min(monthsElapsed(purchaseDate, previousYear, 12), periodTotal)
      const upToCurrent = Math.min(monthsElapsed(purchaseDate, yearRef, 12), periodTotal)
      accPrev = upToPrevious
      yearly = Math.max(0, upToCurrent - upToPrevious)
      untilYear = upToCurrent
      remain = Math.max(0, periodTotal - upToCurrent)
    }
  }

  const accDepPrev = monthly * accPrev
  const accDepCurr = monthly * untilYear
  const nbvPrev = Math.max(0, purchasePrice - accDepPrev)
  const depExpCurrent = monthly * yearly
  const nbvCurr = Math.max(0, purchasePrice - accDepCurr)

  return {
    monthly,
    accPrev,
    yearly,
    untilYear,
    remain,
    accDepPrev,
    nbvPrev,
    depExpCurrent,
    accDepCurr,
    nbvCurr,
    periodTotal,
    progress: Math.min(100, (untilYear / periodTotal) * 100),
  }
}
