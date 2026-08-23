import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { FlyoverApp } from './components/flyover-app'
import { TooltipProvider } from './components/ui/tooltip'
import { applyAppearance } from './lib/appearance'
import { DEFAULT_FONT_FAMILY, DEFAULT_THEME } from './lib/settings'

const query = new URLSearchParams(window.location.search)
const isFlyover = query.has('flyover')
const theme = query.get('theme') === 'light' ? 'light' : DEFAULT_THEME
const fontFamily = query.get('fontFamily')?.trim() || DEFAULT_FONT_FAMILY
applyAppearance({ theme, fontFamily })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delay={250}>{isFlyover ? <FlyoverApp /> : <App />}</TooltipProvider>
  </StrictMode>
)
