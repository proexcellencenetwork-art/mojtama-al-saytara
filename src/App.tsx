import { lazy, Suspense, useEffect, useState } from 'react'
import type { RealtimeChannel, SupabaseClient, User } from '@supabase/supabase-js'
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, ArrowUpLeft, BadgeCheck, Bell, Bookmark, BriefcaseMedical, CalendarDays, Check, ChevronDown, Compass, FileText, Flag, Heart, HeartHandshake, Home, LockKeyhole, Menu, MessageCircle, Moon, MoreHorizontal, Plus, Search, Send, Settings, Shield, ShieldCheck, Sparkles, Sun, UserPlus, Users, Video, X } from 'lucide-react'
import { isSupabaseConfigured } from './lib/supabase-config'
import type { Role } from './appTypes'
import './App.css'

const LoginPage = lazy(() => import('./components/AuthPages').then(module => ({ default: module.LoginPage })))
const ResetPasswordPage = lazy(() => import('./components/AuthPages').then(module => ({ default: module.ResetPasswordPage })))
const LiveDashboardPage = lazy(() => import('./components/LiveDashboardPage').then(module => ({ default: module.LiveDashboardPage })))
const LiveFeedPage = lazy(() => import('./components/LiveFeedPage').then(module => ({ default: module.LiveFeedPage })))
const LivePublicPage = lazy(() => import('./components/LivePublicPage').then(module => ({ default: module.LivePublicPage })))
const OwnerPortalPage = lazy(() => import('./components/OwnerPortalPage').then(module => ({ default: module.OwnerPortalPage })))
const LearningCenterPage = lazy(() => import('./components/LearningCenterPage'))
const LearningRoomPage = lazy(() => import('./components/LearningRoomPage'))

const roleNames: Record<Role, string> = { member: 'عضو', verified: 'عضو موثّق', coach: 'كوتش', moderator: 'مشرف', manager: 'مدير', owner: 'مالك المنصة' }
type AccountStatus = 'pending' | 'approved' | 'rejected' | 'unknown'
function hasConfirmedEmail(user: User | null | undefined) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at)
}
function isPasswordRecoveryRoute() {
  return window.location.pathname.endsWith('/reset-password') || new URLSearchParams(window.location.search).get('flow') === 'recovery'
}
const demoPosts = [
  { id: 1, name: 'د. ليان الحربي', title: 'طبيبة أسرة · الرياض', role: 'verified' as Role, time: 'منذ ٣ ساعات', text: 'في نهاية المناوبة، أحياناً يكون ألطف قرار مهني هو أن نمنح أنفسنا استراحة قصيرة قبل أن نجيب عن كل شيء. ما الطقس الصغير الذي يساعدكم على استعادة تركيزكم؟', tags: ['التوازن المهني', 'العناية بالذات'], likes: 28, comments: 6, avatar: 'ل' },
  { id: 2, name: 'أ. عمر السبيعي', title: 'صيدلي إكلينيكي · جدة', role: 'coach' as Role, time: 'أمس', text: 'أطلقنا هذا الأسبوع دائرة حوار صغيرة حول اتخاذ القرار في المراحل المهنية المبكرة. شكراً لكل من شارك بصراحة واحترام. التسجيل للقاء القادم متاح الآن.', tags: ['تطوير مهني', 'لقاء مجتمعي'], likes: 41, comments: 9, avatar: 'ع' },
  { id: 3, name: 'مها القحطاني', title: 'ممرضة عناية مركزة · الدمام', role: 'member' as Role, time: 'قبل يومين', text: 'أبحث عن زميلات مهتمات بإنشاء مجموعة دعم مهني هادئة لممارسي الرعاية الحرجة. مساحة للتعلّم وتبادل الخبرة مع الحفاظ على الخصوصية.', tags: ['تمريض', 'مجتمع'], likes: 17, comments: 4, avatar: 'م' },
]
const navItems = [
  { to: '/feed', label: 'الخلاصة', icon: Home }, { to: '/connections', label: 'الاتصالات', icon: Users },
  { to: '/messages', label: 'الرسائل', icon: MessageCircle }, { to: '/groups', label: 'المجموعات', icon: Compass },
  { to: '/events', label: 'الفعاليات', icon: CalendarDays }, { to: '/notifications', label: 'الإشعارات', icon: Bell },
  { to: '/learning', label: 'مركز التعلّم', icon: Video },
]

function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="مجتمع السيطرة - الرئيسية"><span className="brand-mark"><HeartHandshake size={21} strokeWidth={1.8}/><i /></span><span className="brand-word">مجتمع <b>السيطرة</b><small>مساحة مهنية آمنة</small></span></Link>
}
function Verified({ role }: { role: Role }) { return role !== 'member' ? <span className={`verified-mark ${role === 'coach' ? 'coach-mark' : ''}`} title={roleNames[role]}><BadgeCheck size={14}/></span> : null }
function Avatar({ letter, tone = 0, size = 'md' }: { letter: string; tone?: number; size?: string }) { return <span className={`avatar avatar-${tone % 5} avatar-${size}`}>{letter}</span> }
function Footer() { return <footer className="site-footer"><div className="wrap footer-inner"><Brand/><span>مجتمع مهني يضع الإنسان في قلب التطور.</span><div className="footer-links"><Link to="/privacy">الخصوصية</Link><Link to="/terms">الشروط</Link><Link to="/charter">ميثاق السلوك</Link></div><small>© ٢٠٢٦ مجتمع السيطرة</small></div></footer> }

function Header({ demo, authenticated, displayName, role, toggleTheme, dark }: { demo: boolean; authenticated: boolean; displayName: string; role: Role; toggleTheme: () => void; dark: boolean }) {
  const [open, setOpen] = useState(false)
  return <header className="topbar"><div className="topbar-inner wrap"><Brand/><nav className={`public-nav ${open ? 'nav-open' : ''}`}><NavLink to="/about">عن المجتمع</NavLink><NavLink to="/coaching">الكوتشنج</NavLink><NavLink to="/coaches">الكوتشات</NavLink><NavLink to="/articles">المقالات</NavLink><NavLink to="/events">الفعاليات</NavLink></nav><div className="header-actions"><button className="icon-btn theme-toggle" aria-label="تبديل الوضع" onClick={toggleTheme}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>{authenticated ? <Link className="user-chip" to="/profile"><Avatar letter={displayName.trim().charAt(0) || 'ع'} size="sm"/><span>{displayName} · {demo ? 'تجربة' : roleNames[role]}</span><ChevronDown size={14}/></Link> : <><Link className="login-link" to="/login">تسجيل الدخول</Link><Link className="btn btn-primary btn-small" to="/register">انضم للمجتمع <ArrowLeft size={15}/></Link></>}<button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label="القائمة">{open ? <X size={20}/> : <Menu size={20}/>}</button></div></div></header>
}
function PublicHome() { return <><section className="hero wrap"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> مساحة مهنية للقطاع الصحي</div><h1>مسارك المهني،<br/><em>بإيقاعك أنت.</em></h1><p className="hero-lead">مجتمع السيطرة مساحة آمنة للمهنيين الصحيين كي يتطوروا، يتواصلوا، ويصنعوا توازناً مهنياً يشبههم.</p><div className="hero-actions"><Link className="btn btn-primary" to="/register">اكتشف مساحتك <ArrowLeft size={17}/></Link><Link className="btn btn-quiet" to="/coaching">تعرّف على الكوتشنج <ArrowUpLeft size={17}/></Link></div><div className="hero-proof"><div className="avatar-stack"><Avatar letter="ل" size="sm"/><Avatar letter="ع" tone={1} size="sm"/><Avatar letter="م" tone={2} size="sm"/><Avatar letter="ر" tone={3} size="sm"/></div><span><b>مجتمع يبدأ بالإنصات</b><small>لكل مرحلة من رحلتك المهنية</small></span></div></div><div className="hero-art" aria-label="تصميم تجريدي يرمز إلى التواصل والدعم المهني"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="art-core"><HeartHandshake size={65} strokeWidth={1.2}/><span className="art-spark spark-a">✳</span><span className="art-spark spark-b">✦</span></div><div className="art-note note-top"><span className="note-icon"><Sparkles size={16}/></span><span><b>خطوة صغيرة</b><small>تصنع فرقاً مستمراً</small></span></div><div className="art-note note-bottom"><span className="note-icon note-gold"><BadgeCheck size={16}/></span><span><b>خبرة موثّقة</b><small>من أهل الاختصاص</small></span></div><div className="art-ring-label">تطوّر · تواصل · توازن</div></div></section><section className="trust-strip"><div className="wrap trust-inner"><span>مساحة تجمع بين</span><b><BriefcaseMedical size={17}/> الخبرة المهنية</b><i/><b><Heart size={17}/> الرفاه والتوازن</b><i/><b><Shield size={17}/> الخصوصية والاحترام</b></div></section><section className="section wrap"><div className="section-heading"><div><span className="eyebrow">مساحتك، بطريقتك</span><h2>ما تحتاجه في رحلتك المهنية</h2></div><Link to="/about" className="text-link">اكتشف المجتمع <ArrowLeft size={15}/></Link></div><div className="feature-grid"><article className="feature-card feature-main"><span className="feature-icon"><HeartHandshake/></span><span className="feature-count">01</span><h3>كوتشنج فردي</h3><p>مساحة حوار خاصة تساعدك على رؤية خياراتك المهنية بوضوح، وبناء خطوات تناسبك.</p><Link to="/coaching" className="card-link">كيف يعمل الكوتشنج؟ <ArrowLeft size={14}/></Link></article><article className="feature-card"><span className="feature-icon feature-icon-blue"><Users/></span><span className="feature-count">02</span><h3>زمالة حقيقية</h3><p>تواصل مع مهنيين يشاركونك المجال، التحديات والطموح.</p><Link to="/register" className="card-link">ابدأ التواصل <ArrowLeft size={14}/></Link></article><article className="feature-card"><span className="feature-icon feature-icon-gold"><BadgeCheck/></span><span className="feature-count">03</span><h3>خبرة موثّقة</h3><p>تعرّف على الكوتشات والمهنيين بعد مراجعة بياناتهم المهنية.</p><Link to="/coaches" className="card-link">تعرّف على الكوتشات <ArrowLeft size={14}/></Link></article></div></section><section className="quote-section"><div className="wrap quote-inner"><span className="quote-mark">“</span><div><p>حين نمنح أنفسنا مساحة للتفكير، نصبح أقرب إلى الطريق الذي نختاره بوعي.</p><small>مجتمع السيطرة · مساحتك المهنية الآمنة</small></div><Link to="/charter" className="btn btn-outline">ميثاقنا المهني <ArrowLeft size={15}/></Link></div></section><section className="section wrap join-section"><div><span className="eyebrow">خطوتك القادمة تبدأ هنا</span><h2>أنت أكثر من مسماك المهني.</h2><p>انضم إلى مساحة ترى خبرتك، وتحترم حدودك، وتدعم نموّك.</p></div><Link className="btn btn-primary" to="/register">انضم إلى مجتمع السيطرة <ArrowLeft size={16}/></Link></section><Footer/></> }

