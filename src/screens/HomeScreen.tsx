import Icon, { type IconName } from '../components/Icon'
import { openSpotifyApp } from '../lib/links'
import { UsageBanner } from '../components/Cards'
import { useNav } from '../lib/nav'
import type { Screen } from '../lib/route'

interface AppTile {
  label: string
  icon: IconName
  tone: string
  screen?: Screen
  action?: () => void
}

/** CarPlay-style home: a grid of big rounded app icons. */
export default function HomeScreen({ go }: { go: (s: Screen) => void }) {
  const nav = useNav()
  const apps: AppTile[] = [
    { label: 'Dashboard', icon: 'dash', tone: 'tone-accent', screen: 'dash' },
    { label: 'Maps', icon: 'navigate', tone: 'tone-maps', screen: 'nav' },
    { label: 'Music', icon: 'music', tone: 'tone-music', screen: 'music' },
    { label: 'Phone', icon: 'phone', tone: 'tone-phone', screen: 'phone' },
    { label: 'Spotify', icon: 'play', tone: 'tone-spotify', action: openSpotifyApp },
    { label: 'Settings', icon: 'settings', tone: 'tone-plain', screen: 'settings' },
  ]
  return (
    <div className="screen home-grid-screen">
      <UsageBanner />
      {nav.status === 'riding' && (
        <button type="button" className="banner info ride-pill" onClick={() => go('dash')}>
          Ride in progress: tap to return to the Dashboard
        </button>
      )}
      <div className="app-grid">
        {apps.map((a) => (
          <button
            key={a.label}
            type="button"
            className="app-launch"
            onClick={() => (a.screen ? go(a.screen) : a.action?.())}
          >
            <span className={`app-icon ${a.tone}`}>
              <Icon name={a.icon} size={46} />
            </span>
            <span className="app-name">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
