import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowDownToLine, BarChart3, Eye, Mail, MapPin, RefreshCw, ShieldCheck, Target, Wrench } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Role } from '../appTypes'
import './AnalyticsDashboardPage.css'

type AnalyticsPayload = {
  days?: number
  overview?: { page_views?: number; unique_visitors?: number; tool_starts?: number; tool_completions?: number; newsletter_subscribers?: number; newsletter_new?: number; interest_visitors?: number }
  pages?: { page_path: string; page_views: number; visitors: number }[]
  tools?: { tool: string; starts: number; completions: number; users: number }[]
  sources?: { source: string; page_views: number; visitors: number }[]
  locations?: { timezone: string; locale: string; visitors: number }[]
  daily?: { day: string; page_views: number; visitors: number }[]
  interested?: { visitor_id: string; user_id: string | null; display_name: string; email: string | null; interest_score: number; page_views: number; tool_starts: number; tool_completions: number; active_days: number; last_seen: string }[]
  subscribers?: { email: string; status: string; source_path: string; created_at: string; consent_at: string }[]
}

const number = (value?: number) => new Intl.NumberFormat('ar-SA').format(value ?? 0)
const date = (value?: string) => value ? new Date(value).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const pathLabel = (path: string) => ({ '/': 'الرئيسية', '/career-journey': 'الرحلة المهنية', '/career-compass': 'البوصلة المهنية', '/linkedin-audit': 'تدقيق LinkedIn', '/fresh-graduate': 'جاهزية الخريج', '/learning': 'مركز التعلّم', '/register': 'التسجيل', '/coaching': 'الكوتشنج', '/articles': 'المقالات', '/events': 'الفعاليات' } as Record<string,string>)[path] || path

