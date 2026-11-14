import { useState } from 'react'
import { formatDistance, formatDuration, formatTime } from '../../lib/format'
import { googleMapsDirectionsUrl } from '../../lib/links'
import {
  type NavState,
  cancelRoute,
  removeStop,
  retryRoute,
  selectRoute,
  startRide,
} from '../../lib/nav'
import { type Place, saveFavourite } from '../../lib/places'

/** "Save" button that turns into Home / Work / Favourite choices. */
export function SaveButton({ place }: { place: Place }) {
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  if (saved) return <span className="saved-note">Saved as {saved}</span>
  if (!open)
    return (
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        ★ Save
      </button>
    )
  const save = (kind: 'home' | 'work' | 'custom', label: string) => {
    saveFavourite(kind, place)
    setSaved(label)
  }
  return (
    <div className="btn-row">
      <button type="button" className="btn" onClick={() => save('home', 'Home')}>
        Home
      </button>
      <button type="button" className="btn" onClick={() => save('work', 'Work')}>
        Work
      </button>
      <button type="button" className="btn" onClick={() => save('custom', 'Favourite')}>
        Favourite
      </button>
    </div>
  )
}

export function GoogleMapsButton({ dest, stops }: { dest: Place; stops: Place[] }) {
  return (
    <a className="btn" href={googleMapsDirectionsUrl(dest, stops)} target="_blank" rel="noopener noreferrer">
      Open in Google Maps
    </a>
  )
}

/** Shown after a long-press on the map. */
export function PinSheet({
  pin,
  riding,
  onGo,
  onAddStop,
  onClose,
}: {
  pin: { place: Place; loading: boolean }
  riding: boolean
  onGo: () => void
  onAddStop: () => void
  onClose: () => void
}) {
  return (
    <div className="sheet" role="dialog" aria-label="Dropped pin">
      <div className="sheet-title">{pin.loading ? 'Finding address…' : pin.place.name}</div>
      {!pin.loading && <div className="row-sub">{pin.place.address}</div>}
      <div className="btn-row">
        {riding ? (
          <button type="button" className="btn primary grow" onClick={onAddStop}>
            Add as stop
          </button>
        ) : (
          <button type="button" className="btn primary grow" onClick={onGo}>
            Go here
          </button>
        )}
        <button type="button" className="btn" onClick={onClose}>
          Close
        </button>
      </div>
      {!pin.loading && <SaveButton place={pin.place} />}
    </div>
  )
}

/** Route choices before the ride starts. */
export function RouteSheet({ nav, onStops, onStart }: { nav: NavState; onStops: () => void; onStart: () => void }) {
  const dest = nav.destination!
  const loading = nav.status === 'routing' || nav.rerouting
  return (
    <div className="sheet" role="dialog" aria-label="Route options">
      <div className="sheet-head">
        <div>
          <div className="sheet-title">{dest.name}</div>
          <div className="row-sub">{dest.address}</div>
        </div>
        <button type="button" className="btn" onClick={cancelRoute}>
          Cancel
        </button>
      </div>

      {loading && <p className="muted big">Finding motorcycle routes…</p>}
      {!loading && nav.error && (
        <div className="error-box">
          <p>{nav.error}</p>
          <button type="button" className="btn" onClick={() => void retryRoute()}>
            Try again
          </button>
        </div>
      )}

      {!loading && nav.routes.length > 0 && (
        <div className="route-options">
          {nav.routes.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={`route-option${i === nav.selected ? ' active' : ''}`}
              onClick={() => selectRoute(i)}
              aria-pressed={i === nav.selected}
            >
              <span className="route-time">{formatDuration(r.durationS)}</span>
              <span className="route-dist">{formatDistance(r.distanceM)}</span>
              <span className={r.trafficDelayS > 60 ? 'route-delay bad' : 'route-delay good'}>
                {r.trafficDelayS > 60 ? `+${formatDuration(r.trafficDelayS)} traffic` : 'No delays'}
              </span>
              <span className="route-eta">Arrive {formatTime(r.arrival)}</span>
            </button>
          ))}
        </div>
      )}
      {nav.routes.length > 1 && <p className="muted small">Tap a grey route on the map or a card to choose it.</p>}

      {nav.stops.length > 0 && (
        <div className="stops-list">
          {nav.stops.map((s, i) => (
            <div key={`${s.lat},${s.lon}`} className="list-row-wrap">
              <div className="list-row static">
                <span className="row-main">
                  <span className="row-title">Stop: {s.name}</span>
                  <span className="row-sub">{s.address}</span>
                </span>
              </div>
              <button type="button" className="btn slim danger-text" onClick={() => removeStop(i)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row">
        <button type="button" className="btn grow" onClick={onStops} disabled={nav.routes.length === 0}>
          Stops on route
        </button>
        <GoogleMapsButton dest={dest} stops={nav.stops} />
      </div>
      <SaveButton place={dest} />
      {/* Sticky so the main action is always visible, even when the sheet scrolls. */}
      <div className="sheet-actions">
        <button
          type="button"
          className="btn primary big-btn"
          disabled={loading || nav.routes.length === 0}
          onClick={() => {
            startRide()
            onStart()
          }}
        >
          Start ride
        </button>
      </div>
    </div>
  )
}
