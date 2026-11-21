import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, BarChart3, CheckCircle2, ChevronDown, ClipboardList, Filter, Lightbulb, RefreshCw, Save, Search, ShieldCheck, Target, Users } from 'lucide-react'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'
import './HiddenSoldierWorkshop.css'

const WORKSHOP = 'hidden-soldier'
type Submission = {
  id: string; user_id: string; problem: string; desired_outcome: string
  personal_contribution: string; evidence: string; improvement_proposal: string
  responsibility_request: string; baseline_value: string; result_value: string
  metric_unit: string; problem_category: string; impact_area: string; outcome_type: string
  baseline_number: number | null; result_number: number | null; measurement_unit: string
  status: 'draft' | 'submitted' | 'reviewed'; submitted_at: string | null; updated_at: string
}
type Profile = { user_id: string; display_name: string; profession: string; specialty: string }
type FormValues = Omit<Submission, 'id' | 'user_id' | 'status' | 'submitted_at' | 'updated_at'> & { id?: string }
const emptyForm: FormValues = {
  problem: '', desired_outcome: '', personal_contribution: '', evidence: '',
  improvement_proposal: '', responsibility_request: '', baseline_value: '', result_value: '',
  metric_unit: '', problem_category: 'other', impact_area: 'other', outcome_type: 'improve',
  baseline_number: null, result_number: null, measurement_unit: '',
}
const fields: { key: keyof FormValues; title: string; hint: string; max: number }[] = [
  { key: 'problem', title: 'المشكلة أو المهمة', hint: 'صف موقفاً محدداً تكرر أو عطّل العمل. تجنب وصف وظيفتك بشكل عام.', max: 2000 },
  { key: 'desired_outcome', title: 'النتيجة التي أستهدفها', hint: 'ما التغيير الذي تريد الوصول إليه؟ اجعله واضحاً ويمكن ملاحظته أو قياسه.', max: 1500 },
  { key: 'personal_contribution', title: 'مساهمتي الشخصية', hint: 'ما الذي قمت به أنت تحديداً؟ افصل مساهمتك عن عمل الفريق.', max: 2000 },
  { key: 'evidence', title: 'الدليل على النتيجة', hint: 'تقرير، سجل، مؤشر، مقارنة قبل وبعد، أو ملاحظة موثقة. لا ترفق بيانات سرية.', max: 2000 },
  { key: 'improvement_proposal', title: 'اقتراحي للتحسين', hint: 'ما الخطوة العملية التالية؟ وكيف يمكن اختبارها؟', max: 2000 },
  { key: 'responsibility_request', title: 'المسؤولية التي أطلبها', hint: 'حدد نطاق المسؤولية والصلاحية المطلوبة وكيف ستُقاس النتيجة.', max: 1500 },
]
const categories = [
  { value: 'process', label: 'إجراءات وسير العمل' }, { value: 'communication', label: 'التواصل والتنسيق' },
  { value: 'quality', label: 'الجودة والأخطاء' }, { value: 'time', label: 'الوقت والتأخير' },
  { value: 'customer', label: 'تجربة المستفيد' }, { value: 'team', label: 'الفريق وتوزيع العمل' },
  { value: 'other', label: 'أخرى' },
]
const areas = [
  { value: 'operations', label: 'التشغيل' }, { value: 'service', label: 'الخدمة' },
  { value: 'quality', label: 'الجودة' }, { value: 'cost', label: 'التكلفة والموارد' },
  { value: 'time', label: 'الوقت والإنتاجية' }, { value: 'experience', label: 'تجربة المستفيد' },
  { value: 'team', label: 'أداء الفريق' }, { value: 'other', label: 'أخرى' },
]
const outcomes = [
  { value: 'reduce', label: 'تقليل' }, { value: 'increase', label: 'زيادة' },
  { value: 'improve', label: 'تحسين' }, { value: 'prevent', label: 'منع' },
  { value: 'standardize', label: 'توحيد إجراء' }, { value: 'other', label: 'أخرى' },
]
const labelFor = (items: { value: string; label: string }[], value: string) => items.find(item => item.value === value)?.label || 'غير محدد'

