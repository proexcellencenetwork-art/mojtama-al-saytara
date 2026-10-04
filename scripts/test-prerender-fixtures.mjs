import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFile, access } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ids = { coach: '10000000-0000-4000-8000-000000000001', event: '20000000-0000-4000-8000-000000000002', article: '30000000-0000-4000-8000-000000000003' }
const fixtureRows = {
  public_coaches: [{ user_id: ids.coach, display_name: 'كوتش تجريبي', headline: 'كوتش مهني', profession: 'ممارس صحي', specialty: 'التطوير المهني', city: 'مدينة تجريبية', photo_url: null, public_bio: 'ملف تجريبي مولّد لاختبار HTML العام.', coaching_topics: ['المسار المهني'], session_minutes: [30,60], booking_enabled: false }],
  articles: [{ id: ids.article, title: 'مقال تجريبي للسيو', slug: 'مقال-تجريبي', excerpt: 'محتوى تجريبي لاختبار HTML وبيانات المقال.', body: 'نص اختبار عام لا يحتوي بيانات مستخدم أو مريض.', published_at: new Date('2026-01-01T00:00:00.000Z').toISOString() }],
  events: [{ id: ids.event, title: 'فعالية تجريبية', description: 'وصف فعالية مؤقتة لاختبار البيانات المنظمة.', starts_at: new Date(Date.now()+86400000).toISOString(), ends_at: new Date(Date.now()+90000000).toISOString(), location: 'افتراضي' }],
}
const server = createServer((req,res) => {
  const table = new URL(req.url || '/', 'http://localhost').pathname.split('/').at(-1)
  if (!fixtureRows[table]) { res.writeHead(404, {'content-type':'application/json'}); res.end(JSON.stringify({message:'Fixture table not found'})); return }
  res.writeHead(200, {'content-type':'application/json','access-control-allow-origin':'*'})
  res.end(JSON.stringify(fixtureRows[table]))
})
await new Promise((resolveListen,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolveListen) })
const { port } = server.address()
const env = { ...process.env, GITHUB_PAGES:'true', VITE_SITE_URL:'https://proexcellencenetwork-art.github.io/mojtama-al-saytara/', VITE_SUPABASE_URL:`http://127.0.0.1:${port}`, VITE_SUPABASE_ANON_KEY:'synthetic-build-only-public-key' }
let child
try {
  child = spawn('npm',['run','build'],{ cwd:root, env, stdio:'inherit' })
  const code = await new Promise((resolveExit,reject) => { child.once('error',reject); child.once('exit',(status,signal) => signal ? reject(new Error(`Build ended with signal ${signal}`)) : resolveExit(status ?? 1)) })
  if (code !== 0) throw new Error(`Synthetic prerender build exited with ${code}`)
  const expected = [
    ['articles/مقال-تجريبي/index.html','Article'],
    [`events/${ids.event}/index.html`,'Event'],
    [`coaches/${ids.coach}/index.html`,'Person'],
  ]
  for (const [relative,type] of expected) {
    const html = await readFile(resolve(root,'dist',relative),'utf8')
    if (!html.includes(`"@type":"${type}"`)) throw new Error(`${type} JSON-LD missing from ${relative}`)
    if (!html.includes('<h1>')) throw new Error(`Visible HTML heading missing from ${relative}`)
    if (!html.includes('rel="canonical"')) throw new Error(`Canonical missing from ${relative}`)
  }
  const routes = JSON.parse(await readFile(resolve(root,'dist/manus-routes.json'),'utf8')).routes
  for (const relative of expected.map(([path])=>`/${path.replace(/\/index\.html$/,'/')}`)) {
    if (!routes.some(route=>route.path===relative)) throw new Error(`Generated detail route missing from manifest: ${relative}`)
  }
  for (const relative of ['learning/index.html','learning-room/index.html']) {
    const html = await readFile(resolve(root,'dist',relative),'utf8')
    if (!html.includes('name="robots" content="noindex,nofollow"')) throw new Error(`Private learning shell must be noindex: ${relative}`)
  }
  if (!routes.some(route=>route.path==='/learning-room/:id/')) throw new Error('Dynamic workshop room route missing from the route manifest.')
  const sitemap = await readFile(resolve(root,'dist/sitemap.xml'),'utf8')
  if (!sitemap.includes(encodeURIComponent('مقال-تجريبي')) || !sitemap.includes(ids.event) || !sitemap.includes(ids.coach)) throw new Error('Synthetic public detail routes missing from sitemap.')
  const notFound = await readFile(resolve(root,'dist/404.html'),'utf8')
  if (!notFound.includes('__saytara_route') || !notFound.includes('learning-room/')) throw new Error('GitHub Pages deep-link recovery must route through the React-bearing learning-room shell.')
  await access(resolve(root,'dist/404.html'))
  console.log('Synthetic SEO fixture smoke test passed: public details, private learning noindex routes, deep-link recovery, schemas, routes and sitemap.')
} finally {
  if (child && child.exitCode === null) child.kill('SIGTERM')
  await new Promise(resolveClose => server.close(resolveClose))
}
