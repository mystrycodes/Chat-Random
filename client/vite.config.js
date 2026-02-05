import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // simpler + recommended for Vite
    port: 3000,
    strictPort: true,
    https: {
      key: './certs/key.pem',
      cert: './certs/cert.pem'
    },
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        ws: true
      },
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        ws: true
      }
    },
    watch: {
      usePolling: true
    }
  }
})
