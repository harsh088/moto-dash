import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { navStore } from './lib/nav'

// Dev-only hook for automated testing in the browser console.
if (import.meta.env.DEV) (window as unknown as { __motodash: unknown }).__motodash = { navStore }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
