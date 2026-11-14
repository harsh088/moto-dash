import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Must be unique per Apple ID when sideloading; Sideloadly can override it if needed.
  appId: 'com.motodash.rider',
  appName: 'Moto Dash',
  webDir: 'dist',
  backgroundColor: '#262624',
  ios: {
    contentInset: 'never',
    backgroundColor: '#262624',
  },
}

export default config
