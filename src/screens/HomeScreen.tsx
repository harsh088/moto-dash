import { NextTurnCard, SpeedCard, UsageBanner } from '../components/Cards'
import Icon, { type IconName } from '../components/Icon'
import { useLocation } from '../lib/location'
import { useNav } from '../lib/nav'
import type { Screen } from '../lib/route'

export default function HomeScreen({ go }: { go: (s: Screen) => void }) {
  const loc = useLocation()
  const nav = useNav()
  const riding = nav.status === 'riding'
  const tiles: { screen: Screen; label: string; icon: IconName; primary?: boolean }[] = [
    riding
      ? { screen: 'dash', label: 'Dashboard', icon: 'dash', primary: true }
      : { screen: 'nav', label: 'Navigate', icon: 'navigate', primary: true },
    { screen: 'music', label: 'Music', icon: 'music' },
    { screen: 'phone', label: 'Phone', icon: 'phone' },
  ]
  return (
    <div className="screen home">
      <UsageBanner />
      <div className="home-top">
        <SpeedCard loc={loc} />
        {riding && nav.nextTurn && <NextTurnCard turn={nav.nextTurn} size="mini" />}
      </div>
      <div className="tiles">
        {tiles.map((t) => (
          <button
            key={t.screen}
            type="button"
            className={`tile${t.primary ? ' primary' : ''}`}
            onClick={() => go(t.screen)}
          >
            <Icon name={t.icon} size={48} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
