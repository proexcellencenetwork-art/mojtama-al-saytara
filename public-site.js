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

  publicNav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => closeMenu()))
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && publicNav?.classList.contains('nav-open')) closeMenu(true)
  })
  document.addEventListener('click', (event) => {
    if (!header || !(event.target instanceof Node)) return
    if (!header.contains(event.target) && publicNav?.classList.contains('nav-open')) closeMenu()
  })
})()
