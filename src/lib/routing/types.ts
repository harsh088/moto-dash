import type { LatLon } from '../geo'
import type { LngLat } from '../routeGeo'

/** One instruction along a route. Offsets are metres from the route start. */
export interface Maneuver {
  offsetM: number
  point: LngLat
  /** provider maneuver code, e.g. TURN_LEFT, ROUNDABOUT_RIGHT, ARRIVE */
  code: string
  /** human readable, e.g. "Turn left onto MG Road" */
  message: string
  /** message merged with the following one when they are close ("Turn right then turn left") */
  combinedMessage: string | null
  street: string | null
}

export interface Route {
  id: string
  /** [lon, lat] vertices */
  geometry: LngLat[]
  /** cumulative distance per vertex (m) */
  cumulative: number[]
  distanceM: number
  durationS: number
  trafficDelayS: number
  arrival: Date
  maneuvers: Maneuver[]
}

export interface RouteOptions {
  /** current heading of the rider, helps the first maneuver when re-routing */
  headingDeg?: number | null
  alternatives?: number
  signal?: AbortSignal
}

/**
 * Pluggable routing backend. Implement this for Stadia, Mappls, OSRM… later.
 * Returns the best route first.
 */
export interface RoutingProvider {
  readonly name: string
  getRoute(from: LatLon, to: LatLon, stops: LatLon[], options?: RouteOptions): Promise<Route[]>
}
