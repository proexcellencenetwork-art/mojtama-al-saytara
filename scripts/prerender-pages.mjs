import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderMarkdownToHtml } from './lib/markdown.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const distDir = resolve(projectRoot, 'dist')
const defaultSiteUrl = 'https://proexcellencenetwork-art.github.io/mojtama-al-saytara/'
const configuredSiteUrl = process.env.VITE_SITE_URL?.trim() || defaultSiteUrl
const site = new URL(configuredSiteUrl)
if (!['http:', 'https:'].includes(site.protocol)) throw new Error('VITE_SITE_URL must use http or https.')
const siteRoot = new URL(site.pathname.endsWith('/') ? site.pathname : `${site.pathname}/`, site.origin)
const basePath = siteRoot.pathname
const appName = 'مجتمع السيطرة'
const ogImage = new URL(`${basePath.replace(/\/$/, '')}/og-social.png`, site.origin).toString()
const builtIndex = await readFile(resolve(distDir, 'index.html'), 'utf8')
const criticalCss = await readFile(resolve(projectRoot, 'scripts/public-critical.css'), 'utf8')

const pages = {
  '/': { title: 'مجتمع السيطرة | مجتمع مهني ورحلة مهنية', description: 'مجتمع مهني للقطاع الصحي يجمع التواصل والكوتشنج ومركز التعلم، مع بوصلة وأدوات وورش ومحتوى لمسارك المهني.', heading: 'مسارك المهني، بإيقاعك أنت.', intro: 'مجتمع السيطرة مساحة مهنية آمنة للعاملين في القطاع الصحي، تجمع التواصل والكوتشنج والورش ومركز التعلم وأدوات رحلة مهنية عملية.', type: 'home' },
  '/about': { title: 'عن مجتمع السيطرة | مساحة مهنية آمنة', description: 'تعرّف على مجتمع مهني للمهنيين الصحيين يجمع التواصل الهادف والكوتشنج والخصوصية.', heading: 'نؤمن أن النمو المهني يبدأ بمساحة آمنة.', intro: 'مجتمع السيطرة مساحة مهنية آمنة للمهنيين الصحيين والخريجين والباحثين في السعودية. ومعنى السيطرة هنا امتلاك قرارك المهني ووقتك وحدودك، لا التحكم بالآخرين؛ نكمّل المصادر الرسمية ولا نستبدلها، ونحوّل التفكير إلى خطوات قابلة للاختبار.', points: [['الأمان قبل الظهور', 'احترام وسرية وميثاق واضح، مع منع مشاركة معلومات المرضى.'], ['الدليل قبل الوعد', 'أدوات وقوالب ومحتوى يوضح مصادره وحدوده؛ لا نضمن وظيفة أو ترقية.'], ['الإنسان خلف الدور', 'مساحة للتفكير في المسار والمناوبات والحدود المهنية دون أحكام.'], ['تكامل لا منافسة', 'أحِل إلى متطلبات الجهات الرسمية، وتحقق من الشروط الحالية قبل اتخاذ القرار.']] },
  '/coaching': { title: 'كوتشنج مهني للقطاع الصحي | مجتمع السيطرة', description: 'مساحة حوار مهني تساعد العاملين في الرعاية الصحية على توضيح أهدافهم وخياراتهم.', heading: 'مساحة للتفكير. وخطوة تنبع منك.', intro: 'الكوتشنج حوار مهني يساعدك على توضيح أهدافك وخياراتك، واستكشاف الخطوات التي تناسبك في مسيرتك.', points: [['تطوير المسار', 'رؤية أوضح لأهدافك وخياراتك المهنية.'], ['إدارة الضغط', 'مساحة للتأمل في التحديات وحدودك.'], ['اتخاذ القرار', 'تحويل الأفكار إلى خطوات قابلة للتجربة.']], type: 'service' },
  '/coaches': { title: 'دليل الكوتشات | مجتمع السيطرة', description: 'تعرّف على الكوتشات والملفات المهنية العامة المنشورة في مجتمع السيطرة.', heading: 'تعرّف على من يصغي إلى رحلتك.', intro: 'كوتشات بخبرات متنوعة ومساحات حوار مهنية، مع ملفات عامة عند توفرها في المجتمع.', type: 'coaches' },
  '/articles': { title: 'مقالات التطور المهني الصحي | مجتمع السيطرة', description: 'اقرأ المحتوى المنشور عن النمو المهني والتوازن والعمل في القطاع الصحي.', heading: 'معرفة تساعدك على التقدّم.', intro: 'مقالات مجتمع السيطرة المنشورة حول التطور المهني والتوازن والعمل في بيئة الرعاية الصحية.', type: 'articles' },
  '/events': { title: 'الفعاليات المهنية الصحية | مجتمع السيطرة', description: 'تابع الفعاليات العامة القادمة للمهنيين الصحيين في مجتمع السيطرة.', heading: 'نتعلّم معاً، ونصنع مساحة للحوار.', intro: 'لقاءات ومجالس مهنية عامة قادمة، تظهر هنا بعد نشرها واجتياز مراجعة المحتوى.', type: 'events' },
  '/faq': { title: 'الأسئلة الشائعة | مجتمع السيطرة', description: 'إجابات عن العضوية والتوثيق والكوتشنج والخصوصية في مجتمع السيطرة.', heading: 'إجابات واضحة، قبل أن تبدأ.', intro: 'إجابات عملية عن هدف المجتمع والأمان والتوثيق والأدوات والعضوية.', type: 'faq', points: [
    ['لماذا اسم «مجتمع السيطرة»؟', 'السيطرة تعني امتلاك قرارك المهني ووقتك وحدودك، لا التحكم بالآخرين.'],
    ['لمن صُمم المجتمع؟', 'للمهنيين الصحيين وطلاب الامتياز والخريجين والباحثين في السعودية ممن يريدون بناء مسار مهني بأدلة وخطوات قابلة للاختبار.'],
    ['هل التسجيل العام مفتوح الآن؟', 'التسجيل العام متوقف مؤقتاً حتى اكتمال اختبارات القبول والأمان. إذا وصلتك دعوة رسمية، اتبع تعليماتها ولا تشارك رابطها مع غيرك.'],
    ['هل التوثيق إلزامي للعضوية؟', 'التوثيق المهني منفصل عن الانضمام؛ قد تتطلب بعض الميزات، مثل النشر المهني، مراجعة وتوثيقاً إضافياً.'],
    ['هل توثيق مجتمع السيطرة هو اعتماد من الهيئة السعودية للتخصصات الصحية؟', 'لا. مراجعة الملف داخل المجتمع لا تعني اعتماد الهيئة أو أي جهة تنظيمية. تحقق من التصنيف والتسجيل والاعتمادات عبر الجهات الرسمية.'],
    ['هل الكوتشنج استشارة طبية أو نفسية؟', 'لا. الكوتشنج حوار مهني ولا يغني عن الاستشارة الطبية أو النفسية أو خدمات الدعم المتخصص.'],
    ['هل ترسل أدوات البوصلة وتدقيق LinkedIn إجاباتي إلى الموقع؟', 'توضح الأدوات المعنية أن الإجابات تُعالج محلياً في المتصفح. راجع تنبيه الخصوصية داخل كل أداة ولا تدخل بيانات حساسة أو أسرار جهة العمل.'],
    ['هل يمكن نشر معلومات أو صور المرضى؟', 'لا. يمنع نشر أو مشاركة أي معلومات أو صور تعريفية للمرضى، حتى في ورش أو مجموعات مغلقة.'],
    ['ما الذي تتضمنه العضوية المميزة وكم سعرها؟', 'المزايا المدفوعة قيد التقييم ولم يُعلن سعر معتمد. ستُنشر المزايا والسعر والشروط قبل تفعيل أي دفع.'],
    ['هل كل ورشة أو تسجيل معلن متاح للمشاهدة؟', 'تحقق من الموعد وحالة الورشة في مركز التعلم. لا يُعد التسجيل متاحاً حتى يظهر في المكتبة ويُسمح لحسابك بتشغيله.'],
    ['كيف أترشح لأكون كوتشاً؟', 'ستُعلن آلية الترشح عبر قنوات المجتمع الرسمية عندما تكون جاهزة. لا ترسل مستندات الترخيص أو الهوية عبر روابط غير موثوقة.'],
    ['هل تضمن الأدوات وظيفة أو ترقية أو زيادة راتب؟', 'لا. تساعدك على تنظيم الأدلة والأسئلة والتجارب، لكنها لا تثبت وجود شاغر ولا تضمن وظيفة أو ترقية أو تعويضاً.'],
    ['كيف أصدّر بياناتي أو أحذف حسابي؟', 'بعد تسجيل الدخول، راجع الإعدادات؛ اقرأ أثر الحذف قبل التأكيد، ولا تشارك بيانات الدخول مع أي شخص.']
  ] },
  '/membership': { title: 'العضوية في مجتمع السيطرة | المجاني والمميز', description: 'تعرّف على المتاح الآن وما لم يُفعّل بعد في عضوية مجتمع السيطرة، دون أسعار أو وعود غير معلنة.', heading: 'عضوية واضحة، بلا وعود مبالغ فيها.', intro: 'ابدأ بالمقالات والأدوات المهنية العامة المتاحة على الموقع. أي مزايا إضافية أو رسوم ستُعلن بوضوح قبل تفعيلها.', points: [['المتاح الآن', 'المقالات المنشورة وأدوات التخطيط المهني العامة ومصادرها، مع توضيح حدود كل أداة.'], ['المميز ليس مفعلاً بعد', 'تُدرس مزايا مثل تسجيلات الورش والقوالب المتقدمة والمجالس الصغيرة؛ لم يُعلن سعر أو تفعيل دفع.'], ['التوثيق مسار منفصل', 'العضوية المميزة لا تعني توثيقاً مهنياً، ومراجعة المجتمع ليست اعتماداً تنظيمياً.'], ['الخصوصية أولاً', 'لا تُدخل بيانات المرضى أو أسرار العمل في الأدوات أو النقاشات.']] },
  '/privacy': { title: 'سياسة الخصوصية | مجتمع السيطرة', description: 'اقرأ كيف يتعامل مجتمع السيطرة مع بيانات الحساب والخصوصية وطلبات التوثيق.', heading: 'بياناتك المهنية تخصّك.', intro: 'لا يطلب مجتمع السيطرة بيانات صحية حساسة. تستخدم بيانات الحساب لتشغيل المجتمع، وتُعامل مستندات التوثيق كمرفقات خاصة لا يطّلع عليها إلا فريق المراجعة. تتوفر أدوات لتصدير بيانات الحساب أو حذفه من الإعدادات.', points: [['تقليل البيانات', 'نطلب الحد الأدنى اللازم لتشغيل الخدمة.'], ['ملفات التوثيق', 'تخزين خاص وصلاحية مراجعة محدودة.'], ['تحكمك', 'يمكنك تصدير بياناتك أو حذف الحساب.']] },
  '/terms': { title: 'شروط الاستخدام | مجتمع السيطرة', description: 'الشروط المهنية لاستخدام مجتمع السيطرة واحترام خصوصية الأعضاء والمرضى.', heading: 'مساحة مهنية تقوم على الوضوح.', intro: 'استخدم المجتمع باحترام ومسؤولية، ولا تنشر محتوى مضللاً أو مسيئاً، ولا تشارك أي معلومات أو صور تخص المرضى.', points: [['المسؤولية', 'لا تشارك بيانات دخولك أو بيانات الغير.'], ['خصوصية المرضى', 'يُمنع نشر معلومات أو صور المرضى منعاً باتاً.'], ['الإشراف', 'تُراجع البلاغات وفق قواعد المجتمع.']] },
  '/charter': { title: 'ميثاق السلوك المهني | مجتمع السيطرة', description: 'مبادئ الاحترام والسرية والتواصل المسؤول في مجتمع السيطرة.', heading: 'الاحترام ليس خياراً إضافياً.', intro: 'نحافظ معاً على مساحة مهنية تحترم الإنسان والخصوصية وتفسح المجال للاختلاف.', points: [['احترام متبادل', 'نختلف في الرأي دون إساءة أو تحرش.'], ['سرية مهنية', 'لا تعِد نشر محتوى الأعضاء خارج سياقه.'], ['تواصل مسؤول', 'لا رسائل مزعجة ولا ادعاءات مضللة.']] },
  '/career-journey': { title: 'رحلتك المهنية | أدوات ومسارات مجتمع السيطرة', description: 'بوصلة وأدوات وورش ومقالات موثقة لمسارك المهني من التخرج إلى الترقية والتموضع.', heading: 'رحلتك المهنية: أدوات وخطوات قابلة للتطبيق.', intro: 'مساحة مهنية للعاملين الصحيين والخريجين والباحثين عن انتقال منضبط. ابدأ بأداة، تعلّم في ورشة، واحفظ تقدمك محلياً.', type: 'career_hub', interactive: true, points: [['ماذا ستحصل؟', 'بوصلة وتقييمات وأدوات وقوالب وأدلة موثقة، إلى جانب مجتمع مهني وكوتشنج ومركز تعلم للأعضاء.'], ['من أين تبدأ؟', 'حدّد مرحلتك وتحديك، ثم اختبر خطوة صغيرة بمخرج واضح ومراجعة بدل قرار مبني على افتراض.'], ['المحتوى والورش', 'مقالات بمصادر موثوقة وورشة LinkedIn ذاتية بخطة وتمارين.']], related: [['/career-compass','البوصلة المهنية'],['/linkedin-audit','تدقيق LinkedIn'],['/fresh-graduate','حديث التخرج'],['/value-economy','اقتصاد القيمة'],['/achievement-portfolio','ملف الإنجازات'],['/promotion-intelligence','الترقية'],['/innovation-rd','الابتكار وR&D'],['/ai-career-leverage','AI Career Leverage'],['/saudi-labor-market-radar','رادار السوق السعودي'],['/professional-positioning','التموضع المهني'],['/linkedin-workshop','ورشة LinkedIn'],['/learning','مركز التعلّم']] },
  '/career-compass': { title: 'البوصلة المهنية | تقييم وخطة عملية', description: 'أداة ذاتية للمرحلة والمهارات والفجوات والاتجاه والخطوات المهنية التالية، بلا نتائج مختلقة.', heading: 'البوصلة المهنية', intro: 'حوّل خبرتك وقيودك وهدفك إلى فرضيات وخطوات قابلة للاختبار؛ تبقى إجابات التقييم في متصفحك.', type: 'career_tool', interactive: true, points: [['مدخلات ملائمة', 'المرحلة والتخصص والخبرة والمهارات والمجال الحالي والمستهدف والهدف والتحدي.'], ['إشارة كافية أم لا؟', 'إذا نقصت البيانات، تعرض الأداة ما يحتاج إلى تحقق بدلاً من اختراع ملاءمة أو طلب سوق.'], ['مخرجات عملية', 'اتجاهات وفجوات وخطوات 90 يوماً و12 شهراً وعبارة تموضع أولية.']], related: [['/articles/career-compass','دليل البوصلة'],['/fresh-graduate','حديث التخرج'],['/saudi-labor-market-radar','سياق السوق']] },
  '/linkedin-audit': { title: 'تدقيق LinkedIn | تقييم وخطة تحسين', description: 'راجع العنوان والملخص والخبرة والإنجازات والمهارات وFeatured وPortfolio والمحتوى والتموضع.', heading: 'تدقيق LinkedIn: درجة وأولويات عمل', intro: 'قيّم عناصر الملف التسعة واحصل على درجة مفسّرة وأولويات إصلاح وخطة فعلية، لا رقماً بلا أسباب.', type: 'career_tool', interactive: true, points: [['العناصر التسعة', 'Headline وAbout وExperience والإنجازات والمهارات وFeatured وPortfolio والمحتوى والتموضع.'], ['الأولوية قبل التنميق', 'تُظهر النتيجة النواقص الأعلى وتقدم اقتراحات صياغة عملية.'], ['خصوصية محلية', 'لا ترسل الأداة بيانات ملفك إلى الموقع؛ يمكنك استخدام القائمة يدوياً.']], related: [['/linkedin-workshop','ورشة LinkedIn'],['/articles/linkedin-workshop','الدليل الكامل'],['/professional-positioning','التموضع']] },
  '/fresh-graduate': { title: 'جاهزية حديث التخرج | خطة 30 و90 يوماً', description: 'مسار من قبل التخرج إلى المقابلة والوظيفة والإنجاز، مع تقييم وقائمة وخطة محلية.', heading: 'جاهزية حديث التخرج', intro: 'حوّل التخرج إلى مسار أدلة وتعلّم ومقابلة وخطة أول 30 و90 يوماً. التقدم محلي في متصفحك.', type: 'career_tool', interactive: true, points: [['قبل التخرج', 'حلّل الأدوار ومخرجات مشروع أو تدريب أو تطوع وابنِ أمثلة قابلة للشرح.'], ['المقابلة وأول وظيفة', 'اختبر الملاءمة وافهم العقد والأولويات ومعيار الجودة.'], ['أول 30 و90 يوماً', 'خطة عملية وإنجاز موثق وروتين مراجعة لا يضمن التوظيف.']], related: [['/articles/fresh-graduate','دليل حديث التخرج'],['/career-compass','البوصلة'],['/linkedin-workshop','ورشة LinkedIn']] },
  '/value-economy': { title: 'اقتصاد القيمة المهنية | من المهارة إلى الدليل', description: 'اربط المهارة بالقدرة والأثر والدليل والتموضع والتفاوض دون وعود بزيادة راتب.', heading: 'اقتصاد القيمة المهنية', intro: 'خريطة ذاتية من المهارة إلى القدرة والأثر والدليل والتموضع والتفاوض والتعويض؛ لا تتنبأ بزيادة أو راتب.', type: 'career_tool', interactive: true, points: [['Skill → Capability → Impact', 'حوّل المهارة إلى تطبيق فعلي وأثر موثق في سياقه.'], ['Evidence → Positioning', 'اربط ادعاءك بدليل قابل للتحقق من دون كشف أسرار العمل.'], ['Negotiation → Compensation', 'صغ طلباً مهنياً وتحقق من السياسة والنطاق بدلاً من تخمين رقم.']], related: [['/articles/professional-value','دليل القيمة'],['/achievement-portfolio','ملف الأدلة'],['/promotion-intelligence','الترقية']] },
  '/achievement-portfolio': { title: 'ملف الإنجازات المهني | قالب STAR محلي', description: 'أنشئ بطاقات إنجاز ودليل محلياً في متصفحك مع تصدير وحماية الخصوصية وأسرار العمل.', heading: 'ملف الإنجازات المهني', intro: 'بطاقات STAR ومتابعة إنجازات محلية، مع إمكان التصدير ومراجعة السرية قبل المشاركة.', type: 'career_tool', interactive: true, points: [['Evidence Tracker', 'سجّل السياق ودورك والفعل والنتيجة والدليل؛ لا تُرفع البيانات إلى الموقع.'], ['ملف مقابلة أو ترقية', 'استخرج أمثلة قصيرة قابلة للتحقق وميّز مساهمتك عن أثر الفريق.'], ['الخصوصية أولاً', 'لا تضع بيانات مرضى أو وثائق داخلية؛ التنقيح وحده ليس إذناً.']], related: [['/articles/achievement-portfolio','الدليل'],['/value-economy','اقتصاد القيمة'],['/promotion-intelligence','ملف الترقية']] },
  '/promotion-intelligence': { title: 'الاستعداد للترقية | تقييم وملف ومحادثة', description: 'قيّم الجاهزية وسجل الأدلة وقائمة الفحص ومحادثة المدير وخطة متابعة واقعية.', heading: 'Promotion Intelligence | الاستعداد للترقية', intro: 'تقييم ومحفظة أدلة ومحادثة مع المدير وخطة 90 يوماً؛ لا وعد بالترقية ولا افتراض بوجود شاغر.', type: 'career_tool', interactive: true, points: [['Readiness Assessment', 'قيّم فهم الدور والنتائج المتكررة والملكية والتعاون والتعلم والسياسة.'], ['Promotion Portfolio', 'ابنِ ملفاً محلياً من الأمثلة والقرارات والنتائج ومصادر القياس.'], ['محادثة وخطة متابعة', 'اسأل عن الفجوة وفرصة الإثبات والمقياس وتاريخ المراجعة.']], related: [['/articles/promotion-readiness','دليل الترقية'],['/achievement-portfolio','سجل الأدلة'],['/value-economy','أثر القيمة']] },
  '/innovation-rd': { title: 'الابتكار والبحث والتطوير | من الفكرة إلى القيمة', description: 'ميّز الاختراع والابتكار والبحث والتطوير والملكية الفكرية والتسويق، مع مسار مهني وأدلة.', heading: 'من الفكرة إلى القيمة: الابتكار والبحث والتطوير', intro: 'مسار يربط البحث العلمي والتطبيقي وR&D والصناعة والملكية الفكرية بنقل المعرفة إلى استخدام وقيمة.', type: 'career_tool', interactive: true, points: [['البحث وR&D', 'افهم اختلاف البحث والتطوير عن التنفيذ التشغيلي، ووثّق الفرضية والتجربة.'], ['من الأكاديمية إلى الصناعة', 'حوّل سؤالاً أو مشروعاً إلى مشكلة مستخدم وتجربة ومحفظة باحث.'], ['IP والتسويق', 'راجع الملكية قبل الإفصاح؛ البراءة لا تضمن عميلاً أو عائداً.']], related: [['/articles/innovation-value','دليل الابتكار والقيمة'],['/articles/ai-career-leverage','سير عمل AI'],['/professional-positioning','تموضع الباحث']] },
  '/ai-career-leverage': { title: 'AI Career Leverage | الذكاء الاصطناعي في العمل', description: 'سير عمل بشري مع AI للتحقق والإنتاجية والأتمتة والوكلاء والحوكمة والأمن وحماية البيانات.', heading: 'AI Career Leverage | ارفع أثر عملك بمسؤولية', intro: 'ليست دورة استخدام أداة؛ ابنِ سير عمل قابلاً للتدقيق مع مراجعة وجودة وأقل صلاحية وبيانات مسموح بها.', type: 'career_tool', interactive: true, points: [['Human + AI', 'حدد المخرج ومعيار الجودة والمصدر، ثم تحقق واعتمد بشرياً.'], ['Automation وAgents', 'أتمت الروتين الأقل خطورة ضمن نطاق ضيق وصلاحيات محدودة.'], ['Governance وSecurity', 'احمِ البيانات الصحية والشخصية، وراجع الصلاحيات والملكية والاحتفاظ.']], related: [['/articles/ai-career-leverage','دليل AI للعمل'],['/innovation-rd','الابتكار وR&D'],['/saudi-labor-market-radar','رادار السوق']] },
  '/saudi-labor-market-radar': { title: 'رادار سوق العمل السعودي | بيانات وإشارات', description: 'افصل بيانات GASTAT عن إشارات الطلب والتنظيمات والتوطين وتحولات AI مع المصدر والتاريخ.', heading: 'رادار سوق العمل السعودي', intro: 'رصد قابل للتحديث بمقالات منشورة من CMS؛ افصل البيانات الرسمية عن الإشارات والتحليل واللوائح.', type: 'career_tool', interactive: true, points: [['رسمي، إشارة، تحليل', 'قارن الإحصاءات دورياً ولا تعامل عينة الإعلانات كإحصاء للشواغر.'], ['المهارات والقطاعات والتنظيمات', 'تابع المهارات والتوطين وتواريخ السريان والتحولات التقنية بمصادر.'], ['تحليل يتجدد', 'ينشئ التحرير تحديثاً من CMS بمصادر ومشتقات اجتماعية.']], related: [['/articles/saudi-labor-market','منهج رادار السوق'],['/career-compass','البوصلة'],['/ai-career-leverage','أثر AI']] },
  '/professional-positioning': { title: 'التموضع المهني | جملة توضح قيمتك ودليلك', description: 'اربط جمهورك بالمشكلة والقدرة والدليل والاتجاه المهني، لا بلقب مبالغ فيه.', heading: 'التموضع المهني: وضوح يمكن التحقق منه', intro: 'أنشئ مسودة تعريف مهني من الجمهور والمشكلة والقدرة والدليل والاتجاه، من دون رفع البيانات.', type: 'career_tool', interactive: true, points: [['من تخدم؟ وما المشكلة؟', 'اختر فئة وسياقاً ومشكلة واضحة بدل عبارة عامة للجميع.'], ['ما القدرة والدليل؟', 'استخدم فعلاً مهنياً ودليلاً مشروعاً أو نتيجة مؤرخة مع حفظ السرية.'], ['إلى أين تتجه؟', 'سمّ مهارة أو مسؤولية تريد بناءها؛ لا تعد بمنصب أو فرصة.']], related: [['/articles/professional-positioning','الدليل الكامل'],['/linkedin-audit','تدقيق LinkedIn'],['/career-compass','البوصلة']] },
  '/linkedin-workshop': { title: 'ورشة اختراق LinkedIn | من ملف إلى أصل مهني', description: 'ورشة ذاتية بوحدات وأمثلة وتمارين وقائمة تحقق وخطة مراجعة 30 يوماً.', heading: 'اختراق LinkedIn: من ملف ساكن إلى أصل مهني', intro: 'ورشة ذاتية عملية بأهداف ووحدات وأمثلة وتمارين وقائمة تحقق وخطة مراجعة 30 يوماً، مع مقال موثق.', type: 'course', interactive: true, points: [['الوحدات', 'التموضع والعنوان وAbout والخبرة والمهارات وFeatured والمحتوى.'], ['الممارسة', 'تمارين كتابة وتدقيق وأمثلة للخريج والموظف وقائمة قابلة للنسخ.'], ['خطة 30 يوماً', 'أنجز التعديل واختبر الوضوح والأدلة؛ لا توجد صيغة خوارزمية مضمونة.']], related: [['/articles/linkedin-workshop','الدليل والمصادر'],['/linkedin-audit','تدقيق ذاتي'],['/professional-positioning','التموضع']] },
}
const questions = pages['/faq'].points
const protectedRoutes = ['/login', '/register', '/reset-password', '/feed', '/profile', '/connections', '/messages', '/notifications', '/groups', '/verification', '/moderation', '/admin', '/settings', '/owner', '/owner/100ms', '/learning', '/content-studio', '/learning-room']
const routes = []
const safeText = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const urlFor = route => new URL(route === '/' ? '' : `${route.replace(/^\/+|\/+$/g, '')}/`, siteRoot).toString()
const assetUrl = path => new URL(path.replace(/^\/+/, ''), siteRoot).toString()
const normalizeRoute = route => route === '/' ? '/' : `/${route.split('/').filter(Boolean).join('/')}/`
const ensureMetadataLimits = page => {
  if ([...page.title].length >= 60) throw new Error(`SEO title must remain under 60 characters: ${page.title}`)
  if ([...page.description].length >= 160) throw new Error(`SEO description must remain under 160 characters: ${page.title}`)
}
function truncateAtWordBoundary(value, maxChars) {
  const normalized = String(value ?? '').replace(/\s+/gu, ' ').trim()
  const chars = [...normalized]
  if (chars.length <= maxChars) return normalized
  let result = chars.slice(0, maxChars).join('').trimEnd()
  const boundary = result.lastIndexOf(' ')
  if (boundary >= Math.floor(maxChars * 0.6)) result = result.slice(0, boundary).trimEnd()
  return result.replace(/[,:;.!?–—-]+$/u, '').trimEnd()
}
function formatRecordTitle(value) {
  const normalized = String(value ?? '').replace(/\s+/gu, ' ').trim()
  const suffix = ' | مجتمع السيطرة'
  if ([...normalized].length + [...suffix].length < 60) return `${normalized}${suffix}`
  return truncateAtWordBoundary(normalized, 59)
}
function sitemapDate(value) {
  const timestamp = value ? Date.parse(String(value)) : Number.NaN
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}
function crumbData(route, page) {
  const labels = [{ name: 'الرئيسية', path: '/' }]
  if (route !== '/') {
    const parts = route.split('/').filter(Boolean)
    let current = ''
    for (const part of parts) {
      current += `/${part}`
      const known = pages[current]
      labels.push({ name: known?.heading || page.heading || part, path: current })
    }
  }
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: labels.map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: urlFor(item.path) })) }
}
function schemaFor(route, page, record = null) {
  const list = [
    { '@context': 'https://schema.org', '@type': 'Organization', name: appName, url: urlFor('/'), logo: new URL(`${basePath.replace(/\/$/, '')}/favicon.svg`, site.origin).toString(), description: pages['/'].description },
    { '@context': 'https://schema.org', '@type': 'WebSite', name: appName, url: urlFor('/'), inLanguage: 'ar' },
    crumbData(route, page),
  ]
  if (page.type === 'service') list.push({ '@context': 'https://schema.org', '@type': 'Service', name: 'الكوتشنج المهني للقطاع الصحي', serviceType: 'Professional coaching', provider: { '@type': 'Organization', name: appName, url: urlFor('/') }, areaServed: { '@type': 'Country', name: 'السعودية' }, description: page.intro, url: urlFor(route) })
  if (page.type === 'faq') list.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: questions.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) })
  if (page.type === 'course') list.push({ '@context': 'https://schema.org', '@type': 'Course', name: page.heading, description: page.intro, provider: { '@type': 'Organization', name: appName, url: urlFor('/') }, url: urlFor(route), inLanguage: 'ar' })
  if (['career_hub','career_tool','course'].includes(page.type)) list.push({ '@context': 'https://schema.org', '@type': 'WebPage', name: page.heading, description: page.intro, url: urlFor(route), inLanguage: 'ar', isPartOf: { '@type': 'WebSite', name: appName, url: urlFor('/') } })
  if (record?.kind === 'article') list.push({ '@context': 'https://schema.org', '@type': 'Article', headline: record.title, description: record.excerpt || record.title, ...(sitemapDate(record.published_at) ? { datePublished: sitemapDate(record.published_at) } : {}), ...(sitemapDate(record.updated_at) ? { dateModified: sitemapDate(record.updated_at) } : {}), inLanguage: 'ar', mainEntityOfPage: urlFor(route), publisher: { '@type': 'Organization', name: appName, url: urlFor('/') } })
  if (record?.kind === 'event') list.push({ '@context': 'https://schema.org', '@type': 'Event', name: record.title, description: record.description || record.title, startDate: record.starts_at, ...(record.ends_at ? { endDate: record.ends_at } : {}), eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', eventStatus: 'https://schema.org/EventScheduled', location: { '@type': 'VirtualLocation', url: urlFor(route) }, organizer: { '@type': 'Organization', name: appName, url: urlFor('/') }, inLanguage: 'ar' })
  if (record?.kind === 'coach') list.push({ '@context': 'https://schema.org', '@type': 'Person', name: record.display_name, jobTitle: record.headline || record.profession, description: record.public_bio || page.description, url: urlFor(route), knowsAbout: record.coaching_topics || [] })
  return list
}
function htmlLink(path, label, className = '') { return `<a${className ? ` class="${className}"` : ''} href="${safeText(urlFor(path))}">${safeText(label)}</a>` }
function header() { return `<header class="topbar"><div class="topbar-inner wrap"><a class="brand" href="${safeText(urlFor('/'))}" aria-label="مجتمع السيطرة - الرئيسية"><span class="brand-mark">♡</span><span class="brand-word">مجتمع <b>السيطرة</b><small>مساحة مهنية آمنة</small></span></a><button class="icon-btn menu-btn" id="menu-toggle" type="button" aria-label="فتح قائمة التنقل" aria-expanded="false" aria-controls="public-nav"><span aria-hidden="true">☰</span></button><nav id="public-nav" class="public-nav" aria-label="التنقل الرئيسي">${[['/career-journey','الرحلة المهنية'],['/about','عن المجتمع'],['/coaching','الكوتشنج'],['/coaches','الكوتشات'],['/articles','المقالات'],['/events','الفعاليات']].map(([path,label])=>htmlLink(path,label)).join('')}</nav><div class="header-actions"><button class="public-theme-toggle" id="theme-toggle" type="button" aria-label="تفعيل الوضع الداكن" aria-pressed="false"><span aria-hidden="true">◐</span></button>${htmlLink('/login','تسجيل الدخول','login-link')}${htmlLink('/register','انضم للمجتمع','btn btn-primary btn-small')}</div></div></header>` }
function footer() { return `<footer class="site-footer"><div class="wrap footer-inner"><a href="${safeText(urlFor('/'))}">مجتمع السيطرة</a><span>مساحة مهنية آمنة للقطاع الصحي: السيطرة على مسارك، لا على الآخرين.</span><div class="footer-links">${[['/career-journey','الرحلة المهنية'],['/faq','الأسئلة الشائعة'],['/membership','العضوية'],['/privacy','الخصوصية'],['/terms','الشروط'],['/charter','ميثاق السلوك']].map(([path,label])=>htmlLink(path,label)).join('')}</div><small>© ٢٠٢٦ مجتمع السيطرة</small></div></footer>` }
function pointCards(points = []) { return `<div class="public-points">${points.map(([title, text], i) => `<article class="public-point"><span class="point-number">0${i+1}</span><div><h2>${safeText(title)}</h2><p>${safeText(text)}</p></div></article>`).join('')}</div>` }
function breadcrumb(route, page) { const label = route === '/' ? 'الرئيسية' : page.heading; return route === '/' ? '' : `<nav class="breadcrumbs" aria-label="مسار التنقل">${htmlLink('/','الرئيسية')}<span aria-hidden="true">/</span><span>${safeText(label)}</span></nav>` }
function brandIllustration() {
  const sizes = '(max-width: 720px) calc(100vw - 68px), 500px'
  const avif = `<source type="image/avif" srcset="${assetUrl('images/brand-community-480.avif')} 480w, ${assetUrl('images/brand-community-1200.avif')} 1200w" sizes="${sizes}">`
  const webp = `<source type="image/webp" srcset="${assetUrl('images/brand-community-480.webp')} 480w, ${assetUrl('images/brand-community-1200.webp')} 1200w" sizes="${sizes}">`
  return `<section class="brand-visual"><div><span class="eyebrow">مساحة تجمعنا</span><h2>مهنية، إنسانية، ومتّصلة.</h2><p>نؤمن أن النمو المهني يصبح أعمق حين يجد الإنسان حوله مجتمعاً يحترم خبرته وحدوده ويشجّع التواصل الهادف.</p></div><picture>${avif}${webp}<img src="${ogImage}" srcset="${assetUrl('images/brand-community-480.webp')} 480w, ${assetUrl('images/brand-community-1200.webp')} 1200w" sizes="${sizes}" width="1200" height="630" loading="lazy" decoding="async" alt="دوائر مترابطة وقلوب تعبّر عن التعاون والنمو المهني"></picture></section>`
}
function staticBody(route, page, records = []) {
  if (page.type === 'career_hub' || page.type === 'career_tool' || page.type === 'course') {
    const links = (page.related || []).map(([path,label]) => htmlLink(path,label)).join('')
    return `<main class="public-page wrap">${breadcrumb(route,page)}<div class="public-page-copy"><span class="eyebrow">${page.type === 'career_hub' ? 'Entry Point → Career Journey' : page.type === 'course' ? 'ورشة ذاتية' : 'أداة ومسار مهني'}</span><h1>${safeText(page.heading)}</h1><p class="hero-lead">${safeText(page.intro)}</p></div>${pointCards(page.points)}<nav class="related-links" aria-label="مسارات ومقالات مرتبطة"><b>تابع رحلتك</b>${links}</nav><div class="coaching-note"><p>الأدوات محلية ولا ترفع إجاباتك. المحتوى معلومات مهنية ولا يضمن وظيفة أو ترقية؛ راجع المصادر والسياسات المناسبة لسياقك.</p></div></main>`
  }
  if (page.type === 'home') return `<main><section class="hero wrap"><div class="hero-copy"><div class="eyebrow">مساحة مهنية للقطاع الصحي</div><h1>مسارك المهني،<br><em>بإيقاعك أنت.</em></h1><p class="hero-lead">${safeText(page.intro)}</p><div class="hero-actions">${htmlLink('/register','اكتشف مساحتك','btn btn-primary')}${htmlLink('/coaching','تعرّف على الكوتشنج','btn btn-quiet')}</div></div><div class="hero-art" role="img" aria-label="رمز بصري للتواصل والنمو المهني"></div></section><section class="section wrap"><div class="section-heading"><div><span class="eyebrow">Entry Point → Career Journey</span><h2>مجتمع مهني، وأدوات لخطوتك القادمة</h2><p>للمهني الصحي والخريج والباحث: تعرّف إلى المجتمع، واستفد من الكوتشنج ومركز التعلّم، وابدأ بتقييم عملي أو ورشة ذاتية.</p></div>${htmlLink('/career-journey','استكشف الرحلة المهنية','text-link')}</div>${pointCards([['البوصلة المهنية','قيّم مرحلتك وفجوتك واختبر خياراً بخطوات عملية.'],['ورشة LinkedIn','وحدات وتمارين وقائمة تحقق وخطة 30 يوماً.'],['مركز التعلّم والمحتوى','ورش الأعضاء ومكتبة المقالات ذات المصادر الموثوقة.']])}<nav class="related-links" aria-label="روابط البدء">${htmlLink('/career-compass','ابدأ بالبوصلة')}${htmlLink('/linkedin-workshop','افتح الورشة')}${htmlLink('/learning','مركز التعلّم للأعضاء')}${htmlLink('/articles','مكتبة المحتوى')}</nav></section><section class="section wrap"><div class="section-heading"><div><span class="eyebrow">مساحتك، بطريقتك</span><h2>ما تحتاجه في رحلتك المهنية</h2></div>${htmlLink('/about','اكتشف المجتمع','text-link')}</div>${pointCards([['كوتشنج فردي','حوار مهني يساعدك على رؤية خياراتك بوضوح.'],['زمالة حقيقية','تواصل مع مهنيين يشاركونك المجال والطموح.'],['خبرة موثقة','تعرّف على الملفات المهنية العامة بعد مراجعتها.']])}</section><section class="quote-section"><div class="wrap quote-inner"><div><p>حين نمنح أنفسنا مساحة للتفكير، نصبح أقرب إلى الطريق الذي نختاره بوعي.</p><small>مجتمع السيطرة · مساحتك المهنية الآمنة</small></div>${htmlLink('/charter','ميثاقنا المهني','btn btn-outline')}</div></section><section class="section wrap join-section"><div><span class="eyebrow">خطوتك القادمة تبدأ هنا</span><h2>أنت أكثر من مسماك المهني.</h2><p>انضم إلى مساحة ترى خبرتك، وتحترم حدودك، وتدعم نموّك.</p></div>${htmlLink('/register','انضم إلى مجتمع السيطرة','btn btn-primary')}</section></main>`
  if (page.type === 'faq') return `<main class="public-page wrap">${breadcrumb(route,page)}<div class="public-page-copy"><span class="eyebrow">الأسئلة الشائعة</span><h1>${safeText(page.heading)}</h1><p class="hero-lead">${safeText(page.intro)}</p></div><div class="public-points">${questions.map(([question,answer])=>`<article class="public-point"><div><h2>${safeText(question)}</h2><p>${safeText(answer)}</p></div></article>`).join('')}</div><nav class="related-links" aria-label="صفحات مرتبطة"><b>قد تهمك</b>${htmlLink('/coaching','الكوتشنج المهني')}${htmlLink('/membership','العضوية والمزايا')}${htmlLink('/privacy','سياسة الخصوصية')}${htmlLink('/register','إنشاء حساب')}</nav></main>`
  if (page.type === 'articles' || page.type === 'coaches' || page.type === 'events') {
    const cards = records.map(record => {
      const detailPath = record.kind === 'article' ? `/articles/${record.slug}` : record.kind === 'coach' ? `/coaches/${record.user_id}` : `/events/${record.id}`
      const title = record.title || record.display_name
      const summary = record.kind === 'coach' ? [record.headline,record.profession,record.specialty,record.city].filter(Boolean).join(' · ') : record.kind === 'event' ? `${new Date(record.starts_at).toLocaleString('ar')} · ${record.location || 'افتراضي'}` : record.excerpt || ''
      return `<article class="public-point"><div><h2>${htmlLink(detailPath,title)}</h2><p>${safeText(summary)}</p></div></article>`
    }).join('')
    return `<main class="public-page wrap">${breadcrumb(route,page)}<div class="public-page-copy"><span class="eyebrow">${page.type === 'coaches' ? 'دليل مهني' : page.type === 'articles' ? 'مكتبة المجتمع' : 'تقويم المجتمع'}</span><h1>${safeText(page.heading)}</h1><p class="hero-lead">${safeText(page.intro)}</p></div>${records.length ? `<div class="public-points">${cards}</div>` : `<div class="panel-card empty-state"><h2>${page.type === 'articles' ? 'لا توجد مقالات منشورة حتى الآن' : page.type === 'coaches' ? 'لا توجد ملفات كوتش عامة منشورة بعد' : 'لا توجد فعاليات عامة قادمة حالياً'}</h2><p>ستظهر المعلومات العامة المنشورة هنا بعد مراجعتها. لا نعرض بيانات تجريبية.</p></div>`}<nav class="related-links" aria-label="صفحات مرتبطة"><b>قد تهمك</b>${htmlLink('/coaching','الكوتشنج المهني')}${htmlLink('/faq','الأسئلة الشائعة')}${htmlLink('/register','انضم إلى المجتمع')}</nav></main>`
  }
  return `<main class="public-page wrap">${breadcrumb(route,page)}<div class="public-page-copy"><span class="eyebrow">${safeText(route === '/about' ? 'عن مجتمعنا' : route === '/coaching' ? 'الكوتشنج المهني' : route === '/privacy' ? 'الخصوصية' : route === '/terms' ? 'الشروط' : 'ميثاق السلوك')}</span><h1>${safeText(page.heading)}</h1><p class="hero-lead">${safeText(page.intro)}</p></div>${pointCards(page.points)}${route === '/about' ? brandIllustration() : ''}${route === '/coaching' ? '<div class="coaching-note">الكوتشنج لا يغني عن الاستشارة الطبية أو النفسية.</div>' : ''}<nav class="related-links" aria-label="صفحات مرتبطة"><b>قد تهمك</b>${htmlLink('/coaching','الكوتشنج المهني')}${htmlLink('/articles','مقالات المجتمع')}${htmlLink('/faq','الأسئلة الشائعة')}${htmlLink('/membership','العضوية')}${htmlLink('/privacy','الخصوصية')}</nav></main>`
}
function metadata(route, page, record = null) {
  const recordTitle = record ? String(record.title || record.display_name || 'محتوى المجتمع') : ''
  const title = record ? formatRecordTitle(recordTitle) : page.title
  const recordSummary = record ? String(record.excerpt || record.public_bio || record.description || 'محتوى عام منشور في مجتمع السيطرة.') : ''
  // The title has its own metadata field; duplicating it here can truncate useful excerpts mid-sentence.
  const description = record ? truncateAtWordBoundary(recordSummary, 155) : page.description
  ensureMetadataLimits({ title, description })
  const canonical = urlFor(route)
  const type = record?.kind === 'article' ? 'article' : 'website'
  const jsonld = schemaFor(route,page,record).map(item => `<script type="application/ld+json">${JSON.stringify(item).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')}</script>`).join('')
  let imageUrl = ogImage
  if (record?.photo_url && record.kind === 'coach') {
    try {
      const candidate = new URL(record.photo_url)
      if (candidate.protocol === 'https:' || candidate.protocol === 'http:') imageUrl = candidate.toString()
    } catch { /* keep the first-party social-preview image */ }
  }
  const localeLinks = `<link rel="canonical" href="${safeText(canonical)}"><link rel="alternate" hreflang="ar" href="${safeText(canonical)}">`
  return `<title>${safeText(title)}</title><meta name="description" content="${safeText(description)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:type" content="${type}"><meta property="og:locale" content="ar_SA"><meta property="og:site_name" content="${appName}"><meta property="og:title" content="${safeText(title)}"><meta property="og:description" content="${safeText(description)}"><meta property="og:url" content="${safeText(canonical)}"><meta property="og:image" content="${safeText(imageUrl)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${safeText(title)}"><meta name="twitter:description" content="${safeText(description)}"><meta name="twitter:image" content="${safeText(imageUrl)}">${localeLinks}${jsonld}`
}
function shell(route, page, body, record = null, noindex = false, interactive = false) {
  const head = route === '/404'
    ? '<title>صفحة غير موجودة | مجتمع السيطرة</title><meta name="description" content="الصفحة المطلوبة غير متاحة في مجتمع السيطرة."><meta name="robots" content="noindex,nofollow">'
    : metadata(route,page,record).replace('index,follow,max-image-preview:large', noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large')
  let html = builtIndex
    .replace(/<html lang="[^"]*" dir="[^"]*">/, '<html lang="ar" dir="rtl">')
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta\s+name="(?:description|robots|twitter:[^"]+)"[^>]*>/g, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/g, '')
    .replace(/<link\s+rel="(?:canonical|alternate)"[^>]*>/g, '')
    .replace('</head>', `${head}</head>`)
  if (!interactive) {
    html = html
      .replace(/<script\b[^>]*\btype="module"[^>]*>\s*<\/script>/gi, '')
      .replace(/<link\b(?=[^>]*\brel="modulepreload")[^>]*>/gi, '')
    const stylesheet = html.match(/<link\b[^>]*\brel="stylesheet"[^>]*>/i)?.[0]
    if (!stylesheet) throw new Error(`Missing built stylesheet for static route ${route}`)
    html = html.replace('</body>', `<script defer src="${safeText(assetUrl('public-site.js'))}"></script></body>`)
  }
  if (!html.includes('id="critical-public-css"')) html = html.replace('</head>', `<style id="critical-public-css">${criticalCss}</style></head>`)
  const renderedBody = interactive ? body : `<div class="app" id="site-app">${body}</div>`
  html = html.replace('<div id="root"></div>', `<div id="root">${renderedBody}</div>`)
  if (!html.includes(`<div id="root">${renderedBody}</div>`)) throw new Error(`Failed to create prerender shell for ${route}`)
  return html.replace(/^[\t ]+$/gm, '')
}
async function writeRoute(route, html) {
  const normalized = normalizeRoute(route)
  const relative = normalized === '/' ? 'index.html' : `${normalized.replace(/^\//,'')}index.html`
  const outputPath = resolve(distDir, relative)
  if (!outputPath.startsWith(`${distDir}${sep}`) && outputPath !== resolve(distDir,'index.html')) throw new Error('Refusing to write outside dist/')
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, html)
}

