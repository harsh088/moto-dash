import { useEffect, useState } from 'react'
import type { ThemeMode } from './settings'
import { isDaytime } from './sun'

/** Resolves the theme mode to night/day, re-checking every minute in auto mode. */
export function useIsNight(mode: ThemeMode, lat?: number, lon?: number): boolean {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (mode !== 'auto') return
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [mode])
  if (mode === 'night') return true
  if (mode === 'day') return false
  // Round location so tiny GPS movements don't matter.
  const rl = lat == null ? undefined : Math.round(lat * 10) / 10
  const ro = lon == null ? undefined : Math.round(lon * 10) / 10
  return !isDaytime(new Date(now), rl, ro)
}
