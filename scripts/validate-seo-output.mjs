import { readFile, access, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const dist = resolve(root, 'dist')
const fail = []
const manifest = JSON.parse(await readFile(resolve(dist, 'manus-routes.json'), 'utf8'))
const siteValue = process.env.VITE_SITE_URL?.trim() || 'https://proexcellencenetwork-art.github.io/mojtama-al-saytara/'
const siteRoot = new URL(siteValue.endsWith('/') ? siteValue : `${siteValue}/`)
const siteUrl = siteRoot.toString()
const basePath = siteRoot.pathname
const builtIndex = await readFile(resolve(dist, 'index.html'), 'utf8')
const assetBasePath = process.env.GITHUB_PAGES === 'true' || builtIndex.includes(`src="${basePath}`) || builtIndex.includes(`href="${basePath}`) ? basePath : '/'
if (!Array.isArray(manifest.routes) || Object.keys(manifest).join(',') !== 'routes') throw new Error('Route manifest must contain only top-level routes.')
for (const route of manifest.routes) {
  const lastmod = route?.lastmod
  const validLastmod = lastmod === undefined || (
    typeof lastmod === 'string' &&
    Number.isFinite(Date.parse(lastmod)) &&
    new Date(Date.parse(lastmod)).toISOString() === lastmod
  )
  if (!route || typeof route.path !== 'string' || !route.path.startsWith('/') || Object.keys(route).some(key => !['path','title','lastmod'].includes(key)) || (route.title !== undefined && typeof route.title !== 'string') || !validLastmod) fail.push('Invalid route manifest entry; expected path/title and an optional ISO lastmod.')
}
const privatePaths = new Set(['/login/','/register/','/reset-password/','/feed/','/profile/','/connections/','/messages/','/notifications/','/groups/','/verification/','/moderation/','/admin/','/settings/','/owner/','/owner/100ms/','/learning/','/content-studio/','/learning-room/'])
const dynamicPatterns = new Set(['/articles/:slug/','/events/:id/','/coaches/:id/','/learning-room/:id/'])
const interactiveRoutes = new Set(['/career-journey/','/career-compass/','/linkedin-audit/','/fresh-graduate/','/value-economy/','/achievement-portfolio/','/promotion-intelligence/','/innovation-rd/','/ai-career-leverage/','/saudi-labor-market-radar/','/professional-positioning/','/linkedin-workshop/'])
const publicRoutes = manifest.routes.filter(route => !privatePaths.has(route.path) && !dynamicPatterns.has(route.path))
const privateRoutes = manifest.routes.filter(route => privatePaths.has(route.path))
const publicTitles = new Set()
const publicDescriptions = new Set()
const urlsInSitemap = []
const fileForRoute = route => resolve(dist, route.path === '/' ? 'index.html' : `${route.path.replace(/^\/+/, '')}index.html`)
const assetRelativePath = pathname => {
  let relative = decodeURIComponent(pathname)
  if (basePath !== '/' && relative.startsWith(basePath)) relative = relative.slice(basePath.length)
  else if (assetBasePath !== '/' && relative.startsWith(assetBasePath)) relative = relative.slice(assetBasePath.length)
  return relative.replace(/^\/+/, '')
}
const safeJson = value => { try { return JSON.parse(value); } catch { return null } }
const truncateAtWordBoundary = (value, maxChars) => {
  const normalized = String(value ?? '').replace(/\s+/gu, ' ').trim()
  const chars = [...normalized]
  if (chars.length <= maxChars) return normalized
  let result = chars.slice(0, maxChars).join('').trimEnd()
  const boundary = result.lastIndexOf(' ')
  if (boundary >= Math.floor(maxChars * 0.6)) result = result.slice(0, boundary).trimEnd()
  return result.replace(/[,:;.!?–—-]+$/u, '').trimEnd()
}
const formatRecordTitle = value => {
  const normalized = String(value ?? '').replace(/\s+/gu, ' ').trim()
  const suffix = ' | مجتمع السيطرة'
  if ([...normalized].length + [...suffix].length < 60) return `${normalized}${suffix}`
  return truncateAtWordBoundary(normalized, 59)
}

for (const route of publicRoutes) {
  const file = fileForRoute(route)
  let html
  try { html = await readFile(file, 'utf8') } catch { fail.push(`Missing rendered HTML for ${route.path}`); continue }
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1]
  const description = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]
  const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]*)"/i)?.[1]
  if (!title || [...title].length >= 60) fail.push(`Title missing/too long: ${route.path}`)
  if (!description || [...description].length >= 160) fail.push(`Description missing/too long: ${route.path}`)
  if (title && publicTitles.has(title)) fail.push(`Duplicate public title: ${route.path}`)
  if (description && publicDescriptions.has(description)) fail.push(`Duplicate public description: ${route.path}`)
  if (title) publicTitles.add(title)
  if (description) publicDescriptions.add(description)
  if (!canonical?.startsWith(siteUrl)) fail.push(`Canonical URL does not match VITE_SITE_URL: ${route.path}`)
  if (!html.includes('<html lang="ar" dir="rtl">')) fail.push(`Arabic RTL document attributes missing: ${route.path}`)
  if (!html.includes('hreflang="ar"')) fail.push(`Arabic hreflang missing: ${route.path}`)
  if (!html.includes('og:image') || !html.includes('twitter:card')) fail.push(`Social metadata missing: ${route.path}`)
  if (!/<h1\b[^>]*>\s*[^<]/i.test(html)) fail.push(`Rendered H1 missing: ${route.path}`)
  if (!html.includes('id="root">')) fail.push(`Rendered body content missing: ${route.path}`)
  const hydrated = interactiveRoutes.has(route.path) || /^\/articles\/[^/:]+\/$/.test(route.path)
  if (!html.includes('.css') || (!hydrated && !html.includes('public-site.js'))) fail.push(`Public page CSS or its required behavior script is missing: ${route.path}`)
  const moduleScript = html.match(/<script\b(?=[^>]*\btype="module")(?=[^>]*\bsrc="([^"]+)")[^>]*>/i)
  if (hydrated && !moduleScript) fail.push(`Interactive career route is missing its local application module: ${route.path}`)
  if (!hydrated && (/<script\b[^>]*\btype="module"/i.test(html) || /rel="modulepreload"/i.test(html))) fail.push(`Static public route unexpectedly loads the React/Supabase module bundle: ${route.path}`)
  if (hydrated && moduleScript?.[1]) {
    const assetUrl = new URL(moduleScript[1], siteUrl)
    if (!assetUrl.pathname.startsWith(assetBasePath)) fail.push(`Interactive route module escapes the configured asset base path: ${route.path}`)
    else { const moduleFile = resolve(dist, decodeURIComponent(assetUrl.pathname.slice(assetBasePath.length).replace(/^\/+/, ''))); try { await access(moduleFile) } catch { fail.push(`Interactive route module asset is missing: ${route.path}`) } }
  }
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com|supabase\.co/i.test(html)) fail.push(`Public route has an external font or Supabase network dependency: ${route.path}`)
  if (!html.includes('critical-public-css') || !/<link\b[^>]*rel="stylesheet"/i.test(html) || html.includes('data-deferred-style')) fail.push(`Public route is missing inline critical CSS or its render-blocking stylesheet: ${route.path}`)
  if (route.path === '/about/') {
    const picture = html.match(/<picture>[\s\S]*?<\/picture>/i)?.[0] || ''
    if (!picture.includes('image/avif') || !picture.includes('image/webp') || !picture.includes('srcset=') || !picture.includes('sizes=') || !/loading="lazy"/.test(picture) || !/decoding="async"/.test(picture) || !/width="1200"/.test(picture) || !/height="630"/.test(picture)) fail.push('About-page illustration must have AVIF/WebP srcset, sizes, dimensions, and lazy/async loading.')
  }
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => safeJson(match[1])).filter(Boolean)
  if (!scripts.some(item => item['@type'] === 'Organization') || !scripts.some(item => item['@type'] === 'WebSite') || !scripts.some(item => item['@type'] === 'BreadcrumbList')) fail.push(`Required Organization/WebSite/BreadcrumbList schema missing: ${route.path}`)
  if (route.path === '/faq/' && !scripts.some(item => item['@type'] === 'FAQPage')) fail.push('FAQPage schema missing.')
  if (route.path === '/coaching/' && !scripts.some(item => item['@type'] === 'Service')) fail.push('Service schema missing.')
  if (route.path === '/career-journey/' && !scripts.some(item => item['@type'] === 'WebPage')) fail.push('Career Journey WebPage schema missing.')
  if (route.path === '/linkedin-workshop/' && !scripts.some(item => item['@type'] === 'Course')) fail.push('LinkedIn workshop Course schema missing.')
  if (/^\/articles\/[^/:]+\/$/.test(route.path) && !scripts.some(item => item['@type'] === 'Article')) fail.push(`Article schema missing: ${route.path}`)
  const articleSchema = scripts.find(item => item['@type'] === 'Article')
  if (articleSchema) {
    const expectedTitle = formatRecordTitle(articleSchema.headline)
    if (title !== expectedTitle) fail.push(`Article title must truncate at a word boundary: ${route.path}`)
    if (articleSchema.datePublished && !Number.isFinite(Date.parse(articleSchema.datePublished))) fail.push(`Invalid Article datePublished: ${route.path}`)
    if (articleSchema.dateModified && !Number.isFinite(Date.parse(articleSchema.dateModified))) fail.push(`Invalid Article dateModified: ${route.path}`)
  }
  if (/^\/events\/[^/:]+\/$/.test(route.path) && !scripts.some(item => item['@type'] === 'Event')) fail.push(`Event schema missing: ${route.path}`)
  if (/^\/coaches\/[^/:]+\/$/.test(route.path) && !scripts.some(item => item['@type'] === 'Person')) fail.push(`Person schema missing: ${route.path}`)
  urlsInSitemap.push(canonical)
}
for (const route of privateRoutes) {
  const file = fileForRoute(route)
  try {
    const html = await readFile(file, 'utf8')
    if (!/name="robots" content="noindex,nofollow"/i.test(html)) fail.push(`Private page is indexable: ${route.path}`)
    if (/<main[^>]*>\s*<(?:article|h1)[^>]*>[^<]{8,}/i.test(html) && !html.includes('هذه المساحة تتطلب الدخول')) fail.push(`Private content appears in static HTML: ${route.path}`)
  } catch { fail.push(`Missing private SPA shell for ${route.path}`) }
}
const sitemapText = await readFile(resolve(dist, 'sitemap.xml'), 'utf8')
const sitemapLocs = [...sitemapText.matchAll(/<loc>([\s\S]*?)<\/loc>/g)].map(match => match[1])
if (sitemapLocs.some(url => !urlsInSitemap.includes(url)) || urlsInSitemap.some(url => !sitemapLocs.includes(url))) fail.push('Sitemap URLs do not exactly match public prerendered pages.')
const sitemapEntries = [...sitemapText.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(match => ({
  loc: match[1].match(/<loc>([\s\S]*?)<\/loc>/)?.[1],
  lastmod: match[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1],
}))
for (const entry of sitemapEntries) {
  if (!entry.lastmod) continue
  const timestamp = Date.parse(entry.lastmod)
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== entry.lastmod) fail.push(`Invalid/non-normalized sitemap lastmod: ${entry.loc}`)
  if (entry.loc && /^\/articles\/[^/]+\/$/.test(new URL(entry.loc).pathname.replace(basePath, '/'))) {
    const articlePath = '/' + decodeURIComponent(new URL(entry.loc).pathname.replace(basePath, '')).split('/').filter(Boolean).join('/') + '/'
    const articleFile = fileForRoute({ path: articlePath })
    try {
      const articleHtml = await readFile(articleFile, 'utf8')
      const articleSchemas = [...articleHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match => safeJson(match[1])).filter(item => item?.['@type'] === 'Article')
      if (!articleSchemas.some(item => item.dateModified && new Date(item.dateModified).toISOString() === entry.lastmod)) fail.push(`Sitemap lastmod must match an explicit Article dateModified: ${entry.loc}`)
    } catch { fail.push(`Unable to verify article lastmod: ${entry.loc}`) }
  }
}
const notFoundHtml = await readFile(resolve(dist,'404.html'),'utf8')
if (!notFoundHtml.includes('name="robots" content="noindex,nofollow"') || notFoundHtml.includes('rel="canonical"')) fail.push('404 page must be noindex and must not declare a false canonical URL.')
if (!manifest.routes.some(route => route.path === '/learning-room/:id/')) fail.push('Private workshop-room route pattern is missing from the manifest.')
if (!notFoundHtml.includes('__saytara_route')) fail.push('GitHub Pages dynamic route recovery is missing from 404.html.')
const robots = await readFile(resolve(dist, 'robots.txt'), 'utf8')
if (!robots.includes('Sitemap:') || !robots.includes(new URL('sitemap.xml', siteRoot).toString())) fail.push('robots.txt sitemap location is incorrect.')
const disallowedPrivateRoutes = privateRoutes.filter(route => {
  const routePath = `${basePath.replace(/\/$/, '')}${route.path.replace(/\/$/, '')}`
  return robots.split(/\r?\n/).some(line => {
    const match = line.match(/^Disallow:\s*(\S+)/i)
    if (!match) return false
    const disallowed = match[1].replace(/\/$/, '')
    return routePath === disallowed || routePath.startsWith(`${disallowed}/`)
  })
})
if (disallowedPrivateRoutes.length) fail.push(`robots.txt blocks routes with noindex metadata: ${disallowedPrivateRoutes.map(route => route.path).join(', ')}`)
for (const file of ['404.html','sitemap.xml','robots.txt','manus-routes.json','manifest.webmanifest','og-social.png','icon-192.png','icon-512.png','apple-touch-icon.png','favicon.svg','public-site.js','images/brand-community-480.avif','images/brand-community-480.webp','images/brand-community-1200.avif','images/brand-community-1200.webp','fonts/OFL.txt']) {
  try { await access(resolve(dist,file)) } catch { fail.push(`Required static asset missing: ${file}`) }
}
const index = await readFile(resolve(dist,'index.html'),'utf8')
const assetRefs = [...index.matchAll(/(?:src|href)="([^"]+\.(?:js|css|png|svg|webmanifest|woff2|webp|avif))"/g)].map(m=>m[1])
for (const ref of assetRefs) {
  const url = new URL(ref, siteUrl)
  const relative = assetRelativePath(url.pathname)
  if (!relative || relative.includes('..')) continue
  try { await access(resolve(dist, relative)) } catch { fail.push(`Broken built asset reference: ${ref}`) }
}
const builtFiles = await readdir(resolve(dist,'assets'))
const builtCssName = builtFiles.find(file => /^index-.*\.css$/.test(file))
if (!builtCssName) fail.push('Built application stylesheet missing.')
else {
  const css = await readFile(resolve(dist,'assets',builtCssName),'utf8')
  const fontRefs = [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map(match=>match[1])
  if (fontRefs.length !== 8) fail.push(`Expected 8 self-hosted WOFF2 subset URLs in the built CSS; found ${fontRefs.length}.`)
  for (const ref of fontRefs) {
    const url = new URL(ref,siteUrl)
    const relative = assetRelativePath(url.pathname)
    try { await access(resolve(dist,relative)) } catch { fail.push(`Broken base-aware WOFF2 asset reference: ${ref}`) }
  }
}
if (fail.length) {
  console.error(`SEO output validation failed with ${fail.length} issue(s):\n- ${fail.join('\n- ')}`)
  process.exitCode = 1
} else {
  console.log(`SEO output validation passed: ${publicRoutes.length} public routes, ${privateRoutes.length} noindex shells, ${sitemapLocs.length} sitemap entries, valid JSON-LD and local assets.`)
}
