import { useState } from 'react'
import { Mail, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './NewsletterSignup.css'

export function NewsletterSignup() {
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setError(true)
      setMessage('الاشتراك غير متاح حاليًا لأن خدمة المجتمع غير متصلة.')
      return
    }
    if (!consent) {
      setError(true)
      setMessage('يرجى الموافقة على تلقي تحديثات المجتمع أولًا.')
      return
    }
    setBusy(true)
    setError(false)
    setMessage('')
    const { data, error: rpcError } = await supabase.rpc('request_newsletter_subscription', {
      p_email: email.trim().toLowerCase(),
      p_source_path: location.pathname || '/',
    })
    setBusy(false)
    if (rpcError || data !== 'subscribed') {
      setError(true)
      setMessage(rpcError?.message?.includes('أدخل بريدًا') ? 'تحقق من صحة البريد الإلكتروني.' : 'تعذر حفظ الاشتراك الآن. حاول مرة أخرى لاحقًا.')
      return
    }
    setMessage('تم تسجيل بريدك في قائمة تحديثات مجتمع السيطرة المهنية. يمكنك طلب إزالة بريدك من القائمة عبر التواصل مع إدارة المجتمع.')
    setEmail('')
    setConsent(false)
  }

  return <section className="newsletter-signup" aria-labelledby="newsletter-heading" dir="rtl">
    <div className="newsletter-copy"><span className="newsletter-icon"><Mail size={18}/></span><div><h3 id="newsletter-heading">تحديثات مهنية تستحق وقتك</h3><p>مقالات وورش وأدوات عملية من مجتمع السيطرة المهنية، دون وعود تسويقية مبالغ فيها.</p></div></div>
    <form className="newsletter-form" onSubmit={submit}>
      <label className="newsletter-email-label" htmlFor="newsletter-email">البريد الإلكتروني</label>
      <div className="newsletter-input-row"><input id="newsletter-email" type="email" required maxLength={320} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" dir="ltr"/><button className="btn btn-primary" type="submit" disabled={busy || !email.trim()}>{busy ? 'جارٍ الحفظ…' : 'اشترك'}</button></div>
      <label className="newsletter-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required/><span>أوافق على حفظ بريدي واستخدامه لإرسال تحديثات المجتمع، وأفهم أن بيانات الاشتراك يطّلع عليها المالك فقط.</span></label>
      {message && <p className={error ? 'newsletter-message is-error' : 'newsletter-message'} role={error ? 'alert' : 'status'}>{!error && <CheckCircle2 size={15}/>} {message}</p>}
      <small className="newsletter-privacy"><ShieldCheck size={13}/> لا نبيع بيانات المشتركين. لا تُرسل أي رسالة تلقائيًا حتى يتم ربط خدمة إرسال بريد معتمدة.</small>
    </form>
  </section>
}
