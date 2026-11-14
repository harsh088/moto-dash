import { useEffect, useRef, useState } from 'react'
import { formatDistance } from '../../lib/format'
import { haversine } from '../../lib/geo'
import { useLocation } from '../../lib/location'
import {
  type FavouriteKind,
  type Place,
  removeFavourite,
  saveFavourite,
  useFavourites,
  useRecents,
} from '../../lib/places'
import { type SearchResponse, searchPlaces } from '../../lib/search'

interface Props {
  onPick: (place: Place) => void
  onClose: () => void
}

const DEBOUNCE_MS = 400
const MIN_CHARS = 3

export default function SearchPanel({ onPick, onClose }: Props) {
  const { fix } = useLocation()
  const favourites = useFavourites()
  const recents = useRecents()
  const [query, setQuery] = useState('')
  const [resp, setResp] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** when set, the next picked place is saved as Home/Work instead of navigating */
  const [assign, setAssign] = useState<FavouriteKind | null>(null)
  const fixRef = useRef(fix)
  useEffect(() => {
    fixRef.current = fix
  })

  const q = query.trim()
  const active = q.length >= MIN_CHARS

  useEffect(() => {
    if (!active) return
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const f = fixRef.current
        setResp(await searchPlaces(q, f ? { lat: f.lat, lon: f.lon } : null, ctrl.signal))
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [q, active])

  const pick = (p: Place) => {
    if (assign) {
      saveFavourite(assign, p)
      setAssign(null)
      setQuery('')
      return
    }
    onPick(p)
  }

  const dist = (p: Place) => (fix ? formatDistance(haversine(fix, p)) : '')
  const slot = (kind: 'home' | 'work') => favourites.find((f) => f.kind === kind)
  const custom = favourites.filter((f) => f.kind === 'custom')

  return (
    <div className="panel search-panel" role="dialog" aria-label="Search destination">
      <div className="search-head">
        <input
          className="search-input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoFocus
          placeholder={assign ? `Search to set ${assign === 'home' ? 'Home' : 'Work'}` : 'Where to?'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search places"
        />
        <button type="button" className="btn" onClick={assign ? () => setAssign(null) : onClose}>
          {assign ? 'Cancel' : 'Close'}
        </button>
      </div>

      {assign && <div className="banner info">Search and tap a place to save it as {assign === 'home' ? 'Home' : 'Work'}.</div>}

      {active ? (
        <div className="list">
          {loading && !resp && <p className="muted pad">Searching…</p>}
          {error && <p className="error pad">{error}</p>}
          {resp?.results.length === 0 && !loading && <p className="muted pad">No results.</p>}
          {resp?.results.map((r, i) => (
            <button key={`${r.lat},${r.lon},${i}`} type="button" className="list-row" onClick={() => pick(r)}>
              <span className="row-main">
                <span className="row-title">{r.name}</span>
                <span className="row-sub">{r.address}</span>
              </span>
              {r.distM != null && <span className="row-meta">{formatDistance(r.distM)}</span>}
            </button>
          ))}
          {resp && <p className="muted small pad">Results from {resp.source}</p>}
        </div>
      ) : (
        <div className="list">
          {q.length > 0 && <p className="muted pad">Type at least {MIN_CHARS} letters.</p>}
          {!assign && (
            <>
              <div className="fav-slots">
                {(['home', 'work'] as const).map((kind) => {
                  const f = slot(kind)
                  const label = kind === 'home' ? 'Home' : 'Work'
                  return (
                    <div key={kind} className="fav-slot">
                      <button type="button" className="tile small" onClick={() => (f ? onPick(f.place) : setAssign(kind))}>
                        <span>{label}</span>
                        <span className="row-sub">{f ? f.place.name : `Set ${label}`}</span>
                      </button>
                      {f && (
                        <button type="button" className="btn slim" onClick={() => setAssign(kind)}>
                          Change
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              {custom.length > 0 && <h2 className="list-head">Favourites</h2>}
              {custom.map((f) => (
                <div key={f.id} className="list-row-wrap">
                  <button type="button" className="list-row" onClick={() => onPick(f.place)}>
                    <span className="row-main">
                      <span className="row-title">★ {f.label}</span>
                      <span className="row-sub">{f.place.address}</span>
                    </span>
                    <span className="row-meta">{dist(f.place)}</span>
                  </button>
                  <button type="button" className="btn slim danger-text" onClick={() => removeFavourite(f.id)}>
                    Remove
                  </button>
                </div>
              ))}
              {recents.length > 0 && <h2 className="list-head">Recent</h2>}
              {recents.map((p, i) => (
                <button key={`${p.lat},${p.lon},${i}`} type="button" className="list-row" onClick={() => onPick(p)}>
                  <span className="row-main">
                    <span className="row-title">{p.name}</span>
                    <span className="row-sub">{p.address}</span>
                  </span>
                  <span className="row-meta">{dist(p)}</span>
                </button>
              ))}
              {recents.length === 0 && custom.length === 0 && (
                <p className="muted pad">Tip: long-press the map to drop a destination pin.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
