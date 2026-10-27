import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        // 127.0.0.1 y no localhost: en algunas PCs localhost resuelve a IPv6 (::1) y el proxy no llega al backend (502)
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
})
