import { useEffect, useMemo, useState } from 'react'
import './App.css'
import './features.css'
import BottomBar from './components/BottomBar'
import { useIsNight } from './lib/daynight'
import { startLocationWatch, useLocation } from './lib/location'
import { endRide, selectRoute, useNav } from './lib/nav'
import { reverseGeocode } from './lib/search'
import { startRideEngine } from './lib/rideEngine'
import { useScreen } from './lib/route'
import { useSettings } from './lib/settings'
import MapView, { type CameraMode, type MapMarker } from './map/MapView'
import { useMapProvider } from './map/provider'
import DashScreen from './screens/DashScreen'
import HomeScreen from './screens/HomeScreen'
import MusicScreen from './screens/MusicScreen'
import PhoneScreen from './screens/PhoneScreen'
import SettingsScreen from './screens/SettingsScreen'
import NavScreen, { type NavPanel, type PinState } from './screens/nav/NavScreen'

export default function App() {
  const [screen, go] = useScreen()
  const settings = useSettings()
  const { fix } = useLocation()
  const nav = useNav()
  const provider = useMapProvider()
  const night = useIsNight(settings.themeMode, fix?.lat, fix?.lon)
  const [follow, setFollow] = useState(true)
  const [panel, setPanel] = useState<NavPanel>('none')
  const [pin, setPin] = useState<PinState | null>(null)

  useEffect(() => {
    startRideEngine()
    return startLocationWatch()
  }, [])

  // New route options: stop following so the route overview stays visible.
  const [seenFitSeq, setSeenFitSeq] = useState(nav.fitSeq)
  if (nav.fitSeq !== seenFitSeq) {
    setSeenFitSeq(nav.fitSeq)
    setFollow(false)
  }

  const riding = nav.status === 'riding'
  const onMap = screen === 'nav' || screen === 'dash'
  const camera: CameraMode = !follow ? 'free' : riding ? 'ride' : 'follow'

  const markers = useMemo<MapMarker[]>(() => {
    const list: MapMarker[] = []
    if (nav.destination) list.push({ id: 'dest', kind: 'dest', lat: nav.destination.lat, lon: nav.destination.lon, label: nav.destination.name })
    nav.stops.forEach((s, i) => list.push({ id: `stop-${i}`, kind: 'stop', lat: s.lat, lon: s.lon, label: `Stop ${i + 1}` }))
    if (pin) list.push({ id: 'pin', kind: 'pin', lat: pin.place.lat, lon: pin.place.lon, label: pin.loading ? 'Pin' : pin.place.name })
    return list
  }, [nav.destination, nav.stops, pin])

  const onLongPress = async (lat: number, lon: number) => {
    if (screen !== 'nav') return
    setPanel('none')
    const placeholder = { name: 'Dropped pin', address: '', lat, lon }
    setPin({ place: placeholder, loading: true })
    const place = await reverseGeocode(lat, lon)
    // Ignore if the pin was closed or replaced meanwhile.
    setPin((p) => (p && p.place.lat === lat && p.place.lon === lon ? { place, loading: false } : p))
  }

  return (
    <div className="app">
      <main className="screen-area">
        {/* The map stays mounted on every screen so tiles aren't re-downloaded. */}
        <div className={`map-layer screen-${screen}${onMap ? '' : ' hidden'}`} aria-hidden={!onMap}>
          <MapView
            visible={onMap}
            night={night}
            traffic={settings.traffic && provider.provider === 'tomtom'}
            provider={provider.provider}
            fix={fix}
            camera={camera}
            routeBearing={nav.progress?.bearing ?? null}
            routes={nav.routes}
            selectedRoute={nav.selected}
            markers={markers}
            fitSeq={nav.fitSeq}
            onUserPan={() => setFollow(false)}
            onLongPress={(lat, lon) => void onLongPress(lat, lon)}
            onSelectRoute={selectRoute}
          />
          {screen === 'nav' && (
            <NavScreen
              follow={follow}
              onRecenter={() => setFollow(true)}
              provider={provider}
              panel={panel}
              setPanel={setPanel}
              pin={pin}
              setPin={setPin}
              onRideStarted={() => {
                setFollow(true)
                setPanel('none')
                go('dash')
              }}
            />
          )}
          {screen === 'dash' && riding && (
            <button type="button" className="btn danger dash-end" onClick={endRide}>
              End ride
            </button>
          )}
          {screen === 'dash' && !follow && (
            <button type="button" className="btn primary dash-recenter" onClick={() => setFollow(true)}>
              Recenter
            </button>
          )}
        </div>

        {screen === 'dash' && <DashScreen go={go} />}
        {screen === 'home' && <HomeScreen go={go} />}
        {screen === 'music' && <MusicScreen />}
        {screen === 'phone' && <PhoneScreen />}
        {screen === 'settings' && <SettingsScreen provider={provider} night={night} />}
      </main>
      <BottomBar current={screen} onSelect={go} riding={riding} />
    </div>
  )
}
