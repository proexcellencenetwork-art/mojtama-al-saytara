import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { FormEvent } from 'react'
import { ArrowLeft, BadgeCheck, BarChart3, RefreshCw, Send, ShieldCheck, UserCog, UserPlus, Users } from 'lucide-react'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'
import './OwnerPortalPage.css'

type ManagedRole = Exclude<Role, 'member' | 'owner'>
type PlatformAccount = {
  user_id: string
  email: string
  display_name: string
  account_status: 'pending' | 'approved' | 'rejected' | string
  email_confirmed: boolean
  is_platform_owner: boolean
  roles: Role[]
  created_at: string
  last_sign_in_at: string | null
}
type CommunityMetricSettings = { visible: boolean; mode: 'actual' | 'goal'; goal: number }

type CommandCenterAnalytics = {
  overview?: {
    page_views?: number
    unique_visitors?: number
    tool_starts?: number
    tool_completions?: number
    newsletter_subscribers?: number
    interest_visitors?: number
  }
  pages?: { page_path: string; page_views: number; visitors: number }[]
  sources?: { source: string; page_views: number; visitors: number }[]
  tools?: { tool: string; starts: number; completions: number; users: number }[]
  daily?: { day: string; page_views: number; visitors: number }[]
}
type CommandCenterLeadSummary = { total?: number; new_count?: number; qualified_count?: number; converted_count?: number }
type CommandCenterSurveySummary = { responses?: number; average_rating?: number | null }
type CommandCenterBehaviorSummary = { returning_visitors?: number; repeat_tool_users?: number }
type CommandCenterSnapshot = {
  analytics: CommandCenterAnalytics | null
  leads: CommandCenterLeadSummary | null
  survey: CommandCenterSurveySummary | null
  behavior: CommandCenterBehaviorSummary | null
}
const metricNumber = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) ? new Intl.NumberFormat('ar-SA').format(value) : '—'
type OwnerAudit = {
  id: number
  actor_id: string
  target_user_id: string | null
  target_email: string
  action: 'owner_bootstrap' | 'role_granted' | 'role_revoked' | string
  role: ManagedRole | null
  setting_key: string | null
  setting_value: boolean | string | number | null
  reason: string
  created_at: string
}

const roleLabels: Record<ManagedRole, string> = {
  verified: 'عضو موثّق',
  coach: 'كوتش',
  moderator: 'مشرف',
  manager: 'مدير',
}
const statusLabels: Record<string, string> = { approved: 'معتمد', pending: 'قيد المراجعة', rejected: 'مرفوض' }
const safeRows = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : []

