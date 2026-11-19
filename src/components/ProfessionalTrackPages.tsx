import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, BookOpen, Check, CircleHelp, Download, Eye, EyeOff, FolderKanban, Lightbulb, LineChart, LockKeyhole, Pencil, Plus, ShieldCheck, Sparkles, Target, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { buildPositioningStatement, scorePromotionReadiness, type ReadinessItem } from '../lib/careerLogic'
import { supabase } from '../lib/supabase'
import './career-pages.css'

type Evidence = { id: string; date: string; title: string; context: string; action: string; result: string; proof: string }
const evidenceStorageKey = 'saytara-professional-evidence-v1'

function readEvidence(): Evidence[] {
  try { const value = localStorage.getItem(evidenceStorageKey); const parsed = value ? JSON.parse(value) : []; return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string') : [] } catch { return [] }
}

function EvidenceTracker({ title = 'سجل أدلة الإنجاز', helper = 'سجل داخلي خاص يساعدك على التذكر؛ لا تشارك محتوى جهة عمل أو بيانات أشخاص.' }: { title?: string; helper?: string }) {
  const [items, setItems] = useState<Evidence[]>(() => readEvidence())
  const [values, setValues] = useState({ title: '', date: '', context: '', action: '', result: '', proof: '' })
  const [message, setMessage] = useState('')
  function persist(next: Evidence[]) {
    setItems(next)
    try { localStorage.setItem(evidenceStorageKey, JSON.stringify(next)) } catch { setMessage('تعذر الحفظ في هذا المتصفح؛ يمكنك تصدير نسخة محلية.') }
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const row: Evidence = { id: crypto.randomUUID(), ...values }
    persist([row, ...items])
    setValues({ title: '', date: '', context: '', action: '', result: '', proof: '' })
    setMessage('أُضيفت البطاقة إلى هذا المتصفح فقط.')
  }
  function exportJson() {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'saytara-evidence-local.json'; anchor.click(); URL.revokeObjectURL(url)
  }
  return <section className="career-evidence-panel"><div className="career-evidence-header"><div><span className="eyebrow"><LockKeyhole size={14}/> محلي فقط</span><h2>{title}</h2><p>{helper}</p></div><div className="career-evidence-actions"><button className="btn btn-outline btn-small" type="button" onClick={exportJson} disabled={!items.length}><Download size={14}/>تصدير ملفي</button><button className="icon-btn" type="button" aria-label="حذف جميع بطاقات الأدلة" title="حذف جميع البطاقات" onClick={() => { persist([]); setMessage('حُذفت البطاقات من هذا المتصفح.') }} disabled={!items.length}><Trash2 size={16}/></button></div></div>
    <div className="career-privacy-note"><ShieldCheck size={16}/><span>يُحفظ السجل على جهازك عبر localStorage ولا يُرفع إلى الموقع. لا تضع أسماء مرضى أو بيانات تعريفية أو أرقاماً/وثائق داخلية. تحقّق من سياسة جهة عملك قبل مشاركة أي دليل.</span></div>
    <form className="career-evidence-form" onSubmit={add}><label>عنوان الإنجاز<input required maxLength={120} value={values.title} onChange={event => setValues({ ...values, title: event.target.value })} placeholder="مثال: تبسيط خطوة في مسار العمل"/></label><label>التاريخ<input required type="month" value={values.date} onChange={event => setValues({ ...values, date: event.target.value })}/></label><label>السياق والمشكلة<textarea required maxLength={400} rows={2} value={values.context} onChange={event => setValues({ ...values, context: event.target.value })}/></label><label>دورك وما فعلته<textarea required maxLength={500} rows={2} value={values.action} onChange={event => setValues({ ...values, action: event.target.value })}/></label><label>النتيجة أو ما تعلمته<textarea required maxLength={500} rows={2} value={values.result} onChange={event => setValues({ ...values, result: event.target.value })}/></label><label>نوع الدليل أو مكانه (من دون رابط/سر)<input required maxLength={150} value={values.proof} onChange={event => setValues({ ...values, proof: event.target.value })} placeholder="مثال: خطاب شكر مصرح بمشاركته"/></label><button className="btn btn-primary btn-small" type="submit"><Plus size={15}/>أضف بطاقة</button></form>
    {message && <p className="career-local-message" role="status">{message}</p>}
    {items.length ? <div className="career-evidence-list"><h3>بطاقات هذا المتصفح ({items.length})</h3>{items.map(item => <article className="career-evidence-item" key={item.id}><div className="career-evidence-item-top"><span>{item.date}</span><button className="icon-btn" type="button" aria-label={`حذف ${item.title}`} onClick={() => persist(items.filter(row => row.id !== item.id))}><Trash2 size={14}/></button></div><h4>{item.title}</h4><dl><dt>السياق</dt><dd>{item.context}</dd><dt>دوري</dt><dd>{item.action}</dd><dt>النتيجة/التعلم</dt><dd>{item.result}</dd><dt>الدليل</dt><dd>{item.proof}</dd></dl></article>)}</div> : <p className="career-empty-state">لا توجد بطاقات بعد. ابدأ بمثال واحد، واحفظ دليله في مكان مصرح به.</p>}
  </section>
}

export function ValueEconomyPage() {
  const [values, setValues] = useState({ skill: '', capability: '', impact: '', evidence: '', positioning: '', negotiation: '', compensation: '' })
  const [showResult, setShowResult] = useState(false)
  const fields: [keyof typeof values, string, string][] = [
    ['skill','Skill · المهارة','مهارة محددة تستخدمها فعلاً'],['capability','Capability · القدرة','كيف تجمع المهارة مع الحكم أو العمل في موقف حقيقي؟'],['impact','Business impact · الأثر','وقت، جودة، سلامة، وصول، كلفة أو قرار — ما نوع التغير؟'],['evidence','Evidence · الدليل','ما المصدر المسموح بالتحقق منه؟ اكتب وصفاً لا رابطاً سرياً.'],['positioning','Positioning · التموضع','ما الدور أو الحاجة التي تربط بها الدليل؟'],['negotiation','Negotiation · التفاوض','ما الطلب المحدد: نطاق، مسؤولية، مراجعة، مورد أو تعويض؟'],['compensation','Compensation · التعويض','ما السياسة/النطاق العام الموثوق الذي ينبغي التحقق منه؟ لا تخمّن رقماً.'],
  ]
  const complete = Object.values(values).every(item => item.trim())
  return <main className="public-page wrap career-page"><nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><Link to="/career-journey">الرحلة المهنية</Link><span>/</span><span>اقتصاد القيمة</span></nav><header className="career-page-intro"><span className="eyebrow"><LineChart size={15}/> من المهارة إلى حوار مهني</span><h1>اقتصاد القيمة المهنية</h1><p className="hero-lead">اربط ما تتعلمه بما تستطيع فعله، ثم بما تغيّر والدليل الذي تستطيع عرضه، قبل أن تستخدمه في التموضع أو التفاوض على نطاق العمل والتعويض.</p></header><div className="career-value-chain" aria-label="سلسلة القيمة المهنية"><span>Skill</span><i>←</i><span>Capability</span><i>←</i><span>Business impact</span><i>←</i><span>Evidence</span><i>←</i><span>Positioning</span><i>←</i><span>Negotiation</span><i>←</i><span>Compensation</span></div><div className="career-privacy-note"><ShieldCheck size={17}/><span>الأجر ليس مرادفاً للقيمة، والأثر لا يضمن زيادة راتب أو ترقية. لا تستخدم بيانات داخلية أو أرقاماً غير موثقة؛ قارِن مع سياسات جهة العمل ومصادر موثوقة للدور والموقع.</span></div><section className="career-form-card"><div className="career-form-heading"><span className="career-form-icon"><Target size={19}/></span><div><h2>ابنِ خريطة القيمة الخاصة بك</h2><p>كل إجابة خطوة قابلة للمراجعة، لا نتيجة مالية مضمونة.</p></div></div><div className="career-form-grid">{fields.map(([key,label,placeholder]) => <label className={key === 'compensation' ? 'career-form-wide' : ''} key={key}>{label}<textarea rows={key === 'compensation' ? 2 : 3} maxLength={420} value={values[key]} onChange={event => { setValues({ ...values, [key]: event.target.value }); setShowResult(false) }} placeholder={placeholder}/></label>)}</div><div className="career-form-actions"><button className="btn btn-primary" type="button" onClick={() => setShowResult(true)}>كوّن مسودة سلسلة القيمة <ArrowLeft size={15}/></button><button className="btn btn-quiet" type="button" onClick={() => { setValues({ skill:'', capability:'', impact:'', evidence:'', positioning:'', negotiation:'', compensation:'' }); setShowResult(false) }}>مسح</button></div>{showResult && <div className={`career-value-result ${complete ? '' : 'incomplete'}`} role="status"><h3>{complete ? 'مسودة قابلة للنقاش' : 'أكمل الحقول قبل تكوين الخريطة'}</h3>{complete ? <ol>{fields.map(([key,label]) => <li key={key}><b>{label}</b><span>{values[key]}</span></li>)}</ol> : <p>لا نملأ الفراغات أو نخترع مؤشرات أثر أو نطاقات تعويض. أضف وصفاً يمكن التحقق منه لكل حلقة.</p>}</div>}</section><section className="career-article-links"><SectionTitle title="ثمانية أسئلة يبنيها المحتوى" description="تغطي المكتبة أهمية المهارات، توثيق الأثر، بطاقة الإنجاز، محفظة القيمة، الاستعداد لطلب زيادة أو تفاوض، ومتى تكون المحادثة منطقية."/><ol className="career-question-list">{['لماذا تختلف قيمة المهارات بحسب الحاجة والسياق؟','كيف أثبت أثر عملي من دون تضخيم؟','كيف أحول إنجازاً إلى Evidence قابل للمراجعة؟','كيف أبني ملف قيمة مختصراً؟','كيف أستعد لمحادثة مراجعة التعويض؟','كيف أتفاوض بطلب واضح وبيانات مناسبة؟','متى يكون طلب زيادة أو توسيع مسؤولية منطقياً؟','ما الفرق بين زيادة المسؤوليات وزيادة القيمة المثبتة؟'].map(q => <li key={q}>{q}</li>)}</ol><div className="career-inline-links"><Link to="/articles/professional-value">اقرأ دليل اقتصاد القيمة المهنية <ArrowLeft size={14}/></Link><Link to="/achievement-portfolio">افتح ملف الأدلة <ArrowLeft size={14}/></Link><Link to="/promotion-intelligence">الاستعداد للترقية <ArrowLeft size={14}/></Link></div></section></main>
}

function SectionTitle({ eyebrow = 'من المسار المهني', title, description }: { eyebrow?: string; title: string; description?: string }) { return <div className="career-section-heading">{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div> }

type PortfolioItemType = 'project' | 'solved_problem' | 'skill' | 'result'
type PortfolioVisibility = 'private' | 'public'
type PortfolioItem = {
  id: string
  user_id: string
  item_type: PortfolioItemType
  title: string
  description: string
  result_summary: string
  metric_value: number | string | null
  metric_unit: string
  period_label: string
  visibility: PortfolioVisibility
  created_at: string
}
type PortfolioForm = {
  item_type: PortfolioItemType
  title: string
  description: string
  result_summary: string
  metric_value: string
  metric_unit: string
  period_label: string
  visibility: PortfolioVisibility
}
const portfolioKinds: { id: PortfolioItemType; label: string; plural: string; hint: string }[] = [
  { id: 'project', label: 'مشروع', plural: 'المشاريع', hint: 'ما المشروع؟ وما الجزء الذي تولّيته؟' },
  { id: 'solved_problem', label: 'مشكلة حللتها', plural: 'المشكلات التي حللتها', hint: 'ما المشكلة المهنية؟ وكيف تعاملت معها؟' },
  { id: 'skill', label: 'مهارة', plural: 'المهارات', hint: 'ما المهارة التي تستخدمها فعلياً؟ وفي أي سياق؟' },
  { id: 'result', label: 'نتيجة', plural: 'النتائج', hint: 'ما النتيجة التي حققتها؟ وضّح دورك وحدود مساهمتك.' },
]
const emptyPortfolioForm = (): PortfolioForm => ({
  item_type: 'project', title: '', description: '', result_summary: '',
  metric_value: '', metric_unit: '', period_label: '', visibility: 'private',
})

export function AchievementPortfolioPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [form, setForm] = useState<PortfolioForm>(emptyPortfolioForm)
  const [filter, setFilter] = useState<PortfolioItemType | 'all'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    async function loadPortfolio() {
      if (!supabase) {
        if (active) {
          setError('حفظ الملف المهني غير متاح في نسخة العرض؛ يلزم ربط قاعدة بيانات المجتمع.')
          setLoading(false)
        }
        return
      }
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        if (active) {
          setUserId(null)
          setItems([])
          setError('سجّل الدخول بحسابك المعتمد لعرض ملفك المهني وإدارته.')
          setLoading(false)
        }
        return
      }
      if (active) setUserId(authData.user.id)
      const { data, error: loadError } = await supabase
        .from('professional_portfolio_items')
        .select('id,user_id,item_type,title,description,result_summary,metric_value,metric_unit,period_label,visibility,created_at')
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: false })
      if (!active) return
      if (loadError) {
        setError('تعذر تحميل الملف. تأكد من تطبيق تحديث قاعدة البيانات، ثم أعد المحاولة.')
      } else {
        setItems((data || []) as PortfolioItem[])
        setError('')
      }
      setLoading(false)
    }
    void loadPortfolio()
    return () => { active = false }
  }, [])

  const filteredItems = useMemo(
    () => filter === 'all' ? items : items.filter(item => item.item_type === filter),
    [filter, items],
  )
  const counts = useMemo(
    () => Object.fromEntries(portfolioKinds.map(kind => [kind.id, items.filter(item => item.item_type === kind.id).length])) as Record<PortfolioItemType, number>,
    [items],
  )
  const selectedKind = portfolioKinds.find(kind => kind.id === form.item_type) || portfolioKinds[0]

  function resetForm() {
    setForm(emptyPortfolioForm())
    setEditingId(null)
  }

  async function refreshItems() {
    if (!supabase || !userId) return
    const { data, error: refreshError } = await supabase
      .from('professional_portfolio_items')
      .select('id,user_id,item_type,title,description,result_summary,metric_value,metric_unit,period_label,visibility,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (refreshError) setError('حُفظ التغيير، لكن تعذر تحديث القائمة. أعد تحميل الصفحة.')
    else setItems((data || []) as PortfolioItem[])
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !userId) {
      setError('سجّل الدخول بحسابك المعتمد أولاً.')
      return
    }
    const title = form.title.trim()
    const description = form.description.trim()
    const metricValue = form.metric_value.trim() ? Number(form.metric_value) : null
    const metricUnit = form.metric_unit.trim()
    if (title.length < 2 || description.length < 2) {
      setNotice('أضف عنواناً ووصفاً واضحين قبل الحفظ.')
      return
    }
    if (metricValue !== null && (!Number.isFinite(metricValue) || metricValue < 0 || !metricUnit)) {
      setNotice('أدخل قيمة رقمية غير سالبة ووحدة قياس، أو اترك الحقول الرقمية فارغة.')
      return
    }
    setSaving(true)
    setNotice('')
    setError('')
    const payload = {
      user_id: userId,
      item_type: form.item_type,
      title,
      description,
      result_summary: form.item_type === 'skill' ? '' : form.result_summary.trim(),
      metric_value: form.item_type === 'skill' ? null : metricValue,
      metric_unit: form.item_type === 'skill' || metricValue === null ? '' : metricUnit,
      period_label: form.item_type === 'skill' || metricValue === null ? '' : form.period_label.trim(),
      visibility: form.visibility,
    }
    const result = editingId
      ? await supabase.from('professional_portfolio_items').update(payload).eq('id', editingId).eq('user_id', userId).select('id').maybeSingle()
      : await supabase.from('professional_portfolio_items').insert(payload).select('id').single()
    if (result.error) {
      setError('تعذر حفظ البطاقة. تحقق من اتصال الحساب ثم حاول مجدداً.')
    } else if (!result.data) {
      setError('لم يتم العثور على البطاقة المطلوب تعديلها ضمن سجلات حسابك.')
    } else {
      resetForm()
      setNotice(editingId ? 'تم تحديث البطاقة.' : 'تمت إضافة البطاقة إلى ملفك.')
      await refreshItems()
    }
    setSaving(false)
  }

  function editItem(item: PortfolioItem) {
    setEditingId(item.id)
    setForm({
      item_type: item.item_type,
      title: item.title,
      description: item.description,
      result_summary: item.result_summary || '',
      metric_value: item.metric_value === null ? '' : String(item.metric_value),
      metric_unit: item.metric_unit || '',
      period_label: item.period_label || '',
      visibility: item.visibility,
    })
    setNotice('تعدّل الآن بطاقة واحدة. احفظ التغييرات أو ألغِ التعديل.')
    setError('')
  }

  async function deleteItem(item: PortfolioItem) {
    if (!supabase || !userId || !window.confirm(`حذف بطاقة «${item.title}» من ملفك؟`)) return
    const { error: deleteError } = await supabase
      .from('professional_portfolio_items')
      .delete()
      .eq('id', item.id)
      .eq('user_id', userId)
    if (deleteError) setError('تعذر حذف البطاقة. حاول مرة أخرى.')
    else {
      setItems(current => current.filter(row => row.id !== item.id))
      if (editingId === item.id) resetForm()
      setNotice('تم حذف البطاقة من ملفك.')
    }
  }

  return <main className="public-page wrap career-page">
    <nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><Link to="/career-journey">الرحلة المهنية</Link><span>/</span><span>ملف الإنجاز</span></nav>
    <header className="career-page-intro">
      <span className="eyebrow"><FolderKanban size={15}/> أعمالك وما تضيفه للمهنة</span>
      <h1>ملف الإنجاز المهني</h1>
      <p className="hero-lead">اجمع مشاريعك، والمشكلات التي حللتها، والمهارات التي تستخدمها، والنتائج التي حققتها في مكان واحد مرتبط بحسابك.</p>
    </header>

    <div className="career-privacy-note">
      <ShieldCheck size={17}/>
      <span>تُحفظ البطاقات في حسابك، وتبدأ خاصة. لا تظهر أي بطاقة في الدليل العام إلا عندما تختار «عام» بنفسك، وبشرط أن يكون ملفك المهني الأساسي عاماً ومعتمداً. لا تضف أسماء مرضى أو عملاء أو معلومات سرية تخص جهة العمل. هذا النموذج لا يقبل شهادات أو مرفقات أو روابط خارجية.</span>
    </div>

    {loading
      ? <p className="career-empty-state" role="status">جارٍ تحميل ملفك المهني…</p>
      : !userId
        ? <section className="career-portfolio-panel">
            <h2>ملفك المهني محفوظ بحسابك</h2>
            <p>{error || 'سجّل الدخول حتى تبدأ.'}</p>
            <Link className="btn btn-primary" to="/login">تسجيل الدخول <ArrowLeft size={15}/></Link>
          </section>
        : <>
          {error && <p className="career-portfolio-error" role="alert">{error}</p>}
          <section className="career-portfolio-summary" aria-label="ملخص ملفك المهني">
            <div><strong>{items.length.toLocaleString('ar-SA')}</strong><span>كل البطاقات</span></div>
            {portfolioKinds.map(kind => <button type="button" key={kind.id} onClick={() => setFilter(kind.id)} className={filter === kind.id ? 'selected' : ''}>
              <b>{(counts[kind.id] || 0).toLocaleString('ar-SA')}</b><span>{kind.plural}</span>
            </button>)}
          </section>

          <section className="career-portfolio-panel">
            <div className="career-portfolio-heading">
              <div><span className="eyebrow">{editingId ? 'تعديل بطاقة' : 'إضافة إلى ملفك'}</span><h2>{editingId ? 'حدّث معلومات البطاقة' : 'أضف عملاً أو مهارة أو نتيجة'}</h2></div>
              {editingId && <button className="btn btn-quiet btn-small" type="button" onClick={resetForm}>إلغاء التعديل</button>}
            </div>
            <form className="career-portfolio-form" onSubmit={saveItem}>
              <label>نوع البطاقة
                <select value={form.item_type} onChange={event => setForm(current => ({ ...current, item_type: event.target.value as PortfolioItemType }))}>
                  {portfolioKinds.map(kind => <option key={kind.id} value={kind.id}>{kind.label}</option>)}
                </select>
              </label>
              <label>العنوان
                <input required minLength={2} maxLength={120} value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="مثال: تطوير آلية متابعة العمل"/>
              </label>
              <label className="career-portfolio-wide">وصف العمل أو المهارة
                <textarea required minLength={2} maxLength={1200} rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder={selectedKind.hint}/>
              </label>
              {form.item_type !== 'skill' && <>
                <label className="career-portfolio-wide">النتيجة أو الأثر (اختياري)
                  <textarea maxLength={1000} rows={2} value={form.result_summary} onChange={event => setForm(current => ({ ...current, result_summary: event.target.value }))} placeholder="ما الذي تغير؟ وما دورك في النتيجة؟"/>
                </label>
                <div className="career-portfolio-metrics career-portfolio-wide">
                  <label>قيمة رقمية (اختياري)
                    <input type="number" min="0" step="0.001" value={form.metric_value} onChange={event => setForm(current => ({ ...current, metric_value: event.target.value }))} placeholder="مثال: 12"/>
                  </label>
                  <label>وحدة القياس
                    <input maxLength={32} value={form.metric_unit} onChange={event => setForm(current => ({ ...current, metric_unit: event.target.value }))} placeholder="ساعة، نسبة، مهمة..."/>
                  </label>
                  <label>الفترة
                    <input maxLength={60} value={form.period_label} onChange={event => setForm(current => ({ ...current, period_label: event.target.value }))} placeholder="مثال: الربع الأول 2026"/>
                  </label>
                </div>
              </>}
              <label>من يمكنه رؤية البطاقة؟
                <select value={form.visibility} onChange={event => setForm(current => ({ ...current, visibility: event.target.value as PortfolioVisibility }))}>
                  <option value="private">خاص — أنا فقط</option>
                  <option value="public">عام — ضمن الدليل المهني</option>
                </select>
              </label>
              <p className="career-portfolio-inline-note"><LockKeyhole size={14}/> الوضع الافتراضي خاص. يمكنك تغيير الظهور لاحقاً بتعديل البطاقة.</p>
              <div className="career-portfolio-actions">
                <button className="btn btn-primary" type="submit" disabled={saving}><Check size={15}/>{saving ? 'جارٍ الحفظ…' : editingId ? 'حفظ التعديلات' : 'إضافة البطاقة'}</button>
                {editingId && <button className="btn btn-outline" type="button" onClick={resetForm} disabled={saving}>إلغاء</button>}
              </div>
            </form>
            {notice && <p className="career-local-message" role="status">{notice}</p>}
          </section>

          <section className="career-portfolio-items">
            <div className="career-portfolio-heading">
              <div><span className="eyebrow">إدارة ملفك</span><h2>{filter === 'all' ? 'كل بطاقاتك' : portfolioKinds.find(kind => kind.id === filter)?.plural}</h2></div>
              <button type="button" className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>عرض الكل</button>
            </div>
            {filteredItems.length === 0
              ? <p className="career-empty-state">لا توجد بطاقات في هذا القسم بعد. ابدأ بإضافة مشروع أو مهارة أو نتيجة من عملك.</p>
              : <div className="career-portfolio-grid">{filteredItems.map(item => {
                const kind = portfolioKinds.find(row => row.id === item.item_type) || portfolioKinds[0]
                return <article className="career-portfolio-card" key={item.id}>
                  <div className="career-portfolio-card-top"><span>{kind.label}</span><span className={item.visibility === 'public' ? 'is-public' : 'is-private'}>{item.visibility === 'public' ? <><Eye size={13}/> عام</> : <><EyeOff size={13}/> خاص</>}</span></div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  {item.result_summary && <div className="career-portfolio-result"><b>النتيجة أو الأثر</b><span>{item.result_summary}</span></div>}
                  {item.metric_value !== null && <div className="career-portfolio-measure"><strong>{Number(item.metric_value).toLocaleString('ar-SA', { maximumFractionDigits: 3 })}</strong><span>{item.metric_unit}</span>{item.period_label && <small>{item.period_label}</small>}</div>}
                  <div className="career-portfolio-card-actions">
                    <button type="button" onClick={() => editItem(item)}><Pencil size={14}/> تعديل</button>
                    <button type="button" onClick={() => void deleteItem(item)}><Trash2 size={14}/> حذف</button>
                  </div>
                </article>
              })}</div>}
          </section>
        </>}
  </main>
}


