import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './styles/design-tokens.css'
import './styles/base.css'
import './styles/components.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/pages/login.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
