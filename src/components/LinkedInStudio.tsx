import { useEffect, useState } from 'react'
import { Copy, Download, ExternalLink, ImagePlus, ShieldCheck, Sparkles } from 'lucide-react'
import './LinkedInStudio.css'

type CardFormat = 'square' | 'portrait'
type ContentPreset = 'impact' | 'learning' | 'community'

const presets: Record<ContentPreset, { label: string; headline: string; supporting: string; caption: string }> = {
  impact: {
    label: 'الأثر المهني',
    headline: 'حوّل إنجازك إلى أثر يمكن إثباته',
    supporting: 'وثّق ما أنجزته، واشرح ما تغيّر بسببه، واربطه باحتياج العمل.',
    caption: 'التقدم المهني لا يقوم على ذكر المهارات وحدها؛ بل على توضيح كيف استُخدمت، وما الذي تغيّر بسببها، وما الدليل الذي يدعم ذلك.\n\nأحاول أن أجعل كل تجربة عملية فرصة للتعلّم والتوثيق وإظهار القيمة بوضوح.\n\nما الإنجاز الذي تستطيع شرحه اليوم بالأثر والدليل؟\n\n#التطوير_المهني #الأثر_المهني #مجتمع_السيطرة',
  },
  learning: {
    label: 'التعلّم والتطوير',
    headline: 'التعلّم الحقيقي يظهر في التطبيق',
    supporting: 'المعرفة بداية الطريق؛ والممارسة والتوثيق هما ما يصنعان الفرق.',
    caption: 'كل مهارة جديدة تحتاج إلى تطبيق واضح ومراجعة صادقة.\n\nبدلاً من الاكتفاء بإضافة مهارة إلى الملف المهني، أفضّل أن أحدد أين طبّقتها، وما الذي تعلّمته، وما الدليل الذي يمكن مشاركته دون كشف معلومات سرية.\n\nما المهارة التي تعمل على تحويلها إلى نتيجة عملية؟\n\n#التعلّم_المستمر #المهارات #مجتمع_السيطرة',
  },
  community: {
    label: 'التعريف بالمجتمع',
    headline: 'مساحة مهنية تربط الخبرة بالأثر',
    supporting: 'مجتمع السيطرة المهنية: تعلّم عملي، تواصل مهني، وأدوات تساعد على توضيح القيمة.',
    caption: 'أشارككم تعرّفي على مجتمع السيطرة المهنية؛ مساحة تطوير مهني تربط التعلّم بالتطبيق، وتساعد على توثيق الإنجازات وإبراز القيمة المهنية بصورة واضحة ومسؤولة.\n\nالفكرة التي أؤمن بها: الأداء الوظيفي العالي والجهد الحقيقي، عندما يُعرضان بأدلة واضحة، يصبح من الأسهل على الآخرين فهم القيمة التي تقدمها.\n\nللتعرّف على المجتمع: https://proexcellencenetwork-art.github.io/mojtama-al-saytara/\n\n#مجتمع_السيطرة #التطوير_المهني #السوق_السعودي',
  },
}

function wrapText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string[] {
  const words = value.trim().split(/\s+/u).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines
}

function fitLines(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number): string[] {
  const lines = wrapText(ctx, value, maxWidth)
  if (lines.length <= maxLines) return lines
  const visible = lines.slice(0, maxLines)
  let last = visible[maxLines - 1]
  while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
  visible[maxLines - 1] = `${last.trimEnd()}…`
  return visible
}

