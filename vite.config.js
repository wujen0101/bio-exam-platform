import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/bio-exam-platform/', // GitHub Pages 部署路徑（改成你的 repo 名稱）
})
