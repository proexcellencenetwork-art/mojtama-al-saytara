import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, BarChart3, CheckCircle2, Download, FileSpreadsheet, RefreshCw, Save, ShieldCheck, Users } from 'lucide-react'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'
import './HiddenSoldierWorkshop.css'

const WORKSHOP = 'hidden-soldier'
type Submission = {
  id: string
  user_id: string
  problem: string
  desired_outcome: string
  personal_contribution: string
  evidence: string
  improvement_proposal: string
  responsibility_request: string
  baseline_value: string
  result_value: string
  metric_unit: string
  status: 'draft' | 'submitted' | 'reviewed'
  submitted_at: string | null
  updated_at: string
}
type Profile = { user_id: string; display_name: string; profession: string; specialty: string }
type FormValues = Omit<Submission, 'id' | 'user_id' | 'status' | 'submitted_at' | 'updated_at'> & { id?: string }
const emptyForm: FormValues = {
  problem: '', desired_outcome: '', personal_contribution: '', evidence: '',
  improvement_proposal: '', responsibility_request: '',
  baseline_value: '', result_value: '', metric_unit: '',
}
const fields: { key: keyof FormValues; title: string; hint: string; max: number }[] = [
  { key: 'problem', title: '1. المشكلة أو المهمة', hint: 'وش المشكلة أو المهمة المحددة اللي اشتغلت عليها؟ اكتب موقفاً واضحاً، مو وصفاً عاماً لوظيفتك.', max: 2000 },
  { key: 'desired_outcome', title: '2. النتيجة المطلوبة', hint: 'وش التغيير اللي تبغى تحققه؟ مثل تقليل وقت، رفع دقة، تحسين تجربة أو تقليل أخطاء.', max: 1500 },
  { key: 'personal_contribution', title: '3. مساهمتي الشخصية', hint: 'وش سويت أنت تحديداً؟ فرّق بين مساهمتك ومساهمة الفريق، ولا تنسب لنفسك عمل غيرك.', max: 2000 },
  { key: 'evidence', title: '4. الدليل على النتيجة', hint: 'وش الدليل المتاح؟ تقرير، سجل، مؤشر، مقارنة قبل وبعد، أو ملاحظة موثقة. لا تكتب بيانات مرضى أو معلومات سرية.', max: 2000 },
  { key: 'improvement_proposal', title: '5. اقتراحي للتحسين', hint: 'وش الخطوة التالية اللي تقترحها؟ وضّح كيف ممكن تُختبر ومن يحتاج يعتمدها.', max: 2000 },
  { key: 'responsibility_request', title: '6. المسؤولية أو الصلاحية المطلوبة', hint: 'وش المسؤولية المحددة اللي تطلبها؟ اذكر حدودها، والصلاحية اللازمة، وكيف تقاس نتيجتها.', max: 1500 },
]
const csvCell = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ') + '"'

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

  const load = useCallback(async () => {
    if (!supabase) { setError('خدمة الحفظ غير متصلة حالياً.'); setLoading(false); return }
    setLoading(true); setError('')
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) { setError('سجّل الدخول بحساب معتمد للمشاركة في الورشة.'); setLoading(false); return }
    setUserId(authData.user.id)
    const { data, error: queryError } = await supabase.from('workshop_submissions').select('*').eq('workshop_slug', WORKSHOP).order('submitted_at', { ascending: false })
    if (queryError) { setError('تعذر تحميل المشاركة. تحقق من اتصال الحساب ثم أعد المحاولة.'); setLoading(false); return }
    const submissions = (data || []) as Submission[]
    setRows(submissions)
    const mine = submissions.find(item => item.user_id === authData.user.id)
    if (mine) setForm({ ...mine })
    if (facilitator && submissions.length) {
      const ids = [...new Set(submissions.map(item => item.user_id))]
      const { data: people } = await supabase.from('profiles').select('user_id,display_name,profession,specialty').in('user_id', ids)
      setProfiles(Object.fromEntries(((people || []) as Profile[]).map(person => [person.user_id, person])))
    }
    setLoading(false)
  }, [facilitator])

  useEffect(() => { void load() }, [load])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !userId) return
    setSaving(true); setError(''); setNotice('')
    const payload = {
      workshop_slug: WORKSHOP, user_id: userId,
      problem: form.problem.trim(), desired_outcome: form.desired_outcome.trim(),
      personal_contribution: form.personal_contribution.trim(), evidence: form.evidence.trim(),
      improvement_proposal: form.improvement_proposal.trim(), responsibility_request: form.responsibility_request.trim(),
      baseline_value: form.baseline_value.trim(), result_value: form.result_value.trim(), metric_unit: form.metric_unit.trim(),
      status: 'submitted', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    const { error: saveError } = await supabase.from('workshop_submissions').upsert(payload, { onConflict: 'workshop_slug,user_id' })
    setSaving(false)
    if (saveError) { setError('ما قدرنا نحفظ المشاركة. تأكد من اكتمال الحقول ثم أعد المحاولة.'); return }
    setNotice('وصلت مشاركتك وحُفظت في قاعدة بيانات الورشة. تقدر ترجع وتحدّثها لاحقاً.')
    await load()
  }

  const submitted = rows.filter(row => row.status === 'submitted' || row.status === 'reviewed').length
  const completion = rows.length ? Math.round((submitted / rows.length) * 100) : 0
  const exportCsv = () => {
    const headers = ['اسم المشارك','المهنة','التخصص','المشكلة أو المهمة','النتيجة المطلوبة','المساهمة الشخصية','الدليل','اقتراح التحسين','المسؤولية المطلوبة','القيمة قبل','القيمة بعد','وحدة القياس','الحالة','تاريخ الإرسال']
    const body = rows.map(row => {
      const person = profiles[row.user_id]
      return [person?.display_name || 'مشارك', person?.profession || '', person?.specialty || '', row.problem, row.desired_outcome, row.personal_contribution, row.evidence, row.improvement_proposal, row.responsibility_request, row.baseline_value, row.result_value, row.metric_unit, row.status, row.submitted_at]
    })
    const csv = '\uFEFF' + [headers, ...body].map(line => line.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'hidden-soldier-power-bi.csv'; anchor.click()
    URL.revokeObjectURL(url)
  }

  const participantSubmission = rows.find(item => item.user_id === userId)
  const completionHint = useMemo(() => fields.filter(field => String(form[field.key] || '').trim()).length, [form])

  return <section className="hidden-soldier" aria-labelledby="hidden-soldier-title">
    <header className="hidden-soldier-hero">
      <div><span className="eyebrow">ورشة تطبيقية · مجتمع السيطرة المهنية</span><h2 id="hidden-soldier-title">الجندي الخفي: من الإنجاز إلى التأثير</h2><p>مو هدفنا نعلّمك كيف تلفت الانتباه فقط؛ نعلّمك كيف تنتج قيمة، وتثبت مساهمتك، وتعرض أثرها، ثم تطلب مسؤولية مناسبة بوضوح.</p></div>
      <span className="hidden-soldier-mark"><ShieldCheck size={28}/></span>
    </header>
    <div className="hidden-soldier-steps">
      {fields.map((field, index) => <article className="hidden-soldier-step" key={field.key}><span>{index + 1}</span><div><b>{field.title.replace(/^\d+\. /, '')}</b><p>{field.hint}</p></div></article>)}
    </div>
    <div className="hidden-soldier-note"><ShieldCheck size={17}/><p>اكتب أمثلة مهنية عامة فقط. لا ترفع أسماء مرضى أو أرقام ملفات أو بيانات صحية أو مستندات سرية. وضوح الإنجاز لا يعني امتلاك صلاحية إدارية؛ اطلب التفويض ضمن حدود دورك.</p></div>
    {error && <p className="hidden-soldier-message is-error" role="alert">{error}</p>}
    {notice && <p className="hidden-soldier-message is-success" role="status"><CheckCircle2 size={16}/>{notice}</p>}
    {loading ? <p className="hidden-soldier-message">جارٍ تحميل بيانات مشاركتك…</p> : <form className="hidden-soldier-form" onSubmit={submit}>
      <div className="hidden-soldier-form-heading"><div><h3>بطاقة إثبات الأثر المهني</h3><p>عبّئ الخطوات الست. المشاركة محفوظة بحسابك، ويمكنك تحديثها بعد الإرسال.</p></div><span>{completionHint} / 6</span></div>
      {fields.map(field => <label className="hidden-soldier-field" key={field.key}><span>{field.title}</span><small>{field.hint}</small><textarea required maxLength={field.max} rows={3} value={String(form[field.key] || '')} onChange={event => setForm(current => ({ ...current, [field.key]: event.target.value }))}/></label>)}
      <div className="hidden-soldier-metrics"><label>القيمة قبل التحسين (اختياري)<input maxLength={100} value={form.baseline_value} onChange={event => setForm(current => ({ ...current, baseline_value: event.target.value }))} placeholder="مثال: 20 دقيقة"/></label><label>القيمة بعد التحسين (اختياري)<input maxLength={100} value={form.result_value} onChange={event => setForm(current => ({ ...current, result_value: event.target.value }))} placeholder="مثال: 12 دقيقة"/></label><label>وحدة القياس<input maxLength={60} value={form.metric_unit} onChange={event => setForm(current => ({ ...current, metric_unit: event.target.value }))} placeholder="دقيقة، نسبة، عدد…"/></label></div>
      <div className="hidden-soldier-submit"><span>{participantSubmission ? 'لديك مشاركة محفوظة؛ الإرسال الجديد يحدّثها.' : 'لم ترسل مشاركتك بعد.'}</span><button className="btn btn-primary" disabled={saving || completionHint !== 6}><Save size={16}/>{saving ? 'جارٍ الحفظ…' : participantSubmission ? 'تحديث المشاركة' : 'إرسال بطاقة الأثر'}</button></div>
    </form>}
    {facilitator && <section className="hidden-soldier-facilitator">
      <div className="hidden-soldier-dashboard-heading"><div><span className="eyebrow">لوحة مقدّم الورشة · صلاحية الكوتش/المدير/المالك</span><h3>مشاركات المتدربين ونتائجهم</h3><p>البيانات تظهر هنا من قاعدة البيانات مباشرة، وليست أرقاماً تجريبية.</p></div><div className="hidden-soldier-dashboard-actions"><button type="button" className="btn btn-outline btn-small" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> تحديث</button><button type="button" className="btn btn-primary btn-small" onClick={exportCsv} disabled={!rows.length}><FileSpreadsheet size={15}/> تصدير Power BI CSV</button></div></div>
      <div className="hidden-soldier-kpis"><article><Users size={18}/><small>إجمالي المشاركين</small><b>{rows.length.toLocaleString('ar-SA')}</b></article><article><CheckCircle2 size={18}/><small>مشاركات مرسلة</small><b>{submitted.toLocaleString('ar-SA')}</b></article><article><BarChart3 size={18}/><small>نسبة الإرسال</small><b>{completion.toLocaleString('ar-SA')}٪</b></article></div>
      {rows.length ? <div className="hidden-soldier-table-wrap"><table className="hidden-soldier-table"><thead><tr><th>المشارك</th><th>المهنة والتخصص</th><th>الحالة</th><th>آخر إرسال</th><th>تفاصيل البطاقة</th></tr></thead><tbody>{rows.map(row => { const person = profiles[row.user_id]; return <tr key={row.id}><td><b>{person?.display_name || 'مشارك'}</b><small>{row.user_id.slice(0, 8)}…</small></td><td>{[person?.profession, person?.specialty].filter(Boolean).join(' · ') || 'غير محدد'}</td><td><span className="hidden-soldier-status">{row.status === 'reviewed' ? 'تمت المراجعة' : row.status === 'submitted' ? 'تم الإرسال' : 'مسودة'}</span></td><td>{row.submitted_at ? new Date(row.submitted_at).toLocaleString('ar-SA') : '—'}</td><td><details><summary>عرض الإجابات</summary><div className="hidden-soldier-answer-list">{fields.map(field => <p key={field.key}><b>{field.title}</b><span>{row[field.key]}</span></p>)}</div></details></td></tr> })}</tbody></table></div> : <div className="hidden-soldier-empty">ما وصلتنا مشاركات حتى الآن. بتظهر بيانات المشاركين هنا بعد أول إرسال فعلي.</div>}
      <p className="hidden-soldier-powerbi-note"><FileSpreadsheet size={16}/> ملف CSV منسّق للاستيراد في Power BI Desktop. ربط Power BI المباشر أو تضمين تقرير تفاعلي داخل الموقع يحتاج مساحة عمل Power BI وصلاحية نشر/تضمين من حساب Microsoft الخاص بالمجتمع.</p>
    </section>}
  </section>
}
