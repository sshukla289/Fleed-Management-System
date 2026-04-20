import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@tanstack/react-query',
      '@tanstack/query-core',
      'leaflet',
      'leaflet.markercluster',
      'recharts',
    ],
  },
  define: {
    global: 'window',
  },
  resolve: {
    alias: {
      'sockjs-client': 'sockjs-client/dist/sockjs.js',
    },
  },
  server: {
    watch: {
      usePolling: true,
    },
  },
})
