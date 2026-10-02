import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bookmark, Flag, Heart, MessageCircle, Plus, Send, ShieldCheck, Users } from 'lucide-react'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'

type LivePost = {
  id: string
  author_id: string
  author_name: string | null
  author_title: string | null
  author_role: Role | null
  body: string
  created_at: string
  likes_count: number
  comments_count: number
  liked_by_me: boolean
  saved_by_me: boolean
}

const roleText: Record<Role, string> = { member: 'عضو', verified: 'عضو موثّق', coach: 'كوتش', moderator: 'مشرف', manager: 'مدير' }
const canPublish = (role: Role) => ['verified', 'coach', 'moderator', 'manager'].includes(role)

export function LiveFeedPage({ userId, role, displayName }: { userId: string; role: Role; displayName: string }) {
  const [posts, setPosts] = useState<LivePost[]>([])
  const [body, setBody] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [commentFor, setCommentFor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    const { data, error: queryError } = await supabase.from('community_feed')
      .select('id,author_id,author_name,author_title,author_role,body,created_at,likes_count,comments_count,liked_by_me')
      .order('created_at', { ascending: false }).limit(40)
    if (queryError) {
      setError('تعذر تحميل الخلاصة من قاعدة البيانات. تأكد من تطبيق migrations 001–006 ثم أعد المحاولة.')
      setPosts([])
      setLoading(false)
      return
    }
    const ids = (data ?? []).map(row => row.id)
    const { data: saves } = ids.length
      ? await supabase.from('saved_posts').select('post_id').eq('user_id', userId).in('post_id', ids)
      : { data: [] as { post_id: string }[] }
    const saved = new Set((saves ?? []).map(row => row.post_id))
    setPosts((data ?? []).map(row => ({
      ...row,
      author_name: row.author_name || 'عضو في المجتمع',
      author_title: row.author_title || 'مهني صحي',
      author_role: (row.author_role || 'member') as Role,
      likes_count: Number(row.likes_count || 0),
      comments_count: Number(row.comments_count || 0),
      liked_by_me: Boolean(row.liked_by_me),
      saved_by_me: saved.has(row.id),
    })) as LivePost[])
    setError('')
    setLoading(false)
  }, [userId])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !canPublish(role) || !body.trim()) return
    setBusy(true); setNotice(''); setError('')
    const { error: insertError } = await supabase.from('posts').insert({ author_id: userId, body: body.trim(), visibility: 'members' })
    setBusy(false)
    if (insertError) { setError('لم يُنشر المنشور. تحقّق من صلاحية النشر أو حدّ النشر اليومي.'); return }
    setBody(''); setNotice('نُشر المنشور في مجتمع الأعضاء.'); await load()
  }

  async function toggleLike(post: LivePost) {
    if (!supabase) return
    setError('');
    const response = post.liked_by_me
      ? await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', userId)
      : await supabase.from('post_likes').insert({ post_id: post.id, user_id: userId })
    if (response.error) { setError('تعذر تحديث الإعجاب.'); return }
    setPosts(items => items.map(item => item.id === post.id ? { ...item, liked_by_me: !item.liked_by_me, likes_count: Math.max(0, item.likes_count + (item.liked_by_me ? -1 : 1)) } : item))
  }

  async function toggleSave(post: LivePost) {
    if (!supabase) return
    const response = post.saved_by_me
      ? await supabase.from('saved_posts').delete().eq('post_id', post.id).eq('user_id', userId)
      : await supabase.from('saved_posts').insert({ post_id: post.id, user_id: userId })
    if (response.error) { setError('تعذر حفظ المنشور.'); return }
    setPosts(items => items.map(item => item.id === post.id ? { ...item, saved_by_me: !item.saved_by_me } : item))
  }

  async function addComment(event: React.FormEvent<HTMLFormElement>, post: LivePost) {
    event.preventDefault()
    if (!supabase || !commentBody.trim()) return
    const { error: insertError } = await supabase.from('comments').insert({ post_id: post.id, author_id: userId, body: commentBody.trim() })
    if (insertError) { setError('تعذر إضافة التعليق.'); return }
    setCommentBody(''); setCommentFor(null); setNotice('أُضيف تعليقك.');
    setPosts(items => items.map(item => item.id === post.id ? { ...item, comments_count: item.comments_count + 1 } : item))
  }

  async function report(post: LivePost) {
    if (!supabase) return
    const { error: insertError } = await supabase.from('reports').insert({ reporter_id: userId, target_type: 'post', target_id: post.id, reason: 'other', details: 'بلاغ عبر واجهة الخلاصة.' })
    if (insertError) setError('تعذر إرسال البلاغ.'); else setNotice('وصل البلاغ إلى فريق الإشراف.')
  }

  return <main className="app-main wrap"><div className="feed-top"><div><span className="eyebrow">مساحة الأعضاء</span><h1>الخلاصة المهنية</h1><p className="muted">منشورات حقيقية يتيحها حسابك وسياسات قاعدة البيانات.</p></div><Link className="btn btn-outline" to="/groups"><Users size={16}/> مجموعاتي</Link></div>
    {(notice || error) && <div className={`inline-message ${error ? 'live-error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}</div>}
    {canPublish(role) ? <form className="composer-card live-composer" onSubmit={publish}><div className="composer-head"><span className="avatar avatar-0 avatar-md">{displayName.trim().charAt(0) || 'ع'}</span><label htmlFor="live-post">ما الفكرة المهنية التي تود مشاركتها؟</label></div><textarea id="live-post" maxLength={5000} required value={body} onChange={event => setBody(event.target.value)} placeholder="اكتب دون مشاركة أي معلومات أو صور تخص المرضى…"/><div className="composer-footer"><small>{body.length}/5000 · تخضع المنشورات لحد يومي وسياسات الإشراف.</small><button className="btn btn-primary btn-small" disabled={busy || !body.trim()}>{busy ? 'جارٍ النشر…' : 'نشر'} <Send size={14}/></button></div></form> : <div className="live-state"><ShieldCheck size={18}/><span>القراءة والتفاعل متاحان. صلاحية النشر تُمنح بعد إتمام التوثيق المهني.</span><Link to="/verification">طلب التوثيق <ArrowLeft size={14}/></Link></div>}
    <div className="feed-layout"><section className="feed-stream">{loading ? <div className="live-state">جارٍ تحميل منشورات المجتمع…</div> : posts.length === 0 ? <div className="panel-card empty-state"><h2>لا توجد منشورات متاحة بعد</h2><p>ستظهر هنا المنشورات المنشورة فعلياً بعد انضمام الأعضاء ومشاركة محتوى مناسب.</p></div> : posts.map(post => <article className="post-card" key={post.id}><div className="post-head"><span className="avatar avatar-1 avatar-md">{post.author_name?.trim().charAt(0) || 'ع'}</span><div className="post-author"><b>{post.author_name} {post.author_role && post.author_role !== 'member' && <span className="verified-mark"><ShieldCheck size={13}/></span>}</b><small>{post.author_title} · {new Date(post.created_at).toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' })}</small></div><button className="icon-btn" title="الإبلاغ عن المنشور" onClick={() => void report(post)}><Flag size={16}/></button></div><p className="post-text">{post.body}</p><div className="post-actions"><button className={post.liked_by_me ? 'is-active' : ''} onClick={() => void toggleLike(post)}><Heart size={16}/>{post.likes_count}</button><button onClick={() => setCommentFor(commentFor === post.id ? null : post.id)}><MessageCircle size={16}/>{post.comments_count}</button><button className={post.saved_by_me ? 'is-active' : ''} onClick={() => void toggleSave(post)}><Bookmark size={16}/>{post.saved_by_me ? 'محفوظ' : 'حفظ'}</button></div>{commentFor === post.id && <form className="live-comment-form" onSubmit={event => void addComment(event, post)}><input aria-label="التعليق" value={commentBody} onChange={event => setCommentBody(event.target.value)} maxLength={2000} placeholder="أضف تعليقاً مهنياً…" required/><button className="btn btn-primary btn-small"><Plus size={14}/> إضافة</button></form>}</article>)}</section><aside className="feed-aside"><div className="side-card"><span className="eyebrow">حسابك</span><h3>{displayName}</h3><p>{roleText[role]}</p><Link to="/profile" className="text-link">ملفي الشخصي <ArrowLeft size={14}/></Link></div><div className="side-card"><span className="eyebrow">خصوصية مهنية</span><p>لا تنشر أي معلومات أو صور تخص المرضى، حتى بعد إزالة الأسماء.</p><Link to="/charter" className="text-link">ميثاق السلوك <ArrowLeft size={14}/></Link></div></aside></div>
  </main>
}
