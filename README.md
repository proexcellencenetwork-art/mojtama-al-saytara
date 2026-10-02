# مجتمع السيطرة — دليل الإعداد من الصفر

مجتمع مهني عربي للمهنيين الصحيين. الواجهة مبنية بـ React وVite وTypeScript، وتدعم Supabase Auth وPostgreSQL مع RLS وStorage وRealtime. الموقع المنشور على GitHub Pages يعمل حالياً بوضع التجربة إلى أن تضيف أنت إعدادات مشروعك.

> **حدود الاختبار بوضوح:** بنيت الواجهة مع GitHub Pages path `/mojtama-al-saytara/`، واجتزت فحوص lint والبناء. شغّلت ملف `setup.sql` على PostgreSQL 16 محلي مع مخططين محليين مبسطين يحاكيان Supabase Auth وStorage؛ واختبرت مشغّل إنشاء الحساب وسياسات RLS وحد الرسائل بسجلات اصطناعية. **لم يُطبّق هذا على مشروع Supabase حي، ولم أختبر إرسال بريد حقيقي أو Google OAuth أو خدمة Storage الحية.** يلزم إكمال الإعداد والاختبار أدناه قبل فتح التسجيل للعامة.

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
3. شغّل الملف مرة واحدة فقط على المشروع الجديد والفارغ. هو يجمع الترحيلات `001` إلى `007` بترتيبها داخل معاملة واحدة. **لا تشغّل seed معه ولا تلصقه مرة ثانية على مخطط مطبّق.**
4. رسالة النجاح المتوقعة: انتهاء التشغيل من دون سطر `ERROR` (قد تظهر رسائل `NOTICE` عادية أثناء إنشاء المشغّلات). إذا ظهر خطأ، سجّل نص الخطأ ورقم السطر؛ لا ترسل أي مفاتيح أو كلمات مرور.
5. الملف [`supabase/seed/seed.sql`](supabase/seed/seed.sql) منفصل ومكتوب عليه **للتجربة فقط**. لا تشغّله على مشروع حي أو إنتاجي.

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

   التطبيق يستخدم `HashRouter` لمسارات الصفحات الداخلية، وPKCE لرمز العودة؛ رابط العودة هو جذر الموقع مع `flow` ثم يحوّل التطبيق المستخدم إلى الصفحة المناسبة.

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
4. المتوقع في النهاية ظهور رسالة نجاح عربية تؤكد أن العضو لم يستطع النشر العام أو قراءة بيانات خاصة أو تعديل الأدوار/التوثيق، وأن الرسالة رقم 16 رُفضت بعد 15 رسالة خلال 24 ساعة.
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
- يستخدم Vite الأساس `/mojtama-al-saytara/` و`HashRouter` للصفحات الداخلية. مصدر HTML هو `src/index.html`، وملفات الجذر و`assets/` ملفات بناء يولدها workflow لإعداد Pages الحالي؛ لا تعدّلها يدوياً.
- عند غياب متغيرات Supabase أو عدم صلاحيتها، تظهر لافتة وضع التجربة ولا تنهار الصفحة. وضع التجربة يستخدم حالة متصفح محلية للعرض فقط ولا يكتب بياناتها إلى قاعدة حية.

## قائمة ما تبقى قبل فتح التسجيل للجمهور

1. أنشئ مشروع Supabase وشغّل `setup.sql` مرة واحدة.
2. أضف متغيري GitHub Actions `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`، ثم أعد النشر وتأكد من اختفاء لافتة التجربة.
3. فعّل البريد واضبط Site URL وروابط العودة، ثم اختبر التأكيد والاستعادة مع SMTP موثوق.
4. اضبط Google Cloud وفعّل المزود في Supabase، ثم اختبر تسجيل Google فعلياً.
5. عيّن أول مدير وشغّل SQL smoke test واختبارات الموقع/REST على حسابات اختبار.
6. انشر Edge Functions فقط عند الحاجة، واضبط webhook وسر التنظيف واختبر الحذف على حساب تطوير.
7. جهّز سياسة خصوصية وشروط استخدام، وتدفق الإبلاغ والإشراف، وخطة الاستجابة لطلبات حذف/تصدير البيانات. لا ترفع بيانات مرضى أو وثائق حقيقية إلى بيئة الاختبار.

## مراجع Supabase الرسمية

- [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Edge Functions deployment](https://supabase.com/docs/guides/functions/deploy)
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
