# مجتمع السيطرة — دليل الإعداد من الصفر

مجتمع مهني عربي للمهنيين الصحيين. الواجهة مبنية بـ React وVite وTypeScript، وتدعم Supabase Auth وPostgreSQL مع RLS وStorage وRealtime. يتطلب تدفق الإنتاج تأكيد البريد ثم موافقة المالك أو المدير قبل الوصول إلى بيانات الأعضاء. طُبّق حاجز الاعتماد وهرمية المالك على Supabase الحي؛ التسجيل العام مغلق، والدخول متاح للحسابات المدعوة.

> **حدود الاختبار بوضوح (4 أكتوبر 2026):** طُبقت migrations بوابة الاعتماد وتضييق anon وهرمية المالك على Supabase الحي. هناك مالك أول واحد معتمد وحساب واحد ما زال pending؛ صلاحيات الكتابة المباشرة على جدول الأدوار والقراءة المباشرة لجداول المالك مرفوضة. نُشرت الوظائف الثلاث `delete-account` و`cleanup-verification-files` و`owner-invite`، وأعاد طلب غير مصادق `401` إلى دالتي الدعوة والحذف. **لم يُختبر تسجيل الدخول للمالك، أو تسليم بريد فعلي، أو عزل بيانات مستخدمين عبر جلستي JWT مستقلتين، أو Webhook التنظيف والحذف على حساب تجريبي.** غيّر كلمة مرور البريد التي ظهرت سابقاً، ولا تستخدمها لدخول المالك. لا تُعد تشغيل `setup.sql` أو bootstrap على المشروع الحي.

## 1. ما تحتاجه

