import { useEffect, useState } from 'react'
import { openSpotifyApp } from '../lib/links'
import { type Playback, connectSpotify, nextTrack, previousTrack, setShuffle, togglePlay, useSpotify } from '../lib/spotify'
import Icon from './Icon'

/** Progress that keeps moving smoothly between the 4-second polls. */
function useLiveProgress(pb: Playback | null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!pb?.isPlaying) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [pb?.isPlaying])
  if (!pb?.track) return 0
  const p = pb.isPlaying ? pb.progressMs + Math.max(0, now - pb.fetchedAt) : pb.progressMs
  return Math.min(p, pb.track.durationMs)
}

const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function Controls({ size = 'big' }: { size?: 'big' | 'small' }) {
  const { playback, busy } = useSpotify()
  const playing = playback?.isPlaying ?? false
  const icon = size === 'big' ? 40 : 30
  return (
    <div className={`np-controls ${size}`}>
      <button type="button" className="np-btn" onClick={() => void previousTrack()} disabled={busy} aria-label="Previous track">
        <Icon name="prev" size={icon} />
      </button>
      <button type="button" className="np-btn play" onClick={() => void togglePlay()} disabled={busy} aria-label={playing ? 'Pause' : 'Play'}>
        <Icon name={playing ? 'pause' : 'play'} size={icon + 6} />
      </button>
      <button type="button" className="np-btn" onClick={() => void nextTrack()} disabled={busy} aria-label="Next track">
        <Icon name="next" size={icon} />
      </button>
    </div>
  )
}

function Art({ url, size }: { url: string | null | undefined; size: 'big' | 'small' }) {
  return url ? (
    <img className={`np-art ${size}`} src={url} alt="" />
  ) : (
    <div className={`np-art ${size} empty`}>
      <Icon name="music" size={size === 'big' ? 72 : 32} />
    </div>
  )
}

/** Compact "Now Playing" card for the Dashboard. */
export function NowPlayingWidget({ onOpen }: { onOpen: () => void }) {
  const { tokens, playback } = useSpotify()
  if (!tokens) {
    return (
      <div className="card np-widget">
        <button type="button" className="np-info plain-btn" onClick={onOpen}>
          <Art url={null} size="small" />
          <span className="np-text">
            <span className="np-title">Music</span>
            <span className="np-sub">Connect Spotify to control music here</span>
          </span>
        </button>
        <button type="button" className="btn primary" onClick={() => void connectSpotify()}>
          Connect
        </button>
      </div>
    )
  }
  const t = playback?.track
  return (
    <div className="card np-widget">
      <button type="button" className="np-info plain-btn" onClick={onOpen} aria-label="Open Now Playing">
        <Art url={t?.artUrl} size="small" />
        <span className="np-text">
          <span className="np-title">{t?.name ?? 'Not playing'}</span>
          <span className="np-sub">{t ? t.artists : 'Open Spotify and play something'}</span>
        </span>
      </button>
      {t ? (
        <Controls size="small" />
      ) : (
        <button type="button" className="btn" onClick={openSpotifyApp}>
          Open Spotify
        </button>
      )}
    </div>
  )
}

/** Full-screen Now Playing (CarPlay style). */
export function NowPlayingFull({ onPlaylists }: { onPlaylists: () => void }) {
  const { playback, busy } = useSpotify()
  const progress = useLiveProgress(playback)
  const t = playback?.track
  return (
    <div className="np-full">
      <Art url={t?.artUrl} size="big" />
      <div className="np-full-side">
        <div className="np-full-text">
          <div className="np-full-title">{t?.name ?? 'Nothing playing'}</div>
          <div className="np-full-artist">{t?.artists ?? 'Start music in Spotify or pick a playlist'}</div>
          {t?.album && <div className="np-sub">{t.album}</div>}
        </div>
        {t && (
          <div className="np-progress" aria-label={`${mmss(progress)} of ${mmss(t.durationMs)}`}>
            <div className="np-bar">
              <div style={{ width: `${(progress / t.durationMs) * 100}%` }} />
            </div>
            <div className="np-times">
              <span>{mmss(progress)}</span>
              <span>-{mmss(t.durationMs - progress)}</span>
            </div>
          </div>
        )}
        <Controls />
        <div className="btn-row">
          <button
            type="button"
            className={`btn grow${playback?.shuffle ? ' on' : ''}`}
            onClick={() => void setShuffle(!playback?.shuffle)}
            disabled={busy || !t}
            aria-pressed={playback?.shuffle ?? false}
          >
            <Icon name="shuffle" size={24} /> Shuffle {playback?.shuffle ? 'on' : 'off'}
          </button>
          <button type="button" className="btn grow" onClick={onPlaylists}>
            <Icon name="list" size={24} /> Playlists
          </button>
        </div>
        {playback?.deviceName && <div className="np-sub small">Playing on {playback.deviceName}</div>}
      </div>
    </div>
  )
}
