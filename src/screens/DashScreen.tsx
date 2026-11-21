import { NextTurnCard, SpeedCard, TripStats } from '../components/Cards'
import Icon from '../components/Icon'
import { NowPlayingWidget } from '../components/NowPlaying'
import { telHref, useContacts } from '../lib/contacts'
import { useLocation } from '../lib/location'
import { endRide, planRoute, useNav } from '../lib/nav'
import { addRecent, useFavourites } from '../lib/places'
import type { Screen } from '../lib/route'

/**
 * CarPlay-style Dashboard. The map (positioned by App via .map-layer.screen-dash) takes the
 * largest area; this column holds the widgets: navigation, now playing, speed and quick calls.
 */
export default function DashScreen({ go }: { go: (s: Screen) => void }) {
  const loc = useLocation()
  const nav = useNav()
  const favourites = useFavourites()
  const contacts = useContacts()
  const riding = nav.status === 'riding'
  const quick = favourites.filter((f) => f.kind === 'home' || f.kind === 'work').slice(0, 2)

  const navWidget = riding ? (
    nav.nextTurn ? (
      <NextTurnCard turn={nav.nextTurn} size="mini" />
    ) : (
      <div className="card widget-title">Follow the route</div>
    )
  ) : nav.status === 'arrived' ? (
    <div className="card">
      <div className="sheet-title ok">You have arrived</div>
      <button type="button" className="btn primary" onClick={endRide}>
        Done
      </button>
    </div>
  ) : (
    <div className="card dash-where">
      <button type="button" className="btn search-btn" onClick={() => go('nav')}>
        <Icon name="navigate" /> Where to?
      </button>
      {quick.length > 0 && (
        <div className="btn-row">
          {quick.map((f) => (
            <button
              key={f.id}
              type="button"
              className="btn grow"
              onClick={() => {
                addRecent(f.place)
                void planRoute(f.place)
                go('nav')
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="dash-panel">
      {navWidget}
      <div className="dash-row">
        <SpeedCard loc={loc} compact />
        {riding ? (
          <TripStats nav={nav} />
        ) : (
          contacts.length > 0 && (
            <div className="dash-calls">
              {contacts.slice(0, 2).map((c) => (
                <a key={c.id} className="btn call-btn" href={telHref(c.number)}>
                  <Icon name="phone" size={22} /> {c.name}
                </a>
              ))}
            </div>
          )
        )}
      </div>
      <NowPlayingWidget onOpen={() => go('music')} />
    </div>
  )
}
