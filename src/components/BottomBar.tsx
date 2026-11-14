import type { Screen } from '../lib/route'
import Icon, { type IconName } from './Icon'

type Item = { screen: Screen; label: string; icon: IconName }

const HOME: Item = { screen: 'home', label: 'Home', icon: 'home' }
const DASH: Item = { screen: 'dash', label: 'Dash', icon: 'dash' }
const REST: Item[] = [
  { screen: 'nav', label: 'Map', icon: 'navigate' },
  { screen: 'music', label: 'Music', icon: 'music' },
  { screen: 'phone', label: 'Phone', icon: 'phone' },
  { screen: 'settings', label: 'Settings', icon: 'settings' },
]

/** While riding, the first slot becomes the Dashboard instead of Home. */
export default function BottomBar({ current, onSelect, riding }: { current: Screen; onSelect: (s: Screen) => void; riding: boolean }) {
  const items = [riding ? DASH : HOME, ...REST]
  return (
    <nav className="bottom-bar" aria-label="Screens">
      {items.map((it) => (
        <button
          key={it.screen}
          type="button"
          className={`bar-btn${current === it.screen ? ' active' : ''}`}
          aria-current={current === it.screen ? 'page' : undefined}
          onClick={() => onSelect(it.screen)}
        >
          <Icon name={it.icon} />
          <span>{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
