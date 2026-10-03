# مجتمع السيطرة — دليل الإعداد من الصفر

مجتمع مهني عربي للمهنيين الصحيين. الواجهة مبنية بـ React وVite وTypeScript، وتدعم Supabase Auth وPostgreSQL مع RLS وStorage وRealtime. الموقع المنشور على GitHub Pages متصل الآن بمشروع Supabase حي، ويسمح بالتسجيل بالبريد مع تأكيد البريد. تفعيل Google واختبارات الإطلاق النهائية ما زالت مطلوبة قبل فتح التسجيل للجمهور.

> **حدود الاختبار بوضوح (2 أكتوبر 2026):** اجتازت الواجهة فحوص lint والبناء، واختُبرت محلياً على PostgreSQL 16 مع محاكاة Auth وStorage، بما يشمل RLS وحدود الرسائل والمنشورات والمراجعة الذاتية. طُبّق `setup.sql` على مشروع Supabase الحالي، وأكد استعلام قراءة فقط وجود الجداول الأساسية السبعة، والـ bucket الخاص `verification-private`، ومشغّل إنشاء الملف الشخصي، وRLS للجداول الأساسية وStorage. كما فُتح الموقع المنشور بلا لافتة وضع تجريبي أو أخطاء في Console. **لم أختبر إرسال بريد أو استعادة كلمة مرور حقيقيين، أو Google OAuth، أو RLS بجلسات JWT مستقلة، أو سكربت smoke test على قاعدة حية، أو وظائف Edge.** لا تُعد تشغيل `setup.sql` على هذا المشروع؛ أكمل البنود أدناه قبل استقبال الجمهور.

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
3. شغّل الملف مرة واحدة فقط على المشروع الجديد والفارغ. هو يجمع الترحيلات `001` إلى `013` بترتيبها داخل معاملة واحدة. **لا تشغّل seed معه ولا تلصقه مرة ثانية على مخطط مطبّق.**
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

الشيفرة تعرض زر **المتابعة بحساب Google** في صفحتي الدخول والتسجيل عند ربط Supabase. تحتاج تفعيل المزود يدوياً في حسابيك Google وSupabase:

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

## 7. تعيين أول مدير

1. سجّل حسابك عبر البريد أو Google من الموقع، وأكّد البريد إن طُلب ذلك.
2. افتح **Supabase → SQL Editor → New query**. استبدل البريد التالي بالبريد المطابق لحسابك، ثم شغّل:

   ```sql
   insert into public.user_roles (user_id, role, granted_by)
   select id, 'manager'::public.app_role, null
   from auth.users
   where lower(email) = lower('you@example.com')
   on conflict (user_id, role) do nothing;
   ```

3. تحقق من النتيجة:

   ```sql
   select u.email, r.role
   from auth.users u
   join public.user_roles r on r.user_id = u.id
   where lower(u.email) = lower('you@example.com');
   ```

4. سجّل الخروج ثم ادخل مجدداً لتحديث الدور في الموقع.

العضو العادي لا يستطيع إدراج دور أو تغيير دوره أو حالة طلب توثيقه بنفسه؛ تعيين أول مدير بهذا الاستعلام يتم بصلاحية مالك المشروع في SQL Editor.

**علامة النجاح:** يظهر `manager` بجوار بريدك في نتيجة الاستعلام وتظهر لك صفحة لوحة المدير بعد تسجيل الدخول مرة أخرى.

## 8. اختبار الأمان قبل استقبال أعضاء

اقرأ القائمة الكاملة [`supabase/SECURITY_TEST_CHECKLIST.md`](supabase/SECURITY_TEST_CHECKLIST.md). لملخص الاختبار:

1. أنشئ حسابات اختبار منفصلة: `member-a` و`member-b` عاديان، و`verified`، و`moderator`، و`manager`. لا تستخدم بيانات أشخاص حقيقيين.
2. سجّل بـ`member-b` وارفع ملف PDF أو صورة **وهمية** وأرسل طلب توثيق معلقاً. هذا يتيح لسكربت الاختبار التحقق من خصوصية ملف فعلي.
3. افتح [`supabase/tests/rls_security_smoke.sql`](supabase/tests/rls_security_smoke.sql)، واستبدل عناوين البريد التجريبية الخمسة بعناوين حساباتك، ثم الصق الملف كاملاً في SQL Editor واضغط **Run**. يعمل داخل معاملة ثم ينفذ `ROLLBACK`؛ لا يحفظ رسائل أو حسابات الاختبار التي ينشئها.
4. المتوقع في النهاية ظهور رسالة نجاح عربية تؤكد أن العضو لم يستطع النشر العام أو قراءة بيانات خاصة أو تعديل الأدوار/التوثيق أو قبول اتصاله وعضوية المجموعة الخاصة بنفسه، وأن المشرف لم يستطع اعتماد طلبه بنفسه، وأن المؤلف لم يستطع استعادة محتوى أخفاه المشرف، وأن المستلم لم يستطع إعادة كتابة وقت القراءة أو محتوى الرسالة، وأن حذف حساب المشرف الاختباري لم يحذف سجل التدقيق ولم يفشل، وأن الرسالة رقم 16 رُفضت بعد 15 رسالة خلال 24 ساعة **حتى عندما حاول السكربت تمرير تاريخ قديم مزيف**.
5. أكمل اختبارات الموقع/REST في القائمة: جلسة العضو لا ترى رسائل غيرها، ولا تقرأ طلبات أو وثائق الآخرين؛ المالك يرفع داخل مساره فقط؛ المشرف والمدير يقرآن الوثيقة؛ والمستخدم الموثق يستطيع النشر وفق الحد المقرر.

