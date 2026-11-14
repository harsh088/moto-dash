import Icon from '../components/Icon'
import { MUSIC_APPS, openApp } from '../lib/links'
import { isNative } from '../lib/native'

/** Compact shortcuts, also used inside the Dashboard. */
export function MusicShortcuts({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'music-shortcuts compact' : 'music-shortcuts'}>
      {MUSIC_APPS.map((a) => (
        <button key={a.id} type="button" className={`tile music-${a.id}${compact ? ' small' : ''}`} onClick={() => openApp(a.app, a.web)}>
          {!compact && <Icon name="music" size={44} />}
          <span>{compact ? a.label : `Open ${a.label}`}</span>
        </button>
      ))}
    </div>
  )
}

export default function MusicScreen() {
  return (
    <div className="screen">
      <h1 className="screen-title">
        <Icon name="music" size={32} /> Music
      </h1>
      <MusicShortcuts />
      <div className="card">
        <p className="muted">
          {isNative
            ? 'Start your music, then come back. Navigation keeps running and speaking during a ride even while the music app is open. Use your headset buttons to skip tracks.'
            : 'This web version can only open your music app. Use your headset or the lock screen to skip tracks. Full music control (play/pause, track info) comes with the native app version later.'}
        </p>
      </div>
    </div>
  )
}
