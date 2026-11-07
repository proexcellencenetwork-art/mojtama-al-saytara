import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, BookOpen, BriefcaseBusiness, CheckCircle2, Compass, Lightbulb, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import './StrategicOverviewPages.css'

type TrackKey = 'professional' | 'innovation' | 'research'
type TrackFilter = 'all' | TrackKey

const trackDetails: { id: TrackKey; title: string; subtitle: string; description: string; outcome: string; href: string; icon: typeof Compass }[] = [
  {
    id: 'professional',
    title: 'التقدم والتموضع المهني',
    subtitle: 'Professional Growth',
    description: 'تحديد الاتجاه المهني، تطوير الحضور، توثيق الإنجازات، وبناء ملف يوضح القيمة التي تقدمها.',
    outcome: 'بوصلة مهنية وخطوات وأدلة قابلة للمراجعة.',
    href: '/career-journey',
    icon: BriefcaseBusiness,
  },
  {
    id: 'innovation',
    title: 'البناء والابتكار',
    subtitle: 'Innovation & Development',
    description: 'تحويل المشكلات والأفكار إلى فرضيات وحلول وتجارب أولية، مع الاهتمام بالابتكار الصحي والتقني.',
    outcome: 'فكرة أو مشروع محدد بخطوة اختبار واضحة.',
    href: '/innovation-rd',
    icon: Lightbulb,
  },
  {
    id: 'research',
    title: 'البحث والأثر',
    subtitle: 'Research & Evidence',
    description: 'تطوير أسئلة بحثية، قراءة الأدلة، استخدام البيانات بمسؤولية، وربط المعرفة باحتياج واقعي.',
    outcome: 'سؤال أو تحليل أو معرفة موثقة بحدودها ومصادرها.',
    href: '/articles',
    icon: BookOpen,
  },
]

const programItems: { id: string; title: string; track: TrackKey; kind: string; description: string; href: string }[] = [
  { id: 'compass', title: 'البوصلة المهنية', track: 'professional', kind: 'أداة تقييم ذاتية', description: 'رتّب مرحلتك المهنية وهدفك والتحدي الذي يحتاج إلى معالجة، ثم حدد خطوتك التالية.', href: '/career-compass' },
  { id: 'linkedin', title: 'تدقيق LinkedIn', track: 'professional', kind: 'أداة مراجعة', description: 'راجع العنوان والملخص والخبرة والأدلة المهنية لتحسين وضوح حضورك.', href: '/linkedin-audit' },
  { id: 'graduate', title: 'جاهزية حديث التخرج', track: 'professional', kind: 'مسار إرشادي', description: 'حوّل مرحلة الانتقال من الدراسة إلى العمل إلى خطة تعلم ومخرجات قابلة للإثبات.', href: '/fresh-graduate' },
  { id: 'portfolio', title: 'ملف الإنجازات المهني', track: 'professional', kind: 'قالب عملي', description: 'نظّم إنجازاتك وفق المشكلة والإجراء والنتيجة والدليل، مع إزالة المعلومات السرية.', href: '/achievement-portfolio' },
  { id: 'positioning', title: 'التموضع المهني', track: 'professional', kind: 'أداة كتابة', description: 'ابنِ تعريفاً مهنياً يربط جمهورك بالمشكلة التي تعالجها والقدرة والدليل.', href: '/professional-positioning' },
  { id: 'innovation', title: 'الابتكار والبحث والتطوير', track: 'innovation', kind: 'مسار تطبيقي', description: 'استكشف الانتقال من المشكلة إلى الفرضية والتجربة والحل، دون ادعاء اعتماد أو نتيجة مسبقة.', href: '/innovation-rd' },
  { id: 'ai', title: 'الذكاء الاصطناعي والقيمة المهنية', track: 'innovation', kind: 'دليل عملي', description: 'استخدم الذكاء الاصطناعي ضمن سير عمل بشري يتحقق من المخرجات ويراعي الحوكمة والخصوصية.', href: '/ai-career-leverage' },
  { id: 'market', title: 'رادار سوق العمل السعودي', track: 'research', kind: 'مرجع بحثي', description: 'تابع قراءة سوق العمل والمهارات والقطاعات من خلال المصادر والتحقق من تاريخ البيانات.', href: '/saudi-labor-market-radar' },
  { id: 'promotion', title: 'الاستعداد للترقية', track: 'research', kind: 'أداة تخطيط', description: 'راجع أدلة الأداء والأثر وجهّز محفظة مهنية وخطة متابعة دون ضمان الترقية.', href: '/promotion-intelligence' },
]

