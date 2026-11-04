import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { trackSiteEvent } from '../lib/analytics'

type CollectionState = 'checking' | 'open' | 'paused' | 'unavailable'
const userTypes = [['professional','مهني / ممارس'],['job_seeker','باحث عن عمل'],['graduate','خريج أو حديث تخرج'],['coach','كوتش'],['researcher','باحث'],['innovator','مبتكر أو صاحب مشروع'],['other','أخرى']]
const specialties = ['تقنية وذكاء اصطناعي','صحة وعلوم طبية','إدارة وأعمال','هندسة','مالية ومحاسبة','موارد بشرية','تعليم وبحث علمي','أخرى']
const goals = [['job','البحث عن فرصة مهنية'],['skills','تطوير المهارات وبناء ملف الإنجازات'],['promotion','الاستعداد للترقية أو تحسين الموقع المهني'],['transition','الانتقال إلى مجال أو مسار جديد'],['leadership','تطوير القيادة والتأثير'],['explore','استكشاف المسارات والفرص المناسبة']]

export function WaitlistPage() {
 const location=useLocation()
 const [collectionState,setCollectionState]=useState<CollectionState>('checking')
 const [fullName,setFullName]=useState(''),[email,setEmail]=useState(''),[userType,setUserType]=useState('professional'),[specialty,setSpecialty]=useState(''),[goal,setGoal]=useState('')
 const [processingConsent,setProcessingConsent]=useState(false),[marketingOptIn,setMarketingOptIn]=useState(false),[website,setWebsite]=useState('')
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false),[submitted,setSubmitted]=useState(false)
 useEffect(()=>{let active=true;async function checkStatus(){if(!supabase){if(active)setCollectionState('unavailable');return}try{const {data,error:requestError}=await supabase.functions.invoke('onboarding-submit',{method:'GET'});if(!active)return;if(requestError){setCollectionState('unavailable');return}setCollectionState(data?.status==='open'?'open':'paused')}catch{if(active)setCollectionState('unavailable')}}void checkStatus();return()=>{active=false}},[])
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!supabase||collectionState!=='open'||busy||submitted)return;setBusy(true);setMessage('');setError(false);try{
  const {data,error:requestError}=await supabase.functions.invoke('onboarding-submit',{body:{fullName:fullName.trim(),email:email.trim().toLowerCase(),userType,specialty,goal,selectedPath:goal,sourcePath:location.pathname||'/waitlist',processingConsent,marketingOptIn,website}})
  let failureCode=typeof data?.error==='string'?data.error:''
  if(requestError&&'context' in requestError&&requestError.context instanceof Response){try{const detail=await requestError.context.clone().json() as {error?:string};failureCode=detail.error||failureCode}catch{/* Keep the available error code. */}}
  if(!requestError&&data?.status==='submitted'){setSubmitted(true);setMessage('وصل طلب اهتمامك بنجاح. لم يتم إنشاء حساب أو تفعيل عضوية؛ سنتواصل فقط وفق الموافقات التي اخترتها.');void trackSiteEvent('waitlist_submit','/waitlist',userType+':'+goal);return}
  if(failureCode==='already_registered'){setMessage('هذا البريد مسجّل لدينا مسبقاً في قائمة الاهتمام. لم نُنشئ طلباً مكرراً.');setError(true)}
  else if(failureCode==='collection_paused'){setCollectionState('paused');setMessage('استقبال الطلبات متوقف حالياً. لم يتم حفظ بياناتك.');setError(true)}
  else if(failureCode==='rate_limited'){setMessage('وصلت إلى حد المحاولات المؤقت. حاول لاحقاً.');setError(true)}
  else{setMessage('تعذر حفظ الطلب الآن. لم نتمكن من تأكيد التسجيل؛ حاول لاحقاً.');setError(true)}
 }catch{setMessage('تعذر الاتصال بالخدمة. لم يتم تأكيد حفظ أي بيانات.');setError(true)}finally{setBusy(false)}}
 return <main className="public-page wrap waitlist-page">
  <nav className="breadcrumbs" aria-label="مسار التنقل"><Link to="/">الرئيسية</Link><span aria-hidden="true">/</span><span>قائمة الاهتمام المبكر</span></nav>
  <div className="public-page-copy"><span className="eyebrow">الاهتمام المبكر</span><h1>أخبرنا بما تريد بناءه مهنياً.</h1><p className="hero-lead">قائمة الاهتمام تساعدنا على فهم نوع المسارات والموضوعات التي تهم المهنيين، دون إنشاء حساب أو منح عضوية تلقائية.</p></div>
  <section className="waitlist-status" aria-live="polite">
   {collectionState==='checking'&&<p><Clock3 size={18}/> نتحقق من حالة استقبال الطلبات…</p>}
   {collectionState==='paused'&&<><h2>استقبال الطلبات غير متاح حالياً</h2><p>نستكمل مراجعة الخصوصية ومكان معالجة البيانات قبل فتح القائمة. لم نطلب منك إدخال بياناتك ولم يتم حفظ أي شيء.</p><p className="waitlist-status-note">يمكنك الآن استكشاف المحتوى والأدوات المنشورة، والعودة إلى هذه الصفحة لاحقاً.</p><div className="empty-state-actions"><Link className="btn btn-primary" to="/career-journey">استكشف الرحلة المهنية</Link><Link className="btn btn-outline" to="/articles">تصفّح المقالات</Link></div></>}
   {collectionState==='unavailable'&&<><h2>تعذر التحقق من الخدمة</h2><p>لا نعرض نموذجاً لا نستطيع تأكيد طريقة حفظ بياناته. لم يتم إرسال أو حفظ أي طلب.</p><Link className="btn btn-outline" to="/privacy">اقرأ سياسة الخصوصية</Link></>}
   {collectionState==='open'&&!submitted&&<form className="waitlist-form" onSubmit={submit}>
    <div className="form-grid">
     <label>الاسم الكامل<input autoComplete="name" required minLength={2} maxLength={100} value={fullName} onChange={event=>setFullName(event.target.value)}/></label>
     <label>البريد الإلكتروني<input type="email" autoComplete="email" dir="ltr" required maxLength={254} value={email} onChange={event=>setEmail(event.target.value)}/></label>
     <label>نوع المستخدم<select required value={userType} onChange={event=>setUserType(event.target.value)}>{userTypes.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
     <label>المجال المهني<select required value={specialty} onChange={event=>setSpecialty(event.target.value)}><option value="" disabled>اختر المجال الأقرب</option>{specialties.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
     <label className="full-field">ما هدفك من الانضمام؟<select required value={goal} onChange={event=>setGoal(event.target.value)}><option value="" disabled>اختر هدفك الأساسي</option>{goals.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <label className="waitlist-honeypot" aria-hidden="true">اترك هذا الحقل فارغاً<input tabIndex={-1} autoComplete="off" value={website} onChange={event=>setWebsite(event.target.value)}/></label>
    <label className="waitlist-consent"><input type="checkbox" required checked={processingConsent} onChange={event=>setProcessingConsent(event.target.checked)}/><span>أوافق على معالجة بياناتي لغرض مراجعة طلب الاهتمام والتواصل بشأنه وفق <Link to="/privacy">سياسة الخصوصية</Link>.</span></label>
    <label className="waitlist-consent"><input type="checkbox" checked={marketingOptIn} onChange={event=>setMarketingOptIn(event.target.checked)}/><span>أوافق اختيارياً على تلقي تحديثات المجتمع عبر البريد الإلكتروني.</span></label>
    <button className="btn btn-primary" type="submit" disabled={busy||!processingConsent}>{busy?'جارٍ إرسال الطلب…':'أرسل طلب الاهتمام'} <ArrowLeft size={16}/></button>
    <p className="waitlist-privacy"><ShieldCheck size={15}/> لا ينشئ هذا الطلب حساباً ولا يضمن القبول أو العضوية. يمكنك عدم الموافقة على الرسائل التسويقية.</p>
   </form>}
   {submitted&&<div className="waitlist-success" role="status"><CheckCircle2 size={25}/><h2>تم استلام طلب الاهتمام</h2><p>{message}</p></div>}
   {message&&!submitted&&<p className={error?'waitlist-message is-error':'waitlist-message'} role={error?'alert':'status'}>{message}</p>}
  </section>
  <nav className="related-links" aria-label="صفحات ذات صلة"><b>محتوى متاح الآن</b><Link to="/career-compass">البوصلة المهنية</Link><Link to="/linkedin-audit">تدقيق ملف LinkedIn</Link><Link to="/linkedin-workshop">ورشة LinkedIn الذاتية</Link></nav>
 </main>
}
