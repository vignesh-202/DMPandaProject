import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('react-router') || id.includes('@remix-run')) {
            return 'router';
          }

          if (
            id.includes('recharts')
            || id.includes('/d3-')
            || id.includes('\\d3-')
          ) {
            return 'charts';
          }

          if (id.includes('appwrite') || id.includes('axios')) {
            return 'data';
          }

          if (id.includes('lucide-react') || id.includes('framer-motion')) {
            return 'ui-vendor';
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
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
})
