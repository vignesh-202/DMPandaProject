import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const resolveApiBaseUrl = () => {
  const envBase = String(((globalThis as any).__DM_PANDA_ADMIN_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL) || '').trim().replace(/\/+$/, '')
  return envBase
}

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

if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).__DM_PANDA_ADMIN_API_BASE_URL__ = resolveApiBaseUrl()
}

createRoot(document.getElementById('root')!).render(
  <App />,
)

