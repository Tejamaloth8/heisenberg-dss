import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth':  'http://localhost:8000',
      '/files': 'http://localhost:8000',
    }
  },
  define: {
    __API_URL__: JSON.stringify(
      mode === 'production'
        ? (process.env.VITE_API_URL || '')
        : ''
    )
  }
}))
