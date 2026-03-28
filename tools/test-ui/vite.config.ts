import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      // WebSocket 프록시: Vite(5173) → 백엔드(8000)
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,         // ← WebSocket 업그레이드 요청을 프록시로 처리하는 핵심 옵션
        changeOrigin: true,
      },
    },
  },
})