const promotionCatalog = [
  { id:'scope', label:'فهم نطاق الدور التالي', prompt:'اكتب 2–3 مسؤوليات أو قرارات من وصف رسمي للدور التالي.' },
  { id:'repeatability', label:'نتائج متكررة', prompt:'حدد نتيجتين على الأقل تكررتا في أكثر من دورة عمل.' },
  { id:'ownership', label:'ملكية وقرار', prompt:'وثّق قراراً مهنياً اتخذته ونتيجته وحدود صلاحيتك.' },
  { id:'collaboration', label:'تعاون وأثر عبر الفريق', prompt:'اكتب مثالاً على رفع جودة العمل أو مساعدة الآخرين، مع نسب أثر الفريق لأصحابه.' },
  { id:'skill', label:'مهارة مطبقة', prompt:'اختر مهارة ناقصة واذكر أين طبقتها وما التغذية الراجعة التي تلقيتها.' },
  { id:'manager', label:'معايير واضحة مع المدير', prompt:'اسأل مديرك: ما الفجوة المحددة؟ ما فرصة الإثبات؟ متى نراجعها؟' },
  { id:'policy', label:'معرفة السياسة والفرصة', prompt:'تحقق من المسار الوظيفي الداخلي والدورة والميزانية وأي معيار نظامي ينطبق.' },
]

