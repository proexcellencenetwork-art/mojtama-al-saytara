import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(projectRoot, 'dist')
const outputNames = ['index.html', 'assets', 'favicon.svg', 'manus-routes.json']
const builtEntries = new Set(await readdir(distDir))

if (!builtEntries.has('index.html') || !builtEntries.has('assets')) {
  throw new Error('Expected a complete Vite build in dist/; run npm run build first.')
}

await rm(resolve(projectRoot, 'assets'), { recursive: true, force: true })
await mkdir(projectRoot, { recursive: true })
for (const name of outputNames) {
  if (!builtEntries.has(name)) {
    if (name === 'favicon.svg' || name === 'manus-routes.json') {
      throw new Error(`Required GitHub Pages file is missing from dist/: ${name}`)
    }
    continue
  }
  await cp(resolve(distDir, name), resolve(projectRoot, name), { recursive: true, force: true })
}
await writeFile(resolve(projectRoot, '.nojekyll'), '')
console.log('Staged compiled GitHub Pages files at repository root.')
