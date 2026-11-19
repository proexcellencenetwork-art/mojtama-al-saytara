import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BriefcaseBusiness, Building2, MapPin, Search, Sparkles, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './PublicProfessionalsPage.css'

type ProfessionalProfile = {
  user_id: string
  username: string | null
  display_name: string
  headline: string
  profession: string
  specialty: string
  workplace: string
  bio: string
  photo_url: string | null
  experience_years: number | null
  interests: string[]
  goals: string[]
  city: string
}
type PublicPortfolioItem = {
  id: string
  user_id: string
  item_type: 'project' | 'solved_problem' | 'skill' | 'result'
  title: string
  description: string
  result_summary: string
  metric_value: number | string | null
  metric_unit: string
  period_label: string
}
const publicPortfolioKinds: { id: PublicPortfolioItem['item_type']; label: string }[] = [
  { id: 'project', label: 'المشاريع' },
  { id: 'solved_problem', label: 'مشكلات تم حلها' },
  { id: 'skill', label: 'المهارات' },
  { id: 'result', label: 'النتائج' },
]

export default function PublicProfessionalsPage() {
  const [profiles, setProfiles] = useState<ProfessionalProfile[]>([])
  const [portfolioItems, setPortfolioItems] = useState<PublicPortfolioItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      if (!supabase) {
        setError('الدليل غير متاح في نسخة العرض؛ يلزم ربط قاعدة بيانات المجتمع.')
        setLoading(false)
        return
      }
      const { data, error: requestError } = await supabase
        .from('profiles')
        .select('user_id,username,display_name,headline,profession,specialty,workplace,bio,photo_url,experience_years,interests,goals,city')
        .eq('account_status', 'approved')
        .eq('visibility', 'public')
        .order('display_name', { ascending: true })
        .limit(250)
      if (!active) return
      if (requestError) setError('تعذر تحميل الملفات المهنية العامة حالياً.')
      else {
        const nextProfiles = (data || []) as ProfessionalProfile[]
        setProfiles(nextProfiles)
        if (nextProfiles.length) {
          const { data: publicItems, error: itemsError } = await supabase
            .from('professional_portfolio_items')
            .select('id,user_id,item_type,title,description,result_summary,metric_value,metric_unit,period_label')
            .eq('visibility', 'public')
            .in('user_id', nextProfiles.map(profile => profile.user_id))
            .order('created_at', { ascending: false })
          if (!active) return
          if (!itemsError) setPortfolioItems((publicItems || []) as PublicPortfolioItem[])
        } else {
          setPortfolioItems([])
        }
      }
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [])

  const visibleProfiles = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ar')
    if (!term) return profiles
    return profiles.filter(profile => [
      profile.display_name, profile.headline, profile.profession, profile.specialty,
      profile.workplace, profile.bio, profile.city, ...(profile.interests || []), ...(profile.goals || []),
      ...portfolioItems.filter(item => item.user_id === profile.user_id).flatMap(item => [item.title, item.description, item.result_summary]),
    ].join(' ').toLocaleLowerCase('ar').includes(term))
  }, [profiles, portfolioItems, search])

  return <main className="public-professionals-page wrap" dir="rtl">
    <nav className="breadcrumbs" aria-label="مسار التنقل"><Link to="/">الرئيسية</Link><span aria-hidden="true">/</span><span>الدليل المهني</span></nav>
    <header className="professionals-hero">
      <div>
        <span className="eyebrow"><Users size={15}/> شبكة مجتمع السيطرة المهنية</span>
        <h1>دليل المهنيين</h1>
        <p>تعرّف على أصحاب الخبرات والتخصصات، وما يعملون عليه، وما يبحثون عنه من فرص وظيفية أو تعاون مهني.</p>
        <div className="professionals-hero-actions">
          <Link className="btn btn-primary" to="/register">أنشئ ملفك المهني <ArrowLeft size={16}/></Link>
          <Link className="btn btn-outline" to="/membership">تعرّف على العضوية</Link>
        </div>
      </div>
      <div className="professionals-hero-stat"><strong>{profiles.length.toLocaleString('ar')}</strong><span>ملفاً مهنياً عاماً معتمداً في الدليل</span><small>يظهر الملف بعد تأكيد البريد وإكمال بياناته الأساسية وإتاحته للعامة.</small></div>
    </header>

    <section className="professionals-directory" aria-labelledby="professionals-directory-title">
      <div className="professionals-directory-heading">
        <div><span className="eyebrow">الخبرة تفتح باب التعارف والفرص</span><h2 id="professionals-directory-title">استكشف الخبرات والاهتمامات</h2></div>
        <label className="professionals-search"><Search size={17}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث بالاسم أو التخصص أو جهة العمل أو الهدف" aria-label="ابحث في الدليل المهني"/></label>
      </div>
      {loading ? <div className="professionals-state" role="status">جارٍ تحميل الملفات المهنية…</div>
        : error ? <div className="professionals-state is-error" role="alert">{error}</div>
        : visibleProfiles.length === 0 ? <div className="professionals-state"><Users size={25}/><h3>{search ? 'لا توجد نتائج مطابقة' : 'كن من أوائل أصحاب الملفات المهنية'}</h3><p>{search ? 'جرّب اسماً أو تخصصاً أو مجال عمل مختلفاً.' : 'أنشئ حسابك، وأكمل عنوانك المهني وخبرتك واهتماماتك حتى يظهر ملفك في الدليل.'}</p><Link className="btn btn-primary" to="/register">ابدأ ملفك المهني <ArrowLeft size={15}/></Link></div>
        : <div className="professionals-grid">{visibleProfiles.map(profile => {
          const memberItems = portfolioItems.filter(item => item.user_id === profile.user_id)
          return <article className="professional-card" key={profile.user_id}>
            <div className="professional-card-heading">
              {profile.photo_url ? <img className="professional-avatar" src={profile.photo_url} alt="" loading="lazy"/> : <div className="professional-avatar professional-avatar-fallback" aria-hidden="true">{profile.display_name.trim().charAt(0) || 'م'}</div>}
              <div className="professional-identity"><h3>{profile.display_name}</h3><p>{profile.headline || profile.profession || 'ملف مهني في مجتمع السيطرة'}</p>{profile.specialty && <span className="professional-specialty">{profile.specialty}</span>}</div>
            </div>
            <div className="professional-meta">
              {profile.profession && <span><BriefcaseBusiness size={14}/>{profile.profession}</span>}
              {profile.workplace && <span><Building2 size={14}/>{profile.workplace}</span>}
              {profile.city && <span><MapPin size={14}/>{profile.city}</span>}
              {profile.experience_years !== null && <span><Sparkles size={14}/>{profile.experience_years.toLocaleString('ar')} سنة خبرة</span>}
            </div>
            {profile.bio && <p className="professional-bio">{profile.bio}</p>}
            {(profile.interests || []).length > 0 && <div className="professional-tags"><b>مجالات الاهتمام</b><div>{profile.interests.map(item => <span key={item}>{item}</span>)}</div></div>}
            {(profile.goals || []).length > 0 && <div className="professional-tags professional-goals"><b>يبحث عن</b><div>{profile.goals.map(item => <span key={item}>{item}</span>)}</div></div>}
            {memberItems.length > 0 && <section className="professional-portfolio" aria-label="الأعمال والمهارات المنشورة">
              <h4>أعمال ومهارات منشورة</h4>
              {publicPortfolioKinds.map(kind => {
                const grouped = memberItems.filter(item => item.item_type === kind.id)
                if (!grouped.length) return null
                return <details className="professional-portfolio-group" key={kind.id}>
                  <summary><span>{kind.label}</span><small>{grouped.length.toLocaleString('ar-SA')}</small></summary>
                  <div className="professional-portfolio-list">{grouped.map(item => <article key={item.id}>
                    <b>{item.title}</b>
                    <p>{item.description}</p>
                    {item.result_summary && <span className="professional-portfolio-result">{item.result_summary}</span>}
                    {item.metric_value !== null && <small className="professional-portfolio-measure">{Number(item.metric_value).toLocaleString('ar-SA', { maximumFractionDigits: 3 })} {item.metric_unit}{item.period_label ? ` · ${item.period_label}` : ''}</small>}
                  </article>)}</div>
                </details>
              })}
            </section>}
          </article>
        })}</div>}
      <p className="professionals-directory-note">يعرض الدليل بيانات الملف المهني التي أضافها العضو إلى ملفه العام. لا يعرض البريد أو كلمات المرور أو مستندات التوثيق.</p>
    </section>
  </main>
}
