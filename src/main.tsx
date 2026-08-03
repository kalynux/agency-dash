import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import '@/i18n' // initialises i18next before anything calls t() at module scope
import '@/lib/push' // installs window.joviGetPushToken (FCM) before first render
import App from './App.tsx'
import { StoreProvider } from '@/store'
import { LanguageProvider } from '@/i18n/LanguageProvider'

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
