import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, Check, Clipboard, ExternalLink, FileText, Layers3, Plus, RefreshCw, ShieldCheck, Video } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Role } from '../appTypes'
import { supabase } from '../lib/supabase'
import { MarkdownBody } from '../lib/markdown'
import editorialSeed from '../content/editorial-pipeline.json'
import './editorial-studio.css'

type Source = { title: string; organization: string; url: string; date_or_year: string; use: string }
type Seed = {
  id: string; title: string; slug: string; excerpt: string; content_body: string; sources: Source[];
  tiktok_hook: string; tiktok_30s: string; tiktok_60s: string; caption: string; hashtags: string[]; linkedin_post: string;
  x_post: string; x_thread: string[]; video_concept: string; cta: string; last_checked: string;
}
type CmsRow = { id: string; title: string; slug: string; status: 'draft'|'published'|'archived'; published_at: string | null; editorial_assets?: unknown }
type Props = { role: Role }

const seeds = ((editorialSeed as unknown as { articles: Seed[] }).articles ?? [])
const allowedRole = (role: Role) => role === 'owner' || role === 'manager'

function assetsFor(seed: Seed) {
  return {
    version: 1,
    last_checked: seed.last_checked,
    sources: seed.sources,
    tiktok: { hook: seed.tiktok_hook || seed.title, script_30s: seed.tiktok_30s, script_60s: seed.tiktok_60s, caption: seed.caption, hashtags: seed.hashtags },
    linkedin: { post: seed.linkedin_post },
    x: { post: seed.x_post, thread: seed.x_thread },
    short_video_concept: seed.video_concept,
    cta: seed.cta,
  }
}

function socialAssetsForDraft(values: DraftValues, sources: Source[]) {
  return {
    version: 1,
    last_checked: new Date().toISOString().slice(0, 10),
    sources,
    tiktok: { hook: values.hook.trim(), script_30s: values.tiktok30.trim(), script_60s: values.tiktok60.trim(), caption: values.caption.trim(), hashtags: values.hashtags.split(/[\s،,]+/).filter(Boolean) },
    linkedin: { post: values.linkedin.trim() },
    x: { post: values.xPost.trim(), thread: values.thread.split(/\n\s*\n/).map(item => item.trim()).filter(Boolean) },
    short_video_concept: values.videoConcept.trim(),
    cta: values.cta.trim(),
  }
}

async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

function CopyButton({ label, value, onCopied }: { label: string; value: string; onCopied: (label: string, ok: boolean) => void }) {
  return <button type="button" className="btn btn-outline btn-small" onClick={() => void copyText(value).then(ok => onCopied(label, ok))} disabled={!value}><Clipboard size={13}/>{label}</button>
}

function StatusBadge({ status }: { status: CmsRow['status'] }) {
  const text = status === 'published' ? 'منشور' : status === 'draft' ? 'مسودة' : 'مؤرشف'
  return <span className={`studio-status studio-status-${status}`}>{text}</span>
}

