import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
// Perf (bundle-split): do NOT configure Monaco here. configureMonaco()
// calls loader.init() which downloads the ~900KB Monaco editor core — on
// EVERY page including the landing page. It is now lazily invoked by
// RightPanelEditor on first editor render (see ensureMonacoConfigured).

const googleClientId =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  import.meta.env.VITE_GOOGLE_CLIENTID ||
  '439925019035-5qicn1624vopg9emh08dfnpu69b9qfc2.apps.googleusercontent.com'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Legacy cleanup handled in index.html to avoid races.
