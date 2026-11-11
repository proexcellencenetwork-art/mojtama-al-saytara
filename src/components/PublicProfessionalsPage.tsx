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

export default function PublicProfessionalsPage() {
  const [profiles, setProfiles] = useState<ProfessionalProfile[]>([])
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
      else setProfiles((data || []) as ProfessionalProfile[])
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
    ].join(' ').toLocaleLowerCase('ar').includes(term))
  }, [profiles, search])

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
        : <div className="professionals-grid">{visibleProfiles.map(profile => <article className="professional-card" key={profile.user_id}>
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
        </article>)}</div>}
      <p className="professionals-directory-note">يعرض الدليل بيانات الملف المهني التي أضافها العضو إلى ملفه العام. لا يعرض البريد أو كلمات المرور أو مستندات التوثيق.</p>
    </section>
  </main>
}
