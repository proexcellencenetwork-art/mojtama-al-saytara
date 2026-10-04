import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(projectRoot, 'dist')
const defaultSiteUrl = 'https://proexcellencenetwork-art.github.io/mojtama-al-saytara/'
const configuredSiteUrl = process.env.VITE_SITE_URL?.trim() || defaultSiteUrl
const site = new URL(configuredSiteUrl)
if (!['http:', 'https:'].includes(site.protocol)) throw new Error('VITE_SITE_URL must use http or https.')
const siteRoot = new URL(site.pathname.endsWith('/') ? site.pathname : `${site.pathname}/`, site.origin)
const basePath = siteRoot.pathname
const appName = 'مجتمع السيطرة'
const ogImage = new URL(`${basePath.replace(/\/$/, '')}/og-social.png`, site.origin).toString()
const builtIndex = await readFile(resolve(distDir, 'index.html'), 'utf8')
const criticalCss = await readFile(resolve(projectRoot, 'scripts/public-critical.css'), 'utf8')
const publishedAt = new Date()

const pages = {
  '/': { title: 'مجتمع السيطرة | مجتمع مهني صحي', description: 'مساحة مهنية آمنة للمهنيين الصحيين للتواصل والكوتشنج والتطور المهني المتوازن.', heading: 'مسارك المهني، بإيقاعك أنت.', intro: 'مجتمع السيطرة مساحة آمنة للمهنيين الصحيين كي يتطوروا، يتواصلوا، ويصنعوا توازناً مهنياً يشبههم.', type: 'home' },
  '/about': { title: 'عن مجتمع السيطرة | مساحة مهنية آمنة', description: 'تعرّف على مجتمع مهني للمهنيين الصحيين يجمع التواصل الهادف والكوتشنج والخصوصية.', heading: 'نؤمن أن النمو المهني يبدأ بمساحة آمنة.', intro: 'مجتمع السيطرة مساحة مهنية للمهنيين الصحيين، تجمع الكوتشنج الفردي والتواصل الهادف والمحتوى الموثوق. صُممت لتساعدك على التطور وإدارة الضغط واتخاذ قراراتك بوعي.', points: [['مساحة آمنة', 'الاحترام والسرية أساس كل تواصل.'], ['خبرة مهنية', 'توثيق واضح للمهنيين والكوتشات.'], ['نمو متوازن', 'تطوير لا يتجاهل الإنسان خلف الدور.']] },
  '/coaching': { title: 'كوتشنج مهني للقطاع الصحي | مجتمع السيطرة', description: 'مساحة حوار مهني تساعد العاملين في الرعاية الصحية على توضيح أهدافهم وخياراتهم.', heading: 'مساحة للتفكير. وخطوة تنبع منك.', intro: 'الكوتشنج حوار مهني يساعدك على توضيح أهدافك وخياراتك، واستكشاف الخطوات التي تناسبك في مسيرتك.', points: [['تطوير المسار', 'رؤية أوضح لأهدافك وخياراتك المهنية.'], ['إدارة الضغط', 'مساحة للتأمل في التحديات وحدودك.'], ['اتخاذ القرار', 'تحويل الأفكار إلى خطوات قابلة للتجربة.']], type: 'service' },
  '/coaches': { title: 'دليل الكوتشات | مجتمع السيطرة', description: 'تعرّف على الكوتشات والملفات المهنية العامة المنشورة في مجتمع السيطرة.', heading: 'تعرّف على من يصغي إلى رحلتك.', intro: 'كوتشات بخبرات متنوعة ومساحات حوار مهنية، مع ملفات عامة عند توفرها في المجتمع.', type: 'coaches' },
  '/articles': { title: 'مقالات التطور المهني الصحي | مجتمع السيطرة', description: 'اقرأ المحتوى المنشور عن النمو المهني والتوازن والعمل في القطاع الصحي.', heading: 'معرفة تساعدك على التقدّم.', intro: 'مقالات مجتمع السيطرة المنشورة حول التطور المهني والتوازن والعمل في بيئة الرعاية الصحية.', type: 'articles' },
  '/events': { title: 'الفعاليات المهنية الصحية | مجتمع السيطرة', description: 'تابع الفعاليات العامة القادمة للمهنيين الصحيين في مجتمع السيطرة.', heading: 'نتعلّم معاً، ونصنع مساحة للحوار.', intro: 'لقاءات ومجالس مهنية عامة قادمة، تظهر هنا بعد نشرها واجتياز مراجعة المحتوى.', type: 'events' },
  '/faq': { title: 'الأسئلة الشائعة | مجتمع السيطرة', description: 'إجابات عن العضوية والتوثيق والكوتشنج والخصوصية في مجتمع السيطرة.', heading: 'إجابات واضحة، قبل أن تبدأ.', intro: 'إجابات أساسية عن العضوية والتوثيق والكوتشنج المهني في مجتمع السيطرة.', type: 'faq', points: [['هل التوثيق إلزامي للانضمام؟', 'لا. التوثيق اختياري ويُطلب لمنح صلاحيات النشر المهني.'], ['هل الكوتشنج استشارة طبية أو نفسية؟', 'لا. الكوتشنج لا يغني عن الاستشارة الطبية أو النفسية.'], ['هل العضوية المميزة تعني أنني موثّق؟', 'لا. العضوية المميزة والتوثيق مساران منفصلان تماماً.']] },
  '/privacy': { title: 'سياسة الخصوصية | مجتمع السيطرة', description: 'اقرأ كيف يتعامل مجتمع السيطرة مع بيانات الحساب والخصوصية وطلبات التوثيق.', heading: 'بياناتك المهنية تخصّك.', intro: 'لا يطلب مجتمع السيطرة بيانات صحية حساسة. تستخدم بيانات الحساب لتشغيل المجتمع، وتُعامل مستندات التوثيق كمرفقات خاصة لا يطّلع عليها إلا فريق المراجعة. تتوفر أدوات لتصدير بيانات الحساب أو حذفه من الإعدادات.', points: [['تقليل البيانات', 'نطلب الحد الأدنى اللازم لتشغيل الخدمة.'], ['ملفات التوثيق', 'تخزين خاص وصلاحية مراجعة محدودة.'], ['تحكمك', 'يمكنك تصدير بياناتك أو حذف الحساب.']] },
  '/terms': { title: 'شروط الاستخدام | مجتمع السيطرة', description: 'الشروط المهنية لاستخدام مجتمع السيطرة واحترام خصوصية الأعضاء والمرضى.', heading: 'مساحة مهنية تقوم على الوضوح.', intro: 'استخدم المجتمع باحترام ومسؤولية، ولا تنشر محتوى مضللاً أو مسيئاً، ولا تشارك أي معلومات أو صور تخص المرضى.', points: [['المسؤولية', 'لا تشارك بيانات دخولك أو بيانات الغير.'], ['خصوصية المرضى', 'يُمنع نشر معلومات أو صور المرضى منعاً باتاً.'], ['الإشراف', 'تُراجع البلاغات وفق قواعد المجتمع.']] },
  '/charter': { title: 'ميثاق السلوك المهني | مجتمع السيطرة', description: 'مبادئ الاحترام والسرية والتواصل المسؤول في مجتمع السيطرة.', heading: 'الاحترام ليس خياراً إضافياً.', intro: 'نحافظ معاً على مساحة مهنية تحترم الإنسان والخصوصية وتفسح المجال للاختلاف.', points: [['احترام متبادل', 'نختلف في الرأي دون إساءة أو تحرش.'], ['سرية مهنية', 'لا تعِد نشر محتوى الأعضاء خارج سياقه.'], ['تواصل مسؤول', 'لا رسائل مزعجة ولا ادعاءات مضللة.']] },
}
const questions = pages['/faq'].points
const protectedRoutes = ['/login', '/register', '/reset-password', '/feed', '/profile', '/connections', '/messages', '/notifications', '/groups', '/verification', '/moderation', '/admin', '/settings', '/owner', '/learning', '/learning-room']
const routes = []
const safeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const urlFor = route => new URL(route === '/' ? '' : `${route.replace(/^\/+|\/+$/g, '')}/`, siteRoot).toString()
const assetUrl = path => new URL(path.replace(/^\/+/, ''), siteRoot).toString()
const normalizeRoute = route => route === '/' ? '/' : `/${route.split('/').filter(Boolean).join('/')}/`
const ensureMetadataLimits = page => {
  if ([...page.title].length >= 60) throw new Error(`SEO title must remain under 60 characters: ${page.title}`)
  if ([...page.description].length >= 160) throw new Error(`SEO description must remain under 160 characters: ${page.title}`)
}
function crumbData(route, page) {
  const labels = [{ name: 'الرئيسية', path: '/' }]
  if (route !== '/') {
    const parts = route.split('/').filter(Boolean)
    let current = ''
    for (const part of parts) {
      current += `/${part}`
      const known = pages[current]
      labels.push({ name: known?.heading || page.heading || part, path: current })
    }
  }
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: labels.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: urlFor(item.path) })) }
}
function schemaFor(route, page, record = null) {
  const list = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: appName, url: urlFor('/'), logo: new URL(`${basePath.replace(/\/$/, '')}/favicon.svg`, site.origin).toString(), description: pages['/'].description },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: appName, url: urlFor('/'), inLanguage: 'ar' },
    crumbData(route, page),
  ]
  if (page.type === 'service') list.push({ '@context': 'https://schema.org', '@type': 'Service', name: 'الكوتشنج المهني للقطاع الصحي', serviceType: 'Professional coaching', provider: { '@type': 'Organization', name: appName, url: urlFor('/') }, areaServed: { '@type': 'Country', name: 'السعودية' }, description: page.intro, url: urlFor(route) })
  if (page.type === 'faq') list.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) })
  if (record?.kind === 'article') list.push({ '@context': 'https://schema.org', '@type': 'Article', headline: record.title, description: record.excerpt || record.title, datePublished: record.published_at, dateModified: record.published_at, inLanguage: 'ar', mainEntityOfPage: urlFor(route), publisher: { '@type': 'Organization', name: appName, url: urlFor('/') } })
  if (record?.kind === 'event') list.push({ '@context': 'https://schema.org', '@type': 'Event', name: record.title, description: record.description || record.title, startDate: record.starts_at, ...(record.ends_at ? { endDate: record.ends_at } : {}), eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled', location: { '@type': 'VirtualLocation', url: urlFor(route) }, organizer: { '@type': 'Organization', name: appName, url: urlFor('/') }, inLanguage: 'ar' })
  if (record?.kind === 'coach') list.push({ '@context': 'https://schema.org', '@type': 'Person', name: record.display_name, jobTitle: record.headline || record.profession, description: record.public_bio || page.description, url: urlFor(route), knowsAbout: record.coaching_topics || [] })
  return list
}
function htmlLink(path, label, className = '') { return `<a${className ? ` class="${className}"` : ''} href="${safeText(urlFor(path))}">${safeText(label)}</a>` }
function header() { return `<header class="topbar"><div class="topbar-inner wrap"><a class="brand" href="${safeText(urlFor('/'))}" aria-label="مجتمع السيطرة - الرئيسية"><span class="brand-mark">♡</span><span class="brand-word">مجتمع <b>السيطرة</b><small>مساحة مهنية آمنة</small></span></a><button class="icon-btn menu-btn" id="menu-toggle" type="button" aria-label="فتح قائمة التنقل" aria-expanded="false" aria-controls="public-nav"><span aria-hidden="true">☰</span></button><nav id="public-nav" class="public-nav" aria-label="التنقل الرئيسي">${[['/about','عن المجتمع'],['/coaching','الكوتشنج'],['/coaches','الكوتشات'],['/articles','المقالات'],['/events','الفعاليات']].map(([path,label])=>htmlLink(path,label)).join('')}</nav><div class="header-actions"><button class="public-theme-toggle" id="theme-toggle" type="button" aria-label="تفعيل الوضع الداكن" aria-pressed="false"><span aria-hidden="true">◐</span></button>${htmlLink('/login','تسجيل الدخول','login-link')}${htmlLink('/register','انضم للمجتمع','btn btn-primary btn-small')}</div></div></header>` }
function footer() { return `<footer class="site-footer"><div class="wrap footer-inner"><a href="${safeText(urlFor('/'))}">مجتمع السيطرة</a><span>مجتمع مهني يضع الإنسان في قلب التطور.</span><div class="footer-links">${[['/privacy','الخصوصية'],['/terms','الشروط'],['/charter','ميثاق السلوك']].map(([path,label])=>htmlLink(path,label)).join('')}</div><small>© ٢٠٢٦ مجتمع السيطرة</small></div></footer>` }
function pointCards(points = []) { return `<div class="public-points">${points.map(([title, text], i) => `<article class="public-point"><span class="point-number">0${i+1}</span><div><h2>${safeText(title)}</h2><p>${safeText(text)}</p></div></article>`).join('')}</div>` }
function breadcrumb(route, page) { const label = route === '/' ? 'الرئيسية' : page.heading; return route === '/' ? '' : `<nav class="breadcrumbs" aria-label="مسار التنقل">${htmlLink('/','الرئيسية')}<span aria-hidden="true">/</span><span>${safeText(label)}</span></nav>` }
function brandIllustration() {
  const sizes = '(max-width: 720px) calc(100vw - 68px), 500px'
  const avif = `<source type="image/avif" srcset="${assetUrl('images/brand-community-480.avif')} 480w, ${assetUrl('images/brand-community-1200.avif')} 1200w" sizes="${sizes}">`
  const webp = `<source type="image/webp" srcset="${assetUrl('images/brand-community-480.webp')} 480w, ${assetUrl('images/brand-community-1200.webp')} 1200w" sizes="${sizes}">`
  return `<section class="brand-visual"><div><span class="eyebrow">مساحة تجمعنا</span><h2>مهنية، إنسانية، ومتّصلة.</h2><p>نؤمن أن النمو المهني يصبح أعمق حين يجد الإنسان حوله مجتمعاً يحترم خبرته وحدوده ويشجّع التواصل الهادف.</p></div><picture>${avif}${webp}<img src="${ogImage}" srcset="${assetUrl('images/brand-community-480.webp')} 480w, ${assetUrl('images/brand-community-1200.webp')} 1200w" sizes="${sizes}" width="1200" height="630" loading="lazy" decoding="async" alt="دوائر مترابطة وقلوب تعبّر عن التعاون والنمو المهني"></picture></section>`
}
function staticBody(route, page, records = []) {
  if (page.type === 'home') return `<main><section class="hero wrap"><div class="hero-copy"><div class="eyebrow">مساحة مهنية للقطاع الصحي</div><h1>مسارك المهني،<br><em>بإيقاعك أنت.</em></h1><p class="hero-lead">${safeText(page.intro)}</p><div class="hero-actions">${htmlLink('/register','اكتشف مساحتك','btn btn-primary')}${htmlLink('/coaching','تعرّف على الكوتشنج','btn btn-quiet')}</div></div><div class="hero-art" role="img" aria-label="رمز بصري للتواصل والنمو المهني"></div></section><section class="section wrap"><div class="section-heading"><div><span class="eyebrow">مساحتك، بطريقتك</span><h2>ما تحتاجه في رحلتك المهنية</h2></div>${htmlLink('/about','اكتشف المجتمع','text-link')}</div>${pointCards([['كوتشنج فردي','حوار مهني يساعدك على رؤية خياراتك بوضوح.'],['زمالة حقيقية','تواصل مع مهنيين يشاركونك المجال والطموح.'],['خبرة موثقة','تعرّف على الملفات المهنية العامة بعد مراجعتها.']])}</section><section class="quote-section"><div class="wrap quote-inner"><div><p>حين نمنح أنفسنا مساحة للتفكير، نصبح أقرب إلى الطريق الذي نختاره بوعي.</p><small>مجتمع السيطرة · مساحتك المهنية الآمنة</small></div>${htmlLink('/charter','ميثاقنا المهني','btn btn-outline')}</div></section><section class="section wrap join-section"><div><span class="eyebrow">خطوتك القادمة تبدأ هنا</span><h2>أنت أكثر من مسماك المهني.</h2><p>انضم إلى مساحة ترى خبرتك، وتحترم حدودك، وتدعم نموّك.</p></div>${htmlLink('/register','انضم إلى مجتمع السيطرة','btn btn-primary')}</section></main>`
  if (page.type === 'faq') return `<main class="public-page wrap">${breadcrumb(route,page)}<div class="public-page-copy"><span class="eyebrow">الأسئلة الشائعة</span><h1>${safeText(page.heading)}</h1><p class="hero-lead">${safeText(page.intro)}</p></div><div class="public-points">${questions.map(([question,answer])=>`<article class="public-point"><div><h2>${safeText(question)}</h2><p>${safeText(answer)}</p></div></article>`).join('')}</div><nav class="related-links" aria-label="صفحات مرتبطة"><b>قد تهمك</b>${htmlLink('/coaching','الكوتشنج المهني')}${htmlLink('/privacy','سياسة الخصوصية')}${htmlLink('/register','إنشاء حساب')}</nav></main>`
  if (page.type === 'articles' || page.type === 'coaches' || page.type === 'events') {
    const cards = records.map(record => {
      const detailPath = record.kind === 'article' ? `/articles/${record.slug}` : record.kind === 'coach' ? `/coaches/${record.user_id}` : `/events/${record.id}`
      const title = record.title || record.display_name
      const summary = record.kind === 'coach' ? [record.headline,record.profession,record.specialty,record.city].filter(Boolean).join(' · ') : record.kind === 'event' ? `${new Date(record.starts_at).toLocaleString('ar')} · ${record.location || 'افتراضي'}` : record.excerpt || ''
      return `<article class="public-point"><div><h2>${htmlLink(detailPath,title)}</h2><p>${safeText(summary)}</p></div></article>`
    }).join('')
    return `<main class="public-page wrap">${breadcrumb(route,page)}<div class="public-page-copy"><span class="eyebrow">${page.type === 'coaches' ? 'دليل مهني' : page.type === 'articles' ? 'مكتبة المجتمع' : 'تقويم المجتمع'}</span><h1>${safeText(page.heading)}</h1><p class="hero-lead">${safeText(page.intro)}</p></div>${records.length ? `<div class="public-points">${cards}</div>` : `<div class="panel-card empty-state"><h2>${page.type === 'articles' ? 'لا توجد مقالات منشورة حتى الآن' : page.type === 'coaches' ? 'لا توجد ملفات كوتش عامة منشورة بعد' : 'لا توجد فعاليات عامة قادمة حالياً'}</h2><p>ستظهر المعلومات العامة المنشورة هنا بعد مراجعتها. لا نعرض بيانات تجريبية.</p></div>`}<nav class="related-links" aria-label="صفحات مرتبطة"><b>قد تهمك</b>${htmlLink('/coaching','الكوتشنج المهني')}${htmlLink('/faq','الأسئلة الشائعة')}${htmlLink('/register','انضم إلى المجتمع')}</nav></main>`
  }
  return `<main class="public-page wrap">${breadcrumb(route,page)}<div class="public-page-copy"><span class="eyebrow">${safeText(route === '/about' ? 'عن مجتمعنا' : route === '/coaching' ? 'الكوتشنج المهني' : route === '/privacy' ? 'الخصوصية' : route === '/terms' ? 'الشروط' : 'ميثاق السلوك')}</span><h1>${safeText(page.heading)}</h1><p class="hero-lead">${safeText(page.intro)}</p></div>${pointCards(page.points)}${route === '/about' ? brandIllustration() : ''}${route === '/coaching' ? '<div class="coaching-note">الكوتشنج لا يغني عن الاستشارة الطبية أو النفسية.</div>' : ''}<nav class="related-links" aria-label="صفحات مرتبطة"><b>قد تهمك</b>${htmlLink('/coaching','الكوتشنج المهني')}${htmlLink('/articles','مقالات المجتمع')}${htmlLink('/faq','الأسئلة الشائعة')}${htmlLink('/privacy','الخصوصية')}</nav></main>`
}
function metadata(route, page, record = null) {
  const recordTitle = record ? String(record.title || record.display_name || 'محتوى المجتمع') : ''
  const title = record ? `${[...recordTitle].slice(0, 40).join('')} | مجتمع السيطرة` : page.title
  const recordSummary = record ? String(record.excerpt || record.public_bio || record.description || 'محتوى عام منشور في مجتمع السيطرة.') : ''
  const description = record ? `${recordTitle}: ${recordSummary}`.slice(0, 155) : page.description
  ensureMetadataLimits({ title, description })
  const canonical = urlFor(route)
  const type = record?.kind === 'article' ? 'article' : 'website'
  const jsonld = schemaFor(route,page,record).map(item => `<script type="application/ld+json">${JSON.stringify(item).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')}</script>`).join('')
  let imageUrl = ogImage
  if (record?.photo_url && record.kind === 'coach') {
    try {
      const candidate = new URL(record.photo_url)
      if (candidate.protocol === 'https:' || candidate.protocol === 'http:') imageUrl = candidate.toString()
    } catch { /* keep the first-party social-preview image */ }
  }
  const localeLinks = `<link rel="canonical" href="${safeText(canonical)}"><link rel="alternate" hreflang="ar" href="${safeText(canonical)}">`
  return `<title>${safeText(title)}</title><meta name="description" content="${safeText(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="${type}"><meta property="og:locale" content="ar_SA"><meta property="og:site_name" content="${appName}"><meta property="og:title" content="${safeText(title)}"><meta property="og:description" content="${safeText(description)}"><meta property="og:url" content="${safeText(canonical)}"><meta property="og:image" content="${safeText(imageUrl)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${safeText(title)}"><meta name="twitter:description" content="${safeText(description)}"><meta name="twitter:image" content="${safeText(imageUrl)}">${localeLinks}${jsonld}`
}
function shell(route, page, body, record = null, noindex = false, interactive = false) {
  const head = route === '/404'
    ? '<title>صفحة غير موجودة | مجتمع السيطرة</title><meta name="description" content="الصفحة المطلوبة غير متاحة في مجتمع السيطرة."><meta name="robots" content="noindex,nofollow">'
    : metadata(route,page,record).replace('index,follow,max-image-preview:large', noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large')
  let html = builtIndex
    .replace(/<html lang="[^"]*" dir="[^"]*">/, '<html lang="ar" dir="rtl">')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta\s+name="(?:description|robots|twitter:[^"]+)"[^>]*>/g, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/g, '')
    .replace(/<link\s+rel="(?:canonical|alternate)"[^>]*>/g, '')
    .replace('</head>', `${head}</head>`)
  if (!interactive) {
    html = html
      .replace(/<script\b[^>]*\btype="module"[^>]*>\s*<\/script>/gi, '')
      .replace(/<link\b(?=[^>]*\brel="modulepreload")[^>]*>/gi, '')
    const stylesheet = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*>/i)?.[0]
    if (!stylesheet) throw new Error(`Missing built stylesheet for static route ${route}`)
    html = html.replace('</head>', `<style id="critical-public-css">${criticalCss}</style></head>`)
    html = html.replace('</body>', `<script defer src="${safeText(assetUrl('public-site.js'))}"></script></body>`)
  }
  const renderedBody = interactive ? body : `<div class="app" id="site-app">${body}</div>`
  html = html.replace('<div id="root"></div>', `<div id="root">${renderedBody}</div>`)
  if (!html.includes(`<div id="root">${renderedBody}</div>`)) throw new Error(`Failed to create prerender shell for ${route}`)
  return html.replace(/^[\t ]+$/gm, '')
}
async function writeRoute(route, html) {
  const normalized = normalizeRoute(route)
  const relative = normalized === '/' ? 'index.html' : `${normalized.replace(/^\//,'')}index.html`
  const outputPath = resolve(distDir, relative)
  if (!outputPath.startsWith(`${distDir}${sep}`) && outputPath !== resolve(distDir,'index.html')) throw new Error('Refusing to write outside dist/')
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, html)
}

