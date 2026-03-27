// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar React e React DOM
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Separar UI icons
          'lucide': ['lucide-react'],
          // Separar Firebase
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/functions'],
          // Separar utilitários de data
          'date-utils': ['date-fns'],
          // Separar outros utilitários grandes
          'utils': ['react-hot-toast', 'react-dropzone'],
        },
      },
    },
    // Aumentar o limite de warning para 1000 kB se necessário
    chunkSizeWarningLimit: 1000,
  },
})