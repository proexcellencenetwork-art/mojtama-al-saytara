# مراجع تنفيذ تأكيد البريد ومراجعة الحسابات

تاريخ الاطلاع: 3 أكتوبر 2026. هذه مراجع رسمية للمفاهيم التي اعتمد عليها ترحيل الموافقة؛ لا تثبت بذاتها إعدادات مشروع Supabase الحي.

- Supabase Auth `signUp`: https://supabase.com/docs/reference/javascript/auth-signup — سلوك إنشاء المستخدم والجلسة عند تفعيل تأكيد البريد، وخيار `emailRedirectTo`.
- Supabase Auth `resend`: https://supabase.com/docs/reference/javascript/auth-resend — إعادة إرسال رسالة تأكيد التسجيل مع رابط العودة.
- Supabase Auth configuration: https://supabase.com/docs/guides/auth/general-configuration — إعدادات تأكيد البريد وسلوكها.
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security — السياسات permissive/restrictive، ملاحظة أن الـviews تتجاوز RLS افتراضياً، وتوصية اختبار سماح/منع.
- Supabase database functions: https://supabase.com/docs/guides/database/functions — الدوال `SECURITY DEFINER`، تثبيت `search_path`، وسحب EXECUTE من `PUBLIC`/`anon` ثم منحه صراحة.
- Supabase Edge Function development tips: https://supabase.com/docs/guides/functions/development-tips — تنظيم الملفات المشتركة تحت `_shared` وإعداد JWT/الويبهوكات.
- Supabase Edge Function deployment: https://supabase.com/docs/guides/functions/deploy — النشر والتحقق من تشغيل الوظائف الحية.
- Supabase database migrations: https://supabase.com/docs/guides/local-development/database-migrations — سير عمل الترحيلات وتسجيل تغييرات المخطط.
- PostgreSQL row security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html — السياسات permissive تُجمع بـOR، والتقييدية بـAND، وتطبيق `USING`/`WITH CHECK`.

## أثر ذلك على التنفيذ

- يسجل المستخدم عبر البريد، ثم يجب أن يؤكد البريد من رسالة Supabase.
- لا تُعرض طلبات الانضمام في لوحة المدير إلا بعد تأكيد البريد، ويجري القرار عبر دالة RPC محصورة بالمدير.
- السياسات التقييدية تطلب موافقة الحساب فوق السياسات الحالية لجميع جداول العضوية؛ يبقى الملف الذاتي pending قابلاً لقراءة حالته فقط.
- عرض الكوتشات العام يُفلتر يدوياً إلى الحسابات المعتمدة لأن الـview لا يعتمد على RLS تلقائياً.
- إعداد SMTP/تسليم الرسائل واختبار البريد الفعلي يبقيان بحاجة إلى تحقق في مشروع المالك.
- أُجري بحث صور عن شعار رسمي للمشروع ولم تُستخدم نتائجه غير المطابقة؛ التقرير النهائي يلتزم بالألوان المحددة والأصول الأصلية الموجودة في المستودع فقط (`public/favicon.svg` و`public/og-social.png` و`public/images/brand-community-480.webp`).


## ملاحظات تحقق الإنتاج — 3 أكتوبر 2026

