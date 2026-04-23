import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const promoteDevtunnelTrustCookie = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const hostname = window.location.hostname || ''
  if (!hostname.endsWith('.devtunnels.ms')) return

  const match = document.cookie.match(/(?:^|;\s*)tunnel_phishing_protection=([^;]+)/)
  const cookieValue = match?.[1]
  if (!cookieValue) return

  const parts = hostname.split('.')
  if (parts.length < 4) return

  const sharedDomain = `.${parts.slice(1).join('.')}`
  document.cookie = `tunnel_phishing_protection=${cookieValue}; domain=${sharedDomain}; path=/; samesite=none; secure`
}

promoteDevtunnelTrustCookie()

createRoot(document.getElementById('root')!).render(
  <App />,
)
