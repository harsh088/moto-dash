import { useEffect, useState } from 'react'

export type Screen = 'home' | 'nav' | 'dash' | 'music' | 'phone' | 'settings'
const SCREENS: Screen[] = ['home', 'nav', 'dash', 'music', 'phone', 'settings']

function read(): Screen {
  const s = location.hash.replace(/^#\/?/, '') as Screen
  return SCREENS.includes(s) ? s : 'home'
}

/** Minimal hash routing (#/home, #/nav, ...): works on GitHub Pages and in Capacitor. */
export function useScreen(): [Screen, (s: Screen) => void] {
  const [screen, setScreen] = useState<Screen>(read)
  useEffect(() => {
    const onHash = () => setScreen(read())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (s: Screen) => {
    if (s !== read()) location.hash = `/${s}`
  }
  return [screen, go]
}
