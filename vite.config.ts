import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)))

export default defineConfig({
  root: resolve(projectRoot, 'src'),
  envDir: projectRoot,
  publicDir: resolve(projectRoot, 'public'),
  base: process.env.GITHUB_PAGES === 'true' ? '/mojtama-al-saytara/' : '/',
  plugins: [react()],
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: true,
  },
})