export function PromotionIntelligencePage() {
  const [values, setValues] = useState<Record<string, number | null>>(() => Object.fromEntries(promotionCatalog.map(item => [item.id, null])))
  const [submitted, setSubmitted] = useState(false)
  const items: ReadinessItem[] = useMemo(() => promotionCatalog.map(item => ({ ...item, value: values[item.id] ?? null })), [values])
  const report = useMemo(() => submitted ? scorePromotionReadiness(items) : null, [submitted, items])
  return <main className="public-page wrap career-page"><nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><Link to="/career-journey">الرحلة المهنية</Link><span>/</span><span>Promotion Intelligence</span></nav><header className="career-page-intro"><span className="eyebrow"><Target size={15}/> أداة استعدادية، لا وعد بالقرار</span><h1>Promotion Intelligence</h1><p className="hero-lead">قِس اكتمال أدلتك ذاتياً، أنشئ محفظة ترقية خاصة، وجهّز محادثة واضحة مع المدير وخطة متابعة 90 يوماً.</p></header><div className="career-privacy-note"><ShieldCheck size={16}/><span>لا يضمن التقييم ترقية. تختلف السياسات بين الجهات؛ راجع لائحة جهة عملك. هذا النموذج محلي، ولا تُدخل مستندات داخلية أو معلومات أشخاص.</span></div><form className="career-readiness-form" onSubmit={event => { event.preventDefault(); setSubmitted(true) }}><SectionTitle title="Promotion Readiness Assessment" description="اختر التقدير الأقرب لكل محور: 0 غير متوفر، 1 ملاحظة غير موثقة، 2 دليل جزئي، 3 دليل متكرر أو متفق عليه."/>{promotionCatalog.map(item => <fieldset className="career-readiness-row" key={item.id}><legend><b>{item.label}</b><span>{item.prompt}</span></legend><div className="career-rating-scale" role="radiogroup" aria-label={item.label}>{[0,1,2,3].map(value => <label className={values[item.id] === value ? 'selected' : ''} key={value}><input type="radio" name={item.id} checked={values[item.id] === value} onChange={() => { setValues(current => ({ ...current, [item.id]: value })); setSubmitted(false) }}/><span>{value}</span></label>)}</div></fieldset>)}<button className="btn btn-primary" type="submit">احسب اكتمال الأدلة <ArrowLeft size={15}/></button></form>{submitted && !report && <div className="career-incomplete" role="alert"><h2>أكمل محاور التقييم</h2><p>لا تظهر نتيجة قبل تقييم كل محور؛ لا نخمن القيم الناقصة.</p></div>}{report && <section className="career-readiness-result" aria-live="polite"><div className="career-score-orbit"><span>اكتمال الأدلة المدخلة</span><strong>{report.score}<small>/100</small></strong><span>ليس احتمالاً أو ضماناً للترقية</span></div><div><h2>ماذا تعني النتيجة؟</h2><p>{report.interpretation}</p><h3>أعلى ثلاث فجوات</h3><ol>{report.evidenceGaps.map(item => <li key={item.id}><b>{item.label}</b><span>{item.prompt}</span></li>)}</ol><h3>خطوات العمل التالية</h3><ul>{report.nextSteps.map(item => <li key={item}>{item}</li>)}</ul></div></section>}
    <section className="career-conversation-guide"><SectionTitle title="Promotion Conversation Guide" description="حوّل طلب الترقية إلى معايرة مشتركة قابلة للمتابعة."/><div className="career-conversation-quote">«أستهدف مستوى [المستوى]. هذه أمثلتي على مسؤولياته ونتائجه. ما الأدلة أو السلوكيات الناقصة برأيك؟ وما فرصة العمل المناسبة لإثباتها، ومتى نراجع التقدم؟»</div><ol><li>أرسل الملخص قبل الموعد؛ اختر 2–3 أدلة فقط.</li><li>استمع للمعايير والميزانية والدورة؛ لا تطلب وعداً فورياً.</li><li>اتفق على مشروع ومقياس وموعد مراجعة مكتوب.</li><li>راجع بعد 30 و60 و90 يوماً، وحدّث الخطة عند ظهور دليل جديد.</li></ol></section><EvidenceTracker title="Promotion Portfolio · ملف أدلة الترقية" helper="سجل أمثلة المسؤوليات والنتائج هنا محلياً، ثم احتفظ بالأصول في مكان الجهة المعتمد."/><div className="career-inline-links"><Link to="/articles/promotion-readiness">اقرأ دليل الاستعداد للترقية <ArrowLeft size={14}/></Link><Link to="/achievement-portfolio">افتح ملف الإنجازات <ArrowLeft size={14}/></Link><Link to="/value-economy">اقتصاد القيمة المهنية <ArrowLeft size={14}/></Link></div></main>
}

