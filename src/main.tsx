import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import '@/i18n' // initialises i18next before anything calls t() at module scope
import '@/lib/push' // installs window.wiMallGetPushToken (FCM) before first render
import App from './App.tsx'
import { StoreProvider } from '@/store'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { hideSplashWhenPainted } from '@/platform/shell/splash'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)

// Native only; a no-op in the browser. Deliberately after render() and not
// awaiting the session bootstrap — the user should see the app's own loading
// state, which is honest about what is happening, rather than a static logo
// that is not.
hideSplashWhenPainted()