function AssetCard({ seed, row, onCopied }: { seed: Seed; row?: CmsRow; onCopied: (label: string, ok: boolean) => void }) {
  const assets = assetsFor(seed)
  return <article className="studio-seed-card"><div className="studio-seed-top"><span className="studio-seed-number">{String(seeds.indexOf(seed) + 1).padStart(2,'0')}</span><div><h3>{seed.title}</h3><span className="studio-slug">/articles/{seed.slug}</span></div>{row ? <StatusBadge status={row.status}/> : <span className="studio-status studio-status-missing">غير مضاف بعد</span>}</div><p className="studio-seed-excerpt">{seed.excerpt}</p><div className="studio-source-strip"><b>المصادر ({seed.sources.length})</b>{seed.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.organization} <ExternalLink size={11}/></a>)}</div><details className="studio-preview"><summary><FileText size={14}/> معاينة المقال والمحتوى الاجتماعي</summary><div className="studio-preview-body"><MarkdownBody source={seed.content_body}/><div className="studio-social-block"><h4><Video size={15}/> TikTok Hook</h4><p>{seed.tiktok_hook}</p><h4><Video size={15}/> TikTok · 30 ثانية</h4><p>{seed.tiktok_30s}</p><h4><Video size={15}/> TikTok · 60 ثانية</h4><p>{seed.tiktok_60s}</p><h4>Caption + Hashtags</h4><p>{seed.caption}</p><p className="studio-hashtags">{seed.hashtags.join(' ')}</p><h4>LinkedIn</h4><p className="studio-social-copy">{seed.linkedin_post}</p><h4>X</h4><p className="studio-social-copy">{seed.x_post}</p>{seed.x_thread.length > 0 && <><h4>Thread</h4><ol>{seed.x_thread.map((post,index) => <li key={index}>{post}</li>)}</ol></>}<h4>Short video concept</h4><p>{seed.video_concept}</p><h4>CTA</h4><p>{seed.cta}</p><div className="studio-copy-actions"><CopyButton label="نسخ Hook" value={assets.tiktok.hook} onCopied={onCopied}/><CopyButton label="نسخ TikTok 30s" value={assets.tiktok.script_30s} onCopied={onCopied}/><CopyButton label="نسخ TikTok 60s" value={assets.tiktok.script_60s} onCopied={onCopied}/><CopyButton label="نسخ LinkedIn" value={assets.linkedin.post} onCopied={onCopied}/><CopyButton label="نسخ X" value={assets.x.post} onCopied={onCopied}/><CopyButton label="نسخ CTA" value={assets.cta} onCopied={onCopied}/>{row?.status === 'published' && <Link className="btn btn-primary btn-small" to={`/articles/${seed.slug}`}>فتح المقال <ArrowLeft size={13}/></Link>}</div></div></div></details></article>
}

type DraftValues = { title:string; slug:string; excerpt:string; body:string; sourcesText:string; hook:string; tiktok30:string; tiktok60:string; caption:string; hashtags:string; linkedin:string; xPost:string; thread:string; videoConcept:string; cta:string; status:'draft'|'published' }
const blankDraft: DraftValues = { title:'', slug:'', excerpt:'', body:'', sourcesText:'', hook:'', tiktok30:'', tiktok60:'', caption:'', hashtags:'', linkedin:'', xPost:'', thread:'', videoConcept:'', cta:'', status:'draft' }

