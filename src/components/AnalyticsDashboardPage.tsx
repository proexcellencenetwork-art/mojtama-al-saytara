import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowDownToLine, BarChart3, Eye, Mail, MapPin, RefreshCw, ShieldCheck, Target, Wrench, Laptop, Smartphone, Users, UserRoundCheck } from 'lucide-react'
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
type DevicePayload = {
  devices?: { device: string; visitors: number; page_views: number }[]
  operating_systems?: { name: string; visitors: number }[]
  browsers?: { name: string; visitors: number }[]
  viewports?: { name: string; visitors: number }[]
}
type Lead = {
  id: string; full_name: string; email: string; user_type: string; specialty: string; goal: string
  source_path: string; source_referrer: string | null; source_campaign: string | null
  status: 'new' | 'contacted' | 'qualified' | 'archived'; marketing_opt_in: boolean
  created_at: string; updated_at: string; converted: boolean
  interests: { interest_key: string; source_page: string; created_at: string }[]
}
type LeadPayload = { total?: number; new_count?: number; contacted_count?: number; qualified_count?: number; converted_count?: number; leads?: Lead[] }

const number = (value?: number) => new Intl.NumberFormat('ar-SA').format(value ?? 0)
const date = (value?: string) => value ? new Date(value).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
const pathLabel = (path: string) => ({ '/': 'الرئيسية', '/career-journey': 'الرحلة المهنية', '/career-compass': 'البوصلة المهنية', '/linkedin-audit': 'تدقيق LinkedIn', '/fresh-graduate': 'جاهزية الخريج', '/learning': 'مركز التعلّم', '/register': 'التسجيل', '/coaching': 'الكوتشنج', '/articles': 'المقالات', '/events': 'الفعاليات' } as Record<string,string>)[path] || path
const userTypeLabel = (value: string) => ({professional:'مهني',job_seeker:'باحث عن عمل',graduate:'خريج',coach:'كوتش',researcher:'باحث',innovator:'مبتكر',other:'أخرى'} as Record<string,string>)[value] || value
const goalLabel = (value: string) => ({job:'فرصة مهنية',skills:'تطوير المهارات',promotion:'ترقية',transition:'انتقال مهني',leadership:'قيادة',explore:'استكشاف'} as Record<string,string>)[value] || value
const statusLabel = (value: string) => ({new:'جديد',contacted:'تم التواصل',qualified:'مؤهل',archived:'مؤرشف'} as Record<string,string>)[value] || value

