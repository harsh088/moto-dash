/**
 * Sunrise/sunset from the standard "sunrise equation" (NOAA-style approximation,
 * accurate to a minute or two, which is plenty for switching map styles).
 */
const J1970 = 2440587.5
const J2000 = 2451545
const rad = Math.PI / 180

const toJulian = (d: Date) => d.getTime() / 86400000 + J1970
const fromJulian = (j: number) => new Date((j - J1970) * 86400000)

export interface SunTimes {
  sunrise: Date | null
  sunset: Date | null
  /** Set when the sun never rises/sets that day (polar regions). */
  polar: 'day' | 'night' | null
}

/** Sun times for the solar day whose noon is closest to `when`. lon: east positive. */
export function getSunTimes(when: Date, lat: number, lon: number): SunTimes {
  const n = Math.round(toJulian(when) - J2000 + lon / 360)
  const jStar = n - lon / 360
  const M = (357.5291 + 0.98560028 * jStar) % 360
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad)
  const lambda = (M + C + 180 + 102.9372) % 360
  const jTransit = J2000 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad)
  const sinDec = Math.sin(lambda * rad) * Math.sin(23.4397 * rad)
  const cosDec = Math.cos(Math.asin(sinDec))
  const cosOmega =
    (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinDec) / (Math.cos(lat * rad) * cosDec)

  if (cosOmega > 1) return { sunrise: null, sunset: null, polar: 'night' }
  if (cosOmega < -1) return { sunrise: null, sunset: null, polar: 'day' }
  const omega = Math.acos(cosOmega) / rad
  return {
    sunrise: fromJulian(jTransit - omega / 360),
    sunset: fromJulian(jTransit + omega / 360),
    polar: null,
  }
}

/** True when the sun is up at `when`. Without a location, assumes 06:00–18:00 local. */
export function isDaytime(when: Date, lat?: number, lon?: number): boolean {
  if (lat == null || lon == null) {
    const h = when.getHours()
    return h >= 6 && h < 18
  }
  const t = getSunTimes(when, lat, lon)
  if (t.polar) return t.polar === 'day'
  return when >= t.sunrise! && when < t.sunset!
}
