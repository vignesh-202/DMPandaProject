import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const resolveApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host === 'dmpanda.com' || host === 'admin.dmpanda.com' || host.endsWith('.dmpanda.com')) {
      return 'https://api.dmpanda.com';
    }
    if (host.includes('-5173.') && host.endsWith('.devtunnels.ms')) {
      return `${window.location.protocol}//${host.replace('-5173.', '-5000.')}`;
    }
  }
  const envBase = String(((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL) || '').trim().replace(/\/+$/, '');
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

