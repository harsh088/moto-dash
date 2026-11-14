/** Big maneuver arrow for TomTom maneuver codes (TURN_LEFT, KEEP_RIGHT, ROUNDABOUT_LEFT, ARRIVE, …). */
const STRAIGHT = 'M12 21V4M5 11l7-7 7 7'
const TURN = 'M6 21v-8a4 4 0 0 1 4-4h10M15 4l5 5-5 5'
const SLIGHT = 'M8 21v-6l9-9M10 6h7v7'
const SHARP = 'M7 3v9a5 5 0 0 0 8.5 3.5L19 12M19 19v-7h-7'
const UTURN = 'M7 21V9a5 5 0 0 1 10 0v6M13 11l4 4 4-4'
const ROUNDABOUT = 'M12 21v-6M12 15a4 4 0 1 0-4-4M8 11V6M8 11H3'
const ARRIVE = 'M6 21V4h11l-2.5 4.5L17 13H6'
const FERRY = 'M3 17l2 4h14l2-4H3Zm3-4h12M8 13V8h8v5M12 8V4'

function shape(code: string): { d: string; mirror: boolean } {
  const left = /LEFT/.test(code)
  if (/^(ARRIVE|WAYPOINT_REACHED)/.test(code)) return { d: ARRIVE, mirror: false }
  if (/UTURN|ROUNDABOUT_BACK/.test(code)) return { d: UTURN, mirror: !left && /RIGHT/.test(code) }
  if (/^ROUNDABOUT/.test(code)) return { d: ROUNDABOUT, mirror: /RIGHT/.test(code) }
  if (/FERRY/.test(code)) return { d: FERRY, mirror: false }
  if (/^SHARP_/.test(code)) return { d: SHARP, mirror: left }
  if (/^TURN_/.test(code)) return { d: TURN, mirror: left }
  if (/^(BEAR|KEEP)_|EXIT|WAYPOINT_(LEFT|RIGHT)|SWITCH/.test(code)) return { d: SLIGHT, mirror: left }
  return { d: STRAIGHT, mirror: false }
}

export default function TurnArrow({ code, size = 56 }: { code: string; size?: number }) {
  const { d, mirror } = shape(code)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={mirror ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d={d} />
    </svg>
  )
}