const publicCopy: Record<string, { title: string; eyebrow: string; intro: string; points: [string, string][] }> = {
  about: { eyebrow: 'عن مجتمعنا', title: 'نؤمن أن النمو المهني يبدأ بمساحة آمنة.', intro: 'مجتمع السيطرة مساحة مهنية للمهنيين الصحيين، تجمع الكوتشنج الفردي والتواصل الهادف والمحتوى الموثوق. صُممت لتساعدك على التطور وإدارة الضغط واتخاذ قراراتك بوعي.', points: [['مساحة آمنة', 'الاحترام والسرية أساس كل تواصل.'], ['خبرة مهنية', 'توثيق واضح للمهنيين والكوتشات.'], ['نمو متوازن', 'تطوير لا يتجاهل الإنسان خلف الدور.']] },
  coaching: { eyebrow: 'الكوتشنج المهني', title: 'مساحة للتفكير. وخطوة تنبع منك.', intro: 'الكوتشنج حوار مهني يساعدك على توضيح أهدافك وخياراتك، واستكشاف الخطوات التي تناسبك في مسيرتك.', points: [['تطوير المسار', 'رؤية أوضح لأهدافك وخياراتك المهنية.'], ['إدارة الضغط', 'مساحة للتأمل في التحديات وحدودك.'], ['اتخاذ القرار', 'تحويل الأفكار إلى خطوات قابلة للتجربة.']] },
  coaches: { eyebrow: 'الكوتشات', title: 'تعرّف على من يصغي إلى رحلتك.', intro: 'كوتشات بخبرات متنوعة ومساحات حوار مهنية، مع ملفات واضحة وشارة توثيق عند اكتمال المراجعة.', points: [['أ. عمر السبيعي', 'كوتش مهني · صيدلة إكلينيكية · جدة'], ['د. سارة العتيبي', 'كوتش مهني · طب الأسرة · الرياض'], ['أ. ريم القحطاني', 'كوتش مهني · تمريض · الخبر']] },
  articles: { eyebrow: 'مكتبة المجتمع', title: 'معرفة تساعدك على التقدّم.', intro: 'مقالات مختارة حول التطور المهني، التوازن، وإدارة الضغط في بيئة الرعاية الصحية.', points: [['من أين تبدأ مراجعة مسارك؟', 'خطوات للتفكير في خياراتك المهنية.'], ['حدود صحية في بيئة العمل', 'كيف تبني حدوداً مهنية واضحة؟'], ['الإنهاك: إشارات تستحق الإصغاء', 'تأملات حول الرفاه المهني وطلب الدعم.']] },
  events: { eyebrow: 'فعاليات قادمة', title: 'نتعلّم معاً، ونصنع مساحة للحوار.', intro: 'لقاءات ومجالس مهنية يقودها أعضاء موثّقون وكوتشات. المشاركة المجتمعية متاحة للأعضاء.', points: [['جلسة: وضوح المسار المهني', 'الأربعاء · لقاء افتراضي · ٧:٣٠ مساءً'], ['مجلس ممارسي الرعاية الحرجة', 'السبت · حوار مجتمعي · ٥:٠٠ مساءً'], ['ورشة: حدود مهنية أكثر صحة', '١٥ أكتوبر · بقيادة كوتش موثّق']] },
  faq: { eyebrow: 'الأسئلة الشائعة', title: 'إجابات واضحة، قبل أن تبدأ.', intro: 'ما تحتاج معرفته عن العضوية، التوثيق، والكوتشنج في مجتمع السيطرة.', points: [['هل التوثيق إلزامي للانضمام؟', 'لا. التوثيق اختياري ويُطلب لمنح صلاحيات النشر المهني.'], ['هل الكوتشنج استشارة طبية أو نفسية؟', 'لا. الكوتشنج لا يغني عن الاستشارة الطبية أو النفسية.'], ['هل العضوية المميزة تعني أنني موثّق؟', 'لا. العضوية المميزة والتوثيق مساران منفصلان تماماً.']] },
  privacy: { eyebrow: 'الخصوصية', title: 'بياناتك المهنية تخصّك.', intro: 'لا يطلب مجتمع السيطرة بيانات صحية حساسة. تُستخدم بيانات الحساب لتشغيل المجتمع، وتُعامل مستندات التوثيق كمرفقات خاصة لا يطّلع عليها إلا فريق المراجعة. تتوفر أدوات لتصدير بيانات الحساب أو حذفه من الإعدادات.', points: [['تقليل البيانات', 'نطلب الحد الأدنى اللازم لتشغيل الخدمة.'], ['ملفات التوثيق', 'تخزين خاص وصلاحية مراجعة محدودة.'], ['تحكمك', 'يمكنك طلب التصدير أو حذف الحساب.']] },
  terms: { eyebrow: 'الشروط', title: 'مساحة مهنية تقوم على الوضوح.', intro: 'باستخدام المجتمع، توافق على احترام الأعضاء وخصوصيتهم، وعدم نشر محتوى مضلل أو مسيء، والامتناع عن مشاركة أي معلومات أو صور تخص المرضى.', points: [['استخدم المنصة بمسؤولية', 'لا تشارك بيانات دخولك أو بيانات الغير.'], ['لا محتوى للمرضى', 'يُمنع نشر معلومات أو صور المرضى منعاً باتاً.'], ['إشراف عادل', 'يحق لفريق الإشراف مراجعة البلاغات واتخاذ إجراء.']] },
  charter: { eyebrow: 'ميثاق السلوك', title: 'الاحترام ليس خياراً إضافياً.', intro: 'نحافظ معاً على مساحة مهنية تحترم الإنسان والخصوصية وتفسح المجال للاختلاف.', points: [['احترام متبادل', 'نختلف في الرأي دون إساءة أو تحرش.'], ['سرية مهنية', 'لا تعيد نشر محتوى الأعضاء خارج سياقه.'], ['لا إزعاج ولا ترويج', 'لا رسائل مزعجة، ولا ادعاءات أو ترويج مضلل.']] },
}
function PublicPage({ page }: { page: keyof typeof publicCopy }) {
  if (isSupabaseConfigured && ['coaches', 'articles', 'events'].includes(page)) return <LivePublicPage page={page} />
  const item = publicCopy[page]
  return <><main className="public-page wrap"><nav className="breadcrumbs" aria-label="مسار التنقل"><Link to="/">الرئيسية</Link><span aria-hidden="true">/</span><span>{item.eyebrow}</span></nav><div className="public-page-copy"><span className="eyebrow">{item.eyebrow}</span><h1>{item.title}</h1><p className="hero-lead">{item.intro}</p></div><div className="public-points">{item.points.map(([title, text], i) => <article className="public-point" key={title}><span className="point-number">0{i + 1}</span><div><h2>{title}</h2><p>{text}</p></div><ArrowLeft size={17}/></article>)}</div><div className="coaching-note"><ShieldCheck size={19}/><p><b>تنويه مهم:</b> الكوتشنج لا يغني عن الاستشارة الطبية أو النفسية.</p></div><nav className="related-links" aria-label="صفحات مرتبطة"><b>قد تهمك</b><Link to="/coaching">تعرّف على الكوتشنج المهني</Link><Link to="/articles">اقرأ مقالات المجتمع</Link><Link to="/faq">إجابات الأسئلة الشائعة</Link></nav></main><Footer/></>
}

