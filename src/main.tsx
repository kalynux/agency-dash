import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import '@/i18n' // initialises i18next before anything calls t() at module scope
import '@/lib/push' // installs window.wiMallGetPushToken (FCM web) before first render
import '@/platform/push' // the native half of the same seam, plus token-rotation listeners (P4.1)
import '@/platform/accessToken' // installs window.wiMallGetAccessToken for geo-tracker (P4.6)
import App from './App.tsx'
import { StoreProvider } from '@/store'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import { hideSplashWhenPainted } from '@/platform/shell/splash'
import { initStatusBar } from '@/platform/shell/statusBar'
import { initKeyboard } from '@/platform/shell/keyboard'
import { installExternalLinkInterceptor } from '@/platform/browser'

// Native shell behaviour (CAPACITOR-PLAN.md → Phase 3). All three are no-ops
// off native, and all three run BEFORE render: the status bar should already
// match the theme in the first painted frame, the keyboard listeners should
// exist before a screen can focus a field, and a link should never be able to
// navigate the WebView away — not even one clicked during the first second.
initStatusBar()
initKeyboard()
installExternalLinkInterceptor()

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
