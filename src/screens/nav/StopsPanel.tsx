import { useState } from 'react'
import { formatDistance, formatDuration } from '../../lib/format'
import { addStop, selectedRoute, useNav } from '../../lib/nav'
import { type AlongResult, POI_KINDS, type PoiKind, searchAlongRoute } from '../../lib/poi'
import { tomtomAvailable } from '../../lib/tomtom'

/** Fuel / Food / ATM / Toilets along the route ahead. Tap one to ride via it. */
export default function StopsPanel({ onClose }: { onClose: () => void }) {
  const nav = useNav()
  const route = selectedRoute(nav)
  const [kind, setKind] = useState<PoiKind | null>(null)
  const [results, setResults] = useState<AlongResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (k: PoiKind) => {
    if (!route) return
    setKind(k)
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      setResults(await searchAlongRoute(k, route, nav.progress?.alongM ?? 0, nav.progress?.seg ?? 0))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel stops-panel" role="dialog" aria-label="Stops along route">
      <div className="search-head">
        <h1 className="panel-title">Stops on route</h1>
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
      {!tomtomAvailable() && <div className="banner info">Needs TomTom, which isn't available right now.</div>}
      <div className="poi-kinds">
        {POI_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            className={`tile small${kind === k.kind ? ' primary' : ''}`}
            onClick={() => void run(k.kind)}
            disabled={!route || loading || !tomtomAvailable()}
          >
            {k.label}
          </button>
        ))}
      </div>
      <div className="list">
        {loading && <p className="muted pad">Searching along your route…</p>}
        {error && <p className="error pad">{error}</p>}
        {results?.length === 0 && <p className="muted pad">Nothing found within 10 minutes of detour.</p>}
        {results?.map((r, i) => (
          <button
            key={`${r.place.lat},${r.place.lon},${i}`}
            type="button"
            className="list-row"
            onClick={() => {
              addStop(r.place)
              onClose()
            }}
          >
            <span className="row-main">
              <span className="row-title">{r.place.name}</span>
              <span className="row-sub">{r.place.address}</span>
            </span>
            <span className="row-meta">
              <span>{formatDistance(Math.max(0, r.aheadM))} ahead</span>
              <span className="row-sub">{r.detourS > 30 ? `+${formatDuration(r.detourS)} detour` : 'no detour'}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
