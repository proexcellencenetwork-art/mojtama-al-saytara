import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(projectRoot, 'dist')
const builtEntries = new Set(await readdir(distDir))
if (!builtEntries.has('index.html') || !builtEntries.has('assets') || !builtEntries.has('404.html')) {
  throw new Error('Expected a complete Vite/prerender build in dist/; run npm run build first.')
}

const manifestPath = resolve(projectRoot, 'manus-routes.json')
let previousRoutes = []
try {
  const previous = JSON.parse(await readFile(manifestPath, 'utf8'))
  previousRoutes = Array.isArray(previous.routes) ? previous.routes : []
} catch { /* first staging run */ }
let nextManifest = { routes: [] }
try { nextManifest = JSON.parse(await readFile(resolve(distDir, 'manus-routes.json'), 'utf8')) } catch { throw new Error('The postbuild manifest is missing.') }
const nextRoutePaths = new Set(nextManifest.routes.map(route => route.path))
for (const route of previousRoutes) {
  if (nextRoutePaths.has(route.path) || route.path === '/') continue
  const segments = route.path.split('/').filter(Boolean)
  if (segments.every(segment => /^[\p{L}\p{N}._-]+$/u.test(segment)) && !segments.includes('..')) {
    const target = resolve(projectRoot, ...segments)
    if (target.startsWith(`${projectRoot}${sep}`)) await rm(target, { recursive: true, force: true })
  }
}

// Root-based GitHub Pages publishes from the repository root; copy every built
// file and nested route directory so direct public/member URLs resolve cleanly.
await rm(resolve(projectRoot,'assets'), { recursive: true, force: true })
for (const entry of await readdir(distDir)) {
  if (entry === '.nojekyll') continue
  await cp(resolve(distDir, entry), resolve(projectRoot, entry), { recursive: true, force: true })
}
await mkdir(projectRoot, { recursive: true })
await writeFile(resolve(projectRoot, '.nojekyll'), '')
console.log(`Staged ${nextManifest.routes.length} route shells and all generated static/SEO assets at repository root.`)
