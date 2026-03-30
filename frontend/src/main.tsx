import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import './index.css'
import { initializeSentry } from './lib/errorMonitoring.ts'

// Initialize error monitoring (MUST BE FIRST)
initializeSentry()

// Wrap App with Sentry error boundary
const SentryApp = Sentry.withProfiler(App)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SentryApp />
  </React.StrictMode>,
)
