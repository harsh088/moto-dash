import { createStore, loadJSON, saveJSON, useStore } from './store'

/**
 * TomTom request accounting.
 *
 * TomTom's free tier (docs.tomtom.com/pricing, checked 2026-11-13) is per MONTH, per product:
 *   - Orbis Map Display vector tiles: 200,000 / month
 *   - Traffic flow tiles:             200,000 / month
 *   - Search API (fuzzy, reverse, along-route): 2,500 / month   <- the scarce one
 *   - Routing API:                    20,000 / month
 * Style JSON, sprites and fonts ("assets") have no listed allowance; counted for visibility.
 */
export type UsageCategory = 'mapTiles' | 'trafficTiles' | 'search' | 'routing' | 'assets'
type Counts = Record<UsageCategory, number>

export interface UsageLimit {
  category: UsageCategory
  label: string
  period: 'day' | 'month'
  limit: number | null
}

export const USAGE_LIMITS: UsageLimit[] = [
  { category: 'mapTiles', label: 'Map tiles', period: 'month', limit: 200_000 },
  { category: 'trafficTiles', label: 'Traffic tiles', period: 'month', limit: 200_000 },
  { category: 'search', label: 'Search', period: 'month', limit: 2_500 },
  { category: 'routing', label: 'Routing', period: 'month', limit: 20_000 },
  { category: 'assets', label: 'Style, icons & fonts', period: 'month', limit: null },
]

export const WARN_AT = 0.8

export interface UsageState {
  day: string
  month: string
  today: Counts
  thisMonth: Counts
  /** Set (YYYY-MM-DD) when TomTom answered 401/403; we use OpenFreeMap until tomorrow. */
  blockedDay: string | null
  blockedReason: string | null
}

const KEY = 'motodash.usage.v1'
const zero = (): Counts => ({ mapTiles: 0, trafficTiles: 0, search: 0, routing: 0, assets: 0 })
const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monthKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

function rollover(s: UsageState): UsageState {
  const day = dayKey()
  const month = monthKey()
  if (s.day === day && s.month === month) return s
  return {
    day,
    month,
    today: s.day === day ? s.today : zero(),
    thisMonth: s.month === month ? s.thisMonth : zero(),
    blockedDay: s.blockedDay === day ? s.blockedDay : null,
    blockedReason: s.blockedDay === day ? s.blockedReason : null,
  }
}

const initial = loadJSON<UsageState | null>(KEY, null)
const store = createStore<UsageState>(
  rollover(
    initial && initial.today && initial.thisMonth
      ? { ...initial, today: { ...zero(), ...initial.today }, thisMonth: { ...zero(), ...initial.thisMonth } }
      : { day: '', month: '', today: zero(), thisMonth: zero(), blockedDay: null, blockedReason: null },
  ),
)

function categorize(url: string): UsageCategory {
  if (url.includes('/map-display/tile/')) return 'mapTiles'
  if (url.includes('/traffic/tile/')) return 'trafficTiles'
  if (url.includes('/routing/')) return 'routing'
  if (url.includes('/search/')) return 'search'
  return 'assets'
}

// Tile requests fire dozens per second while panning, so batch writes to localStorage.
let pending = zero()
let timer: ReturnType<typeof setTimeout> | null = null

function flush(): void {
  if (timer) clearTimeout(timer)
  timer = null
  const add = pending
  pending = zero()
  store.update((prev) => {
    const s = rollover(prev)
    const today = { ...s.today }
    const thisMonth = { ...s.thisMonth }
    for (const k of Object.keys(add) as UsageCategory[]) {
      today[k] += add[k]
      thisMonth[k] += add[k]
    }
    return { ...s, today, thisMonth }
  })
  saveJSON(KEY, store.get())
}

/** Count one request to api.tomtom.com. */
export function recordTomTomRequest(url: string): void {
  pending[categorize(url)]++
  if (!timer) timer = setTimeout(flush, 3000)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

export function markTomTomBlocked(reason: string): void {
  store.update((s) => ({ ...rollover(s), blockedDay: dayKey(), blockedReason: reason }))
  saveJSON(KEY, store.get())
}

export function clearTomTomBlock(): void {
  store.update((s) => ({ ...s, blockedDay: null, blockedReason: null }))
  saveJSON(KEY, store.get())
}

export function resetUsage(): void {
  store.set({ day: dayKey(), month: monthKey(), today: zero(), thisMonth: zero(), blockedDay: null, blockedReason: null })
  saveJSON(KEY, store.get())
}

export function usedFor(s: UsageState, l: UsageLimit): number {
  return l.period === 'day' ? s.today[l.category] : s.thisMonth[l.category]
}

/** Limits at or above 80 %. */
export function usageWarnings(s: UsageState): { label: string; pct: number }[] {
  return USAGE_LIMITS.filter((l) => l.limit).flatMap((l) => {
    const pct = usedFor(s, l) / l.limit!
    return pct >= WARN_AT ? [{ label: l.label, pct }] : []
  })
}

/** True while this month's TomTom Search allowance still has room. */
export function searchBudgetLeft(): boolean {
  const s = getUsage()
  return s.thisMonth.search < USAGE_LIMITS.find((l) => l.category === 'search')!.limit!
}

export const useUsage = (): UsageState => useStore(store)
export const getUsage = (): UsageState => rollover(store.get())
