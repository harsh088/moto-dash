import { useEffect, useState } from 'react'
import type { Screen } from '../lib/route'
import Icon, { type IconName } from './Icon'

type Item = { screen: Screen; label: string; icon: IconName; tone: string }

/** App icons in the dock, like CarPlay's sidebar. Colours are the theme tokens. */
const ITEMS: Item[] = [
  { screen: 'dash', label: 'Dashboard', icon: 'dash', tone: 'tone-accent' },
  { screen: 'nav', label: 'Maps', icon: 'navigate', tone: 'tone-maps' },
  { screen: 'music', label: 'Music', icon: 'music', tone: 'tone-music' },
  { screen: 'phone', label: 'Phone', icon: 'phone', tone: 'tone-phone' },
]

function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  return now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(/\s?[AP]M$/i, '')
}

/**
 * CarPlay-style dock: a sidebar on the left in landscape, a bar at the bottom in portrait.
 * Clock on top, app icons, and the Home (all apps) button.
 */
export default function Dock({ current, onSelect }: { current: Screen; onSelect: (s: Screen) => void }) {
  const clock = useClock()
  return (
    <nav className="dock" aria-label="Apps">
      <div className="dock-clock" aria-label={`Time ${clock}`}>
        {clock}
      </div>
      <div className="dock-apps">
        {ITEMS.map((it) => (
          <button
            key={it.screen}
            type="button"
            className={`dock-btn${current === it.screen ? ' active' : ''}`}
            aria-current={current === it.screen ? 'page' : undefined}
            onClick={() => onSelect(it.screen)}
          >
            <span className={`app-icon small ${it.tone}`}>
              <Icon name={it.icon} size={26} />
            </span>
            <span className="dock-label">{it.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={`dock-btn dock-home${current === 'home' ? ' active' : ''}`}
        onClick={() => onSelect('home')}
      >
        <span className="app-icon small tone-plain">
          <Icon name="grid" size={24} />
        </span>
        <span className="dock-label">All apps</span>
      </button>
    </nav>
  )
}
