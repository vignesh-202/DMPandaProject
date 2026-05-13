import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const resolveApiBaseUrl = () => {
  const envBase = String(((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL) || '').trim().replace(/\/+$/, '');
  if (typeof window === 'undefined') return envBase;

  const { hostname, protocol } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  if (hostname.endsWith('.devtunnels.ms')) {
    const hostMatch = hostname.match(/^(.*?)-\d+(\..+)$/);
    if (hostMatch) {
      return `${protocol}//${hostMatch[1]}-5000${hostMatch[2]}`;
    }
  }

  if (!envBase) {
    if (isLocalHost) return `${protocol}//${hostname}:5000`;
    return envBase;
  }

  if (isLocalHost) return envBase;

  if (/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(envBase)) {
    return `${protocol}//${hostname.replace(/:\d+$/, '')}`;
  }

  return envBase;
};

const promoteDevtunnelTrustCookie = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const hostname = window.location.hostname || '';
  if (!hostname.endsWith('.devtunnels.ms')) return;

  const match = document.cookie.match(/(?:^|;\s*)tunnel_phishing_protection=([^;]+)/);
  const cookieValue = match?.[1];
  if (!cookieValue) return;

  const parts = hostname.split('.');
  if (parts.length < 4) return;

  const sharedDomain = `.${parts.slice(1).join('.')}`;
  document.cookie = `tunnel_phishing_protection=${cookieValue}; domain=${sharedDomain}; path=/; samesite=none; secure`;
};

promoteDevtunnelTrustCookie();

if (typeof globalThis !== 'undefined') {
  (globalThis as any).__DM_PANDA_API_BASE_URL__ = resolveApiBaseUrl();
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
}

