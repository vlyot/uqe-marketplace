// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  build: { sourcemap: true }
})
