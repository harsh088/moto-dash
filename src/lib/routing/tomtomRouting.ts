import type { LatLon } from '../geo'
import { cumulativeDistances, type LngLat } from '../routeGeo'
import { tomtomFetch } from '../tomtom'
import type { Maneuver, Route, RouteOptions, RoutingProvider } from './types'

/**
 * TomTom Routing API "Calculate Route" (v1). Used instead of Orbis v3 because only
 * v1 offers travelMode=motorcycle (Orbis v3 is car/taxi only, checked 2026-11-13).
 * Free tier: 20,000 requests / month.
 */
interface TTInstruction {
  routeOffsetInMeters: number
  pointIndex: number
  point: { latitude: number; longitude: number }
  maneuver: string
  message?: string
  combinedMessage?: string
  street?: string
  possibleCombineWithNext?: boolean
}

interface TTRoute {
  summary: {
    lengthInMeters: number
    travelTimeInSeconds: number
    trafficDelayInSeconds: number
    arrivalTime: string
  }
  legs: { points: { latitude: number; longitude: number }[] }[]
  guidance?: { instructions: TTInstruction[] }
}

let seq = 0

function toRoute(r: TTRoute): Route {
  // pointIndex in the instructions indexes the legs' points concatenated in order.
  const geometry: LngLat[] = r.legs.flatMap((l) => l.points.map((p) => [p.longitude, p.latitude] as LngLat))
  const cumulative = cumulativeDistances(geometry)
  const maneuvers: Maneuver[] = (r.guidance?.instructions ?? []).map((ins) => ({
    offsetM: cumulative[Math.min(ins.pointIndex, cumulative.length - 1)] ?? ins.routeOffsetInMeters,
    point: [ins.point.longitude, ins.point.latitude],
    code: ins.maneuver,
    message: ins.message ?? ins.maneuver.replaceAll('_', ' ').toLowerCase(),
    combinedMessage: ins.possibleCombineWithNext && ins.combinedMessage ? ins.combinedMessage : null,
    street: ins.street ?? null,
  }))
  return {
    id: `r${++seq}`,
    geometry,
    cumulative,
    distanceM: r.summary.lengthInMeters,
    durationS: r.summary.travelTimeInSeconds,
    trafficDelayS: r.summary.trafficDelayInSeconds,
    arrival: new Date(r.summary.arrivalTime),
    maneuvers,
  }
}

export const tomtomRouting: RoutingProvider = {
  name: 'TomTom',
  async getRoute(from: LatLon, to: LatLon, stops: LatLon[], options: RouteOptions = {}): Promise<Route[]> {
    const locs = [from, ...stops, to].map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join(':')
    const data = await tomtomFetch<{ routes: TTRoute[] }>(
      `/routing/1/calculateRoute/${locs}/json`,
      {
        travelMode: 'motorcycle',
        traffic: true,
        routeType: 'fastest',
        // TomTom only computes alternatives for routes without waypoints.
        maxAlternatives: stops.length ? undefined : (options.alternatives ?? 2),
        instructionsType: 'text',
        language: 'en-GB',
        routeRepresentation: 'polyline',
        vehicleHeading: options.headingDeg != null ? Math.round(options.headingDeg) % 360 : undefined,
      },
      { signal: options.signal },
    )
    return data.routes.map(toRoute)
  },
}
