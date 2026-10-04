# تنفيذ الإصدار الأول — مجتمع السيطرة المهنية

> هذا الملف يتابع نتائج التنفيذ داخل المشروع. لا يغني عن الصفحات والأدوات المنشورة والاختبارات الفعلية.

## 1. خط الأساس والتكامل الآمن

- [ ] استخدام المستودع الحالي دون إعادة إنشاء التطبيق أو كسر React/Vite/Supabase أو GitHub Pages.
- [ ] الحفاظ على بوابة اعتماد الحسابات، الأدوار، RLS، ملفات التحقق الخاصة، هرمية المالك، ومسارات Owner Portal/Learning Center.
- [ ] عدم تشغيل `supabase/setup.sql` أو bootstrap المالك أو seed في مشروع الإنتاج، وعدم وضع كلمات مرور أو JWT أو service-role أو مفاتيح API أو webhook في الواجهة أو Git أو السجلات.
- [ ] نجاح `typecheck` و`lint` و`build` وفحوص SEO القائمة قبل وبعد التعديل، مع فصل أي عطل سابق عن التغييرات الجديدة.

## 2. المحتوى والصفحة الرئيسية والمسارات العامة

- [ ] تحويل الصفحة الرئيسية إلى Entry Point → Career Journey توضح المجتمع، الجمهور، مكاسب العضو، الورش، البوصلة المهنية، مركز التعلم والمحتوى، مع مسارات CTA عملية.
- [ ] نشر عشرة موضوعات قوية ومترابطة داخل النظام الحالي: البوصلة المهنية، اختراق LinkedIn، جاهزية حديث التخرج، اقتصاد القيمة المهنية، ملف الإنجازات، الاستعداد للترقية، الابتكار/R&D والقيمة المهنية، AI Career Leverage، Saudi Labor Market Radar، والتموضع المهني.
- [ ] لكل موضوع: مصدر/أدلة مناسبة، رابط URL مناسب، عنوان ووصف SEO، H1/H2/H3، روابط داخلية، Open Graph/Twitter، canonical عند الحاجة، Structured Data عند المناسبة، وربط ضمن Pillar + Cluster.
- [ ] عدم نشر أرقام بلا مصدر أو قصص نجاح مختلقة أو وعود بزيادة راتب أو ترقية أو وظيفة.

## 3. أدوات المسار المهني العملية

- [ ] البوصلة المهنية تجمع المرحلة المهنية والتخصص والخبرة والمهارات والمجال الحالي والمستهدف والهدف والتحدي، وتعرض Current Career Position وMarket Direction وSkill Gaps وPossible Career Directions وNext 90 Days وNext 12 Months وPositioning Statement أو تطلب المعلومات الناقصة صراحة.
- [ ] LinkedIn Audit يغطي Headline وAbout وExperience وAchievements وSkills وFeatured وPortfolio وContent وPositioning، ويعطي Score وPriority Fixes وAction Plan، لا رقماً منفصلاً فقط.
- [ ] جاهزية حديث التخرج تشمل قبل التخرج وأول 30 يوم وأول 90 يوم وأول مقابلة وأول وظيفة وأول إنجاز وأول سنة، مع Assessment وChecklist وRoadmap وTemplates وورش ومقالات موصى بها.
- [ ] تنفيذ اقتصاد القيمة المهنية وملف الإنجازات وPromotion Intelligence فعلياً: readiness assessment، checklist، promotion portfolio، evidence tracker، conversation guide، وربط Skill → Capability → Business Impact → Evidence → Positioning → Negotiation → Compensation بدون ضمانات مالية.

## 4. المحتوى القابل لإعادة الاستخدام والرادار

- [ ] حفظ Deep Article وWorkshop/Tool linkage والمصادر وSEO والـTikTok/LinkedIn/X derivatives داخل نظام المحتوى الحالي، لا في ملفات منفصلة غير مستخدمة.
- [ ] لكل موضوع منشور: Hook و30-sec Script و60-sec Script وCTA وCaption وHashtags وShort Video Concept وLinkedIn Post وX Post وThread عند الملاءمة، وكل CTA يعيد إلى صفحة الموقع ذات الصلة.
- [ ] إنشاء Saudi Labor Market Radar قابل للتحديث عبر Owner/Editorial Studio: source registry → analysis article → short/social derivative → SEO route، مع مصدر وتاريخ وتأثير سوقي واضحين.

## 5. ورشة LinkedIn ومركز التعلم والبث

- [ ] نشر ورشة «اختراق LinkedIn: من ملف ساكن إلى أصل مهني» داخل Learning Center بمقدمة وأهداف وModules وأمثلة وتمارين وChecklist وAction Plan وCTA وبيانات الموعد/التسجيل.
- [ ] الحفاظ على صلاحيات Learning Center: المستخدم غير المصرح له يرفض، والمستخدم المصرح له يرى الورشة/الغرفة/المكتبة فقط وفق الاستحقاق.
- [ ] استخدام 100ms عبر أسرار خادمية وEdge Functions فقط؛ لا تُنشأ/تُعرض أسرار المزود في المتصفح أو Git. لا يُدّعى نجاح بث أو تسجيل قبل تهيئة مزود حقيقي واختبار E2E بحسابات اختبار.
- [ ] عند توفر إعداد مزود مصرح: Create Workshop → Start Live → Camera/Mic → Screen Share إن كان مفعلاً → Record → End → Archive → Library → Authorized Playback = PASS وUnauthorized = DENIED.

## 6. SEO والنشر والتسليم

- [ ] إضافة المسارات العامة إلى prerender و`manus-routes.json` وsitemap وrobots والتصفح الداخلي؛ إبقاء العضوية والبيانات الخاصة `noindex` وخارج sitemap/public HTML.
- [ ] اختبار صفحات المحتوى وdetail/missing route والـsitemap/robots من الاستجابة الخام بعد النشر، مع فحص الأداء والتنقل وCTAs القابلة للقياس بقدر ما تسمح به البنية الحالية.
- [ ] Commit تغييرات منطقية ودفعها دون force-push إلى `main` ثم التحقق من GitHub Pages الفعلي.
- [ ] إنتاج PDF نهائي موثق يربط Website وCareer Compass وLinkedIn Workshop وFresh Graduate وSalary/Value وPromotion وInnovation/R&D وAI وLabor Market Radar وLearning Center وLive Streaming وRecording Library وSEO وTikTok/Social وGitHub وآخر Deployment وآخر Commit.
