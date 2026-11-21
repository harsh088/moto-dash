import { isNative } from './native'
import { sha256 } from './sha256'
import { createStore, loadJSON, saveJSON, useStore } from './store'

/**
 * Spotify playback control via the official Web API (Authorization Code + PKCE, no backend).
 * https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 * Requires Spotify Premium; the app runs in Spotify "development mode" (owner + up to 5 allow-listed users).
 * Playback itself happens in the Spotify app on the phone — we only read state and send commands.
 */
const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'user-read-recently-played',
].join(' ')

/** Registered in the Spotify dashboard. Custom scheme for the iPhone app (Info.plist CFBundleURLTypes). */
export const NATIVE_REDIRECT = 'motodash://callback'
export const webRedirect = () => `${location.origin}${location.pathname}`
const redirectUri = () => (isNative ? NATIVE_REDIRECT : webRedirect())

export interface Track {
  name: string
  artists: string
  album: string
  artUrl: string | null
  durationMs: number
  uri: string
}

export interface Playback {
  isPlaying: boolean
  track: Track | null
  progressMs: number
  shuffle: boolean
  deviceName: string | null
  /** Date.now() when fetched, to animate progress between polls */
  fetchedAt: number
}

export interface Playlist {
  id: string
  name: string
  uri: string
  imageUrl: string | null
  owner: string
}

interface Tokens {
  access: string
  refresh: string
  expiresAt: number
}

interface SpotifyState {
  clientId: string
  tokens: Tokens | null
  playback: Playback | null
  error: string | null
  busy: boolean
}

const KEY = 'motodash.spotify.v1'
const saved = loadJSON<{ clientId?: string; tokens?: Tokens | null }>(KEY, {})
const envClientId: string = (import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? '').trim()

const store = createStore<SpotifyState>({
  clientId: saved.clientId || envClientId,
  tokens: saved.tokens ?? null,
  playback: null,
  error: null,
  busy: false,
})

const persist = () => {
  const s = store.get()
  saveJSON(KEY, { clientId: s.clientId, tokens: s.tokens })
}
const patch = (p: Partial<SpotifyState>) => store.update((s) => ({ ...s, ...p }))

export const useSpotify = (): SpotifyState => useStore(store)
export const spotifyConnected = (): boolean => !!store.get().tokens

export function setSpotifyClientId(id: string): void {
  patch({ clientId: id.trim() })
  persist()
}

// ---------- PKCE login ----------
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

function randomString(n: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

const PKCE_KEY = 'motodash.spotify.pkce'

export async function connectSpotify(): Promise<void> {
  const { clientId } = store.get()
  if (!clientId) {
    patch({ error: 'Add your Spotify Client ID first (Settings → Spotify).' })
    return
  }
  const verifier = randomString(64)
  const state = randomString(16)
  const challenge = b64url(await sha256(new TextEncoder().encode(verifier)))
  saveJSON(PKCE_KEY, { verifier, state, redirect: redirectUri() })
  const url = `${AUTH_URL}?${new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
    state,
  })}`
  patch({ error: null })
  if (isNative) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url, presentationStyle: 'popover' })
  } else {
    location.href = url
  }
}

/** Handle the redirect back (motodash://callback?code=… in the app, ?code=… on the web). */
export async function handleSpotifyRedirect(url: string): Promise<boolean> {
  const u = new URL(url)
  const code = u.searchParams.get('code')
  const err = u.searchParams.get('error')
  const state = u.searchParams.get('state')
  if (!code && !err) return false
  const pkce = loadJSON<{ verifier: string; state: string; redirect: string } | null>(PKCE_KEY, null)
  saveJSON(PKCE_KEY, null)
  if (err || !pkce || state !== pkce.state) {
    patch({ error: err === 'access_denied' ? 'Spotify login was cancelled.' : 'Spotify login failed. Try again.' })
    return true
  }
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code!,
        redirect_uri: pkce.redirect,
        client_id: store.get().clientId,
        code_verifier: pkce.verifier,
      }),
    })
    if (!res.ok) throw new Error(`Spotify login error ${res.status}`)
    saveTokens(await res.json())
    void refreshPlayback()
  } catch (e) {
    patch({ error: e instanceof Error ? e.message : 'Spotify login failed' })
  }
  return true
}

function saveTokens(t: { access_token: string; refresh_token?: string; expires_in: number }): void {
  const prev = store.get().tokens
  patch({
    tokens: {
      access: t.access_token,
      // A refresh response may omit refresh_token: keep the old one then.
      refresh: t.refresh_token ?? prev?.refresh ?? '',
      expiresAt: Date.now() + t.expires_in * 1000,
    },
    error: null,
  })
  persist()
}

export function disconnectSpotify(): void {
  patch({ tokens: null, playback: null, error: null })
  persist()
}

let refreshing: Promise<string | null> | null = null

async function accessToken(force = false): Promise<string | null> {
  const t = store.get().tokens
  if (!t) return null
  if (!force && Date.now() < t.expiresAt - 60_000) return t.access
  refreshing ??= (async () => {
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh, client_id: store.get().clientId }),
      })
      if (res.status === 400 || res.status === 401) {
        // invalid_grant: refresh token expired/revoked → log in again.
        patch({ tokens: null, playback: null, error: 'Spotify session expired. Connect again.' })
        persist()
        return null
      }
      if (!res.ok) return null
      saveTokens(await res.json())
      return store.get().tokens!.access
    } catch {
      return null
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

let backoffUntil = 0

/** Authenticated Web API call. Returns parsed JSON, or null for empty (204) responses. */
async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<{ status: number; data: T | null }> {
  if (Date.now() < backoffUntil) return { status: 429, data: null }
  const token = await accessToken()
  if (!token) return { status: 401, data: null }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  })
  if (res.status === 401 && !retried) {
    await accessToken(true)
    return api<T>(path, init, true)
  }
  if (res.status === 429) {
    backoffUntil = Date.now() + Number(res.headers.get('Retry-After') ?? 5) * 1000
  }
  const text = res.status === 204 ? '' : await res.text()
  let data: T | null = null
  try {
    data = text ? (JSON.parse(text) as T) : null
  } catch {
    data = null
  }
  return { status: res.status, data }
}

