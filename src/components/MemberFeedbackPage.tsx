import { useEffect, useState } from 'react'
import { CheckCircle2, Heart, LoaderCircle, Star } from 'lucide-react'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'
type Area = 'groups'|'messages'|'tools'|'content'|'navigation'|'performance'|'other'
type Feedback = { rating:number; area:Area; updated_at:string }
type Summary = { responses:number; average:number|null; distribution:Record<string,number>; areas:{area:Area;responses:number;average:number}[] }
const areaLabels:Record<Area,string>={groups:'المجموعات',messages:'التواصل والرسائل',tools:'الأدوات المهنية',content:'المحتوى والورش',navigation:'سهولة التنقل',performance:'سرعة الموقع',other:'شيء آخر'}
const localKey='saytara-member-satisfaction-v1'
function readLocal():Feedback|null{try{const value=localStorage.getItem(localKey);return value?JSON.parse(value) as Feedback:null}catch{return null}}
function saveLocal(value:Feedback){try{localStorage.setItem(localKey,JSON.stringify(value));return true}catch{return false}}

export function MemberFeedbackPage({role,userId}:{role:Role;userId:string}) {
 const [rating,setRating]=useState(0),[area,setArea]=useState<Area>('groups'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [notice,setNotice]=useState(''),[error,setError]=useState(''),[summary,setSummary]=useState<Summary|null>(null),[savedAt,setSavedAt]=useState('')
 const canView=role==='owner'||role==='manager'
 useEffect(()=>{
  let active=true
  async function load(){
   if(supabase&&userId){
    const {data,error:readError}=await supabase.from('community_feedback').select('rating,area,updated_at').eq('user_id',userId).maybeSingle()
    if(active&&!readError&&data){setRating(Number(data.rating));setArea(data.area as Area);setSavedAt(String(data.updated_at))}
    else if(active&&readError){const local=readLocal();if(local){setRating(local.rating);setArea(local.area);setSavedAt(local.updated_at)}}
    if(active&&canView){const {data:aggregate,error:aggregateError}=await supabase.rpc('get_owner_community_satisfaction');if(!aggregateError&&aggregate)setSummary(aggregate as Summary)}
   }else{const local=readLocal();if(active&&local){setRating(local.rating);setArea(local.area);setSavedAt(local.updated_at)}}
   if(active)setLoading(false)
  }
  void load()
  return ()=>{active=false}
 },[userId,canView])
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(rating<1||rating>5||busy)return
  setBusy(true);setNotice('');setError('')
  const value:Feedback={rating,area,updated_at:new Date().toISOString()}
  if(supabase&&userId){
   const {error:writeError}=await supabase.from('community_feedback').upsert({user_id:userId,rating,area,updated_at:value.updated_at},{onConflict:'user_id'})
   if(writeError){if(saveLocal(value)){setSavedAt(value.updated_at);setNotice('تعذر مزامنة التقييم مع الحساب؛ حُفظ على هذا الجهاز فقط.')}else setError('تعذر حفظ التقييم. حاول مرة أخرى.')}
   else{setSavedAt(value.updated_at);setNotice('وصل تقييمك. شكراً لمساعدتنا على تحسين المجتمع.');if(canView){const {data}=await supabase.rpc('get_owner_community_satisfaction');if(data)setSummary(data as Summary)}}
  }else if(saveLocal(value)){setSavedAt(value.updated_at);setNotice('حُفظ تقييمك على هذا الجهاز فقط. لا يمثل هذا إحصاءً لأعضاء آخرين.')}
  else setError('تعذر حفظ التقييم على هذا الجهاز.')
  setBusy(false)
 }
 return <main className="app-main wrap member-workspace-page">
  <header className="member-page-heading"><div><span className="eyebrow">صوتك يوجّه التطوير</span><h1>كيف كانت تجربتك؟</h1><p>تقييم سريع يساعدنا نعرف ما الذي يعمل جيداً وما الذي يحتاج إلى تحسين.</p></div><span className="feedback-mark"><Heart size={21}/></span></header>
  <section className="feedback-layout">
   <form className="panel-card member-feedback-card" onSubmit={submit}>
    <h2>ما مستوى رضاك عن المجتمع حتى الآن؟</h2><p>اختر التقييم الأقرب لتجربتك الحالية. تستطيع تحديثه متى شئت.</p>
    <div className="feedback-rating" role="radiogroup" aria-label="مستوى الرضا من 1 إلى 5">
     {Array.from({length:5},(_,index)=>index+1).map(value=><button type="button" key={value} role="radio" aria-checked={rating===value} aria-label={value+' من 5'} className={rating===value?'is-selected':''} onClick={()=>setRating(value)}><Star size={22} fill={rating>=value?'currentColor':'none'}/><span>{value}</span></button>)}
    </div>
    <div className="feedback-scale"><span>غير راضٍ</span><span>راضٍ جداً</span></div>
    <label className="feedback-area-label">ما الجزء الذي يحتاج إلى تحسين أولاً؟<select value={area} onChange={event=>setArea(event.target.value as Area)}>{Object.entries(areaLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <button className="btn btn-primary" disabled={busy||loading||rating===0}>{busy?<><LoaderCircle size={16}/> جارٍ الحفظ…</>:'إرسال التقييم'}</button>
    {notice&&<p className="inline-message" role="status"><CheckCircle2 size={16}/>{notice}</p>}{error&&<p className="inline-message live-error" role="alert">{error}</p>}
    {savedAt&&<small className="feedback-saved-at">آخر تحديث: {new Date(savedAt).toLocaleString('ar')}</small>}
    <p className="feedback-privacy">لا نطلب اسماً أو تعليقاً شخصياً. في الحسابات الفعلية يُحفظ تقييم واحد قابل للتحديث لكل عضو، وتعرض لوحة الإدارة ملخصاً مجمعاً فقط.</p>
   </form>
   {canView&&<aside className="panel-card feedback-summary"><span className="eyebrow">ملخص رضا الأعضاء</span><h2>قراءة التجربة</h2>
    {summary?<><div className="feedback-summary-score"><strong>{summary.average===null?'—':summary.average.toFixed(1)}</strong><span>من 5</span><small>{summary.responses} استجابة</small></div><div className="feedback-distribution">{[5,4,3,2,1].map(value=><div key={value}><span>{value}</span><div><i style={{width:(summary.responses?((summary.distribution[String(value)]||0)/summary.responses)*100:0)+'%'}}/></div><b>{summary.distribution[String(value)]||0}</b></div>)}</div><h3>أكثر الجوانب التي طُلب تحسينها</h3>{summary.areas.length?summary.areas.map(item=><div className="feedback-area-row" key={item.area}><span>{areaLabels[item.area]}</span><b>{item.responses}</b><small>متوسط {item.average.toFixed(1)}</small></div>):<p>لا توجد استجابات بعد.</p>}</>:<p>{loading?'جارٍ تحميل الملخص…':'ملخص الإدارة غير متاح حالياً. تأكد من تطبيق تحديث قاعدة البيانات.'}</p>}
   </aside>}
  </section>
 </main>
}
