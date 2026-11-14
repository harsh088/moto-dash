export interface LatLon {
  lat: number
  lon: number
}

const R = 6371008.8 // mean Earth radius, metres
const rad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in metres. */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}
