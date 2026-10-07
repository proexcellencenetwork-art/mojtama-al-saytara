# حالة تسلّم المشروع — 5 أكتوبر 2026

هذه الصفحة تسجل ما تم إثباته من المستودع والنشر الحالي، وتفصل بين الكود الموجود والاختبار التشغيلي الفعلي. لا تحتوي أسراراً أو JWT أو كلمات مرور.

## DONE / PASS

- **المستودع والنشر:** `main` متزامن مع `origin/main` عند commit `e03f5b5` (`fix: align streaming controls and signup policy`). النسخة المنشورة في GitHub Pages تطابق المصدر العام عند commit `b268671`، وGitHub Actions run `37237574064` نجح، والمسارات المنشورة الرئيسية أعادت HTTP 200.
- **الواجهة العامة والمحتوى:** Career Journey، Career Compass، LinkedIn Workshop، Fresh Graduate، Value Economy، Promotion Intelligence، Innovation/R&D، AI Career Leverage، Saudi Labor Market Radar، المقالات العامة، ومركز التعلم منشورة ضمن البنية الحالية.
- **SEO المنشور:** `/manus-routes.json` و`/sitemap.xml` و`/robots.txt` تستجيب، وصفحة Career Compass المنشورة تحتوي المحتوى العربي وJSON-LD.
- **فحوص محلية سابقة:** `typecheck` و`lint` و`build` و`test:content` و`test:seo-fixtures` نجحت حسب سجلات الإصدار الأخيرة؛ لا يعاد تصنيفها كاختبار Auth حي.
- **رفض غير المصرح:** سجل التدقيق يوثق أن وظائف Edge السبع رفضت POST غير مصادق بـ`401`. هذا PASS لبوابة الرفض فقط، وليس لمسار مصادق.
- **طبقة البيانات المعلنة:** migrations بوابة الاعتماد وهرمية المالك ومركز التعلم وتشديد `is_staff` موجودة في المستودع، مع RLS وStorage الخاصين موثقين في تقارير التدقيق.

## VERIFIED AFTER HANDOFF

- **إغلاق التسجيل العام — PASS:** تم تغيير `.github/workflows/deploy.yml` إلى `VITE_PUBLIC_SIGNUP_ENABLED=false`، ونجح GitHub Actions run `37236738724` على commit `e607c02`. فتح المتصفح صفحة `/register/` المنشورة فعلياً وأكد ظهور رسالة «التسجيل العام متوقف مؤقتاً» مع رابط تسجيل الدخول، دون نموذج إنشاء حساب.
- **تحديث وثائق الحالة — PASS:** تمت مواءمة README ودليل Turnstile مع قرار NO-GO الحالي، وتسجيل التناقض السابق بين فتح Supabase التاريخي وبناء Pages.
- **تصحيح واجهة البث — PASS محلياً:** أصبحت غرفة التعلم تربط زر مشاركة الشاشة بحالة 100ms الفعلية فتتيح البدء والإيقاف، وصارت لوحة المالك تعرض التسجيل العام «مغلق» بما يطابق بناء Pages. اجتاز التعديل `typecheck` و`lint` و`build` و`test:seo-fixtures` و`npm audit --omit=dev --audit-level=high`.
- **فحص SEO حي بعد النشر — PASS:** `/manus-routes.json` و`/sitemap.xml` و`/robots.txt` أعادت HTTP 200؛ صفحة المقال العامة أعادت canonical و`Article` JSON-LD؛ مسار `/learning/` أعاد `noindex,nofollow`؛ و`robots.txt` يمنع المسارات الخاصة ببادئة `/mojtama-al-saytara/` الصحيحة. التسجيل العام ظاهر كمغلق في Auth bundle المنشور.

## IN PROGRESS

- **إعداد المنتج:** المحتوى العام والأدوات والروابط المنشورة موجودة؛ الاختبارات التشغيلية للعضوية ومخرجات أدوات المستخدم لم تُنجز بجلسات فعلية.

## BLOCKED — EXTERNAL ACCESS

- لا يوجد Connector مفعّل حالياً لـSupabase أو Supabase API في جلسة Manus، لذلك لا يمكن تنفيذ أو إثبات استعلامات Supabase الحية أو تغيير إعداد Auth أو إضافة Secret أو إنشاء Database Webhook من هذه الجلسة.
- لا توجد جلسة مالك/مدير/عضوين اختبار متاحة هنا، ولا يجوز طلب أو نقل كلمات المرور أو JWT أو مفاتيح الخدمة داخل المحادثة.
- إعداد 100ms، أسراره، وموارد الغرفة/التسجيل غير موجودة في الحالة الحالية؛ لا يمكن ادعاء أن Live/Recording/Playback يعمل.

## NOT TESTED

- Owner login وOwner Portal مع جلسة حقيقية.
- دعوة مصادق عليها، قبول/رفض، manager permissions، وسجل التدقيق عبر الموقع.
- تأكيد البريد، Resend، Password Reset وSMTP الحي.
- عزل Account A عن Account B عبر JWT حي للرسائل وطلبات التوثيق وStorage والحدود اليومية.
- `CLEANUP_WEBHOOK_SECRET` وDatabase Webhook والتنظيف الفعلي للوثائق.
- `delete-account` على حساب تطوير disposable، مع إثبات حماية حساب المالك.
- Turnstile/CAPTCHA: Sitekey/Secret والقبول والرفض الفعليان.
- Camera، Microphone، Screen Share، Recording، Archive، Signed Playback، وUnauthorized Denied عبر 100ms أو مزود بث فعلي.

## الحكم الحالي

**FINAL STATUS: NO-GO** للفتح العام الكامل أو ادعاء أن مركز البث يعمل.

**CRITICAL:** Auth/UAT، البريد، RLS/Storage بجلسات حقيقية، CAPTCHA، التنظيف/الحذف، وعدم وجود مزود بث مضبوط.

**ملاحظة:** تصحيح واجهة مشاركة الشاشة لا يساوي اختبار بث حي؛ ما زالت موارد 100ms والأسرار وجلسات Owner/Member وRecording/Webhook/Playback الفعلية مطلوبة قبل PASS.

**NON-CRITICAL:** Cloudflare WAF/DDoS على نطاق مملوك؛ يصنف Future Hardening كما في التوجيه، ولا يبرر تغيير DNS الآن.
