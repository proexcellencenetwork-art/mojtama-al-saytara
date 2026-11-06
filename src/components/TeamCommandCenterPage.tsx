import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, AlertCircle, ArrowUpLeft, BookOpen, CalendarDays, CheckCircle2,
  ExternalLink, FileText, Heart, Mail, MessageCircle, ShieldCheck, Users,
  Video, Wrench,
} from 'lucide-react'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'
import './TeamCommandCenterPage.css'

const adminRoles: Role[] = ['owner', 'manager', 'moderator']
const teamRoles: Role[] = [...adminRoles, 'coach']

const updates = [
  {
    title: 'تجربة عامة أوضح للزائر',
    detail: 'إعادة بناء الصفحة الرئيسية حول خمس رحلات مهنية، وخطوات بداية مفهومة، وتوضيح صريح لما هو متاح وما لم يُفعّل.',
    status: 'منشور',
  },
  {
    title: 'مساحة عضو أكثر ترابطاً',
    detail: 'شريط تنقل سريع للمجموعات والتواصل والاتصالات والأدوات والرضا، مع محادثات فردية ومؤشرات قراءة.',
    status: 'منشور',
  },
  {
    title: 'إجراءات المجموعات والأدوات',
    detail: 'إجراءات إنشاء المجموعة والانضمام والمغادرة وطلبات المجموعات الخاصة، ودليل أدوات مهنية موحد.',
    status: 'منشور',
  },
  {
    title: 'قياس رضا الأعضاء',
    detail: 'تقييم من 1 إلى 5 واختيار جانب التحسين، مع عرض إداري مجمع لا يكشف أسماء الأعضاء أو تعليقاتهم.',
    status: 'منشور',
  },
  {
    title: 'قائمة الاهتمام المبكر',
    detail: 'صفحة توضح حالة الاستقبال والموافقة المطلوبة، لكن جمع الطلبات ما زال متوقفاً إلى حين اكتمال مراجعة الخصوصية.',
    status: 'موقوف مؤقتاً',
  },
]

