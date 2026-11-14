import { haversine, type LatLon } from './geo'
import type { Place } from './places'
import { loadJSON, saveJSON } from './store'
import { tomtomAvailable, tomtomFetch } from './tomtom'
import { searchBudgetLeft } from './usage'

/**
 * Place search: TomTom Search API (legacy v2, works with a plain free key) first,
 * Photon (photon.komoot.io, OSM based, fair-use) as fallback.
 * TomTom Search is only 2,500 free requests / month, so results are cached for a week
 * and we switch to Photon automatically once the monthly allowance is used up.
 */
export interface SearchResult extends Place {
  distM: number | null
}

export interface SearchResponse {
  results: SearchResult[]
  source: 'TomTom' | 'Photon'
}

const CACHE_KEY = 'motodash.searchCache.v1'
const CACHE_TTL = 7 * 24 * 3600 * 1000
const CACHE_MAX = 150
type CacheEntry = { t: number; source: SearchResponse['source']; places: Place[] }
let cache = loadJSON<Record<string, CacheEntry>>(CACHE_KEY, {})

function cacheGet(key: string): CacheEntry | null {
  const e = cache[key]
  return e && Date.now() - e.t < CACHE_TTL ? e : null
}

function cachePut(key: string, entry: CacheEntry): void {
  cache[key] = entry
  const keys = Object.keys(cache)
  if (keys.length > CACHE_MAX) {
    keys.sort((a, b) => cache[a].t - cache[b].t)
    for (const k of keys.slice(0, keys.length - CACHE_MAX)) delete cache[k]
  }
  saveJSON(CACHE_KEY, cache)
}

export function clearSearchCache(): void {
  cache = {}
  saveJSON(CACHE_KEY, cache)
}

const canUseTomTomSearch = () => tomtomAvailable() && searchBudgetLeft()

// ---------- TomTom ----------
interface TTResult {
  type: string
  poi?: { name: string }
  address: {
    freeformAddress?: string
    streetName?: string
    streetNameAndNumber?: string
    municipality?: string
    municipalitySubdivision?: string
  }
  position: { lat: number; lon: number }
}

function ttToPlace(r: TTResult): Place {
  const a = r.address
  const name = r.poi?.name ?? a.streetNameAndNumber ?? a.streetName ?? a.municipalitySubdivision ?? a.municipality ?? a.freeformAddress ?? 'Place'
  return { name, address: a.freeformAddress ?? '', lat: r.position.lat, lon: r.position.lon }
}

async function tomtomSearch(q: string, near: LatLon | null, signal: AbortSignal): Promise<Place[]> {
  // https://docs.tomtom.com/search-api/documentation/search-service/fuzzy-search
  const data = await tomtomFetch<{ results: TTResult[] }>(
    `/search/2/search/${encodeURIComponent(q)}.json`,
    {
      limit: 8,
      typeahead: true,
      countrySet: 'IN',
      language: 'en-GB',
      lat: near?.lat.toFixed(4),
      lon: near?.lon.toFixed(4),
    },
    { signal },
  )
  return data.results.map(ttToPlace)
}

// ---------- Photon ----------
interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: Record<string, string | undefined>
}

function photonToPlace(f: PhotonFeature): Place {
  const p = f.properties
  const street = [p.housenumber, p.street].filter(Boolean).join(' ')
  const parts = [p.name ? street : '', p.district ?? p.locality, p.city, p.state, p.country]
  const address = [...new Set(parts.filter((x): x is string => !!x && x !== p.name))].join(', ')
  return {
    name: p.name ?? (street || p.city || 'Place'),
    address,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  }
}

async function photonSearch(q: string, near: LatLon | null, signal: AbortSignal): Promise<Place[]> {
  // https://github.com/komoot/photon/blob/master/docs/api-v1.md
  const p = new URLSearchParams({ q, limit: '8', lang: 'en' })
  if (near) {
    p.set('lat', near.lat.toFixed(4))
    p.set('lon', near.lon.toFixed(4))
  }
  const res = await fetch(`https://photon.komoot.io/api/?${p}`, { signal })
  if (!res.ok) throw new Error(`Photon error ${res.status}`)
  const data = (await res.json()) as { features: PhotonFeature[] }
  return data.features.map(photonToPlace)
}

// ---------- Public API ----------
export async function searchPlaces(query: string, near: LatLon | null, signal: AbortSignal): Promise<SearchResponse> {
  const q = query.trim().toLowerCase()
  // Location rounded to ~10 km so the cache still hits while moving around town.
  const key = `${q}|${near ? `${near.lat.toFixed(1)},${near.lon.toFixed(1)}` : '-'}`
  let entry = cacheGet(key)
  if (!entry) {
    let places: Place[] | null = null
    let source: SearchResponse['source'] = 'Photon'
    if (canUseTomTomSearch()) {
      try {
        places = await tomtomSearch(q, near, signal)
        source = 'TomTom'
      } catch (e) {
        if (signal.aborted) throw e
      }
    }
    if (!places) places = await photonSearch(q, near, signal)
    entry = { t: Date.now(), source, places }
    cachePut(key, entry)
  }
  return {
    source: entry.source,
    results: entry.places.map((p) => ({ ...p, distM: near ? haversine(near, p) : null })),
  }
}

/** Name for a long-pressed map point. */
export async function reverseGeocode(lat: number, lon: number): Promise<Place> {
  const fallbackName = `${lat.toFixed(5)}, ${lon.toFixed(5)}`
  if (canUseTomTomSearch()) {
    try {
      // https://docs.tomtom.com/search-api/documentation/reverse-geocoding-service/reverse-geocode
      const data = await tomtomFetch<{ addresses: TTResult[] }>(
        `/search/2/reverseGeocode/${lat.toFixed(6)},${lon.toFixed(6)}.json`,
        { language: 'en-GB' },
      )
      const a = data.addresses[0]
      if (a) return { ...ttToPlace({ ...a, position: { lat, lon } }), lat, lon }
    } catch {
      /* fall through to Photon */
    }
  }
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=en`)
    const data = (await res.json()) as { features: PhotonFeature[] }
    if (data.features[0]) return { ...photonToPlace(data.features[0]), lat, lon }
  } catch {
    /* offline */
  }
  return { name: 'Dropped pin', address: fallbackName, lat, lon }
}