export function AnalyticsDashboardPage({ role }: { role: Role }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [days, setDays] = useState(30)
  const [data, setData] = useState<AnalyticsPayload | null>(null)
  const [devices, setDevices] = useState<DevicePayload | null>(null)
  const [leadData, setLeadData] = useState<LeadPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingLead, setSavingLead] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (role !== 'owner' || !supabase) { setAuthorized(false); setLoading(false); return }
    setLoading(true); setError('')
    const owner = await supabase.rpc('is_platform_owner')
    if (owner.error || owner.data !== true) { setAuthorized(false); setData(null); setDevices(null); setLeadData(null); setLoading(false); return }
    setAuthorized(true)
    const [analyticsResult, deviceResult, leadResult] = await Promise.all([
      supabase.rpc('get_owner_site_analytics', { p_days: days }),
      supabase.rpc('get_owner_device_analytics', { p_days: days }),
      supabase.rpc('get_owner_lead_pipeline', { p_limit: 150 }),
    ])
    if (analyticsResult.error) { setError('تعذر تحميل مؤشرات الزيارات. تحقق من صلاحيات المالك ثم أعد المحاولة.'); setData(null) }
    else setData(analyticsResult.data as AnalyticsPayload)
    if (deviceResult.error) setDevices(null)
    else setDevices(deviceResult.data as DevicePayload)
    if (leadResult.error) setLeadData(null)
    else setLeadData(leadResult.data as LeadPayload)
    if (deviceResult.error || leadResult.error) setError('بعض الأقسام لم تُحمّل. حدّث الصفحة، وإذا استمر الخلل راجع صلاحيات وظائف لوحة المالك.')
    setLoading(false)
  }, [role, days])

  useEffect(() => { void load() }, [load])

  async function updateLeadStatus(leadId: string, status: Lead['status']) {
    if (!supabase || savingLead) return
    setSavingLead(leadId)
    const result = await supabase.rpc('owner_update_lead_status', { p_lead_id: leadId, p_status: status })
    setSavingLead(null)
    if (result.error) { setError('تعذر تحديث حالة العميل المحتمل. لم يتم تأكيد التغيير.'); return }
    setLeadData(current => current ? { ...current, leads: current.leads?.map(lead => lead.id === leadId ? { ...lead, status } : lead) } : current)
  }

  function downloadCsv(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
    const csv = [headers, ...rows].map(row => row.map(value => '"' + String(value ?? '').replaceAll('"','""') + '"').join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }
  function exportSubscribers() {
    downloadCsv('saytara-newsletter-subscribers.csv',['email','status','source_path','created_at','consent_at'],(data?.subscribers ?? []).map(row => [row.email,row.status,row.source_path,row.created_at,row.consent_at]))
  }
  function exportLeads() {
    downloadCsv('saytara-leads.csv',['name','email','type','specialty','goal','status','source','referrer','campaign','marketing_opt_in','created_at'],(leadData?.leads ?? []).map(row => [row.full_name,row.email,userTypeLabel(row.user_type),row.specialty,goalLabel(row.goal),row.status,row.source_path,row.source_referrer,row.source_campaign,row.marketing_opt_in,row.created_at]))
  }

  if (authorized === false) return <main className="app-main wrap analytics-page" dir="rtl"><section className="analytics-card"><ShieldCheck size={30}/><h1>لوحة المؤشرات للمالك فقط</h1><p>هذه الصفحة لا تعرض بيانات الزوار أو العملاء إلا بعد إثبات صلاحية المالك من قاعدة البيانات.</p></section></main>

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
    <header className="analytics-heading"><div><span className="eyebrow">قياس النمو · للمالك فقط</span><h1>مركز إدارة الزوار والعملاء</h1><p>رحلة الزائر، الأدوات، مصادر الوصول، الأجهزة، العملاء المحتملون والتحويل إلى أعضاء. القياس يبدأ بعد الموافقة فقط.</p></div><div className="analytics-actions"><select aria-label="الفترة الزمنية" value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>آخر 7 أيام</option><option value={30}>آخر 30 يومًا</option><option value={90}>آخر 90 يومًا</option></select><button className="btn btn-outline btn-small" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> تحديث</button></div></header>
    {error && <p className="analytics-error" role="alert">{error}</p>}
    {loading && !data ? <section className="analytics-card">جارٍ تحميل المؤشرات…</section> : <>
      <section className="analytics-kpis">{cards.map(card => <article className="analytics-kpi" key={card.title}><span><card.icon size={19}/></span><small>{card.title}</small><strong>{number(card.value)}</strong></article>)}</section>
      <section className="analytics-card"><div className="analytics-section-heading"><div><h2>أداء الصفحات</h2><p>ترتيب الصفحات حسب المشاهدات، مع عدد الزوار المميزين لكل صفحة.</p></div></div><div className="analytics-table-wrap"><table><thead><tr><th>الصفحة</th><th>المشاهدات</th><th>الزوار</th></tr></thead><tbody>{(data?.pages ?? []).map(row => <tr key={row.page_path}><td><b>{pathLabel(row.page_path)}</b><small dir="ltr">{row.page_path}</small></td><td>{number(row.page_views)}</td><td>{number(row.visitors)}</td></tr>)}</tbody></table>{!data?.pages?.length && <p className="analytics-empty">لا توجد بيانات بعد. ستظهر الصفحات بعد موافقة الزوار على التحليلات.</p>}</div></section>
      <section className="analytics-two-col">
        <article className="analytics-card"><div className="analytics-section-heading"><div><h2>الأدوات المهنية</h2><p>البداية والإكمال وعدد الزوار الذين بدأوا الأداة.</p></div></div><div className="analytics-table-wrap"><table><thead><tr><th>الأداة/المسار</th><th>البدء</th><th>الإكمال</th><th>الزوار</th></tr></thead><tbody>{(data?.tools ?? []).map(row => <tr key={row.tool}><td>{pathLabel(row.tool)}</td><td>{number(row.starts)}</td><td>{number(row.completions)}</td><td>{number(row.users)}</td></tr>)}</tbody></table>{!data?.tools?.length && <p className="analytics-empty">لم تُسجل استخدامات أدوات بعد.</p>}</div></article>
        <article className="analytics-card"><div className="analytics-section-heading"><div><h2>مصادر الزيارات</h2><p>UTM أو نطاق الإحالة؛ الزيارة المباشرة قد لا تكشف مصدرها.</p></div></div><div className="analytics-table-wrap"><table><thead><tr><th>المصدر</th><th>المشاهدات</th><th>الزوار</th></tr></thead><tbody>{(data?.sources ?? []).map(row => <tr key={row.source}><td dir="auto">{row.source}</td><td>{number(row.page_views)}</td><td>{number(row.visitors)}</td></tr>)}</tbody></table></div></article>
      </section>
      <section className="analytics-card"><div className="analytics-section-heading"><div><h2><Laptop size={18}/> الأجهزة وأنظمة التشغيل والمتصفحات</h2><p>تصنيف تقريبي من معلومات المتصفح وحجم نافذة العرض، ولا يجمع بصمة جهاز أو عنوان IP.</p></div></div><div className="analytics-two-col">
        <div className="analytics-table-wrap"><h3>نوع الجهاز</h3><table><thead><tr><th>الجهاز</th><th>الزوار</th><th>المشاهدات</th></tr></thead><tbody>{(devices?.devices ?? []).map(row=><tr key={row.device}><td>{row.device==='mobile'?'جوال':row.device==='tablet'?'لوحي':row.device==='desktop'?'كمبيوتر':'غير معروف'}</td><td>{number(row.visitors)}</td><td>{number(row.page_views)}</td></tr>)}</tbody></table></div>
        <div className="analytics-table-wrap"><h3>نظام التشغيل</h3><table><thead><tr><th>النظام</th><th>الزوار</th></tr></thead><tbody>{(devices?.operating_systems ?? []).map(row=><tr key={row.name}><td>{row.name}</td><td>{number(row.visitors)}</td></tr>)}</tbody></table></div>
        <div className="analytics-table-wrap"><h3>المتصفح</h3><table><thead><tr><th>المتصفح</th><th>الزوار</th></tr></thead><tbody>{(devices?.browsers ?? []).map(row=><tr key={row.name}><td>{row.name}</td><td>{number(row.visitors)}</td></tr>)}</tbody></table></div>
        <div className="analytics-table-wrap"><h3>حجم نافذة العرض</h3><table><thead><tr><th>الفئة</th><th>الزوار</th></tr></thead><tbody>{(devices?.viewports ?? []).map(row=><tr key={row.name}><td>{row.name==='compact'?'صغير':row.name==='medium'?'متوسط':row.name==='wide'?'واسع':'غير معروف'}</td><td>{number(row.visitors)}</td></tr>)}</tbody></table></div>
      </div></section>
      <section className="analytics-card"><div className="analytics-section-heading"><div><h2><MapPin size={18}/> المنطقة الزمنية ولغة المتصفح</h2><p>مؤشرات تقريبية فقط؛ لا تمثل بلدًا أو مدينة مؤكدة.</p></div></div><div className="analytics-table-wrap"><table><thead><tr><th>المنطقة الزمنية</th><th>لغة المتصفح</th><th>الزوار</th></tr></thead><tbody>{(data?.locations ?? []).map(row => <tr key={row.timezone + row.locale}><td dir="ltr">{row.timezone}</td><td dir="ltr">{row.locale}</td><td>{number(row.visitors)}</td></tr>)}</tbody></table>{!data?.locations?.length && <p className="analytics-empty">لا توجد بيانات بعد.</p>}</div></section>
      <section className="analytics-card"><div className="analytics-section-heading"><div><h2><Users size={18}/> العملاء المحتملون وطلبات الاهتمام</h2><p>بيانات تواصل أدخلها أصحابها بأنفسهم. يمكنك متابعة الحالة وتصدير القائمة.</p></div><button className="btn btn-outline btn-small" type="button" onClick={exportLeads} disabled={!leadData?.leads?.length}><ArrowDownToLine size={15}/> تصدير العملاء CSV</button></div>
        <div className="analytics-kpis">{[{title:'إجمالي العملاء',value:leadData?.total},{title:'جدد',value:leadData?.new_count},{title:'تم التواصل',value:leadData?.contacted_count},{title:'مؤهلون',value:leadData?.qualified_count},{title:'تحولوا لأعضاء',value:leadData?.converted_count}].map(item=><article className="analytics-kpi" key={item.title}><small>{item.title}</small><strong>{number(item.value)}</strong></article>)}</div>
        <div className="analytics-table-wrap"><table><thead><tr><th>العميل</th><th>نوعه ومجاله</th><th>اهتمامه</th><th>مصدره</th><th>تاريخ التسجيل</th><th>الحالة</th></tr></thead><tbody>{(leadData?.leads ?? []).map(lead=><tr key={lead.id}><td><b>{lead.full_name}</b><small dir="ltr">{lead.email}</small>{lead.converted&&<small>عضو مسجل</small>}</td><td>{userTypeLabel(lead.user_type)}<small>{lead.specialty}</small></td><td>{goalLabel(lead.goal)}<small>{lead.interests?.map(item=>item.interest_key).join('، ')}</small></td><td><small dir="ltr">{lead.source_path}</small><small dir="ltr">{lead.source_referrer || 'مصدر غير محدد'}</small>{lead.source_campaign&&<small>{lead.source_campaign}</small>}</td><td>{date(lead.created_at)}</td><td><select aria-label={'حالة '+lead.full_name} value={lead.status} disabled={savingLead===lead.id} onChange={event=>void updateLeadStatus(lead.id,event.target.value as Lead['status'])}><option value="new">جديد</option><option value="contacted">تم التواصل</option><option value="qualified">مؤهل</option><option value="archived">مؤرشف</option></select></td></tr>)}</tbody></table>{!leadData?.leads?.length&&<p className="analytics-empty">لا توجد طلبات اهتمام محفوظة حاليًا. نموذج الاهتمام العام متوقف إلى حين اعتماد إعدادات الخصوصية.</p>}</div>
      </section>
      <section className="analytics-card"><div className="analytics-section-heading"><div><h2><UserRoundCheck size={18}/> الزوار ذوو الاهتمام المحتمل</h2><p>درجة إشارية من تكرار الزيارة واستخدام الأدوات. لا تكشف هوية الشخص المجهول.</p></div></div><div className="analytics-table-wrap"><table><thead><tr><th>الزائر</th><th>الدرجة</th><th>الصفحات</th><th>بدء أداة</th><th>إكمال أداة</th><th>أيام النشاط</th><th>آخر نشاط</th></tr></thead><tbody>{(data?.interested ?? []).map(row => <tr key={row.visitor_id}><td><b>{row.display_name}</b>{row.email&&<small dir="ltr">{row.email}</small>}<small dir="ltr">{row.user_id?'حساب مسجل':row.visitor_id.slice(0,8)+'…'}</small></td><td>{number(row.interest_score)}</td><td>{number(row.page_views)}</td><td>{number(row.tool_starts)}</td><td>{number(row.tool_completions)}</td><td>{number(row.active_days)}</td><td>{date(row.last_seen)}</td></tr>)}</tbody></table>{!data?.interested?.length&&<p className="analytics-empty">لا توجد إشارات اهتمام كافية حتى الآن.</p>}</div></section>
      <section className="analytics-card"><div className="analytics-section-heading"><div><h2>قائمة البريد الإلكتروني</h2><p>{number(overview?.newsletter_subscribers)} اشتراكًا محفوظًا بموافقة صريحة.</p></div><button className="btn btn-outline btn-small" type="button" onClick={exportSubscribers} disabled={!data?.subscribers?.length}><ArrowDownToLine size={15}/> تصدير CSV</button></div><div className="analytics-table-wrap"><table><thead><tr><th>البريد</th><th>مصدر الاشتراك</th><th>التاريخ</th><th>الموافقة</th></tr></thead><tbody>{(data?.subscribers ?? []).map(row => <tr key={row.email}><td dir="ltr">{row.email}</td><td dir="ltr">{pathLabel(row.source_path)}</td><td>{date(row.created_at)}</td><td>{date(row.consent_at)}</td></tr>)}</tbody></table>{!data?.subscribers?.length&&<p className="analytics-empty">لا يوجد مشتركون بعد.</p>}</div></section>
      <p className="analytics-footnote"><ShieldCheck size={15}/> لا يتم جمع بيانات التتبع قبل موافقة الزائر. لا تُحفظ إجابات الأدوات أو نصوص النماذج. بيانات التواصل لا تُجمع إلا عبر نموذج صريح، وإدارة العملاء محصورة بالمالك.</p>
    </>}
  </main>
}