المصادر: استعلامات قراءة فقط من موصل Supabase MCP للمشروع [`tiifakicmnwexmqoyxfq`](https://supabase.com/dashboard/project/tiifakicmnwexmqoyxfq)، وقائمة التشغيل على مستودع [GitHub Actions](https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions).

- سُجلت migration `account_approval_gate_20261003` بالإصدار `20261003200940`، ثم `anon_policy_scoping_20261003` بالإصدار `20261003201627`.
- قاعدة الإنتاج أظهرت `profiles.account_status` غير قابل لـNULL وافتراضه `pending`، ووجود trigger إنشاء الملف الشخصي وtrigger حراسة حقول الاعتماد.
- bucket `verification-private` خاص (`public=false`)، وعرض `public_coaches` مضبوط `security_barrier=true` و`security_invoker=true`.
- لا يملك دور `anon` صلاحية EXECUTE على `is_account_approved`, `is_staff`, `is_active_group_member`, أو `is_group_owner`. بعد فصل سياسات القراءة العامة اختفى تنبيه Supabase الخاص بدوال `SECURITY DEFINER` المتاحة لـanon. بقيت 10 تحذيرات للمستخدمين المصادقين؛ تشمل دوال ذات تحقق داخلي لحالة الحساب/الدور أو سياسات عضوية وقرارات إشراف، وتحتاج مراجعة عند تعديل هذه الدوال.
- الوظيفتان `delete-account` و`cleanup-verification-files` حالتهما `ACTIVE` (النسخة 1). الأولى تفرض JWT (`verify_jwt=true`)، والثانية تستخدم تحقق `x-cleanup-secret` (`verify_jwt=false`). طلب POST بلا JWT/سر أعاد `401` لكلتيهما، لذلك لم يُنفّذ حذف. وجود سر `CLEANUP_WEBHOOK_SECRET` في الإعداد البعيد ووجود Database Webhook لم يُتحقق منهما.
- عدد مستخدمي Auth والملفات الشخصية وقت الاستعلام كان صفراً؛ لذلك لا توجد حسابات مستقلة لإجراء اختبار JWT حي بين عضوين.
- نجح محلياً تشغيل `setup.sql` واختبار `account_approval_smoke.sql` في قاعدة مؤقتة معزولة حُذفت بعد `ROLLBACK`.
- تعذر عرض أسماء متغيرات Actions من CLI برسالة HTTP 403 `Resource not accessible by integration`؛ لم تُقرأ أي قيمة. مصدر الإعداد اليدوي هو صفحة [Actions Variables](https://github.com/proexcellencenetwork-art/mojtama-al-saytara/settings/variables/actions).


**تأكيد صلاحيات GitHub:** فشلت كذلك محاولتا إنشاء/تحديث `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` برسالة HTTP 403 `Resource not accessible by integration`. لم تُعرض القيم. يلزم إدخالهما يدوياً من واجهة المستودع أو منح التكامل صلاحية Actions Variables ثم إعادة النشر.


**التحقق النهائي بعد النشر (3 أكتوبر 2026):** نجح تشغيل workflow للتطبيق [37151383910](https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions/runs/37151383910) ونجح نشر GitHub Pages [37151400542](https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions/runs/37151400542). استجابت `/`, `/login/`, `/register/`, `/feed/`, `/admin/` بـHTTP 200؛ وفي المتصفح أعاد `/feed/` و`/admin/` الزائر إلى `/login`. عُرض نموذج التسجيل الحي، ولم يُخرج Console المتصفح المعزول أخطاء. فحصت حزمة JavaScript المنشورة محلياً بملاءمة دقيقة للقيم: وجود Project URL ومفتاح publishable اللذين زوّد بهما المالك كلاهما `true`، ولم تُطبع أو تُحفظ قيمة المفتاح. لذلك الموقع ليس في وضع التجربة في هذا الإصدار حتى مع رفض CLI قراءة/كتابة متغيرات GitHub بـ403. لا يثبت ذلك إرسال بريد أو نجاح طلب Auth.


## متابعة الإنتاج — 4 أكتوبر 2026

- مشروع Supabase `tiifakicmnwexmqoyxfq` بحالة `ACTIVE_HEALTHY` في الفحص السابق.
- صفحة [Authentication → Sign In / Providers](https://supabase.com/dashboard/project/tiifakicmnwexmqoyxfq/auth/providers) أظهرت `Confirm email` مفعّلاً. أُوقف `Allow new users to sign up` وحُفظ؛ أعادت الصفحة بعد reload إظهار التسجيل مغلقاً وتأكيد البريد مفعّلاً. يبقى التسجيل العام مغلقاً حتى اجتياز UAT.
- طُبّقت migration `platform_owner_hierarchy_20261004`، المسجلة بالإصدار `20261004000220`. أزيلت سياسة المدير القديمة التي كانت تسمح بإدارة الصفوف، وتأكد أن دور `authenticated` لا يملك `INSERT` أو `UPDATE` أو `DELETE` مباشرة على `public.user_roles`.
- نُفّذ bootstrap لمرة واحدة للحساب المؤكد الذي عيّنه المالك. استعلام تحقق لا يعرض البريد أو المعرّف أكد: صف مالك واحد، وملف المالك معتمد، وحساب واحد آخر `pending`، ولا حسابات مرفوضة. لا تُعد تشغيل `supabase/bootstrap-initial-owner.sql` على هذا المشروع.
- جداول هوية المالك والتدقيق مخفية عن SELECT المباشر للعميل؛ دعوات المالك وإسناد الأدوار وإعداداتها تمر عبر RPCs محمية. الاختبارات الفعلية بهذه الجلسات لم تُنفذ بعد.
- الوظائف الحية: `delete-account` version 2 (`verify_jwt=true`)، `cleanup-verification-files` version 1 (`verify_jwt=false` مع تحقق `x-cleanup-secret`)، و`owner-invite` version 1 (`verify_jwt=true`). طلب POST بلا JWT إلى الدعوة والحذف أعاد `401`، ولم يُرسل بريد أو يحدث حذف. لم يُتحقق من السر البعيد أو Database Webhook.
- آخر Security Advisor أعاد 3 ملاحظات `INFO` عن جداول داخلية عليها RLS من دون سياسات، وتحذيراً واحداً عن `is_staff` للـ`anon`، و18 تحذيراً عن دوال `SECURITY DEFINER` متاحة لـ`authenticated`، وتحذيراً بأن حماية كلمات المرور المسرّبة غير مفعّلة. يلزم مراجعة هذه النتائج واختبار RPCs بجلسات حية قبل فتح التسجيل.
- لا تغيير على Google OAuth؛ ما يزال اختيارياً ومؤجلاً.


## التحقق النهائي من بوابة المالك — 4 أكتوبر 2026

- نجح workflow التطبيق [37164428472](https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions/runs/37164428472) ونشر Pages [37164428191](https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions/runs/37164428191) بعد commit `f2d8ee4`.
- كشف الفحص المباشر أن أول build بعد إضافة البوابة لم يولّد shell لـ`/owner/` لأن قائمة `protectedRoutes` في `scripts/prerender-pages.mjs` لم تتضمنه. أُضيف المسار أيضاً إلى allowlist الخاص في `scripts/validate-seo-output.mjs`؛ اجتاز البناء والتحقق، وأُعيد النشر.
- بعد الإصلاح: `/`, `/login/`, `/register/`, و`/owner/` أعادت HTTP 200؛ `owner` صار `noindex,nofollow`؛ ملفات CSS وJS للبوابة أعادت 200. متصفح Sandbox غير المسجل تحوّل من `/owner/` إلى `/login`، وعرض `/register/` رسالة «الدخول بالدعوة فقط». لم يظهر أي إخراج في Console.
- هذه نتائج سلوك الزائر غير المسجل فقط؛ لم نختبر تسجيل دخول المالك أو مدير/عضو فعليين في صفحة البوابة، ولا أي RPC مصادق أو رسالة بريد حقيقية. سيبقى التسجيل العام مغلقاً حتى إتمام UAT.
