/**
 * Keep the screen on during a ride.
 * 1. Screen Wake Lock API (Safari/iOS 16.4+, Chrome). Re-acquired when the app comes back to the foreground.
 * 2. Fallback for older iOS: a tiny muted, looping inline video drawn from a canvas
 *    (the same idea NoSleep.js uses), which keeps iOS from dimming. Best effort.
 * In the native app the KeepAwake plugin (iOS idleTimerDisabled) is used instead.
 */
import { isNative, nativeKeepAwake } from './native'

let sentinel: WakeLockSentinel | null = null
let wanted = false
let video: HTMLVideoElement | null = null
let drawTimer: ReturnType<typeof setInterval> | null = null

export const wakeLockSupported = isNative || (typeof navigator !== 'undefined' && 'wakeLock' in navigator)

async function acquire(): Promise<void> {
  if (!wanted || document.visibilityState !== 'visible') return
  if (wakeLockSupported) {
    try {
      if (!sentinel) {
        sentinel = await navigator.wakeLock.request('screen')
        sentinel.addEventListener('release', () => {
          sentinel = null
        })
      }
      return
    } catch {
      /* fall through to video fallback */
    }
  }
  startVideoFallback()
}

function startVideoFallback(): void {
  if (video) {
    void video.play().catch(() => {})
    return
  }
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 2
    const g = canvas.getContext('2d')
    const stream = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream?.(1)
    if (!g || !stream) return
    let flip = false
    drawTimer = setInterval(() => {
      flip = !flip
      g.fillStyle = flip ? '#000' : '#010101'
      g.fillRect(0, 0, 2, 2)
    }, 1000)
    video = document.createElement('video')
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0.01;pointer-events:none;bottom:0;left:0'
    video.srcObject = stream
    document.body.appendChild(video)
    void video.play().catch(() => {})
  } catch {
    /* nothing more we can do in a browser */
  }
}

document.addEventListener('visibilitychange', () => void acquire())

/** Call from a user gesture (Start ride). */
export function keepScreenOn(): void {
  wanted = true
  if (isNative) return void nativeKeepAwake(true)
  void acquire()
}

export function allowScreenSleep(): void {
  wanted = false
  if (isNative) return void nativeKeepAwake(false)
  void sentinel?.release().catch(() => {})
  sentinel = null
  if (drawTimer) clearInterval(drawTimer)
  drawTimer = null
  if (video) {
    video.pause()
    video.srcObject = null
    video.remove()
    video = null
  }
}
