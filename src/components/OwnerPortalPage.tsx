import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, BadgeCheck, RefreshCw, Send, ShieldCheck, UserCog, UserPlus } from 'lucide-react'
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
}
type OwnerAudit = {
  id: number
  actor_id: string
  target_user_id: string | null
  target_email: string
  action: 'owner_bootstrap' | 'role_granted' | 'role_revoked' | string
  role: ManagedRole | null
  setting_key: string | null
  setting_value: boolean | null
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

export function OwnerPortalPage({ role }: { role: Role }) {
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

  const eligibleAccounts = useMemo(
    () => accounts.filter(account => account.email_confirmed && account.account_status === 'approved' && !account.is_platform_owner),
    [accounts],
  )

  const load = useCallback(async () => {
    if (role !== 'owner') {
      setAuthorized(false)
      setLoading(false)
      return
    }
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
      setLoading(false)
      if (ownerCheck.error) setError('تعذر التحقق من صلاحية المالك. أعد المحاولة بعد اكتمال التهيئة.')
      return
    }
    setAuthorized(true)
    const [accountsResult, auditResult, invitationSettingResult] = await Promise.all([
      supabase.rpc('list_platform_accounts'),
      supabase.rpc('list_platform_owner_audit', { p_limit: 50 }),
      supabase.rpc('is_owner_invitations_enabled'),
    ])
    if (accountsResult.error || auditResult.error || invitationSettingResult.error) {
      setError('تعذر تحميل لوحة المالك. تحقّق من تطبيق migration ثم أعد المحاولة.')
      setAccounts([])
      setAudit([])
    } else {
      setOwnerInvitationsEnabled(invitationSettingResult.data === true)
      const nextAccounts = safeRows<PlatformAccount>(accountsResult.data)
      setAccounts(nextAccounts)
      setAudit(safeRows<OwnerAudit>(auditResult.data))
      setTarget(current => current && nextAccounts.some(account => account.user_id === current && account.email_confirmed && account.account_status === 'approved' && !account.is_platform_owner)
        ? current
        : nextAccounts.find(account => account.email_confirmed && account.account_status === 'approved' && !account.is_platform_owner)?.user_id || '')
    }
    setLoading(false)
  }, [role])

  useEffect(() => { void load() }, [load])

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

  if (role !== 'owner') return <main className="app-main wrap owner-portal"><section className="owner-card owner-denied"><ShieldCheck size={30}/><h1>صلاحية المالك فقط.</h1><p>لا تُتاح أدوات المالك للمدير أو للأعضاء.</p></section></main>
  if (loading && authorized === null) return <main className="app-main wrap owner-portal"><section className="owner-card" role="status">جارٍ التحقق من صلاحية المالك…</section></main>
  if (authorized !== true) return <main className="app-main wrap owner-portal"><section className="owner-card owner-denied"><ShieldCheck size={30}/><h1>تعذر إثبات صلاحية المالك.</h1><p>{error || 'لا تملك هذه الصفحة صلاحية إدارة المنصة.'}</p><button className="btn btn-outline" type="button" onClick={() => void load()}><RefreshCw size={15}/> إعادة التحقق</button></section></main>

  return <main className="app-main wrap owner-portal" dir="rtl">
    <div className="page-title-row owner-heading"><div><span className="eyebrow">صلاحية منفصلة عن المدير</span><h1>مركز مالك المنصة</h1><p>هذه الأدوات تتحقق من المالك في قاعدة البيانات، ولا تكفي معرفة رابط الصفحة للوصول إليها.</p></div><button className="btn btn-outline btn-small" type="button" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={15}/> تحديث</button></div>
    {notice && <div className="inline-message" role="status">{notice}</div>}
    {error && <div className="inline-message live-error" role="alert">{error}</div>}
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
      <div className="owner-setting-row"><div><b>التسجيل العام</b><small>مفتوح. تأكيد البريد إلزامي، وكل حساب جديد يبقى قيد المراجعة حتى موافقة المالك أو المدير.</small></div><span className="owner-pill owner-setting-on">مفتوح</span></div>
      <p className="owner-note">إنشاء الحساب لا يمنح صلاحيات العضوية أو النشر تلقائياً؛ تظل الموافقة الإدارية مطلوبة.</p>
    </section>

    <section className="owner-card owner-wide-card">
      <div className="owner-card-heading"><span><ShieldCheck size={18}/></span><div><h2>الحسابات</h2><p>البيانات المعروضة محدودة لمالك المنصة، ومؤكدة عبر RPC محمي في قاعدة البيانات.</p></div></div>
      {loading ? <p role="status">جارٍ تحميل الحسابات…</p> : accounts.length === 0 ? <p className="owner-empty">لا توجد حسابات ظاهرة.</p> : <div className="owner-account-list">{accounts.map(account => <article className="owner-account" key={account.user_id}>
        <div className="owner-account-main"><b>{account.display_name || 'عضو جديد'}</b><span dir="ltr">{account.email}</span><small>{account.email_confirmed ? 'البريد مؤكد' : 'البريد غير مؤكد'} · {statusLabels[account.account_status] || account.account_status} · {new Date(account.created_at).toLocaleDateString('ar')}</small></div>
        <div className="owner-role-pills">{account.is_platform_owner ? <span className="owner-pill owner-pill-root">مالك المنصة</span> : account.roles.map(value => <span className="owner-pill" key={value}>{value === 'owner' ? 'مالك المنصة' : value in roleLabels ? roleLabels[value as ManagedRole] : 'عضو'}</span>)}{!account.is_platform_owner && account.email_confirmed && (account.account_status === 'approved' || account.account_status === 'rejected') && <button className="btn btn-outline btn-small" type="button" disabled={busy} onClick={() => void changeAccountAccess(account)}>{account.account_status === 'approved' ? 'تعليق الوصول' : 'استعادة الوصول'}</button>}</div>
      </article>)}</div>}
    </section>

    <section className="owner-card owner-wide-card">
      <div className="owner-card-heading"><span><ShieldCheck size={18}/></span><div><h2>سجل تغييرات المالك</h2><p>تُسجل عمليات نقل الملكية ومنح الأدوار وإزالتها مع السبب والوقت.</p></div></div>
      {audit.length === 0 ? <p className="owner-empty">لا توجد تغييرات مسجلة بعد.</p> : <div className="owner-audit-list">{audit.map(entry => <article className="owner-audit-row" key={entry.id}><div><b>{entry.action === 'owner_bootstrap' ? 'تهيئة المالك الأول' : entry.action === 'owner_transferred' ? 'نقل ملكية المنصة' : entry.action === 'role_granted' ? 'منح دور' : entry.action === 'role_revoked' ? 'إزالة دور' : entry.action === 'account_suspended' ? 'تعليق حساب' : entry.action === 'account_restored' ? 'استعادة حساب' : `تغيير إعداد: ${entry.setting_key || 'منصة'}`}{entry.role ? ` · ${roleLabels[entry.role]}` : ''}{entry.action === 'setting_changed' ? ` · ${entry.setting_value ? 'مفعّل' : 'متوقف'}` : ''}</b><span dir="ltr">{entry.target_email}</span><small>{entry.reason}</small></div><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('ar')}</time></article>)}</div>}
      <p className="owner-footnote"><ArrowLeft size={13}/> استعادة كلمة مرور المالك تتم عبر رابط استعادة Supabase إلى البريد الموثّق. لا تُرسل كلمة مرور أو رمز دخول في المحادثة.</p>
    </section>
  </main>
}
