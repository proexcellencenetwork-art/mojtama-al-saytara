import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Copy, Film, LockKeyhole, Play, Plus, RefreshCw, ShieldCheck, Video } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'
import './EducationalVideosPage.css'

type VideoRow={id:string;slug:string;title:string;description:string;youtube_video_id:string;access_mode:'public'|'unlisted'|'members';is_published:boolean;share_token:string;play_starts:number}
type PublicVideo=Pick<VideoRow,'id'|'slug'|'title'|'description'|'youtube_video_id'|'play_starts'|'access_mode'>
const blank={slug:'',title:'',description:'',youtube_video_id:'',access_mode:'public' as VideoRow['access_mode'],is_published:true}
const accessLabel=(mode:string)=>mode==='public'?'عام':mode==='unlisted'?'خاص بالرابط':'للأعضاء المعتمدين'
export default function EducationalVideosPage({role,manage=false}:{role:Role;manage?:boolean}){
 const {slug}=useParams();const location=useLocation()
 const [videos,setVideos]=useState<VideoRow[]>([]),[current,setCurrent]=useState<PublicVideo|null>(null)
 const [form,setForm]=useState(blank),[editingId,setEditingId]=useState<string|null>(null)
 const [playing,setPlaying]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [error,setError]=useState(''),[notice,setNotice]=useState('')
 const token=new URLSearchParams(location.search).get('key')
 const owner=role==='owner'
 const load=useCallback(async()=>{
  if(!supabase){setLoading(false);setError('الاتصال بالخدمة غير متاح.');return}
  setLoading(true);setError('')
  if(manage){
   if(!owner){setError('هذه الصفحة للمالك فقط.');setLoading(false);return}
   const {data,error:loadError}=await supabase.rpc('owner_list_educational_videos')
   if(loadError)setError('تعذر تحميل مكتبة الفيديو للمالك.')
   else setVideos(Array.isArray(data)?data as VideoRow[]:[])
  }else if(slug){
   const {data,error:loadError}=await supabase.rpc('get_educational_video',{p_slug:slug,p_share_token:token})
   if(loadError)setError('تعذر تحميل الفيديو.')
   else setCurrent(data as PublicVideo|null)
  }else{
   const {data,error:loadError}=await supabase.rpc('list_public_educational_videos')
   if(loadError)setError('تعذر تحميل الفيديوهات العامة.')
   else setVideos(Array.isArray(data)?data as PublicVideo[]:[])
  }
  setLoading(false)
 },[manage,owner,slug,token])
 useEffect(()=>{void load()},[load])
 function resetForm(){setForm(blank);setEditingId(null)}
 function editVideo(video:VideoRow){setForm({slug:video.slug,title:video.title,description:video.description,youtube_video_id:video.youtube_video_id,access_mode:video.access_mode,is_published:video.is_published});setEditingId(video.id);window.scrollTo({top:0,behavior:'smooth'})}
 async function saveVideo(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!supabase||busy)return
  setBusy(true);setError('');setNotice('')
  const {data,error:saveError}=await supabase.rpc('owner_upsert_educational_video',{p_id:editingId,p_slug:form.slug.trim().toLowerCase(),p_title:form.title.trim(),p_description:form.description.trim(),p_youtube_video_id:form.youtube_video_id.trim(),p_access_mode:form.access_mode,p_is_published:form.is_published})
  setBusy(false)
  if(saveError){setError('تعذر حفظ الفيديو. تحقق من صيغة الرابط ومعرّف YouTube وصلاحية المالك.');return}
  setNotice('تم حفظ إعداد الفيديو.');resetForm();await load()
 }
 async function startVideo(){
  if(!supabase||!current||busy)return
  setBusy(true);setError('')
  const params=new URLSearchParams(window.location.search)
  const {data,error:playError}=await supabase.rpc('record_educational_video_play',{p_slug:current.slug,p_share_token:token,p_source:params.get('utm_source'),p_medium:params.get('utm_medium'),p_campaign:params.get('utm_campaign')})
  setBusy(false)
  if(playError){setError('لم يتم تشغيل الفيديو؛ تحقق من صلاحية الرابط أو عضوية الحساب.');return}
  setCurrent({...current,play_starts:Number(data)||current.play_starts+1});setPlaying(true)
 }
 function shareUrl(video:VideoRow){
  const base=window.location.origin+import.meta.env.BASE_URL+'videos/'+video.slug+'/'
  return video.access_mode==='unlisted'?base+'?key='+encodeURIComponent(video.share_token):base
 }
 async function copyLink(video:VideoRow){
  try{await navigator.clipboard.writeText(shareUrl(video));setNotice('تم نسخ رابط المشاهدة.')}catch{setNotice('تعذر النسخ التلقائي؛ افتح رابط الفيديو لنسخه يدوياً.')}
 }
 if(manage)return <main className="app-main wrap educational-videos-page" dir="rtl">
  <header className="educational-videos-heading"><div><span className="eyebrow">استوديو الفيديو · المالك</span><h1>إدارة مكتبة الفيديو</h1><p>أضف فيديوهات YouTube المجانية، واختر إتاحتها العامة أو الخاصة بالرابط أو للأعضاء المعتمدين.</p></div><button className="btn btn-outline btn-small" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> تحديث</button></header>
  {error&&<p className="video-error" role="alert">{error}</p>}{notice&&<p className="video-notice" role="status">{notice}</p>}
  <form className="video-admin-form" onSubmit={saveVideo}><h2>{editingId?'تعديل فيديو':'إضافة فيديو جديد'}</h2>
   <label>عنوان الفيديو<input required minLength={3} maxLength={140} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="مثال: كيف تبني ملف إنجازاتك"/></label>
   <label>الرابط المختصر (slug)<input required pattern="[a-z0-9][a-z0-9-]{1,79}" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})} placeholder="build-achievement-portfolio" dir="ltr"/></label>
   <label>رابط YouTube أو Video ID<input required value={form.youtube_video_id} onChange={e=>{const v=e.target.value.trim();const m=v.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);setForm({...form,youtube_video_id:m?.[1]||v})}} placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX" dir="ltr"/></label>
   <label>وصف مختصر<textarea rows={3} maxLength={1200} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
   <label>نوع الإتاحة<select value={form.access_mode} onChange={e=>setForm({...form,access_mode:e.target.value as VideoRow['access_mode']})}><option value="public">عام — يظهر في قائمة الفيديوهات</option><option value="unlisted">خاص بالرابط — لا يظهر في القائمة</option><option value="members">للأعضاء المعتمدين — يتطلب تسجيل الدخول</option></select></label>
   <label className="video-publish-toggle"><input type="checkbox" checked={form.is_published} onChange={e=>setForm({...form,is_published:e.target.checked})}/> نشر الفيديو وإتاحته حسب نوع الوصول</label>
   <div className="video-admin-actions"><button className="btn btn-primary" disabled={busy}>{busy?'جارٍ الحفظ…':'حفظ الفيديو'}</button>{editingId&&<button className="btn btn-outline" type="button" onClick={resetForm}>إلغاء التعديل</button>}</div>
  </form>
  <section className="video-admin-list"><h2>الفيديوهات المحفوظة</h2>{loading?'جارٍ التحميل…':videos.map(video=><article className="video-admin-row" key={video.id}><div><b>{video.title}</b><small dir="ltr">{video.slug}</small><small>{accessLabel(video.access_mode)} · {video.is_published?'منشور':'مسودة'} · {video.play_starts.toLocaleString('ar')} بدء تشغيل</small></div><div><button className="btn btn-outline btn-small" onClick={()=>editVideo(video)}>تعديل</button><button className="btn btn-outline btn-small" onClick={()=>void copyLink(video)}><Copy size={14}/> نسخ الرابط</button></div></article>)}</section>
  <p className="video-privacy-note"><ShieldCheck size={16}/> عدد المشاهدات هنا يعني مرات بدء تشغيل الفيديو من الموقع، وليس مدة المشاهدة. YouTube Analytics يظل مرجع مدة المشاهدة والاحتفاظ بالمشاهدين.</p>
 </main>
 if(slug)return <main className="public-page wrap educational-videos-page" dir="rtl"><nav className="breadcrumbs"><Link to="/">الرئيسية</Link><span>/</span><Link to="/videos">الفيديوهات</Link><span>/</span><span>{current?.title||'مشاهدة الفيديو'}</span></nav>{loading?<p>جارٍ تحميل الفيديو…</p>:!current?<section className="video-unavailable"><LockKeyhole size={28}/><h1>الفيديو غير متاح بهذا الرابط.</h1><p>قد يكون الرابط خاصاً أو انتهت صلاحيته أو يتطلب حساب عضو معتمد.</p><Link className="btn btn-primary" to="/videos">العودة إلى مكتبة الفيديو</Link></section>:<><header className="educational-videos-heading"><div><span className="eyebrow">مكتبة مجتمع السيطرة</span><h1>{current.title}</h1><p>{current.description}</p></div></header><section className="video-player-shell">{playing?<iframe src={'https://www.youtube-nocookie.com/embed/'+current.youtube_video_id+'?autoplay=1&rel=0&playsinline=1'} title={current.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen/>:<button className="video-play-cover" onClick={()=>void startVideo()} disabled={busy}><img src={'https://i.ytimg.com/vi/'+current.youtube_video_id+'/hqdefault.jpg'} alt="" loading="lazy"/><span><Play size={26}/>{busy?'جارٍ التحقق…':'شاهد الفيديو'}</span></button>}</section>{error&&<p className="video-error" role="alert">{error}</p>}<p className="video-view-count"><Film size={16}/> {current.play_starts.toLocaleString('ar')} مرات بدء تشغيل من الموقع</p><Link to="/videos" className="text-link"><ArrowLeft size={15}/> مكتبة الفيديو</Link></>}</main>
 return <main className="public-page wrap educational-videos-page" dir="rtl"><header className="educational-videos-heading"><div><span className="eyebrow"><Video size={15}/> محتوى مرئي مجاني</span><h1>مكتبة الفيديو</h1><p>دروس ومقاطع مجانية من قناة مجتمع السيطرة المهنية، تشاهدها مباشرة من الموقع.</p></div>{owner&&<Link className="btn btn-outline btn-small" to="/owner/videos">إدارة مكتبة الفيديو</Link>}</header>{loading?<p>جارٍ تحميل الفيديوهات…</p>:error?<p className="video-error">{error}</p>:videos.length===0?<section className="video-unavailable"><Film size={30}/><h2>قريباً نضيف أول فيديو.</h2><p>ستظهر هنا المقاطع العامة بعد نشرها من لوحة المالك.</p></section>:<div className="educational-video-grid">{videos.map(video=><Link className="educational-video-card" key={video.id} to={'/videos/'+video.slug+'/'}><img src={'https://i.ytimg.com/vi/'+video.youtube_video_id+'/hqdefault.jpg'} alt="" loading="lazy"/><div><h2>{video.title}</h2><p>{video.description}</p><small>{video.play_starts.toLocaleString('ar')} مرات بدء تشغيل</small></div></Link>)}</div>}</main>
}
