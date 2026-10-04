import { useEffect, useState } from 'react'
import { ArrowLeft, CalendarDays, FileText, HeartHandshake } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type PublicRow = Record<string, unknown>
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback

export function LivePublicPage({ page }: { page: string }) {
  const [rows, setRows] = useState<PublicRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) { setLoading(false); return }
      setLoading(true); setError('')
      let data: PublicRow[] | null = null
      let queryError: { message: string } | null = null
      if (page === 'coaches') {
        const result = await supabase.from('public_coaches').select('user_id,display_name,headline,profession,specialty,city,public_bio,coaching_topics,booking_enabled').order('display_name').limit(100)
        data = result.data as PublicRow[] | null; queryError = result.error
      } else if (page === 'articles') {
        const result = await supabase.from('articles').select('id,title,slug,excerpt,published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(100)
        data = result.data as PublicRow[] | null; queryError = result.error
      } else {
        const result = await supabase.from('events').select('id,title,description,starts_at,ends_at,location').eq('is_private', false).eq('moderation_state', 'visible').gte('starts_at', new Date().toISOString()).order('starts_at').limit(100)
        data = result.data as PublicRow[] | null; queryError = result.error
      }
      if (!active) return
      if (queryError) setError('تعذر تحميل المحتوى المنشور من Supabase. تحقق من إعداد RLS والتراخيص.')
      setRows(data ?? []); setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [page])

  const title = page === 'coaches' ? 'الكوتشات المنشورون' : page === 'articles' ? 'مقالات المجتمع' : 'الفعاليات القادمة'
  const intro = page === 'coaches' ? 'ملفات عامة مختارة فقط؛ بيانات التواصل والملفات الخاصة لا تظهر هنا.' : page === 'articles' ? 'المقالات المنشورة فعلياً في قاعدة البيانات.' : 'الفعاليات العامة القادمة التي اجتازت مراجعة المحتوى.'
  return <><main className="public-page wrap"><nav className="breadcrumbs" aria-label="مسار التنقل"><Link to="/">الرئيسية</Link><span>/</span><span>{title}</span></nav><div className="public-page-copy"><span className="eyebrow">{page === 'coaches' ? 'دليل مهني' : page === 'articles' ? 'مكتبة المجتمع' : 'تقويم المجتمع'}</span><h1>{title}</h1><p className="hero-lead">{intro}</p></div>{error && <div className="inline-message live-error" role="alert">{error}</div>}{loading ? <div className="live-state">جارٍ تحميل المحتوى المنشور…</div> : rows.length === 0 ? <div className="panel-card empty-state"><h2>لا يوجد محتوى منشور حتى الآن</h2><p>لن نعرض بيانات تجريبية على الصفحة العامة عند اتصال Supabase.</p></div> : <div className="public-points">{rows.map((row, index) => { const id = page === 'coaches' ? text(row.user_id) : text(row.id); const detailPath = page === 'articles' ? (row.slug ? `/articles/${encodeURIComponent(text(row.slug))}` : '') : page === 'events' ? `/events/${encodeURIComponent(id)}` : `/coaches/${encodeURIComponent(id)}`; const label = text(row.display_name, text(row.title)); return <article className="public-point live-public-card" key={id || String(index)}><span className="point-number">{page === 'coaches' ? <HeartHandshake size={18}/> : page === 'articles' ? <FileText size={18}/> : <CalendarDays size={18}/>}</span><div><h3>{detailPath ? <Link to={detailPath}>{label}</Link> : label}</h3><p>{page === 'coaches' ? [text(row.headline), text(row.profession), text(row.specialty), text(row.city)].filter(Boolean).join(' · ') : page === 'events' ? `${new Date(text(row.starts_at)).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })} · ${text(row.location, 'افتراضي')}` : text(row.excerpt, text(row.published_at ? new Date(text(row.published_at)).toLocaleDateString('ar') : ''))}</p>{page !== 'articles' && <p>{text(row.public_bio, text(row.description))}</p>}{Array.isArray(row.coaching_topics) && <small>محاور: {row.coaching_topics.join(' · ')}</small>}</div></article>})}</div>}<nav className="related-links" aria-label="صفحات مرتبطة"><b>قد تهمك</b><Link to="/coaching">الكوتشنج المهني</Link><Link to="/articles">مقالات المجتمع</Link><Link to="/faq">الأسئلة الشائعة</Link></nav><div className="coaching-note"><p>المحتوى العام فقط. لا ترفع أو تشارك أي معلومات أو صور تخص المرضى.</p><Link to="/register" className="text-link">انضم إلى المجتمع <ArrowLeft size={14}/></Link></div></main><footer className="site-footer"><div className="wrap footer-inner"><Link to="/">مجتمع السيطرة</Link><small>© ٢٠٢٦ مجتمع السيطرة</small></div></footer></>
}
