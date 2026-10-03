import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const manifestPath = join(process.env.RUNNER_TEMP || tmpdir(), 'saytara-pages-stage-paths.json')
const paths = JSON.parse(await readFile(manifestPath, 'utf8'))
if (!Array.isArray(paths) || paths.length === 0 || paths.some(path => typeof path !== 'string')) {
  throw new Error('The Pages staging manifest is missing or invalid.')
}

const protectedRootEntries = new Set(['.git', '.github', 'docs', 'dist', 'node_modules', 'public', 'scripts', 'src', 'supabase'])
for (const path of paths) {
  const segments = path.split('/')
  if (
    !path || path.startsWith('/') || path.includes('\\') ||
    segments.some(segment => !segment || segment === '.' || segment === '..' || !/^[\p{L}\p{N}._-]+$/u.test(segment)) ||
    (segments[0].startsWith('.') && path !== '.nojekyll') ||
    protectedRootEntries.has(segments[0])
  ) {
    throw new Error(`Refusing unsafe Pages staging path: ${path}`)
  }
}

const result = spawnSync('git', ['add', '--all', '--', ...paths], { stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`git add exited with status ${result.status}`)
console.log(`Staged ${paths.length} generated Pages path(s) only.`)
