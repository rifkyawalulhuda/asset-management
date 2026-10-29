import { COL_ORDER, DEFAULT_WIDTH } from './columns'

export type Density = 'compact' | 'comfortable'

export type GridPrefs = {
  hidden: string[]
  frozen: string[]
  widths: Record<string, number>
  density: Density
  showFormulas: boolean
}

export type SavedView = {
  name: string
  prefs: GridPrefs
  columnFilters: Record<string, unknown>
  depFilter: 'all' | 'active' | 'completed'
  savedAt: string
}

const PREFS_KEY = 'sankyu.assetlist.prefs.v1'
const VIEWS_KEY = 'sankyu.assetlist.views.v1'

/** Honours the priority order the finance team asked for: Site, Job, Category, AX, Name. */
export const DEFAULT_PREFS: GridPrefs = {
  hidden: [],
  frozen: ['site_location', 'job', 'category', 'fixed_asset_number_ax', 'name'],
  widths: {},
  density: 'compact',
  showFormulas: false,
}

const KNOWN = new Set(COL_ORDER)

function sanitize(input: unknown, fallback: GridPrefs): GridPrefs {
  if (!input || typeof input !== 'object') return fallback
  const raw = input as Partial<GridPrefs>

  const hidden = Array.isArray(raw.hidden) ? raw.hidden.filter(key => KNOWN.has(key)) : []
  const frozen = Array.isArray(raw.frozen) ? raw.frozen.filter(key => KNOWN.has(key) && !hidden.includes(key)) : []

  if (KNOWN.size - hidden.length < 1) return fallback

  const widths: Record<string, number> = {}
  if (raw.widths && typeof raw.widths === 'object') {
    for (const [key, value] of Object.entries(raw.widths)) {
      if (!KNOWN.has(key)) continue
      const width = Number(value)
      if (!Number.isFinite(width)) continue
      widths[key] = Math.min(600, Math.max(40, Math.round(width)))
    }
  }

  return {
    hidden,
    frozen,
    widths,
    density: raw.density === 'comfortable' ? 'comfortable' : 'compact',
    showFormulas: raw.showFormulas === true,
  }
}

export function loadPrefs(): GridPrefs {
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    if (!stored) return DEFAULT_PREFS
    return sanitize(JSON.parse(stored), DEFAULT_PREFS)
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(prefs: GridPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* storage full or disabled — preferences simply won't persist */
  }
}

export function loadViews(): SavedView[] {
  try {
    const stored = localStorage.getItem(VIEWS_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((view): view is SavedView => !!view && typeof view.name === 'string')
      .map(view => ({ ...view, prefs: sanitize(view.prefs, DEFAULT_PREFS) }))
  } catch {
    return []
  }
}

export function saveViews(views: SavedView[]): void {
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(views))
  } catch {
    /* ignore */
  }
}

export function widthOf(prefs: GridPrefs, key: string): number {
  return prefs.widths[key] ?? DEFAULT_WIDTH[key] ?? 80
}