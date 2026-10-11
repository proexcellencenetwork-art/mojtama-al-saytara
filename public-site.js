(() => {
  const app = document.getElementById('site-app')
  const themeButton = document.getElementById('theme-toggle')
  const menuButton = document.getElementById('menu-toggle')
  const publicNav = document.getElementById('public-nav')

  let dark = true
  try {
    const saved = localStorage.getItem('saytara-dark')
    const legacy = localStorage.getItem('mojtama-theme')
    dark = saved !== null ? saved !== 'false' : legacy !== 'light'
  } catch {
    // Keep a usable dark default if storage is disabled.
  }
  if (app) app.classList.toggle('dark', dark)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  const syncThemeMetadata = (isDark) => {
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', isDark ? '#171717' : '#f7faf9')
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(isDark))
      themeButton.setAttribute('aria-label', isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن')
      themeButton.setAttribute('title', isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن')
      themeButton.textContent = isDark ? '☼' : '◐'
    }
  }
  syncThemeMetadata(dark)

  themeButton?.addEventListener('click', () => {
    if (!app) return
    const nextDark = !app.classList.contains('dark')
    app.classList.toggle('dark', nextDark)
    document.documentElement.dataset.theme = nextDark ? 'dark' : 'light'
    syncThemeMetadata(nextDark)
    try {
      localStorage.setItem('saytara-dark', String(nextDark))
      localStorage.setItem('mojtama-theme', nextDark ? 'dark' : 'light')
    } catch {
      // Theme switching remains available for this page even without storage.
    }
  })

  const closeMenu = () => {
    publicNav?.classList.remove('nav-open')
    menuButton?.setAttribute('aria-expanded', 'false')
    menuButton?.setAttribute('aria-label', 'فتح قائمة التنقل')
  }
  menuButton?.addEventListener('click', () => {
    const open = publicNav?.classList.toggle('nav-open') || false
    menuButton.setAttribute('aria-expanded', String(open))
    menuButton.setAttribute('aria-label', open ? 'إغلاق قائمة التنقل' : 'فتح قائمة التنقل')
  })
  publicNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu()
  })
})()