const publicSeo: Record<string, { title: string; description: string }> = {
  '/': { title: 'مجتمع السيطرة | مجتمع مهني صحي', description: 'مساحة مهنية آمنة للمهنيين الصحيين للتواصل والكوتشنج والتطور المهني المتوازن.' },
  '/about': { title: 'عن مجتمع السيطرة | مساحة مهنية آمنة', description: 'تعرّف على مجتمع مهني للمهنيين الصحيين يجمع التواصل الهادف والكوتشنج والخصوصية.' },
  '/coaching': { title: 'كوتشنج مهني للقطاع الصحي | مجتمع السيطرة', description: 'مساحة حوار مهني تساعد العاملين في الرعاية الصحية على توضيح أهدافهم وخياراتهم.' },
  '/coaches': { title: 'دليل الكوتشات | مجتمع السيطرة', description: 'تعرّف على الكوتشات والملفات المهنية العامة المنشورة في مجتمع السيطرة.' },
  '/articles': { title: 'مقالات التطور المهني الصحي | مجتمع السيطرة', description: 'اقرأ محتوى مجتمع السيطرة المنشور عن النمو المهني والتوازن والعمل في القطاع الصحي.' },
  '/events': { title: 'الفعاليات المهنية الصحية | مجتمع السيطرة', description: 'تابع الفعاليات العامة القادمة للمهنيين الصحيين في مجتمع السيطرة.' },
  '/faq': { title: 'الأسئلة الشائعة | مجتمع السيطرة', description: 'إجابات عن العضوية والتوثيق والكوتشنج والخصوصية في مجتمع السيطرة.' },
  '/privacy': { title: 'سياسة الخصوصية | مجتمع السيطرة', description: 'اقرأ كيف يتعامل مجتمع السيطرة مع بيانات الحساب والخصوصية وطلبات التوثيق.' },
  '/terms': { title: 'شروط الاستخدام | مجتمع السيطرة', description: 'الشروط المهنية لاستخدام مجتمع السيطرة واحترام خصوصية الأعضاء والمرضى.' },
  '/charter': { title: 'ميثاق السلوك المهني | مجتمع السيطرة', description: 'مبادئ الاحترام والسرية والتواصل المسؤول في مجتمع السيطرة.' },
  '/login': { title: 'تسجيل الدخول | مجتمع السيطرة', description: 'سجّل الدخول إلى مساحتك المهنية في مجتمع السيطرة.' },
  '/register': { title: 'إنشاء حساب | مجتمع السيطرة', description: 'أنشئ حساباً للانضمام إلى مجتمع مهني للقطاع الصحي.' },
  '/reset-password': { title: 'استعادة كلمة المرور | مجتمع السيطرة', description: 'استعد الوصول إلى حسابك في مجتمع السيطرة.' },
  '/owner': { title: 'مركز مالك المنصة | مجتمع السيطرة', description: 'بوابة خاصة لإدارة ملكية منصة مجتمع السيطرة.' },
  '/learning': { title: 'مركز التعلّم | مجتمع السيطرة', description: 'ورش مهنية حيّة ومسجلة للأعضاء المعتمدين في مجتمع السيطرة.' },
}
const privatePaths = new Set(['/login', '/register', '/reset-password', '/feed', '/profile', '/connections', '/messages', '/notifications', '/groups', '/verification', '/moderation', '/admin', '/settings', '/owner', '/learning', '/learning-room'])

function RouteMetadata() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname.replace(/\/$/, '') || '/'
    const workshopRoute = /^\/learning-room\/[0-9a-f-]{36}$/i.test(path)
    const meta = publicSeo[path] || (workshopRoute ? { title: 'غرفة ورشة مهنية | مجتمع السيطرة', description: 'غرفة تعليمية خاصة لأعضاء مجتمع السيطرة المعتمدين.' } : undefined)
    const detailRoute = /^\/(articles|events|coaches)\/[^/]+$/.test(path)
    if (detailRoute) return
    const privateRoute = privatePaths.has(path) || workshopRoute
    const siteRoot = import.meta.env.VITE_SITE_URL || `${window.location.origin}${import.meta.env.BASE_URL}`
    const canonical = new URL(path === '/' ? '' : `${path.replace(/^\//, '')}/`, siteRoot.endsWith('/') ? siteRoot : `${siteRoot}/`).toString()
    document.title = meta?.title || 'صفحة غير موجودة | مجتمع السيطرة'
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = meta?.description || 'الصفحة المطلوبة غير متاحة في مجتمع السيطرة.'
    const socialTitle = meta?.title || 'صفحة غير موجودة | مجتمع السيطرة'
    const socialDescription = meta?.description || 'الصفحة المطلوبة غير متاحة في مجتمع السيطرة.'
    for (const [selector, content] of [
      ['meta[property="og:title"]', socialTitle], ['meta[property="og:description"]', socialDescription],
      ['meta[property="og:url"]', canonical], ['meta[name="twitter:title"]', socialTitle],
      ['meta[name="twitter:description"]', socialDescription],
    ] as const) {
      const social = document.querySelector<HTMLMetaElement>(selector)
      if (social) social.content = content
    }
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (robots) robots.content = meta && !privateRoute ? 'index,follow,max-image-preview:large' : 'noindex,nofollow'
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (meta) {
      if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.append(link) }
      link.href = canonical
    } else {
      link?.remove()
      document.querySelector('link[rel="alternate"][hreflang="ar"]')?.remove()
    }
  }, [pathname])
  return null
}

function LivePublicDetailPage({ page, client }: { page: 'articles' | 'events' | 'coaches'; client: SupabaseClient | null }) {
  const { id, slug } = useParams()
  const key = slug || id || ''
  const [row, setRow] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      if (!client || !key) { setRow(null); setLoading(false); return }
      const query = page === 'articles'
        ? client.from('articles').select('id,title,slug,excerpt,body,published_at').eq('status', 'published').eq('slug', key).maybeSingle()
        : page === 'events'
          ? client.from('events').select('id,title,description,starts_at,ends_at,location').eq('is_private', false).eq('moderation_state', 'visible').eq('id', key).maybeSingle()
          : client.from('public_coaches').select('user_id,display_name,headline,profession,specialty,city,public_bio,coaching_topics').eq('user_id', key).maybeSingle()
      const result = await query
      if (!active) return
      const publicRow = result.error ? null : result.data as Record<string, unknown> | null
      setRow(publicRow)
      setLoading(false)
      if (publicRow) {
        const title = String(publicRow.title || publicRow.display_name || 'محتوى المجتمع')
        const safeTitle = `${[...title].slice(0, 40).join('')} | مجتمع السيطرة`
        document.title = safeTitle
        const description = String(publicRow.excerpt || publicRow.public_bio || publicRow.description || 'محتوى عام منشور في مجتمع السيطرة.').slice(0, 155)
        const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
        if (meta) meta.content = description
        const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
        if (robots) robots.content = 'index,follow,max-image-preview:large'
        const siteRoot = import.meta.env.VITE_SITE_URL || `${window.location.origin}${import.meta.env.BASE_URL}`
        const canonical = new URL(`${page}/${encodeURIComponent(key)}/`, siteRoot.endsWith('/') ? siteRoot : `${siteRoot}/`).toString()
        const canonicalTag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
        if (canonicalTag) canonicalTag.href = canonical
        for (const [selector, content] of [
          ['meta[property="og:title"]', safeTitle], ['meta[property="og:description"]', description],
          ['meta[property="og:url"]', canonical], ['meta[name="twitter:title"]', safeTitle],
          ['meta[name="twitter:description"]', description],
        ] as const) {
          const social = document.querySelector<HTMLMetaElement>(selector)
          if (social) social.content = content
        }
        const schemaType = page === 'articles' ? 'Article' : page === 'events' ? 'Event' : 'Person'
        let schema = document.querySelector<HTMLScriptElement>(`script[data-detail-schema="${schemaType}"]`)
        if (!schema) { schema = document.createElement('script'); schema.type = 'application/ld+json'; schema.dataset.detailSchema = schemaType; document.head.append(schema) }
        const json = schemaType === 'Article'
          ? { '@context': 'https://schema.org', '@type': 'Article', headline: title, description, datePublished: publicRow.published_at, inLanguage: 'ar', mainEntityOfPage: canonical, publisher: { '@type': 'Organization', name: 'مجتمع السيطرة', url: siteRoot } }
          : schemaType === 'Event'
            ? { '@context': 'https://schema.org', '@type': 'Event', name: title, description, startDate: publicRow.starts_at, endDate: publicRow.ends_at, eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', location: { '@type': 'VirtualLocation', url: canonical }, inLanguage: 'ar' }
            : { '@context': 'https://schema.org', '@type': 'Person', name: title, jobTitle: publicRow.headline || publicRow.profession, description, url: canonical, knowsAbout: publicRow.coaching_topics || [] }
        schema.textContent = JSON.stringify(json)
      } else {
        const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
        if (robots) robots.content = 'noindex,nofollow'
      }
    }
    void load()
    return () => { active = false }
  }, [key, page, client])
  const title = String(row?.title || row?.display_name || '')
  const body = String(row?.body || row?.public_bio || row?.description || '')
  return <><main className="public-page wrap"><nav className="breadcrumbs" aria-label="مسار التنقل"><Link to="/">الرئيسية</Link><span>/</span><Link to={`/${page}`}>{page === 'articles' ? 'المقالات' : page === 'events' ? 'الفعاليات' : 'الكوتشات'}</Link><span>/</span><span>{title || 'التفاصيل'}</span></nav>{loading ? <div className="live-state">جارٍ تحميل المحتوى العام…</div> : !row ? <div className="panel-card empty-state"><h1>هذا المحتوى غير متاح.</h1><Link to={`/${page}`} className="text-link">العودة إلى القائمة</Link></div> : <article className="public-article"><span className="eyebrow">{page === 'articles' ? 'مقال من مكتبة المجتمع' : page === 'events' ? 'فعالية عامة' : 'ملف كوتش مهني'}</span><h1>{title}</h1>{page === 'articles' && row.published_at ? <time dateTime={String(row.published_at)}>{new Date(String(row.published_at)).toLocaleDateString('ar')}</time> : null}{page === 'events' && row.starts_at ? <p className="hero-lead">{new Date(String(row.starts_at)).toLocaleString('ar', { dateStyle: 'long', timeStyle: 'short' })} · {String(row.location || 'افتراضي')}</p> : null}<p className="public-article-body">{body}</p>{Array.isArray(row.coaching_topics) && <p>محاور الكوتشنج: {row.coaching_topics.join(' · ')}</p>}</article>}<nav className="related-links" aria-label="صفحات مرتبطة"><b>اكتشف المزيد</b><Link to="/coaching">الكوتشنج المهني</Link><Link to="/articles">مقالات المجتمع</Link><Link to="/faq">الأسئلة الشائعة</Link></nav></main><Footer/></>
}