export function AnalyticsDashboardPage({ role }: { role: Role }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [days, setDays] = useState(30)
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (role !== 'owner' || !supabase) { setAuthorized(false); setLoading(false); return }
    setLoading(true); setError('')
    const owner = await supabase.rpc('is_platform_owner')
    if (owner.error || owner.data !== true) { setAuthorized(false); setData(null); setLoading(false); return }
    setAuthorized(true)
    const result = await supabase.rpc('get_owner_site_analytics', { p_days: days })
    if (result.error) { setError('تعذر تحميل المؤشرات. تحقق من صلاحيات المالك ثم أعد المحاولة.'); setData(null) }
    else setData(result.data as AnalyticsPayload)
    setLoading(false)
  }, [role, days])

  useEffect(() => { void load() }, [load])

  function exportSubscribers() {
    const rows = data?.subscribers ?? []
    const csv = ['email,status,source_path,created_at,consent_at', ...rows.map(row => [row.email,row.status,row.source_path,row.created_at,row.consent_at].map(value => '"' + String(value ?? '').replaceAll('"','""') + '"').join(','))].join('\r\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'saytara-newsletter-subscribers.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (authorized === false) return <main className="app-main wrap analytics-page" dir="rtl"><section className="analytics-card"><ShieldCheck size={30}/><h1>لوحة المؤشرات للمالك فقط</h1><p>هذه الصفحة لا تعرض بيانات الزوار أو البريد إلا بعد إثبات صلاحية المالك من قاعدة البيانات.</p></section></main>

  const overview = data?.overview
  const cards = [
    { title: 'مشاهدات الصفحات', value: overview?.page_views, icon: Eye },
    { title: 'زوار مميزون', value: overview?.unique_visitors, icon: Activity },
    { title: 'بدأوا استخدام أداة', value: overview?.tool_starts, icon: Wrench },
    { title: 'أكملوا استخدام أداة', value: overview?.tool_completions, icon: BarChart3 },
    { title: 'مهتمون محتملون', value: overview?.interest_visitors, icon: Target },
    { title: 'مشتركو البريد', value: overview?.newsletter_subscribers, icon: Mail },
  ]
  return <main className="app-main wrap analytics-page" dir="rtl">
    <header className="analytics-heading"><div><span className="eyebrow">قياس النمو · للمالك فقط</span><h1>مؤشرات مجتمع السيطرة المهنية</h1><p>قياس سلوكي من وقت الموافقة على التحليلات فصاعدًا. لا توجد أرقام تاريخية مصطنعة.</p></div><div className="analytics-actions"><select aria-label="الفترة الزمنية" value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>آخر 7 أيام</option><option value={30}>آخر 30 يومًا</option><option value={90}>آخر 90 يومًا</option></select><button className="btn btn-outline btn-small" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> تحديث</button></div></header>
    {error && <p className="analytics-error" role="alert">{error}</p>}
    {loading && !data ? <section className="analytics-card">جارٍ تحميل المؤشرات…</section> : <>
      <section className="analytics-kpis">{cards.map(card => <article className="analytics-kpi" key={card.title}><span><card.icon size={19}/></span><small>{card.title}</small><strong>{number(card.value)}</strong></article>)}</section>
      <section className="analytics-card"><div className="analytics-section-heading"><div><h2>أداء الصفحات</h2><p>ترتيب الصفحات حسب المشاهدات، مع عدد الزوار المميزين لكل صفحة.</p></div></div><div className="analytics-table-wrap"><table><thead><tr><th>الصفحة</th><th>المشاهدات</th><th>الزوار</th></tr></thead><tbody>{(data?.pages ?? []).map(row => <tr key={row.page_path}><td><b>{pathLabel(row.page_path)}</b><small dir="ltr">{row.page_path}</small></td><td>{number(row.page_views)}</td><td>{number(row.visitors)}</td></tr>)}</tbody></table>{!data?.pages?.length && <p className="analytics-empty">لا توجد بيانات بعد. ستظهر الصفحات بعد موافقة الزوار على التحليلات.</p>}</div></section>
      <section className="analytics-two-col">
        <article className="analytics-card"><div className="analytics-section-heading"><div><h2>الأدوات المهنية</h2><p>البداية والإكمال وعدد الزوار الذين بدأوا الأداة.</p></div></div><div className="analytics-table-wrap"><table><thead><tr><th>الأداة/المسار</th><th>البدء</th><th>الإكمال</th><th>الزوار</th></tr></thead><tbody>{(data?.tools ?? []).map(row => <tr key={row.tool}><td>{pathLabel(row.tool)}</td><td>{number(row.starts)}</td><td>{number(row.completions)}</td><td>{number(row.users)}</td></tr>)}</tbody></table>{!data?.tools?.length && <p className="analytics-empty">لم تُسجل استخدامات أدوات بعد.</p>}</div></article>
        <article className="analytics-card"><div className="analytics-section-heading"><div><h2>مصادر الزيارات</h2><p>UTM أو نطاق الإحالة؛ الزيارة المباشرة قد لا تكشف مصدرها.</p></div></div><div className="analytics-table-wrap"><table><thead><tr><th>المصدر</th><th>المشاهدات</th><th>الزوار</th></tr></thead><tbody>{(data?.sources ?? []).map(row => <tr key={row.source}><td dir="auto">{row.source}</td><td>{number(row.page_views)}</td><td>{number(row.visitors)}</td></tr>)}</tbody></table></div></article>
      </section>
      <section className="analytics-card"><div className="analytics-section-heading"><div><h2><MapPin size={18}/> إشارات المنطقة والجهاز</h2><p>المنطقة الزمنية ولغة المتصفح مؤشرات تقريبية فقط؛ ليست بلدًا أو مدينة مؤكدة. للحصول على المدينة والدولة بدقة إحصائية، اربط GA4 بموافقة التحليلات.</p></div></div><div className="analytics-table-wrap"><table><thead><tr><th>المنطقة الزمنية</th><th>لغة المتصفح</th><th>الزوار</th></tr></thead><tbody>{(data?.locations ?? []).map(row => <tr key={row.timezone + row.locale}><td dir="ltr">{row.timezone}</td><td dir="ltr">{row.locale}</td><td>{number(row.visitors)}</td></tr>)}</tbody></table>{!data?.locations?.length && <p className="analytics-empty">ستظهر هذه الإشارات بعد تفعيل التحليلات.</p>}</div></section>
      <section className="analytics-card"><div className="analytics-section-heading"><div><h2>الزوار ذوو الاهتمام المحتمل</h2><p>درجة إشارية وليست حقيقة مؤكدة: تكرار الزيارة واستخدام الأدوات وفتح التسجيل. الهوية تظهر فقط للحساب المسجّل؛ الزائر المجهول يبقى بمعرّف مستعار.</p></div></div><div className="analytics-table-wrap"><table><thead><tr><th>الزائر</th><th>الدرجة</th><th>الصفحات</th><th>بدء أداة</th><th>آخر نشاط</th></tr></thead><tbody>{(data?.interested ?? []).map(row => <tr key={row.visitor_id}><td><b>{row.display_name}</b>{row.email && <small dir="ltr">{row.email}</small>}<small dir="ltr">{row.user_id ? 'حساب مسجل' : row.visitor_id.slice(0,8) + '…'}</small></td><td>{number(row.interest_score)}</td><td>{number(row.page_views)}</td><td>{number(row.tool_starts)}</td><td>{date(row.last_seen)}</td></tr>)}</tbody></table>{!data?.interested?.length && <p className="analytics-empty">لا توجد إشارات اهتمام كافية حتى الآن.</p>}</div></section>
      <section className="analytics-card"><div className="analytics-section-heading"><div><h2>قائمة البريد الإلكتروني</h2><p>{number(overview?.newsletter_subscribers)} اشتراكًا محفوظًا بموافقة صريحة. استخدم الملف لإدارة القائمة؛ إرسال الرسائل يحتاج ربط مزود بريد.</p></div><button className="btn btn-outline btn-small" type="button" onClick={exportSubscribers} disabled={!data?.subscribers?.length}><ArrowDownToLine size={15}/> تصدير CSV</button></div><div className="analytics-table-wrap"><table><thead><tr><th>البريد</th><th>مصدر الاشتراك</th><th>التاريخ</th></tr></thead><tbody>{(data?.subscribers ?? []).map(row => <tr key={row.email}><td dir="ltr">{row.email}</td><td dir="ltr">{pathLabel(row.source_path)}</td><td>{date(row.created_at)}</td></tr>)}</tbody></table>{!data?.subscribers?.length && <p className="analytics-empty">لا يوجد مشتركون بعد.</p>}</div></section>
      <p className="analytics-footnote"><ShieldCheck size={15}/> التحليلات لا تعمل قبل موافقة الزائر. لا نجمع نصوص النماذج أو محتوى أدوات المستخدم. لا تسجل هذه اللوحة المدينة أو الموقع الدقيق.</p>
    </>}
  </main>
}
