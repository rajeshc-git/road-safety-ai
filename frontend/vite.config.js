import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:8000'
const backendWsTarget = backendTarget.replace(/^http/, 'ws')

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Listen on all addresses (required for Docker port forwarding)
    allowedHosts: ['cooper-ment-jeans-passes.trycloudflare.com', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': backendTarget,
      '/ws': { target: backendWsTarget, ws: true },
    },
  },

  build: {
    outDir: 'dist',
  },
})
