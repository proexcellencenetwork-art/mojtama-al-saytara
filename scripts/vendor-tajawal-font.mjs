import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(join(fileURLToPath(new URL('..', import.meta.url))))
const version = '5.3.0'
const weights = new Set(['400', '500', '700', '800'])
const subsets = new Set(['arabic', 'latin'])
const work = await mkdtemp(join(tmpdir(), 'mojtama-tajawal-'))

try {
  const packed = execFileSync('npm', ['pack', `@fontsource/tajawal@${version}`, '--silent', '--pack-destination', work], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).at(-1)
  if (!packed) throw new Error('npm did not return the pinned Tajawal package archive name.')
  const archive = join(work, packed)
  const cssFiles = ['package/LICENSE', ...[...weights].map(weight => `package/${weight}.css`)]
  execFileSync('tar', ['-xzf', archive, '-C', work, ...cssFiles], { stdio: 'inherit' })
  const matches = []
  for (const weight of weights) {
    const css = await readFile(join(work, `package/${weight}.css`), 'utf8')
    for (const match of css.matchAll(/\/\* tajawal-(arabic|latin)-(\d+)-normal \*\/\s*(@font-face\s*\{[^}]*\})/g)) matches.push(match)
  }
  const assetDir = resolve(root, 'src/assets/fonts')
  const licenseDir = resolve(root, 'public/fonts')
  await mkdir(assetDir, { recursive: true })
  await mkdir(licenseDir, { recursive: true })
  const faces = []

  for (const [, subset, weight, rawFace] of matches) {
    if (!subsets.has(subset) || !weights.has(weight)) continue
    const sourceName = `tajawal-${subset}-${weight}-normal.woff2`
    const outputName = `tajawal-${subset}-${weight}.woff2`
    const sourcePath = `package/files/${sourceName}`
    execFileSync('tar', ['-xzf', archive, '-C', work, sourcePath], { stdio: 'inherit' })
    await copyFile(join(work, sourcePath), join(assetDir, outputName))
    const face = rawFace.replace(/src:\s*[^;]+;/s, `src: url('./assets/fonts/${outputName}') format('woff2');`)
    if (!face.includes('unicode-range:')) throw new Error(`Missing official Unicode subset range in ${subset} ${weight}.`)
    faces.push(`/* tajawal-${subset}-${weight}-normal */\n${face}`)
  }

  if (faces.length !== subsets.size * weights.size) throw new Error(`Expected 8 subset faces; found ${faces.length}.`)
  await copyFile(join(work, 'package/LICENSE'), join(licenseDir, 'OFL.txt'))
  await writeFile(resolve(root, 'src/fonts.css'), `/* Tajawal ${version}, self-hosted Arabic/Latin WOFF2 subsets. License: public/fonts/OFL.txt */\n${faces.join('\n\n')}\n`)
  console.log(`Vendored ${faces.length} Tajawal WOFF2 subsets (weights ${[...weights].join(', ')}; CSS weight 600 uses the nearest 700 face) and the SIL OFL license.`)
} finally {
  await rm(work, { recursive: true, force: true })
}
