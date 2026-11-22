import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Check, Clock3, ExternalLink, LockKeyhole, MessageCircle, Radio, ShieldCheck, Users, X } from 'lucide-react'
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
  resource_url: string | null
  audience_roles: Role[]
  status: WorkshopStatus
}
const statusNames: Record<WorkshopStatus, string> = {
  scheduled: 'ورشة قادمة',
  live: 'البث مباشر الآن',
  ended: 'انتهت الورشة · النقاش مستمر',
  recorded: 'الورشة مسجلة · النقاش مستمر',
}
const roleOptions: { id: Role; label: string }[] = [
  { id: 'member', label: 'الأعضاء' }, { id: 'verified', label: 'الموثّقون' },
  { id: 'coach', label: 'الكوتشات' }, { id: 'moderator', label: 'المشرفون' },
  { id: 'manager', label: 'المديرون' },
]
const canManage = (role: Role) => role === 'manager' || role === 'owner'
const canCreateWorkshop = (role: Role) => canManage(role) || role === 'coach'
const localDateTime = (value: string) => new Date(value).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })

function StateMessage({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'error' | 'success' }) {
  return <div className={`learning-state learning-state-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children]</div>
}

export default function LearningCenterPage({ role }: { role: Role }) {
  const [workshops, setWorkshops] = useState<Workshop[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(isSupabaseConfigured ? '' : 'يتطلب مركز التعلّم اتصال Supabase وتسجيل الدخول بحساب معتمد.')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [audience, setAudience] = useState<Role[]>(() => role === 'coach' ? ['member', 'verified', 'coach'] : ['member', 'verified', 'coach', 'moderator', 'manager'])
  const [form, setForm] = useState({ title: '', instructor_name: '', description: '', scheduled_at: '', duration_minutes: '60', resource_url: '' })
  const navigate = useNavigate()

  const load = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setLoading(false)
      setError('تعذر الاتصال بخدمة مركز التعلّم. أعد المحاولة أو تواصل مع إدارة المجتمع.')
      return
    }
    try {
      const { data, error: queryError } = await supabase
        .from('learning_workshops')
        .select('id,title,description,instructor_name,scheduled_at,duration_minutes,resource_url,audience_roles,status')
        .order('scheduled_at', { ascending: false })
        .limit(100)
      if (queryError) {
        setError('تعذر تحميل الورش. تحقق من اعتماد الحساب وصلاحية الوصول، ثم أعد المحاولة.')
        setWorkshops([])
      } else {
        setError('')
        setWorkshops((data || []) as Workshop[])
      }
    } catch {
      setError('حدث خطأ اتصال أثناء تحميل الورش. أعد المحاولة.')
      setWorkshops([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const createWorkshop = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !canCreateWorkshop(role) || audience.length === 0) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const { error: createError } = await supabase.rpc('create_learning_workshop', {
        p_title: form.title.trim(),
        p_description: form.description.trim(),
        p_instructor_name: form.instructor_name.trim(),
        p_scheduled_at: new Date(form.scheduled_at).toISOString(),
        p_duration_minutes: Number(form.duration_minutes),
        p_cover_url: null,
        p_audience_roles: audience,
        p_resource_url: form.resource_url.trim() || null,
      })
      if (createError) {
        setError('لم تُحفظ الورشة. راجع الحقول وتأكد من أن دور حسابك يسمح بإنشاء الورش.')
        return
      }
      setForm({ title: '', instructor_name: '', description: '', scheduled_at: '', duration_minutes: '60', resource_url: '' })
      setShowForm(false)
      setNotice('تمت جدولة الورشة. أصبح لها نقاش دائم قبل البث وبعده.')
      await load()
    } catch {
      setError('حدث خطأ أثناء حفظ الورشة. أعد المحاولة.')
    } finally {
      setSaving(false)
    }
  }

  const startWorkshop = async (workshop: Workshop) => {
    if (!supabase || !canManage(role)) return
    setSaving(true)
    setError('')
    try {
      const { error: roomError } = await supabase.functions.invoke('learning-room', { body: { workshopId: workshop.id } })
      if (roomError) {
        setError('لم تُجهّز غرفة البث. تحقق من إعداد 100ms وأسرار Supabase Edge Functions.')
        return
      }
      const { error: statusError } = await supabase.rpc('set_learning_workshop_status', {
        p_workshop_id: workshop.id, p_next_status: 'live',
      })
      if (statusError) {
        setError('الغرفة جاهزة، لكن تعذر تحديث حالة الورشة. أعد المحاولة أو تواصل مع المالك.')
        return
      }
      navigate(`/learning-room/${workshop.id}`)
    } catch {
      setError('حدث خطأ أثناء تجهيز البث. تحقق من إعداد 100ms ثم أعد المحاولة.')
    } finally {
      setSaving(false)
    }
  }

  const ordered = [...workshops].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  return (
    <main className="learning-page wrap" dir="rtl">
      <header className="learning-hero">
        <div>
          <span className="eyebrow"><MessageCircle size={14}/> مساحة النقاش والمتابعة</span>
          <h1>مركز التعلّم</h1>
          <p>كل ورشة لها مساحة رسائل مستقلة. اطرح سؤالك قبل اللقاء، وشارك أثناء البث، وارجع للنقاش بعد انتهاء الورشة.</p>
        </div>
        <div className="learning-mark" aria-hidden="true"><MessageCircle size={25}/><span>نتعلّم<br/>بالحوار</span></div>
      </header>
      <div className="learning-notice"><LockKeyhole size={16}/><span>النقاش متاح للحسابات المعتمدة التي يشملها جمهور الورشة. لا تشارك بيانات المرضى أو المعلومات المهنية السرية.</span></div>
      <div className="learning-toolbar">
        <div><span className="eyebrow"><CalendarDays size={14}/> الورش والنقاشات</span><h2 className="learning-section-title">اختر الورشة وابدأ المشاركة</h2></div>
        <div className="learning-toobar-actions">
          <button type="button" className="btn btn-outline btn-small" onClick={() => void load()} disabled={loading}><CalendarDays size={15}/> ححعسنياطةي القائمة</button>
          {canCreateWorkshop(role) && <button type="button" className="btn btn-primary btn-small" onClick={() => setShowForm(value => !value)}>{showForm ? <X size={16}/> : <CalendarDays size={16}/>} {showForm ? 'إغلاق' : role === 'coach' ? 'إضافة ورشة' : 'جدولة ورشة'}</button>}
        </div>
      </div>
      {showForm && canCreateWorkshop(role) && <form className="learning-form" onSubmit={createWorkshop}>
        <div className="learning-form-heading"><span className="eyebrow">إعداد جلسة جديدة</span><h2>{role === 'coach' ? 'إضافة ورشة أو قناة خاصة' : 'جدولة ورشة مهنية'}</h2><p>سيُنشأ نقاش دائم للورشة، ورابط البث يبقى في غرفة مستقلة. روابط HTTPS فقط.</p></div>
        <div className="learning-form-grid">
          <label>عنوان الورشة<input required minLength={3} maxLength={140} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="عنوان واضح للورشة"/></label>
          <label>اسم المدرب/ة<input required minLength={2} maxLength={120} value={form.instructor_name} onChange={event => setForm({ ...form, instructor_name: event.target.value })} placeholder="الاسم الظاهر للمشاركين"/></label>
          <label>الموعد المحلي<input required type="datetime-local" value={form.scheduled_at} onChange={event => setForm({ ...form, scheduled_at: event.target.value })}/></label>
          <label>المدة المتوقعة بالدقائق<select value={form.duration_minutes} onChange={event => setForm({ ...form, duration_minutes: event.target.value })}>{[30,45,60,75,90,120,180].map(value => <option key={value} value={value}>{value} دقيقة</option>)}</select></label>
          <label className="learning-form-wide">رابط الورشة الخارجية (اختياري)<input type="url" pattern="https://.*" maxLength={2000} value={form.resource_url} onChange={event => setForm({ ...form, resource_url: event.target.value })} placeholder="https://…"/></label>
          <label className="learning-form-wide">وصف الورشة ومحاور النقاش<textarea maxLength={6000} rows={4} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="الأهداف ومحاور النقاش. لا تُضمّن معلومات مرضى."/></label>
          <fieldset className="learning-audience learning-form-wide"><legend>الأعضاء المسموح لهم بالنقاش</legend>{roleOptions.filter(option => canManage(role) || !['moderator','manager'].includes(option.id)).map(option => <label key={option.id}><input type="checkbox" checked={audience.includes(option.id)} onChange={event => setAudience(current => event.target.checked ? [...current, option.id] : current.filter(value => value !== option.id))}/>{option.label}</label>)}</fieldset>
        </div>
        <div className="learning-form-actions"><span>كل مشارك معتمد ضمن الجمهور يستطيع إرسال الرسائل.</span><button className="btn btn-primary" disabled={saving || audience.length === 0}>{saving ? 'جارٍ الحفظ…' : 'حفظ الورشة'} <ArrowLeft size={15}/></button></div>
      </form>}
      {error && <StateMessage tone="error">{error}</StateMessage>}
      {notice && <StateMessage tone="success"><Check size={15}/>{notice}</StateMessage>}
      {loading ? <StateMessage>جارٍ تحميل الورش…</StateMessage> : ordered.length === 0 ? (
        <div className="learning-empty"><CalendarDays size={24}/><h2>لا توجد ورش متاحة حالياً</h2><p>{canCreateWorkshop(role) ? 'أنشئ أول ورشة ليكون لها نقاش دائم.' : 'ستظهر هنا الورش التي ينشرها الكوتش أو إدارة المجتمع.'}</p></div>
      ) : (
        <div className="learning-grid">{ordered.map(item => (
          <article className="learning-card" key={item.id}>
            <div className={`learning-card-art ${item.status === 'live' ? 'is-live' : ''}`}>
              <span className={`learning-status status-${item.status}`}>{item.status === 'live' && <i/>}{statusNames[item.status]}</span>
              <div className="learning-card-symbol"><MessageCircle size={27}/></div>
            </div>
            <div className="learning-card-body">
              <div className="learning-meta"><span><CalendarDays size={14}/>{localDateTime(item.scheduled_at)}</span><span><Clock3 size={14}/>{item.duration_minutes} دقيقة</span></div>
              <h2>{item.title}</h2>
              <p className="learning-instructor">المدرب/ة: {item.instructor_name}</p>
              <p className="learning-description">{item.description || 'ورشة مهنية ضمن مجتمع السيطرة.'}</p>
              <div className="learning-card-actions">
                <Link className="btn btn-primary btn-small" to={`/learning-discussion/${item.id}`}><MessageCircle size={15}/> فتح النقاش والمتابعة</Link>
                {item.status === 'live' && <Link className="btn btn-outline btn-small" to={`/learning-room/${item.id}`}><Radio size={15}/> غرفة البث</Link>}
                {canManage(role) && item.status === 'scheduled' && <button className="btn btn-outline btn-small" disabled={saving} onClick={() => void startWorkshop(item)}><Radio size={15}/>{saving ? 'جارٍ التجهيز…' : 'بدء البث'}</button>}
                {item.resource_url && <a className="btn btn-outline-btn-small" href={item.resource_url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> رابط خارجي</a>}
                {canCreateWorkshop(role) && <small className="learning-audience-summary"><Users size={13}/> الجمهور: {item.audience_roles.map(id => roleOptions.find(option => option.id === id)?.label || id).join('، ')}</small>}
              </div>
            </div>
          </article>
        ))}</div>
      )}
      <div className="learning-exercise-link">
        <div><span className="eyebrow"><ShieldCheck size={14}/> مساحة مستقلة</span><h2>التطبيقات المهنية</h2><p>التمارين وبطاقات إثبات الأثر موجودة في مساحة مستقلة عن نقاشات الورش.</p></div>
        <Link className="btn btn-outline-btn-small" to="/learning-exercise">فتح التطبيقات <ArrowLeft size={14}/></Link>
      </div>
      <footer className="learning-footer"><span><ShieldCheck size={15}/> الصلاحيات محفوظة في قاعدة البيانات؛ لا يعتمد الوصول على إخفاء الروابط.</span><Link to="/feed">العودة إلى مساحتي <ArrowLeft size={14}/></Link></footer>
    </main>
  )
}