const questions: { title: string; hint: string; options: { label: string; track: TrackKey }[] }[] = [
  {
    title: 'ما النتيجة الأهم التي تريد العمل عليها الآن؟',
    hint: 'اختر الهدف الأقرب لاحتياجك الحالي.',
    options: [
      { label: 'توضيح مساري وإظهار قيمتي المهنية', track: 'professional' },
      { label: 'اختبار فكرة أو بناء حل عملي', track: 'innovation' },
      { label: 'تعميق المعرفة وتحليل الأدلة والبيانات', track: 'research' },
    ],
  },
  {
    title: 'ما المخرج الذي تحتاج إلى بنائه؟',
    hint: 'فكر في شيء يمكن مراجعته أو عرضه لاحقاً.',
    options: [
      { label: 'ملف إنجازات وتموضع مهني أوضح', track: 'professional' },
      { label: 'نموذج أولي أو خطة تطوير لمشروع', track: 'innovation' },
      { label: 'سؤال بحثي أو تحليل موثق بمصادر', track: 'research' },
    ],
  },
  {
    title: 'أي نشاط تريد أن تخصص له وقتك؟',
    hint: 'اختر ما يعكس العمل الذي ترغب في ممارسته.',
    options: [
      { label: 'تطوير المهارات والحضور المهني وبناء العلاقات', track: 'professional' },
      { label: 'تصميم الحلول وتجربة الأفكار وتحسينها', track: 'innovation' },
      { label: 'البحث والقراءة النقدية وفهم البيانات', track: 'research' },
    ],
  },
  {
    title: 'ما التحدي الذي تريد البدء بمعالجته؟',
    hint: 'النتيجة إرشادية، ويمكنك استكشاف أكثر من مسار.',
    options: [
      { label: 'لدي خبرة، لكن يصعب عليّ توضيح قيمتها وإنجازاتي', track: 'professional' },
      { label: 'لدي فكرة أو مشكلة، وأحتاج إلى تحويلها إلى تجربة', track: 'innovation' },
      { label: 'أحتاج إلى دليل أو تحليل أقوى لاتخاذ قرار', track: 'research' },
    ],
  },
]

function PageHero({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <header className="strategic-page-hero">
    <span className="strategic-eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    <p>{description}</p>
    {children}
  </header>
}

function DiagnosticModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<TrackKey[]>([])
  const [complete, setComplete] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const ranking = useMemo(() => {
    const counts: Record<TrackKey, number> = { professional: 0, innovation: 0, research: 0 }
    answers.forEach(answer => { counts[answer] += 1 })
    return [...trackDetails].sort((a, b) => counts[b.id] - counts[a.id])
  }, [answers])

  function choose(track: TrackKey) {
    const next = answers.slice(0, step).concat(track)
    setAnswers(next)
    if (step === questions.length - 1) setComplete(true)
    else setStep(step + 1)
  }

  const primary = ranking[0]
  const secondary = ranking[1]
  const progress = complete ? 100 : ((step + 1) / questions.length) * 100

  return <div className="strategic-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="strategic-modal" role="dialog" aria-modal="true" aria-labelledby="strategic-quiz-title" dir="rtl">
      <div className="strategic-modal-top">
        <span className="strategic-eyebrow">أداة إرشادية قصيرة</span>
        <button className="strategic-icon-button" type="button" onClick={onClose} aria-label="إغلاق التقييم"><X size={19}/></button>
      </div>
      {!complete ? <>
        <h2 id="strategic-quiz-title">اكتشف نقطة البداية الأقرب لاحتياجك</h2>
        <p className="strategic-quiz-hint">السؤال {step + 1} من {questions.length} · {questions[step].hint}</p>
        <div className="strategic-progress" aria-label={'التقدم ' + Math.round(progress) + '%'}><span style={{ width: progress + '%' }}/></div>
        <h3 className="strategic-question">{questions[step].title}</h3>
        <div className="strategic-quiz-options">
          {questions[step].options.map(option => <button className="strategic-quiz-option" key={option.track} type="button" onClick={() => choose(option.track)}><span>{option.label}</span><ArrowLeft size={17}/></button>)}
        </div>
        <div className="strategic-modal-footer">
          <button className="strategic-text-button" type="button" onClick={() => { setStep(value => Math.max(0, value - 1)); setAnswers(value => value.slice(0, Math.max(0, step - 1))) }} disabled={step === 0}>السؤال السابق</button>
          <span>لا تُحفظ إجاباتك ولا تُرسل إلى الخادم.</span>
        </div>
      </> : <div className="strategic-quiz-result" aria-live="polite">
        <CheckCircle2 size={34}/>
        <h2 id="strategic-quiz-title">نقطة البداية المقترحة</h2>
        <span className="strategic-result-label">المسار الأقرب لاختياراتك</span>
        <h3>{primary.title}</h3>
        <p>{primary.description}</p>
        {secondary && <p className="strategic-result-secondary">وقد يفيدك استكشاف مسار {secondary.title} أيضاً، لأن اهتماماتك تتقاطع معه.</p>}
        <div className="strategic-result-actions">
          <Link className="strategic-primary-link" to={primary.href} onClick={onClose}>افتح المسار المقترح <ArrowUpRight size={16}/></Link>
          <button type="button" className="strategic-secondary-link" onClick={() => { setStep(0); setAnswers([]); setComplete(false) }}>أعد التقييم</button>
        </div>
        <p className="strategic-disclaimer">هذا التقييم إرشادي مبني على اختياراتك، وليس اختباراً علمياً أو تشخيصاً مهنياً معتمداً.</p>
      </div>}
    </section>
  </div>
}

