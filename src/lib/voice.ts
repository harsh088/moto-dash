import { useEffect, useState } from 'react'
import { isNative, nativeSpeak, nativeStopSpeaking, nativeVoices } from './native'
import { getSettings } from './settings'

/**
 * Voice guidance with speechSynthesis + a Web Audio chime.
 * iOS only allows audio after a user gesture, so call unlockAudio() from a tap (Start ride).
 */
let ctx: AudioContext | null = null
let lastPrompt: string | null = null

const synth = (): SpeechSynthesis | null => ('speechSynthesis' in window ? window.speechSynthesis : null)

export function unlockAudio(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC && !ctx) ctx = new AC()
    void ctx?.resume()
    // A silent buffer + a silent utterance inside the gesture unlocks both on iOS.
    if (ctx) {
      const src = ctx.createBufferSource()
      src.buffer = ctx.createBuffer(1, 1, 22050)
      src.connect(ctx.destination)
      src.start(0)
    }
    const s = synth()
    if (s) {
      const u = new SpeechSynthesisUtterance(' ')
      u.volume = 0
      s.speak(u)
    }
  } catch {
    /* audio not available */
  }
}

/** Two short rising tones, loud and bright enough to cut through wind noise. */
function playChime(volume: number): Promise<void> {
  if (!ctx || ctx.state !== 'running') return Promise.resolve()
  const t0 = ctx.currentTime + 0.02
  const tones: [number, number][] = [
    [988, 0],
    [1319, 0.16],
  ]
  for (const [freq, offset] of tones) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const start = t0 + offset
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, 0.9 * volume), start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15)
    osc.connect(gain).connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.16)
  }
  return new Promise((r) => setTimeout(r, 380))
}

/** Minimal voice shape shared by browser voices and native iOS voices. */
export interface VoiceInfo {
  voiceURI: string
  name: string
  lang: string
}

function voiceRank(v: VoiceInfo): number {
  const lang = v.lang.replace('_', '-').toLowerCase()
  let rank = lang === 'en-in' ? 0 : lang === 'en-gb' ? 10 : lang === 'en-us' ? 20 : lang.startsWith('en') ? 30 : 100
  if (/enhanced|premium|natural|neural|google/i.test(v.name + v.voiceURI)) rank -= 5
  return rank
}

const englishSorted = <T extends VoiceInfo>(list: T[]): T[] =>
  list
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .sort((a, b) => voiceRank(a) - voiceRank(b) || a.name.localeCompare(b.name))

export function englishVoices(): SpeechSynthesisVoice[] {
  const s = synth()
  return s ? englishSorted(s.getVoices()) : []
}

function pickVoice<T extends VoiceInfo>(voices: T[]): T | null {
  const { voiceURI } = getSettings()
  const english = englishSorted(voices)
  return english.find((v) => v.voiceURI === voiceURI) ?? english[0] ?? null
}

/** Speak a navigation prompt (chime first). Interrupts anything already speaking. */
export async function say(text: string, opts: { force?: boolean } = {}): Promise<void> {
  lastPrompt = text
  const settings = getSettings()
  if (!settings.voiceEnabled && !opts.force) return

  if (isNative) {
    // iOS speech engine: works with the screen locked / another app in front and plays over music.
    // The Web Audio chime only plays while the app is on screen.
    await nativeStopSpeaking()
    if (settings.chime && document.visibilityState === 'visible') await playChime(settings.voiceVolume)
    const voices = await nativeVoices()
    const v = pickVoice(voices)
    try {
      await nativeSpeak(text, {
        lang: v?.lang ?? 'en-IN',
        rate: settings.voiceRate,
        volume: settings.voiceVolume,
        voiceIndex: v ? voices.indexOf(v) : -1,
      })
    } catch {
      /* speech unavailable */
    }
    return
  }

  const s = synth()
  if (!s) return
  s.cancel()
  if (settings.chime) await playChime(settings.voiceVolume)
  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice(s.getVoices())
  if (v) u.voice = v
  u.lang = v?.lang ?? 'en-IN'
  u.rate = settings.voiceRate
  u.volume = settings.voiceVolume
  s.speak(u)
}

export function repeatLast(fallback?: string): void {
  const text = lastPrompt ?? fallback
  if (text) void say(text, { force: true })
}

export function stopVoice(): void {
  synth()?.cancel()
  void nativeStopSpeaking()
  lastPrompt = null
}

/** English voices for the Settings picker (native iOS voices in the app, browser voices on the web). */
export function useEnglishVoices(): VoiceInfo[] {
  const [voices, setVoices] = useState<VoiceInfo[]>(() => (isNative ? [] : englishVoices()))
  useEffect(() => {
    if (isNative) {
      let alive = true
      void nativeVoices().then((list) => alive && setVoices(englishSorted(list)))
      return () => {
        alive = false
      }
    }
    const s = synth()
    if (!s) return
    const update = () => setVoices(englishVoices())
    s.addEventListener('voiceschanged', update)
    return () => s.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

/** "In 500 metres" style phrases. */
export function spokenDistance(m: number): string {
  if (m >= 1000) {
    const km = Math.round(m / 100) / 10
    return `${km} ${km === 1 ? 'kilometre' : 'kilometres'}`
  }
  const r = m >= 100 ? Math.round(m / 50) * 50 : Math.max(10, Math.round(m / 10) * 10)
  return `${r} metres`
}
