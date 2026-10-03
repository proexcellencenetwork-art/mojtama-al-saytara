# قائمة اختبار الأمان وRLS — مجتمع السيطرة

> **حالة 3 أكتوبر 2026:** شُغّل `setup.sql` واختبار [`tests/rls_security_smoke.sql`](tests/rls_security_smoke.sql) بنجاح على PostgreSQL محلي مؤقت مع تفعيل RLS لمحاكاة Storage، وتراجعت المعاملة ثم حُذفت قاعدة الاختبار. **لم يُشغّل هذا الاختبار على قاعدة Supabase الحية، ولم تُختبر جلسات JWT حقيقية أو Edge Functions.** نتائج HTTP الحي المحدودة موثقة في [`docs/security-live-audit.md`](../docs/security-live-audit.md). نفّذ بقية هذه القائمة في مشروع اختبار منفصل؛ لا تستخدم حسابات أعضاء حقيقية أو بيانات مرضى. لا تلصق JWT أو مفاتيح في تذكرة/رسالة أو Git.

## أ. تجهيز حسابات الاختبار

1. أنشئ خمس حسابات منفصلة من الموقع أو Supabase Auth:
   - `member-a@example.test` و`member-b@example.test`: عضوان عاديان، بلا أدوار إضافية.
   - `verified@example.test`: موثّق.
   - `moderator@example.test`: مشرف.
   - `admin@example.test`: مدير.
2. أكمل تأكيد البريد وسجّل الدخول مرة واحدة بكل حساب، حتى يعمل مشغّل إنشاء الملف/دور `member`.
3. من SQL Editor (مالك قاعدة البيانات فقط) أضف أدوار الحسابات الاختبارية التالية، مع استبدال العناوين بما تملكه فعلياً. لا تمنح `member-a` أو `member-b` دوراً إضافياً:

   ```sql
   insert into public.user_roles (user_id, role, granted_by)
   select id, 'verified'::public.app_role, id from auth.users
   where lower(email) = lower('verified@example.test')
   on conflict (user_id, role) do nothing;

   insert into public.user_roles (user_id, role, granted_by)
   select id, 'moderator'::public.app_role, id from auth.users
   where lower(email) = lower('moderator@example.test')
   on conflict (user_id, role) do nothing;

   insert into public.user_roles (user_id, role, granted_by)
   select id, 'manager'::public.app_role, id from auth.users
   where lower(email) = lower('admin@example.test')
   on conflict (user_id, role) do nothing;
   ```

4. سجّل الخروج والدخول مجدداً بكل حساب ذي دور جديد. استخدم نافذة/ملف متصفح خاصاً لكل شخصية. لا ترفع صوراً أو سجلات حقيقية.
5. عند اختبار REST اختياريّاً، استخرج JWT محلياً من التخزين في المتصفح بعد تسجيل الدخول إلى حساب الاختبار نفسه. في أدوات المطور → Console:

   ```js
   const entry = Object.entries(localStorage).find(([key]) => key.endsWith('-auth-token'));
   JSON.parse(entry?.[1] ?? '{}').access_token;
   ```

   انسخ الرمز محلياً فقط إلى متغير بيئتك، ولا تطبعه في سجل CI أو تشاركه. استخدم Project URL ومفتاح `anon`/`publishable` العام؛ لا تستخدم مفتاح الخدمة في هذه الاختبارات.

## ب. اختبار منع النشر على العضو العادي

1. باستعمال جلسة `member-a`، حاول إنشاء منشور `visibility=public` عبر POST إلى `/rest/v1/posts`، مع body مثل:

   ```json
   {"author_id":"<MEMBER_A_UUID>","body":"اختبار صلاحية داخلي فقط","visibility":"public"}
   ```

2. **المتوقع:** لا يُنشأ صف. قد يعيد PostgREST `400`/`403` مع رفض قاعدة البيانات النشر للأعضاء غير الموثّقين. إعادة إرسال الطلب مع `visibility=members` لا تمنح العضو صلاحية.
3. باستعمال جلسة `verified`، أرسل منشوراً تجريبياً عاماً أو للأعضاء. **المتوقع:** يسمح به إذا لم تتجاوز حد خمسة منشورات خلال 24 ساعة؛ يظل المنشور خاضعاً لمراجعة المحتوى.

## ج. اختبار عزل الرسائل الخاصة

1. اجعل `member-a` و`verified` اتصالين مقبولين عبر صفحة الاتصالات. أرسل رسالة تجريبية بينهما من صفحة **الرسائل**؛ ستنشئ الواجهة محادثة canonical ثم تحفظ الرسالة.
2. سجّل دخول `member-b`، ونفّذ GET إلى `/rest/v1/messages?select=id,conversation_id,sender_id,recipient_id,body&conversation_id=eq.<CONVERSATION_UUID>` مستخدماً JWT الخاص بـ`member-b`.
3. **المتوقع:** لا تظهر أي رسالة غير مشارك فيها `member-b`. غالباً يكون الرد `200` مع مصفوفة فارغة `[]` بسبب RLS؛ الرد الفارغ نجاح للاختبار وليس تسريباً.

