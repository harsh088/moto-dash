import type { Place } from './places'
import { projectOnRoute, remainingPoints } from './routeGeo'
import type { Route } from './routing/types'
import { tomtomFetch } from './tomtom'

/**
 * Stops along the route via TomTom "Along Route Search" (Search API v2, POST).
 * https://docs.tomtom.com/search-api/documentation/search-service/along-route-search
 * Category IDs verified against /search/2/poiCategories.json (2026-11-13).
 * Counts against the 2,500 / month Search allowance, so results are cached.
 */
export type PoiKind = 'fuel' | 'food' | 'atm' | 'toilet'

export const POI_KINDS: { kind: PoiKind; label: string; query: string; categorySet: string }[] = [
  { kind: 'fuel', label: 'Fuel', query: 'petrol', categorySet: '7311' },
  { kind: 'food', label: 'Food', query: 'restaurant', categorySet: '7315' },
  { kind: 'atm', label: 'ATM', query: 'atm', categorySet: '7397' },
  { kind: 'toilet', label: 'Toilets', query: 'toilet', categorySet: '9932005' },
]

export interface AlongResult {
  place: Place
  /** metres ahead of the rider along the route */
  aheadM: number
  /** extra seconds compared to the planned route (can be negative) */
  detourS: number
}

interface TTAlong {
  poi?: { name: string }
  address: { freeformAddress?: string }
  position: { lat: number; lon: number }
  detourTime: number
}

const cache = new Map<string, { t: number; items: { place: Place; detourS: number }[] }>()
const TTL = 15 * 60 * 1000
const MAX_DETOUR_S = 600
const MAX_POINTS = 150

export async function searchAlongRoute(kind: PoiKind, route: Route, alongM: number, fromSeg: number): Promise<AlongResult[]> {
  const def = POI_KINDS.find((k) => k.kind === kind)!
  // Same route and within the same 3 km stretch → reuse.
  const key = `${kind}:${route.id}:${Math.floor(alongM / 3000)}`
  let hit = cache.get(key)
  if (!hit || Date.now() - hit.t > TTL) {
    const points = remainingPoints(route.geometry, route.cumulative, fromSeg, MAX_POINTS)
    if (points.length < 2) return []
    const data = await tomtomFetch<{ results: TTAlong[] }>(
      `/search/2/searchAlongRoute/${encodeURIComponent(def.query)}.json`,
      {
        maxDetourTime: MAX_DETOUR_S,
        limit: 20,
        categorySet: def.categorySet,
        spreadingMode: 'auto',
        language: 'en-GB',
      },
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: { points: points.map(([lon, lat]) => ({ lat, lon })) } }),
      },
    )
    hit = {
      t: Date.now(),
      items: data.results.map((r) => ({
        place: {
          name: r.poi?.name ?? def.label,
          address: r.address.freeformAddress ?? '',
          lat: r.position.lat,
          lon: r.position.lon,
        },
        detourS: r.detourTime,
      })),
    }
    cache.set(key, hit)
  }
  return hit.items
    .map((it) => ({
      ...it,
      aheadM: projectOnRoute(route.geometry, route.cumulative, [it.place.lon, it.place.lat]).along - alongM,
    }))
    .filter((r) => r.aheadM > -50)
    .sort((a, b) => a.aheadM - b.aheadM)
    .slice(0, 10)
}
