import { NextTurnCard, SpeedCard, TripStats } from '../components/Cards'
import { useLocation } from '../lib/location'
import { endRide, useNav } from '../lib/nav'
import type { Screen } from '../lib/route'
import { MusicShortcuts } from './MusicScreen'

/**
 * CarPlay-style Dashboard: the map (positioned by App via .map-layer.dash) takes the
 * largest area; this panel holds next turn, speed, trip stats and music shortcuts.
 */
export default function DashScreen({ go }: { go: (s: Screen) => void }) {
  const loc = useLocation()
  const nav = useNav()
  const riding = nav.status === 'riding'
  return (
    <div className="dash-panel">
      <div className="dash-turn">
        {riding && nav.nextTurn ? (
          <NextTurnCard turn={nav.nextTurn} size="mini" />
        ) : nav.status === 'arrived' ? (
          <div className="card">
            <div className="sheet-title ok">You have arrived</div>
            <button type="button" className="btn primary" onClick={endRide}>
              Done
            </button>
          </div>
        ) : (
          <button type="button" className="card next-turn" onClick={() => go('nav')}>
            <div className="next-turn-text">
              <div className="next-turn-instr">{riding ? 'Follow the route' : 'No active ride'}</div>
              {!riding && <div className="next-turn-hint">Tap to choose a destination</div>}
            </div>
          </button>
        )}
      </div>
      <div className="dash-row">
        <SpeedCard loc={loc} compact />
        {riding && <TripStats nav={nav} />}
      </div>
      <div className="dash-music">
        <MusicShortcuts compact />
      </div>
    </div>
  )
}
