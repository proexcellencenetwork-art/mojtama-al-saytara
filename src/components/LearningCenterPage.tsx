import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowLeft, CalendarDays, Check, Clock3, ExternalLink, FileVideo2, Link2, LockKeyhole, Play, Radio, ShieldCheck, Trash2, Users, X } from 'lucide-react'
import type { Role } from '../appTypes'
import { isSupabaseConfigured } from '../lib/supabase-config'
import { supabase } from '../lib/supabase'
import './LearningCenter.css'

type WorkshopStatus = 'scheduled' | 'live' | 'ended' | 'recorded'
type Workshop = {
  id: string
  title: string
  description: string
  instructor_name: string
  scheduled_at: string
  duration_minutes: number
  cover_url: string | null
  audience_roles: Role[]
  status: WorkshopStatus
  external_link?: string | null
}
type LearningLink = {
  id: string
  title: string
  description: string
  url: string
  created_at: string
}
type Recording = {
  recording_id: string
  workshop_id: string
  title: string
  description: string
  instructor_name: string
  scheduled_at: string
  duration_minutes: number
  cover_url: string | null
  recording_duration_seconds: number | null
  recorded_at: string
}

const statusNames: Record<WorkshopStatus, string> = { scheduled: 'قادمة', live: 'مباشرة الآن', ended: 'انتهت', recorded: 'متاحة في المكتبة' }
const roleOptions: { id: Role; label: string }[] = [
  { id: 'member', label: 'الأعضاء' }, { id: 'verified', label: 'الموثّقون' },
  { id: 'coach', label: 'الكوتشات' }, { id: 'moderator', label: 'المشرفون' },
  { id: 'manager', label: 'المديرون' },
]
const canManage = (role: Role) => role === 'manager' || role === 'owner'
const localDateTime = (value: string) => new Date(value).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })
const mins = (seconds: number | null) => seconds ? `${Math.floor(seconds / 60)} دقيقة` : 'تسجيل ورشة'