1. حساب GitHub لديه صلاحية تعديل مستودع [`proexcellencenetwork-art/mojtama-al-saytara`](https://github.com/proexcellencenetwork-art/mojtama-al-saytara).
2. حساب Supabase ومشروع جديد. اختر منطقة قريبة من جمهورك؛ اختر المنطقة نفسها التي ستضع فيها بيانات المجتمع، لأن تغييرها لاحقاً يتطلب ترحيلاً منفصلاً.
3. احفظ كلمة مرور قاعدة البيانات التي تختارها في مدير كلمات مرور خاص بك. **لا ترسلها لي، ولا تحتاج إلى وضعها في الموقع أو GitHub.**
4. لتسجيل Google، ستحتاج أيضاً حساب Google Cloud تستطيع منه إنشاء OAuth Client.

## 2. إنشاء مشروع Supabase

1. افتح [لوحة Supabase](https://supabase.com/dashboard) واضغط **New project**.
2. اختر المؤسسة، واكتب اسماً للمشروع، واختر المنطقة الأقرب لمستخدميك. أنشئ كلمة مرور قوية لقاعدة البيانات واحفظها بنفسك في مدير كلمات المرور.
3. انتظر حتى تظهر حالة المشروع **Healthy/Active**.
4. افتح **Project Settings → API** أو صفحة **API Keys**، وانسخ فقط:
   - **Project URL**: عنوان ينتهي عادةً بـ `.supabase.co`.
   - **anon public key** القديم أو **publishable key** العام الجديد.

> **لا تشارك أبداً** كلمة مرور قاعدة البيانات، أو `service_role`، أو أي `secret key`، أو كلمة مرور Google. المطلوب للموقع هو Project URL والمفتاح العام فقط.

**علامة النجاح:** ترى صفحة مشروع Supabase بحالة نشطة، ومعك القيمتان محفوظتان محلياً دون إرسالهما لأحد.

## 3. إنشاء الجداول والسياسات

1. افتح الملف [`supabase/setup.sql`](supabase/setup.sql) من المستودع، وانسخ محتواه كاملاً.
2. في Supabase افتح **SQL Editor → New query**، الصق النص كاملاً، ثم اضغط **Run**.
3. شغّل الملف مرة واحدة فقط على مشروع جديد وفارغ. يجمع الترحيلات `001` إلى `016` داخل معاملة واحدة. للمشروع الموجود الذي طُبّقت عليه `001`–`013` استخدم `supabase/apply-account-approval.sql` لترقيات `014`–`016` فقط؛ المشروع الحالي طُبّقت عليه هذه التغييرات بالفعل. **لا تشغّل أيّاً من الملفين مرة ثانية على مشروع مطبّق، ولا تشغّل seed معه.**
4. رسالة النجاح المتوقعة: انتهاء التشغيل من دون سطر `ERROR` (قد تظهر رسائل `NOTICE` عادية أثناء إنشاء المشغّلات). إذا ظهر خطأ، سجّل نص الخطأ ورقم السطر؛ لا ترسل أي مفاتيح أو كلمات مرور.
5. الملف [`supabase/seed/seed.sql`](supabase/seed/seed.sql) منفصل ومكتوب عليه **للتجربة فقط**. اختُبر تشغيله مرتين في بيئة PostgreSQL محلية؛ لا تشغّله على مشروع حي أو إنتاجي.

ينشئ الإعداد `pgcrypto` إذا لزم، والجداول والفهارس والدوال والمشغّلات وسياسات RLS، ثم ينشئ bucket باسم `verification-private` و`public=false` داخل SQL. الرفع محصور بمالك الحساب داخل مجلده؛ وقراءة ملفات التوثيق محصورة بالمشرف والمدير. يتحقق مشغّل Auth من بيانات الحساب الوصفية، ويُنشئ ملفاً شخصياً ويمنح كل حساب جديد دور `member` فقط. عند التسجيل عبر Google يستخدم الاسم والصورة إن وُجدا (`full_name`/`name` و`avatar_url`/`picture`)، ولا يعتمد أي دور قادم من بيانات المزود.

**علامة النجاح:** ينتهي SQL Editor بلا أخطاء. في **Storage → Buckets** يظهر `verification-private` على أنه **Private**. الملف لا يحتوي بيانات تجريبية للمستخدمين.

## 4. ربط GitHub Pages بإعدادات Supabase العامة

في GitHub افتح المستودع ثم **Settings → Secrets and variables → Actions → Variables → New repository variable**. أضف المتغيرين التاليين بالاسمين حرفياً:

| الاسم | القيمة التي تضعها |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL الذي نسخته من Supabase |
| `VITE_SUPABASE_ANON_KEY` | مفتاح `anon public` أو `publishable` العام |

**حالة هذا المشروع (3 أكتوبر 2026):** تأكد من حزمة الإنتاج أن القيمتين اللتين زوّد بهما المالك مضمنتان؛ لا تحتاج إلى إضافتهما مجدداً الآن. لا يستطيع تكامل GitHub CLI الحالي قراءة المتغيرات أو تعديلها (`403`)، لكن الموقع الحي متصل وليس في وضع التجربة.

ثم افتح **Actions → Deploy to GitHub Pages → Run workflow → Run workflow**، وانتظر اكتمال التشغيل.

الـ workflow يقرأ من GitHub **Variables** (`vars`) فقط؛ لا يحتاج إلى Secrets لهذين المتغيرين. قيم `VITE_*` تظهر في JavaScript المنشور للمتصفح، وهذا طبيعي للمفتاح العام؛ الحماية تكون بسياسات RLS، وليس بإخفاء المفتاح العام. **لا تضف `service_role` أو `secret key` إلى هذه المتغيرات أو إلى الموقع.**

إن غابت إحدى القيمتين أو كانت غير صالحة، لا ينهار الموقع: يبقى في وضع التجربة وتظهر لافتة واضحة. بعد البناء الصحيح تختفي لافتة التجربة وتتحول صفحات البيانات إلى Supabase.

**علامة النجاح:** تشغيل Actions أخضر، وعند إعادة فتح [الموقع](https://proexcellencenetwork-art.github.io/mojtama-al-saytara/) تختفي لافتة «وضع التجربة».

للتشغيل المحلي فقط: انسخ `.env.example` إلى `.env.local` وضع القيمتين فيه. الملفات `.env` و`.env.*` مستثناة من Git، مع إبقاء ملف المثال فقط متاحاً.

## 5. تفعيل البريد، العودة من الروابط، وقوالب البريد

في لوحة Supabase:

1. افتح **Authentication → Providers → Email**، وتأكد من تفعيل البريد وكلمة المرور. اترك **Confirm email** مفعّلاً للإنتاج.
2. افتح **Authentication → URL Configuration** واضبط **Site URL** على الرابط التالي بالضبط:

   ```text
   https://proexcellencenetwork-art.github.io/mojtama-al-saytara/
   ```

3. أضف هذه العناوين إلى **Redirect URLs**؛ كل سطر عنوان مستقل:

   ```text
   https://proexcellencenetwork-art.github.io/mojtama-al-saytara/?flow=confirm
   https://proexcellencenetwork-art.github.io/mojtama-al-saytara/?flow=recovery
   https://proexcellencenetwork-art.github.io/mojtama-al-saytara/?flow=oauth
   http://localhost:5173/?flow=confirm
   http://localhost:5173/?flow=recovery
   http://localhost:5173/?flow=oauth
   ```

   التطبيق يستخدم `BrowserRouter` ومسارات نظيفة، مع `basename` مشتق من `VITE_SITE_URL` للتوافق مع GitHub Pages، ويستخدم PKCE لرمز العودة؛ رابط العودة هو جذر الموقع مع `flow` ثم يحوّل التطبيق المستخدم إلى الصفحة المناسبة.

4. من **Authentication → Email Templates** خصّص **Confirm signup** و**Reset password** بالعربية. اترك `{{ .ConfirmationURL }}` كما هو حتى يحمل رابط التأكيد/الاستعادة رمز Supabase ووجهة العودة.

   **قالب تأكيد مقترح:**
   ```html
   <h2>أهلاً بك في مجتمع السيطرة</h2>
   <p>اضغط الرابط لتأكيد بريدك الإلكتروني ومتابعة التسجيل:</p>
   <p><a href="{{ .ConfirmationURL }}">تأكيد البريد الإلكتروني</a></p>
   <p>إذا لم تنشئ هذا الحساب، فتجاهل الرسالة.</p>
   ```

   **قالب استعادة مقترح:**
   ```html
   <h2>إعادة تعيين كلمة المرور</h2>
   <p>اضغط الرابط الآمن لاختيار كلمة مرور جديدة:</p>
   <p><a href="{{ .ConfirmationURL }}">إعادة تعيين كلمة المرور</a></p>
   <p>إذا لم تطلب ذلك، فتجاهل الرسالة.</p>
   ```

5. أرسل اختباراً إلى بريد تملكه. خدمة البريد الافتراضية محدودة ومناسبة للتجربة فقط؛ اضبط SMTP موثوقاً قبل فتح التسجيل.

**علامة النجاح:** يصل رابط التأكيد، وبعد الضغط يعود إلى الموقع ويسجّل الدخول؛ رابط الاستعادة يفتح نموذج كلمة مرور جديدة.

## 6. إعداد زر المتابعة بحساب Google

Google OAuth **اختياري ومؤجل**؛ تسجيل البريد وكلمة المرور هو مسار الإطلاق المقصود حالياً. عند تفعيل Supabase قد يظهر زر **المتابعة بحساب Google**، لكنه لن يعمل حتى تكمّل الإعداد التالي يدوياً في حسابي Google وSupabase:

1. افتح [Google Cloud Console](https://console.cloud.google.com/)، واختر أو أنشئ مشروعاً، ثم جهّز شاشة الموافقة من **Google Auth Platform → Branding** وأضف بيانات التطبيق المطلوبة. أثناء الاختبار، أضف حسابات الاختبار إلى **Test users** إذا كان التطبيق بحالة Testing.
2. افتح **Google Auth Platform → Clients → Create client → Web application**.
3. في **Authorized JavaScript origins** أضف:
   ```text
   https://proexcellencenetwork-art.github.io
   http://localhost:5173
   ```
4. في **Authorized redirect URIs** الصق **Callback URL الذي تعرضه صفحة مزود Google في Supabase**. شكله غالباً:
   ```text
   https://<PROJECT_REF>.supabase.co/auth/v1/callback
   ```
   استخدم القيمة المعروضة من مشروعك؛ لا تضع رابط GitHub Pages في خانة redirect URI الخاصة بـ Google.
5. انسخ **Client ID** و**Client Secret** من Google Cloud إلى **Supabase → Authentication → Providers → Google**، فعّل Google، ثم احفظ. احتفظ بالسر داخل Google/Supabase فقط؛ لا تضعه في GitHub Variables ولا ترسله لي.
6. تأكد من وجود رابط `?flow=oauth` الخاص بالإنتاج وlocalhost في قائمة Redirect URLs في Supabase (القائمة في الخطوة السابقة).

**علامة النجاح:** الضغط على زر Google يفتح شاشة Google، وبعد الموافقة يعود للموقع وتُفتح الصفحة بعد تسجيل الدخول. لم أختبر هذا التدفق على مزود حي بعد.

## 7. المالك الأول والمديرون

في المشروع الحي الحالي، تم تعيين المالك الأول مرة واحدة من خلال `supabase/bootstrap-initial-owner.sql` بعد تأكيد البريد. لا تشغّل bootstrap مرة أخرى على هذا المشروع: يتعمد الفشل إذا كان للمنصة مالك بالفعل.

عند إعداد مشروع جديد، وبعد تشغيل `setup.sql` وتسجيل حساب المالك وتأكيد بريده:

1. افتح `supabase/bootstrap-initial-owner.sql` واستبدل `OWNER_EMAIL_HERE` بالبريد المؤكد حرفياً.
2. الصق الملف في **Supabase → SQL Editor → New query** واضغط **Run**. لا تلصق كلمة مرور أو JWT أو مفتاحاً سرياً.
3. يتحقق الملف من تأكيد البريد ووجود الملف الشخصي وعدم وجود مالك سابق؛ ثم يعتمد الحساب ويعيّنه مالكاً وحيداً ويسجل ذلك في سجل التدقيق.
4. بعد تسجيل الدخول، يستخدم المالك صفحة `/owner` لدعوة الحسابات وإسناد دور المدير أو سحبه مع سبب مسجل. تعيين الأدوار لم يعد يتم بإدراج مباشر في `user_roles`.

التسجيل العام مغلق في الإنتاج. الدعوة لا تمنح دوراً امتيازياً أو موافقة تلقائياً؛ مشغّل إنشاء الحساب يمنح دور `member` الأساسي فقط، وتبقى الحالة `pending` حتى تأكيد البريد والمراجعة. المالك وحده يسند أو يسحب الأدوار الإدارية العامة (مثل `manager` و`moderator` و`coach`) والإعدادات والدعوات. ويمكن للمدير اعتماد حالة `verified` فقط عبر مراجعة طلب توثيق محدد؛ لا يستطيع إسناد أدوار الموظفين أو الوصول إلى أدوات المالك.

**علامة النجاح المتوقعة:** بعد تسجيل دخول المالك، يفتح `/owner` وتظهر له أدوات المالك؛ لا يستطيع العضو أو المدير فتحها أو تنفيذ RPCs المخصصة للمالك. لم يُختبر تسجيل دخول المالك الحي بعد.

## 8. اختبار الأمان قبل استقبال أعضاء

اقرأ القائمة الكاملة [`supabase/SECURITY_TEST_CHECKLIST.md`](supabase/SECURITY_TEST_CHECKLIST.md). لملخص الاختبار:

1. أنشئ حسابات اختبار منفصلة: `member-a` و`member-b` عاديان، و`verified`، و`moderator`، و`manager`. لا تستخدم بيانات أشخاص حقيقيين.
2. سجّل بـ`member-b` وارفع ملف PDF أو صورة **وهمية** وأرسل طلب توثيق معلقاً. هذا يتيح لسكربت الاختبار التحقق من خصوصية ملف فعلي.
3. افتح [`supabase/tests/rls_security_smoke.sql`](supabase/tests/rls_security_smoke.sql)، واستبدل عناوين البريد التجريبية الخمسة بعناوين حساباتك، ثم الصق الملف كاملاً في SQL Editor واضغط **Run**. يعمل داخل معاملة ثم ينفذ `ROLLBACK`؛ لا يحفظ رسائل أو حسابات الاختبار التي ينشئها.
4. المتوقع في النهاية ظهور رسالة نجاح عربية تؤكد أن العضو لم يستطع النشر العام أو قراءة بيانات خاصة أو تعديل الأدوار/التوثيق أو قبول اتصاله وعضوية المجموعة الخاصة بنفسه، وأن المشرف لم يستطع اعتماد طلبه بنفسه، وأن المؤلف لم يستطع استعادة محتوى أخفاه المشرف، وأن المستلم لم يستطع إعادة كتابة وقت القراءة أو محتوى الرسالة، وأن حذف حساب المشرف الاختباري لم يحذف سجل التدقيق ولم يفشل، وأن الرسالة رقم 16 رُفضت بعد 15 رسالة خلال 24 ساعة **حتى عندما حاول السكربت تمرير تاريخ قديم مزيف**.
5. أكمل اختبارات الموقع/REST في القائمة: جلسة العضو لا ترى رسائل غيرها، ولا تقرأ طلبات أو وثائق الآخرين؛ المالك يرفع داخل مساره فقط؛ المشرف والمدير يقرآن الوثيقة؛ والمستخدم الموثق يستطيع النشر وفق الحد المقرر.

السكربت يبدّل PostgreSQL مؤقتاً إلى دور `authenticated` مع claims محلية اصطناعية، ويختبر السياسات على PostgreSQL. **ليس اختباراً لاتصال JWT/HTTP الفعلي ولا بديلاً عن إعادة الاختبار على مشروع Supabase الحي.** يجب إيقاف الإطلاق إذا قبل المشروع الحي عملية يفترض منعها.

**علامة النجاح:** رسالة النجاح في SQL، ثم نجاح سيناريوهات القائمة من الموقع أو REST بجلسات الحسابات المنفصلة. لا تسجّل JWT أو مفاتيح الدخول في Git أو رسائل.

## 9. وظائف Edge

تستخدم الوظائف مفاتيح Supabase المميزة على الخادم عبر مفاتيح المنصة المحقونة؛ لا تحتاج إلى نسخ أو طلب `service_role` يدوياً. من جهازك ثبّت Supabase CLI وسجّل الدخول، ثم نفّذ:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```

لحذف ملف التوثيق آلياً بعد استبداله أو قبول/رفض الطلب، ولّد السر المخصص، واحفظه محلياً ثم اضبطه على مشروع Supabase:

```bash
export CLEANUP_WEBHOOK_SECRET="$(openssl rand -hex 32)"
supabase secrets set CLEANUP_WEBHOOK_SECRET="$CLEANUP_WEBHOOK_SECRET"
supabase functions deploy cleanup-verification-files --no-verify-jwt
```

بعد ذلك أنشئ **Database Webhook** لجدول `public.verification_requests` عند حدث `UPDATE`، على رابط:

```text
https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-verification-files
```

وأضف header بالاسم `x-cleanup-secret` والقيمة التي ولّدتها محلياً. لا ترسل هذه القيمة لأي شخص. تتأكد الوظيفة أن الملف موجود في طابور التنظيف ومساره مسجل لصاحبه قبل إزالته.

**الحالة الحية (4 أكتوبر 2026):** الوظائف الثلاث `cleanup-verification-files` (version 1)، و`delete-account` (version 2)، و`owner-invite` (version 1) حالتها `ACTIVE`. يفرض الحذف والدعوة JWT؛ والمالك وحده يستطيع الدعوة. يمنع الحذف حذف حساب المالك قبل لمس ملفاته. POST بلا تفويض إلى `delete-account` و`owner-invite` أعاد `401` ولم يحذف أو يرسل دعوة. لم يُتحقق من السر البعيد أو Database Webhook، ولم تُختبر دعوة مصادق عليها أو عملية حذف على حساب تجريبي.

لنشر دعوات المالك في مشروع آخر بعد تجهيز migration 016:

```bash
supabase functions deploy owner-invite
```

لنشر حذف الحساب بطلب صريح من المستخدم:

```bash
supabase functions deploy delete-account
```

تتحقق هذه الوظيفة من JWT المستخدم وطلب التأكيد، وتحذف ملفات الحساب ثم الحساب نفسه. لا تضف مفاتيح مميزة يدوياً. اختبرها على حساب تطوير فقط لأن الحذف غير قابل للاسترجاع من الواجهة.

**علامة نجاح التنظيف:** اختبار تبديل/اعتماد طلب تجريبي مع webhook يحذف الملف من bucket بعد قرار المشرف. لا تُفعّل الحذف قبل اختباره على حساب تجريبي.

## 10. الموقع والنشر

- الموقع: [https://proexcellencenetwork-art.github.io/mojtama-al-saytara/](https://proexcellencenetwork-art.github.io/mojtama-al-saytara/)
- المستودع: [proexcellencenetwork-art/mojtama-al-saytara](https://github.com/proexcellencenetwork-art/mojtama-al-saytara)
- يستخدم Vite الأساس المستنتج من `VITE_SITE_URL` و`BrowserRouter` بمسارات نظيفة متوافقة مع GitHub Pages. مصدر HTML هو `src/index.html`؛ أما ملفات الجذر و`assets/` وصفحات المسارات فهي مخرجات بناء يولدها workflow؛ لا تعدّلها يدوياً.
- عند غياب متغيرات Supabase أو عدم صلاحيتها، تظهر لافتة وضع التجربة ولا تنهار الصفحة. وضع التجربة يستخدم حالة متصفح محلية للعرض فقط ولا يكتب بياناتها إلى قاعدة حية.

## صفحات البحث والمشاركة

- بعد `vite build` ينشئ `scripts/prerender-pages.mjs` HTML عربياً كاملاً للصفحات العامة: الرئيسية، عن المجتمع، الكوتشنج، ملفات الكوتشات العامة، المقالات المنشورة، الفعاليات العامة القادمة، الأسئلة الشائعة، الخصوصية، الشروط، وميثاق السلوك.
- تُجلب صفحات المقالات والكوتشات والفعاليات من الجداول/العرض العام المسموح به فقط؛ لا تُضمّن الرسائل أو الملفات الشخصية الخاصة أو طلبات التوثيق. كل صفحة داخلية/مصادقة تحمل `noindex`، ولا تُضاف إلى sitemap.
- لكل صفحة عنوان ووصف وcanonical و`hreflang="ar"` وOpen Graph/Twitter وJSON-LD مناسب، مع روابط التنقل وBreadcrumbs مرئية للمستخدم. صور المشاركة والأيقونات أصلية مولّدة محلياً؛ لا تستخدم صور stock.
- ينتج البناء `sitemap.xml` و`robots.txt` و`404.html` وصفحات المسارات الثابتة، ويتحقق منها `scripts/validate-seo-output.mjs` ضمن `npm run build`؛ يمكن إعادة الفحص بعد البناء عبر `npm run test:seo`.
- يقرأ workflow متغير GitHub Actions اختياري `VITE_SITE_URL`؛ إن لم يكن موجوداً يستخدم رابط GitHub Pages الحالي. عند الانتقال لاحقاً إلى نطاق مخصص، حدّث هذا المتغير ليبدأ بـ`https://` ثم أعد النشر. سيُعاد اشتقاق أساس Vite والروابط القانونية وOpen Graph وsitemap، لكن يبقى إعداد DNS/نطاق GitHub Pages وإضافة Redirect URL الجديد في Supabase مطلوبين يدوياً.
- خريطة الموقع بعد النشر: [sitemap.xml](https://proexcellencenetwork-art.github.io/mojtama-al-saytara/sitemap.xml). أرسلها يدوياً في Google Search Console أو Bing Webmaster Tools عند امتلاك الحساب؛ لم يتم التحقق من ملكية النطاق أو طلب الفهرسة.

## الأداء (المرحلة الثانية)

أُضيف Tajawal محلياً بمجموعتي Arabic/Latin وأوزان 400/500/700/800، وأُنشئت صور AVIF/WebP متجاوبة من الرسم الأصلي. صفحات SEO العامة تُقدّم HTML مسبق التوليد بلا React/Supabase، بينما تُحمّل صفحات الدخول والعضوية وحزمة Supabase عند الحاجة. تتضمن الصفحات العامة CSS نقدياً مضمّناً، مع تحميل ورقة الأنماط المحلية قبل الرسم لتجنب قفزات التخطيط. اختبارات بناء GitHub Pages ونطاق مخصص على الجذر نجحت.

بعد النشر، حصلت الرئيسية و«عن المجتمع» على **100/100 في الأداء وإمكانية الوصول وأفضل الممارسات وSEO** في Lighthouse 12.8.2؛ وكان CLS صفراً وLCP بين 1.3 و1.4 ثانية في هذا القياس. هذه عينة مختبرية وليست بيانات ميدانية للزوار، ولا تقيس تسجيل الدخول أو قواعد Supabase. التفاصيل والمنهجية في [تقرير أداء المرحلة الثانية](docs/performance-phase2.md)، ومصادر الخطوط والترخيص في [مراجع الأداء](docs/performance-sources.md).

لإعادة تجهيز الأصول: `npm run fonts:vendor` و`npm run images:optimize`؛ ثم استخدم `npm run build` و`npm run test:seo-fixtures` و`npm run lint` للتحقق. يتطلب توليد الصور FFmpeg.

## حالة الربط الحالية — 4 أكتوبر 2026

| المجال | ما تأكد على الإنتاج | الحد الحالي |
| --- | --- | --- |
| الموقع | نجح [workflow التطبيق 37151383910](https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions/runs/37151383910) و[نشر Pages 37151400542](https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions/runs/37151400542). صفحات `/`, `/login/`, `/register/`, `/feed/`, `/admin/` أعادت 200؛ الزائر أُعيد من الخلاصة والإدارة إلى الدخول. | فحص المسار لا يثبت Auth أو RLS بجلسة مستخدم. |
| إعداد Supabase للواجهة | الحزمة المنشورة تتضمن URL ومفتاح publishable اللذين زوّد بهما المالك؛ لا تظهر لافتة وضع التجربة. | GitHub CLI أعاد 403 عند قراءة/تعديل Variables؛ لا يمكن إدارتهما من CLI هنا، لكنهما يعملان في البناء الحي. |
| بوابة الحساب والمالك | سُجلت migrations `account_approval_gate_20261003` و`anon_policy_scoping_20261003` و`platform_owner_hierarchy_20261004`. يوجد مالك واحد معتمد وحساب واحد `pending`; إعداد تأكيد البريد مفعّل والتسجيل العام مغلق. | لم يُختبر تسجيل دخول المالك أو دورة الاعتماد بالبريد/الواجهة. |
| الأدوار وRLS | يمنع دور `authenticated` من INSERT/UPDATE/DELETE المباشر على `user_roles`، كما لا يقرأ جداول المالك مباشرة. عمليات إدارة الأدوار تتم عبر RPC محمية بالمالك ومدققة. bucket `verification-private` خاص و`public_coaches` يستخدم `security_invoker`. | لا توجد جلستا JWT فعليتان لإثبات عزل الرسائل أو طلبات التوثيق أو الوثائق. |
| Edge Functions | `owner-invite` و`delete-account` و`cleanup-verification-files` كلها `ACTIVE`; owner-invite/delete-account تفرضان JWT. POST بلا JWT أعاد `401` للدعوة والحذف. | سر التنظيف وDatabase Webhook ودعوة مصادق عليها والحذف/التنظيف الفعلي لم تُختبر. |
| اختبارات محلية | `npm run build`, `npm run typecheck`, `npm run lint` نجحت؛ واختبار `account_approval_smoke.sql` نجح في PostgreSQL مؤقتة ثم حُذفت. | محاكاة PostgreSQL لا تحل محل اختبار البريد وJWT/HTTP على Supabase حي. |
| تنبيهات الأمن | صلاحيات الكتابة المباشرة على الأدوار مرفوضة. | Advisor يسجل 18 تحذيراً لدوال `SECURITY DEFINER` المتاحة لـ`authenticated`، وتحذيراً واحداً عن `is_staff` للـ`anon`، و3 معلومات عن جداول داخلية عليها RLS بلا سياسات (deny-by-default)، كما يشير إلى أن فحص كلمات المرور المسرّبة غير مفعّل. لم يُختبر كل RPC عبر JWT حي؛ يلزم مراجعة الإعدادات والحراس قبل فتح التسجيل العام. |

## قائمة ما تبقى قبل فتح التسجيل للجمهور

1. غيّر كلمة مرور البريد التي ظهرت سابقاً، واستخدم استعادة كلمة المرور لاختيار كلمة مرور جديدة وفريدة قبل أول دخول للمالك. لا ترسل كلمة مرور أو JWT.
2. سجّل دخول المالك وافحص `/owner`، ثم ادعُ حسابي اختبار تملكهما. تحقق أن الدعوة لا تمنح دوراً أو اعتماداً تلقائياً، وأن كل حساب يحتاج تأكيد البريد وموافقة قبل الوصول إلى العضوية.
3. من جلستي JWT منفصلتين اختبر عزل الرسائل وطلبات التوثيق ووثائق الآخرين، واستحالة تعديل الدور/حالة الاعتماد، وحد الرسائل اليومي. استخدم ملفات وهمية فقط.
4. اضبط SMTP موثوقاً واختبر التأكيد واستعادة كلمة المرور؛ إعدادات المرسل الافتراضية لا تكفي لإثبات التسليم الإنتاجي.
5. أنشئ `CLEANUP_WEBHOOK_SECRET` في Supabase وأضف Database Webhook مع `x-cleanup-secret`؛ اختبر حذف ملف اصطناعي بعد قرار مراجعة.
6. اختبر `delete-account` على حساب تطوير disposable فقط. لا تختبره بحساب المالك أو ببيانات حقيقية.
7. Google OAuth اختياري ومؤجل، وليس شرطاً لمسار التسجيل بالبريد؛ فعّله لاحقاً فقط بعد إعداد Google Cloud وSupabase واختباره.
8. راجع سياسة الخصوصية والشروط وتدفق الإبلاغ والإشراف وخطة الاستجابة لطلبات حذف/تصدير البيانات قبل فتح التسجيل العام.

## مراجع Supabase الرسمية

- [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Edge Functions deployment](https://supabase.com/docs/guides/functions/deploy)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
