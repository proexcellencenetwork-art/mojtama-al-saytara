import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowUpLeft, BookOpen, BriefcaseBusiness, CheckCircle2, Compass, Crown, GraduationCap, MessageCircle, ShieldCheck, Sparkles, Wrench, X } from 'lucide-react'
import { submitOnboardingLead } from '../lib/onboarding'
import { supabase } from '../lib/supabase'
import './WelcomeGateway.css'

type Goal = 'job' | 'skills' | 'promotion' | 'transition' | 'leadership' | 'explore'
type Path = { key: string; title: string; description: string; href: string; icon: typeof Compass }

const paths: Path[] = [
  { key: 'tools', title: 'الأدوات المهنية', description: 'اختبارات وأدوات تساعدك على فهم احتياجك وبناء خطوتك التالية.', href: '/career-compass', icon: Wrench },
  { key: 'learning', title: 'مكتبة المعرفة والتعلم', description: 'مقالات وأدلة ومحتوى تطبيقي يساعدك على التطور.', href: '/learning', icon: BookOpen },
  { key: 'career', title: 'الرحلة المهنية', description: 'حدد اتجاهك واستكشف المسارات المهنية المتاحة.', href: '/career-journey', icon: Compass },
  { key: 'articles', title: 'المقالات والمصادر', description: 'اطّلع على المعرفة والأبحاث والموضوعات المهنية.', href: '/articles', icon: GraduationCap },
  { key: 'community', title: 'مجتمع النقاش', description: 'تعرّف على المجتمع ومساحات التعلم والتفاعل.', href: '/about', icon: MessageCircle },
  { key: 'events', title: 'الورش والفعاليات', description: 'استكشف اللقاءات والورش والأنشطة القادمة.', href: '/events', icon: BriefcaseBusiness },
]

const goals: { value: Goal; label: string; recommendation: string }[] = [
  { value: 'job', label: 'أبحث عن فرصة وظيفية', recommendation: 'ابدأ بالبوصلة المهنية، ثم جهّز ملف إنجازاتك.' },
  { value: 'skills', label: 'أريد تطوير مهاراتي وإثبات قيمتي', recommendation: 'ابدأ بالأدوات المهنية ومكتبة التعلم.' },
  { value: 'promotion', label: 'أريد الترقية أو تحسين دخلي', recommendation: 'استكشف مسار القيمة المهنية وإثبات الإنجازات.' },
  { value: 'transition', label: 'أفكر في الانتقال لمسار جديد', recommendation: 'ابدأ بتحديد اتجاهك وفجوات مهاراتك.' },
  { value: 'leadership', label: 'أبحث عن التطور القيادي والتنفيذي', recommendation: 'تعرّف على المسارات المتقدمة المتاحة وفق الترشيح والتأهيل.' },
  { value: 'explore', label: 'أريد استكشاف الأدوات والمحتوى', recommendation: 'تصفح الأدوات والمقالات ومركز التعلم.' },
]

const specialties = ['تقنية وذكاء اصطناعي', 'صحة وعلوم طبية', 'إدارة وأعمال', 'هندسة', 'مالية ومحاسبة', 'موارد بشرية', 'تعليم وبحث علمي', 'أخرى']

