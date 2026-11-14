import { Capacitor, registerPlugin } from '@capacitor/core'
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation'

/**
 * Native (Capacitor iOS/Android) helpers. On the web every function here is a no-op
 * and the browser APIs are used instead, so the same code runs in both places.
 */
export const isNative = Capacitor.isNativePlatform()

// The plugin ships only type definitions; it is registered by name (see its README).
export const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

export async function nativeKeepAwake(on: boolean): Promise<void> {
  if (!isNative) return
  const { KeepAwake } = await import('@capacitor-community/keep-awake')
  try {
    if (on) await KeepAwake.keepAwake()
    else await KeepAwake.allowSleep()
  } catch {
    /* not supported */
  }
}

export interface NativeVoice {
  voiceURI: string
  name: string
  lang: string
}

let voiceCache: NativeVoice[] | null = null

/** System voices, in the order the TTS plugin indexes them. */
export async function nativeVoices(): Promise<NativeVoice[]> {
  if (!isNative) return []
  if (voiceCache) return voiceCache
  const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
  try {
    const { voices } = await TextToSpeech.getSupportedVoices()
    voiceCache = voices.map((v) => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang }))
  } catch {
    voiceCache = []
  }
  return voiceCache
}

/** Speak with the iOS speech engine (keeps working in the background, plays over music). */
export async function nativeSpeak(text: string, opts: { lang: string; rate: number; volume: number; voiceIndex: number }): Promise<void> {
  const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
  await TextToSpeech.speak({
    text,
    lang: opts.lang,
    rate: opts.rate,
    volume: opts.volume,
    voice: opts.voiceIndex,
    category: 'playback',
    queueStrategy: 0, // flush: a new prompt replaces an old one
  })
}

export async function nativeStopSpeaking(): Promise<void> {
  if (!isNative) return
  const { TextToSpeech } = await import('@capacitor-community/text-to-speech')
  await TextToSpeech.stop().catch(() => {})
}
