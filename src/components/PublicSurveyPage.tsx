import { useState } from 'react'
import { CheckCircle2, HeartHandshake, Send, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './PublicSurveyPage.css'

type UsedArea='articles'|'tools'|'videos'|'community'|'other'|'not_used'
type Improvement='content'|'tools'|'navigation'|'speed'|'sign_in'|'live_sessions'|'other'
const visitorKey='saytara-public-survey-visitor'
function getVisitorId(){
 try{let id=localStorage.getItem(visitorKey);if(!id){id=crypto.randomUUID();localStorage.setItem(visitorKey,id)}return id}catch{return null}
}
const usedOptions:[UsedArea,string][]=[['articles','المقالات والمحتوى'],['tools','الأدوات المهنية'],['videos','الفيديوهات والدروس'],['community','المجتمع والتواصل'],['other','شيء آخر'],['not_used','هذه أول زيارة لي']]
const improvementOptions:[Improvement,string][]=[['content','المحتوى والمعلومات'],['tools','الأدوات والنتائج'],['navigation','سهولة التنقل'],['speed','سرعة الموقع'],['sign_in','تسجيل الدخول والتسجيل'],['live_sessions','البثوث والورش'],['other','شيء آخر']]
export default function PublicSurveyPage(){
 const [overall,setOverall]=useState(0),[recommend,setRecommend]=useState(-1),[ease,setEase]=useState(0)
 const [used,setUsed]=useState<UsedArea>('tools'),[improvement,setImprovement]=useState<Improvement>('tools')
 const [comment,setComment]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('')
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setError('')
  if(!supabase){setError('تعذر الاتصال بالخدمة. حاول لاحقاً.');return}
  if(overall<1||recommend<0||ease<1){setError('أكمل التقييمات الثلاثة قبل الإرسال.');return}
  const visitorId=getVisitorId();if(!visitorId){setError('تعذر إنشاء معرّف مجهول لحفظ الاستبيان على هذا الجهاز.');return}
  setBusy(true)
  const {error:saveError}=await supabase.rpc('submit_public_experience_survey',{p_visitor_id:visitorId,p_overall_rating:overall,p_recommendation_score:recommend,p_ease_rating:ease,p_used_area:used,p_improvement_area:improvement,p_comment:comment.trim()})
  setBusy(false)
  if(saveError){setError('لم نتمكن من حفظ إجابتك. حاول مرة أخرى.');return}
  setDone(true)
 }
 return <main className="public-survey-page wrap" dir="rtl">
  <nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><span>استبيان تجربة الزائر</span></nav>
  <header className="public-survey-heading"><span className="eyebrow"><HeartHandshake size={15}/> صوتك يطوّر المجتمع</span><h1>شاركنا رأيك في تجربتك</h1><p>استبيان قصير يساعدنا على معرفة ما كان مفيداً وما يحتاج إلى تحسين. لا نطلب اسمك أو بريدك الإلكتروني.</p></header>
  {done?<section className="public-survey-success"><CheckCircle2 size={42}/><h2>وصلنا رأيك، شكرًا لك.</h2><p>سنستخدم الإجابات المجمّعة لتحسين المحتوى والأدوات وتجربة الاستخدام.</p><Link className="btn btn-primary" to="/">العودة إلى مجتمع السيطرة</Link></section>:
  <form className="public-survey-form" onSubmit={submit}>
   <section className="survey-question"><span className="survey-step">01</span><div><h2>كيف تقيّم تجربتك بشكل عام؟</h2><p>من غير راضٍ إلى راضٍ جداً.</p></div><div className="survey-scale">{[1,2,3,4,5].map(n=><button type="button" key={n} className={overall===n?'selected':''} aria-pressed={overall===n} onClick={()=>setOverall(n)}>{n}</button>)}</div><div className="survey-scale-labels"><span>غير راضٍ</span><span>راضٍ جداً</span></div></section>
   <section className="survey-question"><span className="survey-step">02</span><div><h2>ما مدى سهولة استخدام الموقع؟</h2><p>من صعب جداً إلى سهل جداً.</p></div><div className="survey-scale">{[1,2,3,4,5].map(n=><button type="button" key={n} className={ease===n?'selected':''} aria-pressed={ease===n} onClick={()=>setEase(n)}>{n}</button>)}</div><div className="survey-scale-labels"><span>صعب جداً</span><span>سهل جداً</span></div></section>
   <section className="survey-question"><span className="survey-step">03</span><div><h2>ما مدى احتمالية أن توصي بالمجتمع لشخص آخر؟</h2><p>صفر يعني غير محتمل، و10 يعني محتمل جداً.</p></div><div className="survey-nps">{Array.from({length:11},(_,n)=><button type="button" key={n} className={recommend===n?'selected':''} aria-pressed={recommend===n} onClick={()=>setRecommend(n)}>{n}</button>)}</div><div className="survey-scale-labels"><span>غير محتمل</span><span>محتمل جداً</span></div></section>
   <section className="survey-question"><span className="survey-step">04</span><div><h2>وش أكثر شيء استخدمته؟</h2></div><div className="survey-options">{usedOptions.map(([v,label])=><label key={v}><input type="radio" name="used" checked={used===v} onChange={()=>setUsed(v)}/><span>{label}</span></label>)}</div></section>
   <section className="survey-question"><span className="survey-step">05</span><div><h2>وش أكثر شيء يحتاج إلى تحسين؟</h2></div><div className="survey-options">{improvementOptions.map(([v,label])=><label key={v}><input type="radio" name="improvement" checked={improvement===v} onChange={()=>setImprovement(v)}/><span>{label}</span></label>)}</div></section>
   <section className="survey-question"><span className="survey-step">06</span><div><h2>هل عندك اقتراح أو ملاحظة؟</h2><p>اختياري، بحد أقصى 500 حرف. لا تكتب معلومات شخصية أو سرية.</p></div><textarea value={comment} maxLength={500} rows={4} onChange={e=>setComment(e.target.value)} placeholder="اكتب ملاحظتك هنا…"/><small className="survey-char-count">{comment.length}/500</small></section>
   {error&&<p className="survey-error" role="alert">{error}</p>}
   <div className="survey-submit-row"><p><ShieldCheck size={16}/> الاستبيان لا يطلب بيانات تعريفية. تُعرض النتائج للمالك بصورة مجمّعة.</p><button className="btn btn-primary" type="submit" disabled={busy}>{busy?'جارٍ الحفظ…':'إرسال رأيي'} <Send size={16}/></button></div>
  </form>}
 </main>
}
