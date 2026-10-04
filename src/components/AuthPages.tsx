import { useState } from 'react'
import type { FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, Sparkles } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { isPublicSignupEnabled } from '../lib/supabase-config'

type AuthPageProps = { onDemo: () => void; onSignedIn: (user: User) => void }
const googleAuthEnabled = import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true'

function getAppBaseUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString()
}

function hasConfirmedEmail(user: User | null | undefined) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at)
}

function authMessage(message: string) {
  const text = message.toLowerCase()
  if (text.includes('invalid login credentials')) return 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
  if (text.includes('email not confirmed')) return 'أكّد بريدك الإلكتروني أولاً ثم سجّل الدخول.'
  if (text.includes('user already registered')) return 'يوجد حساب بهذا البريد. جرّب تسجيل الدخول أو استعادة كلمة المرور.'
  if (text.includes('unsupported provider') || (text.includes('provider') && (text.includes('disabled') || text.includes('not enabled')))) return 'تسجيل الدخول عبر Google غير مفعّل في إعدادات Supabase بعد.'
  if (text.includes('password') && text.includes('least')) return 'كلمة المرور لا تحقق الحد الأدنى المطلوب.'
  if (text.includes('rate limit') || text.includes('too many requests')) return 'محاولات كثيرة خلال وقت قصير. انتظر قليلاً ثم حاول مجدداً.'
  if (text.includes('network') || text.includes('fetch')) return 'تعذر الاتصال بالخدمة الآن. تحقق من الإنترنت وحاول مجدداً.'
  return 'تعذر إكمال الطلب. تحقق من الإعدادات وحاول مرة أخرى.'
}

