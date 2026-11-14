import { NextTurnCard, SpeedCard, TripStats, UsageBanner } from '../../components/Cards'
import Icon from '../../components/Icon'
import { useLocation } from '../../lib/location'
import { addStop, endRide, planRoute, useNav } from '../../lib/nav'
import { type Place, addRecent } from '../../lib/places'
import { wakeLockSupported } from '../../lib/wakelock'
import type { ProviderState } from '../../map/provider'
import SearchPanel from './SearchPanel'
import { PinSheet, RouteSheet } from './Sheets'
import StopsPanel from './StopsPanel'

export type NavPanel = 'none' | 'search' | 'stops'

export interface PinState {
  place: Place
  loading: boolean
}

interface Props {
  follow: boolean
  onRecenter: () => void
  provider: ProviderState
  panel: NavPanel
  setPanel: (p: NavPanel) => void
  pin: PinState | null
  setPin: (p: PinState | null) => void
  onRideStarted: () => void
}

/** Everything drawn on top of the full-screen map on the Navigate screen. */
export default function NavScreen({ follow, onRecenter, provider, panel, setPanel, pin, setPin, onRideStarted }: Props) {
  const loc = useLocation()
  const nav = useNav()
  const riding = nav.status === 'riding'

  const go = (place: Place) => {
    addRecent(place)
    setPanel('none')
    setPin(null)
    void planRoute(place)
  }

  return (
    <div className="nav-overlay">
      <div className="nav-top">
        <UsageBanner />
        {provider.reason && (
          <div className="banner info" role="status">
            Map: OpenFreeMap. {provider.reason}
          </div>
        )}
        {nav.status === 'idle' && !pin && (
          <button type="button" className="btn search-btn" onClick={() => setPanel('search')}>
            <Icon name="navigate" /> Where to?
          </button>
        )}
        {riding && nav.nextTurn && <NextTurnCard turn={nav.nextTurn} />}
        {riding && nav.rerouting && <div className="banner info">Re-routing…</div>}
        {riding && nav.error && !nav.rerouting && <div className="banner warn">{nav.error}</div>}
        {riding && !wakeLockSupported && (
          <div className="banner info">Screen may sleep: set iPhone Auto-Lock to Never while riding.</div>
        )}
      </div>

      <div className="nav-bottom-area">
        <div className="nav-bottom">
          <SpeedCard loc={loc} compact />
          {!follow && (
            <button type="button" className="btn primary" onClick={onRecenter}>
              <Icon name="locate" />
              Recenter
            </button>
          )}
        </div>

        {riding && !pin && (
          <div className="ride-controls">
            <TripStats nav={nav} />
            <div className="btn-row">
              <button type="button" className="btn grow" onClick={() => setPanel('stops')}>
                Stops on route
              </button>
              <button type="button" className="btn danger grow" onClick={endRide}>
                End ride
              </button>
            </div>
          </div>
        )}

        {nav.status === 'arrived' && (
          <div className="sheet">
            <div className="sheet-title ok">You have arrived</div>
            <div className="row-sub">{nav.destination?.name}</div>
            <button type="button" className="btn primary big-btn" onClick={endRide}>
              Done
            </button>
          </div>
        )}

        {(nav.status === 'routing' || nav.status === 'preview') && !pin && (
          <RouteSheet nav={nav} onStops={() => setPanel('stops')} onStart={onRideStarted} />
        )}

        {pin && (
          <PinSheet
            pin={pin}
            riding={riding}
            onGo={() => go(pin.place)}
            onAddStop={() => {
              addStop(pin.place)
              setPin(null)
            }}
            onClose={() => setPin(null)}
          />
        )}
      </div>

      {panel === 'search' && <SearchPanel onPick={go} onClose={() => setPanel('none')} />}
      {panel === 'stops' && <StopsPanel onClose={() => setPanel('none')} />}
    </div>
  )
}
