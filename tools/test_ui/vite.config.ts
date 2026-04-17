import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isRemote = mode === 'remote';
  const apiTarget = isRemote
    ? 'https://erica-capstone-2026-backend.onrender.com'
    : 'http://localhost:8000';
  const wsTarget = isRemote
    ? 'wss://erica-capstone-2026-backend.onrender.com'
    : 'ws://localhost:8000';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
        // WebSocket 프록시: Vite(5173) → 백엔드
        '/ws': {
          target: wsTarget,
          ws: true,         // ← WebSocket 업그레이드 요청을 프록시로 처리하는 핵심 옵션
          changeOrigin: true,
        },
      },
    },
  };
})

