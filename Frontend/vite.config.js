import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  build: {
    // Enable CSS code splitting so each route only loads what it needs
    cssCodeSplit: true,
    // Target modern browsers for smaller output
    target: 'es2020',
    // Terser for slightly smaller bundles (optional, esbuild is faster)
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('react-router') || id.includes('@remix-run')) {
            return 'router';
          }

          if (
            id.includes('recharts')
            || id.includes('react-gauge-chart')
            || id.includes('/d3-')
            || id.includes('\\d3-')
          ) {
            return 'charts';
          }

          if (
            id.includes('lucide-react')
            || id.includes('react-icons')
            || id.includes('@fortawesome')
          ) {
            return 'icons';
          }

          if (
            id.includes('/react/')
            || id.includes('\\react\\')
            || id.includes('react-dom')
            || id.includes('scheduler')
          ) {
            return 'react-core';
          }

          return 'vendor';
        },
      },
    },
    // Report compressed output sizes
    reportCompressedSize: true,
    // Increase inline limit for very small assets (< 8KB inlined as base64)
    assetsInlineLimit: 8192,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
})
