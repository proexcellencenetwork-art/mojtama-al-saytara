(() => {
  const app = document.getElementById('site-app')
  const themeButton = document.getElementById('theme-toggle')
  const menuButton = document.getElementById('menu-toggle')
  const publicNav = document.getElementById('public-nav')

  let savedTheme = ''
  try {
    savedTheme = localStorage.getItem('mojtama-theme') || ''
  } catch {
    // Storage may be disabled; the public site still works with its light default.
  }
  if (app && savedTheme === 'dark') app.classList.add('dark')
  if (themeButton) themeButton.setAttribute('aria-pressed', String(app?.classList.contains('dark') || false))

  themeButton?.addEventListener('click', () => {
    if (!app) return
    const dark = app.classList.toggle('dark')
    themeButton.setAttribute('aria-pressed', String(dark))
    themeButton.setAttribute('aria-label', dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن')
    try {
      localStorage.setItem('mojtama-theme', dark ? 'dark' : 'light')
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
