import { createStore, loadJSON, saveJSON, useStore } from './store'

export type ThemeMode = 'night' | 'day' | 'auto'

export interface Settings {
  themeMode: ThemeMode
  traffic: boolean
  voiceEnabled: boolean
  /** chosen SpeechSynthesisVoice.voiceURI, '' = automatic (en-IN > en-GB > en-US) */
  voiceURI: string
  voiceRate: number
  voiceVolume: number
  chime: boolean
}

const KEY = 'motodash.settings.v1'
const DEFAULTS: Settings = {
  themeMode: 'night',
  traffic: true,
  voiceEnabled: true,
  voiceURI: '',
  voiceRate: 1,
  voiceVolume: 1,
  chime: true,
}

const store = createStore<Settings>({ ...DEFAULTS, ...loadJSON<Partial<Settings>>(KEY, {}) })

export function updateSettings(patch: Partial<Settings>): void {
  store.update((s) => ({ ...s, ...patch }))
  saveJSON(KEY, store.get())
}

export const useSettings = (): Settings => useStore(store)
export const getSettings = (): Settings => store.get()
