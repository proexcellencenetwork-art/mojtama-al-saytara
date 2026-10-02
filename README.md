# مجتمع السيطرة

مجتمع مهني عربي للمهنيين الصحيين، بواجهة RTL مبنية بـ React وVite وTypeScript. يستخدم المشروع Supabase Auth وPostgres مع RLS وStorage وRealtime، ويمكن نشر الواجهة الثابتة على GitHub Pages.

> **الحالة:** جهّزت الشيفرة لتتصل بمشروع Supabase تملكه أنت. الموقع المنشور يعمل الآن من دون إعدادات Supabase في **وضع التجربة**؛ لا توجد قاعدة بيانات حيّة أو مفاتيح مشروعك في هذا المستودع، ولذلك لم أطبّق الترحيلات على مشروعك ولم أختبرها أمام خدمة Supabase حيّة. نفذت البناء وفحص SQL، وشغّلت الترحيلات محلياً على PostgreSQL 16 مع محاكاة مخططي Auth وStorage. اختبارات RLS المحلية أكدت منع العضو من النشر واعتماد طلبه ورفع ملف شخص آخر، وعزل الرسائل وطلبات/ملفات التوثيق، والسماح برفع المالك ونشر الموثّق وقراءة المشرف للمستند، وحد العضو البالغ 15 رسالة. هذا لا يغني عن قائمة الاختبار على مشروعك الحي.

## 1. المتطلبات

- Node.js 22 أو أحدث، وحساب GitHub.
- حساب Supabase ومشروع جديد؛ لا ترسل مفاتيح المشروع إلى Manus أو تضعها في المستودع.
- للنشر الخادمي الاختياري: Supabase CLI.

## 2. التشغيل المحلي

من مجلد المشروع:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

إن لم تضع قيماً صالحة في `.env.local`، تظهر لافتة واضحة بأن الموقع في وضع تجربة. اختر **استكشف نسخة التجربة** من صفحة الدخول؛ البيانات التجريبية تبقى في المتصفح ولا تُكتب في قاعدة بيانات. لا تمنح قائمة تبديل الأدوار التجريبية صلاحيات حقيقية.

ملف `.env.example` يشرح المتغيرين المطلوبين للمتصفح:

- `VITE_SUPABASE_URL`: عنوان مشروع Supabase.
- `VITE_SUPABASE_ANON_KEY`: مفتاح `anon` القديم أو مفتاح `publishable` العام الحالي. لا تضع هنا مفتاح `service_role` أو أي مفتاح `secret`.

`.env` و`.env.*` مستثنيان من Git، مع استثناء ملفات الأمثلة فقط. لا تحفظ ملف `.env.local` في المستودع.

## 3. إنشاء Supabase وتشغيل قاعدة البيانات