export default function EditorialStudioPage({ role }: Props) {
  const [rows, setRows] = useState<CmsRow[]>([])
  const [loading, setLoading] = useState(Boolean(supabase))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState('')
  const [showRadarForm, setShowRadarForm] = useState(false)
  const [draft, setDraft] = useState<DraftValues>(blankDraft)
  const [draftResult, setDraftResult] = useState('')
  const seedSlugs = useMemo(() => seeds.map(seed => seed.slug), [])

  const loadRows = useCallback(async () => {
    if (!supabase || !allowedRole(role)) return
    const { data, error } = await supabase.from('articles').select('id,title,slug,status,published_at,editorial_assets').or('slug.in.(' + seedSlugs.join(',') + '),slug.eq.saudi-labor-market,slug.eq.saudi-labor-market-radar,slug.like.radar-%').order('created_at',{ ascending:false }).limit(50)
    if (error) setNotice(`تعذر تحميل سجلات CMS: ${error.message}`)
    else setRows((data ?? []) as CmsRow[])
    setLoading(false)
  }, [role, seedSlugs])

  useEffect(() => { void Promise.resolve().then(loadRows) }, [loadRows])

  const onCopied = (label: string, ok: boolean) => setCopied(ok ? `تم نسخ ${label}.` : 'تعذر النسخ تلقائياً؛ حدد النص وانسخه يدوياً.')
  const rowBySlug = useMemo(() => new Map(rows.map(row => [row.slug, row])), [rows])

  async function publishMissingSeeds() {
    if (!supabase || !allowedRole(role)) { setNotice('هذه الصفحة تتطلب مديراً أو مالك منصة معتمداً.'); return }
    setBusy(true); setNotice('')
    let created = 0; let skipped = 0; const failures: string[] = []
    for (const seed of seeds) {
      const existing = rowBySlug.get(seed.slug)
      if (existing) { skipped++; continue }
      const { error } = await supabase.rpc('manage_community_article', {
        p_action:'create', p_article_id:null, p_title:seed.title, p_slug:seed.slug,
        p_excerpt:seed.excerpt, p_body:seed.content_body, p_status:'published', p_editorial_assets:assetsFor(seed),
      })
      if (error) failures.push(`${seed.slug}: ${error.message}`)
      else created++
    }
    setBusy(false)
    const summary = `أُنشئ ونُشر ${created} مقالاً عبر RPC المحكوم. تم تجاوز ${skipped} مقالات موجودة بلا استبدال.`
    setNotice(failures.length ? `${summary} تعذر نشر ${failures.length}: ${failures.join(' · ')}` : summary)
    await loadRows()
  }

  function parseSources(text: string): Source[] {
    return text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
      const [title='',url='',organization='مصدر رسمي/مهني',date_or_year='2026',...useParts] = line.split('|').map(part => part.trim())
      return { title, url, organization, date_or_year, use: useParts.join('|').trim() }
    })
  }

  async function saveRadarDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !allowedRole(role)) { setDraftResult('تعذر الوصول: سجل الدخول كمدير أو مالك منصة معتمد.'); return }
    if (!/^radar-[a-z0-9]+(-[a-z0-9]+)*$/.test(draft.slug)) { setDraftResult('استخدم slug إنجليزياً يبدأ بـ radar- وبأحرف صغيرة وأرقام وشرطات مفردة.'); return }
    const sources = parseSources(draft.sourcesText)
    if (!sources.length || sources.some(source => { try { return new URL(source.url).protocol !== 'https:' } catch { return true } })) { setDraftResult('أضف مصدراً واحداً على الأقل، برابط HTTPS صحيح، بصيغة: العنوان | الرابط | الجهة | التاريخ | وجه الاستشهاد.'); return }
    const missing = ['title','excerpt','body','hook','tiktok30','tiktok60','caption','hashtags','linkedin','xPost','videoConcept','cta'].filter(key => !draft[key as keyof DraftValues].toString().trim())
    if (missing.length) { setDraftResult('أكمل المقال ومشتقاته الأساسية (Hook وTikTok 30/60 وCaption وHashtags وLinkedIn وX والفيديو وCTA).'); return }
    setBusy(true); setDraftResult('')
    const { error } = await supabase.rpc('manage_community_article', {
      p_action:'create', p_article_id:null, p_title:draft.title.trim(), p_slug:draft.slug.trim(),
      p_excerpt:draft.excerpt.trim(), p_body:draft.body.trim(), p_status:draft.status,
      p_editorial_assets:socialAssetsForDraft(draft,sources),
    })
    setBusy(false)
    if (error) setDraftResult(`لم يُحفظ التحديث: ${error.message}`)
    else {
      setDraftResult(draft.status === 'published' ? 'نُشر التحديث عبر CMS، وستظهره صفحة الرادار بعد تحديث القراءة.' : 'حُفظ التحديث كمسودة؛ لن يظهر للعموم قبل النشر.')
      setDraft(blankDraft)
      await loadRows()
    }
  }

  if (!allowedRole(role)) return <main className="app-main wrap"><section className="studio-denied"><ShieldCheck size={25}/><h1>استوديو المحتوى</h1><p>هذه المساحة لأدوار مالك المنصة أو المدير فقط. لن نعرض حزمة المحتوى أو نسمح باستدعاء CMS لهذا الدور.</p><Link className="btn btn-outline" to="/feed">العودة إلى المجتمع <ArrowLeft size={14}/></Link></section></main>
  if (!supabase) return <main className="app-main wrap"><section className="studio-denied"><h1>استوديو المحتوى</h1><p>قاعدة المحتوى غير مهيأة في هذا الإصدار؛ لا تُحفظ أي مقالات تجريبية.</p></section></main>

  return <main className="app-main wrap editorial-studio"><header className="studio-hero"><div><span className="eyebrow"><Layers3 size={15}/> Content System · صلاحية تحرير محدودة</span><h1>استوديو المحتوى</h1><p>المقالات والمصادر ومشتقات TikTok وLinkedIn وX وShort Video محفوظة في مكتبة الموقع. النشر يمر عبر جلسة المالك/المدير ودالة CMS محكومة؛ لا يوجد نشر تلقائي إلى شبكات التواصل.</p></div><button className="btn btn-outline btn-small" type="button" onClick={() => void loadRows()} disabled={loading || busy}><RefreshCw size={14}/>تحديث CMS</button></header>
    <div className="studio-security"><ShieldCheck size={17}/><span>الصلاحية: {role === 'owner' ? 'مالك المنصة' : 'مدير'} · المقالات العامة تُقرأ عبر RLS المنشور فقط. لا توجد مفاتيح خاصة أو تجاوز لسياسات قاعدة البيانات في المتصفح.</span></div>
    {notice && <div className="studio-notice" role="status">{notice}</div>}{copied && <div className="studio-copy-status" role="status">{copied}</div>}
    <section className="studio-batch"><div><span className="eyebrow">الدفعة الأولى · 10 مقالات</span><h2>من البحث إلى المقال وملف القنوات</h2><p>يضيف الإجراء المقالات غير الموجودة فقط، ويترك أي مقال سابق كما هو. كل سجل يشمل body بصيغة Markdown، المصادر، ونسخاً اجتماعية جاهزة.</p><div className="studio-batch-stats"><span>{seeds.length} موضوعاً موثقاً</span><span>{seeds.reduce((count,seed) => count + seed.sources.length,0)} إحالة مصدر</span><span>SEO + canonical + OG + Schema</span></div></div><button className="btn btn-primary" type="button" onClick={() => void publishMissingSeeds()} disabled={busy || loading}>{busy ? 'جارٍ النشر...' : 'نشر المقالات غير الموجودة'} <ArrowLeft size={15}/></button></section>
    <section className="studio-seed-list"><div className="studio-section-heading"><div><span className="eyebrow">المكتبة التحريرية</span><h2>المقالات العشرة</h2></div><small>{loading ? 'جارٍ فحص CMS…' : `${rows.length} سجلاً مرتبطاً`}</small></div>{seeds.map(seed => <AssetCard key={seed.id} seed={seed} row={rowBySlug.get(seed.slug)} onCopied={onCopied}/>)}</section>
    <section className="studio-updates"><div className="studio-section-heading"><div><span className="eyebrow">تحديث قابل للتكرار</span><h2>Saudi Labor Market Radar</h2><p>أضف تحليلاً جديداً مع المصدر المختار ومشتقات القنوات في سجل واحد. المسودات لا تظهر في الرادار العام.</p></div><button className="btn btn-outline btn-small" type="button" onClick={() => setShowRadarForm(value => !value)}><Plus size={14}/>{showRadarForm ? 'إغلاق النموذج' : 'إنشاء تحديث'}</button></div>{rows.filter(row => row.slug.startsWith('radar-') || row.slug === 'saudi-labor-market' || row.slug === 'saudi-labor-market-radar').length ? <div className="studio-radar-records">{rows.filter(row => row.slug.startsWith('radar-') || row.slug === 'saudi-labor-market' || row.slug === 'saudi-labor-market-radar').map(row => <article key={row.id}><div><StatusBadge status={row.status}/><span className="studio-slug">{row.slug}</span></div><b>{row.title}</b><small>{row.published_at ? new Date(row.published_at).toLocaleDateString('ar-SA-u-ca-gregory') : 'لم يُنشر بعد'}</small>{row.status === 'published' && <Link to={`/articles/${row.slug}`}>عرض المقال <ArrowLeft size={12}/></Link>}</article>)}</div> : <div className="studio-empty">لا توجد تحديثات رادار محفوظة بعد. أنشئ أول تحديث مع مصادره ومشتقاته الاجتماعية.</div>}
      {showRadarForm && <form className="studio-radar-form" onSubmit={saveRadarDraft}><div className="studio-form-heading"><b>تحليل سوق جديد</b><span>يُدرج عند النشر تلقائياً في صفحة الرادار، ويُنشئ URL SEO خاصاً به.</span></div><div className="studio-form-grid"><label>عنوان التحليل<input required maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft,title:event.target.value })}/></label><label>Slug<input required pattern="radar-[a-z0-9]+(-[a-z0-9]+)*" placeholder="radar-20261004-ai-skills" value={draft.slug} onChange={event => setDraft({ ...draft,slug:event.target.value })}/></label><label className="studio-form-wide">Meta description / المقتطف<input required maxLength={500} value={draft.excerpt} onChange={event => setDraft({ ...draft,excerpt:event.target.value })}/></label><label className="studio-form-wide">المقال Markdown مع حدود الاستنتاج والمصادر<textarea required rows={9} value={draft.body} onChange={event => setDraft({ ...draft,body:event.target.value })} placeholder={'## ما الذي تغيّر؟\n\nاكتب الأدلة وحدودها.\n\n### المصادر\n- [اسم المصدر](https://example.gov.sa) — التاريخ والوجه.'}/></label><label className="studio-form-wide">مصادر التحقق — سطر لكل مصدر: العنوان | رابط HTTPS | الجهة | التاريخ | الاستخدام<textarea required rows={4} value={draft.sourcesText} onChange={event => setDraft({ ...draft,sourcesText:event.target.value })}/></label><label>Hook<input required value={draft.hook} onChange={event => setDraft({ ...draft,hook:event.target.value })}/></label><label>Hashtags<input required value={draft.hashtags} onChange={event => setDraft({ ...draft,hashtags:event.target.value })}/></label><label>TikTok 30s<textarea required rows={3} value={draft.tiktok30} onChange={event => setDraft({ ...draft,tiktok30:event.target.value })}/></label><label>TikTok 60s<textarea required rows={4} value={draft.tiktok60} onChange={event => setDraft({ ...draft,tiktok60:event.target.value })}/></label><label>Caption<textarea required rows={3} value={draft.caption} onChange={event => setDraft({ ...draft,caption:event.target.value })}/></label><label>LinkedIn Post<textarea required rows={5} value={draft.linkedin} onChange={event => setDraft({ ...draft,linkedin:event.target.value })}/></label><label>X Post<textarea required rows={3} value={draft.xPost} onChange={event => setDraft({ ...draft,xPost:event.target.value })}/></label><label>Thread (منشور منفصل بسطر فارغ)<textarea rows={5} value={draft.thread} onChange={event => setDraft({ ...draft,thread:event.target.value })}/></label><label>Short video concept<textarea required rows={3} value={draft.videoConcept} onChange={event => setDraft({ ...draft,videoConcept:event.target.value })}/></label><label>CTA للموقع<textarea required rows={2} value={draft.cta} onChange={event => setDraft({ ...draft,cta:event.target.value })}/></label><label>حالة المحتوى<select value={draft.status} onChange={event => setDraft({ ...draft,status:event.target.value as 'draft'|'published' })}><option value="draft">مسودة خاصة</option><option value="published">منشور للعامة</option></select></label></div><div className="studio-form-actions"><button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'جارٍ الحفظ...' : draft.status === 'draft' ? 'حفظ كمسودة' : 'نشر التحديث'} <Check size={14}/></button><button className="btn btn-quiet" type="button" onClick={() => { setDraft(blankDraft); setDraftResult('') }}>مسح النموذج</button></div>{draftResult && <p className="studio-form-status" role="status">{draftResult}</p>}</form>}
    </section><p className="studio-footnote">الـLearning Center والورشة ذاتية التعلم موجودان في الموقع. لم يُربط مزود بث أو تسجيل خارجي؛ لا يعرض الاستوديو موعداً أو بثاً حياً غير مهيأ.</p>
  </main>
}