// ---------- Playback ----------
interface ApiPlayback {
  is_playing: boolean
  progress_ms: number | null
  shuffle_state: boolean
  device?: { name: string }
  item?: {
    name: string
    uri: string
    duration_ms: number
    artists?: { name: string }[]
    album?: { name: string; images?: { url: string; width: number }[] }
    show?: { name: string; images?: { url: string }[] }
  } | null
}

export async function refreshPlayback(): Promise<void> {
  if (!spotifyConnected()) return
  const { status, data } = await api<ApiPlayback>('/me/player')
  if (status === 204 || (status === 200 && !data)) {
    patch({ playback: { isPlaying: false, track: null, progressMs: 0, shuffle: false, deviceName: null, fetchedAt: Date.now() } })
    return
  }
  if (status === 403) return patch({ error: 'Spotify refused (Premium required, or your account is not on the app’s user list).' })
  if (status !== 200 || !data) return
  const it = data.item
  const images = it?.album?.images ?? it?.show?.images ?? []
  patch({
    error: null,
    playback: {
      isPlaying: data.is_playing,
      progressMs: data.progress_ms ?? 0,
      shuffle: data.shuffle_state,
      deviceName: data.device?.name ?? null,
      fetchedAt: Date.now(),
      track: it
        ? {
            name: it.name,
            uri: it.uri,
            durationMs: it.duration_ms,
            artists: it.artists?.map((a) => a.name).join(', ') ?? it.show?.name ?? '',
            album: it.album?.name ?? '',
            // Second-largest image is plenty for the widget.
            artUrl: (images[1] ?? images[0])?.url ?? null,
          }
        : null,
    },
  })
}

/** Send a player command; if no device is active, wake the phone's Spotify device and retry. */
async function command(method: 'PUT' | 'POST', path: string, body?: unknown): Promise<void> {
  patch({ busy: true })
  try {
    let r = await api(path, { method, body: body ? JSON.stringify(body) : undefined })
    if (r.status === 404) {
      const devices = await api<{ devices: { id: string | null; name: string; type: string; is_active: boolean }[] }>('/me/player/devices')
      const list = devices.data?.devices.filter((d) => d.id) ?? []
      const target = list.find((d) => d.type === 'Smartphone') ?? list[0]
      if (target?.id) {
        await api('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [target.id], play: false }) })
        r = await api(path, { method, body: body ? JSON.stringify(body) : undefined })
      } else {
        patch({ error: 'Spotify isn’t open on this phone. Tap “Open Spotify”, start any song once, then come back.' })
      }
    }
    if (r.status === 403) patch({ error: 'Spotify refused that action (Premium is required for playback control).' })
  } finally {
    patch({ busy: false })
    // Spotify needs a moment to apply the change before the state reflects it.
    setTimeout(() => void refreshPlayback(), 400)
  }
}

export const play = () => command('PUT', '/me/player/play')
export const pause = () => command('PUT', '/me/player/pause')
export const nextTrack = () => command('POST', '/me/player/next')
export const previousTrack = () => command('POST', '/me/player/previous')
export const setShuffle = (on: boolean) => command('PUT', `/me/player/shuffle?state=${on}`)
export const playContext = (contextUri: string) => command('PUT', '/me/player/play', { context_uri: contextUri })

export function togglePlay(): Promise<void> {
  return store.get().playback?.isPlaying ? pause() : play()
}

export async function getPlaylists(): Promise<Playlist[]> {
  const { data } = await api<{ items: { id: string; name: string; uri: string; images?: { url: string }[] | null; owner?: { display_name?: string } }[] }>(
    '/me/playlists?limit=50',
  )
  return (data?.items ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    uri: p.uri,
    imageUrl: p.images?.[p.images.length - 1]?.url ?? p.images?.[0]?.url ?? null,
    owner: p.owner?.display_name ?? '',
  }))
}

// ---------- Polling ----------
let pollTimer: ReturnType<typeof setInterval> | null = null

/** Poll playback state while the app is in front (every 4 s; stays well inside Spotify's rate limits). */
export function startSpotifyPolling(): () => void {
  const tick = () => {
    if (document.visibilityState === 'visible') void refreshPlayback()
  }
  tick()
  pollTimer = setInterval(tick, 4000)
  const onVis = () => tick()
  document.addEventListener('visibilitychange', onVis)
  return () => {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
    document.removeEventListener('visibilitychange', onVis)
  }
}

/** Listen for the login redirect: app URL (native) or the page's own ?code= (web). */
let redirectsReady = false

export async function initSpotifyRedirects(): Promise<void> {
  if (redirectsReady) return
  redirectsReady = true
  if (isNative) {
    const { App } = await import('@capacitor/app')
    await App.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(NATIVE_REDIRECT)) return
      const { Browser } = await import('@capacitor/browser')
      await Browser.close().catch(() => {})
      await handleSpotifyRedirect(url)
    })
    return
  }
  if (location.search.includes('code=') || location.search.includes('error=')) {
    const handled = await handleSpotifyRedirect(location.href)
    if (handled) history.replaceState(null, '', `${location.pathname}${location.hash || '#/music'}`)
  }
}