function NotFoundPage() {
  return <main className="public-page wrap"><nav className="breadcrumbs" aria-label="مسار التنقل"><Link to="/">الرئيسية</Link><span aria-hidden="true">/</span><span>صفحة غير موجودة</span></nav><div className="public-page-copy"><span className="eyebrow">404</span><h1>لم نعثر على هذه الصفحة.</h1><p className="hero-lead">قد يكون الرابط قديماً أو كُتب بطريقة غير صحيحة.</p><Link className="btn btn-primary" to="/">العودة إلى الرئيسية <ArrowLeft size={16}/></Link></div><div className="related-links"><Link to="/coaching">الكوتشنج المهني</Link><Link to="/articles">مقالات المجتمع</Link><Link to="/faq">الأسئلة الشائعة</Link></div></main>
}


function PostCard({ post, role }: { post: typeof demoPosts[number]; role: Role }) {
  const [liked, setLiked] = useState(false), [saved, setSaved] = useState(false), [showComment, setShowComment] = useState(false), [comment, setComment] = useState(''), [count, setCount] = useState(post.comments), [reported, setReported] = useState(false)
  return <article className="post-card"><div className="post-head"><Avatar letter={post.avatar} tone={post.id} size="lg"/><div className="post-author"><div><b>{post.name}</b><Verified role={post.role}/></div><span>{post.title}</span><small>{post.time} · <span className="globe">◉</span></small></div><button className="icon-btn" aria-label="خيارات المنشور" onClick={()=>setReported(true)}><MoreHorizontal size={20}/></button></div><p className="post-text">{post.text}</p><div className="post-tags">{post.tags.map(t=><span key={t}>#{t}</span>)}</div>{reported && <div className="inline-message">تم تسجيل البلاغ للمراجعة في نسخة التجربة.</div>}<div className="post-stats"><span><span className="tiny-heart">♥</span> {post.likes + (liked ? 1 : 0)} إعجاب</span><button onClick={()=>setShowComment(!showComment)}>{count} تعليقات</button></div><div className="post-actions"><button className={liked?'active':''} onClick={()=>setLiked(!liked)}><Heart size={17}/> إعجاب</button><button onClick={()=>setShowComment(!showComment)}><MessageCircle size={17}/> تعليق</button><button onClick={()=>navigator.clipboard?.writeText(window.location.href)}><Send size={16}/> مشاركة</button><button className={saved?'active':''} onClick={()=>setSaved(!saved)} aria-label="حفظ"><Bookmark size={17}/> حفظ</button></div>{showComment && <form className="comment-form" onSubmit={e=>{e.preventDefault();if(comment.trim()){setCount(count+1);setComment('')}}}><input value={comment} onChange={e=>setComment(e.target.value)} placeholder="اكتب تعليقاً مهنياً..."/><button type="submit" disabled={!comment.trim()}><Send size={16}/></button></form>}<div className="patient-warning"><ShieldCheck size={14}/> تذكير: لا تشارك معلومات أو صوراً تخص المرضى.</div>{role==='moderator' || role==='manager' ? <button className="mod-inline" onClick={()=>setReported(true)}><Flag size={13}/> أدوات مراجعة</button> : null}</article>
}
function SideCard({ role }: { role: Role }) { return <aside className="feed-aside"><div className="profile-mini"><div className="mini-cover"/><Avatar letter="ن" size="xl"/><b>نورة العبدالله <Verified role={role}/></b><span>ممرضة · صحة المجتمع</span><Link to="/profile" className="mini-link">عرض ملفك الشخصي</Link><div className="mini-stats"><div><b>١٢</b><small>اتصالاً</small></div><div><b>٤</b><small>اهتمامات</small></div></div></div><div className="aside-box"><div className="aside-title"><span>مساحات مقترحة</span><Link to="/groups">عرض الكل</Link></div><Link className="suggestion" to="/groups"><span className="group-icon">◈</span><span><b>توازن الممارس الصحي</b><small>١٬٢٤٠ عضواً</small></span><Plus size={16}/></Link><Link className="suggestion" to="/groups"><span className="group-icon aqua">✳</span><span><b>بدايات مهنية</b><small>٨٣٦ عضواً</small></span><Plus size={16}/></Link></div><div className="aside-disclaimer"><Shield size={16}/><p>مساحة للكوتشنج المهني والتواصل، وليست بديلاً عن الرعاية الطبية أو النفسية.</p></div></aside> }
function DemoFeedPage({ role }: { role: Role }) { const [posts, setPosts] = useState(demoPosts), [text, setText] = useState(''), [notice, setNotice] = useState(false), [filter, setFilter] = useState('الأحدث')
  const canPost = ['verified','coach','moderator','manager','owner'].includes(role)
  return <main className="app-main wrap"><div className="feed-top"><div><span className="eyebrow">مساحتك المهنية</span><h1>الخلاصة</h1></div><div className="feed-search"><Search size={17}/><input placeholder="ابحث عن أشخاص أو موضوعات"/><kbd>/</kbd></div></div><div className="feed-layout"><SideCard role={role}/><section className="feed-stream"><div className="feed-tabs"><button className={filter==='الأحدث'?'selected':''} onClick={()=>setFilter('الأحدث')}>الأحدث</button><button className={filter==='المتابَعون'?'selected':''} onClick={()=>setFilter('المتابَعون')}>المتابَعون</button><span className="tab-note"><Activity size={14}/> مساحة مهنية هادئة</span></div><div className="composer"><div className="composer-top"><Avatar letter="ن"/><button onClick={()=>{if(!canPost)setNotice(true)}} className="composer-input">{canPost ? 'ما الفكرة المهنية التي تود مشاركتها؟' : 'اكتب منشوراً مهنياً — متاح للأعضاء الموثّقين'}</button></div>{!canPost && notice ? <div className="inline-message">ميزة النشر متاحة للمهنيين الموثّقين. يمكنك التقدم بطلب التوثيق من ملفك.</div> : null}<div className="composer-bottom"><span className="patient-warning compact"><Shield size={14}/> لا تنشر معلومات أو صور مرضى</span>{canPost ? <button className="btn btn-primary btn-small" onClick={()=>setNotice(true)}><Plus size={15}/> اكتب منشوراً</button> : <Link to="/verification" className="text-link">طلب التوثيق <ArrowLeft size={14}/></Link>}</div>{notice && canPost && <form className="composer-expanded" onSubmit={e=>{e.preventDefault();if(text.trim()){setPosts([{id:Date.now(),name:'نورة العبدالله',title:'ممرضة · صحة المجتمع',role, time:'الآن',text,tags:['مجتمع السيطرة'],likes:0,comments:0,avatar:'ن'},...posts]);setText('');setNotice(false)}}}><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="شارك فكرة مهنية عامة، من دون معلومات أو صور تخص المرضى."/><button className="btn btn-primary btn-small" disabled={!text.trim()}>نشر</button></form>}</div>{posts.map(p=><PostCard key={p.id} post={p} role={role}/>)}</section><aside className="feed-right"><div className="trending-box"><span className="eyebrow">في مجتمعنا</span><h3>موضوعات للنقاش</h3>{[['#تطوير_مهني','١٢٤ مشاركة'],['#التوازن_الحياتي','٨٦ مشاركة'],['#تمريض','٧٢ مشاركة'],['#إدارة_الضغط','٥٨ مشاركة']].map(([a,b])=><Link to="/feed" className="trend" key={a}><b>{a}</b><small>{b}</small></Link>)}<Link to="/groups" className="text-link">اكتشف المزيد <ArrowLeft size={14}/></Link></div><div className="event-teaser"><CalendarDays size={20}/><span><b>لقاء هذا الأسبوع</b><small>جلسة وضوح المسار المهني</small></span><Link to="/events">سجّل</Link></div></aside></div></main>
}
function FeedPage({ role, demoMode, userId, displayName }: { role: Role; demoMode: boolean; userId: string; displayName: string }) {
  if (!demoMode && userId) return <LiveFeedPage userId={userId} role={role} displayName={displayName} />
  return <DemoFeedPage role={role} />
}

function DashboardPage(props: { page: string; role: Role; setRole: (role: Role) => void; demoMode: boolean; userId: string; client: SupabaseClient | null }) {
  if (!props.demoMode && props.page !== 'settings' && props.userId) return <LiveDashboardPage page={props.page} role={props.role} userId={props.userId} />
  return <DemoDashboardPage page={props.page} role={props.role} setRole={props.setRole} demoMode={props.demoMode} client={props.client} />
}
function DemoDashboardPage({ page, role, setRole, demoMode, client }: { page: string; role: Role; setRole: (role:Role)=>void; demoMode: boolean; client: SupabaseClient | null }) {
 const [tab, setTab] = useState('نشاطي'), [success,setSuccess]=useState('')
 const title = ({profile:'الملف الشخصي',connections:'الاتصالات',messages:'الرسائل',notifications:'الإشعارات',groups:'المجموعات',verification:'طلب التوثيق',moderation:'لوحة الإشراف',admin:'لوحة المدير',settings:'الإعدادات'} as Record<string,string>)[page] || page
 const staff = ['moderator','manager','owner'].includes(role)
 return <main className="app-main wrap"><div className="page-title-row"><div><span className="eyebrow">مساحتك في المجتمع</span><h1>{title}</h1></div>{page==='profile' && <button className="btn btn-outline" onClick={()=>setSuccess('حُفظت تغييرات الملف في وضع التجربة.')}><Settings size={15}/> تعديل الملف</button>}</div><div className="dashboard-layout"><aside className="dash-nav"><Link to="/profile" className={page==='profile'?'current':''}><Users size={16}/> ملفي الشخصي</Link>{navItems.slice(1).map(n=><Link to={n.to} key={n.to} className={page===n.to.slice(1)?'current':''}>{<n.icon size={16}/>} {n.label}</Link>)}<Link to="/verification" className={page==='verification'?'current':''}><BadgeCheck size={16}/> طلب التوثيق</Link>{staff && <Link to="/moderation" className={page==='moderation'?'current':''}><Shield size={16}/> لوحة الإشراف</Link>}{role==='manager' && <Link to="/admin" className={page==='admin'?'current':''}><Settings size={16}/> إدارة المنصة</Link>}<Link to="/settings" className={page==='settings'?'current':''}><Settings size={16}/> الإعدادات</Link></aside><section className="dashboard-content">{success && <div className="inline-message"><Check size={15}/>{success}</div>}{page==='profile' ? <div className="profile-page-card"><div className="profile-cover"/><Avatar letter="ن" size="xxl"/><div className="profile-body"><Verified role={role}/><h2>نورة العبدالله <Verified role={role}/></h2><p>ممرضة صحة مجتمع · الرياض</p><p className="profile-bio">أؤمن أن الرعاية تبدأ بالإنصات، وأن النمو المهني رحلة نتعلمها معاً.</p><div className="profile-tags"><span>الصحة المجتمعية</span><span>التوازن المهني</span><span>الإرشاد الزملي</span></div><div className="profile-detail-grid"><span><b>الخبرة</b> ٨ سنوات</span><span><b>الموقع</b> الرياض، السعودية</span><span><b>الهدف المهني</b> القيادة والتمكين</span></div>{demoMode && <div className="role-demo"><span>وضع استعراض الأدوار (تجريبي)</span><select value={role} onChange={e=>{setRole(e.target.value as Role);localStorage.setItem('saytara-role',e.target.value)}}>{Object.entries(roleNames).filter(([v])=>v!=='owner').map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></div>}</div></div>
 : page==='verification' ? <div className="panel-card"><div className="panel-icon gold"><BadgeCheck/></div><h2>وثّق خبرتك المهنية</h2><p>تتم مراجعة الطلبات من فريق مختص. تبقى مستنداتك في مساحة خاصة ولا يطّلع عليها إلا المشرفون والمدير.</p><form className="verification-form" onSubmit={e=>{e.preventDefault();setSuccess('وصل طلبك التجريبي. عند ربط Supabase ستُحفظ الطلبات في قاعدة البيانات.')}}><div className="form-grid"><label>الاسم الكامل<input required placeholder="الاسم كما في البطاقة المهنية"/></label><label>المهنة<input required placeholder="مثال: طبيب / ممرض / صيدلي"/></label><label>التخصص<input placeholder="التخصص المهني"/></label><label>جهة العمل<input placeholder="جهة العمل الحالية"/></label><label className="full-field">رقم التصنيف المهني<input placeholder="رقم التسجيل أو التصنيف"/></label><label className="file-field full-field">صورة الرخصة أو بطاقة العمل<input type="file" accept="image/*,.pdf"/><small>ملف خاص للمراجعة فقط. لا ترفع أي صورة أو بيانات تخص المرضى.</small></label></div><button className="btn btn-primary">إرسال للمراجعة <ArrowLeft size={15}/></button></form></div>
 : page==='moderation' ? <div className="panel-card"><div className="panel-icon"><ShieldCheck/></div><h2>مركز الإشراف</h2><p>مراجعة البلاغات وطلبات التوثيق، والتعامل مع المحتوى المخالف.</p>{staff ? <><div className="moderation-tabs"><button className="selected" onClick={()=>setTab('بلاغات')}>البلاغات <b>٣</b></button><button onClick={()=>setTab('توثيق')}>طلبات التوثيق <b>٢</b></button></div>{(tab==='بلاغات' ? [['منشور · مشاركة معلومات مرضى','مخالفة الخصوصية','قبل ١٢ دقيقة'],['حساب · رسائل مزعجة','إزعاج / ترويج','قبل ساعة'],['تعليق · سلوك غير مهني','إساءة','أمس']] : [['د. هدى منصور','طب الأسرة · الرياض','قيد المراجعة'],['أ. خالد الشهري','صيدلة إكلينيكية · جدة','قيد المراجعة']]).map((r,i)=><div className="review-row" key={i}><span className="review-dot"/><div><b>{r[0]}</b><small>{r[1]} · {r[2]}</small></div><button className="btn btn-small btn-outline" onClick={()=>setSuccess('سُجل قرار المراجعة في وضع التجربة.')}>مراجعة</button></div>)}</> : <div className="inline-message">تظهر أدوات الإشراف بعد تسجيل الدخول بدور مشرف أو مدير.</div>}</div>
 : page==='admin' ? <div className="panel-card"><div className="panel-icon"><Settings/></div><h2>إدارة مجتمع السيطرة</h2><p>إدارة أدوار الأعضاء وخيارات المنصة والعضويات.</p>{role==='manager' ? <><div className="admin-stats"><div><b>١٬٢٨٤</b><small>عضواً</small></div><div><b>٤٨</b><small>موثّقاً</small></div><div><b>١٢</b><small>كوتشاً</small></div></div><div className="review-row"><div><b>إدارة الأدوار</b><small>تُطبّق الصلاحيات الحقيقية من سياسات قاعدة البيانات.</small></div><button className="btn btn-small btn-outline" onClick={()=>setSuccess('وضع الإدارة هنا تجريبي فقط؛ غيّر الأدوار الحقيقية عبر SQL الآمن الموضح في README.')}>إعداد</button></div><div className="premium-callout"><Sparkles size={18}/><span><b>العضوية المميزة</b><small>هيكل جاهز. المدفوعات غير مفعّلة حتى اختيار مزود الدفع.</small></span><span className="status-pill">قريباً</span></div></> : <div className="inline-message">صفحة المدير متاحة لمدير المنصة فقط.</div>}</div>
 : page==='settings' ? <div className="panel-card"><div className="panel-icon"><LockKeyhole/></div><h2>إعداداتك وبياناتك</h2><p>أنت تتحكم في بيانات حسابك. يمكنك تنزيل نسخة أو حذف حسابك.</p><div className="review-row"><div><b>تصدير بياناتي</b><small>تنزيل نسخة من بيانات الحساب والمنشورات.</small></div><button className="btn btn-small btn-outline" onClick={async()=>{let payload:unknown={profile:'نورة العبدالله',role,posts:demoPosts};if(isSupabaseConfigured&&client){const {data:{user},error}=await client.auth.getUser();if(error||!user){setSuccess('سجّل الدخول أولاً لتصدير بيانات حسابك.');return}const tasks=[client.from('profiles').select('*').eq('user_id',user.id).maybeSingle(),client.from('posts').select('*').eq('author_id',user.id),client.from('comments').select('*').eq('author_id',user.id),client.from('connections').select('*').or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`),client.from('messages').select('*').or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`),client.from('notifications').select('*').eq('recipient_id',user.id),client.from('verification_requests').select('id,full_name,profession,specialty,workplace,professional_registration_no,status,decision_reason,requested_at,reviewed_at').eq('user_id',user.id),client.from('user_roles').select('*').eq('user_id',user.id),client.from('post_likes').select('*').eq('user_id',user.id),client.from('saved_posts').select('*').eq('user_id',user.id),client.from('user_blocks').select('*').or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`),client.from('group_memberships').select('*').eq('user_id',user.id),client.from('groups').select('*').eq('owner_id',user.id),client.from('event_rsvps').select('*').eq('user_id',user.id),client.from('events').select('*').eq('organizer_id',user.id),client.from('articles').select('*').eq('author_id',user.id),client.from('coaching_bookings').select('*').or(`member_id.eq.${user.id},coach_id.eq.${user.id}`),client.from('coach_availability').select('*').eq('coach_id',user.id),client.from('memberships').select('*').eq('user_id',user.id),client.from('reports').select('*').eq('reporter_id',user.id)];const results=await Promise.all(tasks);const failed=results.find(r=>r.error);if(failed?.error){setSuccess('تعذر تصدير جميع البيانات؛ تحقق من إعدادات Supabase وحاول لاحقاً.');return}payload={email:user.email,exported_at:new Date().toISOString(),profile:results[0].data,posts:results[1].data,comments:results[2].data,connections:results[3].data,messages:results[4].data,notifications:results[5].data,verification_requests:results[6].data,roles:results[7].data,likes:results[8].data,saved_posts:results[9].data,blocks:results[10].data,group_memberships:results[11].data,groups_created:results[12].data,event_rsvps:results[13].data,events_created:results[14].data,articles:results[15].data,coaching_bookings:results[16].data,coach_availability:results[17].data,memberships:results[18].data,reports:results[19].data}}const data=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(data);a.download='saytara-data.json';a.click();URL.revokeObjectURL(a.href);setSuccess('تم تجهيز ملف بياناتك للتنزيل.')}}>تصدير</button></div><div className="review-row"><div><b>حذف الحساب</b><small>يُحذف الحساب وبياناته وفق سياسة الاحتفاظ.</small></div><button className="btn btn-small btn-danger" onClick={async()=>{if(!window.confirm('سيؤدي هذا إلى حذف حسابك وبياناته نهائياً. هل تريد المتابعة؟'))return;if(!isSupabaseConfigured||!client){setSuccess('حذف الحساب الحقيقي يتطلب إعداد Supabase ووظيفة delete-account.');return}const {error}=await client.functions.invoke('delete-account',{body:{confirm:true}});if(error){setSuccess('تعذر حذف الحساب. تحقق من تسجيل الدخول وإعداد الوظيفة ثم أعد المحاولة.');return}await client.auth.signOut();localStorage.removeItem('saytara-demo');setSuccess('تم حذف الحساب بنجاح.')}}>حذف الحساب</button></div><div className="coaching-note"><ShieldCheck size={18}/><p>لا ترفع بيانات صحية حساسة، ولا تشارك أي معلومات أو صور تخص المرضى.</p></div></div>
 : page==='messages' ? <div className="panel-card"><div className="panel-icon"><MessageCircle/></div><h2>رسائلك الخاصة</h2><p>الرسائل خاصة بين المتصلين. يمكن للمهنيين الموثّقين بدء رسالة مباشرة مع حد يومي.</p>{[['د. ليان الحربي','شكراً على مشاركة تجربتك.'],['أ. عمر السبيعي','نلتقي في اللقاء القادم بإذن الله.']].map((x,i)=><div className="message-thread" key={x[0]}><Avatar letter={x[0][3]} tone={i}/><span><b>{x[0]} <Verified role={i===0?'verified':'coach'}/></b><small>{x[1]}</small></span><small>١٢:٤٥</small></div>)}<form className="message-compose" onSubmit={e=>{e.preventDefault();setSuccess('أُرسلت الرسالة التجريبية.')}}><input placeholder="اكتب رسالة مهنية..."/><button className="btn btn-primary btn-small"><Send size={15}/></button></form></div>
 : page==='notifications' ? <div className="panel-card"><div className="panel-icon"><Bell/></div><h2>إشعارات المجتمع</h2>{[['د. ليان الحربي','أعجبت بمنشورك','قبل ٢٠ دقيقة'],['أ. عمر السبيعي','أرسل طلب اتصال','قبل ساعتين'],['فريق التوثيق','تم استلام طلب التوثيق','أمس']].map((x,i)=><div className="review-row" key={i}><Avatar letter={x[0][3]} tone={i}/><div><b>{x[0]}</b><small>{x[1]} · {x[2]}</small></div>{i===1 && <button className="btn btn-small btn-outline" onClick={()=>setSuccess('قُبل طلب الاتصال التجريبي.')}>قبول</button>}</div>)}</div>
 : page==='connections' ? <div className="panel-card"><div className="panel-icon"><Users/></div><h2>اتصالاتك المهنية</h2><p>زملاء ومهنيون يشاركونك الاهتمامات.</p>{[['د. ليان الحربي','طب الأسرة · الرياض'],['أ. عمر السبيعي','صيدلة إكلينيكية · جدة'],['مها القحطاني','تمريض عناية حرجة · الدمام']].map((x,i)=><div className="review-row" key={x[0]}><Avatar letter={x[0][3]} tone={i}/><div><b>{x[0]} <Verified role={i===1?'coach':'verified'}/></b><small>{x[1]}</small></div><button className="btn btn-small btn-outline" onClick={()=>setSuccess('أُرسل طلب اتصال تجريبي.')}>اتصال <UserPlus size={13}/></button></div>)}</div>
 : page==='groups' ? <div className="panel-card"><div className="panel-icon"><Compass/></div><h2>مجموعات قريبة من اهتماماتك</h2><p>مجتمعات تخصصية ومساحات حوار مهنية.</p>{[['توازن الممارس الصحي','١٬٢٤٠ عضواً · عامة'],['بدايات مهنية','٨٣٦ عضواً · عامة'],['تمريض الرعاية الحرجة','٤٥٠ عضواً · طلب انضمام']].map((x)=><div className="review-row" key={x[0]}><span className="group-icon">◈</span><div><b>{x[0]}</b><small>{x[1]}</small></div><button className="btn btn-small btn-outline" onClick={()=>setSuccess('تم إرسال طلب الانضمام التجريبي.')}>انضمام <Plus size={13}/></button></div>)}</div>
 : <div className="panel-card"><div className="panel-icon"><FileText/></div><h2>{title}</h2><p>تعرّف على أعضاء المجتمع، وشارك في النقاشات والفعاليات المهنية.</p><div className="feature-grid compact-grid">{[['توازن الممارس الصحي','مجموعة مجتمعية مفتوحة'],['وضوح المسار المهني','لقاء افتراضي · هذا الأسبوع'],['تطوير مهني','مقالات وأدوات للنمو']].map(x=><article className="feature-card" key={x[0]}><h3>{x[0]}</h3><p>{x[1]}</p><button className="text-link" onClick={()=>setSuccess('هذه الخاصية تعمل في وضع التجربة.')}>استكشف <ArrowLeft size={14}/></button></article>)}</div></div>}</section></div></main>
}
function AppShell({ role, children, authenticated, authReady, demoMode, accountStatus, unread, unreadMessages, displayName, onSignOut }: { role: Role; children: React.ReactNode; authenticated: boolean; authReady: boolean; demoMode: boolean; accountStatus: AccountStatus | null; unread: number; unreadMessages: number; displayName: string; onSignOut: () => Promise<void> }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!authReady) return
    if (!authenticated) navigate('/login', { replace: true })
    else if (!demoMode && accountStatus !== 'approved') navigate('/pending-review', { replace: true })
  }, [authReady, authenticated, demoMode, accountStatus, navigate])
  if (!authReady || !authenticated || (!demoMode && accountStatus !== 'approved')) return null
  return <div className="signed-shell"><div className="signed-top"><Brand/><div className="signed-top-actions"><span className="signed-user">{displayName} · {roleNames[role]}</span><button className="btn btn-outline btn-small" onClick={() => void onSignOut()}>تسجيل الخروج</button></div></div><nav className="signed-nav">{navItems.map(n => <NavLink to={n.to} key={n.to}>{<n.icon size={16}/>} {n.label}{n.to==='/notifications'&&unread>0&&<span className="nav-count">{unread}</span>}{n.to==='/messages'&&unreadMessages>0&&<span className="nav-count">{unreadMessages}</span>}</NavLink>)}<NavLink to="/profile"><Users size={16}/>ملفي</NavLink>{role === 'owner' && <NavLink to="/owner"><ShieldCheck size={16}/>مالك المنصة</NavLink>}<span className="demo-label">{demoMode?'وضع تجريبي':'مساحة خاصة'}</span></nav>{children}<Footer/></div>
}

function PendingReviewPage({ authReady, authenticated, demoMode, accountStatus, onSignOut, onRefreshStatus }: { authReady: boolean; authenticated: boolean; demoMode: boolean; accountStatus: AccountStatus | null; onSignOut: () => Promise<void>; onRefreshStatus: () => Promise<void> }) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!authReady) return
    if (!authenticated) navigate('/login', { replace: true })
    else if (demoMode || accountStatus === 'approved') navigate('/feed', { replace: true })
  }, [authReady, authenticated, demoMode, accountStatus, navigate])
  if (!authReady) return <main className="auth-wrap"><section className="auth-card"><p role="status">جارٍ التحقق من الجلسة…</p></section></main>
  if (!authenticated || demoMode || accountStatus === 'approved') return null
  const rejected = accountStatus === 'rejected'
  const unknown = accountStatus === 'unknown'
  const loadingStatus = accountStatus === null
  return <main className="auth-wrap"><section className="auth-card account-review-card">
    <div className="auth-intro"><span className="eyebrow">حماية مجتمعنا المهني</span><h1>{loadingStatus ? 'جارٍ التحقق من حالة الحساب…' : rejected ? 'لم يُعتمد طلب الانضمام.' : unknown ? 'تعذر التحقق من حالة الحساب.' : accountStatus === 'pending' ? 'حسابك قيد المراجعة.' : 'تحقق من بريدك أولاً.'}</h1>
      <p>{loadingStatus ? 'لن نفتح ميزات العضوية حتى نتحقق من الحالة.' : rejected ? 'لا تتوفر صلاحيات العضوية لهذا الحساب. إذا كنت ترى أن القرار يحتاج مراجعة، تواصل مع إدارة المجتمع.' : unknown ? 'لن نفتح ميزات العضوية حتى نتأكد من حالة الحساب. أعد المحاولة بعد قليل.' : accountStatus === 'pending' ? 'تم تأكيد البريد الإلكتروني. سيُفعّل الوصول إلى مساحة الأعضاء بعد مراجعة المدير واعتماد الحساب.' : 'أكّد بريدك الإلكتروني ثم سجّل الدخول؛ بعد ذلك يراجع المدير طلب الانضمام.'}</p>
    </div>
    <div className="account-review-actions"><button className="btn btn-outline" type="button" onClick={() => void onRefreshStatus()} disabled={loadingStatus}>إعادة التحقق من الحالة</button><button className="btn btn-primary" type="button" onClick={() => void onSignOut()}>تسجيل الخروج</button></div>
  </section></main>
}

function SupabaseCallbackRouter() {
  const navigate = useNavigate()
  useEffect(() => {
    const flow = new URLSearchParams(window.location.search).get('flow')
    if (flow !== 'confirm' && flow !== 'recovery' && flow !== 'oauth') return
    let active = true
    void import('./lib/supabase').then(({ supabase: client }) => {
      if (!active) return
      if (!client) { navigate('/login', { replace: true }); return }
      void client.auth.getSession().then(({ data, error }) => {
        if (!active) return
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const searchParams = new URLSearchParams(window.location.search)
        const callbackError = searchParams.get('error_description') || hashParams.get('error_description') || searchParams.get('error') || hashParams.get('error')
        const unverified = Boolean(data.session && flow !== 'recovery' && !hasConfirmedEmail(data.session.user))
        const failed = Boolean(error || !data.session || callbackError || unverified)
        const target = failed ? '/login' : flow === 'recovery' ? '/reset-password' : '/pending-review'
        const callbackUrl = new URL(window.location.href)
        for (const key of ['flow', 'code', 'error', 'error_code', 'error_description', 'state']) callbackUrl.searchParams.delete(key)
        window.history.replaceState(window.history.state, '', `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`)
        const authError = callbackError || (unverified ? 'أكّد بريدك الإلكتروني قبل استخدام مساحة العضوية.' : 'تعذر إكمال المصادقة. تحقق من إعدادات البريد وروابط العودة في Supabase.')
        navigate(target, { replace: true, state: failed ? { authError } : null })
      }).catch(() => { if (active) navigate('/login', { replace: true, state: { authError: 'تعذر إكمال تسجيل الدخول. حاول مرة أخرى.' } }) })
    }).catch(() => { if (active) navigate('/login', { replace: true, state: { authError: 'تعذر تحميل خدمة تسجيل الدخول. حاول مرة أخرى.' } }) })
    return () => { active = false }
  }, [navigate])
  return null
}

function App() {
  const demoMode = !isSupabaseConfigured
  const [demo, setDemo] = useState(() => demoMode && localStorage.getItem('saytara-demo') === 'true')
  const [signedIn, setSignedIn] = useState(() => demoMode && localStorage.getItem('saytara-demo') === 'true')
  const [authReady, setAuthReady] = useState(() => !isSupabaseConfigured)
  const [user, setUser] = useState<User | null>(null)
  const [accountStatusRecord, setAccountStatusRecord] = useState<{ userId: string | null; status: AccountStatus | null }>({ userId: null, status: null })
  const accountStatus = user && accountStatusRecord.userId === user.id ? accountStatusRecord.status : null
  const [role, setRoleState] = useState<Role>(() => demoMode ? (localStorage.getItem('saytara-role') as Role || 'member') : 'member')
  const [displayName, setDisplayName] = useState(() => demoMode && localStorage.getItem('saytara-demo') === 'true' ? 'نورة العبدالله' : 'حسابي')
  const [dark, setDark] = useState(localStorage.getItem('saytara-dark') === 'true')
  const [unread, setUnread] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    let subscription: { unsubscribe: () => void } | null = null
    void import('./lib/supabase').then(({ supabase: client }) => {
      if (!active) return
      setSupabaseClient(client)
      if (!client) { setAuthReady(true); return }
      void client.auth.getSession().then(({ data, error }) => {
        if (!active) return
        const session = error ? null : data.session
        const recoveryRoute = isPasswordRecoveryRoute()
        const emailConfirmed = hasConfirmedEmail(session?.user)
        const keepRecoverySession = Boolean(session && recoveryRoute && !emailConfirmed)
        setUser(session && (emailConfirmed || keepRecoverySession) ? session.user : null)
        setSignedIn(Boolean(session && emailConfirmed))
        setDemo(false)
        localStorage.removeItem('saytara-demo')
        setAuthReady(true)
        if (session && !emailConfirmed && !recoveryRoute) void client.auth.signOut({ scope: 'local' })
      }).catch(() => { if (active) setAuthReady(true) })
      const { data: { subscription: authSubscription } } = client.auth.onAuthStateChange((_event, session) => {
        const emailConfirmed = hasConfirmedEmail(session?.user)
        const recoveryRoute = isPasswordRecoveryRoute()
        if (session && !emailConfirmed && !recoveryRoute) {
          const unverifiedUserId = session.user.id
          setUser(null)
          setSignedIn(false)
          setDemo(false)
          setRoleState('member')
          setDisplayName('حسابي')
          localStorage.removeItem('saytara-demo')
          window.setTimeout(() => {
            void client.auth.getSession().then(({ data }) => {
              const currentUser = data.session?.user
              if (currentUser?.id === unverifiedUserId && !hasConfirmedEmail(currentUser)) return client.auth.signOut({ scope: 'local' })
              return undefined
            }).catch(() => {})
          }, 0)
          setAuthReady(true)
          return
        }
        setUser(session?.user ?? null)
        setSignedIn(Boolean(session && emailConfirmed))
        setAuthReady(true)
        if (session && emailConfirmed) { setDemo(false); localStorage.removeItem('saytara-demo') }
        else if (isSupabaseConfigured) { setDemo(false); setRoleState('member'); setDisplayName('حسابي') }
      })
      subscription = authSubscription
    }).catch(() => { if (active) setAuthReady(true) })
    return () => { active = false; subscription?.unsubscribe() }
  }, [])

  useEffect(() => {
    if (demo || !supabaseClient || !user || !hasConfirmedEmail(user)) {
      return
    }
    let active = true
    void (async () => {
      try {
        const { data, error } = await supabaseClient.from('profiles').select('display_name,account_status').eq('user_id', user.id).maybeSingle()
        if (!active) return
        const metadataName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : ''
        setDisplayName(data?.display_name || metadataName || user.email?.split('@')[0] || 'حسابي')
        if (error || !data) {
          setAccountStatusRecord({ userId: user.id, status: 'unknown' })
          return
        }
        const status = data.account_status === 'approved' || data.account_status === 'rejected' || data.account_status === 'pending'
          ? data.account_status as AccountStatus
          : 'unknown'
        if (status !== 'approved') { setAccountStatusRecord({ userId: user.id, status }); return }
        const [roleResult, ownerResult] = await Promise.all([
          supabaseClient.from('user_roles').select('role').eq('user_id', user.id),
          supabaseClient.rpc('is_platform_owner'),
        ])
        if (!active) return
        if (roleResult.error) { setAccountStatusRecord({ userId: user.id, status: 'unknown' }); return }
        const roles = (roleResult.data ?? []).map(row => row.role as Role)
        const rank: Role[] = ['manager', 'moderator', 'coach', 'verified', 'member']
        setRoleState(!ownerResult.error && ownerResult.data === true ? 'owner' : rank.find(candidate => roles.includes(candidate)) || 'member')
        setAccountStatusRecord({ userId: user.id, status: 'approved' })
      } catch {
        if (active) { setAccountStatusRecord({ userId: user.id, status: 'unknown' }); setRoleState('member') }
      }
    })()
    return () => { active = false }
  }, [demo, user, supabaseClient])

  useEffect(() => {
    const client = supabaseClient
    if (!client || !signedIn || !user || !hasConfirmedEmail(user) || accountStatus !== 'approved') return
    let live = true
    let channel: RealtimeChannel | null = null
    const connect = async () => {
      const [n, m] = await Promise.all([
        client.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).eq('is_read', false),
        client.from('messages').select('id', { count: 'exact', head: true }).eq('recipient_id', user.id).is('read_at', null),
      ])
      if (!live) return
      setUnread(n.count ?? 0); setUnreadMessages(m.count ?? 0)
      channel = client.channel('saytara-' + user.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'recipient_id=eq.' + user.id }, () => setUnread(value => value + 1))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'recipient_id=eq.' + user.id }, () => setUnreadMessages(value => value + 1))
        .subscribe()
    }
    void connect()
    return () => { live = false; if (channel) void client.removeChannel(channel) }
  }, [signedIn, user, supabaseClient, accountStatus])

  const setRole = (next: Role) => { if (demo && next !== 'owner') { setRoleState(next); localStorage.setItem('saytara-role', next) } }
  const toggleTheme = () => { setDark(value => { localStorage.setItem('saytara-dark', String(!value)); return !value }) }
  const onDemo = () => { if (!demoMode) return; setDemo(true); setSignedIn(true); const savedRole = localStorage.getItem('saytara-role') as Role; setRoleState(savedRole && savedRole !== 'owner' ? savedRole : 'member'); setDisplayName('نورة العبدالله'); localStorage.setItem('saytara-demo', 'true') }
  const onSignedIn = (signedInUser: User) => {
    if (!hasConfirmedEmail(signedInUser)) { setSignedIn(false); return }
    setUser(signedInUser)
    setAccountStatusRecord({ userId: signedInUser.id, status: null })
    setRoleState('member')
    setSignedIn(true)
    setDemo(false)
    localStorage.removeItem('saytara-demo')
  }
  const refreshAccountStatus = async () => {
    if (!supabaseClient || !user) { setAccountStatusRecord({ userId: user?.id ?? null, status: 'unknown' }); return }
    const { data, error } = await supabaseClient.from('profiles').select('account_status').eq('user_id', user.id).maybeSingle()
    if (error || !data) { setAccountStatusRecord({ userId: user.id, status: 'unknown' }); return }
    const status = data.account_status
    setAccountStatusRecord({ userId: user.id, status: status === 'approved' || status === 'pending' || status === 'rejected' ? status : 'unknown' })
  }
  const onSignOut = async () => {
    if (supabaseClient && !demo) {
      try {
        const { error } = await supabaseClient.auth.signOut({ scope: 'local' })
        if (error) throw error
      } catch {
        window.alert('تعذر إنهاء الجلسة الآن. تحقق من الاتصال وحاول تسجيل الخروج مجدداً.')
        return
      }
    }
    setUser(null)
    setAccountStatusRecord({ userId: null, status: null })
    setSignedIn(false)
    setDemo(false)
    setRoleState('member')
    setDisplayName('حسابي')
    localStorage.removeItem('saytara-demo')
  }
  const authenticated = signedIn || demo
  const routes = Object.keys(publicCopy) as (keyof typeof publicCopy)[]
  return <BrowserRouter basename={import.meta.env.BASE_URL}><RouteMetadata/><SupabaseCallbackRouter/><div className={dark ? 'app dark' : 'app'}><Header demo={demo} authenticated={authenticated} displayName={displayName} role={role} toggleTheme={toggleTheme} dark={dark}/>{demoMode && <aside className="demo-banner" role="status"><b>وضع تجريبي:</b> لم يُعثر على إعدادات Supabase صالحة؛ الحسابات والمنشورات التجريبية لا تُحفظ كبيانات حقيقية. <Link to="/register">دليل ربط قاعدة البيانات</Link></aside>}<Suspense fallback={<main className="public-page wrap"><p role="status">جارٍ تحميل الصفحة...</p></main>}><Routes><Route path="/" element={<PublicHome/>}/>{routes.map(key => <Route path={`/${key}`} key={key} element={<PublicPage page={key}/>}/>)}<Route path="/articles/:slug" element={<LivePublicDetailPage page="articles" client={supabaseClient}/>}/><Route path="/events/:id" element={<LivePublicDetailPage page="events" client={supabaseClient}/>}/><Route path="/coaches/:id" element={<LivePublicDetailPage page="coaches" client={supabaseClient}/>}/><Route path="/login" element={<LoginPage onDemo={onDemo} onSignedIn={onSignedIn}/>}/><Route path="/register" element={<LoginPage onDemo={onDemo} onSignedIn={onSignedIn}/>}/><Route path="/reset-password" element={<ResetPasswordPage onSignedIn={onSignedIn}/>}/><Route path="/pending-review" element={<PendingReviewPage authReady={authReady} authenticated={authenticated} demoMode={demo} accountStatus={accountStatus} onSignOut={onSignOut} onRefreshStatus={refreshAccountStatus}/>}/><Route path="/owner" element={<AppShell role={role} authenticated={authenticated} authReady={authReady} demoMode={demo} accountStatus={accountStatus} unread={unread} unreadMessages={unreadMessages} displayName={displayName} onSignOut={onSignOut}><OwnerPortalPage role={role}/></AppShell>}/><Route path="/learning" element={<AppShell role={role} authenticated={authenticated} authReady={authReady} demoMode={demo} accountStatus={accountStatus} unread={unread} unreadMessages={unreadMessages} displayName={displayName} onSignOut={onSignOut}><LearningCenterPage role={role}/></AppShell>}/><Route path="/learning-room/:id" element={<AppShell role={role} authenticated={authenticated} authReady={authReady} demoMode={demo} accountStatus={accountStatus} unread={unread} unreadMessages={unreadMessages} displayName={displayName} onSignOut={onSignOut}><LearningRoomPage role={role} userId={user?.id || ''} displayName={displayName}/></AppShell>}/><Route path="/feed" element={<AppShell role={role} authenticated={authenticated} authReady={authReady} demoMode={demo} accountStatus={accountStatus} unread={unread} unreadMessages={unreadMessages} displayName={displayName} onSignOut={onSignOut}><FeedPage role={role} demoMode={!isSupabaseConfigured} userId={user?.id || ''} displayName={displayName}/></AppShell>}/>{['profile','connections','messages','notifications','groups','verification','moderation','admin','settings'].map(page => <Route path={`/${page}`} key={page} element={<AppShell role={role} authenticated={authenticated} authReady={authReady} demoMode={demo} accountStatus={accountStatus} unread={unread} unreadMessages={unreadMessages} displayName={displayName} onSignOut={onSignOut}><DashboardPage demoMode={demo} page={page} role={role} setRole={setRole} userId={user?.id || ''} client={supabaseClient}/></AppShell>}/>)}<Route path="*" element={<NotFoundPage/>}/></Routes></Suspense></div></BrowserRouter>
}

export default App