## د. اختبار طلبات ووثائق التوثيق الخاصة

1. أرسل من `member-a` طلب توثيق بمستند اصطناعي/غير حساس من نوع PDF أو صورة. يجب أن يُحفظ في bucket خاص `verification-private` وتحت المسار `<MEMBER_A_UUID>/<file>`.
2. بصفحة/جلسة `member-b`، اطلب `/rest/v1/verification_requests?select=id,user_id,status&user_id=eq.<MEMBER_A_UUID>`.
3. **المتوقع:** لا تظهر طلبات `member-a` إلى `member-b` (`[]`)، بينما يرى `member-a` بيانات طلبه فقط.
4. اختبر محاولة رفع ملف في مجلد `member-a` باستخدام JWT `member-b` إلى `/storage/v1/object/verification-private/<MEMBER_A_UUID>/test.pdf`.
5. **المتوقع:** يرفض Storage الرفع. يسمح فقط بإنشاء الملف للمالك داخل مجلده ذي مستوى واحد؛ المسارات المتداخلة لا تطابق السياسة.
6. اختبر قائمة/قراءة مستند `member-a` بحساب `member-b`؛ **المتوقع رفض/لا نتيجة**. اختبر المستند المعلّق بحساب moderator ثم manager؛ يحق لهما القراءة بعد تسجيل الدخول. أداة الإشراف تستخدم رابطاً موقعاً قصير العمر؛ عند قبول/رفض الطلب يضاف المسار إلى `verification_cleanup_queue`، ويُحذف فعلياً عند إعداد webhook والوظيفة.

## هـ. اختبار منع ترقية الذات وتغيير حالة التوثيق

من جلسة `member-a` جرّب عبر REST، ولا تعتمد على إخفاء الأزرار في الواجهة:

1. `PATCH /rest/v1/user_roles?user_id=eq.<MEMBER_A_UUID>&role=eq.member` مع body `{"role":"manager"}`.
2. `POST /rest/v1/user_roles` مع body `{"user_id":"<MEMBER_A_UUID>","role":"manager"}`.
3. بعد تقديم طلب توثيق، `PATCH /rest/v1/verification_requests?id=eq.<OWN_REQUEST_UUID>` مع body `{"status":"approved","reviewer_id":"<MEMBER_A_UUID>"}`.

**المتوقع:** لا يتغير أي دور أو حالة. الرفض قد يظهر `403` أو trigger error أو `200 []`؛ تحقق من القيم النهائية بحساب المدير. لا يستطيع العضو منح نفسه دور `verified` أو اعتماد طلبه. يمر قرار التوثيق الرسمي حصراً عبر RPC `review_verification_request` للمشرف/المدير، مع تسجيل المراجع ومنح الدور في المعاملة نفسها.

## و. اختبار حد الرسائل الخاص

1. ابدأ بحساب `member-a` جديد بلا رسائل خلال آخر 24 ساعة، واجعل اتصاله بـ`member-b` مقبولاً. افتح صفحة الرسائل.
2. أرسل 15 رسالة اختبارية قصيرة إلى `member-b`.
3. أرسل الرسالة رقم 16 خلال 24 ساعة.
4. **المتوقع:** تقبل أول 15 ويُرفضت السادسة عشرة بواسطة مشغّل قاعدة البيانات، وتعرض الواجهة رسالة حد المعدل؛ يبقى حد العضو **15 رسالة لكل 24 ساعة**. جرّب حساب `verified` منفصلاً: الحد الأعلى له **40 رسالة لكل 24 ساعة**.

## ز. تحقق إيجابي للأدوار الإشرافية

- يظهر للمشرف والمدير طابور البلاغات وطلبات التوثيق الحقيقية فقط. اعتماد طلب عبر الواجهة يستدعي RPC آمنة؛ رفض الطلب يتطلب سبباً.
- بعد اعتماد طلب اختبار، تصبح حالة الطلب `approved` ويظهر دور `verified` لصاحبه؛ لا تمنح الواجهة أدواراً مباشرة.
- قرار البلاغ يغيّر الحالة عبر RLS، ويثبت trigger في قاعدة البيانات هوية المراجع ووقت الإنهاء. عضو عادي لا يرى طابور الآخرين ولا يحدّثه.
- تعرض صفحة المدير أدوار المنصة للقراءة. الإعداد الأول لدور المدير يتم من SQL Editor كما في README، لا من الواجهة.

## نتيجة التنفيذ

دوّن تاريخ الاختبار وإصدار الترحيلات، الحسابات التي اختُبرت (من دون عناوين أو رموز دخول في مستند عام)، وسلوك كل طلب. إذا قبلت قاعدة البيانات عملية يفترض منعها، أوقف الإطلاق ولا تجمع بيانات أعضاء حتى مراجعة سياسات RLS/Storage وإصلاحها وإعادة الاختبار. SQL Editor يعمل عادة بدور مالك/مدير ويتجاوز RLS في الاستعلامات العادية؛ لذلك استخدم سكربت الاختبار الذي يبدّل الدور والـ claims مؤقتاً، ثم أثبت النتيجة أيضاً من الموقع أو REST بجلسة مستخدم عادية.
