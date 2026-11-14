import { formatDistance, formatDuration, formatTime } from '../lib/format'
import type { LocationState } from '../lib/location'
import type { NavState, NextTurn } from '../lib/nav'
import { useUsage, usageWarnings } from '../lib/usage'
import { repeatLast, spokenDistance } from '../lib/voice'
import TurnArrow from './TurnArrow'

export function SpeedCard({ loc, compact = false }: { loc: LocationState; compact?: boolean }) {
  const speed = loc.fix?.speedKmh
  return (
    <div className={`card speed-card${compact ? ' compact' : ''}`}>
      <div className="speed-value">{speed == null ? '--' : Math.round(speed)}</div>
      <div className="speed-unit">km/h</div>
      {!loc.fix && !compact && <div className="speed-note">{loc.error ?? 'Waiting for GPS…'}</div>}
    </div>
  )
}

/** Big next-turn card. Tapping it repeats the last voice prompt. */
export function NextTurnCard({ turn, size = 'normal' }: { turn: NextTurn; size?: 'normal' | 'mini' }) {
  const repeat = () =>
    repeatLast(`In ${spokenDistance(turn.distanceM)}, ${turn.instruction[0].toLowerCase()}${turn.instruction.slice(1)}.`)
  return (
    <button type="button" className={`card next-turn ${size}`} onClick={repeat} aria-label={`${turn.instruction}. Tap to repeat voice prompt`}>
      <div className="next-turn-icon">
        <TurnArrow code={turn.maneuver} size={size === 'mini' ? 40 : 60} />
      </div>
      <div className="next-turn-text">
        <div className="next-turn-dist">{formatDistance(turn.distanceM)}</div>
        <div className="next-turn-instr">{turn.instruction}</div>
        {size !== 'mini' && <div className="next-turn-hint">Tap to repeat</div>}
      </div>
    </button>
  )
}

/** Remaining distance, time and arrival clock during a ride. */
export function TripStats({ nav }: { nav: NavState }) {
  const p = nav.progress
  if (!p) return null
  const arrival = new Date(p.arrivalMs)
  return (
    <div className="card trip-stats">
      <div>
        <div className="stat-value ok">{formatTime(arrival)}</div>
        <div className="stat-label">arrival</div>
      </div>
      <div>
        <div className="stat-value">{formatDuration(p.remainingS)}</div>
        <div className="stat-label">left</div>
      </div>
      <div>
        <div className="stat-value">{formatDistance(p.remainingM)}</div>
        <div className="stat-label">to go</div>
      </div>
    </div>
  )
}

/** Shown at 80 %+ of any TomTom free allowance. */
export function UsageBanner() {
  const warnings = usageWarnings(useUsage())
  if (warnings.length === 0) return null
  return (
    <div className="banner warn" role="status">
      TomTom usage high: {warnings.map((w) => `${w.label} ${Math.round(w.pct * 100)}%`).join(', ')}
    </div>
  )
}
