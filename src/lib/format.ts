export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(0, m >= 100 ? Math.round(m / 50) * 50 : Math.round(m / 10) * 10)} m`
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`
}

export function formatDuration(s: number): string {
  const min = Math.max(1, Math.round(s / 60))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h ${String(min % 60).padStart(2, '0')}`
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-IN')
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
