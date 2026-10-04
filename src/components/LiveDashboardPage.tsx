import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, BadgeCheck, Check, FileText, MessageCircle, Shield, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'

type Row = Record<string, unknown>
type ProfileForm = { display_name: string; headline: string; profession: string; specialty: string; city: string; bio: string }
const emptyProfile: ProfileForm = { display_name: '', headline: '', profession: '', specialty: '', city: '', bio: '' }
const titles: Record<string, string> = { profile: 'الملف الشخصي', connections: 'الاتصالات', messages: 'الرسائل', notifications: 'الإشعارات', groups: 'المجموعات', verification: 'طلب التوثيق', moderation: 'لوحة الإشراف', admin: 'مراجعة الحسابات' }
const str = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const canReview = (role: Role) => role === 'moderator' || role === 'manager' || role === 'owner'

export function LiveDashboardPage({ page, role, userId }: { page: string; role: Role; userId: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [pendingAccounts, setPendingAccounts] = useState<Row[]>([])
  const [reportRows, setReportRows] = useState<Row[]>([])
  const [recipients, setRecipients] = useState<{ id: string; name: string }[]>([])
  const [selectedRecipient, setSelectedRecipient] = useState('')
  const [draftMessage, setDraftMessage] = useState('')
  const [profile, setProfile] = useState<ProfileForm>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [verification, setVerification] = useState({ full_name: '', profession: '', specialty: '', workplace: '', professional_registration_no: '' })

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true); setError(''); setRows([]); setPendingAccounts([])
    try {
      if (page === 'profile') {
        const { data, error: queryError } = await supabase.from('profiles').select('display_name,headline,profession,specialty,city,bio').eq('user_id', userId).maybeSingle()
        if (queryError) throw queryError
        if (data) setProfile({ display_name: str(data.display_name), headline: str(data.headline), profession: str(data.profession), specialty: str(data.specialty), city: str(data.city), bio: str(data.bio) })
      } else if (page === 'connections') {
        const { data, error: queryError } = await supabase.from('connections').select('id,requester_id,recipient_id,status,created_at').or(`requester_id.eq.${userId},recipient_id.eq.${userId}`).order('created_at', { ascending: false }).limit(100)
        if (queryError) throw queryError
        const connectionRows = (data ?? []) as Row[]
        const otherIds = [...new Set(connectionRows.map(row => str(row.requester_id) === userId ? str(row.recipient_id) : str(row.requester_id)))]
        const { data: people } = otherIds.length ? await supabase.from('profiles').select('user_id,display_name,headline,profession,city').in('user_id', otherIds) : { data: [] as Row[] }
        const names = new Map((people ?? []).map(person => [str(person.user_id), person]))
        setRows(connectionRows.map(row => ({ ...row, person: names.get(str(row.requester_id) === userId ? str(row.recipient_id) : str(row.requester_id)) })))
      } else if (page === 'messages') {
        const [{ data, error: queryError }, { data: accepted, error: connectionError }] = await Promise.all([
          supabase.from('messages').select('id,sender_id,recipient_id,body,created_at,read_at').or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).order('created_at', { ascending: false }).limit(100),
          supabase.from('connections').select('requester_id,recipient_id').eq('status', 'accepted').or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
        ])
        if (queryError) throw queryError
        if (connectionError) throw connectionError
        setRows((data ?? []) as Row[])
        const otherIds = [...new Set((accepted ?? []).map(row => str(row.requester_id) === userId ? str(row.recipient_id) : str(row.requester_id)))]
        const { data: people } = otherIds.length ? await supabase.from('profiles').select('user_id,display_name').in('user_id', otherIds) : { data: [] as Row[] }
        const names = new Map((people ?? []).map(person => [str(person.user_id), str(person.display_name, 'زميل مهني')]))
        const nextRecipients = otherIds.map(id => ({ id, name: names.get(id) || 'زميل مهني' }))
        setRecipients(nextRecipients)
        setSelectedRecipient(current => current || nextRecipients[0]?.id || '')
      } else if (page === 'notifications') {
        const { data, error: queryError } = await supabase.from('notifications').select('id,kind,body,created_at,is_read').eq('recipient_id', userId).order('created_at', { ascending: false }).limit(100)
        if (queryError) throw queryError
        setRows((data ?? []) as Row[])
      } else if (page === 'groups') {
        const [{ data, error: groupError }, { data: memberships, error: membershipError }] = await Promise.all([
          supabase.from('groups').select('id,name,description,topic,is_public,created_at').order('created_at', { ascending: false }).limit(100),
          supabase.from('group_memberships').select('group_id,status').eq('user_id', userId),
        ])
        if (groupError) throw groupError
        if (membershipError) throw membershipError
        const statuses = new Map((memberships ?? []).map(item => [str(item.group_id), str(item.status)]))
        setRows(((data ?? []) as Row[]).map(row => ({ ...row, membership_status: statuses.get(str(row.id)) ?? null })))
      } else if (page === 'verification') {
        const { data, error: queryError } = await supabase.from('verification_requests').select('id,full_name,profession,specialty,workplace,professional_registration_no,status,decision_reason,requested_at').eq('user_id', userId).order('requested_at', { ascending: false })
        if (queryError) throw queryError
        setRows((data ?? []) as Row[])
      } else if (page === 'moderation') {
        if (!canReview(role)) { setRows([]); setReportRows([]); return }
        const [{ data, error: queryError }, { data: reports, error: reportsError }] = await Promise.all([
          supabase.from('verification_requests').select('id,user_id,full_name,profession,specialty,status,document_path,requested_at').in('status', ['pending', 'more_information']).order('requested_at', { ascending: true }).limit(100),
          supabase.from('reports').select('id,reporter_id,target_type,target_id,reason,details,status,created_at').in('status', ['open', 'reviewing']).order('created_at', { ascending: true }).limit(100),
        ])
        if (queryError) throw queryError
        if (reportsError) throw reportsError
        setRows((data ?? []) as Row[])
        setReportRows((reports ?? []) as Row[])
      } else if (page === 'admin') {
        if (role !== 'manager' && role !== 'owner') { setRows([]); return }
        const [rolesResult, accountResult] = await Promise.all([
          supabase.from('user_roles').select('user_id,role,granted_at').order('granted_at', { ascending: false }).limit(500),
          supabase.rpc('list_pending_account_reviews'),
        ])
        if (rolesResult.error) throw rolesResult.error
        if (accountResult.error) throw accountResult.error
        setRows((rolesResult.data ?? []) as Row[])
        setPendingAccounts((accountResult.data ?? []) as Row[])
      }
    } catch {
      setError('تعذر تحميل هذه البيانات. تحقق من اتصال Supabase وسياسات RLS، ثم أعد المحاولة.')
    } finally {
      setLoading(false)
    }
  }, [page, role, userId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setNotice(''); setError('')
    const { error: updateError } = await supabase.from('profiles').update(profile).eq('user_id', userId)
    setBusy(false)
    if (updateError) setError('تعذر حفظ الملف.'); else setNotice('حُفظ ملفك الشخصي في قاعدة البيانات.')
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !file) { setError('اختر مستنداً مهنياً قبل الإرسال.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('الحد الأقصى لحجم الملف ١٠ ميغابايت.'); return }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowed.includes(file.type)) { setError('الملف المقبول: JPG أو PNG أو WebP أو PDF.'); return }
    setBusy(true); setNotice(''); setError('')
    const safeName = file.name.replace(/[^\p{L}\p{N}._-]/gu, '_').slice(-100) || 'document'
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`
    const { error: uploadError } = await supabase.storage.from('verification-private').upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) { setBusy(false); setError('تعذر رفع الملف الخاص.'); return }
    const { error: insertError } = await supabase.from('verification_requests').insert({ ...verification, user_id: userId, document_path: path })
    if (insertError) {
      await supabase.storage.from('verification-private').remove([path])
      setBusy(false); setError('تعذر إنشاء الطلب. أُزيل الملف المرفوع؛ تحقق من الحقول وحاول مجدداً.'); return
    }
    setBusy(false); setNotice('وصل طلب التوثيق. لن يستطيع تنزيل المستند إلا فريق الإشراف والمدير.'); setFile(null); setVerification({ full_name: '', profession: '', specialty: '', workplace: '', professional_registration_no: '' }); await load()
  }

  async function joinGroup(group: Row) {
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    const { error: insertError } = await supabase.from('group_memberships').insert({ group_id: group.id, user_id: userId, status: group.is_public ? 'active' : 'pending' })
    setBusy(false)
    if (insertError) setError('تعذر الانضمام. قد تكون المجموعة خاصة أو أن الطلب موجود مسبقاً.')
    else { setNotice(group.is_public ? 'انضممت إلى المجموعة.' : 'أُرسل طلب الانضمام للمراجعة.'); await load() }
  }

  async function changeConnection(row: Row, status: 'accepted' | 'declined') {
    if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('connections').update({ status }).eq('id', str(row.id)).eq('recipient_id', userId)
    setBusy(false)
    if (updateError) setError('تعذر تحديث طلب الاتصال.')
    else { setNotice(status === 'accepted' ? 'قُبل طلب الاتصال.' : 'رُفض طلب الاتصال.'); await load() }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !selectedRecipient || !draftMessage.trim()) return
    setBusy(true); setError(''); setNotice('')
    const [memberA, memberB] = [userId, selectedRecipient].sort()
    let { data: conversation, error: conversationError } = await supabase.from('conversations').select('id').eq('member_a', memberA).eq('member_b', memberB).maybeSingle()
    if (conversationError) { setBusy(false); setError('تعذر فتح المحادثة.'); return }
    if (!conversation) {
      const created = await supabase.from('conversations').insert({ member_a: memberA, member_b: memberB }).select('id').single()
      if (created.error && created.error.code !== '23505') { setBusy(false); setError('تعذر إنشاء المحادثة.'); return }
      if (created.data) conversation = created.data
      else {
        const retry = await supabase.from('conversations').select('id').eq('member_a', memberA).eq('member_b', memberB).maybeSingle()
        if (retry.error || !retry.data) { setBusy(false); setError('تعذر فتح المحادثة.'); return }
        conversation = retry.data
      }
    }
    const { error: insertError } = await supabase.from('messages').insert({ conversation_id: conversation.id, sender_id: userId, recipient_id: selectedRecipient, body: draftMessage.trim() })
    setBusy(false)
    if (insertError) { setError(insertError.message.includes('الحد اليومي') ? 'وصلت إلى حد الرسائل اليومي.' : 'تعذر إرسال الرسالة. تأكد أن الاتصال مقبول وأن الطرف الآخر لم يحظرك.'); return }
    setDraftMessage(''); setNotice('أُرسلت رسالتك الخاصة.'); await load()
  }

  async function markRead(row: Row) {
    if (!supabase) return
    const { error: updateError } = await supabase.from('notifications').update({ is_read: true }).eq('id', str(row.id)).eq('recipient_id', userId)
    if (updateError) setError('تعذر تحديث الإشعار.'); else setRows(current => current.map(item => item.id === row.id ? { ...item, is_read: true } : item))
  }

  async function reviewRequest(row: Row, decision: 'approved' | 'rejected') {
    if (!supabase) return
    const reason = decision === 'rejected' ? window.prompt('اكتب سبب الرفض (مطلوب):', 'يرجى إرفاق مستند مهني واضح وصالح.') : null
    if (decision === 'rejected' && !reason?.trim()) return
    setBusy(true); setError(''); setNotice('')
    const { error: rpcError } = await supabase.rpc('review_verification_request', { p_request_id: str(row.id), p_decision: decision, p_reason: reason })
    setBusy(false)
    if (rpcError) setError('تعذر تسجيل القرار.'); else { setNotice(decision === 'approved' ? 'اعتُمد الطلب وأُضيف دور التوثيق.' : 'سُجل الرفض ووُضع الملف في قائمة الحذف الآمن.'); await load() }
  }

  async function reviewAccount(row: Row, decision: 'approved' | 'rejected') {
    if (!supabase || (role !== 'manager' && role !== 'owner')) return
    const reason = decision === 'rejected' ? window.prompt('اكتب سبب رفض طلب الانضمام (مطلوب):', '') : null
    if (decision === 'rejected' && !reason?.trim()) return
    setBusy(true); setError(''); setNotice('')
    const { error: rpcError } = await supabase.rpc('review_account_application', {
      p_user_id: str(row.user_id), p_decision: decision, p_reason: reason,
    })
    setBusy(false)
    if (rpcError) setError('تعذر تسجيل قرار مراجعة الحساب.')
    else { setNotice(decision === 'approved' ? 'اعتُمد الحساب بعد تأكيد البريد.' : 'رُفض طلب الانضمام وسُجل السبب في سجل المراجعة.'); await load() }
  }

  async function updateReport(row: Row, status: 'reviewing' | 'resolved' | 'dismissed') {
    if (!supabase || !canReview(role)) return
    setBusy(true); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('reports').update({ status }).eq('id', str(row.id))
    setBusy(false)
    if (updateError) setError('تعذر تحديث حالة البلاغ.')
    else { setNotice('حُدّثت حالة البلاغ وسُجل المشرف المسؤول.'); await load() }
  }

  async function openPrivateDocument(row: Row) {
    if (!supabase) return
    const { data, error: signedError } = await supabase.storage.from('verification-private').createSignedUrl(str(row.document_path), 60)
    if (signedError || !data) { setError('تعذر فتح المستند الخاص.'); return }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const title = titles[page] || 'مساحتك المهنية'
  const staff = canReview(role)
  return <main className="app-main wrap"><div className="page-title-row"><div><span className="eyebrow">بيانات مرتبطة بحسابك</span><h1>{title}</h1></div><button className="btn btn-outline btn-small" onClick={() => void load()}>تحديث البيانات</button></div>
    <div className="dashboard-layout"><aside className="dash-nav"><Link to="/profile"><Users size={16}/> ملفي الشخصي</Link><Link to="/connections"><Users size={16}/> الاتصالات</Link><Link to="/messages"><MessageCircle size={16}/> الرسائل</Link><Link to="/groups"><Users size={16}/> المجموعات</Link><Link to="/notifications"><Check size={16}/> الإشعارات</Link><Link to="/verification"><BadgeCheck size={16}/> طلب التوثيق</Link>{staff && <Link to="/moderation"><Shield size={16}/> الإشراف</Link>}{(role === 'manager' || role === 'owner') && <Link to="/admin"><Shield size={16}/> مراجعة الحسابات</Link>}{role === 'owner' && <Link to="/owner"><Shield size={16}/> مركز المالك</Link>}<Link to="/settings">الإعدادات</Link></aside>
      <section className="dashboard-content">{notice && <div className="inline-message" role="status">{notice}</div>}{error && <div className="inline-message live-error" role="alert">{error}</div>}
        {loading ? <div className="panel-card live-state">جارٍ تحميل البيانات المرتبطة بحسابك…</div> : page === 'profile' ? <div className="panel-card"><div className="panel-icon"><Users/></div><h2>ملفك المهني</h2><p>هذه الحقول محفوظة في ملفك الخاص ويمكنك تعديلها.</p><form className="verification-form" onSubmit={saveProfile}><div className="form-grid"><label>الاسم المعروض<input required maxLength={100} value={profile.display_name} onChange={event => setProfile({ ...profile, display_name: event.target.value })}/></label><label>المهنة<input maxLength={100} value={profile.profession} onChange={event => setProfile({ ...profile, profession: event.target.value })}/></label><label>العنوان المهني<input maxLength={160} value={profile.headline} onChange={event => setProfile({ ...profile, headline: event.target.value })}/></label><label>التخصص<input maxLength={120} value={profile.specialty} onChange={event => setProfile({ ...profile, specialty: event.target.value })}/></label><label>المدينة<input maxLength={100} value={profile.city} onChange={event => setProfile({ ...profile, city: event.target.value })}/></label><label className="full-field">نبذة مهنية<textarea maxLength={1200} value={profile.bio} onChange={event => setProfile({ ...profile, bio: event.target.value })}/></label></div><button className="btn btn-primary" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ الملف'}</button></form></div>
        : page === 'verification' ? <div className="panel-card"><div className="panel-icon gold"><BadgeCheck/></div><h2>طلب التوثيق المهني</h2><p>يُخزن الملف في bucket خاص. لا يُسمح إلا للمشرفين والمدير بتنزيله.</p>{rows.map(row => <div className="review-row" key={str(row.id)}><div><b>{str(row.profession)} · {str(row.full_name)}</b><small>{str(row.status)} · {new Date(str(row.requested_at)).toLocaleDateString('ar')}</small>{Boolean(row.decision_reason) && <small>{str(row.decision_reason)}</small>}</div></div>)}<form className="verification-form" onSubmit={event => void submitVerification(event)}><div className="form-grid"><label>الاسم الكامل<input required minLength={2} maxLength={160} value={verification.full_name} onChange={event => setVerification({ ...verification, full_name: event.target.value })}/></label><label>المهنة<input required minLength={2} maxLength={120} value={verification.profession} onChange={event => setVerification({ ...verification, profession: event.target.value })}/></label><label>التخصص<input maxLength={160} value={verification.specialty} onChange={event => setVerification({ ...verification, specialty: event.target.value })}/></label><label>جهة العمل<input maxLength={200} value={verification.workplace} onChange={event => setVerification({ ...verification, workplace: event.target.value })}/></label><label className="full-field">رقم التسجيل أو التصنيف المهني<input required minLength={2} maxLength={100} value={verification.professional_registration_no} onChange={event => setVerification({ ...verification, professional_registration_no: event.target.value })}/></label><label className="file-field full-field">مستند مهني خاص<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={event => setFile(event.target.files?.[0] ?? null)}/><small>JPG أو PNG أو WebP أو PDF، بحد أقصى ١٠ ميغابايت. لا ترفع أي بيانات تخص المرضى.</small></label></div><button className="btn btn-primary" disabled={busy}>{busy ? 'جارٍ رفع الطلب…' : 'إرسال للمراجعة'} <ArrowLeft size={15}/></button></form></div>
        : page === 'connections' ? <div className="panel-card"><h2>اتصالاتك</h2>{rows.length === 0 ? <p>لا توجد اتصالات أو طلبات مسجلة بعد.</p> : rows.map(row => { const person = row.person as Row | undefined; const incoming = str(row.recipient_id) === userId; return <div className="review-row" key={str(row.id)}><div><b>{str(person?.display_name, 'عضو في المجتمع')}</b><small>{str(person?.headline || person?.profession, 'مهني صحي')} · {str(row.status)}</small></div>{incoming && row.status === 'pending' && <span className="live-actions"><button className="btn btn-small btn-primary" disabled={busy} onClick={() => void changeConnection(row, 'accepted')}>قبول</button><button className="btn btn-small btn-outline" disabled={busy} onClick={() => void changeConnection(row, 'declined')}>رفض</button></span>}</div> })}</div>
        : page === 'messages' ? <div className="panel-card"><div className="panel-icon"><MessageCircle/></div><h2>رسائلك الخاصة</h2><p>يمكنك مراسلة اتصال مقبول. سيطبق الخادم حدود المعدل ويتحقق من الحظر وصلاحية المحادثة.</p><form className="verification-form message-compose" onSubmit={event => void sendMessage(event)}><label>إلى<select required value={selectedRecipient} onChange={event => setSelectedRecipient(event.target.value)}><option value="">اختر اتصالاً مقبولاً</option>{recipients.map(person => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label><label>الرسالة<textarea required maxLength={5000} value={draftMessage} onChange={event => setDraftMessage(event.target.value)} placeholder="رسالة مهنية خاصة…"/></label><button className="btn btn-primary" disabled={busy || !selectedRecipient || !draftMessage.trim()}>{busy ? 'جارٍ الإرسال…' : 'إرسال الرسالة'} <ArrowLeft size={15}/></button>{recipients.length === 0 && <small>لا توجد اتصالات مقبولة بعد. يمكنك قبول اتصال من صفحة الاتصالات أولاً.</small>}</form>{rows.length === 0 ? <p>لا توجد رسائل لهذا الحساب بعد.</p> : rows.map(row => <div className="message-thread" key={str(row.id)}><span className="avatar avatar-0 avatar-md">{str(row.sender_id) === userId ? 'أنا' : 'ز'}</span><span><b>{str(row.sender_id) === userId ? 'رسالة أرسلتها' : 'رسالة واردة'}</b><small>{str(row.body)}</small><small>{new Date(str(row.created_at)).toLocaleString('ar')}</small></span></div>)}</div>
        : page === 'notifications' ? <div className="panel-card"><div className="panel-icon"><Check/></div><h2>إشعاراتك</h2>{rows.length === 0 ? <p>لا توجد إشعارات.</p> : rows.map(row => <div className={`review-row ${row.is_read ? '' : 'notification-unread'}`} key={str(row.id)}><div><b>{str(row.body, 'إشعار من المجتمع')}</b><small>{new Date(str(row.created_at)).toLocaleString('ar')} · {str(row.kind)}</small></div>{!row.is_read && <button className="btn btn-small btn-outline" onClick={() => void markRead(row)}>تحديد كمقروء</button>}</div>)}</div>
        : page === 'groups' ? <div className="panel-card"><div className="panel-icon"><Users/></div><h2>مجموعات المجتمع</h2>{rows.length === 0 ? <p>لا توجد مجموعات عامة منشورة بعد.</p> : rows.map(row => <div className="review-row" key={str(row.id)}><div><b>{str(row.name)}</b><small>{str(row.topic)} · {row.is_public ? 'عامة' : 'خاصة'}</small><small>{str(row.description)}</small></div>{row.membership_status ? <span className="status-pill">{str(row.membership_status)}</span> : <button className="btn btn-small btn-outline" disabled={busy} onClick={() => void joinGroup(row)}>انضمام</button>}</div>)}</div>
        : page === 'moderation' ? !staff ? <div className="panel-card"><h2>صلاحية غير متاحة</h2><p>تظهر أدوات المراجعة للمشرفين والمدير فقط.</p></div> : <div className="panel-card"><div className="panel-icon"><Shield/></div><h2>مركز الإشراف</h2><h3>البلاغات المفتوحة</h3>{reportRows.length === 0 ? <p>لا توجد بلاغات مفتوحة.</p> : reportRows.map(row => <div className="review-row" key={str(row.id)}><div><b>{str(row.reason)} · {str(row.target_type)}</b><small>{str(row.details)} · {str(row.status)}</small><small>المعرف: {str(row.target_id)}</small></div><span className="live-actions"><button className="btn btn-small btn-outline" disabled={busy} onClick={() => void updateReport(row, 'reviewing')}>قيد المراجعة</button><button className="btn btn-small btn-primary" disabled={busy} onClick={() => void updateReport(row, 'resolved')}>حلّ</button><button className="btn btn-small btn-outline" disabled={busy} onClick={() => void updateReport(row, 'dismissed')}>إغلاق</button></span></div>)}<h3>طلبات التوثيق</h3>{rows.length === 0 ? <p>لا توجد طلبات توثيق معلقة.</p> : rows.map(row => <div className="review-row" key={str(row.id)}><div><b>{str(row.full_name)} · {str(row.profession)}</b><small>{str(row.specialty)} · {new Date(str(row.requested_at)).toLocaleString('ar')}</small></div><span className="live-actions"><button className="btn btn-small btn-outline" onClick={() => void openPrivateDocument(row)}><FileText size={13}/> عرض المستند</button><button className="btn btn-small btn-primary" disabled={busy} onClick={() => void reviewRequest(row, 'approved')}>اعتماد</button><button className="btn btn-small btn-outline" disabled={busy} onClick={() => void reviewRequest(row, 'rejected')}>رفض</button></span></div>)}</div>

        : page === 'admin' ? role !== 'manager' && role !== 'owner' ? <div className="panel-card"><h2>صلاحية غير متاحة</h2><p>مراجعة الحسابات متاحة للمدير ومالك المنصة.</p></div> : <div className="panel-card"><div className="panel-icon"><Shield/></div><h2>مراجعة الحسابات</h2><p>لا يظهر في قائمة المراجعة إلا من أكّد بريده. الحسابات الجديدة لا تصل إلى بيانات الأعضاء حتى اعتماد المدير.</p><h3>طلبات الانضمام</h3>{pendingAccounts.length === 0 ? <p>لا توجد حسابات مؤكدة تنتظر المراجعة.</p> : pendingAccounts.map(row => <div className="review-row" key={str(row.user_id)}><div><b>{str(row.display_name, 'عضو جديد')}</b><small>{str(row.email)} · {str(row.profession, 'مهنة غير محددة')} · {str(row.specialty, 'دون تخصص')}</small><small>{new Date(str(row.created_at)).toLocaleDateString('ar')}</small></div><span className="live-actions"><button className="btn btn-small btn-primary" disabled={busy} onClick={() => void reviewAccount(row, 'approved')}>اعتماد الحساب</button><button className="btn btn-small btn-outline" disabled={busy} onClick={() => void reviewAccount(row, 'rejected')}>رفض</button></span></div>)}<h3>الأدوار المسجلة</h3><p>عرض للقراءة فقط؛ تغيير الأدوار متاح لمالك المنصة عبر مركز المالك.</p>{rows.length === 0 ? <p>لا توجد أدوار بعد.</p> : rows.map((row, index) => <div className="review-row" key={`${str(row.user_id)}-${index}`}><div><b>{str(row.role)}</b><small>{str(row.user_id)} · {new Date(str(row.granted_at)).toLocaleDateString('ar')}</small></div></div>)}</div>
        : <div className="panel-card"><h2>{title}</h2><p>هذه الصفحة تعرض بيانات قاعدة البيانات الفعلية فقط.</p></div>}
      </section>
    </div>
  </main>
}
