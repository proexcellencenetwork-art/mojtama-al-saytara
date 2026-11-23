import { useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Search, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import editorialPipeline from '../content/editorial-pipeline.json'
import communityLinks from '../content/community-links.json'
import './PublicExplorePage.css'

type Item = { title: string; summary: string; href: string; category: string; kind: string; search: string }
const topics: Item[] = [
  {title:'الحوكمة والامتثال المهني',summary:'السياسات والضوابط وإدارة المخاطر والخصوصية وتوثيق القرارات.',href:'/professional-governance-compliance',category:'الحوكمة والامتثال',kind:'دليل',search:'حوكمة امتثال مخاطر سياسات ضوابط خصوصية'},
  {title:'جودة الرعاية وسلامة المرضى',summary:'مؤشرات الجودة والتحسين المستمر وتحليل الأسباب وثقافة السلامة.',href:'/healthcare-quality-patient-safety',category:'الصحة والعلوم',kind:'دليل',search:'جودة رعاية صحية سلامة مرضى مؤشرات تحسين'},
  {title:'تحليلات البيانات الصحية',summary:'SQL وPython والإحصاء وجودة البيانات ولوحات المؤشرات والخصوصية.',href:'/health-data-analytics',category:'الصحة والعلوم',kind:'دليل',search:'بيانات صحية تحليل sql python إحصاء Power BI'},
  {title:'المعلوماتية الحيوية والجينوم',summary:'تحليل التسلسل والبيانات الجينومية وسير العمل البحثي.',href:'/bioinformatics-genomics',category:'الصحة والعلوم',kind:'دليل',search:'جينوم جينوميات معلوماتية حيوية bioinformatics genomics'},
  {title:'البحث السريري والأدلة',summary:'تصميم الدراسات وأخلاقيات البحث وGCP وتحليل النتائج.',href:'/clinical-research-evidence',category:'البحث والأدلة',kind:'دليل',search:'بحث سريري تجارب سريرية GCP أخلاقيات أدلة'},
  {title:'الأجهزة الطبية والابتكار',summary:'من الحاجة والتصميم إلى إدارة المخاطر والتحقق والمتطلبات التنظيمية.',href:'/medical-device-innovation',category:'الابتكار والبحث',kind:'دليل',search:'أجهزة طبية ابتكار اختراع تصميم مخاطر SFDA'},
  {title:'الصحة الرقمية والذكاء الاصطناعي',summary:'التكامل والأتمتة والتحقق من النماذج والحوكمة والإشراف البشري.',href:'/ai-healthcare-digital',category:'الذكاء الاصطناعي والتقنية',kind:'دليل',search:'ذكاء اصطناعي صحة رقمية أتمتة تكامل AI'},
  {title:'القيادة وإدارة المشاريع',summary:'تحديد النتائج وتوزيع المسؤوليات وإدارة أصحاب المصلحة والتغيير.',href:'/leadership-project-management',category:'التطور المهني',kind:'دليل',search:'قيادة إدارة مشاريع فرق تغيير أصحاب مصلحة'},
  {title:'أخلاقيات العمل والتواصل',summary:'السرية والتواصل والتغذية الراجعة وحل الخلافات.',href:'/professional-ethics-communication',category:'التطور المهني',kind:'دليل',search:'أخلاقيات عمل تواصل مهني سرية تغذية راجعة'},
  {title:'تغيير المسار وبناء المهارات',summary:'المهارات القابلة للنقل وتجربة الانتقال وخطة إعادة التأهيل.',href:'/career-transition-skills',category:'التطور المهني',kind:'دليل',search:'تغيير مسار مهني إعادة تأهيل مهارات وظائف انتقال'},
]
const tools: Item[] = [
  {title:'البوصلة المهنية',summary:'قيّم مرحلتك وحدد الخطوة المهنية التالية.',href:'/career-compass',category:'التطور المهني',kind:'أداة',search:'بوصلة مهنية هدف مهارات مسار قرار'},
  {title:'تدقيق ملف LinkedIn',summary:'راجع العنوان والملخص والخبرة والأدلة المهنية.',href:'/linkedin-audit',category:'التطور المهني',kind:'أداة',search:'لينكدان LinkedIn ملف شخصي عنوان ملخص'},
  {title:'جاهزية حديث التخرج',summary:'من بناء السيرة إلى المقابلة وأول إنجاز مهني.',href:'/fresh-graduate',category:'التطور المهني',kind:'دليل',search:'خريج حديث تخرج وظيفة سيرة مقابلة'},
  {title:'اقتصاد القيمة المهنية',summary:'اربط المهارة بالقدرة والأثر والدليل.',href:'/value-economy',category:'التطور المهني',kind:'دليل',search:'قيمة مهنية مهارات أثر تفاوض'},
  {title:'ملف الإنجازات',summary:'حوّل العمل إلى أدلة قابلة للعرض والمراجعة.',href:'/achievement-portfolio',category:'التطور المهني',kind:'أداة',search:'ملف إنجازات portfolio STAR أدلة'},
  {title:'الاستعداد للترقية',summary:'جهّز أدلة الإنجاز ومحادثة التطور وخطة المتابعة.',href:'/promotion-intelligence',category:'التطور المهني',kind:'دليل',search:'ترقية تقييم أداء إنجازات'},
  {title:'الابتكار والبحث والتطوير',summary:'اختبر الفكرة واربطها بمشكلة وأثر ودليل.',href:'/innovation-rd',category:'الابتكار والبحث',kind:'دليل',search:'ابتكار اختراع بحث تطوير R&D'},
  {title:'الذكاء الاصطناعي في العمل',summary:'استخدم AI ضمن سير عمل قابل للتحقق والحوكمة.',href:'/ai-career-leverage',category:'الذكاء الاصطناعي والتقنية',kind:'دليل',search:'ذكاء اصطناعي AI أتمتة عمل إنتاجية'},
  {title:'رادار سوق العمل السعودي',summary:'اقرأ إشارات السوق والمهارات والمتطلبات بمصادرها.',href:'/saudi-labor-market-radar',category:'التطور المهني',kind:'دليل',search:'سوق العمل السعودي وظائف مهارات مهن'},
  {title:'التموضع المهني',summary:'اكتب تعريفاً مهنياً واضحاً ومدعوماً بالأدلة.',href:'/professional-positioning',category:'التطور المهني',kind:'أداة',search:'تموضع مهني هوية شخصية قيمة'},
  {title:'ورشة LinkedIn',summary:'تدريب ذاتي على تحسين الملف وخطة 30 يوماً.',href:'/linkedin-workshop',category:'التطور المهني',kind:'ورشة',search:'ورشة لينكدان LinkedIn'},
]
const articles: Item[] = editorialPipeline.articles.map(a => ({title:a.title,summary:a.excerpt,href:'/articles/'+a.slug,category:/health|clinical|genomics|saudi-healthcare/i.test(a.slug)?'الصحة والعلوم':/innovation|ai-/i.test(a.slug)?'الابتكار والبحث':'التطور المهني',kind:'مقال',search:[a.title,a.excerpt,a.content_body].join(' ')}))
const items=[...topics,...tools,...articles]
const categories=['all','التطور المهني','الصحة والعلوم','الذكاء الاصطناعي والتقنية','الابتكار والبحث','البحث والأدلة','الحوكمة والامتثال']
const normalize=(v:string)=>v.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLocaleLowerCase('ar').trim()
const channelUrl=/^https:\/\/(?:www\.)?whatsapp\.com\/channel\/[A-Za-z0-9]+\/?$/i.test(communityLinks.whatsappChannelUrl)?communityLinks.whatsappChannelUrl:''
export default function PublicExplorePage(){
 const [query,setQuery]=useState('')
 const [category,setCategory]=useState('all')
 const results=useMemo(()=>{const tokens=normalize(query).split(/\s+/).filter(Boolean);return items.filter(item=>(category==='all'||item.category===category)&&tokens.every(token=>normalize([item.title,item.summary,item.search,item.category].join(' ')).includes(token)))},[query,category])
 return <main className="public-page wrap knowledge-hub">
  <header className="knowledge-hero"><span className="eyebrow"><Sparkles size={15}/> مكتبة مجتمع السيطرة المهنية</span><h1>ابحث عن إجابتك المهنية، وابدأ بخطوة عملية.</h1><p className="hero-lead">مكتبة تجمع الأدلة والمقالات والأدوات حول التطور المهني والقطاع الصحي والبيانات والابتكار والبحث والحوكمة. ابحث بسؤال أو كلمة، ثم انتقل إلى الدليل المناسب.</p>
   <div className="knowledge-search-panel"><label htmlFor="knowledge-query">وش الموضوع اللي تبحث عنه؟</label><div className="knowledge-search-row"><div className="knowledge-search-input"><Search size={19}/><input id="knowledge-query" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="مثلاً: كيف أستعد للترقية؟ أو تحليل البيانات الصحية" autoComplete="off"/></div><select aria-label="تصفية حسب المجال" value={category} onChange={event=>setCategory(event.target.value)}>{categories.map(item=><option key={item} value={item}>{item==='all'?'كل المجالات':item}</option>)}</select></div><p className="knowledge-count" aria-live="polite">يعرض {results.length} من {items.length} نتيجة</p></div>
  </header>
  <section className="knowledge-results" aria-label="نتائج مكتبة المعرفة">{results.length?results.map(item=><article className="knowledge-result" key={item.href}><span className="knowledge-result-meta">{item.kind} · {item.category}</span><h2><Link to={item.href}>{item.title}</Link></h2><p>{item.summary}</p><Link className="knowledge-result-link" to={item.href}>افتح الدليل <ArrowLeft size={14}/></Link></article>):<div className="knowledge-empty"><BookOpen size={28}/><h2>ما لقينا نتيجة مطابقة</h2><p>جرّب كلمة أقصر أو غيّر المجال إلى «كل المجالات».</p><button className="btn btn-outline" type="button" onClick={()=>{setQuery('');setCategory('all')}}>مسح البحث</button></div>}</section>
  <section className="knowledge-whatsapp"><div><span className="eyebrow">ابقَ على اتصال</span><h2>تابع محتوى مجتمع السيطرة على واتساب</h2><p>{channelUrl?'مقالات وأدلة وورش وتحديثات مهنية في القناة الرسمية.':'رابط القناة الرسمية غير مضاف في إعدادات الموقع بعد؛ سنفعّل الانتقال المباشر بمجرد ربط الرابط الصحيح.'}</p></div>{channelUrl?<a className="btn btn-primary" href={channelUrl} target="_blank" rel="noopener noreferrer">تابع قناة واتساب</a>:<Link className="btn btn-outline" to="/career-journey">استكشف رحلتك المهنية</Link>}</section>
 </main>
}
