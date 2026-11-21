import { useEffect, useState } from 'react'
import Icon from '../components/Icon'
import { NowPlayingFull } from '../components/NowPlaying'
import { MUSIC_APPS, openApp, openSpotifyApp } from '../lib/links'
import { type Playlist, connectSpotify, getPlaylists, playContext, useSpotify } from '../lib/spotify'

function Playlists({ onBack }: { onBack: () => void }) {
  const [items, setItems] = useState<Playlist[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    getPlaylists()
      .then((p) => alive && setItems(p))
      .catch(() => alive && setError('Could not load playlists'))
    return () => {
      alive = false
    }
  }, [])
  return (
    <div className="screen">
      <div className="title-row">
        <h1 className="screen-title">Playlists</h1>
        <button type="button" className="btn" onClick={onBack}>
          Now Playing
        </button>
      </div>
      {!items && !error && <p className="muted big">Loading…</p>}
      {error && <p className="error">{error}</p>}
      {items?.length === 0 && <p className="muted">No playlists found.</p>}
      <div className="list">
        {items?.map((p) => (
          <button
            key={p.id}
            type="button"
            className="list-row"
            onClick={() => {
              void playContext(p.uri)
              onBack()
            }}
          >
            {p.imageUrl ? <img className="pl-art" src={p.imageUrl} alt="" /> : <span className="pl-art empty" />}
            <span className="row-main">
              <span className="row-title">{p.name}</span>
              <span className="row-sub">{p.owner}</span>
            </span>
            <Icon name="play" size={26} />
          </button>
        ))}
      </div>
    </div>
  )
}

export default function MusicScreen() {
  const { tokens, clientId, error } = useSpotify()
  const [view, setView] = useState<'now' | 'playlists'>('now')

  if (!tokens) {
    return (
      <div className="screen">
        <h1 className="screen-title">
          <Icon name="music" size={32} /> Music
        </h1>
        <div className="card">
          <h2>Control Spotify from here</h2>
          <p className="muted">
            Connect your Spotify Premium account once. Then play, pause, skip and pick playlists right from Moto Dash, and
            see what’s playing on the Dashboard.
          </p>
          {error && <p className="error">{error}</p>}
          {clientId ? (
            <button type="button" className="btn primary big-btn" onClick={() => void connectSpotify()}>
              Connect Spotify
            </button>
          ) : (
            <p className="big">First add your Spotify Client ID in Settings → Spotify.</p>
          )}
        </div>
        <div className="music-shortcuts">
          {MUSIC_APPS.map((a) => (
            <button key={a.id} type="button" className="tile" onClick={() => openApp(a.app, a.web)}>
              <Icon name="music" size={36} />
              <span>Open {a.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (view === 'playlists') return <Playlists onBack={() => setView('now')} />

  return (
    <div className="screen music-now">
      {error && <div className="banner warn">{error}</div>}
      <NowPlayingFull onPlaylists={() => setView('playlists')} />
      <button type="button" className="btn" onClick={openSpotifyApp}>
        Open Spotify app
      </button>
    </div>
  )
}
