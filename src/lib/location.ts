import { haversine } from './geo'
import { BackgroundGeolocation, isNative } from './native'
import { createStore, useStore } from './store'

export interface Fix {
  lat: number
  lon: number
  accuracy: number
  /** km/h, from GPS when available, otherwise derived from successive fixes. */
  speedKmh: number | null
  /** degrees clockwise from north, null when stationary/unknown */
  heading: number | null
  timestamp: number
}

export interface LocationState {
  fix: Fix | null
  error: string | null
}

interface RawFix {
  lat: number
  lon: number
  accuracy: number
  /** m/s */
  speed: number | null
  heading: number | null
  timestamp: number
}

const store = createStore<LocationState>({ fix: null, error: null })

function onRawFix({ lat, lon, accuracy, speed, heading, timestamp }: RawFix): void {
  const prev = store.get().fix
  let speedKmh: number | null = speed != null && speed >= 0 ? speed * 3.6 : null
  if (speedKmh == null && prev) {
    // No GPS speed (some browsers/desktop): derive from movement, else keep the last value.
    const dt = (timestamp - prev.timestamp) / 1000
    speedKmh = dt >= 0.2 ? (haversine(prev, { lat, lon }) / dt) * 3.6 : prev.speedKmh
    // A position jump (GPS glitch) is not real speed.
    if (speedKmh != null && speedKmh > 250) speedKmh = prev.speedKmh
  }
  if (speedKmh != null && speedKmh < 2) speedKmh = 0 // ignore GPS jitter when stopped
  store.set({
    fix: {
      lat,
      lon,
      accuracy,
      speedKmh,
      heading: heading != null && heading >= 0 && !Number.isNaN(heading) && (speedKmh ?? 0) > 3 ? heading : null,
      timestamp,
    },
    error: null,
  })
}

const setError = (error: string) => store.update((s) => ({ ...s, error }))

// ---------- Browser (web app / PWA) ----------
let webWatchId: number | null = null

function startWeb(): void {
  if (!('geolocation' in navigator)) return setError('This browser has no geolocation.')
  if (webWatchId != null) return
  webWatchId = navigator.geolocation.watchPosition(
    (pos) =>
      onRawFix({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        timestamp: pos.timestamp,
      }),
    (err) =>
      setError(
        err.code === err.PERMISSION_DENIED
          ? 'Location permission denied. Allow location for this site.'
          : err.code === err.POSITION_UNAVAILABLE
            ? 'Location unavailable.'
            : 'Waiting for GPS…',
      ),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
  )
}

function stopWeb(): void {
  if (webWatchId != null) navigator.geolocation.clearWatch(webWatchId)
  webWatchId = null
}

// ---------- Native app (Capacitor) ----------
// A foreground-only watcher normally; during a ride a background watcher (backgroundMessage set)
// so GPS + voice keep going when another app is in front or the screen is locked.
let nativeWatcherId: string | null = null
let nativeWanted: 'off' | 'foreground' | 'background' = 'off'
let nativeChain: Promise<void> = Promise.resolve()

function applyNative(): void {
  nativeChain = nativeChain.then(async () => {
    if (nativeWatcherId) {
      await BackgroundGeolocation.removeWatcher({ id: nativeWatcherId }).catch(() => {})
      nativeWatcherId = null
    }
    if (nativeWanted === 'off') return
    const background = nativeWanted === 'background'
    try {
      nativeWatcherId = await BackgroundGeolocation.addWatcher(
        {
          requestPermissions: true,
          stale: false,
          distanceFilter: 0,
          ...(background ? { backgroundTitle: 'Moto Dash', backgroundMessage: 'Navigating your ride' } : {}),
        },
        (loc, err) => {
          if (err) {
            setError(
              err.code === 'NOT_AUTHORIZED'
                ? 'Location is off for Moto Dash. Open iPhone Settings → Moto Dash → Location.'
                : 'Waiting for GPS…',
            )
            return
          }
          if (!loc) return
          onRawFix({
            lat: loc.latitude,
            lon: loc.longitude,
            accuracy: loc.accuracy,
            speed: loc.speed,
            heading: loc.bearing,
            timestamp: loc.time ?? Date.now(),
          })
        },
      )
    } catch {
      setError('Could not start GPS.')
    }
  })
}

/** Start GPS for the app. Returns a stop function. */
export function startLocationWatch(): () => void {
  if (isNative) {
    if (nativeWanted === 'off') {
      nativeWanted = 'foreground'
      applyNative()
    }
    return () => {
      nativeWanted = 'off'
      applyNative()
    }
  }
  startWeb()
  return stopWeb
}

/** During a ride (native app only): keep GPS running in the background. */
export function setBackgroundTracking(on: boolean): void {
  if (!isNative || nativeWanted === 'off') return
  const next = on ? 'background' : 'foreground'
  if (next === nativeWanted) return
  nativeWanted = next
  applyNative()
}

export async function openLocationSettings(): Promise<void> {
  if (isNative) await BackgroundGeolocation.openSettings().catch(() => {})
}

export const subscribeLocation = store.subscribe
export const useLocation = (): LocationState => useStore(store)
export const getLocation = (): LocationState => store.get()
