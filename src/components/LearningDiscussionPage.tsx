import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock3, Radio, ShieldCheck } from 'lucide-react'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'
import { LearningDiscussionThread } from './LearningDiscussionThread'
import './LearningCenter.css'

type Workshop = {
  id: string
  title: string
  description: string
  instructor_name: string
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'live' | 'ended' | 'recorded'
}

function localDateTime(value: string) {
  return new Date(value).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function LearningDiscussionPage({
  userId,
  displayName,
}: {
  role: Role
  userId: string
  displayName: string
}) {
  const { id = '' } = useParams()
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      if (!supabase || !id) {
        setError('تعذر الاتصال بمركز التعلّم.')
        setLoading(false)
        return
      }
      try {
        const { data, error: queryError } = await supabase
          .from('learning_workshops')
          .select('id,title,description,instructor_name,scheduled_at,duration_minutes,status')
          .eq('id', id)
          .maybeSingle()
        if (!active) return
        if (queryError || !data) {
          setError('هذه الورشة غير متاحة لحسابك، أو أن صلاحية الوصول تحتاج إلى مراجعة.')
        } else {
          setWorkshop(data as Workshop)
        }
      } catch {
        if (active) setError('تعذر فتح الورشة حالياً. حدّث الصفحة وحاول مجدداً.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [id])

  if (loading) return <main className="learning-page wrap"><p role="status">جارٍ تحميل نقاش الورشة…</p></main>
  if (!workshop) return (
    <main className="learning-page wrap">
      <div className="learning-empty"><ShieldCheck size={26}/><h1>النقاش غير متاح</h1><p>{error || 'تعذر العثور على الورشة.'}</p><Link className="btn btn-outline btn-small" to="/learning">العودة إلى مركز التعلّم</Link></div>
    </main>
  )

  const live = workshop.status === 'live'
  return (
    <main className="learning-page learning-discussion-page wrap" dir="rtl">
      <nav className="breadcrumbs"><Link to="/learning">مركز التعلّم</Link><span>/</span><span>نقاش الورشة</span></nav>
      <header className="room-heading">
        <div>
          <span className={`learning-status status-${workshop.status}`}>{live ? 'البث مباشر الآن' : workshop.status === 'ended' || workshop.status === 'recorded' ? 'نقاش ومتابعة بعد الورشة' : 'نقاش الورشة مفتوح'}</span>
          <h1>{workshop.title}</h1>
          <p>المدرب/ة: {workshop.instructor_name} · <CalendarDays size={14}/> {localDateTime(workshop.scheduled_at)} · <Clock3 size={14}/> {workshop.duration_minutes} دقيقة</p>
          {workshop.description && <p className="learning-discussion-description">{workshop.description}</p>}
        </div>
        {live && <Link className="btn btn-primary btn-small" to={`/learning-room/${workshop.id}`}><Radio size={15}/> الانتقال إلى البث</Link>}
      </header>
      <div className="learning-notice"><ShieldCheck size={15}/><span>هذه مساحة النقاش والمتابعة الخاصة بالورشة. البث المرئي والصوتي في غرفة مستقلة، ويمكن العودة إلى هذا النقاش في أي وقت.</span></div>
      <LearningDiscussionThread workshopId={workshop.id} userId={userId} displayName={displayName}/>
      <footer className="learning-footer"><Link to="/learning"><ArrowRight size={14}/> جميع الورش والنقاشات</Link>{live && <Link to={`/learning-room/${workshop.id}`}>غرفة البث المباشر</Link>}</footer>
    </main>
  )
}