export function InnovationRDPage() {
  const stages = [
    ['الاختراع (Invention)','فكرة أو أصل تقني جديد؛ لم يثبت بعد أن له مستخدماً أو نتيجة نافعة.'],
    ['البحث (Research)','سؤال قابل للفحص ومنهج وبيانات وأخلاقيات؛ إنتاج معرفة لا يساوي تطبيقاً جاهزاً.'],
    ['البحث والتطوير (R&D)','البحث والتطوير هو تحويل المعرفة أو نتائج البحث إلى منتج أو خدمة أو عملية قابلة للاختبار، مع توضيح الفرضية والمخاطر والملكية.'],
    ['الابتكار (Innovation)','تطبيق جديد أو محسّن يحقق قيمة لمستخدم أو جهة؛ القيمة تتطلب تبنياً ونتيجة قابلة للقياس.'],
    ['الملكية الفكرية (IP)','تشمل الحقوق المرتبطة بالاختراعات والتصاميم والبرمجيات والمصنفات والعلامات؛ راجع المساهمات والعقود وحقوق جهة العمل قبل النشر أو طلب براءة.'],
    ['نقل المعرفة والتسويق (Commercialization)','تقييم المستخدم والتكلفة والتنظيم والقدرة على التوسع؛ لا يضمن الاختراع دخلاً أو راتباً.'],
  ]
  const roles = ['منسق أبحاث سريرية','مدير عمليات البحث','أخصائي معلوماتية صحية','باحث تطبيقات أو تنفيذ','مدير منتج صحي','أخصائي ابتكار ونقل تقنية','قائد تحسين جودة/سلامة']
  return <main className="public-page wrap career-page"><nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><Link to="/career-journey">الرحلة المهنية</Link><span>/</span><span>الابتكار والبحث والتطوير</span></nav><header className="career-page-intro"><span className="eyebrow"><Lightbulb size={15}/> من الفكرة إلى قيمة مهنية</span><h1>الابتكار والاختراع والبحث والتطوير</h1><p className="hero-lead">ابتكار جيد لا يعني تلقائياً منتجاً أو براءة أو زيادة راتب. اتبع مساراً يختبر المشكلة والمستخدم والدليل والملكية والأثر والتنظيم قبل إعلان القيمة.</p></header><div className="career-innovation-grid">{stages.map(([title,text],index) => <article className="career-innovation-card" key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}</div><section className="career-project-gates"><SectionTitle title="ست بوابات قبل أن تسمي الفكرة ابتكاراً ذا قيمة"/><ol><li><b>حاجة موثقة:</b> من المستخدم؟ ما المشكلة الفعلية؟ ما الدليل أنها ليست مجرد افتراض؟</li><li><b>مسار مسؤول:</b> هل يلزم مراجعة أخلاقية أو تنظيمية أو أمنية قبل أي تجربة؟</li><li><b>تجربة محدودة:</b> من يوافق عليها؟ ما حدودها ومقاييس إيقافها؟</li><li><b>قياس منصف:</b> قارن خط أساس محدداً بنتيجة، واذكر العوامل الأخرى ودور الفريق.</li><li><b>ملكية واضحة:</b> تحقّق من سياسة جهة العمل والعقود ومساهمات المخترعين والباحثين قبل النشر أو الإفصاح.</li><li><b>تبنٍ واستدامة:</b> هل اعتمدها مستخدم؟ هل تشمل الكلفة والتدريب والصيانة والمخاطر؟</li></ol><div className="career-privacy-note"><ShieldCheck size={16}/><span>في قطاع الصحة لا تُجرّب على مرضى أو بيانات واقعية بلا موافقة الجهة ومتطلبات الخصوصية والأخلاقيات والترخيص. لا تنشر اختراعاً أو كوداً مملوكاً قبل استشارة الجهة المختصة.</span></div></section><section className="career-rd-careers"><SectionTitle title="مسارات البحث والتطوير" description="Research & Development Careers · مسارات انتقال محتملة بحسب التخصص، وليست توصية بوظيفة أو توقعاً للسوق."/><div className="career-role-cloud">{roles.map(role => <span key={role}>{role}</span>)}</div><div className="career-rd-portfolio"><b>ملف أعمال الباحث أو المبتكر (Portfolio)</b><p>صفحة واحدة لكل عمل: سؤال/حاجة، دورك وحدوده، المنهج أو النموذج، نتيجة معتمدة، الدروس والقيود، حالة الملكية والنشر، ورابط مصرح بمشاركته. إن كنت تنتقل من الأكاديمية إلى الصناعة، ترجم المخرج البحثي إلى قرار أو قدرة أو تطبيق واضح، دون إخفاء عدم اليقين.</p><Link to="/articles/innovation-value">اقرأ دليل الابتكار والقيمة <ArrowLeft size={14}/></Link></div></section><div className="career-inline-links"><Link to="/articles/ai-career-leverage">وظائف البحث والتطوير والذكاء الاصطناعي <ArrowLeft size={14}/></Link><Link to="/ai-career-leverage">العمل والابتكار مع AI <ArrowLeft size={14}/></Link><Link to="/achievement-portfolio">وثّق دليلك المهني <ArrowLeft size={14}/></Link></div></main>
}

export function AILeveragePage() {
  const workflows = [
    ['1. عرّف (Define)','حدّد مخرجاً يمكن التحقق منه، ومدخلاً مسموحاً به، وما لا يجوز إدخاله.'],
    ['2. فوّض (Delegate)','اجعل AI يقترح هيكلاً أو مسودة أو تصنيفاً، لا قرار رعاية ولا حكم توظيف ولا موافقة.'],
    ['3. تحقّق (Verify)','راجع المصدر والمصطلحات والحسابات والتمثيل والتحيز؛ استخدم إنساناً مختصاً للمراجعة.'],
    ['4. أدمج (Integrate)','اربط الخطوة بأداة معتمدة وسجّل من راجعها؛ أوقفها إذا لم تحسن الجودة أو الزمن أو السلامة.'],
    ['5. قِس (Measure)','قارن خط أساس ومخرج ووقت وتكلفة وأخطاء قبل/بعد، مع توضيح أن الارتباط لا يثبت السببية.'],
  ]
  const patterns = [
    ['مقارنة متطلبات الأدوار','ألصق أوصافاً وظيفية منشورة وغير سرية. اطلب جدول مهارات متكررة وأسئلة تحقق، ثم راجع كل استنتاج مع المصدر الأصلي.'],
    ['صياغة مهنية أولية','أدخل وصفاً عاماً لنشاطك بلا أسماء أو أرقام حساسة. اطلب 3 صيغ ثم دققها واحتفظ بصوتك ونسبتك الصحيحة للأثر.'],
    ['تلخيص اجتماع منقح','حوّل الملاحظات إلى مسؤوليات وموعد متابعة بعد حذف الأشخاص والعملاء والتفاصيل المحمية. راجع كل نقطة قبل إرسالها.'],
    ['تحويل مخرج إلى دليل','اطلب قالب بطاقة «مشكلة/دور/فعل/نتيجة/قيد». أنت تتحقق من البيانات وتحدد ما يمكن مشاركته.'],
  ]
  return <main className="public-page wrap career-page"><nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><Link to="/career-journey">الرحلة المهنية</Link><span>/</span><span>توظيف الذكاء الاصطناعي لرفع القيمة المهنية (AI Career Leverage)</span></nav><header className="career-page-intro"><span className="eyebrow"><Sparkles size={15}/> الإنسان والذكاء الاصطناعي (Human + AI) · لا دورة أدوات</span><h1>توظيف الذكاء الاصطناعي لرفع القيمة المهنية</h1><p className="hero-lead">ارفع قيمة عملك باستخدام AI حين تقلل عملاً متكرراً أو تحسن جودة قرار قابل للمراجعة، مع حوكمة وأمن وقياس بشري. لا تجعل الأداة بديلاً عن الاختصاص أو المساءلة.</p></header><div className="career-privacy-note"><ShieldCheck size={16}/><span>لا تدخل بيانات مرضى أو معلومات صحية شخصية أو ملفات عملاء أو كلمات مرور أو بيانات جهة العمل السرية في نموذج ذكاء اصطناعي، إلا عبر أداة معتمدة وسياسة رسمية واضحة. لا تنفذ Agent تغييرات أو قرارات نيابة عنك بلا مراجعة وصلاحية.</span></div><section className="career-ai-cycle">{workflows.map(([title,text],index) => <article key={title}><span>0{index + 1}</span><h2>{title}</h2><p>{text}</p></article>)}</section><section className="career-ai-workflows"><SectionTitle title="Workflows عملية قابلة للمراجعة" description="ابدأ بمهام غير سريرية ومنخفضة المخاطر، مع بيانات عامة أو منقحة."/><div className="career-radar-grid">{patterns.map(([title,text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}</div></section><section className="career-ai-governance"><SectionTitle title="حوكمة وأمن قبل الإنتاج"/><ul><li>اعرف أين تذهب البيانات ومدة الاحتفاظ بها، وهل تستخدم في تدريب النموذج.</li><li>استخدم حساباً وأداة وافقت عليها الجهة، ومبدأ أقل صلاحية، وسجّل من راجع المخرج.</li><li>اختبر المخرجات ضد مثال مرجعي وانحياز محتمل وسيناريو فشل، وضع مساراً للإيقاف والتراجع.</li><li>تحقق من ترخيص المحتوى والملكية والإفصاح قبل نشر ما أنشأه النظام.</li><li>قِس وقت المهمة والجودة والأخطاء معاً؛ توفير الوقت بلا دقة أو ثقة لا يساوي قيمة.</li><li>Agents وAutomation تنفذ ضمن سير عمل محدد؛ لا تمنحها صلاحية إرسال أو نشر أو وصول للبيانات إلا باعتماد.</li></ul></section><div className="career-inline-links"><Link to="/articles/ai-career-leverage">اقرأ دليل AI في العمل المهني <ArrowLeft size={14}/></Link><Link to="/articles/innovation-value">الابتكار من الفكرة إلى القيمة <ArrowLeft size={14}/></Link><Link to="/achievement-portfolio">وثّق القيمة والدليل <ArrowLeft size={14}/></Link></div></main>
}

type RadarArticle = { id: string; title: string; slug: string; excerpt: string | null; published_at: string | null }
export function SaudiLaborMarketRadarPage() {
  const [articles, setArticles] = useState<RadarArticle[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState(supabase ? '' : 'قاعدة المحتوى غير مهيأة في هذا الإصدار.')
  useEffect(() => {
    let active = true
    if (!supabase) return
    const client = supabase
    const loadRadar = async () => {
      const { data, error: queryError } = await client.from('articles').select('id,title,slug,excerpt,published_at').eq('status','published').or('slug.eq.saudi-labor-market,slug.eq.saudi-labor-market-radar,slug.like.radar-%').order('published_at',{ ascending:false }).limit(20)
      if (!active) return
      if (queryError) setError('تعذر جلب آخر التحديثات الآن؛ أعد المحاولة لاحقاً.')
      else setArticles((data ?? []) as RadarArticle[])
      setLoading(false)
    }
    void loadRadar().catch(() => { if (active) { setError('تعذر جلب آخر التحديثات الآن؛ أعد المحاولة لاحقاً.'); setLoading(false) } })
    return () => { active = false }
  }, [])
  const latest = articles[0]
  const checkedDate = latest?.published_at ? new Date(latest.published_at).toLocaleDateString('ar-SA-u-ca-gregory',{ year:'numeric',month:'long',day:'numeric' }) : ''
  return <main className="public-page wrap career-page"><nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><Link to="/career-journey">الرحلة المهنية</Link><span>/</span><span>Saudi Labor Market Radar</span></nav><header className="career-page-intro"><span className="eyebrow"><LineChart size={15}/> رصد قابل للتحديث من CMS</span><h1>Saudi Labor Market Radar</h1><p className="hero-lead">مؤشرات ومقالات تحليلية موثقة عن المهارات والوظائف والقطاعات والتوطين والذكاء الاصطناعي والتنظيمات. لا نعرض لوحة أرقام لحظية أو توقع توظيف فردي.</p></header><div className="career-privacy-note"><CircleHelp size={16}/><span>يعرض هذا المسار آخر التحليلات المنشورة من مكتبة الموقع. كل إصدار يحمل تاريخ مراجعة وروابط مصادره؛ لا يعني تغير مؤشر كلي زيادة فرصة فرد بعينه.</span></div><section className="career-radar-meta"><div><span className="eyebrow">آخر تحليل منشور</span><b>{loading ? 'جارٍ التحديث…' : latest ? latest.title : 'لم ينشر تحليل رادار بعد'}</b><small>{checkedDate ? `تاريخ النشر: ${checkedDate}` : error || 'ستظهر التحليلات المؤهلة هنا بعد نشرها.'}</small></div><span className="career-radar-live"><i/>متصل بمقالات الموقع المنشورة</span></section><section className="career-radar-grid">{[
    ['المهارات والوظائف','قارن إعلانات حديثة ومصادر التصنيف، وسجل المصطلحات المتكررة مع تاريخ العينة.'],
    ['القطاعات والتحولات','اربط المؤشر الرسمي بمصدره وبالقطاع والسياق؛ لا تعمم نتيجة قطاع على كل المهن.'],
    ['التوطين والتنظيمات','اقرأ نطاق القرار وتاريخ سريانه والفئات المشمولة من النص الرسمي قبل الاستنتاج.'],
    ['AI والأتمتة','ميّز بين التجربة، والتبني، والأثر الوظيفي الموثق؛ لا تصف كل أداة كإحلال لعمل مهني.'],
  ].map(([title,text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}</section><section className="career-radar-updates"><SectionTitle eyebrow="متجدد من CMS" title="آخر التحديثات المنشورة" description="كل مقال جديد يحمل بادئة radar- يظهر هنا بعد نشره في مكتبة الموقع؛ وبذلك لا تعتمد الصفحة على نص ثابت."/>{error && !articles.length && <p className="career-error-note" role="status">{error}</p>}{articles.length ? <div className="career-radar-article-list">{articles.map(article => <article key={article.id}><time>{article.published_at ? new Date(article.published_at).toLocaleDateString('ar-SA-u-ca-gregory') : 'تاريخ غير متاح'}</time><h3><Link to={`/articles/${article.slug}`}>{article.title}</Link></h3><p>{article.excerpt}</p><Link to={`/articles/${article.slug}`}>اقرأ التحليل والمصادر <ArrowLeft size={14}/></Link></article>)}</div> : <div className="career-empty-state">{loading ? 'جارٍ تحميل التحليلات…' : 'لا يوجد تحليل رادار منشور بعد. عندما تنشر هيئة تحرير الموقع تحديثاً بعنوان radar-… سيظهر هنا تلقائياً، مع صفحة SEO مستقلة ومصادر المقال.'}</div>}</section><section className="career-radar-workflow"><SectionTitle title="من مصدر إلى قرار مهني"/><div className="career-radar-flow"><span>مصدر رسمي وتاريخ</span><i>←</i><span>تحليل وحدود</span><i>←</i><span>مقال SEO</span><i>←</i><span>مختصر اجتماعي</span><i>←</i><span>سؤال/تجربة</span></div><Link className="btn btn-outline" to="/articles">افتح مكتبة المقالات المنشورة <ArrowLeft size={15}/></Link></section></main>
}

export function ProfessionalPositioningPage() {
  const [values, setValues] = useState({ audience: '', problem: '', capability: '', proof: '', direction: '' })
  const output = useMemo(() => buildPositioningStatement(values), [values])
  const fields: [keyof typeof values,string,string][] = [
    ['audience','من تستفيد من عملك؟','فئة أو فريق، لا اسم شخص أو مريض'],
    ['problem','ما المشكلة المهنية التي تساعد في حلها؟','حاجة أو قرار قابل للوصف'],
    ['capability','ما القدرة التي تستخدمها؟','مهارة مطبقة في سياق محدد'],
    ['proof','ما الدليل الذي يسمح لك بمشاركته؟','مشروع عام أو مثال مصرح به'],
    ['direction','ما الدور أو المجال الذي تريد استكشافه؟','لا تكتب هدفاً غير متأكد منه؛ صف ما تختبره'],
  ]
  return <main className="public-page wrap career-page"><nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><Link to="/career-journey">الرحلة المهنية</Link><span>/</span><span>التموضع المهني</span></nav><header className="career-page-intro"><span className="eyebrow"><Target size={15}/> جملة تموضع مبنية على الدليل</span><h1>صُغ تموضعك المهني</h1><p className="hero-lead">جملة قصيرة توضّح لمن تقدم قيمة، وما المشكلة، وبأي قدرة، وما الدليل، وإلى أين تتجه. راجعها واحذف كل ما لا تستطيع شرحه أو إثباته.</p></header><LocalNote/><section className="career-form-card"><div className="career-form-grid">{fields.map(([key,label,hint]) => <label key={key}>{label}<textarea rows={2} maxLength={250} value={values[key]} onChange={event => setValues({ ...values,[key]:event.target.value })} placeholder={hint}/></label>)}</div><div className="career-positioning-output" aria-live="polite"><span className="eyebrow">مسودة تموضع</span><p>{output ? `«${output}»` : 'أكمل الحقول الخمسة لنولّد صيغة مبدئية.'}</p><span className="career-small-note">هذه صياغة قالبية، لا اعتماداً مهنياً. راجع دقة الوصف والسرية والملكية قبل الاستخدام.</span></div><div className="career-form-actions"><button className="btn btn-outline" type="button" disabled={!output} onClick={() => void navigator.clipboard?.writeText(output)}>نسخ المسودة</button><button className="btn btn-quiet" type="button" onClick={() => setValues({ audience:'',problem:'',capability:'',proof:'',direction:'' })}>مسح المدخلات</button></div></section><div className="career-inline-links"><Link to="/career-compass">ارجع إلى البوصلة <ArrowLeft size={14}/></Link><Link to="/articles/professional-value">اقرأ اقتصاد القيمة المهنية <ArrowLeft size={14}/></Link><Link to="/linkedin-audit">قيّم ظهورك في LinkedIn <ArrowLeft size={14}/></Link></div></main>
}

function LocalNote() { return <div className="career-privacy-note"><ShieldCheck size={16}/><span>لا تُرسل المدخلات إلى الخادم ولا تُحفظ؛ لا تكتب تفاصيل شخصية حساسة أو معلومات خاصة بجهة عمل.</span></div> }

const workshopModules = [
  { id:'intent',title:'1. قبل التحرير: حدّد التموضع',time:'8 دقائق',objective:'اختر الجمهور والدور والمشكلة التي تريد أن يفهمها الزائر.',exercise:'اكتب جملة: أساعد [الفئة] على [نتيجة] عبر [قدرة]، ودليلي [مشروع/إنجاز]. ضع كلمة «خريج» أو «متدرب» حيث يلزم.' },
  { id:'headline',title:'2. Headline وAbout',time:'10 دقائق',objective:'حوّل العنوان إلى تعريف مهني محدد، واجعل About قصة قصيرة من دليل وخطوة قادمة.',exercise:'Headline: [الدور أو المجال] | [مهارتان ذات صلة] | [نتيجة/مشكلة]. About: سياق، قدرتان، دليل، مجال اهتمام. احذف الوعود والصفات العامة.' },
  { id:'experience',title:'3. الخبرة والإنجازات',time:'10 دقائق',objective:'اكتب مساهمتك بصيغة الفعل والسياق والنتيجة، مع توضيح عمل الفريق.',exercise:'حوّل «مسؤول عن التقارير» إلى فعل + نطاق + أداة + نتيجة قابلة للتحقق. إن لم يتوفر رقم، اذكر مخرجاً نوعياً مصرحاً به.' },
  { id:'featured',title:'4. Featured وPortfolio',time:'8 دقائق',objective:'اختر عينات تشرح ما فعلته وتحترم الملكية والسرية.',exercise:'أضف عند الإمكان: دراسة حالة عامة، رابط Portfolio أو مشروع مسموح، ومنشور يشرح درساً. لا ترفع شاشات أنظمة أو محتوى مؤسسي بلا موافقة.' },
  { id:'skills',title:'5. المهارات والكلمات الدقيقة',time:'7 دقائق',objective:'اربط المهارات بما استخدمته فعلاً وبالدور المستهدف، لا بقائمة عشوائية.',exercise:'استخرج من ثلاثة أوصاف أدوار المصطلحات المتكررة، ثم اختر المهارات التي تملك لها مثالاً. استخدم تصنيفاً مهنياً رسمياً عند توفره.' },
  { id:'content',title:'6. خطة 30 يوماً والمراجعة',time:'10 دقائق',objective:'انشر منظوراً مهنياً موثقاً وراجع الملف مع شخص موثوق.',exercise:'خلال أربعة أسابيع: درس من عمل عام، تفكيك أداة، إشارة سوق موثقة، ثم سؤال مهني. لكل منشور مصدر أو تجربة محددة وحدّ واضح.' },
]

export function LinkedInWorkshopPage() {
  const [done, setDone] = useState<string[]>([])
  const progress = Math.round(done.length / workshopModules.length * 100)
  const toggle = (id: string) => setDone(current => current.includes(id) ? current.filter(item => item !== id) : [...current,id])
  return <main className="public-page wrap career-page"><nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><Link to="/career-journey">الرحلة المهنية</Link><span>/</span><span>ورشة LinkedIn</span></nav><header className="career-page-intro"><span className="eyebrow"><BookOpen size={15}/> ورشة ذاتية · 45–60 دقيقة</span><h1>اختراق LinkedIn</h1><p className="hero-lead"><b>من ملف ساكن إلى أصل مهني.</b> ورشة تطبيقية تحوّل الملف إلى رسالة واضحة، وأدلة مرئية، وخطة محتوى قابلة للاستمرار من دون مطاردة خوارزمية أو نشر معلومات سرية.</p></header><div className="career-workshop-outcomes"><span><Check size={15}/>صياغة تموضع وHeadline</span><span><Check size={15}/>تنقيح About والخبرة</span><span><Check size={15}/>اختيار عينات Featured</span><span><Check size={15}/>خطة مراجعة 30 يوماً</span></div><div className="career-privacy-note"><ShieldCheck size={16}/><span>لا توجد جلسة بث أو تسجيل مجدول حالياً. هذه نسخة تعلّم ذاتي منشورة داخل الموقع؛ يستطيع مدير المركز لاحقاً جدولة ورشة أو غرفة أعضاء من Learning Center بعد تهيئة مزود الفيديو واعتماد الإعدادات.</span></div><section className="career-workshop-progress"><div><span className="eyebrow">تقدم الورشة على هذه الجلسة فقط</span><strong>{progress}%</strong></div><div className="career-progress-track"><span style={{ width:`${progress}%` }}/></div></section><section className="career-workshop-modules">{workshopModules.map(module => <details className="career-workshop-module" key={module.id}><summary><span className="career-module-check"><input aria-label={`إكمال ${module.title}`} type="checkbox" checked={done.includes(module.id)} onClick={event => event.stopPropagation()} onChange={() => toggle(module.id)}/></span><span><b>{module.title}</b><small>{module.time}</small></span></summary><div className="career-module-content"><p><b>الهدف:</b> {module.objective}</p><p><b>التمرين:</b> {module.exercise}</p><label>ملاحظات التمرين<textarea rows={2} maxLength={500} placeholder="ملاحظاتك لا تُحفظ تلقائياً؛ اكتب مسودة عامة فقط."/></label></div></details>)}</section><section className="career-workshop-action-plan"><SectionTitle title="Action Plan · خطة ما بعد الورشة"/><ol><li>اليوم 1: حدّث headline وAbout، ثم اطلب مراجعة من زميل موثوق.</li><li>الأسبوع 1: اختر تجربة Featured واحدة مصرحاً بها واحذف أي عنصر قديم مضلل.</li><li>الأسبوع 2: حدّث مهارات ترتبط بأمثلة حقيقية في الخبرة.</li><li>الأسبوعان 3–4: انشر فكرة مهنية موثقة مرة أسبوعياً، وراجع الرسالة بعد شهر.</li></ol><div className="career-workshop-actions"><Link className="btn btn-outline" to="/linkedin-audit">افتح LinkedIn Audit <ArrowLeft size={15}/></Link><Link className="btn btn-primary" to="/professional-positioning">اكتب التموضع المهني <ArrowLeft size={15}/></Link><Link className="btn btn-quiet" to="/learning">مركز التعلّم للأعضاء <ArrowLeft size={15}/></Link></div></section><div className="career-inline-links"><Link to="/articles/linkedin-workshop">اقرأ الدليل الكامل والمصادر <ArrowLeft size={14}/></Link><Link to="/articles/achievement-portfolio">جهّز ملف الإنجازات <ArrowLeft size={14}/></Link><Link to="/articles">مكتبة المجتمع <ArrowLeft size={14}/></Link></div></main>
}