export function LoginPage({ onDemo, onSignedIn }: AuthPageProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const callbackError = (location.state as { authError?: unknown } | null)?.authError
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/'
  const mode = normalizedPath === '/register' ? 'register' : 'login'
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [canResendConfirmation, setCanResendConfirmation] = useState(
    () => typeof callbackError === 'string' && /email|بريد|تأكيد/i.test(callbackError),
  )
  const [message, setMessage] = useState(typeof callbackError === 'string' ? callbackError : '')
  const [isError, setIsError] = useState(typeof callbackError === 'string' && callbackError.length > 0)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setIsError(false)
    if (!isSupabaseConfigured || !supabase) {
      setIsError(true)
      setMessage('الحسابات الحقيقية غير مفعّلة بعد. استكشف نسخة التجربة الآن، أو أضف إعدادات Supabase كما في دليل الإعداد.')
      return
    }
    setBusy(true)
    try {
      if (forgot) {
        const redirectTo = `${getAppBaseUrl()}?flow=recovery`
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
        if (error) throw error
        setMessage('إذا كان البريد مرتبطاً بحساب، فستصلك رسالة لاستعادة كلمة المرور. تحقق من صندوق الوارد والرسائل غير المرغوب فيها.')
        return
      }
      if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: `${getAppBaseUrl()}?flow=confirm`,
          },
        })
        if (error) throw error
        if (data.session && data.user && hasConfirmedEmail(data.user)) {
          setCanResendConfirmation(false)
          onSignedIn(data.user)
          navigate('/pending-review', { replace: true })
        } else {
          if (data.session) await supabase.auth.signOut({ scope: 'local' })
          setCanResendConfirmation(true)
          setMessage('أُنشئ الحساب. أكّد بريدك من الرسالة؛ بعد ذلك يبقى الوصول للعضوية محدوداً حتى مراجعة المدير واعتماد الحساب.')
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
        if (!data.session || !data.user || !hasConfirmedEmail(data.user)) {
          if (data.session) await supabase.auth.signOut({ scope: 'local' })
          setCanResendConfirmation(Boolean(data.user && !hasConfirmedEmail(data.user)))
          setIsError(true)
          setMessage('يجب تأكيد بريدك الإلكتروني قبل استخدام حساب العضو. أعد إرسال رسالة التأكيد إذا لزم الأمر.')
          return
        }
        setCanResendConfirmation(false)
        onSignedIn(data.user)
        navigate('/pending-review', { replace: true })
      }
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes('email not confirmed')) setCanResendConfirmation(true)
      setIsError(true)
      setMessage(authMessage(error instanceof Error ? error.message : 'auth error'))
    } finally {
      setBusy(false)
    }
  }

  async function resendConfirmation() {
    if (!isSupabaseConfigured || !supabase) {
      setIsError(true)
      setMessage('تعذر إرسال رسالة التأكيد لأن الاتصال بالخدمة غير مفعّل.')
      return
    }
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setIsError(true)
      setMessage('أدخل بريدك الإلكتروني أولاً لإعادة إرسال رسالة التأكيد.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: { emailRedirectTo: `${getAppBaseUrl()}?flow=confirm` },
      })
      if (error) throw error
      setIsError(false)
      setMessage('إذا كان الحساب مرتبطاً بهذا البريد ولم يُؤكّد بعد، فستصلك رسالة تأكيد. تحقق من الوارد والرسائل غير المرغوب فيها.')
    } catch (error) {
      setIsError(true)
      setMessage(authMessage(error instanceof Error ? error.message : 'confirmation resend error'))
    } finally {
      setBusy(false)
    }
  }

  async function signInWithGoogle() {
    setMessage('')
    setIsError(false)
    if (!isSupabaseConfigured || !supabase) {
      setIsError(true)
      setMessage('أضف إعدادات Supabase أولاً لتفعيل تسجيل الدخول عبر Google.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${getAppBaseUrl()}?flow=oauth` },
      })
      if (error) throw error
    } catch (error) {
      setIsError(true)
      setMessage(authMessage(error instanceof Error ? error.message : 'oauth error'))
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'register' && !isPublicSignupEnabled) return <main className="auth-wrap"><div className="auth-card"><div className="auth-intro"><span className="eyebrow">الدخول بالدعوة فقط</span><h1>التسجيل العام متوقف مؤقتاً.</h1><p>أوقفنا إنشاء الحسابات الجديدة حتى اكتمال اختبارات القبول والأمان. لن تُقبل حسابات عامة في هذه المرحلة.</p></div><div className="inline-message" role="status">إذا وصلتك دعوة على بريدك، افتح رسالة Supabase ثم أكّد البريد. للحسابات الموجودة، استخدم تسجيل الدخول أو استعادة كلمة المرور.</div><Link className="btn btn-primary btn-full" to="/login">الانتقال إلى تسجيل الدخول <ArrowLeft size={16}/></Link><p className="auth-switch">وصلتك دعوة؟ افتح رابطها من بريدك الإلكتروني، ثم سجّل الدخول هنا إذا طُلب منك ذلك.</p><small className="auth-privacy"><LockKeyhole size={13}/> لا ترسل كلمات المرور أو روابط التأكيد لأحد.</small></div></main>
  const heading = forgot ? 'استعادة كلمة المرور' : mode === 'login' ? 'أهلاً بعودتك.' : 'مكانك بيننا.'
  return <main className="auth-wrap"><div className="auth-card">
    <div className="auth-intro"><span className="eyebrow">{forgot ? 'نرسل رابطاً آمناً إلى بريدك' : mode === 'login' ? 'سعداء بعودتك' : 'خطوة مهنية جديدة'}</span><h1>{heading}</h1><p>{forgot ? 'أدخل البريد المستخدم في حسابك، وسنرسل رابطاً لاختيار كلمة مرور جديدة.' : mode === 'login' ? 'تابع مساحتك المهنية من حيث توقفت.' : 'أنشئ حسابك وانضم إلى حوار مهني أكثر توازناً.'}</p></div>
    <form onSubmit={submit} className="auth-form">
      {mode === 'register' && !forgot && <label>الاسم الكامل<input autoComplete="name" required minLength={2} maxLength={100} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="الاسم الذي سيظهر للأعضاء"/></label>}
      <label>البريد الإلكتروني<input autoComplete="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" dir="ltr"/></label>
      {!forgot && <label>كلمة المرور<input autoComplete={mode === 'register' ? 'new-password' : 'current-password'} type="password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="٨ أحرف على الأقل" dir="ltr"/></label>}
      {!forgot && mode === 'login' && <button className="auth-inline-link" type="button" onClick={() => { setForgot(true); setMessage('') }}>نسيت كلمة المرور؟</button>}
      <button className="btn btn-primary btn-full" type="submit" disabled={busy}>{busy ? 'جارٍ الإرسال…' : forgot ? 'إرسال رابط الاستعادة' : mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'} <ArrowLeft size={16}/></button>
    </form>
    {message && <div className={`inline-message ${isError ? 'live-error' : ''}`} role={isError ? 'alert' : 'status'}>{message}</div>}
    {canResendConfirmation && !forgot && <button className="auth-inline-link" type="button" onClick={() => void resendConfirmation()} disabled={busy || !email.trim()}>إعادة إرسال رسالة تأكيد البريد</button>}
    {isSupabaseConfigured && googleAuthEnabled && !forgot && <><div className="auth-separator"><span>أو</span></div><button className="btn btn-outline btn-full auth-google-button" type="button" onClick={() => void signInWithGoogle()} disabled={busy} aria-label="المتابعة بحساب Google"><span className="google-mark" aria-hidden="true">G</span><span>{busy ? 'جارٍ فتح Google…' : 'المتابعة بحساب Google'}</span></button></>}
    {(!isSupabaseConfigured || forgot) && <div className="auth-separator"><span>{forgot ? 'أو' : 'نسخة استعراض'}</span></div>}
    {!isSupabaseConfigured && <button className="btn btn-outline btn-full" onClick={() => { onDemo(); navigate('/feed') }}><Sparkles size={16}/> استكشف نسخة التجربة</button>}
    <p className="auth-switch">{forgot ? 'تذكرت كلمة المرور؟' : mode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب؟'} <button type="button" onClick={() => { setForgot(false); setCanResendConfirmation(false); setMessage(''); navigate(forgot ? '/login' : mode === 'login' ? '/register' : '/login') }}>{forgot ? 'العودة للدخول' : mode === 'login' ? 'أنشئ حساباً' : 'سجّل الدخول'}</button></p>
    <small className="auth-privacy"><LockKeyhole size={13}/> لن نطلب بيانات صحية حساسة.</small>
  </div></main>
}

export function ResetPasswordPage({ onSignedIn }: Pick<AuthPageProps, 'onSignedIn'>) {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setIsError(false)
    if (!supabase || !isSupabaseConfigured) {
      setIsError(true)
      setMessage('لا يمكن استعادة كلمة المرور قبل إعداد اتصال Supabase.')
      return
    }
    if (password !== confirm) {
      setIsError(true)
      setMessage('كلمتا المرور غير متطابقتين.')
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      if (!data.user || !hasConfirmedEmail(data.user)) {
        setMessage('تم تحديث كلمة المرور. أكّد بريدك الإلكتروني قبل استخدام مساحة العضوية، ثم سجّل الدخول.')
        return
      }
      onSignedIn(data.user)
      setMessage('تم تحديث كلمة المرور. يجري فتح حسابك…')
      window.setTimeout(() => navigate('/pending-review', { replace: true }), 600)
    } catch (error) {
      setIsError(true)
      setMessage(authMessage(error instanceof Error ? error.message : 'password reset error'))
    } finally {
      setBusy(false)
    }
  }

  return <main className="auth-wrap"><div className="auth-card"><div className="auth-intro"><span className="eyebrow">رابط استعادة آمن</span><h1>اختر كلمة مرور جديدة.</h1><p>استخدم كلمة مرور قوية لا تقل عن ٨ أحرف.</p></div><form onSubmit={submit} className="auth-form"><label>كلمة المرور الجديدة<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} dir="ltr"/></label><label>تأكيد كلمة المرور<input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={event => setConfirm(event.target.value)} dir="ltr"/></label><button className="btn btn-primary btn-full" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'تحديث كلمة المرور'} <ArrowLeft size={16}/></button></form>{message && <div className={`inline-message ${isError ? 'live-error' : ''}`} role={isError ? 'alert' : 'status'}>{message}</div>}<p className="auth-switch"><Link to="/login">العودة إلى تسجيل الدخول</Link></p><small className="auth-privacy"><LockKeyhole size={13}/> إذا انتهت صلاحية الرابط، اطلب رسالة استعادة جديدة.</small></div></main>
}