export function StrategicTracksPage() {
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  return <main className="strategic-page wrap" dir="rtl">
    <nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><span>المسارات الاستراتيجية</span></nav>
    <PageHero eyebrow="ثلاثة مسارات مترابطة · هوية واحدة" title="اختر المسار الذي يحوّل جهدك إلى قيمة واضحة" description="صُممت المسارات لتربط التطوير المهني بالتطبيق والبحث. ابدأ من احتياجك الحالي، ثم انتقل بين المسارات عندما تتغير أهدافك.">
      <button className="strategic-primary-link" type="button" onClick={() => setShowDiagnostic(true)}><Compass size={17}/> ابدأ التقييم الإرشادي <ArrowLeft size={16}/></button>
    </PageHero>
    <section className="strategic-track-grid" aria-label="المسارات الاستراتيجية">
      {trackDetails.map(track => { const Icon = track.icon; return <article className="strategic-track-card" key={track.id}>
        <span className="strategic-card-icon"><Icon size={22}/></span>
        <span className="strategic-card-subtitle">{track.subtitle}</span>
        <h2>{track.title}</h2>
        <p>{track.description}</p>
        <div className="strategic-outcome"><b>المخرج المتوقع</b><span>{track.outcome}</span></div>
        <Link to={track.href}>استكشف المسار <ArrowLeft size={15}/></Link>
      </article> })}
    </section>
    <section className="strategic-note"><ShieldCheck size={20}/><p>المسارات متكاملة وليست تصنيفات ثابتة للأشخاص. التوصية تساعدك على اختيار نقطة بداية، ولا تحدد قدراتك أو فرصك المستقبلية.</p></section>
    {showDiagnostic && <DiagnosticModal onClose={() => setShowDiagnostic(false)}/>}
  </main>
}

