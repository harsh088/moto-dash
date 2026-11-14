import { haversine } from './geo'
import { getLocation, subscribeLocation } from './location'
import { getNav, markArrived, navStore, reroute, stopReached } from './nav'
import { projectNear, segmentBearing } from './routeGeo'
import type { Maneuver } from './routing/types'
import { say, spokenDistance } from './voice'

/**
 * Runs on every GPS fix while riding: progress along the route, next maneuver,
 * off-route detection + re-route, stop/arrival detection and the 3-stage voice prompts.
 */
const OFF_ROUTE_M = 50
const OFF_ROUTE_MS = 5000
const REROUTE_GAP_MS = 20000
const ARRIVE_M = 35
const STOP_REACHED_M = 40

let routeId: string | null = null
let lastSeg = 0
let offSince: number | null = null
let lastRerouteAt = 0
/** maneuver key -> highest stage already spoken (1 early, 2 prepare, 3 now) */
const spoken = new Map<string, number>()

const ARRIVAL_CODES = /^(ARRIVE|WAYPOINT)/

function lowerFirst(s: string): string {
  return s ? s[0].toLowerCase() + s.slice(1) : s
}

function promptFor(m: Maneuver, stage: number, dist: number): string | null {
  const msg = stage >= 2 && m.combinedMessage ? m.combinedMessage : m.message
  if (ARRIVAL_CODES.test(m.code)) {
    if (stage === 3) return null // arrival / stop reached is announced by detection
    const what = m.code.startsWith('WAYPOINT') ? 'you will reach your stop' : 'you will arrive at your destination'
    return `In ${spokenDistance(dist)}, ${what}.`
  }
  if (stage === 3) return `${msg}.`
  return `In ${spokenDistance(dist)}, ${lowerFirst(msg)}.`
}

function speakStages(rid: string, idx: number, m: Maneuver, dist: number, rawSpeedMps: number): void {
  // Clamp to 0–40 m/s (144 km/h) so a GPS speed spike can't stretch the prompt distances.
  const speedMps = Math.min(40, Math.max(0, rawSpeedMps || 0))
  const nowT = Math.min(80, Math.max(30, speedMps * 3)) // "now": ~30 m, ~3 s ahead at speed
  const prepT = Math.min(350, Math.max(200, speedMps * 10)) // "prepare": ~200 m
  const earlyT = Math.min(1500, Math.max(500, speedMps * 30)) // "early": ~500 m or ~30 s ahead
  const stage = dist <= nowT ? 3 : dist <= prepT ? 2 : dist <= earlyT ? 1 : 0
  if (!stage) return
  const key = `${rid}:${idx}`
  const done = spoken.get(key) ?? 0
  if (stage <= done) return
  spoken.set(key, stage)
  const text = promptFor(m, stage, dist)
  if (text) void say(text)
}

function onFix(): void {
  const nav = getNav()
  if (nav.status !== 'riding') {
    routeId = null
    offSince = null
    return
  }
  const fix = getLocation().fix
  const route = nav.routes[nav.selected]
  if (!fix) return
  const now = Date.now()

  // Arrival at the destination.
  if (nav.destination && haversine(fix, nav.destination) < ARRIVE_M) return markArrived()

  // Passing a stop removes it, so later re-routes don't send us back.
  const stopIdx = nav.stops.findIndex((s) => haversine(fix, s) < STOP_REACHED_M)
  if (stopIdx >= 0) stopReached(stopIdx)

  if (!route) {
    if (now - lastRerouteAt > REROUTE_GAP_MS) {
      lastRerouteAt = now
      void reroute('retry')
    }
    return
  }

  if (route.id !== routeId) {
    routeId = route.id
    lastSeg = 0
    offSince = null
  }

  const p = projectNear(route.geometry, route.cumulative, [fix.lon, fix.lat], lastSeg)
  lastSeg = p.seg
  const total = route.cumulative[route.cumulative.length - 1] || route.distanceM
  const remainingM = Math.max(0, total - p.along)

  // Off-route: >50 m away for >5 s, at most one re-route every 20 s. Ignore very poor fixes.
  const off = p.dist > OFF_ROUTE_M + Math.min(fix.accuracy, 50) * 0.5
  if (off) {
    offSince ??= now
    if (now - offSince > OFF_ROUTE_MS && now - lastRerouteAt > REROUTE_GAP_MS && !nav.rerouting) {
      lastRerouteAt = now
      offSince = null
      void reroute('offroute')
    }
  } else {
    offSince = null
  }

  if (remainingM < 25 && p.dist < OFF_ROUTE_M) return markArrived()

  const idx = route.maneuvers.findIndex((m) => m.offsetM > p.along + 5 && m.code !== 'DEPART')
  const m = idx >= 0 ? route.maneuvers[idx] : null
  const dist = m ? m.offsetM - p.along : remainingM

  const remainingS = total > 0 ? (route.durationS * remainingM) / total : 0
  navStore.update((s) => ({
    ...s,
    progress: {
      alongM: p.along,
      remainingM,
      remainingS,
      arrivalMs: now + remainingS * 1000,
      offRouteM: p.dist,
      seg: p.seg,
      bearing: segmentBearing(route.geometry, p.seg),
    },
    nextTurn: m ? { instruction: m.message, maneuver: m.code, street: m.street, distanceM: dist } : null,
  }))

  if (m && !off) speakStages(route.id, idx, m, dist, (fix.speedKmh ?? 0) / 3.6)
}

let started = false
export function startRideEngine(): void {
  if (started) return
  started = true
  subscribeLocation(onFix)
}