export function WelcomeGateway({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState<'welcome' | 'guide' | 'done'>('welcome')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [goal, setGoal] = useState<Goal>('skills')
  const [processingConsent, setProcessingConsent] = useState(false)
  const [marketingOptIn, setMarketingOptIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedGoal, setSavedGoal] = useState<Goal>('skills')

  useEffect(() => {
    try {
      if (localStorage.getItem('saytara-welcome-completed') !== 'true') setVisible(true)
    } catch { setVisible(true) }
  }, [])

  function dismiss() {
    try { localStorage.setItem('saytara-welcome-completed', 'true') } catch { /* Session can continue without persistence. */ }
    setVisible(false)
  }

  function browse() {
    dismiss()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      await submitOnboardingLead({
        fullName: name,
        email,
        specialty,
        goal,
        selectedPath: goal,
        processingConsent,
        marketingOptIn,
        sourcePath: window.location.pathname,
        website: String(formData.get('website') || ''),
      })
      setSavedGoal(goal)
      setStep('done')
      try { localStorage.setItem('saytara-welcome-completed', 'true') } catch { /* Optional preference only. */ }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'حدث خطأ غير متوقع.')
    } finally {
      setSaving(false)
    }
  }

  const recommendation = goals.find(item => item.value === savedGoal) ?? goals[1]

  return <>
    {children}
    {visible && <div className="welcome-gateway" role="dialog" aria-modal="true" aria-labelledby="gateway-title">
      <div className="gateway-backdrop" />
      <section className="gateway-panel">
        <button className="gateway-close" type="button" aria-label="إغلاق نافذة الترحيب" onClick={browse}><X size={19}/></button>
        <div className="gateway-brand"><span><Sparkles size={22}/></span><div><b>مجتمع السيطرة المهنية</b><small>Professional Mastery Community</small></div></div>

        {step === 'welcome' && <>
          <div className="gateway-welcome-copy">
            <span className="gateway-eyebrow">أهلاً بك · نورت المجتمع</span>
            <h1 id="gateway-title">هذه أول خطوة نحو بناء قيمة مهنية تستحق أن تُرى.</h1>
            <p>يسعدنا وجودك. استكشف المجتمع بطريقتك، أو دعنا نرشدك إلى المسار والأدوات الأقرب لاحتياجك.</p>
          </div>
          <div className="gateway-choices">
            <button type="button" className="gateway-choice gateway-choice-primary" onClick={() => setStep('guide')}>
              <span className="gateway-choice-icon"><Compass size={22}/></span>
              <span><b>أرشدني إلى الخيارات المناسبة</b><small>نساعدك على تحديد ما تحتاجه واختيار وجهتك.</small></span>
              <ArrowLeft size={19}/>
            </button>
            <button type="button" className="gateway-choice" onClick={browse}>
              <span className="gateway-choice-icon"><BookOpen size={22}/></span>
              <span><b>أريد التصفح مباشرة</b><small>أستكشف المقالات والأدوات والمحتوى بنفسي.</small></span>
              <ArrowLeft size={19}/>
            </button>
          </div>
          <p className="gateway-footnote"><ShieldCheck size={14}/> التصفح متاح دون تسجيل أو مشاركة بياناتك.</p>
        </>}

        {step === 'guide' && <>
          <div className="gateway-step-heading">
            <span className="gateway-eyebrow">خطوتك التالية</span>
            <h2 id="gateway-title">خلّنا نتعرف عليك بشكل بسيط.</h2>
            <p>نستخدم هذه المعلومات لتوجيهك إلى المسار المناسب. البريد يكفي حالياً، ولا نطلب رقم الجوال.</p>
          </div>
          <form className="gateway-form" onSubmit={submit}>
            <label className="gateway-honeypot" aria-hidden="true">اترك هذا الحقل فارغاً<input tabIndex={-1} autoComplete="off" name="website" value=""/></label>
            <label>الاسم<input autoComplete="name" maxLength={100} required value={name} onChange={event => setName(event.target.value)} placeholder="اسمك"/></label>
            <label>البريد الإلكتروني<input autoComplete="email" type="email" maxLength={254} required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"/></label>
            <label>التخصص أو المجال<select required value={specialty} onChange={event => setSpecialty(event.target.value)}><option value="">اختر مجالك</option>{specialties.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
            <fieldset><legend>ما الذي تبحث عنه حالياً؟</legend>{goals.map(item => <label className="gateway-radio" key={item.value}><input type="radio" name="goal" value={item.value} checked={goal === item.value} onChange={() => setGoal(item.value)}/><span>{item.label}</span></label>)}</fieldset>
            <label className="gateway-consent"><input type="checkbox" checked={processingConsent} onChange={event => setProcessingConsent(event.target.checked)}/><span>أوافق على استخدام بياناتي لتقديم الإرشاد الذي طلبته، بعد الاطلاع على <Link to="/privacy" target="_blank" rel="noreferrer">إشعار الخصوصية</Link>.</span></label>
            <label className="gateway-consent"><input type="checkbox" checked={marketingOptIn} onChange={event => setMarketingOptIn(event.target.checked)}/><span>أرغب اختيارياً في تلقي محتوى المجتمع وتحديثاته عبر البريد الإلكتروني.</span></label>
            {error && <p className="gateway-error" role="alert">{error}</p>}
            <div className="gateway-form-actions"><button type="button" className="gateway-back" onClick={() => setStep('welcome')}>رجوع</button><button type="submit" className="gateway-submit" disabled={saving || !processingConsent}>{saving ? 'جارٍ حفظ طلبك...' : 'اعرض مساري المناسب'} <ArrowLeft size={17}/></button></div>
          </form>
        </>}

        {step === 'done' && <>
          <div className="gateway-done-icon"><CheckCircle2 size={34}/></div>
          <span className="gateway-eyebrow">تم استلام طلب الإرشاد</span>
          <h2 id="gateway-title">أهلاً بك {name}، نبدأ من هنا.</h2>
          <p className="gateway-recommendation">{recommendation.recommendation}</p>
          <div className="gateway-path-grid">{paths.map(path => { const Icon = path.icon; return <button type="button" className="gateway-path" key={path.key} onClick={() => { dismiss(); navigate(path.href) }}><Icon size={19}/><span><b>{path.title}</b><small>{path.description}</small></span><ArrowUpLeft size={16}/></button> })}</div>
          <div className="gateway-advanced-note"><Crown size={18}/><span><b>مسارات القيادات والتنفيذيين</b><small>برامج متقدمة ومحدودة، الوصول إليها وفق الترشيح ومعايير التأهيل.</small></span></div>
          <button type="button" className="gateway-finish" onClick={dismiss}>ابدأ استكشاف المجتمع</button>
        </>}
      </section>
    </div>}
  </>
}