async function readPublicRows(table, query) {
  const url = process.env.VITE_SUPABASE_URL?.trim()
  const key = process.env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return []
  try {
    const response = await fetch(`${url.replace(/\/$/,'')}/rest/v1/${table}?${query}`, { headers: { apikey: key, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
    if (!response.ok) { console.warn(`SEO prerender: public ${table} query returned HTTP ${response.status}; index page will remain empty.`); return [] }
    const result = await response.json()
    return Array.isArray(result) ? result : []
  } catch (error) {
    console.warn(`SEO prerender: public ${table} query failed; continuing without dynamic entries (${error instanceof Error ? error.message : 'network error'}).`)
    return []
  }
}
const now = encodeURIComponent(new Date().toISOString())
const [coachRows, articleRows, eventRows] = await Promise.all([
  readPublicRows('public_coaches','select=user_id,display_name,headline,profession,specialty,city,photo_url,public_bio,coaching_topics&order=display_name.asc&limit=200'),
  readPublicRows('articles','select=id,title,slug,excerpt,body,published_at,updated_at&status=eq.published&order=published_at.desc&limit=200'),
  readPublicRows('events',`select=id,title,description,starts_at,ends_at,location&is_private=eq.false&moderation_state=eq.visible&starts_at=gte.${now}&order=starts_at.asc&limit=200`),
])
const editorialBundle = JSON.parse(await readFile(resolve(projectRoot, 'src/content/editorial-pipeline.json'), 'utf8'))
const publishedCmsArticles = articleRows.filter(row => row.slug && row.title).map(row => ({ ...row, kind: 'article' }))
const articlesBySlug = new Map(publishedCmsArticles.map(row => [row.slug, row]))
for (const seed of editorialBundle.articles || []) {
  if (!articlesBySlug.has(seed.slug) && seed.title && seed.slug && seed.content_body) articlesBySlug.set(seed.slug, { id: `seed-${seed.slug}`, title: seed.title, slug: seed.slug, excerpt: seed.excerpt, body: seed.content_body, kind: 'article' })
}
const recordsByPage = { '/coaches': coachRows.filter(row => row.user_id && row.display_name).map(row => ({ ...row, kind: 'coach' })), '/articles': [...articlesBySlug.values()], '/events': eventRows.filter(row => row.id && row.title && row.starts_at).map(row => ({ ...row, kind: 'event' })) }
for (const [route,page] of Object.entries(pages)) {
  ensureMetadataLimits(page)
  const records = recordsByPage[route] || []
  const html = shell(route,page,`${header()}${staticBody(route,page,records)}${footer()}`,null,false,page.interactive === true)
  await writeRoute(route,html)
  const lastmod = records.map(record => sitemapDate(record.updated_at)).filter(Boolean).sort().at(-1)
  routes.push({ path: normalizeRoute(route), title: page.title, ...(lastmod ? { lastmod } : {}) })
}
routes.push(
  { path: '/articles/:slug/', title: 'تفاصيل المقال' },
  { path: '/events/:id/', title: 'تفاصيل الفعالية' },
  { path: '/coaches/:id/', title: 'الملف المهني للكوتش' },
  { path: '/learning-room/:id/', title: 'غرفة ورشة مهنية خاصة' },
)
for (const [collection,records] of Object.entries(recordsByPage)) {
  for (const record of records) {
    let route
    let page
    if (record.kind === 'article') {
      const slug = String(record.slug)
      if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(slug)) continue
      route = `/articles/${slug}`; page = { ...pages['/articles'], heading: record.title }
    }
    else if (record.kind === 'event') {
      if (!/^[0-9a-f-]{36}$/i.test(String(record.id))) continue
      route = `/events/${record.id}`; page = { ...pages['/events'], heading: record.title }
    }
    else {
      if (!/^[0-9a-f-]{36}$/i.test(String(record.user_id))) continue
      route = `/coaches/${record.user_id}`; page = { ...pages['/coaches'], heading: record.display_name }
    }
    const summary = record.kind === 'article' ? record.excerpt : record.kind === 'coach' ? record.public_bio : record.description
    const body = `${header()}<main class="public-page wrap"><nav class="breadcrumbs" aria-label="مسار التنقل">${htmlLink('/','الرئيسية')}<span>/</span>${htmlLink(collection,page.heading)}<span>/</span><span>${safeText(page.heading)}</span></nav><article class="public-article"><span class="eyebrow">${record.kind === 'article' ? 'مقال منشور' : record.kind === 'coach' ? 'ملف كوتش مهني عام' : 'فعالية عامة قادمة'}</span><h1>${safeText(page.heading)}</h1>${record.kind === 'article' && record.published_at ? `<time datetime="${safeText(record.published_at)}">${new Date(record.published_at).toLocaleDateString('ar')}</time>` : ''}${record.kind === 'event' ? `<p>${new Date(record.starts_at).toLocaleString('ar',{dateStyle:'long',timeStyle:'short'})} · ${safeText(record.location || 'افتراضي')}</p>` : ''}<p>${safeText(summary || '')}</p>${record.kind === 'article' ? `<div class="public-article-body">${renderMarkdownToHtml(record.body || '').replace(/href="\/(?!\/)/g, `href="${basePath.replace(/\/$/,'')}/`)}</div>` : ''}${record.kind === 'coach' && Array.isArray(record.coaching_topics) ? `<p>${safeText(record.coaching_topics.join(' · '))}</p>` : ''}</article><nav class="related-links" aria-label="صفحات مرتبطة"><b>قد تهمك</b>${htmlLink('/coaching','الكوتشنج المهني')}${htmlLink('/articles','مقالات المجتمع')}${htmlLink('/faq','الأسئلة الشائعة')}</nav></main>${footer()}`
    await writeRoute(route,shell(route,page,body,record,false,record.kind === 'article'))
    const lastmod = sitemapDate(record.updated_at)
    routes.push({ path: normalizeRoute(route), title: page.title, ...(lastmod ? { lastmod } : {}) })
  }
}
for (const route of protectedRoutes) {
  const page = { title: `${route === '/login' ? 'تسجيل الدخول' : route === '/register' ? 'إنشاء حساب' : route === '/reset-password' ? 'استعادة كلمة المرور' : route === '/owner/100ms' ? 'إعداد البث للمالك' : route === '/owner' ? 'بوابة المالك' : route === '/learning' ? 'مركز التعلّم للأعضاء' : 'مساحة الأعضاء'} | مجتمع السيطرة`, description: route === '/register' ? 'التسجيل العام متوقف مؤقتاً؛ راجع طريقة الدخول والدعوات في مجتمع السيطرة.' : 'صفحة خاصة بأعضاء مجتمع السيطرة.' }
  const privateBody = route === '/register'
    ? `${header()}<main class="public-page wrap"><span class="eyebrow">الدخول عبر الدعوة فقط</span><h1>التسجيل العام متوقف مؤقتاً.</h1><p>هذه المساحة تتطلب الدخول. نوقف إنشاء الحسابات الجديدة حتى اكتمال اختبارات القبول والأمان؛ إذا وصلتك دعوة رسمية، احتفظ بها واستخدم تعليماتها.</p>${htmlLink('/login','تسجيل الدخول','btn btn-primary')}</main>${footer()}`
    : route === '/owner/100ms'
      ? `${header()}<main class="public-page wrap"><h1>إعداد البث للمالك فقط.</h1><p>هذه المساحة تتطلب الدخول بحساب المالك المعتمد.</p>${htmlLink('/login','تسجيل الدخول','btn btn-primary')}</main>${footer()}`
      : `${header()}<main class="public-page wrap"><h1>هذه المساحة تتطلب الدخول.</h1><p>سيحوّلك التطبيق إلى صفحة تسجيل الدخول.</p>${htmlLink('/login','تسجيل الدخول','btn btn-primary')}</main>${footer()}`
  await writeRoute(route,shell(route,page,privateBody,null,true,true))
  routes.push({ path: normalizeRoute(route) })
}
const notFoundPage = { title: 'صفحة غير موجودة | مجتمع السيطرة', description: 'الصفحة المطلوبة غير متاحة في مجتمع السيطرة.' }
const deepRouteRecovery = `<script>(function(){const target=location.pathname+location.search+location.hash;const appShell=new URL('learning-room/',${JSON.stringify(siteRoot.toString())});appShell.searchParams.set('__saytara_route',target);location.replace(appShell.toString())})()</script>`
await writeFile(resolve(distDir,'404.html'),shell('/404',notFoundPage,`${header()}<main class="public-page wrap"><h1>جارٍ فتح الصفحة المطلوبة…</h1><p>لحظة واحدة.</p>${deepRouteRecovery}</main>${footer()}`,null,true,true))
// Keep noindex app shells crawlable so search engines can read their robots meta directive.
// robots.txt is not an access-control mechanism; member data remains protected by Auth/RLS.
await writeFile(resolve(distDir,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml',siteRoot)}\n`)
const privateRoutePaths = new Set(protectedRoutes.map(normalizeRoute))
const sitemap = routes.filter(route=>!privateRoutePaths.has(route.path) && !route.path.includes('/:')).map(route => {
  const lastmod = sitemapDate(route.lastmod)
  const lastmodTag = lastmod ? `<lastmod>${safeText(lastmod)}</lastmod>` : ''
  return `<url><loc>${safeText(urlFor(route.path))}</loc>${lastmodTag}<changefreq>${route.path==='/'?'weekly':'monthly'}</changefreq></url>`
}).join('')
await writeFile(resolve(distDir,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${sitemap}</urlset>\n`)
await writeFile(resolve(distDir,'manus-routes.json'),JSON.stringify({ routes },null,2)+'\n')
console.log(`Pre-rendered ${Object.keys(pages).length} public landing pages, ${Object.values(recordsByPage).reduce((count,rows)=>count+rows.length,0)} public content detail pages, ${protectedRoutes.length} noindex SPA routes, sitemap.xml, robots.txt, and 404.html.`)
