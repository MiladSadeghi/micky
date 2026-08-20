import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { FlyoverApp } from './components/flyover-app'

const isFlyover = new URLSearchParams(window.location.search).has('flyover')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isFlyover ? <FlyoverApp /> : <App />}</StrictMode>
)
