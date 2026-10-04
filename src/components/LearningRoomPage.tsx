import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowLeft, LockKeyhole, Mic, MicOff, MonitorUp, Play, Radio, Send, Users, Video, VideoOff, X } from 'lucide-react'
import {
  HMSReactiveStore,
  selectHLSState,
  selectHMSMessages,
  selectIsConnectedToRoom,
  selectIsLocalAudioEnabled,
  selectIsLocalVideoEnabled,
  selectPeers,
  type HMSHLS,
  type HMSMessage,
  type HMSPeer,
} from '@100mslive/hms-video-store'
import type { Role } from '../appTypes'
import { isSupabaseConfigured } from '../lib/supabase-config'
import { supabase } from '../lib/supabase'
import './LearningCenter.css'

type WorkshopStatus = 'scheduled' | 'live' | 'ended' | 'recorded'
type Workshop = {
  id: string
  title: string
  description: string
  instructor_name: string
  scheduled_at: string
  duration_minutes: number
  cover_url: string | null
  audience_roles: Role[]
  status: WorkshopStatus
}
const statusNames: Record<WorkshopStatus, string> = { scheduled: 'قادمة', live: 'مباشرة الآن', ended: 'انتهت', recorded: 'متاحة في المكتبة' }
const canManage = (role: Role) => role === 'manager' || role === 'owner'
const localDateTime = (value: string) => new Date(value).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })
function StateMessage({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'error' | 'success' }) {
  return <div className={`learning-state learning-state-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}

function PeerTile({ peer, store, actions }: { peer: HMSPeer; store: ReturnType<HMSReactiveStore['getStore']>; actions: ReturnType<HMSReactiveStore['getActions']> }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = videoRef.current
    const trackId = peer.videoTrack
    if (!video || !trackId) return
    void actions.attachVideo(trackId, video)
    return () => { void actions.detachVideo(trackId, video) }
  }, [peer.videoTrack, actions, store])
  return <article className={`learning-peer ${peer.isLocal ? 'local-peer' : ''}`}>
    {peer.videoTrack ? <video ref={videoRef} autoPlay playsInline muted={peer.isLocal} aria-label={`فيديو ${peer.name}`}/> : <div className="learning-peer-empty"><span>{peer.name.trim().charAt(0) || 'ع'}</span><small>الكاميرا مغلقة</small></div>}
    <span className="learning-peer-name">{peer.name}{peer.isLocal ? ' · أنت' : ''}</span>
  </article>
}

export default function LearningRoomPage({ role, userId, displayName }: { role: Role; userId: string; displayName: string }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [workshop, setWorkshop] = useState<Workshop | null>(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [connected, setConnected] = useState<boolean | undefined>(undefined)
  const [peers, setPeers] = useState<HMSPeer[]>([])
  const [messages, setMessages] = useState<HMSMessage[]>([])
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [hlsState, setHlsState] = useState<HMSHLS | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [ending, setEnding] = useState(false)
  const messageEnd = useRef<HTMLDivElement>(null)
  const manager = useMemo(() => {
    const reactive = new HMSReactiveStore()
    reactive.triggerOnSubscribe()
    return { reactive, store: reactive.getStore(), actions: reactive.getActions() }
  }, [])
  const ownerOrManager = canManage(role)

  useEffect(() => {
    let active = true
    void (async () => {
      if (!supabase || !isSupabaseConfigured || !id) { setLoading(false); setError('يتعذر فتح غرفة الورشة قبل إعداد Supabase.'); return }
      const { data, error: queryError } = await supabase.from('learning_workshops').select('id,title,description,instructor_name,scheduled_at,duration_minutes,cover_url,audience_roles,status').eq('id', id).maybeSingle()
      if (!active) return
      if (queryError || !data) setError('هذه الورشة غير متاحة لحسابك أو لا تزال قاعدة البيانات بحاجة إلى الإعداد.')
      else setWorkshop(data as Workshop)
      setLoading(false)
    })()
    return () => { active = false }
  }, [id])

  useEffect(() => {
    const unsubscribers = [
      manager.store.subscribe(setConnected, selectIsConnectedToRoom),
      manager.store.subscribe(setPeers, selectPeers),
      manager.store.subscribe(setMessages, selectHMSMessages),
      manager.store.subscribe(setAudioEnabled, selectIsLocalAudioEnabled),
      manager.store.subscribe(setVideoEnabled, selectIsLocalVideoEnabled),
      manager.store.subscribe(setHlsState, selectHLSState),
    ]
    const leave = () => { void manager.actions.leave() }
    window.addEventListener('beforeunload', leave)
    return () => {
      window.removeEventListener('beforeunload', leave)
      unsubscribers.forEach(unsubscribe => unsubscribe())
      void manager.actions.leave()
    }
  }, [manager])

  useEffect(() => { messageEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [messages.length])

  const join = async () => {
    if (!supabase || !workshop || !userId || workshop.status !== 'live') return
    setJoining(true); setError('')
    const { data, error: tokenError } = await supabase.functions.invoke('learning-token', { body: { workshopId: workshop.id } })
    const token = data && typeof data.token === 'string' ? data.token : ''
    if (tokenError || !token) { setJoining(false); setError('تعذر إصدار رمز دخول خاص. تأكد من موافقة الحساب وإعداد 100ms وصلاحيات الجمهور.'); return }
    try {
      await manager.actions.join({ userName: displayName || 'عضو مجتمع السيطرة', authToken: token })
    } catch {
      setError('تعذر الاتصال بغرفة الورشة. تحقق من صلاحية دورك أو إعدادات الصوت والكاميرا في المتصفح.')
    } finally { setJoining(false) }
  }

  const toggleAudio = async () => { try { await manager.actions.setLocalAudioEnabled(!audioEnabled) } catch { setError('تعذر تغيير حالة الميكروفون.') } }
  const toggleVideo = async () => { try { await manager.actions.setLocalVideoEnabled(!videoEnabled) } catch { setError('تعذر تغيير حالة الكاميرا.') } }
  const toggleScreenShare = async () => { try { await manager.actions.setScreenShareEnabled(true) } catch { setError('تعذرت مشاركة الشاشة؛ تحقق من دعم المتصفح وإعداد دور المضيف.') } }
  const startBroadcast = async () => {
    setError('')
    try { await manager.actions.startHLSStreaming({ recording: { singleFilePerLayer: true, hlsVod: false } }) }
    catch { setError('تعذر بدء البث/التسجيل. تحقق من إعدادات HLS والتسجيل والتخزين في قالب 100ms وصلاحيات دور المضيف.') }
  }
  const stopBroadcast = async () => {
    try { await manager.actions.stopHLSStreaming() }
    catch { setError('تعذر إيقاف البث المباشر؛ أغلق الورشة بعد التحقق من لوحة 100ms.') }
  }
  const sendQuestion = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.trim() || draft.trim().length > 500) return
    try { await manager.actions.sendBroadcastMessage(draft.trim().slice(0, 500)); setDraft('') }
    catch { setError('تعذر إرسال السؤال في محادثة الورشة.') }
  }
  const endWorkshop = async () => {
    if (!supabase || !workshop || !ownerOrManager) return
    setEnding(true); setError('')
    try {
      if (hlsState?.running) await manager.actions.stopHLSStreaming()
      await manager.actions.leave()
      const { error: endError } = await supabase.rpc('set_learning_workshop_status', { p_workshop_id: workshop.id, p_next_status: 'ended' })
      if (endError) throw endError
      navigate('/learning')
    } catch { setEnding(false); setError('تعذر إنهاء الورشة بأمان. تحقق من حالة البث ثم أعد المحاولة.') }
  }

  if (loading) return <main className="learning-page wrap"><StateMessage>جارٍ التحقق من الورشة…</StateMessage></main>
  if (!workshop) return <main className="learning-page wrap"><StateMessage tone="error">{error || 'الورشة غير متاحة.'}</StateMessage><Link to="/learning" className="btn btn-outline btn-small">العودة إلى مركز التعلم</Link></main>
  return <main className="learning-page learning-room-page wrap" dir="rtl">
    <nav className="breadcrumbs"><Link to="/learning">مركز التعلم</Link><span>/</span><span>{workshop.title}</span></nav>
    <header className="room-heading"><div><span className={`learning-status ${workshop.status === 'live' ? 'status-live' : `status-${workshop.status}`}`}>{workshop.status === 'live' && <i/>}{statusNames[workshop.status]}</span><h1>{workshop.title}</h1><p>المدرب/ة: {workshop.instructor_name} · {localDateTime(workshop.scheduled_at)} · {workshop.duration_minutes} دقيقة</p></div><Link className="btn btn-outline btn-small" to="/learning"><ArrowLeft size={15}/> رجوع</Link></header>
    {error && <StateMessage tone="error">{error}</StateMessage>}
    <div className="learning-notice"><LockKeyhole size={15}/><span>مساحة تعليمية خاصة. لا تذكر أسماء أو تفاصيل تعريفية عن المرضى. المحادثة مرئية للمشاركين في الغرفة.</span></div>
    {!connected ? <section className="room-prejoin"><div className="learning-card-symbol"><Activity size={30}/></div><h2>{workshop.status === 'live' ? 'انضم إلى الورشة الآن' : 'لم يبدأ البث بعد'}</h2><p>{workshop.status === 'live' ? 'سيطلب المتصفح إذناً للميكروفون والكاميرا عند الاتصال. يمكنك إيقافهما من أدوات الغرفة.' : 'تظهر الغرفة عند بدء الورشة من مالك المنصة أو المدير.'}</p>{workshop.status === 'live' && <button className="btn btn-primary" disabled={joining} onClick={() => void join()}><Play size={16}/>{joining ? 'جارٍ الاتصال…' : 'دخول الورشة'}</button>}</section> : <div className="room-layout">
      <section className="room-stage"><div className="room-stage-top"><span className="room-live-pill"><i/> LIVE</span><span><Users size={15}/>{peers.length} مشارك</span><span className="room-protection"><LockKeyhole size={14}/> دخول موثّق</span></div><div className="room-peers">{peers.map(peer => <PeerTile key={peer.id} peer={peer} store={manager.store} actions={manager.actions}/>)}</div>
        <div className="room-controls"><button type="button" className={!audioEnabled ? 'disabled-control' : ''} onClick={() => void toggleAudio()} aria-label={audioEnabled ? 'كتم الميكروفون' : 'تشغيل الميكروفون'}>{audioEnabled ? <Mic size={18}/> : <MicOff size={18}/>}<span>{audioEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}</span></button><button type="button" className={!videoEnabled ? 'disabled-control' : ''} onClick={() => void toggleVideo()} aria-label={videoEnabled ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}>{videoEnabled ? <Video size={18}/> : <VideoOff size={18}/>}<span>{videoEnabled ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}</span></button><button type="button" onClick={() => void toggleScreenShare()} aria-label="مشاركة الشاشة"><MonitorUp size={18}/><span>مشاركة الشاشة</span></button>{ownerOrManager && <button type="button" className={hlsState?.running ? 'is-broadcasting' : ''} onClick={() => void (hlsState?.running ? stopBroadcast() : startBroadcast())} aria-label={hlsState?.running ? 'إيقاف البث والتسجيل' : 'بدء البث والتسجيل'}><Radio size={18}/><span>{hlsState?.running ? 'إيقاف البث' : 'بدء البث والتسجيل'}</span></button>}{ownerOrManager ? <button type="button" className="end-workshop" disabled={ending} onClick={() => void endWorkshop()}><X size={18}/><span>{ending ? 'جارٍ الإنهاء…' : 'إنهاء الورشة'}</span></button> : <button type="button" className="end-workshop" onClick={() => { void manager.actions.leave(); navigate('/learning') }}><X size={18}/><span>مغادرة الغرفة</span></button>}</div>
        {hlsState?.running && <div className="broadcast-status"><Radio size={15}/> البث الحي والتسجيل يعملان. ستظهر النسخة المسجلة في المكتبة بعد اكتمال الرفع والتحقق من أصل التسجيل.</div>}
      </section>
      <aside className="room-chat"><header><div><h2>الأسئلة والمحادثة</h2><small>استخدم اسمك المهني ولا تذكر بيانات مرضى.</small></div><span><Activity size={15}/>{messages.length}</span></header><div className="room-messages" aria-live="polite">{messages.slice(-80).map((message, index) => <article className={`room-message ${message.senderUserId === userId ? 'own-message' : ''}`} key={message.id || index}><b>{message.senderName || 'مشارك'}</b><p>{String(message.message ?? '')}</p><time>{new Date(message.time).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}</time></article>)}{messages.length === 0 && <p className="room-chat-empty">ابدأ بطرح سؤال مهني عام.</p>}<div ref={messageEnd}/></div><form className="room-chat-form" onSubmit={sendQuestion}><label className="sr-only" htmlFor="learning-question">اكتب سؤالاً</label><input id="learning-question" value={draft} maxLength={500} onChange={e => setDraft(e.target.value)} placeholder="اكتب سؤالاً أو تعليقاً…"/><button className="btn btn-primary btn-small" disabled={!draft.trim()} aria-label="إرسال السؤال"><Send size={15}/></button></form></aside>
    </div>}
    {!connected && ownerOrManager && workshop.status === 'live' && <StateMessage tone="neutral">بمجرد دخولك بصفتك مديراً سيظهر لك خيار بدء البث والتسجيل وإنهاء الورشة.</StateMessage>}
    <footer className="learning-footer"><span><LockKeyhole size={14}/> رموز الغرفة تصدر من الخادم بصلاحية 10 دقائق.</span><Link to="/learning">العودة إلى مركز التعلم</Link></footer>
  </main>
}
