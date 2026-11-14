import { haversine } from './geo'
import { getLocation, setBackgroundTracking } from './location'
import type { Place } from './places'
import { projectOnRoute } from './routeGeo'
import { tomtomRouting } from './routing/tomtomRouting'
import type { Route, RoutingProvider } from './routing/types'
import { createStore, useStore } from './store'
import { say, stopVoice, unlockAudio } from './voice'
import { allowScreenSleep, keepScreenOn } from './wakelock'

/** The active routing backend. Swap here to add Stadia, Mappls, … */
const routing: RoutingProvider = tomtomRouting

export type NavStatus = 'idle' | 'routing' | 'preview' | 'riding' | 'arrived'

export interface NextTurn {
  instruction: string
  maneuver: string
  street: string | null
  distanceM: number
}

export interface Progress {
  alongM: number
  remainingM: number
  remainingS: number
  offRouteM: number
  seg: number
  bearing: number
  /** estimated arrival time (epoch ms) */
  arrivalMs: number
}

export interface NavState {
  status: NavStatus
  destination: Place | null
  stops: Place[]
  routes: Route[]
  selected: number
  error: string | null
  rerouting: boolean
  progress: Progress | null
  nextTurn: NextTurn | null
  /** increments when the map should zoom to show the routes */
  fitSeq: number
}

const initial: NavState = {
  status: 'idle',
  destination: null,
  stops: [],
  routes: [],
  selected: 0,
  error: null,
  rerouting: false,
  progress: null,
  nextTurn: null,
  fitSeq: 0,
}

export const navStore = createStore<NavState>(initial)
export const useNav = (): NavState => useStore(navStore)
export const getNav = (): NavState => navStore.get()
const patch = (p: Partial<NavState>) => navStore.update((s) => ({ ...s, ...p }))

export const selectedRoute = (s: NavState): Route | null => s.routes[s.selected] ?? null

let inflight: AbortController | null = null

async function computeRoutes(dest: Place, stops: Place[], alternatives: number): Promise<Route[] | null> {
  const fix = getLocation().fix
  if (!fix) {
    patch({ error: 'Waiting for your GPS location. Allow location access and try again.' })
    return null
  }
  inflight?.abort()
  const ctrl = new AbortController()
  inflight = ctrl
  try {
    const routes = await routing.getRoute(fix, dest, stops, {
      headingDeg: fix.heading,
      alternatives,
      signal: ctrl.signal,
    })
    if (ctrl.signal.aborted) return null
    if (!routes.length) throw new Error('No route found')
    patch({ error: null })
    return routes
  } catch (e) {
    if (ctrl.signal.aborted) return null
    patch({ error: e instanceof Error ? e.message : 'Routing failed' })
    return null
  } finally {
    if (inflight === ctrl) inflight = null
  }
}

/** Pick a destination and show route options. */
export async function planRoute(dest: Place): Promise<void> {
  patch({ status: 'routing', destination: dest, stops: [], routes: [], selected: 0, error: null, nextTurn: null, progress: null })
  const routes = await computeRoutes(dest, [], 2)
  if (getNav().destination !== dest) return // replaced meanwhile
  navStore.update((s) => ({ ...s, status: 'preview', routes: routes ?? [], selected: 0, fitSeq: s.fitSeq + 1 }))
}

export async function retryRoute(): Promise<void> {
  const s = getNav()
  if (!s.destination) return
  if (s.status === 'riding') return reroute('retry')
  patch({ status: 'routing', error: null })
  const routes = await computeRoutes(s.destination, s.stops, s.stops.length ? 0 : 2)
  navStore.update((n) => ({ ...n, status: 'preview', routes: routes ?? [], selected: 0, fitSeq: n.fitSeq + 1 }))
}

export function selectRoute(i: number): void {
  if (getNav().status === 'preview') patch({ selected: i })
}

export function cancelRoute(): void {
  inflight?.abort()
  allowScreenSleep()
  setBackgroundTracking(false)
  stopVoice()
  navStore.update((s) => ({ ...initial, fitSeq: s.fitSeq }))
}

/** Must be called directly from a tap: unlocks audio on iOS and the wake lock. */
export function startRide(): void {
  const s = getNav()
  const route = selectedRoute(s)
  if (!route || !s.destination) return
  unlockAudio()
  keepScreenOn()
  setBackgroundTracking(true)
  navStore.set({ ...s, status: 'riding', routes: [route], selected: 0, progress: null, nextTurn: null, error: null })
  void say(`Starting ride to ${s.destination.name}.`)
}

export function endRide(): void {
  cancelRoute()
}

export function markArrived(): void {
  const s = getNav()
  if (s.status !== 'riding') return
  patch({ status: 'arrived', nextTurn: null })
  allowScreenSleep()
  setBackgroundTracking(false)
  void say(`You have arrived at ${s.destination?.name ?? 'your destination'}.`)
}

/** Recalculate from the current position (off route, or stops changed). */
export async function reroute(reason: 'offroute' | 'stops' | 'retry'): Promise<void> {
  const s = getNav()
  if (!s.destination || s.rerouting) return
  patch({ rerouting: true })
  if (reason === 'offroute') void say('Re-routing.')
  const riding = s.status === 'riding'
  const routes = await computeRoutes(s.destination, getNav().stops, riding || s.stops.length ? 0 : 2)
  const now = getNav()
  if (now.status !== 'riding' && now.status !== 'preview') return patch({ rerouting: false })
  navStore.update((n) => ({
    ...n,
    rerouting: false,
    routes: routes ?? n.routes,
    selected: routes ? 0 : n.selected,
    fitSeq: !riding && routes ? n.fitSeq + 1 : n.fitSeq,
  }))
}

/** Insert a stop in order of distance along the current route, then re-route through it. */
export function addStop(place: Place): void {
  const s = getNav()
  const route = selectedRoute(s)
  const alongOf = (p: Place) =>
    route ? projectOnRoute(route.geometry, route.cumulative, [p.lon, p.lat]).along : haversine(getLocation().fix ?? p, p)
  const stops = [...s.stops, place].sort((a, b) => alongOf(a) - alongOf(b))
  patch({ stops })
  void reroute('stops')
}

export function removeStop(index: number): void {
  patch({ stops: getNav().stops.filter((_, i) => i !== index) })
  void reroute('stops')
}

/** Called by the ride engine when a stop has been reached. */
export function stopReached(index: number): void {
  const stop = getNav().stops[index]
  patch({ stops: getNav().stops.filter((_, i) => i !== index) })
  if (stop) void say(`You have reached ${stop.name}. Continuing to your destination.`)
}
