import { ArrowLeft, Award, BookOpen, BriefcaseBusiness, Compass, FileSearch, GraduationCap, Lightbulb, LineChart, Target, Wrench } from 'lucide-react'
import { Link } from 'react-router-dom'
const tools = [
 {to:'/career-compass',title:'البوصلة المهنية',description:'حدد موقعك الحالي، أولوياتك، والاتجاه الذي تريد اختباره.',icon:Compass,tag:'تقييم ذاتي'},
 {to:'/linkedin-audit',title:'تدقيق ملف LinkedIn',description:'راجع عناصر ملفك وحدد التحسينات الأكثر أهمية.',icon:FileSearch,tag:'حضور مهني'},
 {to:'/fresh-graduate',title:'جاهزية حديث التخرج',description:'حوّل الانتقال من الدراسة إلى العمل إلى خطة واضحة.',icon:GraduationCap,tag:'بداية المسار'},
 {to:'/achievement-portfolio',title:'ملف الإنجازات',description:'وثّق مساهماتك ونتائجك وحدود ما تستطيع إثباته.',icon:Award,tag:'إثبات القيمة'},
 {to:'/promotion-intelligence',title:'الاستعداد للترقية',description:'راجع متطلبات الدور التالي والأدلة التي تدعم جاهزيتك.',icon:Target,tag:'تقدم مهني'},
 {to:'/value-economy',title:'القيمة المهنية والتفاوض',description:'اربط الأثر الذي تقدمه بحوار مهني واضح ومسؤول.',icon:LineChart,tag:'قيمة وأثر'},
 {to:'/innovation-rd',title:'الابتكار والبحث والتطوير',description:'انقل الفكرة من الفرضية إلى تجربة ودليل وملكية واضحة.',icon:Lightbulb,tag:'ابتكار وبحث'},
 {to:'/ai-career-leverage',title:'العمل مع الذكاء الاصطناعي',description:'ابنِ سير عمل قابل للتحقق مع مراجعة بشرية وحوكمة.',icon:Wrench,tag:'ذكاء اصطناعي'},
 {to:'/saudi-labor-market-radar',title:'رادار سوق العمل السعودي',description:'حلل متطلبات الأدوار والمؤشرات من مصادر موثوقة.',icon:BriefcaseBusiness,tag:'سوق العمل'},
 {to:'/linkedin-workshop',title:'ورشة LinkedIn التطبيقية',description:'طبّق خطوات عملية لتحويل ملفك إلى أصل مهني واضح.',icon:BookOpen,tag:'ورشة'},
]
export function MemberToolsPage() {
 return <main className="app-main wrap member-workspace-page">
  <header className="member-page-heading"><div><span className="eyebrow">أدوات متاحة داخل المجتمع</span><h1>أدواتك المهنية</h1><p>ابدأ بالأداة الأقرب إلى هدفك. تعمل الأدوات مباشرة في المتصفح؛ راجع تنبيه كل أداة لمعرفة ما إذا كانت تحفظ نتيجتها محلياً.</p></div></header>
  <section className="member-tools-grid">{tools.map(tool=>{const Icon=tool.icon;return <article className="member-tool-card" key={tool.to}><span className="member-tool-icon"><Icon size={19}/></span><span className="member-tool-tag">{tool.tag}</span><h2>{tool.title}</h2><p>{tool.description}</p><Link to={tool.to}>افتح الأداة <ArrowLeft size={15}/></Link></article>})}</section>
 </main>
}
