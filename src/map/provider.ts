import { createStore, useStore } from '../lib/store'
import { getUsage, useUsage } from '../lib/usage'

export type MapProvider = 'tomtom' | 'openfreemap'

export const TOMTOM_KEY: string = (import.meta.env.VITE_TOMTOM_API_KEY ?? '').trim()

/** Name of the traffic-flow source inside TomTom Orbis styles. */
export const TOMTOM_FLOW_SOURCE = 'vectorTilesFlow'

/**
 * TomTom Orbis "Fetch Style" (Assets API v1). The returned style follows the MapLibre
 * style spec and already appends the key to its tile, sprite and glyph URLs.
 * https://docs.tomtom.com/assets-api/documentation/tomtom-orbis-maps/styles-assets/fetch-style
 */
export function tomtomStyleUrl(night: boolean): string {
  const mode = night ? 'dark' : 'light'
  const p = new URLSearchParams({
    key: TOMTOM_KEY,
    apiVersion: '1',
    map: `basic_street-${mode}`,
    trafficFlow: `flow_relative-${mode}`,
  })
  return `https://api.tomtom.com/maps/orbis/assets/styles/0.*/style?${p}`
}

/** OpenFreeMap fallback: free, no key. https://openfreemap.org */
export function openFreeMapStyleUrl(night: boolean): string {
  return `https://tiles.openfreemap.org/styles/${night ? 'dark' : 'liberty'}`
}

/** Non-persistent fallback for this session (e.g. network/CORS failure loading the style). */
const sessionFallback = createStore<string | null>(null)
export const setSessionFallback = (reason: string | null) => sessionFallback.set(reason)

export interface ProviderState {
  provider: MapProvider
  /** Why we are not on TomTom, if we aren't. */
  reason: string | null
}

function resolve(blockedReason: string | null, blockedDay: string | null, session: string | null): ProviderState {
  if (!TOMTOM_KEY) return { provider: 'openfreemap', reason: 'No TomTom key (VITE_TOMTOM_API_KEY) set' }
  if (blockedDay) return { provider: 'openfreemap', reason: `TomTom refused today: ${blockedReason ?? 'limit'}` }
  if (session) return { provider: 'openfreemap', reason: session }
  return { provider: 'tomtom', reason: null }
}

export function useMapProvider(): ProviderState {
  const usage = useUsage()
  const session = useStore(sessionFallback)
  return resolve(usage.blockedReason, usage.blockedDay, session)
}

export function getMapProvider(): ProviderState {
  const u = getUsage()
  return resolve(u.blockedReason, u.blockedDay, sessionFallback.get())
}
