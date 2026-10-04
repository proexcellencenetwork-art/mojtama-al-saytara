import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './design.css'
import './backend.css'
import './seo.css'
import './fonts.css'
import './performance.css'

// GitHub Pages serves 404.html for dynamic deep links. Restore the original same-origin
// path before BrowserRouter reads location so room IDs keep working after refresh.
const recoveredRoute = new URLSearchParams(window.location.search).get('__saytara_route')
if (recoveredRoute) {
  try {
    const target = new URL(recoveredRoute, window.location.origin)
    const basePath = import.meta.env.BASE_URL
    if (target.origin === window.location.origin && target.pathname.startsWith(basePath)) {
      window.history.replaceState(window.history.state, '', `${target.pathname}${target.search}${target.hash}`)
    }
  } catch { /* Ignore an invalid recovery URL and let the router show its normal 404 page. */ }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
