import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, ClipboardCheck, ExternalLink, LockKeyhole, RefreshCw, ShieldAlert } from 'lucide-react'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'
import './LearningProviderSetupPage.css'

type CheckStatus = 'READY' | 'MISSING'
type HealthCheck = { key: string; label: string; status: CheckStatus; missing: string[]; detail: string }

const fields = [
  ['HMS_ACCESS_KEY', 'Access Key', '100ms → Developer/API Keys. Secret خادمي؛ ضعه في Supabase → Project Settings → Edge Functions → Secrets.'],
  ['HMS_APP_SECRET', 'App Secret', '100ms → Developer/API Keys. Secret خادمي؛ لا تضعه في VITE_* أو GitHub Pages.'],
  ['HMS_TEMPLATE_ID', 'Room Template ID', '100ms → Room Templates → افتح القالب وانسخ المعرّف. إعداد خادمي وليس قيمة للواجهة.'],
  ['HMS_WEBHOOK_SECRET', 'Webhook Secret', 'أنشئ قيمة عشوائية قوية، وضع القيمة نفسها في Supabase Secret وفي Secret Header للـWebhook.'],
  ['HMS_HOST_ROLE_NAME', 'Host Role Name', 'اسم دور المضيف حرفياً داخل Room Template، غالباً host. إعداد خادمي غير سري.'],
  ['HMS_MEMBER_ROLE_NAME', 'Member Role Name', 'اسم دور العضو حرفياً داخل Room Template، غالباً attendee. إعداد خادمي غير سري.'],
  ['HMS_RECORDING_ENABLED', 'Recording declaration', 'اضبطها true فقط بعد تفعيل HLS Recording/MP4 في قالب 100ms. إعداد غير سري.'],
  ['HMS_STORAGE_CONFIGURED', 'Storage declaration', 'اضبطها true فقط بعد اختيار تخزين التسجيلات في 100ms. إعداد غير سري.'],
] as const

export function LearningProviderSetupPage({ role }: { role: Role }) {
  const [checks, setChecks] = useState<HealthCheck[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState('')
  const isOwner = role === 'owner'

  const verify = useCallback(async () => {
    if (!supabase || !isOwner) return
    setLoading(true); setError('')
    const { data, error: invokeError } = await supabase.functions.invoke('learning-health', { body: {} })
    if (invokeError || !Array.isArray(data?.checks)) {
      setChecks([])
      setError('تعذر تشغيل التحقق. يجب نشر وظيفة learning-health ثم المحاولة بحساب المالك.')
    } else {
      setChecks(data.checks as HealthCheck[])
      setLastChecked(new Date().toLocaleString('ar'))
    }
    setLoading(false)
  }, [isOwner])

  useEffect(() => { void Promise.resolve().then(verify) }, [verify])

  if (!isOwner) return <main className="app-main wrap provider-setup" dir="rtl"><section className="provider-card provider-denied"><ShieldAlert size={30}/><h1>صلاحية المالك فقط</h1><p>لا تعرض هذه الصفحة حالة إعدادات مزود البث للمدير أو العضو.</p></section></main>

  const checkByKey = new Map(checks.map(check => [check.key, check]))
  const overall = checks.length > 0 && checks.every(check => check.status === 'READY')
  return <main className="app-main wrap provider-setup" dir="rtl">
    <header className="provider-heading"><div><span className="eyebrow"><LockKeyhole size={14}/> إعداد خادمي محمي</span><h1>إعداد البث — 100ms</h1><p>لا تُعرض القيم هنا؛ هذه الصفحة تتحقق من وجودها في Supabase Edge Secrets فقط.</p></div><button className="btn btn-outline btn-small" type="button" onClick={() => void verify()} disabled={loading}><RefreshCw size={15}/>{loading ? 'جارٍ التحقق…' : 'Verify 100ms Configuration'}</button></header>
    {error && <div className="provider-message provider-error" role="alert">{error}</div>}
    <section className={`provider-overall ${overall ? 'provider-ready' : 'provider-missing'}`}><span>{overall ? <CheckCircle2 size={22}/> : <ShieldAlert size={22}/>}</span><div><b>{overall ? 'الإعدادات الأساسية جاهزة' : 'الإعدادات المطلوبة غير مكتملة'}</b><small>{lastChecked ? `آخر تحقق: ${lastChecked}` : 'اضغط Verify بعد ضبط الأسرار.'}</small></div></section>
    <section className="provider-card"><div className="provider-card-title"><ClipboardCheck size={19}/><div><h2>حالة الربط</h2><p>الحالة لا تعني نجاح بث فعلياً قبل اختبار Owner وMember على غرفة حقيقية.</p></div></div><div className="provider-check-grid">{[['config','100ms configuration'],['recording','Recording'],['webhook','Webhook'],['storage','Storage']].map(([key,label]) => { const check = checkByKey.get(key); return <div className="provider-check" key={key}><span className={`provider-status ${check?.status === 'READY' ? 'is-ready' : 'is-missing'}`}>{check?.status || 'MISSING'}</span><b>{label}</b><small>{check?.detail || 'لم يصل رد التحقق بعد.'}</small>{check?.missing.length ? <em>الناقص: {check.missing.join('، ')}</em> : null}</div> })}</div></section>
    <section className="provider-card"><div className="provider-card-title"><LockKeyhole size={19}/><div><h2>القيم المطلوبة</h2><p>انسخ الأسماء فقط إلى Supabase؛ لا تضع أي قيمة في Git أو في المتصفح.</p></div></div><div className="provider-fields">{fields.map(([name,label,help]) => <div className="provider-field" key={name}><code>{name}</code><b>{label}</b><span>{help}</span></div>)}</div><p className="provider-note">Webhook URL: <code>https://tiifakicmnwexmqoyxfq.supabase.co/functions/v1/learning-webhook</code><br/>Header: <code>x-saytara-webhook-secret</code></p></section>
    <section className="provider-card provider-next"><h2>آخر خطوة</h2><p>ادخل إلى 100ms → أنشئ/اختر التطبيق → اضبط القالب والـWebhook → انسخ القيم المطلوبة إلى Supabase Secrets → اضغط Verify.</p><a className="btn btn-outline btn-small" href="https://dashboard.100ms.live/" target="_blank" rel="noreferrer">فتح لوحة 100ms <ExternalLink size={14}/></a></section>
  </main>
}