async function readPublicRows(table, query) {
  const url = process.env.VITE_SUPABASE_URL?.trim()
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return []
  try {
    const response = await fetch(`${url.replace(/\/$/,'')}/rest/v1/${table}?${query}`, { headers: { apikey: key, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
    if (!response.ok) { console.warn(`SEO prerender: public ${table} query returned HTTP ${response.status}; index page will remain empty.`); return [] }
    const result = await response.json()
    return Array.isArray(result) ? result : []
  } catch (error) {
    console.warn(`SEO prerender: public ${table} query failed; continuing without dynamic entries (${error instanceof Error ? error.message : 'network error'}).`)
    return []
  }
}
const now = encodeURIComponent(new Date().toISOString())
const [coachRows, articleRows, eventRows] = await Promise.all([
  readPublicRows('public_coaches','select=user_id,display_name,headline,profession,specialty,city,photo_url,public_bio,coaching_topics&order=display_name.asc&limit=200'),
  readPublicRows('articles','select=id,title,slug,excerpt,body,published_at&status=eq.published&order=published_at.desc&limit=200'),
  readPublicRows('events',`select=id,title,description,starts_at,ends_at,location&is_private=eq.false&moderation_state=eq.visible&starts_at=gte.${now}&order=starts_at.asc&limit=200`),
])
const recordsByPage = { '/coaches': coachRows.filter(row => row.user_id && row.display_name).map(row => ({ ...row, kind: 'coach' })), '/articles': articleRows.filter(row => row.slug && row.title).map(row => ({ ...row, kind: 'article' })), '/events': eventRows.filter(row => row.id && row.title && row.starts_at).map(row => ({ ...row, kind: 'event' })) }
for (const [route,page] of Object.entries(pages)) {
  ensureMetadataLimits(page)
  const records = recordsByPage[route] || []
  const html = shell(route,page,`${header()}${staticBody(route,page,records)}${footer()}`)
  await writeRoute(route,html)
  routes.push({ path: normalizeRoute(route), title: page.title })
}
routes.push(
  { path: '/articles/:slug/', title: 'تفاصيل المقال' },
  { path: '/events/:id/', title: 'تفاصيل الفعالية' },
  { path: '/coaches/:id/', title: 'الملف المهني للكوتش' },
  { path: '/learning-room/:id/', title: 'غرفة ورشة مهنية خاصة' },
)
for (const [collection,records] of Object.entries(recordsByPage)) {
  for (const record of records) {
    let route
    let page
    if (record.kind === 'article') {
      const slug = String(record.slug)
      if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(slug)) continue
      route = `/articles/${slug}`; page = { ...pages['/articles'], heading: record.title }
    }
    else if (record.kind === 'event') {
      if (!/^[0-9a-f-]{36}$/i.test(String(record.id))) continue
      route = `/events/${record.id}`; page = { ...pages['/events'], heading: record.title }
    }
    else {
      if (!/^[0-9a-f-]{36}$/i.test(String(record.user_id))) continue
      route = `/coaches/${record.user_id}`; page = { ...pages['/coaches'], heading: record.display_name }
    }
    const summary = record.kind === 'article' ? record.excerpt : record.kind === 'coach' ? record.public_bio : record.description
    const body = `${header()}<main class="public-page wrap"><nav class="breadcrumbs" aria-label="مسار التنقل">${htmlLink('/','الرئيسية')}<span>/</span>${htmlLink(collection,page.heading)}<span>/</span><span>${safeText(page.heading)}</span></nav><article class="public-article"><span class="eyebrow">${record.kind === 'article' ? 'مقال منشور' : record.kind === 'coach' ? 'ملف كوتش مهني عام' : 'فعالية عامة قادمة'}</span><h1>${safeText(page.heading)}</h1>${record.kind === 'article' && record.published_at ? `<time datetime="${safeText(record.published_at)}">${new Date(record.published_at).toLocaleDateString('ar')}</time>` : ''}${record.kind === 'event' ? `<p>${new Date(record.starts_at).toLocaleString('ar',{dateStyle:'long',timeStyle:'short'})} · ${safeText(record.location || 'افتراضي')}</p>` : ''}<p>${safeText(summary || '')}</p>${record.kind === 'article' ? `<div class="public-article-body">${String(record.body || '').split(/\n{2,}/).map(paragraph=>`<p>${safeText(paragraph)}</p>`).join('')}</div>` : ''}${record.kind === 'coach' && Array.isArray(record.coaching_topics) ? `<p>${safeText(record.coaching_topics.join(' · '))}</p>` : ''}</article><nav class="related-links" aria-label="صفحات مرتبطة"><b>قد تهمك</b>${htmlLink('/coaching','الكوتشنج المهني')}${htmlLink('/articles','مقالات المجتمع')}${htmlLink('/faq','الأسئلة الشائعة')}</nav></main>${footer()}`
    await writeRoute(route,shell(route,page,body,record))
    routes.push({ path: normalizeRoute(route), title: page.title })
  }
}
for (const route of protectedRoutes) {
  const page = { title: `${route === '/login' ? 'تسجيل الدخول' : route === '/register' ? 'إنشاء حساب' : route === '/reset-password' ? 'استعادة كلمة المرور' : 'مساحة الأعضاء'} | مجتمع السيطرة`, description: 'صفحة خاصة بأعضاء مجتمع السيطرة.' }
  await writeRoute(route,shell(route,page,`${header()}<main class="public-page wrap"><h1>هذه المساحة تتطلب الدخول.</h1><p>سيحوّلك التطبيق إلى صفحة تسجيل الدخول.</p>${htmlLink('/login','تسجيل الدخول','btn btn-primary')}</main>${footer()}`,null,true,true))
  routes.push({ path: normalizeRoute(route) })
}
const notFoundPage = { title: 'صفحة غير موجودة | مجتمع السيطرة', description: 'الصفحة المطلوبة غير متاحة في مجتمع السيطرة.' }
const deepRouteRecovery = `<script>(function(){const target=location.pathname+location.search+location.hash;const home=new URL(${JSON.stringify(siteRoot.toString())});home.searchParams.set('__saytara_route',target);location.replace(home.toString())})()</script>`
await writeFile(resolve(distDir,'404.html'),shell('/404',notFoundPage,`${header()}<main class="public-page wrap"><h1>جارٍ فتح الصفحة المطلوبة…</h1><p>لحظة واحدة.</p>${deepRouteRecovery}</main>${footer()}`,null,true,true))
await writeFile(resolve(distDir,'robots.txt'),`User-agent: *\nAllow: /\n${protectedRoutes.map(route=>`Disallow: ${basePath.replace(/\/$/,'')}${route}`).join('\n')}\nSitemap: ${new URL('sitemap.xml',siteRoot)}\n`)
const privateRoutePaths = new Set(protectedRoutes.map(normalizeRoute))
const sitemap = routes.filter(route=>!privateRoutePaths.has(route.path) && !route.path.includes('/:')).map(route=>`<url><loc>${safeText(urlFor(route.path))}</loc><lastmod>${publishedAt.toISOString().slice(0,10)}</lastmod><changefreq>${route.path==='/'?'weekly':'monthly'}</changefreq></url>`).join('')
await writeFile(resolve(distDir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${sitemap}</urlset>\n`)
await writeFile(resolve(distDir,'manus-routes.json'),JSON.stringify({ routes },null,2)+'\n')
console.log(`Pre-rendered ${Object.keys(pages).length} public landing pages, ${Object.values(recordsByPage).reduce((count,rows)=>count+rows.length,0)} public content detail pages, ${protectedRoutes.length} noindex SPA routes, sitemap.xml, robots.txt, and 404.html.`)
