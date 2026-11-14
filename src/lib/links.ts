import type { Place } from './places'

/**
 * Google Maps directions URL (Maps URLs, api=1). Opens the Google Maps app on iOS/Android
 * when installed, otherwise the website. travelmode=two-wheeler works where Google
 * supports it (India included). https://developers.google.com/maps/documentation/urls/get-started
 */
export function googleMapsDirectionsUrl(dest: Place, stops: Place[] = []): string {
  const p = new URLSearchParams({
    api: '1',
    destination: `${dest.lat.toFixed(6)},${dest.lon.toFixed(6)}`,
    travelmode: 'two-wheeler',
    dir_action: 'navigate',
  })
  // Mobile supports up to 3 waypoints.
  if (stops.length) p.set('waypoints', stops.slice(0, 3).map((s) => `${s.lat.toFixed(6)},${s.lon.toFixed(6)}`).join('|'))
  return `https://www.google.com/maps/dir/?${p}`
}

/**
 * Try an app URL scheme; if the page is still visible afterwards (app not installed),
 * open the web link in a new tab so the ride screen isn't replaced.
 */
export function openApp(appUrl: string, webUrl: string): void {
  let left = false
  const onHide = () => {
    left = true
  }
  document.addEventListener('visibilitychange', onHide, { once: true })
  window.location.href = appUrl
  setTimeout(() => {
    document.removeEventListener('visibilitychange', onHide)
    if (!left && document.visibilityState === 'visible') window.open(webUrl, '_blank', 'noopener')
  }, 1500)
}

export const MUSIC_APPS = [
  // spotify: URIs are documented by Spotify; open.spotify.com launches the app when installed.
  { id: 'spotify', label: 'Spotify', app: 'spotify:', web: 'https://open.spotify.com/' },
  // music:// is the Apple Music app scheme on iOS (not formally documented); web fallback is music.apple.com.
  { id: 'apple', label: 'Apple Music', app: 'music://', web: 'https://music.apple.com/' },
] as const
