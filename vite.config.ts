import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)))
const defaultSiteUrl = 'https://proexcellencenetwork-art.github.io/mojtama-al-saytara/'
const configuredSiteUrl = process.env.VITE_SITE_URL?.trim() || defaultSiteUrl
let siteBase = '/'
try {
  const siteUrl = new URL(configuredSiteUrl)
  if (siteUrl.protocol !== 'https:') throw new Error('VITE_SITE_URL must use https:// for public canonical URLs.')
  const sitePath = siteUrl.pathname
  siteBase = sitePath.endsWith('/') ? sitePath : `${sitePath}/`
} catch {
  throw new Error('VITE_SITE_URL must be an absolute https:// URL.')
}

export default defineConfig({
  root: resolve(projectRoot, 'src'),
  envDir: projectRoot,
  publicDir: resolve(projectRoot, 'public'),
  base: process.env.GITHUB_PAGES === 'true' ? siteBase : '/',
  plugins: [react()],
  build: {
    outDir: resolve(projectRoot, 'dist'),
    emptyOutDir: true,
  },
})
