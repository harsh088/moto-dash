import Icon from '../components/Icon'
import { formatNumber } from '../lib/format'
import { openLocationSettings } from '../lib/location'
import { isNative } from '../lib/native'
import { clearRecents } from '../lib/places'
import { clearSearchCache } from '../lib/search'
import { type ThemeMode, updateSettings, useSettings } from '../lib/settings'
import { USAGE_LIMITS, WARN_AT, clearTomTomBlock, resetUsage, usedFor, useUsage } from '../lib/usage'
import { NATIVE_REDIRECT, connectSpotify, disconnectSpotify, setSpotifyClientId, useSpotify, webRedirect } from '../lib/spotify'
import { say, unlockAudio, useEnglishVoices } from '../lib/voice'
import { type ProviderState, TOMTOM_KEY, setSessionFallback } from '../map/provider'

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'night', label: 'Night' },
  { value: 'day', label: 'Day' },
  { value: 'auto', label: 'Auto (sunset)' },
]

function Toggle({ label, on, onChange, disabled }: { label: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      className={`toggle${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
      disabled={disabled}
    >
      <span>{label}</span>
      <span className="toggle-state">{on ? 'ON' : 'OFF'}</span>
    </button>
  )
}

export default function SettingsScreen({ provider, night }: { provider: ProviderState; night: boolean }) {
  const settings = useSettings()
  const usage = useUsage()
  const voices = useEnglishVoices()
  const spotify = useSpotify()

  const retryTomTom = () => {
    clearTomTomBlock()
    setSessionFallback(null)
  }

  const testVoice = () => {
    unlockAudio()
    void say('In 200 metres, turn left onto M G Road.', { force: true })
  }

  return (
    <div className="screen settings">
      <h1 className="screen-title">
        <Icon name="settings" size={32} /> Settings
      </h1>

      <section className="card">
        <h2>Map theme</h2>
        <div className="segmented" role="radiogroup" aria-label="Map theme">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={settings.themeMode === m.value}
              className={settings.themeMode === m.value ? 'active' : ''}
              onClick={() => updateSettings({ themeMode: m.value })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="muted">Showing the {night ? 'night' : 'day'} map now.</p>
      </section>

      <section className="card">
        <h2>Traffic</h2>
        <Toggle
          label="Live traffic on map"
          on={settings.traffic}
          onChange={(traffic) => updateSettings({ traffic })}
          disabled={provider.provider !== 'tomtom'}
        />
        {provider.provider !== 'tomtom' && <p className="muted">Traffic needs TomTom (not available on OpenFreeMap).</p>}
      </section>

      <section className="card">
        <h2>Voice guidance</h2>
        <Toggle label="Voice prompts" on={settings.voiceEnabled} onChange={(voiceEnabled) => updateSettings({ voiceEnabled })} />
        <Toggle label="Chime before prompts" on={settings.chime} onChange={(chime) => updateSettings({ chime })} />
        <label className="field">
          <span>Voice</span>
          <select
            className="text-input"
            value={settings.voiceURI}
            onChange={(e) => updateSettings({ voiceURI: e.target.value })}
          >
            <option value="">Automatic (clearest English: India, UK, US)</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Speed: {settings.voiceRate.toFixed(1)}×</span>
          <input
            type="range"
            min={0.7}
            max={1.5}
            step={0.1}
            value={settings.voiceRate}
            onChange={(e) => updateSettings({ voiceRate: Number(e.target.value) })}
          />
        </label>
        <label className="field">
          <span>Volume: {Math.round(settings.voiceVolume * 100)}%</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={settings.voiceVolume}
            onChange={(e) => updateSettings({ voiceVolume: Number(e.target.value) })}
          />
        </label>
        <button type="button" className="btn primary" onClick={testVoice}>
          Test voice
        </button>
        <p className="muted small">Volume here is the voice level inside the app; the iPhone volume buttons set the overall level.</p>
      </section>

      {isNative && (
        <section className="card">
          <h2>Location</h2>
          <p className="muted">For guidance with the screen locked or while music is open, allow location access for Moto Dash.</p>
          <button type="button" className="btn" onClick={() => void openLocationSettings()}>
            Open iPhone settings for Moto Dash
          </button>
        </section>
      )}

      <section className="card">
        <h2>Spotify</h2>
        <p className="muted">
          Needs Spotify Premium and a free app at developer.spotify.com (one time). Add this Redirect URI there:
        </p>
        <code className="code-line">{isNative ? NATIVE_REDIRECT : webRedirect()}</code>
        <label className="field">
          <span>Client ID</span>
          <input
            className="text-input"
            value={spotify.clientId}
            onChange={(e) => setSpotifyClientId(e.target.value)}
            placeholder="Paste the Client ID from the Spotify dashboard"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        {spotify.error && <p className="error">{spotify.error}</p>}
        {spotify.tokens ? (
          <button type="button" className="btn" onClick={disconnectSpotify}>
            Disconnect Spotify
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={() => void connectSpotify()} disabled={!spotify.clientId}>
            Connect Spotify
          </button>
        )}
      </section>

      <section className="card">
        <h2>Map provider</h2>
        <p className="big">{provider.provider === 'tomtom' ? 'TomTom' : 'OpenFreeMap (fallback)'}</p>
        {provider.reason && <p className="muted">{provider.reason}</p>}
        {provider.provider !== 'tomtom' && TOMTOM_KEY && (
          <button type="button" className="btn" onClick={retryTomTom}>
            Try TomTom again
          </button>
        )}
      </section>

      <section className="card">
        <h2>TomTom usage</h2>
        <p className="muted">
          Counted on this device. Free limits are per TomTom account, per month. Search switches to Photon automatically when
          the monthly Search allowance is used up.
        </p>
        <div className="usage-list">
          {USAGE_LIMITS.map((l) => {
            const used = usedFor(usage, l)
            const pct = l.limit ? used / l.limit : 0
            const warn = pct >= WARN_AT
            return (
              <div key={l.category} className={`usage-row${warn ? ' warn' : ''}`}>
                <div className="usage-head">
                  <span>{l.label}</span>
                  <span>
                    {formatNumber(used)}
                    {l.limit ? ` / ${formatNumber(l.limit)}` : ''} {l.period === 'day' ? 'today' : 'this month'}
                  </span>
                </div>
                {l.limit && (
                  <div className="meter" aria-hidden="true">
                    <div style={{ width: `${Math.min(100, pct * 100)}%` }} />
                  </div>
                )}
                {warn && <div className="warn-text">Over 80% of the free limit</div>}
                <div className="muted small">Today: {formatNumber(usage.today[l.category])}</div>
              </div>
            )
          })}
        </div>
        <button type="button" className="btn" onClick={resetUsage}>
          Reset counters
        </button>
      </section>

      <section className="card">
        <h2>Data on this phone</h2>
        <div className="btn-row">
          <button type="button" className="btn grow" onClick={clearRecents}>
            Clear recent places
          </button>
          <button type="button" className="btn grow" onClick={clearSearchCache}>
            Clear search cache
          </button>
        </div>
      </section>
    </div>
  )
}