export function ProgramsPage() {
  const [filter, setFilter] = useState<TrackFilter>('all')
  const [search, setSearch] = useState('')
  const [showDiagnostic, setShowDiagnostic] = useState(false)
  const filtered = useMemo(() => programItems.filter(item => {
    const matchesTrack = filter === 'all' || item.track === filter
    const query = search.trim().toLocaleLowerCase()
    const matchesSearch = !query || (item.title + ' ' + item.description + ' ' + item.kind).toLocaleLowerCase().includes(query)
    return matchesTrack && matchesSearch
  }), [filter, search])

  const filters: { value: TrackFilter; label: string }[] = [
    { value: 'all', label: 'الكل' },
    { value: 'professional', label: 'التقدم المهني' },
    { value: 'innovation', label: 'الابتكار' },
    { value: 'research', label: 'البحث والأثر' },
  ]

  return <main className="strategic-page wrap" dir="rtl">
    <nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><span>البرامج والأدوات</span></nav>
    <PageHero eyebrow="مكتبة البرامج والأدوات" title="ابدأ بمخرج عملي، لا بمجرد مشاهدة المحتوى" description="تصفح الأدوات والمسارات المنشورة، واختر ما يناسب هدفك. المعروض هنا موارد ذاتية متاحة على الموقع، وليس إعلاناً عن دفعات تدريبية أو برامج مدفوعة مفتوحة.">
      <button className="strategic-secondary-link" type="button" onClick={() => setShowDiagnostic(true)}>ساعدني في اختيار البداية <Compass size={16}/></button>
    </PageHero>
    <section className="strategic-program-controls" aria-label="البحث والتصفية">
      <label className="strategic-search"><Search size={18}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث عن أداة أو موضوع..." aria-label="ابحث عن أداة أو موضوع"/></label>
      <div className="strategic-filter-list" role="group" aria-label="تصفية حسب المسار">
        {filters.map(item => <button type="button" key={item.value} className={filter === item.value ? 'active' : ''} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}
      </div>
    </section>
    <div className="strategic-results-count" aria-live="polite">عدد الموارد المطابقة: {filtered.length}</div>
    <section className="strategic-program-grid">
      {filtered.map(item => {
        const track = trackDetails.find(entry => entry.id === item.track)
        return <article className="strategic-program-card" key={item.id}>
          <div className="strategic-program-card-top"><span>{track?.title}</span><small>{item.kind}</small></div>
          <h2>{item.title}</h2>
          <p>{item.description}</p>
          <Link to={item.href}>افتح المورد <ArrowLeft size={15}/></Link>
        </article>
      })}
      {!filtered.length && <p className="strategic-empty">لم نعثر على موارد مطابقة. جرّب كلمة بحث أخرى أو غيّر المسار المحدد.</p>}
    </section>
    <section className="strategic-note"><ShieldCheck size={20}/><p>لا توجد حالياً دفعات جماعية مفتوحة أو أسعار معتمدة معلنة. سنوضح مواعيد التسجيل وشروط كل برنامج قبل إتاحته، ولن نعرض موارد تجريبية على أنها برامج نشطة.</p></section>
    {showDiagnostic && <DiagnosticModal onClose={() => setShowDiagnostic(false)}/>}
  </main>
}

export function InnovationResearchHubPage() {
  return <main className="strategic-page wrap" dir="rtl">
    <nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><span>الابتكار والبحث</span></nav>
    <PageHero eyebrow="Innovation · Research · Evidence" title="من الفكرة إلى دليل، ومن الدليل إلى أثر" description="مساحة تربط الابتكار والبحث بالاحتياج الواقعي، وتساعد على اختبار الأفكار وتوضيح الأدلة والحدود قبل تقديم النتائج أو الوعود.">
      <Link className="strategic-primary-link" to="/innovation-rd">استكشف مسار الابتكار والتطوير <ArrowLeft size={16}/></Link>
    </PageHero>
    <section className="strategic-hub-grid">
      <article className="strategic-hub-card"><Lightbulb size={23}/><h2>الابتكار وتطوير الحلول</h2><p>صياغة المشكلة، فهم المستخدم، بناء الفرضية، وتحديد تجربة صغيرة يمكن أن تكشف ما يحتاج إلى تحسين.</p><Link to="/innovation-rd">ابدأ من مسار الابتكار <ArrowLeft size={14}/></Link></article>
      <article className="strategic-hub-card"><BookOpen size={23}/><h2>البحث والأدلة</h2><p>القراءة النقدية، فهم المنهجية، توثيق المصادر، والتمييز بين النتائج المنشورة والفرضيات التي تحتاج إلى تحقق.</p><Link to="/articles">استكشف المعرفة المنشورة <ArrowLeft size={14}/></Link></article>
      <article className="strategic-hub-card"><Sparkles size={23}/><h2>الذكاء الاصطناعي والبيانات</h2><p>استخدام الأدوات الرقمية والذكاء الاصطناعي بمراجعة بشرية، وحوكمة واضحة، وحماية للبيانات.</p><Link to="/ai-career-leverage">افتح الدليل العملي <ArrowLeft size={14}/></Link></article>
    </section>
    <section className="strategic-initiative">
      <span className="strategic-eyebrow">مبادرة متخصصة داخل المنظومة</span>
      <h2>Future Med Leaders</h2>
      <p>مبادرة متخصصة في القيادة والابتكار الصحي، تعمل ضمن مظلة مجتمع السيطرة المهنية. تبقى هوية المجتمع هي العلامة الرئيسية، وتخدم المبادرة مجالاً تخصصياً من مجالاته.</p>
      <span className="strategic-initiative-note">تُعرض المبادرة هنا بوصفها توجهاً تخصصياً، ولا يعني ذلك وجود شراكة أو اعتماد رسمي أو برنامج مفتوح ما لم يُعلن عنه بدليل مستقل.</span>
    </section>
  </main>
}

export function ContributePage() {
  const ways = [
    ['كتابة معرفية موثقة', 'إعداد مادة مهنية تستند إلى مصادر واضحة وتفصل بين الحقيقة والرأي.'],
    ['مراجعة المحتوى والمصادر', 'المساعدة في مراجعة الدقة والحداثة وحدود الأدلة قبل النشر.'],
    ['الإرشاد وتبادل الخبرة', 'مشاركة تجربة مهنية قابلة للتعميم دون كشف معلومات جهة العمل أو الأفراد.'],
    ['المساهمة في الابتكار والبحث', 'اقتراح مشكلة أو فكرة قابلة للاختبار والتطوير بصورة مسؤولة.'],
  ]
  return <main className="strategic-page wrap" dir="rtl">
    <nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><span>المساهمة والتطوع</span></nav>
    <PageHero eyebrow="Contribute · Volunteer" title="ساهم بخبرتك، واجعل المعرفة قابلة للاستخدام" description="تُبنى قيمة المجتمع من الخبرات الحقيقية والمراجعة المسؤولة والمشاركة التي تحترم أصحابها وخصوصيتهم.">
      <Link className="strategic-primary-link" to="/survey">شاركنا ملاحظتك <ArrowLeft size={16}/></Link>
    </PageHero>
    <section className="strategic-contribution-grid">
      {ways.map(([title, description], index) => <article className="strategic-contribution-card" key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{description}</p></article>)}
    </section>
    <section className="strategic-note"><ShieldCheck size={20}/><p>استقبال طلبات التطوع والمشاريع ليس مفتوحاً عبر نموذج إنتاجي حالياً. لن نطلب بياناتك قبل اعتماد قناة استقبال واضحة ومراجعة متطلبات الخصوصية. يمكنك مشاركة مقترح عام أو ملاحظة عبر القنوات المنشورة.</p></section>
    <div className="strategic-inline-actions"><a className="strategic-secondary-link" href="https://lnkd.in/p/dy_ShV2B" target="_blank" rel="noopener noreferrer">تواصل عبر LinkedIn <ArrowUpRight size={16}/></a><Link className="strategic-secondary-link" to="/articles">اطّلع على المحتوى المنشور <ArrowLeft size={16}/></Link></div>
  </main>
}

export function ContactPage() {
  return <main className="strategic-page wrap" dir="rtl">
    <nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><span>التواصل</span></nav>
    <PageHero eyebrow="Contact the Community" title="ابدأ حواراً واضحاً مع مجتمع السيطرة المهنية" description="للاستفسارات العامة أو الملاحظات حول المحتوى والأدوات، استخدم القنوات المنشورة. لا نعرض نموذج تواصل يجمع بياناتك قبل تفعيل مسار استقبال آمن.">
    </PageHero>
    <section className="strategic-contact-grid">
      <article className="strategic-contact-card"><span className="strategic-card-icon"><Users size={22}/></span><h2>القناة المهنية</h2><p>تابع أخبار المجتمع ومحتواه المنشور وتواصل عبر صفحته المهنية.</p><a href="https://lnkd.in/p/dy_ShV2B" target="_blank" rel="noopener noreferrer">افتح صفحة LinkedIn <ArrowUpRight size={15}/></a></article>
      <article className="strategic-contact-card"><span className="strategic-card-icon"><CheckCircle2 size={22}/></span><h2>ملاحظات الزوار</h2><p>شارك رأيك في وضوح المحتوى وسهولة الاستخدام وما يحتاج إلى تطوير.</p><Link to="/survey">افتح استبيان التجربة <ArrowLeft size={15}/></Link></article>
      <article className="strategic-contact-card"><span className="strategic-card-icon"><BookOpen size={22}/></span><h2>تحديثات المجتمع</h2><p>يمكنك الاشتراك في تحديثات البريد من نموذج النشرة الموجود أسفل صفحات الموقع.</p><Link to="/">العودة إلى الصفحة الرئيسية <ArrowLeft size={15}/></Link></article>
    </section>
    <p className="strategic-contact-note">لا نعرض عنوان بريد أو رقم هاتف غير موثق. ستضاف قنوات أخرى عند اعتمادها ونشرها رسمياً.</p>
  </main>
}
