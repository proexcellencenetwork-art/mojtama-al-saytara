import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, Compass, ShieldCheck } from 'lucide-react'
import { getAnalyticsConsent, trackSiteEvent } from '../lib/analytics'
import './ToolEntryGate.css'

const userTypes = [
  ['professional', 'مهني / ممارس'],
  ['job_seeker', 'باحث عن عمل'],
  ['graduate', 'خريج أو حديث تخرج'],
  ['coach', 'مدرب مهني'],
  ['researcher', 'باحث'],
  ['innovator', 'مبتكر أو صاحب مشروع'],
  ['other', 'أخرى'],
] as const

const specialties = [
  ['health_medical', 'صحة وعلوم طبية'],
  ['technology_ai', 'تقنية وذكاء اصطناعي'],
  ['business', 'إدارة وأعمال'],
  ['engineering', 'هندسة'],
  ['finance', 'مالية ومحاسبة'],
  ['human_resources', 'موارد بشرية'],
  ['education_research', 'تعليم وبحث علمي'],
  ['other', 'أخرى'],
] as const

const goals = [
  ['job', 'الحصول على فرصة مهنية'],
  ['skills', 'تطوير المهارات'],
  ['promotion', 'الترقية وتحسين الموقع المهني'],
  ['transition', 'الانتقال إلى مسار جديد'],
  ['leadership', 'تطوير القيادة والتأثير'],
  ['explore', 'استكشاف المسارات المناسبة'],
] as const

type ChoiceGroupProps<T extends readonly (readonly [string, string])[]> = {
  title: string
  name: string
  value: string
  options: T
  onChange: (value: string) => void
}
function ChoiceGroup<T extends readonly (readonly [string, string])[]>({title,name,value,options,onChange}:ChoiceGroupProps<T>) {
  return <fieldset className="tool-entry-fieldset">
    <legend>{title}</legend>
    <div className="tool-entry-options">
      {options.map(([key,label])=><label className={value===key?'tool-entry-choice is-selected':'tool-entry-choice'} key={key}>
        <input type="radio" name={name} value={key} checked={value===key} onChange={event=>onChange(event.target.value)} required/>
        <span>{label}</span>
      </label>)}
    </div>
  </fieldset>
}

export function ToolEntryGate({toolPath,toolName,children}:{toolPath:string;toolName:string;children:ReactNode}) {
  const [userType,setUserType]=useState('')
  const [specialty,setSpecialty]=useState('')
  const [goal,setGoal]=useState('')
  const [saveIntent,setSaveIntent]=useState(false)
  const [analyticsConsent,setAnalyticsConsent]=useState(getAnalyticsConsent())
  const [busy,setBusy]=useState(false)
  const [entered,setEntered]=useState(false)

  useEffect(()=>{
    const sync=()=>{
      const next=getAnalyticsConsent()
      setAnalyticsConsent(next)
      if(next!=='accepted') setSaveIntent(false)
    }
    window.addEventListener('saytara-analytics-consent',sync)
    return ()=>window.removeEventListener('saytara-analytics-consent',sync)
  },[])

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(busy||entered) return
    setBusy(true)
    if(saveIntent&&analyticsConsent==='accepted') {
      await trackSiteEvent('tool_intent',toolPath,`${goal}|${userType}|${specialty}`)
    }
    setBusy(false)
    setEntered(true)
  }

  return entered ? <>{children}</> : <main className="tool-entry-gate wrap" dir="rtl">
    <section className="tool-entry-card" aria-labelledby="tool-entry-title">
      <div className="tool-entry-icon"><Compass size={22}/></div>
      <span className="eyebrow">خطوة سريعة قبل الاستخدام</span>
      <h1 id="tool-entry-title">خلّنا نوجّه {toolName} لاحتياجك</h1>
      <p className="tool-entry-intro">ثلاثة اختيارات بسيطة تساعدنا على فهم من يستخدم الأدوات وما الذي يحتاجه مهنياً.</p>
      <form onSubmit={submit}>
        <div className="tool-entry-grid">
          <ChoiceGroup title="أنت أقرب إلى؟" name="tool-user-type" value={userType} options={userTypes} onChange={setUserType}/>
          <ChoiceGroup title="مجالك المهني" name="tool-specialty" value={specialty} options={specialties} onChange={setSpecialty}/>
          <ChoiceGroup title="ما الذي تريد تحقيقه؟" name="tool-goal" value={goal} options={goals} onChange={setGoal}/>
        </div>
        <label className="tool-entry-consent">
          <input type="checkbox" checked={saveIntent} disabled={analyticsConsent!=='accepted'} onChange={event=>setSaveIntent(event.target.checked)}/>
          <span>أوافق على حفظ اختياراتي المهنية بشكل مجهول لتحسين الأداة وقياس أثرها.</span>
        </label>
        {analyticsConsent!=='accepted'&&<p className="tool-entry-privacy">حفظ الاختيارات اختياري ويتطلب موافقتك على التحليلات أولاً. يمكنك المتابعة دون حفظ أي اختيار.</p>}
        <div className="tool-entry-actions">
          <button className="btn btn-primary" type="submit" disabled={busy||!userType||!specialty||!goal}>{busy?'جارٍ المتابعة…':'ادخل إلى الأداة'} <ArrowLeft size={16}/></button>
          <button className="tool-entry-skip" type="button" onClick={()=>setEntered(true)}>تخطي هذه الخطوة</button>
        </div>
      </form>
      <p className="tool-entry-privacy"><ShieldCheck size={15}/> لا نطلب اسمك أو بريدك هنا، ولا نحفظ محتوى إجابات الأداة. يمكنك تغيير موافقة التحليلات من <a href="/mojtama-al-saytara/privacy/">إعدادات الخصوصية</a>.</p>
    </section>
  </main>
}
