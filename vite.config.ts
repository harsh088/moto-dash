import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base: works at https://<user>.github.io/<repo>/ whatever the repo is called,
  // and later inside Capacitor (file-based). Screens use hash routing, so no server rewrites needed.
  base: './',
})