export function HiddenSoldierWorkshop({ role }: { role: Role }) {
  const facilitator = role === 'owner' || role === 'manager' || role === 'coach'
  const [userId, setUserId] = useState('')
  const [form, setForm] = useState<FormValues>(emptyForm)
  const [rows, setRows] = useState<Submission[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'participants'>('overview')

  const load = useCallback(async () => {
    if (!supabase) { setError('خدمة الحفظ غير متصلة حالياً.'); setLoading(false); return }
    setLoading(true); setError('')
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) { setError('سجّل الدخول بحساب معتمد للمشاركة في الورشة.'); setLoading(false); return }
    setUserId(authData.user.id)
    const { data, error: queryError } = await supabase.from('workshop_submissions').select('*').eq('workshop_slug', WORKSHOP).order('updated_at', { ascending: false })
    if (queryError) { setError('تعذر تحميل بيانات الورشة. أعد المحاولة بعد التحقق من اتصال الحساب.'); setLoading(false); return }
    const submissions = (data || []) as Submission[]
    setRows(submissions)
    const mine = submissions.find(item => item.user_id === authData.user.id)
    setForm(mine ? { ...emptyForm, ...mine } : emptyForm)
    if (facilitator && submissions.length) {
      const ids = [...new Set(submissions.map(item => item.user_id))]
      const { data: people } = await supabase.from('profiles').select('user_id,display_name,profession,specialty').in('user_id', ids)
      setProfiles(Object.fromEntries(((people || []) as Profile[]).map(person => [person.user_id, person])))
    }
    setLoading(false)
  }, [facilitator])

  useEffect(() => { void load() }, [load])

  async function save(publish: boolean, event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (!supabase || !userId) return
    setSaving(true); setError(''); setNotice('')
    const now = new Date().toISOString()
    const payload = {
      workshop_slug: WORKSHOP, user_id: userId,
      problem: form.problem.trim(), desired_outcome: form.desired_outcome.trim(),
      personal_contribution: form.personal_contribution.trim(), evidence: form.evidence.trim(),
      improvement_proposal: form.improvement_proposal.trim(), responsibility_request: form.responsibility_request.trim(),
      problem_category: form.problem_category, impact_area: form.impact_area, outcome_type: form.outcome_type,
      baseline_number: form.baseline_number, result_number: form.result_number,
      measurement_unit: form.measurement_unit.trim(),
      baseline_value: form.baseline_number === null ? form.baseline_value.trim() : String(form.baseline_number),
      result_value: form.result_number === null ? form.result_value.trim() : String(form.result_number),
      metric_unit: form.measurement_unit.trim() || form.metric_unit.trim(),
      status: publish ? 'submitted' : 'draft',
      submitted_at: publish ? now : null,
      updated_at: now,
    }
    const { error: saveError } = await supabase.from('workshop_submissions').upsert(payload, { onConflict: 'workshop_slug,user_id' })
    setSaving(false)
    if (saveError) { setError('تعذر حفظ البطاقة. تأكد من اكتمال البيانات المطلوبة عند الإرسال النهائي.'); return }
    setNotice(publish ? 'تم إرسال بطاقة الأثر بنجاح. ظهرت الآن ضمن بيانات الورشة.' : 'تم حفظ المسودة. تقدر ترجع وتكملها قبل الإرسال النهائي.')
    await load()
  }

  const participantSubmission = rows.find(item => item.user_id === userId)
  const completedFields = fields.filter(field => String(form[field.key] || '').trim()).length
  const readyToSubmit = completedFields === fields.length && Boolean(form.problem_category && form.impact_area && form.outcome_type)
  const submittedRows = rows.filter(row => row.status === 'submitted' || row.status === 'reviewed')
  const evidenceCount = submittedRows.filter(row => row.evidence.trim().length > 0).length
  const proposalCount = submittedRows.filter(row => row.improvement_proposal.trim().length > 0).length
  const categoryStats = categories.map(category => ({
    ...category,
    count: submittedRows.filter(row => row.problem_category === category.value).length,
  })).sort((a, b) => b.count - a.count)
  const areaStats = areas.map(area => ({
    ...area,
    count: submittedRows.filter(row => row.impact_area === area.value).length,
  })).sort((a, b) => b.count - a.count)
  const outcomeStats = outcomes.map(outcome => ({
    ...outcome,
    count: submittedRows.filter(row => row.outcome_type === outcome.value).length,
  })).sort((a, b) => b.count - a.count)
  const measurableCount = submittedRows.filter(row => row.baseline_number !== null && row.result_number !== null).length
  const filteredRows = useMemo(() => rows.filter(row => {
    const categoryMatch = filterCategory === 'all' || row.problem_category === filterCategory
    const person = profiles[row.user_id]
    const haystack = [row.problem, row.desired_outcome, row.improvement_proposal, person?.display_name, person?.profession].join(' ').toLowerCase()
    return categoryMatch && haystack.includes(searchTerm.toLowerCase())
  }), [rows, profiles, filterCategory, searchTerm])
  const maxCategory = Math.max(1, ...categoryStats.map(item => item.count))
  const maxArea = Math.max(1, ...areaStats.map(item => item.count))

  return <section className="hidden-soldier" aria-labelledby="hidden-soldier-title">
    <header className="hidden-soldier-hero">
      <div><span className="eyebrow">ورشة تطبيقية · مجتمع السيطرة المهنية</span><h2 id="hidden-soldier-title">الجندي الخفي: من الإنجاز إلى التأثير</h2><p>حوّل مشكلة حقيقية في عملك إلى نتيجة واضحة، ودليل يثبت مساهمتك، وخطوة مهنية قابلة للتنفيذ.</p></div>
      <span className="hidden-soldier-mark"><ShieldCheck size={28}/></span>
    </header>

    {!facilitator && <div className="hidden-soldier-steps">
      {fields.map((field, index) => <article className="hidden-soldier-step" key={field.key}><span>{index + 1}</span><div><b>{field.title}</b><p>{field.hint}</p></div></article>)}
    </div>}
    <div className="hidden-soldier-note"><ShieldCheck size={17}/><p>استخدم أمثلة مهنية عامة فقط. لا تكتب أسماء مرضى أو أرقام ملفات أو معلومات صحية أو مستندات سرية. إثبات الإنجاز لا يعني امتلاك صلاحية إدارية؛ اطلب تفويضاً واضح الحدود.</p></div>
    {error && <p className="hidden-soldier-message is-error" role="alert">{error}</p>}
    {notice && <p className="hidden-soldier-message is-success" role="status"><CheckCircle2 size={16}/>{notice}</p>}

    {!facilitator && <div className="hidden-soldier-participant-layout">
      <form className="hidden-soldier-form" onSubmit={event => void save(true, event)}>
        <div className="hidden-soldier-form-heading"><div><span className="eyebrow">بطاقتك المهنية</span><h3>ابنِ بطاقة إثبات الأثر</h3><p>احفظها كمسودة أو أرسلها للمشاركة في نتائج الورشة.</p></div><span>{completedFields} / 6</span></div>
        <div className="hidden-soldier-progress"><span style={{ width: (completedFields / 6 * 100) + '%' }}/></div>
        <div className="hidden-soldier-select-grid">
          <label>نوع المشكلة<select value={form.problem_category} onChange={event => setForm(current => ({ ...current, problem_category: event.target.value }))}>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>مجال التأثير<select value={form.impact_area} onChange={event => setForm(current => ({ ...current, impact_area: event.target.value }))}>{areas.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label>نوع النتيجة<select value={form.outcome_type} onChange={event => setForm(current => ({ ...current, outcome_type: event.target.value }))}>{outcomes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        {fields.map((field, index) => <label className="hidden-soldier-field" key={field.key}><span><b>{index + 1}.</b> {field.title}</span><small>{field.hint}</small><textarea maxLength={field.max} rows={3} value={String(form[field.key] || '')} onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))} placeholder="اكتب إجابتك هنا…"/></label>)}
        <div className="hidden-soldier-measurement"><div><b>قياس النتيجة (اختياري)</b><small>إذا عندك رقم قبل وبعد التحسين، أضفه عشان يظهر في تحليل النتائج.</small></div><div className="hidden-soldier-number-grid"><label>قبل<input type="number" step="any" value={form.baseline_number ?? ''} onChange={event => setForm(current => ({ ...current, baseline_number: event.target.value === '' ? null : Number(event.target.value) }))} placeholder="مثلاً 20"/></label><label>بعد<input type="number" step="any" value={form.result_number ?? ''} onChange={event => setForm(current => ({ ...current, result_number: event.target.value === '' ? null : Number(event.target.value) }))} placeholder="مثلاً 12"/></label><label>وحدة القياس<input maxLength={40} value={form.measurement_unit} onChange={event => setForm(current => ({ ...current, measurement_unit: event.target.value }))} placeholder="دقيقة، نسبة، عدد…"/></label></div></div>
        <div className="hidden-soldier-submit"><span>{participantSubmission ? participantSubmission.status === 'draft' ? 'مسودتك محفوظة. أكملها وأرسلها.' : 'تم إرسال بطاقتك. يمكنك تحديثها إذا احتجت.' : 'مشاركتك لا تظهر للمقدّم إلا بعد الإرسال.'}</span><div><button type="button" className="btn btn-outline" disabled={saving} onClick={() => void save(false)}><Save size={16}/> حفظ مسودة</button><button type="submit" className="btn btn-primary" disabled={saving || !readyToSubmit}><CheckCircle2 size={16}/>{saving ? 'جارٍ الحفظ…' : 'إرسال البطاقة'}</button></div></div>
      </form>
      <aside className="hidden-soldier-live-card"><span className="eyebrow">معاينة البطاقة</span><div className="hidden-soldier-live-top"><span><ClipboardList size={18}/></span><small>بطاقة إثبات الأثر المهني</small></div><h3>{form.problem.trim() || 'المشكلة التي أعمل على حلها'}</h3><div className="hidden-soldier-live-tags"><span>{labelFor(categories, form.problem_category)}</span><span>{labelFor(areas, form.impact_area)}</span></div><div className="hidden-soldier-live-block"><small>النتيجة المستهدفة</small><p>{form.desired_outcome || 'ستظهر هنا النتيجة التي تريد تحقيقها.'}</p></div><div className="hidden-soldier-live-block"><small>مساهمتي</small><p>{form.personal_contribution || 'وضح هنا دورك أنت في معالجة المشكلة.'}</p></div><div className="hidden-soldier-live-block"><small>الدليل</small><p>{form.evidence || 'أضف الدليل الذي يثبت النتيجة.'}</p></div><div className="hidden-soldier-live-bottom"><span><Target size={15}/> {labelFor(outcomes, form.outcome_type)}</span><span>{completedFields}/6 مكتمل</span></div></aside>
    </div>}

    {facilitator && <section className="hidden-soldier-dashboard">
      <div className="hidden-soldier-dashboard-heading"><div><span className="eyebrow">مركز قيادة الورشة</span><h3>لوحة تحليل المشاركات</h3><p>تتحدث من قاعدة بيانات الورشة؛ لا توجد أرقام افتراضية.</p></div><button type="button" className="btn btn-outline btn-small" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> تحديث البيانات</button></div>
      <div className="hidden-soldier-kpis">
        <article><Users size={19}/><small>المشاركون</small><b>{rows.length.toLocaleString('ar-SA')}</b><em>كل من حفظ بطاقة</em></article>
        <article><CheckCircle2 size={19}/><small>بطاقات مرسلة</small><b>{submittedRows.length.toLocaleString('ar-SA')}</b><em>جاهزة للتحليل</em></article>
        <article><Activity size={19}/><small>أرفقوا دليلاً</small><b>{evidenceCount.toLocaleString('ar-SA')}</b><em>{submittedRows.length ? Math.round(evidenceCount / submittedRows.length * 100) : 0}٪ من المرسلين</em></article>
        <article><Target size={19}/><small>نتائج لها قياس رقمي</small><b>{measurableCount.toLocaleString('ar-SA')}</b><em>قبل وبعد</em></article>
      </div>
      <div className="hidden-soldier-dashboard-tabs"><button className={activeTab === 'overview' ? 'is-active' : ''} onClick={() => setActiveTab('overview')}>نظرة عامة</button><button className={activeTab === 'participants' ? 'is-active' : ''} onClick={() => setActiveTab('participants')}>المشاركون والبطاقات</button></div>
      {activeTab === 'overview' ? <div className="hidden-soldier-analytics-grid">
        <article className="hidden-soldier-chart"><div className="hidden-soldier-chart-title"><div><BarChart3 size={18}/><b>أكثر المشكلات تكراراً</b></div><small>حسب تصنيف المشاركين</small></div>{categoryStats.map(item => <div className="hidden-soldier-bar-row" key={item.value}><span>{item.label}</span><div><i style={{ width: (item.count / maxCategory * 100) + '%' }}/></div><b>{item.count}</b></div>)}</article>
        <article className="hidden-soldier-chart"><div className="hidden-soldier-chart-title"><div><Activity size={18}/><b>مجالات التأثير</b></div><small>أين يتركز التحسين؟</small></div>{areaStats.map(item => <div className="hidden-soldier-bar-row" key={item.value}><span>{item.label}</span><div><i style={{ width: (item.count / maxArea * 100) + '%' }}/></div><b>{item.count}</b></div>)}</article>
        <article className="hidden-soldier-insight"><div><Lightbulb size={19}/><b>مؤشرات جودة المشاركات</b></div><p><strong>{proposalCount}</strong> مشاركاً كتب اقتراح تحسين.</p><p><strong>{evidenceCount}</strong> مشاركاً أضاف دليلاً على النتيجة.</p><p><strong>{measurableCount}</strong> مشاركاً أدخل قيماً رقمية قبل وبعد.</p><small>هذه مؤشرات اكتمال وجودة توثيق، وليست حكماً على جودة أداء المشاركين.</small></article>
        <article className="hidden-soldier-chart hidden-soldier-chart-wide"><div className="hidden-soldier-chart-title"><div><Target size={18}/><b>نوع النتائج التي يستهدفها المشاركون</b></div><small>من البطاقات المرسلة</small></div><div className="hidden-soldier-outcome-pills">{outcomeStats.filter(item => item.count > 0).map(item => <span key={item.value}><b>{item.count}</b>{item.label}</span>)}{submittedRows.length === 0 && <p className="hidden-soldier-empty">ستظهر أنواع النتائج بعد إرسال أول بطاقة.</p>}</div></article>
      </div> : <div className="hidden-soldier-participant-list">
        <div className="hidden-soldier-list-tools"><label><Search size={16}/><input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="ابحث بالمشكلة أو اسم المشارك…"/></label><label><Filter size={16}/><select value={filterCategory} onChange={event => setFilterCategory(event.target.value)}><option value="all">كل أنواع المشكلات</option>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
        {filteredRows.length ? filteredRows.map(row => { const person = profiles[row.user_id]; return <details className="hidden-soldier-person-card" key={row.id}><summary><span className="hidden-soldier-person-avatar">{(person?.display_name || 'م').slice(0,1)}</span><span className="hidden-soldier-person-main"><b>{person?.display_name || 'مشارك'}</b><small>{[person?.profession, person?.specialty].filter(Boolean).join(' · ') || 'المهنة غير محددة'}</small></span><span className="hidden-soldier-person-category">{labelFor(categories, row.problem_category)}</span><ChevronDown size={17}/></summary><div className="hidden-soldier-person-detail"><div className="hidden-soldier-detail-grid">{fields.map(field => <article key={field.key}><small>{field.title}</small><p>{String(row[field.key] || 'لم تتم الإجابة')}</p></article>)}</div><div className="hidden-soldier-person-meta"><span>مجال التأثير: {labelFor(areas, row.impact_area)}</span><span>نوع النتيجة: {labelFor(outcomes, row.outcome_type)}</span><span>الحالة: {row.status === 'draft' ? 'مسودة' : row.status === 'reviewed' ? 'تمت المراجعة' : 'مرسلة'}</span></div>{row.baseline_number !== null && row.result_number !== null && <p className="hidden-soldier-numeric-result">قبل: {row.baseline_number} · بعد: {row.result_number} {row.measurement_unit}</p>}</div></details> }) : <div className="hidden-soldier-empty">ما فيه مشاركات تطابق البحث الحالي.</div>}
      </div>}
    </section>}
  </section>
}
