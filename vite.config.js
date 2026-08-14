import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 使构建产物可在 GitHub Pages 子路径下部署
export default defineConfig({
  plugins: [react()],
  base: './',
})