السكربت يبدّل PostgreSQL مؤقتاً إلى دور `authenticated` مع claims محلية اصطناعية، ويختبر السياسات على PostgreSQL. **ليس اختباراً لاتصال JWT/HTTP الفعلي ولا بديلاً عن إعادة الاختبار على مشروع Supabase الحي.** يجب إيقاف الإطلاق إذا قبل المشروع الحي عملية يفترض منعها.

**علامة النجاح:** رسالة النجاح في SQL، ثم نجاح سيناريوهات القائمة من الموقع أو REST بجلسات الحسابات المنفصلة. لا تسجّل JWT أو مفاتيح الدخول في Git أو رسائل.

## 9. وظائف Edge الاختيارية

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

## حالة الربط الحالية

- **فحص حي للتهيئة (3 أكتوبر 2026):** يسمح Supabase بتسجيل البريد ويطلب تأكيده؛ Google غير مفعّل. صفحات `/feed/` و`/admin/` تعيدان الزائر غير المسجل إلى الدخول. قراءات REST العامة المحددة أعادت `[]`، لكن ذلك لا يختبر عزل صفوف موجودة بين مستخدمين مسجلين.
- **اختبار محلي:** `setup.sql` و`rls_security_smoke.sql` نجحا على PostgreSQL محلي مؤقت مع تراجع المعاملة وحذف قاعدة الاختبار. هذا لا يعادل اختبار JWT/HTTP بحسابات حقيقية على Supabase. التفاصيل في [تقرير التدقيق الأمني الحي](docs/security-live-audit.md) و[قائمة اختبار RLS](supabase/SECURITY_TEST_CHECKLIST.md).
- **غير مكتمل:** خدمة البريد لم تُختبر، وGoogle غير مفعّل، ولم يُنشأ حساب المالك أو يرقَّ إلى مدير. زر Google يظهر في الموقع لكن لا يعمل ما لم يُفعّل المزود.
- **وظائف Edge:** كلا الاسمين `delete-account` و`cleanup-verification-files` أعادا `404` عند فحص HTTP غير المصادق عليه؛ لم تُنفّذ عمليات حذف ولم تُنشر الوظائف من هذه البيئة. يجب نشرهما واختبارهما في بيئة تطوير منفصلة.
- **متغيرات GitHub:** تعذرت قراءتها عبر CLI بسبب `403 Resource not accessible by integration`؛ لا نستنتج من ذلك أنها موجودة أو غائبة. يجب فحصها يدوياً من إعداد المستودع.

## قائمة ما تبقى قبل فتح التسجيل للجمهور

1. اختبر التسجيل وتأكيد البريد واستعادة كلمة المرور بصندوق بريد تملكه، واضبط SMTP موثوقاً قبل استقبال أعضاء جدد.
2. أنشئ Google OAuth Client، وأدخل Client ID وClient Secret مباشرة في إعدادات مزود Google في Supabase، ثم اختبر العودة للموقع.
3. أنشئ حساب المالك من صفحة التسجيل، وشغّل استعلام ترقية أول مدير في القسم 7 باستخدام بريد ذلك الحساب.
4. نفّذ `rls_security_smoke.sql` واختبارات الموقع/REST بحسابات اختبار منفصلة وفي مشروع اختبار مخصص؛ لا تشغّل السكربت على مشروع الإنتاج الحالي لأنه يتطلب حسابات ووثيقة اختبار.
5. تحقق من نشر وظائف Edge؛ إن لم تكن منشورة، انشرها واضبط `CLEANUP_WEBHOOK_SECRET` وDatabase Webhook لتنظيف الوثائق، ثم اختبرهما على حساب تطوير فقط. لا ترسل `service_role` أو كلمة مرور قاعدة البيانات لأحد.
6. جهّز سياسة خصوصية وشروط استخدام وتدفق الإبلاغ والإشراف وخطة الاستجابة لطلبات حذف/تصدير البيانات. لا ترفع بيانات مرضى أو وثائق حقيقية إلى بيئة الاختبار.

## مراجع Supabase الرسمية

- [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Edge Functions deployment](https://supabase.com/docs/guides/functions/deploy)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
