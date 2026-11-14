import { haversine } from './geo'

export type LngLat = [number, number]

/** Cumulative distance (m) from the start to each vertex. */
export function cumulativeDistances(coords: LngLat[]): number[] {
  const out = [0]
  for (let i = 1; i < coords.length; i++) {
    const [lon1, lat1] = coords[i - 1]
    const [lon2, lat2] = coords[i]
    out.push(out[i - 1] + haversine({ lat: lat1, lon: lon1 }, { lat: lat2, lon: lon2 }))
  }
  return out
}

export interface Projection {
  /** segment index (from vertex seg to seg+1) */
  seg: number
  /** distance along the route (m) */
  along: number
  /** perpendicular distance from the route (m) */
  dist: number
}

const M_PER_DEG = 111320

/** Nearest point on the route between vertices [from, to]. Local flat-earth math (fine at street scale). */
export function projectOnRoute(coords: LngLat[], cum: number[], p: LngLat, from = 0, to = coords.length - 1): Projection {
  const cosLat = Math.cos((p[1] * Math.PI) / 180)
  let best: Projection = { seg: 0, along: 0, dist: Infinity }
  const lo = Math.max(0, from)
  const hi = Math.min(coords.length - 1, to)
  for (let i = lo; i < hi; i++) {
    const ax = (coords[i][0] - p[0]) * cosLat * M_PER_DEG
    const ay = (coords[i][1] - p[1]) * M_PER_DEG
    const bx = (coords[i + 1][0] - p[0]) * cosLat * M_PER_DEG
    const by = (coords[i + 1][1] - p[1]) * M_PER_DEG
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2))
    const px = ax + t * dx
    const py = ay + t * dy
    const d = Math.hypot(px, py)
    if (d < best.dist) best = { seg: i, along: cum[i] + t * (cum[i + 1] - cum[i]), dist: d }
  }
  if (coords.length === 1) best = { seg: 0, along: 0, dist: haversine({ lat: p[1], lon: p[0] }, { lat: coords[0][1], lon: coords[0][0] }) }
  return best
}

/** Projection that prefers the stretch just ahead of the last known segment (avoids snapping to the opposite carriageway). */
export function projectNear(coords: LngLat[], cum: number[], p: LngLat, hintSeg: number): Projection {
  const local = projectOnRoute(coords, cum, p, hintSeg - 5, hintSeg + 300)
  if (local.dist < 40) return local
  const full = projectOnRoute(coords, cum, p)
  return full.dist < local.dist - 10 ? full : local
}

/** Compass bearing (deg) of a route segment. */
export function segmentBearing(coords: LngLat[], seg: number): number {
  const a = coords[Math.min(seg, coords.length - 2)]
  const b = coords[Math.min(seg + 1, coords.length - 1)]
  if (!a || !b) return 0
  const toRad = Math.PI / 180
  const y = Math.sin((b[0] - a[0]) * toRad) * Math.cos(b[1] * toRad)
  const x =
    Math.cos(a[1] * toRad) * Math.sin(b[1] * toRad) -
    Math.sin(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.cos((b[0] - a[0]) * toRad)
  return ((Math.atan2(y, x) / toRad) + 360) % 360
}

/** Route vertices from `along` onwards, thinned to at most `maxPoints`. */
export function remainingPoints(coords: LngLat[], cum: number[], fromSeg: number, maxPoints: number): LngLat[] {
  const rest = coords.slice(fromSeg)
  if (rest.length <= maxPoints) return rest
  const restCum = cum.slice(fromSeg)
  const step = (restCum[restCum.length - 1] - restCum[0]) / (maxPoints - 1)
  const out: LngLat[] = [rest[0]]
  let next = restCum[0] + step
  for (let i = 1; i < rest.length - 1; i++) {
    if (restCum[i] >= next) {
      out.push(rest[i])
      next += step
    }
  }
  out.push(rest[rest.length - 1])
  return out
}