1. أنشئ مشروعاً جديداً من [لوحة Supabase](https://supabase.com/dashboard)، واختر كلمة مرور قوية لقاعدة البيانات واحتفظ بها في مدير كلمات المرور لديك.
2. من **Project Settings → API Keys** أو صفحة واجهة API انسخ **Project URL** ومفتاح `anon`/`publishable` العام فقط. لا نحتاج مفتاح الخدمة في الواجهة، ولا أطلبه منك.
3. شغّل المخطط مرة واحدة على قاعدة بيانات جديدة بإحدى الطريقتين، **ولا تشغّل الطريقتين معاً**:
   - الموصى بها: افتح **SQL Editor → New query**، والصق محتوى [`supabase/setup.sql`](supabase/setup.sql)، ثم نفّذه كاملاً. الملف مجمّع بترتيب الترحيلات داخل معاملة واحدة.
   - أو استخدم Supabase CLI على مشروع جديد: `supabase login` ثم `supabase link --project-ref <PROJECT_REF>` ثم `supabase db push`.
4. عند استخدام الملفات المنفصلة، نفّذها بهذا الترتيب: `202610020001_initial_schema.sql`، ثم `202610020002_policy_hardening.sql`، ثم `202610020003_guest_scope_and_atomic_limits.sql`، ثم `202610020004_integrity_and_storage_scope.sql`، ثم `202610020005_least_privilege_and_booking_rules.sql`، ثم `202610020006_coach_schedule_completion.sql`.
5. الملف `supabase/seed/seed.sql` **للتطوير المحلي فقط**؛ لا تشغّله على الإنتاج. لا تحتاجه لتفعيل حسابات البريد.

الترحيلات تنشئ امتداد `pgcrypto` إذا لزم، وأنواع الأدوار والجداول والفهارس والمشغّلات. وينشئ المشغّل على `auth.users` صفاً تلقائياً في `profiles` ودور `member` لكل حساب جديد.

ينشئ SQL bucket باسم `verification-private` بحد 10 MiB وبأنواع JPG/PNG/WebP/PDF. الـ bucket غير عام؛ يستطيع العضو رفع مستند داخل مجلده ذي المستوى الواحد فقط، بينما تقتصر قراءة الكائنات المرفوعة على المشرف والمدير. يسمح الحذف للمالك من مجلده أو لفريق الإشراف، وتُنظّف الملفات بعد قرار التوثيق عند إعداد Edge Function والـ webhook. لا ترفع بيانات مرضى أو وثائق أشخاص آخرين.

## 4. تفعيل البريد وإعداد روابط العودة

في لوحة Supabase:

1. افتح **Authentication → Providers → Email**، وتأكد من تفعيل البريد وكلمة المرور. اترك **Confirm email** مفعّلاً للإنتاج. يمكن إيقاف التأكيد مؤقتاً للاختبار فقط؛ عندها يُنشأ تسجيل الدخول فوراً. اضبط حداً مناسباً لكلمة المرور؛ الواجهة تشترط 8 أحرف على الأقل.
2. افتح **Authentication → URL Configuration** واضبط **Site URL** على:

   `https://proexcellencenetwork-art.github.io/mojtama-al-saytara/`

3. أضف عناوين العودة التالية إلى **Redirect URLs**. يستخدم التطبيق query parameter آمناً لتوجيه رابط البريد بعد العودة إلى المسار الثابت، ثم ينتقل داخلياً عبر HashRouter:

   ```text
   https://proexcellencenetwork-art.github.io/mojtama-al-saytara/?flow=confirm
   https://proexcellencenetwork-art.github.io/mojtama-al-saytara/?flow=recovery
   http://localhost:5173/?flow=confirm
   http://localhost:5173/?flow=recovery
   ```

   يستخدم GitHub Pages المسار `/mojtama-al-saytara/`، ويتعامل التطبيق مع المسارات عبر `HashRouter`؛ لا حاجة إلى إعداد fallback على الخادم. بعد الحفظ اختبر رسالة التأكيد ورابط استعادة كلمة المرور من المتصفح.
4. في **Authentication → Email Templates** خصّص قوالب **Confirm signup** و**Reset password** بالعربية. أمثلة بسيطة (اترك رابط Supabase كما هو، ولا تضع مفتاحاً في القالب):

   **تأكيد البريد:**

   ```html
   <h2>أهلاً بك في مجتمع السيطرة</h2>
   <p>اضغط الرابط لتأكيد بريدك الإلكتروني ومتابعة التسجيل:</p>
   <p><a href="{{ .ConfirmationURL }}">تأكيد البريد الإلكتروني</a></p>
   <p>إذا لم تنشئ هذا الحساب، فتجاهل الرسالة.</p>
   ```

   **استعادة كلمة المرور:**

   ```html
   <h2>إعادة تعيين كلمة المرور</h2>
   <p>اضغط الرابط الآمن لاختيار كلمة مرور جديدة:</p>
   <p><a href="{{ .ConfirmationURL }}">إعادة تعيين كلمة المرور</a></p>
   <p>إذا لم تطلب ذلك، فتجاهل الرسالة.</p>
   ```

5. أرسل رسائل حقيقية عبر SMTP موثوق عند الإطلاق؛ الإرسال الافتراضي في Supabase مخصص للتطوير ومحدود المعدل. لا تطلق دعوات عامة قبل اختبار التأكيد والاستعادة على بريد تملكه.

يدعم التطبيق التسجيل والدخول والخروج واستعادة كلمة المرور. إذا كانت إعدادات Supabase غائبة أو غير صالحة، لا ينهار التطبيق: يبقى الموقع عاماً ويعرض لافتة وضع التجربة. المسارات الخاصة تنتظر استعادة جلسة Auth ثم تعيد غير المسجل إلى الدخول. بعد ضبط Supabase تُحمّل الخلاصة والملفات والاتصالات والرسائل والمجموعات والإشعارات وطلبات التوثيق والبلاغات من قاعدة البيانات، وتطبق RLS على الخادم. بيانات التجربة لا تُعرض على صفحات المحتوى العامة المتصلة.

## 5. متغيرات بناء GitHub Pages

في مستودع GitHub افتح **Settings → Secrets and variables → Actions → Variables → New repository variable**، وأضف هذين الاسمين حرفياً:

| الاسم | القيمة |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL لمشروع Supabase |
| `VITE_SUPABASE_ANON_KEY` | مفتاح `anon` أو `publishable` العام فقط |

يمكن وضعهما في **Secrets** بدلاً من **Variables**؛ ملف GitHub Actions يقرأ `vars` أولاً ثم `secrets`. أعد نشر workflow بعد إضافتهما: **Actions → Deploy to GitHub Pages → Run workflow**، أو ادفع تغييراً إلى `main`. هذه القيم عامة بطبيعتها داخل JavaScript المنشور، ولذلك تعتمد الحماية على RLS.

**لا تنشئ متغير GitHub اسمه `SUPABASE_SERVICE_ROLE_KEY` ولا تنشر مفتاحاً مميزاً/سرياً.** لا يلزم أن ترسل أي مفتاح إلى Manus.

## 6. تعيين أول مدير

1. سجّل حسابك من الموقع وأكمل تأكيد البريد.
2. من لوحة Supabase → **SQL Editor** نفّذ الاستعلام التالي بعد استبدال البريد ببريد حسابك:

   ```sql
   insert into public.user_roles (user_id, role, granted_by)
   select id, 'manager'::public.app_role, id
   from auth.users
   where lower(email) = lower('admin@example.com')
   on conflict (user_id, role) do nothing;
   ```

3. سجّل الخروج ثم الدخول مجدداً لتحديث الجلسة والواجهة. يمكن تطبيق الاستعلام نفسه على بريد منفصل واحد لتعيين مدير ثانٍ.

لا توجد ترقية ذاتية من واجهة الموقع. تمنع سياسات RLS الأعضاء العاديين من إدراج أدوار لأنفسهم أو تعديل أدوار الآخرين؛ إضافة المدير الأول إجراء مالك قاعدة البيانات أعلاه.

## 7. اختبار RLS وحدود المعدل

نفّذ قائمة الاختبارات المفصلة في [`supabase/SECURITY_TEST_CHECKLIST.md`](supabase/SECURITY_TEST_CHECKLIST.md). جهّز حسابين عاديين مختلفين، وحساباً موثّقاً، ومشرفاً، ومديراً. تتحقق القائمة من منع العضو من النشر، وعزل الرسائل وطلبات/ملفات التوثيق، ومنع تعديل دوره أو حالة توثيقه، وحد الرسائل اليومي (15 للعضو و40 للموثّق/الكوتش/الإشراف). اختبر طلبات API بمستخدم مصادق فعلي؛ لا تستخدم SQL Editor كبديل لاختبار RLS، لأن دور مالك قاعدة البيانات يتجاوز سياسات الصفوف.

## 8. وظائف Edge الاختيارية

تستخدم الوظائف مفاتيح المنصة المضافة تلقائياً إلى بيئة Edge Function، مع دعم `SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` القديمة وخريطة المفاتيح الحالية. **لا حاجة إلى أن تنسخ مفتاح خدمة أو ترسله أو تضعه في الواجهة.** تبقى أي صلاحية مميزة على الخادم فقط.

لربط CLI بمشروعك:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```

لحذف مستند التوثيق آلياً بعد استبداله أو قبول/رفض الطلب:

```bash
export CLEANUP_WEBHOOK_SECRET="$(openssl rand -hex 32)"
supabase secrets set CLEANUP_WEBHOOK_SECRET="$CLEANUP_WEBHOOK_SECRET"
supabase functions deploy cleanup-verification-files --no-verify-jwt
```

من لوحة Supabase أنشئ **Database Webhook** على `public.verification_requests` لحدث `UPDATE`، إلى:

`https://<PROJECT_REF>.supabase.co/functions/v1/cleanup-verification-files`

وأضف HTTP Header اسمه `x-cleanup-secret` بالقيمة نفسها التي ولّدتها أعلاه (تحقق محلياً بـ `printf '%s\n' "$CLEANUP_WEBHOOK_SECRET"` لنسخها إلى إعداد الـ webhook). هذا هو **السر المخصص الوحيد** المطلوب لهذه الوظيفة؛ لا تضف مفتاح خدمة أو `SUPABASE_URL` يدوياً. الوظيفة تتحقق أيضاً أن مسار الكائن مسجل مسبقاً في `verification_cleanup_queue` ومملوك لصاحب الطلب.

لحذف الحساب بطلب صريح من المستخدم، انشر الوظيفة الثانية:

```bash
supabase functions deploy delete-account
```

تتطلب JWT للمستخدم المسجل وطلباً يتضمن `confirm: true`، وتحذف كائنات Storage الخاصة بالطرف نفسه وصفوف طابور التنظيف ثم حساب Auth. **لا تضف أسراراً يدوية لهذه الوظيفة**؛ تستخدم المفاتيح التي تحقنها المنصة. اختبر الحذف على حساب تطوير أولاً؛ فهو غير قابل للاسترجاع من الواجهة.

للتطوير المحلي للوظائف، انسخ `supabase/functions/.env.example` إلى `supabase/functions/.env`، وأضف فقط `CLEANUP_WEBHOOK_SECRET` الاختباري هناك. كلا الملفين المحليين مستثنيان من Git.

## 9. النشر

المستودع هو [proexcellencenetwork-art/mojtama-al-saytara](https://github.com/proexcellencenetwork-art/mojtama-al-saytara)، والموقع:

**https://proexcellencenetwork-art.github.io/mojtama-al-saytara/**

اختر مرة واحدة في GitHub **Settings → Pages → Build and deployment → Source: GitHub Actions**. كل دفع إلى `main` يبني `dist` وينشره؛ يضبط الـ workflow مسار Vite الأساسي ويمرر متغيرات Supabase العامة إن أضفتها. استخدم `HashRouter` للصفحات الداخلية.

## ما يلزمك أنت لإكمال الربط

1. أنشئ مشروع Supabase جديداً، وشغّل `supabase/setup.sql` مرة واحدة على المشروع الجديد.
2. انسخ **Project URL** ومفتاح `anon`/`publishable` العام إلى متغيري GitHub Actions `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`؛ لا ترسل القيم لي ولا تضع مفتاحاً سرياً في الواجهة.
3. اضبط **Authentication → URL Configuration** وموفر البريد وقوالب التأكيد/الاستعادة حسب القسم 4، ثم أعد نشر GitHub Pages من Actions.
4. أنشئ حسابك وأكّد البريد، ثم عيّن أول مدير باستعلام SQL أعلاه.
5. أكمل قائمة [`SECURITY_TEST_CHECKLIST.md`](supabase/SECURITY_TEST_CHECKLIST.md) بحسابات اختبار قبل استقبال أعضاء.
6. اختيارياً فقط، انشر Edge Functions؛ وظيفة تنظيف المستندات تحتاج السر المخصص `CLEANUP_WEBHOOK_SECRET` وإعداد Database Webhook. لا تحتاج أنت إلى تزويدي بمفتاح خدمة.

## 10. الخصوصية والحدود الحالية

- RLS والمشغّلات في Postgres هي حد الصلاحية الحقيقي؛ الواجهة لا تمنح دوراً أو تتجاوز السياسات.
- رسائل الأعضاء لا تظهر إلا لأطراف المحادثة؛ يعتمد الإرسال على الاتصال المقبول أو الدور المخوّل، وتنفذ قاعدة البيانات حدود المعدل.
- المستندات المهنية في bucket خاص، ولا تُقرأ عبر واجهة العضو؛ قراءة التنزيل مخصصة للمشرف/المدير.
- لا تضع معلومات أو صور المرضى، حتى بعد إزالة الأسماء. الكوتشنج لا يستبدل الرعاية أو الاستشارة الطبية أو النفسية.
- لم أختبر الترحيلات أو Auth أو RLS على مشروع Supabase حي لأنك لم تنشئ/تربط مشروعك بعد. يمكن فحص بناء الواجهة وSQL محلياً، لكن يجب إكمال قائمة اختبار الأمان قبل استقبال أعضاء حقيقيين.
- هذه الشيفرة ليست مراجعة امتثال أو استشارة قانونية. جهّز سياسة خصوصية وشروطاً نهائية مناسبة للأنظمة المحلية قبل الإطلاق.

## مرجع التنفيذ

- الواجهة والموجّه: `src/App.tsx`, `src/components/`, `src/design.css`, `src/backend.css`.
- إعداد Supabase الاختياري: `src/lib/supabase.ts`, `.env.example`.
- ستة ترحيلات مرتبة: `supabase/migrations/`؛ نسخة لصق موحدة: `supabase/setup.sql`.
- حسابات وأمثلة محلية: `supabase/seed/seed.sql` (**تطوير فقط**).
- تنظيف المستندات وحذف الحساب: `supabase/functions/`.