export function OwnerPortalPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [accounts, setAccounts] = useState<PlatformAccount[]>([])
  const [audit, setAudit] = useState<OwnerAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [target, setTarget] = useState('')
  const [selectedRole, setSelectedRole] = useState<ManagedRole>('manager')
  const [action, setAction] = useState<'grant' | 'revoke'>('grant')
  const [reason, setReason] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [ownerInvitationsEnabled, setOwnerInvitationsEnabled] = useState(true)
  const [communityMetric, setCommunityMetric] = useState<CommunityMetricSettings>({ visible: false, mode: 'actual', goal: 100 })
  const [commandCenter, setCommandCenter] = useState<CommandCenterSnapshot | null>(null)
  const [commandCenterPeriod, setCommandCenterPeriod] = useState(30)
  const [commandCenterLoading, setCommandCenterLoading] = useState(true)
  const [commandCenterError, setCommandCenterError] = useState('')
  const [commandCenterUpdatedAt, setCommandCenterUpdatedAt] = useState<string | null>(null)

  const eligibleAccounts = useMemo(
    () => accounts.filter(account => account.email_confirmed && account.account_status === 'approved' && !account.is_platform_owner),
    [accounts],
  )

  const load = useCallback(async () => {
    if (!supabase) {
      setAuthorized(false)
      setError('لوحة المالك تتطلب اتصال Supabase فعلياً.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    const ownerCheck = await supabase.rpc('is_platform_owner')
    if (ownerCheck.error || ownerCheck.data !== true) {
      setAuthorized(false)
      setAccounts([])
      setAudit([])
      setCommandCenter(null)
      setCommandCenterLoading(false)
      setLoading(false)
      if (ownerCheck.error) setError('تعذر التحقق من صلاحية المالك. أعد المحاولة بعد اكتمال التهيئة.')
      return
    }
    setAuthorized(true)
    setCommandCenterLoading(true)
    setCommandCenterError('')
    const [accountsResult, auditResult, invitationSettingResult, communityMetricResult, analyticsResult, leadsResult, surveyResult, behaviorResult] = await Promise.all([
      supabase.rpc('list_platform_accounts_activity'),
      supabase.rpc('list_platform_owner_audit', { p_limit: 50 }),
      supabase.rpc('is_owner_invitations_enabled'),
      supabase.rpc('get_owner_community_metric_settings'),
      supabase.rpc('get_owner_site_analytics', { p_days: commandCenterPeriod }),
      supabase.rpc('get_owner_lead_pipeline', { p_limit: 1 }),
      supabase.rpc('get_owner_public_survey_summary', { p_days: commandCenterPeriod }),
      supabase.rpc('get_owner_behavioral_insights', { p_days: commandCenterPeriod }),
    ])
    const analytics = analyticsResult.error ? null : analyticsResult.data as CommandCenterAnalytics
    const leads = leadsResult.error ? null : leadsResult.data as CommandCenterLeadSummary
    const survey = surveyResult.error ? null : surveyResult.data as CommandCenterSurveySummary
    const behavior = behaviorResult.error ? null : behaviorResult.data as CommandCenterBehaviorSummary
    setCommandCenter({ analytics, leads, survey, behavior })
    const dashboardFailures = [analyticsResult, leadsResult, surveyResult, behaviorResult].filter(result => result.error).length
    setCommandCenterError(dashboardFailures ? 'تعذر تحميل بعض مؤشرات مركز القيادة. البيانات التي ظهرت فقط هي البيانات التي أعادتها قاعدة البيانات بنجاح.' : '')
    setCommandCenterUpdatedAt(new Date().toISOString())
    setCommandCenterLoading(false)
    if (accountsResult.error || auditResult.error || invitationSettingResult.error || communityMetricResult.error) {
      setError('تعذر تحميل لوحة المالك. تحقّق من تطبيق migration ثم أعد المحاولة.')
      setAccounts([])
      setAudit([])
    } else {
      setOwnerInvitationsEnabled(invitationSettingResult.data === true)
      const metricData = communityMetricResult.data as Partial<CommunityMetricSettings> | null
      setCommunityMetric({ visible: metricData?.visible === true, mode: metricData?.mode === 'goal' ? 'goal' : 'actual', goal: Number.isInteger(metricData?.goal) ? Math.max(0, Math.min(1000000, metricData!.goal!)) : 100 })
      const nextAccounts = safeRows<PlatformAccount>(accountsResult.data)
      setAccounts(nextAccounts)
      setAudit(safeRows<OwnerAudit>(auditResult.data))
      setTarget(current => current && nextAccounts.some(account => account.user_id === current && account.email_confirmed && account.account_status === 'approved' && !account.is_platform_owner)
        ? current
        : nextAccounts.find(account => account.email_confirmed && account.account_status === 'approved' && !account.is_platform_owner)?.user_id || '')
    }
    setLoading(false)
  }, [commandCenterPeriod])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  async function manageRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !target || !reason.trim()) return
    setBusy(true); setError(''); setNotice('')
    const { error: rpcError } = await supabase.rpc('manage_platform_role', {
      p_user_id: target,
      p_role: selectedRole,
      p_action: action,
      p_reason: reason.trim(),
    })
    setBusy(false)
    if (rpcError) setError('لم يُنفّذ تغيير الدور. قد يكون الحساب غير معتمد أو أن الصلاحية موجودة/غير موجودة مسبقاً.')
    else {
      setNotice(action === 'grant' ? `مُنح دور ${roleLabels[selectedRole]} وسُجل الإجراء.` : `أُزيل دور ${roleLabels[selectedRole]} وسُجل الإجراء.`)
      setReason('')
      await load()
    }
  }

  async function inviteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !inviteEmail.trim()) return
    setBusy(true); setError(''); setNotice('')
    const { error: inviteError } = await supabase.functions.invoke('owner-invite', {
      body: { email: inviteEmail.trim() },
    })
    setBusy(false)
    if (inviteError) setError('تعذر إرسال الدعوة. تحقّق من إعدادات البريد وروابط العودة، ثم أعد المحاولة.')
    else {
      setNotice('أُرسلت دعوة البريد. يبدأ الحساب الجديد كعضو قيد المراجعة ولا يحصل على دور إداري تلقائياً.')
      setInviteEmail('')
    }
  }

  async function toggleOwnerInvitations() {
    if (!supabase) return
    const next = !ownerInvitationsEnabled
    const changeReason = window.prompt(next ? 'اكتب سبب تفعيل دعوات المالك:' : 'اكتب سبب إيقاف دعوات المالك:', '')
    if (!changeReason?.trim()) return
    setBusy(true); setError(''); setNotice('')
    const { error: rpcError } = await supabase.rpc('set_platform_setting', {
      p_key: 'owner_invitations_enabled', p_value: next, p_reason: changeReason.trim(),
    })
    setBusy(false)
    if (rpcError) setError('تعذر حفظ إعداد الدعوات. لم يتغير الإعداد.')
    else { setNotice(next ? 'فُعّلت دعوات المالك وسُجل التغيير.' : 'أُوقفت دعوات المالك وسُجل التغيير.'); await load() }
  }

  async function saveCommunityMetric(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const changeReason = window.prompt('اكتب سبب تحديث مؤشر المجتمع العام:', '')
    if (!changeReason?.trim()) return
    setBusy(true); setError(''); setNotice('')
    const { error: rpcError } = await supabase.rpc('set_owner_community_metric', {
      p_visible: communityMetric.visible,
      p_mode: communityMetric.mode,
      p_goal: communityMetric.goal,
      p_reason: changeReason.trim(),
    })
    setBusy(false)
    if (rpcError) setError('تعذر حفظ إعداد مؤشر المجتمع. لم يُعتمد التغيير؛ تحقق من تطبيق migration ثم أعد المحاولة.')
    else { setNotice('حُفظ إعداد مؤشر المجتمع وسُجل في سجل التدقيق.'); await load() }
  }

  async function changeAccountAccess(account: PlatformAccount) {
    if (!supabase || !account.email_confirmed || account.is_platform_owner) return
    const nextAction = account.account_status === 'approved' ? 'suspend' : account.account_status === 'rejected' ? 'restore' : null
    if (!nextAction) return
    const changeReason = window.prompt(nextAction === 'suspend' ? 'اكتب سبب تعليق الحساب:' : 'اكتب سبب استعادة الحساب:', '')
    if (!changeReason?.trim()) return
    setBusy(true); setError(''); setNotice('')
    const { error: rpcError } = await supabase.rpc('set_platform_account_access', {
      p_user_id: account.user_id, p_action: nextAction, p_reason: changeReason.trim(),
    })
    setBusy(false)
    if (rpcError) setError('تعذر تغيير حالة الحساب. لم يُحذف أي محتوى أو سجل.')
    else { setNotice(nextAction === 'suspend' ? 'عُلّق دخول الحساب وسُجل السبب؛ لم تُحذف بياناته.' : 'استُعيد وصول الحساب وسُجل السبب.'); await load() }
  }

  if (loading && authorized === null) return <main className="app-main wrap owner-portal"><section className="owner-card" role="status">جارٍ التحقق من صلاحية المالك…</section></main>
  if (authorized !== true) return <main className="app-main wrap owner-portal"><section className="owner-card owner-denied"><ShieldCheck size={30}/><h1>تعذر إثبات صلاحية المالك.</h1><p>{error || 'لا تملك هذه الصفحة صلاحية إدارة المنصة.'}</p><button className="btn btn-outline" type="button" onClick={() => void load()}><RefreshCw size={15}/> إعادة التحقق</button></section></main>

  return <main className="app-main wrap owner-portal" dir="rtl">
    <div className="page-title-row owner-heading"><div><span className="eyebrow">صلاحية منفصلة عن المدير</span><h1>مركز مالك المنصة</h1><p>هذه الأدوات تتحقق من المالك في قاعدة البيانات، ولا تكفي معرفة رابط الصفحة للوصول إليها.</p></div><div className="owner-heading-actions"><Link className="btn btn-primary btn-small" to="/owner/analytics"><BarChart3 size={15}/> مؤشرات الأداء</Link><button className="btn btn-outline btn-small" type="button" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={15}/> تحديث</button></div></div>
    {notice && <div className="inline-message" role="status">{notice}</div>}
    {error && <div className="inline-message live-error" role="alert">{error}</div>}

    <section className="owner-command-center" aria-labelledby="owner-command-center-title">
      <div className="owner-command-header">
        <div>
          <span className="owner-command-kicker"><BarChart3 size={15}/> قيادة المجتمع بالأرقام</span>
          <h2 id="owner-command-center-title">مركز القيادة</h2>
          <p>صورة تشغيلية موحدة للزيارات والاهتمام والعملاء المحتملين واستخدام الأدوات ورضا الزوار.</p>
        </div>
        <div className="owner-command-controls">
          <label>الفترة
            <select value={commandCenterPeriod} onChange={event => setCommandCenterPeriod(Number(event.target.value))}>
              <option value={7}>آخر 7 أيام</option>
              <option value={30}>آخر 30 يوماً</option>
              <option value={90}>آخر 90 يوماً</option>
            </select>
          </label>
          <button className="btn btn-outline btn-small" type="button" onClick={() => void load()} disabled={loading || commandCenterLoading}>
            <RefreshCw size={14}/> تحديث المؤشرات
          </button>
          <Link className="btn btn-primary btn-small" to="/owner/analytics"><BarChart3 size={14}/> التفاصيل والتحليلات</Link>
          <small>{commandCenterUpdatedAt ? 'آخر تحديث: ' + new Date(commandCenterUpdatedAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : 'لم يكتمل التحديث بعد'}</small>
        </div>
      </div>

      {commandCenterError && <p className="owner-command-warning" role="status">{commandCenterError}</p>}
      {commandCenterLoading && !commandCenter?.analytics
        ? <p className="owner-command-state" role="status">جارٍ تحميل المؤشرات من قاعدة البيانات…</p>
        : <>
          <div className="owner-command-kpis">
            {[
              { label: 'مشاهدات الصفحات', value: commandCenter?.analytics?.overview?.page_views, note: 'ضمن الفترة المختارة', icon: Eye },
              { label: 'زوار مميزون', value: commandCenter?.analytics?.overview?.unique_visitors, note: 'معرّفات ضمن القياس الموافق عليه', icon: Users },
              { label: 'مهتمون محتملون', value: commandCenter?.analytics?.overview?.interest_visitors, note: 'وفق إشارات الاهتمام المسجلة', icon: Target },
              { label: 'طلبات الاهتمام', value: commandCenter?.leads?.total, note: 'إجمالي العملاء المحتملين المسجلين', icon: UserPlus },
              { label: 'بدأوا استخدام أداة', value: commandCenter?.analytics?.overview?.tool_starts, note: 'مرات بدء الاستخدام', icon: Activity },
              { label: 'أكملوا استخدام أداة', value: commandCenter?.analytics?.overview?.tool_completions, note: 'مرات الإكمال المسجلة', icon: BadgeCheck },
              { label: 'مشتركو البريد', value: commandCenter?.analytics?.overview?.newsletter_subscribers, note: 'اشتراكات نشطة إجمالاً', icon: Mail },
              { label: 'ردود الاستبيان', value: commandCenter?.survey?.responses, note: 'ضمن الفترة المختارة', icon: MessageSquare },
              { label: 'حسابات معتمدة', value: accounts.filter(account => account.account_status === 'approved' && !account.is_platform_owner).length, note: 'من قائمة الحسابات المحمّلة', icon: ShieldCheck },
              { label: 'قيد المراجعة', value: accounts.filter(account => account.account_status === 'pending').length, note: 'حسابات تنتظر قرار الإدارة', icon: UserCog },
            ].map(item => <article className="owner-command-kpi" key={item.label}>
              <span className="owner-command-kpi-icon"><item.icon size={18}/></span>
              <small>{item.label}</small>
              <strong>{metricNumber(item.value)}</strong>
              <em>{item.note}</em>
            </article>)}
          </div>

          <div className="owner-command-insights">
            <div><b>العودة للموقع</b><strong>{metricNumber(commandCenter?.behavior?.returning_visitors)}</strong><small>زوار عادوا في أكثر من يوم خلال الفترة</small></div>
            <div><b>مستخدمون متكررون للأدوات</b><strong>{metricNumber(commandCenter?.behavior?.repeat_tool_users)}</strong><small>زوار بدأوا الأدوات أكثر من مرة</small></div>
            <div><b>متوسط تقييم التجربة</b><strong>{typeof commandCenter?.survey?.average_rating === 'number' ? commandCenter.survey.average_rating.toLocaleString('ar-SA', { maximumFractionDigits: 2 }) + ' / 5' : '—'}</strong><small>لا يظهر متوسط دون ردود صالحة</small></div>
            <div><b>مسار العملاء المحتملين</b><strong>{metricNumber(commandCenter?.leads?.new_count)} جديد</strong><small>{metricNumber(commandCenter?.leads?.qualified_count)} مؤهل · {metricNumber(commandCenter?.leads?.converted_count)} تحولوا</small></div>
          </div>

          <div className="owner-command-lists">
            <article className="owner-command-card">
              <div className="owner-command-card-heading"><h3>مصادر الوصول</h3><span>أعلى المصادر مشاهدةً</span></div>
              {(commandCenter?.analytics?.sources || []).slice(0, 5).length
                ? (commandCenter?.analytics?.sources || []).slice(0, 5).map(item => {
                  const maximum = Math.max(1, ...((commandCenter?.analytics?.sources || []).map(row => row.page_views)))
                  return <div className="owner-command-bar-row" key={item.source}>
                    <div><b>{item.source}</b><strong>{metricNumber(item.page_views)}</strong></div>
                    <span><i style={{ width: Math.max(2, item.page_views / maximum * 100) + '%' }}/></span>
                    <small>{metricNumber(item.visitors)} زائر مقاس</small>
                  </div>
                })
                : <p className="owner-command-empty">لا توجد مصادر وصول مسجلة في هذه الفترة.</p>}
            </article>
            <article className="owner-command-card">
              <div className="owner-command-card-heading"><h3>الصفحات الأكثر زيارة</h3><span>حسب أحداث مشاهدة الصفحة</span></div>
              {(commandCenter?.analytics?.pages || []).slice(0, 5).length
                ? (commandCenter?.analytics?.pages || []).slice(0, 5).map(item => {
                  const maximum = Math.max(1, ...((commandCenter?.analytics?.pages || []).map(row => row.page_views)))
                  return <div className="owner-command-bar-row" key={item.page_path}>
                    <div><b dir="ltr">{item.page_path}</b><strong>{metricNumber(item.page_views)}</strong></div>
                    <span><i style={{ width: Math.max(2, item.page_views / maximum * 100) + '%' }}/></span>
                    <small>{metricNumber(item.visitors)} زائر مقاس</small>
                  </div>
                })
                : <p className="owner-command-empty">لا توجد مشاهدات صفحات مسجلة في هذه الفترة.</p>}
            </article>
            <article className="owner-command-card">
              <div className="owner-command-card-heading"><h3>استخدام الأدوات</h3><span>بدء مقابل إكمال</span></div>
              {(commandCenter?.analytics?.tools || []).slice(0, 5).length
                ? (commandCenter?.analytics?.tools || []).slice(0, 5).map(item => <div className="owner-command-tool-row" key={item.tool}>
                    <div><b>{item.tool}</b><span>{metricNumber(item.users)} مستخدم · {metricNumber(item.starts)} بدء · {metricNumber(item.completions)} إكمال</span></div>
                    <strong>{item.starts > 0 ? Math.round(item.completions / item.starts * 100).toLocaleString('ar-SA') + '%' : '—'}</strong>
                  </div>)
                : <p className="owner-command-empty">لم تُسجل بدايات أو إكمالات أدوات في هذه الفترة.</p>}
            </article>
            <article className="owner-command-card">
              <div className="owner-command-card-heading"><h3>النشاط اليومي</h3><span>مشاهدات الصفحة</span></div>
              {(commandCenter?.analytics?.daily || []).slice(-10).length
                ? <div className="owner-command-daily">{(commandCenter?.analytics?.daily || []).slice(-10).map(item => {
                    const maximum = Math.max(1, ...((commandCenter?.analytics?.daily || []).map(row => row.page_views)))
                    return <div key={item.day} title={metricNumber(item.page_views) + ' مشاهدة'}><i style={{ height: Math.max(4, item.page_views / maximum * 100) + '%' }}/><small>{new Date(item.day + 'T00:00:00+03:00').toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' })}</small></div>
                  })}</div>
                : <p className="owner-command-empty">لا توجد بيانات يومية مسجلة في هذه الفترة.</p>}
            </article>
          </div>
        </>}
      <p className="owner-command-footnote"><ShieldCheck size={14}/> تنبيه قياس: مشاهدات الصفحات والزوار هنا تمثل الأحداث التي سُجلت بعد موافقة الزائر، ولا تساوي بالضرورة جميع زوار الموقع. الأرقام غير المتاحة تظهر بشرطة، ولا نستبدلها بأرقام تقديرية.</p>
    </section>

    <section className="owner-grid">
      <article className="owner-card">
        <div className="owner-card-heading"><span><UserPlus size={18}/></span><div><h2>دعوة بالبريد الإلكتروني</h2><p>ترسل دعوة Supabase؛ ينشأ دور العضو الأساسي فقط، بلا دور امتيازي أو تجاوز للموافقة.</p></div></div>
        <form className="owner-form" onSubmit={event => void inviteAccount(event)}>
          <label>البريد الإلكتروني المدعو<input type="email" required maxLength={320} dir="ltr" autoComplete="email" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="name@example.com"/></label>
          <button className="btn btn-primary" type="submit" disabled={busy || !ownerInvitationsEnabled || !inviteEmail.trim()}><Send size={15}/>{busy ? 'جارٍ الإرسال…' : ownerInvitationsEnabled ? 'إرسال الدعوة' : 'الدعوات متوقفة'}</button>
        </form>
        <small className="owner-note">بعد تأكيد البريد، يبقى الحساب قيد المراجعة حتى يقرّه المالك أو المدير. أدوار المدير/المشرف تُمنح لاحقاً من هذه اللوحة فقط.</small>
      </article>

      <article className="owner-card">
        <div className="owner-card-heading"><span><UserCog size={18}/></span><div><h2>إدارة أدوار التطبيق</h2><p>لا يستطيع المدير تغيير الأدوار عبر واجهة قاعدة البيانات أو هذه الصفحة.</p></div></div>
        {eligibleAccounts.length === 0 ? <p className="owner-empty">لا توجد حالياً حسابات معتمدة ومؤكدة مؤهلة لتغيير الدور.</p> : <form className="owner-form" onSubmit={event => void manageRole(event)}>
          <label>الحساب<select required value={target} onChange={event => setTarget(event.target.value)}><option value="">اختر حساباً معتمداً</option>{eligibleAccounts.map(account => <option key={account.user_id} value={account.user_id}>{account.display_name} · {account.email}</option>)}</select></label>
          <div className="owner-form-row"><label>الدور<select value={selectedRole} onChange={event => setSelectedRole(event.target.value as ManagedRole)}>{(Object.keys(roleLabels) as ManagedRole[]).map(value => <option key={value} value={value}>{roleLabels[value]}</option>)}</select></label><label>الإجراء<select value={action} onChange={event => setAction(event.target.value as 'grant' | 'revoke')}><option value="grant">منح الدور</option><option value="revoke">إزالة الدور</option></select></label></div>
          <label>سبب التغيير<textarea required minLength={1} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="مثال: تعيين مسؤول مراجعة الحسابات"/></label>
          <button className="btn btn-primary" type="submit" disabled={busy || !target || !reason.trim()}><BadgeCheck size={15}/>{busy ? 'جارٍ الحفظ…' : 'تسجيل التغيير'}</button>
        </form>}
      </article>
    </section>

    <section className="owner-card owner-settings-card">
      <div className="owner-card-heading"><span><ShieldCheck size={18}/></span><div><h2>إعدادات المنصة</h2><p>الإعدادات الداخلية الحساسة لا تُغيّر إلا من حساب المالك وتُسجّل في سجل التدقيق.</p></div></div>
      <div className="owner-setting-row"><div><b>دعوات الحسابات</b><small>تشغيل دعوات البريد من لوحة المالك فقط؛ تعطيلها يمنع وظيفة الدعوة على الخادم.</small></div><span className={`owner-pill ${ownerInvitationsEnabled ? 'owner-setting-on' : 'owner-setting-off'}`}>{ownerInvitationsEnabled ? 'مفعّلة' : 'متوقفة'}</span><button className="btn btn-outline btn-small" type="button" disabled={busy} onClick={() => void toggleOwnerInvitations()}>{ownerInvitationsEnabled ? 'إيقاف الدعوات' : 'تفعيل الدعوات'}</button></div>
      <div className="owner-setting-row"><div><b>التسجيل العام</b><small>إنشاء الحساب يتطلب تأكيد البريد واعتماد الإدارة قبل دخول مساحة الأعضاء.</small></div><span className="owner-pill owner-setting-off">موقوف حتى اكتمال إعدادات الأمان</span></div>
      <p className="owner-note">لا نعرض عددًا مختلقًا على أنه أعضاء حقيقيون. يمكنك إظهار العدد الفعلي المعتمد من قاعدة البيانات أو إظهار هدف مجتمعي معلن بوضوح.</p>
      <div className="owner-community-metric">
        <div className="owner-card-heading"><span><Users size={18}/></span><div><h2>مؤشر المجتمع في الصفحة الرئيسية</h2><p>تحكم بما يراه الزائر، دون كشف بيانات الحسابات أو عرض أرقام غير حقيقية.</p></div></div>
        <form className="owner-form" onSubmit={event => void saveCommunityMetric(event)}>
          <label className="owner-metric-toggle"><input type="checkbox" checked={communityMetric.visible} onChange={event => setCommunityMetric(current => ({ ...current, visible: event.target.checked }))}/> إظهار مؤشر المجتمع في الصفحة الرئيسية</label>
          <label>نوع الرقم المعروض<select value={communityMetric.mode} onChange={event => setCommunityMetric(current => ({ ...current, mode: event.target.value as 'actual' | 'goal' }))}><option value="actual">عدد الأعضاء الحقيقيين المعتمدين فقط</option><option value="goal">هدف المجتمع (يوضح للزائر أنه هدف)</option></select></label>
          {communityMetric.mode === 'goal' && <label>الهدف الذي تريد إعلانه<input type="number" min={0} max={1000000} step={1} required value={communityMetric.goal} onChange={event => setCommunityMetric(current => ({ ...current, goal: Math.max(0, Math.min(1000000, Number(event.target.value) || 0)) }))}/></label>}
          <p className="owner-note">{communityMetric.mode === 'goal' ? `سيظهر للزوار «هدفنا القادم: ${communityMetric.goal} عضوًا» وليس على أنه عدد الأعضاء الحالي.` : 'سيُحسب العدد من الحسابات التي أكدت البريد واعتمدتها الإدارة، ولن يتاح إدخاله يدويًا.'}</p>
          <button className="btn btn-primary" type="submit" disabled={busy}><BadgeCheck size={15}/>{busy ? 'جارٍ الحفظ…' : 'حفظ إعداد المؤشر'}</button>
        </form>
      </div>
    </section>

    <section className="owner-card owner-wide-card">
      <div className="owner-card-heading"><span><ShieldCheck size={18}/></span><div><h2>الحسابات</h2><p>البيانات المعروضة محدودة لمالك المنصة، ومؤكدة عبر RPC محمي في قاعدة البيانات.</p></div></div>
      {loading ? <p role="status">جارٍ تحميل الحسابات…</p> : accounts.length === 0 ? <p className="owner-empty">لا توجد حسابات ظاهرة.</p> : <div className="owner-account-list">{accounts.map(account => <article className="owner-account" key={account.user_id}>
        <div className="owner-account-main"><b>{account.display_name || 'عضو جديد'}</b><span dir="ltr">{account.email}</span><small>{account.email_confirmed ? 'البريد مؤكد' : 'البريد غير مؤكد'} · {statusLabels[account.account_status] || account.account_status} · التسجيل: {new Date(account.created_at).toLocaleDateString('ar')} · آخر دخول: {account.last_sign_in_at ? new Date(account.last_sign_in_at).toLocaleString('ar') : 'لم يسجل دخول'}</small></div>
        <div className="owner-role-pills">{account.is_platform_owner ? <span className="owner-pill owner-pill-root">مالك المنصة</span> : account.roles.map(value => <span className="owner-pill" key={value}>{value === 'owner' ? 'مالك المنصة' : value in roleLabels ? roleLabels[value as ManagedRole] : 'عضو'}</span>)}{!account.is_platform_owner && account.email_confirmed && (account.account_status === 'approved' || account.account_status === 'rejected') && <button className="btn btn-outline btn-small" type="button" disabled={busy} onClick={() => void changeAccountAccess(account)}>{account.account_status === 'approved' ? 'تعليق الوصول' : 'استعادة الوصول'}</button>}</div>
      </article>)}</div>}
    </section>

    <section className="owner-card owner-wide-card">
      <div className="owner-card-heading"><span><ShieldCheck size={18}/></span><div><h2>سجل تغييرات المالك</h2><p>تُسجل عمليات نقل الملكية ومنح الأدوار وإزالتها مع السبب والوقت.</p></div></div>
      {audit.length === 0 ? <p className="owner-empty">لا توجد تغييرات مسجلة بعد.</p> : <div className="owner-audit-list">{audit.map(entry => <article className="owner-audit-row" key={entry.id}><div><b>{entry.action === 'owner_bootstrap' ? 'تهيئة المالك الأول' : entry.action === 'owner_transferred' ? 'نقل ملكية المنصة' : entry.action === 'role_granted' ? 'منح دور' : entry.action === 'role_revoked' ? 'إزالة دور' : entry.action === 'account_suspended' ? 'تعليق حساب' : entry.action === 'account_restored' ? 'استعادة حساب' : `تغيير إعداد: ${entry.setting_key || 'منصة'}`}{entry.role ? ` · ${roleLabels[entry.role]}` : ''}{entry.action === 'setting_changed' ? ` · ${entry.setting_key === 'public_member_metric_visible' ? (entry.setting_value ? 'ظاهر' : 'مخفي') : entry.setting_key === 'public_member_metric_mode' ? (entry.setting_value === 'goal' ? 'هدف معلن' : 'عدد فعلي') : entry.setting_key === 'public_member_metric_goal' ? `هدف ${String(entry.setting_value)} عضو` : entry.setting_value ? 'مفعّل' : 'متوقف'}` : ''}</b><span dir="ltr">{entry.target_email}</span><small>{entry.reason}</small></div><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('ar')}</time></article>)}</div>}
      <p className="owner-footnote"><ArrowLeft size={13}/> استعادة كلمة مرور المالك تتم عبر رابط استعادة Supabase إلى البريد الموثّق. لا تُرسل كلمة مرور أو رمز دخول في المحادثة.</p>
    </section>
  </main>
}