function StateMessage({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'error' | 'success' }) {
  return <div className={`learning-state learning-state-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}

export default function LearningCenterPage({ role }: { role: Role }) {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [links, setLinks] = useState<LearningLink[]>([])
  const configured = Boolean(supabase && isSupabaseConfigured)
  const [loading, setLoading] = useState(configured)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(configured ? '' : 'يتطلب مركز التعلم إعداد اتصال Supabase أولاً.')
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<'workshops' | 'links' | 'library'>(() => {
    if (typeof window === 'undefined') return 'workshops'
    if (window.location.hash === '#library') return 'library'
    if (window.location.hash === '#links') return 'links'
    return 'workshops'
  })
  const [showForm, setShowForm] = useState(false)
  const [showLinkForm, setShowLinkForm] = useState(false)
  const [audience, setAudience] = useState<Role[]>(['member', 'verified', 'coach', 'moderator', 'manager'])
  const [form, setForm] = useState({ title: '', instructor_name: '', description: '', scheduled_at: '', duration_minutes: '60', external_link: '' })
  const [linkForm, setLinkForm] = useState({ title: '', description: '', url: '' })
  const navigate = useNavigate()

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) return
    setError('')
    // كل مصدر مستقل: فشل المكتبة أو الروابط لا يمنع عرض الورش
    const [workshopResult, recordingResult, linkResult] = await Promise.all([
      supabase.from('learning_workshops').select('id,title,description,instructor_name,scheduled_at,duration_minutes,cover_url,audience_roles,status,external_link').order('scheduled_at', { ascending: false }).limit(100),
      supabase.rpc('list_learning_library'),
      supabase.from('learning_links').select('id,title,description,url,created_at').order('created_at', { ascending: false }).limit(50),
    ])
    const firstError = workshopResult.error || recordingResult.error || linkResult.error
    if (firstError) {
      setError('تعذر تحميل بعض أقسام مركز التعلم. تحقق من تطبيق migration روابط التعلّم والورش وصلاحية الوصول.')
    }
    if (!workshopResult.error) setWorkshops((workshopResult.data || []) as Workshop[])
    if (!recordingResult.error) setRecordings((recordingResult.data || []) as Recording[])
    if (!linkResult.error) setLinks((linkResult.data || []) as LearningLink[])
    setLoading(false)
  }, [])

  useEffect(() => { void Promise.resolve().then(load) }, [load])

  const createWorkshop = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase || !canManage(role) || audience.length === 0) return
    setSaving(true); setError(''); setNotice('')
    const { error: createError } = await supabase.rpc('create_learning_workshop', {
      p_title: form.title,
      p_description: form.description,
      p_instructor_name: form.instructor_name,
      p_scheduled_at: new Date(form.scheduled_at).toISOString(),
      p_duration_minutes: Number(form.duration_minutes),
      p_cover_url: null,
      p_audience_roles: audience,
      p_external_link: form.external_link.trim() || null,
    })
    setSaving(false)
    if (createError) { setError('لم تُحفظ الورشة. تأكد من اكتمال الحقول وتطبيق migration مركز التعلم.'); return }
    setForm({ title: '', instructor_name: '', description: '', scheduled_at: '', duration_minutes: '60', external_link: '' })
    setShowForm(false)
    setNotice('تمت جدولة الورشة. يظهر محتواها للمستخدمين الموافق عليهم ضمن الجمهور الذي اخترته.')
    await load()
  }

  const createLink = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase || !canManage(role)) return
    const url = linkForm.url.trim()
    if (!/^https:\/\//i.test(url)) { setError('يجب أن يبدأ الرابط بـ https://'); return }
    setSaving(true); setError(''); setNotice('')
    const { error: createError } = await supabase.rpc('create_learning_link', {
      p_title: linkForm.title,
      p_url: url,
      p_description: linkForm.description,
    })
    setSaving(false)
    if (createError) { setError('لم يُحفظ رابط التعلّم. تحقق من تطبيق migration روابط التعلّم وصلاحيتك.'); return }
    setLinkForm({ title: '', description: '', url: '' })
    setShowLinkForm(false)
    setNotice('أُضيف رابط التعلّم. يظهر لجميع الأعضاء المعتمدين دون اشتراط جاهزية البث.')
    await load()
  }

  const removeLink = async (link: LearningLink) => {
    if (!supabase || !canManage(role)) return
    setSaving(true)
    const { error: removeError } = await supabase.rpc('delete_learning_link', { p_link_id: link.id })
    setSaving(false)
    if (removeError) { setError('تعذر حذف الرابط. تحقق من الصلاحية ثم أعد المحاولة.'); return }
    setLinks(current => current.filter(item => item.id !== link.id))
  }

  const startWorkshop = async (workshop: Workshop) => {
    if (!supabase || !canManage(role)) return
    setSaving(true); setError('')
    const { error: roomError } = await supabase.functions.invoke('learning-room', { body: { workshopId: workshop.id } })
    if (roomError) { setSaving(false); setError('لم تُجهّز غرفة الورشة. تحقق من إعداد 100ms وأسرار Supabase Edge Functions.'); return }
    const { error: statusError } = await supabase.rpc('set_learning_workshop_status', { p_workshop_id: workshop.id, p_next_status: 'live' })
    setSaving(false)
    if (statusError) { setError('الغرفة جاهزة، لكن تعذر تغيير حالة الورشة. أعد المحاولة أو تواصل مع المالك.'); return }
    navigate(`/learning-room/${workshop.id}`)
  }

  const openPlayback = async (recording: Recording) => {
    if (!supabase) return
    setSaving(true); setError('')
    const { data, error: playbackError } = await supabase.functions.invoke('learning-playback', { body: { recordingId: recording.recording_id } })
    setSaving(false)
    const url = data && typeof data.url === 'string' && data.url.startsWith('https://') ? data.url : ''
    if (playbackError || !url) { setError('تعذر إنشاء رابط مشاهدة خاص. تحقق من إعداد التخزين وصلاحية الحساب.'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const ordered = [...workshops].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  const canEnter = (item: Workshop) => item.status === 'live'
  return <main className="learning-page wrap" dir="rtl">
    <header className="learning-hero">
      <div><span className="eyebrow"><ShieldCheck size={14}/> مساحة تعليم مهني خاصة</span><h1>مركز التعلّم</h1><p>ورش حيّة ومسجّلة ضمن مجتمع مهني مغلق. الدخول متاح للحسابات المعتمدة والجمهور المحدد لكل ورشة.</p></div>
      <div className="learning-mark" aria-hidden="true"><Activity size={24}/><span>تعلّم<br/>معاً</span></div>
    </header>
    <div className="learning-notice"><LockKeyhole size={16}/><span>لا تشارك معلومات أو صور المرضى في البث أو المحادثة. دخول الغرف وروابط التسجيل محمية بصلاحية الحساب.</span></div><section className="learning-self-paced"><div><span className="eyebrow"><FileVideo2 size={14}/> ورشة ذاتية الآن</span><h2>اختراق LinkedIn: من ملف ساكن إلى أصل مهني</h2><p>وحدات وتمارين وقائمة تحقق وخطة 30 يوماً. هذه نسخة تعلم ذاتي؛ لا يوجد موعد بث أو تسجيل خارجي مجدول حالياً.</p></div><Link className="btn btn-outline btn-small" to="/linkedin-workshop">ابدأ الورشة الذاتية <ArrowLeft size={14}/></Link></section>
    {!isSupabaseConfigured && <StateMessage tone="error">لا يعمل مركز التعلم في وضع التجربة؛ لا تُنشأ جلسات أو حسابات وهمية.</StateMessage>}
    {error && <StateMessage tone="error">{error}</StateMessage>}
    {notice && <StateMessage tone="success"><Check size={15}/>{notice}</StateMessage>}
    <div className="learning-toolbar">
      <div className="learning-tabs" role="tablist" aria-label="أقسام مركز التعلم">
        <button type="button" role="tab" aria-selected={tab === 'workshops'} className={tab === 'workshops' ? 'active' : ''} onClick={() => setTab('workshops')}><CalendarDays size={16}/> الورش</button>
        <button type="button" role="tab" aria-selected={tab === 'links'} className={tab === 'links' ? 'active' : ''} onClick={() => setTab('links')}><Link2 size={16}/> روابط التعلّم <span>{links.length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}><FileVideo2 size={16}/> مكتبة التسجيلات <span>{recordings.length}</span></button>
      </div>
      <div className="learning-toolbar-actions">
        {canManage(role) && tab === 'workshops' && <button className="btn btn-primary btn-small" onClick={() => setShowForm(value => !value)}>{showForm ? <X size={16}/> : <CalendarDays size={16}/>} {showForm ? 'إغلاق' : 'جدولة ورشة'}</button>}
        {canManage(role) && tab === 'links' && <button className="btn btn-primary btn-small" onClick={() => setShowLinkForm(value => !value)}>{showLinkForm ? <X size={16}/> : <Link2 size={16}/>} {showLinkForm ? 'إغلاق' : 'إضافة رابط'}</button>}
      </div>
    </div>
    {showForm && canManage(role) && <form className="learning-form" onSubmit={createWorkshop}>
      <div className="learning-form-heading"><span className="eyebrow">إعداد جلسة جديدة</span><h2>جدولة ورشة مهنية</h2></div>
      <div className="learning-form-grid">
        <label>عنوان الورشة<input required minLength={3} maxLength={140} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="مثال: التوازن المهني أثناء المناوبات"/></label>
        <label>اسم المدرب/ة<input required minLength={2} maxLength={120} value={form.instructor_name} onChange={e => setForm({ ...form, instructor_name: e.target.value })} placeholder="الاسم الظاهر للمشاركين"/></label>
        <label>الموعد المحلي<input required type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })}/></label>
        <label>المدة المتوقعة بالدقائق<select value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })}>{[30,45,60,75,90,120,180].map(value => <option key={value} value={value}>{value} دقيقة</option>)}</select></label>
        <label className="learning-form-wide">رابط خارجي (اختياري)<input type="url" value={form.external_link} onChange={e => setForm({ ...form, external_link: e.target.value })} placeholder="https://meet.example.com/… — يُستخدم عند عدم جاهزية البث"/></label>
        <label className="learning-form-wide">وصف الورشة<textarea maxLength={6000} rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="الأهداف ومحاور النقاش. لا تُضمّن معلومات مرضى."/></label>
        <fieldset className="learning-audience learning-form-wide"><legend>الجمهور المسموح له بعد اعتماد الحساب</legend>{roleOptions.map(option => <label key={option.id}><input type="checkbox" checked={audience.includes(option.id)} onChange={e => setAudience(current => e.target.checked ? [...current, option.id] : current.filter(value => value !== option.id))}/>{option.label}</label>)}</fieldset>
      </div>
      <div className="learning-form-actions"><span>التسجيل الحي لا يتاح قبل ضبط أسرار 100ms وتخزين التسجيلات. يمكن استخدام الرابط الخارجي كبديل.</span><button className="btn btn-primary" disabled={saving || audience.length === 0}>{saving ? 'جارٍ الحفظ…' : 'حفظ الموعد'} <ArrowLeft size={15}/></button></div>
    </form>}
    {showLinkForm && canManage(role) && tab === 'links' && <form className="learning-form" onSubmit={createLink}>
      <div className="learning-form-heading"><span className="eyebrow">رابط تعلّم مستقل</span><h2>إضافة رابط تعلّم</h2></div>
      <div className="learning-form-grid">
        <label>عنوان الرابط<input required minLength={3} maxLength={140} value={linkForm.title} onChange={e => setLinkForm({ ...linkForm, title: e.target.value })} placeholder="مثال: ورشة LinkedIn على Zoom"/></label>
        <label>الرابط (https)<input required type="url" value={linkForm.url} onChange={e => setLinkForm({ ...linkForm, url: e.target.value })} placeholder="https://…"/></label>
        <label className="learning-form-wide">وصف (اختياري)<textarea maxLength={2000} rows={3} value={linkForm.description} onChange={e => setLinkForm({ ...linkForm, description: e.target.value })} placeholder="ما الذي يجده العضو في الرابط؟"/></label>
      </div>
      <div className="learning-form-actions"><span>يظهر الرابط لجميع الأعضاء المعتمدين فوراً دون اشتراط جاهزية البث.</span><button className="btn btn-primary" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ الرابط'} <ArrowLeft size={15}/></button></div>
    </form>}
    {loading ? <StateMessage>جارٍ تحميل الورش…</StateMessage> : tab === 'workshops' ? ordered.length === 0 ? <div className="learning-empty"><CalendarDays size={24}/><h2>لا توجد ورش مجدولة</h2><p>{canManage(role) ? 'أنشئ أول ورشة من زر «جدولة ورشة» أعلاه.' : 'تظهر الورش هنا عندما يجدولها مالك المنصة أو المدير.'}</p></div> : <div className="learning-grid">{ordered.map(item => <article className="learning-card" key={item.id}>
      <div className={`learning-card-art ${item.status === 'live' ? 'is-live' : ''}`}><span className={`learning-status status-${item.status}`}>{item.status === 'live' && <i/>}{statusNames[item.status]}</span><div className="learning-card-symbol"><Activity size={28}/></div></div>
      <div className="learning-card-body"><div className="learning-meta"><span><CalendarDays size={14}/>{localDateTime(item.scheduled_at)}</span><span><Clock3 size={14}/>{item.duration_minutes} دقيقة</span></div><h2>{item.title}</h2><p className="learning-instructor">المدرب/ة: {item.instructor_name}</p><p className="learning-description">{item.description || 'ورشة تعليمية مهنية لأعضاء مجتمع السيطرة.'}</p><div className="learning-card-actions">{canEnter(item) ? <button className="btn btn-primary btn-small" onClick={() => navigate(`/learning-room/${item.id}`)}><Play size={15}/> دخول الورشة</button> : item.status === 'recorded' ? <button className="btn btn-outline btn-small" onClick={() => setTab('library')}><FileVideo2 size={15}/> مشاهدة التسجيل</button> : canManage(role) && item.status === 'scheduled' ? <button className="btn btn-primary btn-small" disabled={saving} onClick={() => void startWorkshop(item)}><Radio size={15}/> {saving ? 'جارٍ التجهيز…' : 'بدء الورشة'}</button> : <span className="learning-access"><LockKeyhole size={14}/> {item.status === 'ended' ? 'سيظهر التسجيل بعد اكتماله' : 'بانتظار موعد الورشة'}</span>}{item.external_link && <a className="btn btn-outline btn-small" href={item.external_link} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> انضم عبر الرابط</a>}{canManage(role) && <small className="learning-audience-summary"><Users size={13}/> الجمهور: {item.audience_roles.map(id => roleOptions.find(option => option.id === id)?.label || id).join('، ')}</small>}</div></div>
    </article>)}</div> : tab === 'links' ? (links.length === 0 && !canManage(role) ? <div className="learning-empty"><Link2 size={24}/><h2>لا توجد روابط تعلّم بعد</h2><p>تظهر هنا روابط الورش والجلسات الخارجية التي يضيفها المالك أو المدير، وتكون متاحة لجميع الأعضاء المعتمدين.</p></div> : <div className="learning-links-grid">{links.map(link => <article className="learning-link-card" key={link.id}><div className="learning-link-icon"><Link2 size={22}/></div><div className="learning-link-body"><h2>{link.title}</h2>{link.description && <p>{link.description}</p>}<div className="learning-card-actions"><a className="btn btn-primary btn-small" href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> انضم عبر الرابط</a>{canManage(role) && <button className="icon-btn" aria-label={`حذف ${link.title}`} disabled={saving} onClick={() => void removeLink(link)}><Trash2 size={15}/></button>}</div></div></article>)}</div>) : recordings.length === 0 ? <div className="learning-empty"><FileVideo2 size={25}/><h2>مكتبة التسجيلات فارغة</h2><p>تظهر التسجيلات بعد انتهاء الورشة وتأكيد رفع الأصل إلى مخزن الفيديو.</p></div> : <div className="learning-grid">{recordings.map(recording => <article className="learning-card" key={recording.recording_id}><div className="learning-card-art archive-art"><span className="learning-status status-recorded">تسجيل متاح</span><div className="learning-card-symbol"><Play size={25}/></div></div><div className="learning-card-body"><div className="learning-meta"><span><CalendarDays size={14}/>{localDateTime(recording.scheduled_at)}</span><span><Clock3 size={14}/>{mins(recording.recording_duration_seconds)}</span></div><h2>{recording.title}</h2><p className="learning-instructor">المدرب/ة: {recording.instructor_name}</p><p className="learning-description">{recording.description || 'تسجيل ورشة مجتمع السيطرة.'}</p><button className="btn btn-primary btn-small" disabled={saving} onClick={() => void openPlayback(recording)}><Play size={15}/> مشاهدة خاصة <LockKeyhole size={13}/></button></div></article>)}</div>}
    <footer className="learning-footer"><span><ShieldCheck size={15}/> الوصول يظل محكوماً بصلاحيات Supabase وليس بإخفاء الروابط فقط.</span><Link to="/profile">العودة إلى مساحتي <ArrowLeft size={14}/></Link></footer>
  </main>
}
