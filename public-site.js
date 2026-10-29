(() => {
  const app = document.getElementById('site-app')
  const themeButton = document.getElementById('theme-toggle')
  const menuButton = document.getElementById('menu-toggle')
  const publicNav = document.getElementById('public-nav')
  const header = menuButton?.closest('.topbar')

  const readThemePreference = () => {
    try {
      const saved = localStorage.getItem('saytara-dark')
      if (saved === 'true' || saved === 'false') return saved === 'true'
      const legacy = localStorage.getItem('mojtama-theme')
      if (legacy === 'dark') return true
      if (legacy === 'light') return false
    } catch {
      // Keep the dark-first experience when storage is unavailable.
    }
    return true
  }

  const setTheme = (dark, persist = false) => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    app?.classList.toggle('dark', dark)

    const themeColor = document.querySelector('meta[name="theme-color"]')
    themeColor?.setAttribute('content', dark ? '#171717' : '#f7faf9')

    if (themeButton) {
      themeButton.setAttribute('type', 'button')
      themeButton.setAttribute('aria-pressed', String(dark))
      themeButton.setAttribute('aria-label', dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن')
      themeButton.setAttribute('title', dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن')
      const icon = themeButton.querySelector('[aria-hidden="true"]')
      if (icon) icon.textContent = dark ? '☼' : '◐'
    }

    if (persist) {
      try {
        localStorage.setItem('saytara-dark', String(dark))
        localStorage.setItem('mojtama-theme', dark ? 'dark' : 'light')
      } catch {
        // Switching themes still works for the current page.
      }
    }
  }

  setTheme(readThemePreference())

  themeButton?.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark'
    setTheme(!isDark, true)
  })

  const closeMenu = (restoreFocus = false) => {
    if (!publicNav || !menuButton) return
    publicNav.classList.remove('nav-open')
    menuButton.setAttribute('aria-expanded', 'false')
    menuButton.setAttribute('aria-label', 'فتح قائمة التنقل')
    menuButton.setAttribute('title', 'فتح قائمة التنقل')
    if (restoreFocus) menuButton.focus()
  }

  menuButton?.setAttribute('aria-controls', 'public-nav')
  menuButton?.setAttribute('aria-expanded', String(publicNav?.classList.contains('nav-open') || false))
  menuButton?.addEventListener('click', () => {
    const open = publicNav?.classList.toggle('nav-open') || false
    menuButton.setAttribute('aria-expanded', String(open))
    menuButton.setAttribute('aria-label', open ? 'إغلاق قائمة التنقل' : 'فتح قائمة التنقل')
    menuButton.setAttribute('title', open ? 'إغلاق قائمة التنقل' : 'فتح قائمة التنقل')
  })


  const newsletterForm = document.querySelector('[data-newsletter-form]')
  const supabaseUrl = newsletterForm?.dataset.supabaseUrl || ''
  const publicKey = newsletterForm?.dataset.anonKey || ''
  const basePath = newsletterForm?.dataset.basePath || '/'
  const consentKey = 'saytara-analytics-consent'
  const visitorKey = 'saytara-analytics-visitor'
  const attributionKey = 'saytara-analytics-attribution'

  const currentPath = () => {
    let path = window.location.pathname
    const base = basePath.replace(/\\/+$/, '')
    if (base && base !== '/' && path.startsWith(base)) path = path.slice(base.length) || '/'
    return path.startsWith('/') ? path : '/' + path
  }
  const visitorId = () => {
    try {
      let value = localStorage.getItem(visitorKey)
      if (!value) { value = crypto.randomUUID(); localStorage.setItem(visitorKey, value) }
      return value
    } catch { return null }
  }
  const trackStaticPageView = async () => {
    if (!supabaseUrl || !publicKey || localStorage.getItem(consentKey) !== 'accepted') return
    const id = visitorId()
    if (!id) return
    const params = new URLSearchParams(window.location.search)
    let externalHost = null
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer)
        if (ref.hostname !== window.location.hostname) externalHost = ref.hostname.slice(0,160)
      }
    } catch {}
    const current = { source: params.get('utm_source') || externalHost, medium: params.get('utm_medium') || (externalHost ? 'referral' : null), campaign: params.get('utm_campaign') || null }
    let attribution = current
    try {
      const saved = localStorage.getItem(attributionKey)
      if (saved) attribution = { ...JSON.parse(saved), ...Object.fromEntries(Object.entries(current).filter(([,v]) => v)) }
      if (!saved || Object.values(current).some(Boolean)) localStorage.setItem(attributionKey, JSON.stringify(attribution))
    } catch {}
    let timezone = null
    try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null } catch {}
    const payload = {
      p_event_name: 'page_view', p_page_path: currentPath(), p_visitor_id: id,
      p_event_label: (document.title || '').slice(0,160), p_referrer_host: externalHost,
      p_source: attribution.source || externalHost, p_medium: attribution.medium, p_campaign: attribution.campaign,
      p_timezone: timezone, p_locale: (navigator.language || '').slice(0,24) || null,
      p_device_category: window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
    }
    try {
      await fetch(supabaseUrl.replace(/\\/$/, '') + '/rest/v1/rpc/record_site_analytics_event', {
        method: 'POST', headers: { apikey: publicKey, Authorization: 'Bearer ' + publicKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), keepalive: true,
      })
    } catch {}
  }

  const showAnalyticsConsent = () => {
    if (localStorage.getItem(consentKey) !== null || document.querySelector('.analytics-consent-banner')) return
    const banner = document.createElement('aside')
    banner.className = 'analytics-consent-banner'
    banner.setAttribute('dir','rtl')
    banner.setAttribute('aria-label','إعدادات التحليلات')
    banner.innerHTML = '<div class="analytics-consent-icon" aria-hidden="true">✓</div><div class="analytics-consent-copy"><b>ساعدنا نحسّن مجتمع السيطرة</b><p>يمكنك السماح بقياس مشاهدات الصفحات ومصدر الزيارة بشكل محدود. لا نجمع إجابات الأدوات أو نصوص النماذج، ولا نستنتج المدينة أو الدولة من المنطقة الزمنية.</p><a href="' + basePath.replace(/\\/$/,'') + '/privacy/">اقرأ سياسة الخصوصية</a></div><div class="analytics-consent-actions"><button type="button" class="btn btn-primary btn-small" data-analytics-accept>موافقة</button><button type="button" class="btn btn-outline btn-small" data-analytics-decline>رفض</button></div>'
    document.body.appendChild(banner)
    banner.querySelector('[data-analytics-accept]')?.addEventListener('click', () => {
      localStorage.setItem(consentKey,'accepted'); banner.remove(); void trackStaticPageView()
    })
    banner.querySelector('[data-analytics-decline]')?.addEventListener('click', () => {
      localStorage.setItem(consentKey,'declined'); banner.remove()
    })
  }

  showAnalyticsConsent()
  if (localStorage.getItem(consentKey) === 'accepted') void trackStaticPageView()

  if (window.location.pathname.replace(/\\/+$/,'').endsWith('/privacy')) {
    const points = document.querySelector('.public-points')
    if (points && !document.querySelector('[data-reset-analytics-consent]')) {
      const controls = document.createElement('div')
      controls.className = 'privacy-analytics-controls'
      controls.innerHTML = '<p>يمكنك إعادة فتح خيارات الموافقة على التحليلات في أي وقت.</p><button type="button" class="btn btn-outline btn-small" data-reset-analytics-consent>تغيير تفضيل التحليلات</button>'
      points.after(controls)
      controls.querySelector('[data-reset-analytics-consent]')?.addEventListener('click', () => {
        localStorage.removeItem(consentKey); document.querySelector('.analytics-consent-banner')?.remove(); showAnalyticsConsent()
      })
    }
  }

  document.querySelectorAll('[data-newsletter-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const node = form
      const message = node.querySelector('[data-newsletter-message]')
      const submit = node.querySelector('button[type="submit"]')
      const fields = new FormData(node)
      const email = String(fields.get('email') || '').trim().toLowerCase()
      const consent = fields.get('consent') === 'on'
      const website = String(fields.get('website') || '')
      const say = (text, isError = false) => {
        if (!message) return
        message.textContent = text
        message.classList.toggle('is-error', isError)
        message.setAttribute('role', isError ? 'alert' : 'status')
      }
      if (!consent) { say('يرجى الموافقة على الاشتراك أولًا.', true); return }
      if (!supabaseUrl || !publicKey) { say('الاشتراك غير متاح حاليًا لأن خدمة المجتمع غير متصلة.', true); return }
      if (submit) { submit.disabled = true; submit.textContent = 'جارٍ الحفظ…' }
      try {
        const response = await fetch(supabaseUrl.replace(/\\/$/, '') + '/functions/v1/newsletter-subscribe', {
          method: 'POST', headers: { apikey: publicKey, Authorization: 'Bearer ' + publicKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, consent, sourcePath: currentPath(), website }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok || result.status !== 'subscribed') {
          say(result.error === 'rate_limited' ? 'وصلت إلى حد المحاولات المؤقت. حاول لاحقًا.' : 'تعذر حفظ الاشتراك الآن. حاول مرة أخرى لاحقًا.', true)
        } else {
          say('تم حفظ موافقتك وبريدك في قائمة المجتمع. لم يتم تفعيل إرسال النشرات بعد؛ نحتاج ربط مزود بريد قبل وصول الرسائل.')
          node.reset()
        }
      } catch { say('تعذر الاتصال بخدمة الاشتراك. حاول مرة أخرى لاحقًا.', true) }
      finally { if (submit) { submit.disabled = false; submit.textContent = 'اشترك' } }
    })
  })

  publicNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMenu()))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && publicNav?.classList.contains('nav-open')) closeMenu(true)
  })
  document.addEventListener('click', (event) => {
    if (!header || !(event.target instanceof Node)) return
    if (!header.contains(event.target) && publicNav?.classList.contains('nav-open')) closeMenu()
  })
})()