async function renderBrandedCard(headline: string, supporting: string, signature: string, format: CardFormat): Promise<string> {
  await document.fonts.ready
  await document.fonts.load('700 58px Tajawal')
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = format === 'portrait' ? 1500 : 1200
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')
  const width = canvas.width
  const height = canvas.height

  const background = ctx.createLinearGradient(0, 0, width, height)
  background.addColorStop(0, '#073e42')
  background.addColorStop(0.55, '#102c31')
  background.addColorStop(1, '#171d22')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.globalAlpha = 0.16
  ctx.strokeStyle = '#7ad5c2'
  ctx.lineWidth = 2
  for (let y = 120; y < height; y += 82) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(280, y - 40, 620, y + 50, width, y - 12)
    ctx.stroke()
  }
  ctx.fillStyle = '#168277'
  ctx.beginPath()
  ctx.arc(1060, 160, 250, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 0.11
  ctx.beginPath()
  ctx.arc(110, height - 90, 230, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.fillStyle = '#c39a56'
  ctx.fillRect(0, 0, width, 13)
  ctx.fillRect(84, 176, 9, height - 340)

  // Reuse the exact official community favicon mark rather than approximating the logo.
  const logo = new Image()
  logo.src = new URL(`${import.meta.env.BASE_URL}favicon.svg`, window.location.origin).toString()
  await new Promise<void>(resolve => {
    logo.onload = () => resolve()
    logo.onerror = () => resolve()
  })
  if (logo.complete && logo.naturalWidth > 0) {
    ctx.drawImage(logo, 1022, 68, 64, 64)
  }

  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillStyle = '#d7b678'
  ctx.font = '700 25px Tajawal, sans-serif'
  ctx.fillText('مجتمع السيطرة المهنية', 990, 96)
  ctx.fillStyle = 'rgba(236, 247, 244, .7)'
  ctx.font = '500 17px Tajawal, sans-serif'
  ctx.fillText('PROFESSIONAL MASTERY COMMUNITY', 990, 126)

  ctx.fillStyle = '#b7e2d8'
  ctx.font = '700 25px Tajawal, sans-serif'
  ctx.fillText('من المهارة إلى الفرصة', 1070, 300)

  const titleFont = format === 'portrait' ? 66 : 60
  ctx.font = `700 ${titleFont}px Tajawal, sans-serif`
  ctx.fillStyle = '#ffffff'
  const titleLines = fitLines(ctx, headline || 'عنوان منشورك المهني', 900, 3)
  const titleLineHeight = titleFont * 1.35
  let titleY = format === 'portrait' ? 500 : 485
  titleLines.forEach(line => {
    ctx.fillText(line, 1070, titleY)
    titleY += titleLineHeight
  })

  ctx.font = '500 34px Tajawal, sans-serif'
  ctx.fillStyle = 'rgba(241, 248, 245, .88)'
  const supportLines = fitLines(ctx, supporting || 'أضف جملة توضح الفكرة أو الدرس الذي تريد مشاركته.', 850, format === 'portrait' ? 4 : 3)
  let supportY = titleY + 46
  supportLines.forEach(line => {
    ctx.fillText(line, 1070, supportY)
    supportY += 53
  })

  const footerY = height - 150
  ctx.fillStyle = 'rgba(233, 244, 240, .12)'
  ctx.fillRect(84, footerY - 48, 1032, 2)
  ctx.fillStyle = '#e4c68b'
  ctx.font = '700 25px Tajawal, sans-serif'
  ctx.fillText(signature.trim() || 'عضو في مجتمع السيطرة المهنية', 1070, footerY + 18)
  ctx.fillStyle = 'rgba(239, 247, 244, .7)'
  ctx.font = '500 19px Tajawal, sans-serif'
  ctx.fillText('الأداء الحقيقي يستحق أن يُرى ويُفهم', 1070, footerY + 58)
  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(239, 247, 244, .58)'
  ctx.font = '500 16px Arial, sans-serif'
  ctx.fillText('proexcellencenetwork-art.github.io/mojtama-al-saytara', 84, height - 52)

  return canvas.toDataURL('image/png')
}

export function LinkedInStudio() {
  const [preset, setPreset] = useState<ContentPreset>('impact')
  const [headline, setHeadline] = useState(presets.impact.headline)
  const [supporting, setSupporting] = useState(presets.impact.supporting)
  const [signature, setSignature] = useState('عضو في مجتمع السيطرة المهنية')
  const [caption, setCaption] = useState(presets.impact.caption)
  const [format, setFormat] = useState<CardFormat>('square')
  const [preview, setPreview] = useState('')
  const [renderError, setRenderError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    setRenderError('')
    void renderBrandedCard(headline, supporting, signature, format)
      .then(url => { if (active) setPreview(url) })
      .catch(() => { if (active) setRenderError('تعذر إنشاء المعاينة في هذا المتصفح. جرّب متصفحاً حديثاً أو أعد تحميل الصفحة.') })
    return () => { active = false }
  }, [headline, supporting, signature, format])

  function choosePreset(next: ContentPreset) {
    setPreset(next)
    setHeadline(presets[next].headline)
    setSupporting(presets[next].supporting)
    setCaption(presets[next].caption)
    setNotice('')
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption.trim())
      setNotice('نُسخ نص المنشور. راجعه قبل نشره على LinkedIn.')
    } catch {
      setNotice('تعذر النسخ التلقائي. حدّد نص المنشور وانسخه يدوياً.')
    }
  }

  async function downloadImage() {
    if (busy) return
    setBusy(true)
    setNotice('')
    try {
      const dataUrl = await renderBrandedCard(headline, supporting, signature, format)
      const anchor = document.createElement('a')
      anchor.href = dataUrl
      anchor.download = `mojtama-linkedin-${format}.png`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setNotice('أُنشئت الصورة وحُفظت بصيغة PNG. أرفقها مع نصك عند النشر.')
    } catch {
      setNotice('تعذر تصدير الصورة. جرّب متصفحاً حديثاً وأعد المحاولة.')
    } finally {
      setBusy(false)
    }
  }

  function openLinkedIn() {
    window.open('https://www.linkedin.com/feed/?shareActive=true', '_blank', 'noopener,noreferrer')
    setNotice('فتحنا LinkedIn في نافذة جديدة. الصق النص وأرفق صورة المجتمع التي نزّلتها.')
  }

  return <section className="linkedin-studio" id="linkedin-studio" aria-labelledby="linkedin-studio-title" dir="rtl">
    <header className="linkedin-studio-heading">
      <div>
        <span className="eyebrow"><Sparkles size={15}/> استوديو الحضور المهني</span>
        <h2 id="linkedin-studio-title">أنشئ منشور LinkedIn بهوية مجتمع السيطرة</h2>
        <p>اكتب فكرتك، جهّز النص، وأنشئ صورة أصلية متناسقة مع هوية المجتمع. كل شيء يُجهّز في متصفحك دون إرسال مسودتك إلى خادم.</p>
      </div>
      <span className="linkedin-studio-mark"><ExternalLink size={21}/></span>
    </header>

    <div className="linkedin-studio-layout">
      <div className="linkedin-studio-editor">
        <div className="linkedin-preset-row" role="group" aria-label="قوالب بداية">
          {(Object.keys(presets) as ContentPreset[]).map(key => <button key={key} type="button" className={preset === key ? 'is-active' : ''} onClick={() => choosePreset(key)}>{presets[key].label}</button>)}
        </div>

        <label className="linkedin-field">عنوان التصميم
          <input value={headline} onChange={event => setHeadline(event.target.value.slice(0, 100))} maxLength={100} placeholder="اكتب الفكرة الرئيسية"/>
        </label>
        <label className="linkedin-field">الجملة التوضيحية
          <textarea value={supporting} onChange={event => setSupporting(event.target.value.slice(0, 220))} maxLength={220} rows={3} placeholder="ما الفكرة أو الدرس الذي تريد مشاركته؟"/>
        </label>
        <label className="linkedin-field">التوقيع الظاهر على الصورة
          <input value={signature} onChange={event => setSignature(event.target.value.slice(0, 80))} maxLength={80} placeholder="اسمك أو صفتك المهنية (اختياري)"/>
        </label>
        <label className="linkedin-field">نص المنشور على LinkedIn
          <textarea className="linkedin-caption-input" value={caption} onChange={event => setCaption(event.target.value.slice(0, 3000))} maxLength={3000} rows={9} placeholder="اكتب تجربتك أو الفكرة التي تريد مشاركتها…"/>
          <small>{caption.length.toLocaleString('ar')} / ٣٠٠٠ حرف · راجع النص وتأكد من صحة كل معلومة قبل النشر.</small>
        </label>
        <div className="linkedin-format-control">
          <span>مقاس الصورة</span>
          <div role="group" aria-label="مقاس التصميم">
            <button type="button" className={format === 'square' ? 'is-active' : ''} onClick={() => setFormat('square')}>مربع 1200×1200</button>
            <button type="button" className={format === 'portrait' ? 'is-active' : ''} onClick={() => setFormat('portrait')}>عمودي 1200×1500</button>
          </div>
        </div>
        <div className="linkedin-studio-actions">
          <button className="btn btn-outline" type="button" onClick={() => void copyCaption()}><Copy size={16}/> نسخ النص</button>
          <button className="btn btn-primary" type="button" onClick={() => void downloadImage()} disabled={busy}><Download size={16}/>{busy ? 'جارٍ تجهيز الصورة…' : 'تنزيل التصميم PNG'}</button>
        </div>
        <button className="linkedin-open-button" type="button" onClick={openLinkedIn}><ExternalLink size={16}/> فتح LinkedIn للنشر</button>
        {notice && <p className="linkedin-tool-notice" role="status">{notice}</p>}
      </div>

      <aside className="linkedin-studio-preview">
        <div className="linkedin-preview-topline"><span><ImagePlus size={15}/> معاينة التصميم</span><span>هوية المجتمع</span></div>
        {preview ? <img className={format === 'portrait' ? 'linkedin-preview-image linkedin-preview-image-portrait' : 'linkedin-preview-image'} src={preview} alt="معاينة بطاقة منشور تحمل هوية مجتمع السيطرة المهنية"/> : <div className="linkedin-preview-loading">جارٍ تجهيز المعاينة…</div>}
        {renderError && <p className="linkedin-tool-error" role="alert">{renderError}</p>}
        <div className="linkedin-preview-caption">
          <strong>قبل النشر</strong>
          <p>تأكد من أن القصة تخصك، وأن أي إنجاز أو رقم أو جهة تذكرها قابل للتحقق ومسموح بمشاركته.</p>
        </div>
      </aside>
    </div>

    <div className="linkedin-studio-guidance">
      <ShieldCheck size={18}/>
      <p><strong>نشر مسؤول:</strong> لا تضع بيانات مرضى أو معلومات عمل سرية، ولا تضف شارة توثيق LinkedIn أو شعاره بطريقة توحي باعتماد رسمي. هذه أداة تصميم مستقلة تساعدك على إعداد المحتوى؛ النشر النهائي يتم من حسابك أنت.</p>
    </div>
  </section>
}
