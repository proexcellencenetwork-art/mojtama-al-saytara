import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, RefreshCw, Send, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'

type DiscussionMessage = {
  id: string
  workshop_id: string
  author_id: string
  body: string
  created_at: string
}

type ProfileName = { user_id: string; display_name: string }

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString('ar-SA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function LearningDiscussionThread({
  workshopId,
  userId,
  displayName,
}: {
  workshopId: string
  userId: string
  displayName: string
}) {
  const [messages, setMessages] = useState<DiscussionMessage[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [realtimeReady, setRealtimeReady] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!supabase || !workshopId) {
      setError('خدمة النقاش غير متصلة حالياً. حدّث الصفحة أو تواصل مع إدارة المجتمع.')
      setLoading(false)
      return
    }

    const { data, error: queryError } = await supabase
      .from('learning_discussion_messages')
      .select('id,workshop_id,author_id,body,created_at')
      .eq('workshop_id', workshopId)
      .order('created_at', { ascending: true })
      .limit(250)

    if (queryError) {
      setError('تعذر تحميل النقاش. تحقق من اعتماد الحساب وصلاحية دخولك لهذه الورشة.')
      setLoading(false)
      return
    }

    const rows = (data || []) as DiscussionMessage[]
    setMessages(rows)
    const authorIds = [...new Set(rows.map(row => row.author_id))]
    if (authorIds.length) {
      const { data: people } = await supabase
        .from('profiles')
        .select('user_id,display_name')
        .in('user_id', authorIds)
      const nextNames = Object.fromEntries(
        ((people || []) as ProfileName[]).map(person => [person.user_id, person.display_name]),
      )
      setNames(nextNames)
    } else {
      setNames({})
    }
    setError('')
    setLoading(false)
  }, [workshopId])

  useEffect(() => {
    let active = true
    setLoading(true)
    void load()
    if (!supabase || !workshopId) return () => { active = false }

    const channel = supabase
      .channel(`learning-discussion-${workshopId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'learning_discussion_messages',
          filter: `workshop_id=eq.${workshopId}`,
        },
        () => { if (active) void load() },
      )
      .subscribe(status => {
        if (!active) return
        setRealtimeReady(status === 'SUBSCRIBED')
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('تعذر الاتصال بالتحديث المباشر. ما زال بإمكانك تحديث النقاش يدوياً.')
        }
      })

    return () => {
      active = false
      void supabase?.removeChannel(channel)
    }
  }, [load, workshopId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length])

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const body = draft.trim()
    if (!supabase || !userId || !body || body.length > 2000 || sending) return

    setSending(true)
    setError('')
    const { error: insertError } = await supabase
      .from('learning_discussion_messages')
      .insert({ workshop_id: workshopId, author_id: userId, body })

    setSending(false)
    if (insertError) {
      setError('لم تُرسل الرسالة. تأكد من اعتماد حسابك وأنك ضمن جمهور الورشة.')
      return
    }
    setDraft('')
    await load()
  }

  return (
    <section className="room-chat learning-discussion-thread" aria-label="نقاش الورشة">
      <header>
        <div>
          <h2><MessageCircle size={17}/> نقاش الورشة والمتابعة</h2>
          <small>رسائل محفوظة تبقى متاحة قبل البث وأثناءه وبعد انتهائه</small>
        </div>
        <span title={realtimeReady ? 'التحديث المباشر متصل' : 'التحديث المباشر غير متصل'}>
          <span className={`discussion-live-dot ${realtimeReady ? 'is-connected' : ''}`}/>
          {messages.length.toLocaleString('ar-SA')}
        </span>
      </header>

      <div className="room-messages discussion-messages" aria-live="polite">
        {loading ? (
          <p className="room-chat-empty">جارٍ تحميل الرسائل…</p>
        ) : messages.length ? messages.map(message => {
          const own = message.author_id === userId
          const author = names[message.author_id] || (own ? displayName : 'عضو')
          return (
            <article className={`room-message ${own ? 'own-message' : ''}`} key={message.id}>
              <b>{author || 'عضو'}</b>
              <p>{message.body}</p>
              <time>{formatMessageTime(message.created_at)}</time>
            </article>
          )
        }) : (
          <div className="room-chat-empty discussion-empty">
            <MessageCircle size={23}/>
            <b>ابدأ النقاش المهني</b>
            <span>اكتب سؤالاً أو مشاركة مرتبطة بمحاور الورشة. ستكون الرسائل محفوظة للمتابعة.</span>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {error && <p className="discussion-error" role="alert">{error}</p>}
      <form className="room-chat-form" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor={`learning-discussion-${workshopId}`}>اكتب رسالة في النقاش</label>
        <input
          id={`learning-discussion-${workshopId}`}
          value={draft}
          maxLength={2000}
          onChange={event => setDraft(event.target.value)}
          placeholder="اكتب رسالة أو سؤالاً…"
          disabled={!userId || sending}
        />
        <button className="btn btn-primary btn-small" type="submit" disabled={!draft.trim() || sending || !userId} aria-label="إرسال الرسالة">
          <Send size={15}/>
        </button>
        <button className="discussion-refresh" type="button" onClick={() => void load()} disabled={loading} aria-label="تحديث النقاش" title="تحديث النقاش">
          <RefreshCw size={15}/>
        </button>
      </form>
      <footer className="discussion-privacy"><ShieldCheck size={14}/> لا تشارك بيانات المرضى أو المعلومات السرية. النقاش متاح للأعضاء المعتمدين المصرّح لهم بالورشة فقط.</footer>
    </section>
  )
}