export function TeamCommandCenterPage({ role }: { role: Role }) {
  const isAdmin = adminRoles.includes(role)
  const isCoach = role === 'coach'
  const canInvite = teamRoles.includes(role)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteNotice, setInviteNotice] = useState('')
  const [inviteError, setInviteError] = useState('')

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = inviteEmail.trim().toLowerCase()
    if (!email || inviteBusy) return
    if (!supabase) {
      setInviteError('خدمة الدعوات غير متصلة حالياً بقاعدة البيانات.')
      return
    }
    setInviteBusy(true)
    setInviteNotice('')
    setInviteError('')
    const { data, error } = await supabase.functions.invoke('community-invite', { body: { email } })
    setInviteBusy(false)
    if (error || data?.invited !== true) {
      setInviteError('لم تُنشأ الدعوة. تأكد من اعتماد حسابك وتفعيل الدعوات وإعداد البريد، وتحقق من أن العنوان لا يملك حساباً سابقاً.')
      return
    }
    setInviteEmail('')
    setInviteNotice('تم إنشاء دعوة العضوية عبر خدمة الدخول. وصول الرسالة يعتمد على إعدادات البريد؛ وبعد تأكيد البريد يبقى الحساب قيد مراجعة الإدارة.')
  }

  if (!canInvite) {
    return <main className="app-main wrap team-command-page" dir="rtl">
      <section className="team-panel team-denied">
        <ShieldCheck size={28}/>
        <h1>هذه المساحة لفريق المجتمع.</h1>
        <p>تظهر لوحة الفريق للمالك والمدير والمشرف والكوتش المعتمد فقط.</p>
        <Link className="btn btn-outline" to="/feed">العودة إلى مساحة الأعضاء</Link>
      </section>
    </main>
  }

  return <main className="app-main wrap team-command-page" dir="rtl">
    <header className="team-heading">
      <div>
        <span className="eyebrow">التشغيل والمتابعة · مجتمع السيطرة المهنية</span>
        <h1>{isCoach ? 'مساحة الكوتش' : 'مركز الفريق'}</h1>
        <p>{isCoach
          ? 'مساحة عملية لدعوة الأعضاء، وتجهيز الورش، ومتابعة ما تغيّر في المجتمع.'
          : 'صورة تشغيلية واحدة: ما نُشر، ما يجري تجهيزه، وما يحتاج قراراً أو اختباراً قبل الإطلاق.'}</p>
      </div>
      <div className="team-heading-meta">
        <span className="team-role-pill">{role === 'owner' ? 'مالك المنصة' : role === 'manager' ? 'مدير' : role === 'moderator' ? 'مشرف' : 'كوتش'}</span>
        <small>آخر مراجعة موثقة: 6 نوفمبر 2026</small>
      </div>
    </header>

    <section className="team-release-banner">
      <div className="team-release-icon"><CheckCircle2 size={23}/></div>
      <div>
        <span className="team-kicker">آخر إصدار منشور</span>
        <h2>تحديث تجربة المجتمع — 4 نوفمبر 2026</h2>
        <p>دمج التحديث رقم #57، ثم نجح نشر GitHub Pages وفحص CodeQL على الإصدار <code>95ddfc67</code>.</p>
      </div>
      <a href="https://github.com/proexcellencenetwork-art/mojtama-al-saytara/commit/95ddfc6707a9ccf8a101058889143a07e43f1aa3" target="_blank" rel="noreferrer">
        تفاصيل الإصدار <ExternalLink size={14}/>
      </a>
    </section>

    {isAdmin && <section className="team-section">
      <div className="team-section-heading">
        <div><span className="team-kicker">لقطة قاعدة البيانات</span><h2>مؤشرات التشغيل الحالية</h2></div>
        <small>قراءة مباشرة من قاعدة البيانات في 6 نوفمبر 2026؛ ليست أرقاماً تسويقية.</small>
      </div>
      <div className="team-metrics-grid">
        <article className="team-metric"><strong>6</strong><span>ملفات حسابات</span><small>4 معتمدة · 2 قيد المراجعة</small></article>
        <article className="team-metric"><strong>10</strong><span>مقالات منشورة</span><small>في قاعدة محتوى المجتمع</small></article>
        <article className="team-metric"><strong>1</strong><span>مجموعة</span><small>مع عضوية واحدة نشطة</small></article>
        <article className="team-metric"><strong>1</strong><span>ورشة مسجلة</span><small>ولا توجد غرفة بث حي بعد</small></article>
        <article className="team-metric"><strong>96</strong><span>حدثاً تحليلياً</span><small>92 مشاهدة صفحة · 4 مشاهدات ورشة</small></article>
        <article className="team-metric"><strong>2</strong><span>اشتراكان بريديان</span><small>بحالة اشتراك نشطة</small></article>
      </div>
      <p className="team-footnote">أحداث التحليلات لا تمثل كل زوار الموقع: القياس اختياري ويتطلب موافقة، وظهر معرّفا زائر مميزان فقط في السجلات الحالية. لا توجد حالياً طلبات اهتمام مبكر أو تقييمات رضا أو منشورات أو فعاليات عامة أو حجوزات كوتشنج أو تسجيلات بث.</p>
    </section>}

    <section className="team-section">
      <div className="team-section-heading">
        <div><span className="team-kicker">ما الجديد؟</span><h2>التحديثات التي وصلت فعلاً</h2></div>
        <span className="team-status team-status-live">منشور على الموقع</span>
      </div>
      <div className="team-update-list">
        {updates.map((item, index) => <article className="team-update-row" key={item.title}>
          <span className="team-update-number">{String(index + 1).padStart(2, '0')}</span>
          <div><h3>{item.title}</h3><p>{item.detail}</p></div>
          <span className={item.status === 'منشور' ? 'team-status team-status-live' : 'team-status team-status-hold'}>{item.status}</span>
        </article>)}
      </div>
    </section>

    <section className="team-section">
      <div className="team-section-heading">
        <div><span className="team-kicker">خارطة الطريق</span><h2>ما لم يكتمل بعد</h2></div>
        <small>نفرق بين العمل المنشور والعمل الذي ما زال في فرع تجريبي.</small>
      </div>
      <div className="team-work-grid">
        <article className="team-work-card">
          <span className="team-status team-status-hold">قيد الدمج</span>
          <h3>مركز المعرفة والبحث الداخلي</h3>
          <p>طلب الدمج #56 يضيف 10 صفحات موضوعية ومركز بحث عربي على <code>/explore/</code>. اجتاز فحوصه، لكنه ما زال Draft وغير منشور؛ المسار الحي يعيد 404 حالياً.</p>
          <a href="https://github.com/proexcellencenetwork-art/mojtama-al-saytara/pull/56" target="_blank" rel="noreferrer">مراجعة طلب الدمج <ExternalLink size={14}/></a>
        </article>
        <article className="team-work-card">
          <span className="team-status team-status-hold">غير مفعّل</span>
          <h3>بوابة الترحيب والتسجيل الذكي</h3>
          <p>طلب الدمج #55 يتضمن إرشاد الزائر والتسجيل باسم مستخدم وقائمة اهتمام. لا يُفتح التسجيل العام قبل اختبار CAPTCHA وTurnstile وتأكيد البريد ومزود SMTP فعلي.</p>
          <a href="https://github.com/proexcellencenetwork-art/mojtama-al-saytara/pull/55" target="_blank" rel="noreferrer">مراجعة طلب الدمج <ExternalLink size={14}/></a>
        </article>
        <article className="team-work-card">
          <span className="team-status team-status-hold">اختبار مطلوب</span>
          <h3>البث المباشر والتسجيلات</h3>
          <p>وظائف 100ms الخمس نشطة، لكن قاعدة البيانات لا تحتوي غرفاً أو تسجيلات. لم يثبت اختبار مالك وعضو كامل من إنشاء البث إلى تشغيل تسجيل خاص.</p>
          <Link to="/owner/100ms">إعدادات مزود البث <ArrowUpLeft size={14}/></Link>
        </article>
        <article className="team-work-card">
          <span className="team-status team-status-review">مراجعة أمنية</span>
          <h3>الحسابات وحماية التسجيل</h3>
          <p>حماية كلمات المرور المسرّبة في Supabase Auth ما زالت معطلة وفق فحص المستشار. توجد تحذيرات لدوال SECURITY DEFINER وسياسات RLS تحتاج مراجعة فردية؛ لا تعني هذه التحذيرات وحدها وجود اختراق.</p>
          <a href="https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection" target="_blank" rel="noreferrer">مرجع الحماية <ExternalLink size={14}/></a>
        </article>
      </div>
    </section>

    {isAdmin && <section className="team-section team-admin-actions">
      <div className="team-section-heading">
        <div><span className="team-kicker">إجراءات الإدارة</span><h2>روابط تشغيلية مباشرة</h2></div>
      </div>
      <div className="team-link-grid">
        <Link to="/admin"><Users size={18}/> إدارة المجتمع <ArrowUpLeft size={14}/></Link>
        <Link to="/moderation"><ShieldCheck size={18}/> الإشراف والبلاغات <ArrowUpLeft size={14}/></Link>
        <Link to="/content-studio"><FileText size={18}/> استوديو المحتوى <ArrowUpLeft size={14}/></Link>
        {role === 'owner' && <Link to="/owner"><ShieldCheck size={18}/> مركز المالك <ArrowUpLeft size={14}/></Link>}
        {role === 'owner' && <Link to="/owner/analytics"><Activity size={18}/> لوحة التحليلات <ArrowUpLeft size={14}/></Link>}
        {role === 'owner' && <Link to="/owner/100ms"><Video size={18}/> إعداد البث <ArrowUpLeft size={14}/></Link>}
      </div>
    </section>}

    {isCoach && <section className="team-section">
      <div className="team-section-heading">
        <div><span className="team-kicker">مساحة الكوتش</span><h2>ما تستطيع تنفيذه الآن</h2></div>
      </div>
      <div className="team-coach-grid">
        <article className="team-coach-card"><CalendarDays size={21}/><h3>تجهيز ورشة مجدولة</h3><p>يمكن للكوتش المعتمد إنشاء ورشة وتحديد جمهورها وإضافة رابط HTTPS خارجي.</p><Link to="/learning">فتح مركز التعلّم <ArrowUpLeft size={14}/></Link></article>
        <article className="team-coach-card"><MessageCircle size={21}/><h3>التواصل مع الأعضاء</h3><p>استخدم الرسائل الفردية والاتصالات لبناء تواصل مهني يحترم الخصوصية.</p><Link to="/messages">فتح الرسائل <ArrowUpLeft size={14}/></Link></article>
        <article className="team-coach-card"><Users size={21}/><h3>دعوة مهتمين جدد</h3><p>يمكنك إرسال دعوة لعضو جديد. الدعوة لا تمنح صفة كوتش أو أي دور إداري.</p><a href="#team-invite">إرسال دعوة <ArrowUpLeft size={14}/></a></article>
      </div>
      <p className="team-footnote">صلاحية الكوتش لا تشمل بدء بث 100ms أو تغيير إعدادات المالك. تفعيل البث الفعلي يحتاج إعداد المزود واختباراً مستقلاً.</p>
    </section>}

    {canInvite && <section className="team-section team-invite-section" id="team-invite">
      <div className="team-invite-panel">
        <div className="team-invite-copy">
          <span className="team-kicker"><Mail size={14}/> دعوات المجتمع</span>
          <h2>ادعُ شخصاً للانضمام</h2>
          <p>{isCoach
            ? 'أرسل دعوة بريدية إلى عضو أو شخص مهتم بالعمل المهني أو الكوتشنج.'
            : 'أرسل دعوة بريدية إلى عضو جديد. يمكنك مراجعة الحساب واعتماده بعد تأكيد بريده.'}</p>
          <ul>
            <li>الدعوة تنشئ حساباً بدور عضو أساسي فقط.</li>
            <li>تأكيد البريد واعتماد الإدارة يظلان شرطين منفصلين.</li>
            <li>لا يستطيع الكوتش أو المدير ترقية المدعو إلى مدير أو كوتش من رابط الدعوة.</li>
          </ul>
        </div>
        <form className="team-invite-form" onSubmit={sendInvitation}>
          <label htmlFor="team-invite-email">البريد الإلكتروني</label>
          <input id="team-invite-email" type="email" dir="ltr" autoComplete="email" required maxLength={320} value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="name@example.com"/>
          <button className="btn btn-primary" type="submit" disabled={inviteBusy || !inviteEmail.trim() || !supabase}>
            <Mail size={16}/>{inviteBusy ? 'جارٍ إنشاء الدعوة…' : 'إرسال دعوة العضوية'}
          </button>
          {inviteNotice && <p className="team-invite-success" role="status"><CheckCircle2 size={16}/>{inviteNotice}</p>}
          {inviteError && <p className="team-invite-error" role="alert"><AlertCircle size={16}/>{inviteError}</p>}
          {!supabase && <small className="team-footnote">الإرسال غير متاح في وضع العرض التجريبي.</small>}
        </form>
      </div>
    </section>}

    <section className="team-bottom-links">
      <Link to="/career-journey"><BookOpen size={16}/> الرحلة المهنية</Link>
      <Link to="/tools"><Wrench size={16}/> الأدوات</Link>
      <Link to="/feedback"><Heart size={16}/> تقييم التجربة</Link>
      <Link to="/events"><CalendarDays size={16}/> الفعاليات</Link>
    </section>
  </main>
}
