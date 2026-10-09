# تشغيل مركز التعلّم والورش الحيّة — دليل إعداد عربي

## الحالة الحالية

نُشرت واجهة مركز التعلّم وغرفة تفاعلية كمسارات خاصة `noindex` على [الموقع](https://proexcellencenetwork-art.github.io/mojtama-al-saytara/learning/)؛ ويمكن فتح تبويب المكتبة مباشرة عبر [رابط مكتبة التسجيلات](https://proexcellencenetwork-art.github.io/mojtama-al-saytara/learning/#library). يشمل التطبيق migration 017 وسياسات RLS وأربع وظائف Edge. **تُطبّق migration 017 وmigration 018 على Supabase الإنتاجي بالفعل**؛ تحققت قراءةً فقط من وجود الجداول الأربعة وتفعيل RLS ومنع دور `authenticated` من القراءة المباشرة لمعرفات الغرف والتسجيلات وسجلات webhook. أزالت migration 018 تنفيذ `public.is_staff(uuid)` عن `anon` وأبقت `authenticated` مخولاً لاستخدامه في سياسات RLS. الوظائف الأربع `learning-room`, `learning-token`, `learning-playback`, `learning-webhook` نشطة في الإنتاج؛ أعاد اختبار POST بلا JWT أو secret الرمز `401` لكل منها. تحقق المتصفح الفعلي أن `/learning/` ورابط غرفة ديناميكي يعيدان الزائر غير المسجل إلى `/login`. تحقق الإصدار المنشور من كود تحميل تبويب `#library`، لكن لم تُختبر المكتبة بجلسة عضو حقيقية. لم تُنشأ موارد 100ms أو تُضف أسرارها؛ لذلك لا يعمل البث بعد. التسجيل العام ما زال مغلقاً، وتظل جاهزية فتحه **NO-GO** حتى استكمال إعداد المزود والاختبارات.

البث المقترح يستخدم 100ms للتواصل التفاعلي داخل المتصفح، مع تسجيل خاص يديره المزود. تعتمد الكلفة والإتاحة على خطة 100ms والإعدادات الحالية؛ راجع لوحة المزود والتسعير قبل أول بث. لا تُدخل أي بيانات مرضى أو تفاصيل تعريفية عنهم في محادثة الورشة.

## 1. حالة قاعدة البيانات

في المشروع الحي الحالي اكتمل تطبيق `20261004020648_learning_center_20261004` بالفعل. **لا تشغّل migration أو `setup.sql` مرة أخرى على هذا المشروع.** للتحقق، افتح **Supabase → SQL Editor** ونفّذ استعلام قراءة:

داخل **Supabase → SQL Editor**:

```bash
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('learning_workshops','learning_provider_rooms','learning_recordings','learning_provider_events')
order by table_name;
```

**علامة النجاح:** تظهر أربعة صفوف بأسماء الجداول أعلاه. تم التحقق منها في قاعدة الإنتاج؛ وتبين فحص الصلاحيات أن الجداول الثلاثة الداخلية `learning_provider_rooms`, `learning_recordings`, `learning_provider_events` لا تُقرأ مباشرة من دور `authenticated`. للمشروع الجديد فقط استخدم `supabase/setup.sql` مرة واحدة على قاعدة فارغة؛ فهو يجمع migrations 001–018.

## 2. تجهيز تطبيق 100ms

1. أنشئ/اختر Workspace وApp في [لوحة 100ms](https://dashboard.100ms.live/). لا ترسل مفاتيح التطبيق في الدردشة ولا تضعها في GitHub أو كود الواجهة.
2. أنشئ Room Template يتضمن دورين على الأقل، بأسمائهما الدقيقة:
   - `host`: للمدير/مالك المنصة، مع صلاحية نشر الصوت والفيديو ومشاركة الشاشة وبدء/إيقاف HLS.
   - `attendee`: للعضو المعتمد، مع صلاحيات المشاركة المطلوبة دون صلاحية إدارة الغرفة أو بدء HLS.
3. فعّل HLS والبث، وإعدادات التسجيل التي تسمح بتسجيل MP4 لكل طبقة، وحدد تخزيناً خاصاً مناسباً. لا تستخدم رابط تسجيل عام دائم. اسمح للأعضاء بالاتصال فقط بواسطة رمز التطبيق قصير الصلاحية الذي يصدره Supabase.
4. انسخ من إعدادات التطبيق **Access Key** و**App Secret** ومعرّف الـTemplate. هذه بيانات خادم، لا تضعها في `VITE_*`.
5. إن كانت أسماء الأدوار مختلفة عن `host` و`attendee`، احفظ الاسمين لاستخدامهما في إعدادات الوظائف أدناه.

**علامة النجاح:** يمكن إنشاء غرفة اختبار من لوحة 100ms، وتعرض معاينة القالب الأدوار والصلاحيات الصحيحة، ولا يستطيع دور `attendee` بدء أو إدارة البث.

## 3. إضافة أسرار Supabase

من Supabase Dashboard افتح **Project Settings → Edge Functions → Secrets**، وأضف الأسرار التالية، كل واحد بالاسم المطابق تماماً:

| الاسم | القيمة |
| --- | --- |
| `HMS_ACCESS_KEY` | Access Key الخاص بتطبيق 100ms |
| `HMS_APP_SECRET` | App Secret الخاص بالتطبيق |
| `HMS_TEMPLATE_ID` | معرّف Room Template |
| `HMS_WEBHOOK_SECRET` | قيمة عشوائية قوية مشتركة مع webhook (مثلاً 32 بايت مولدة محلياً) |
| `HMS_HOST_ROLE_NAME` | `host`، أو الاسم المطابق للقالب |
| `HMS_MEMBER_ROLE_NAME` | `attendee`، أو الاسم المطابق للقالب |
| `HMS_REGION` | اختياري: `eu` أو `in` أو `us` أو `auto` |

تُحقن مفاتيح Supabase الخادمية من بيئة Edge نفسها. لا تضف `service_role` إلى الموقع، ولا تحتاج إلى إرسال كلمة مرور قاعدة البيانات لأي أحد. يمكن أيضاً ضبط القيم محلياً بملف غير متعقّب في Git ثم استخدام `supabase secrets set --env-file <مسار-الملف>`؛ احرص أن يكون الملف مستثنى من Git.

## 4. التحقق من وظائف Edge

الوظائف الأساسية الأربع `learning-room` و`learning-token` و`learning-playback` و`learning-webhook` موثقة كوظائف `ACTIVE` في آخر فحص سابق. كانت `learning-health` منشورة أيضاً بإصدار سابق، لكن التعديل الأحدث الذي يتحقق من إعداد 100ms والتسجيلات أُدمج في GitHub ولم يثبت نشره إلى Supabase الحي. **بعد مراجعة الكود، انشر `learning-health` وحدها بالأمر الأول أدناه عبر Supabase CLI موثّق الدخول؛ لا حاجة إلى migration قاعدة بيانات لهذا التعديل.** الأوامر الباقية مرجع لإعداد مشروع آخر أو لإعادة نشر وظيفة بعينها:

```bash
supabase functions deploy learning-health --project-ref tiifakicmnwexmqoyxfq
supabase functions deploy learning-room --project-ref tiifakicmnwexmqoyxfq
supabase functions deploy learning-token --project-ref tiifakicmnwexmqoyxfq
supabase functions deploy learning-playback --project-ref tiifakicmnwexmqoyxfq
supabase functions deploy learning-webhook --no-verify-jwt --project-ref tiifakicmnwexmqoyxfq
```

الوظائف الثلاث الأولى تتطلب JWT. وظيفة webhook وحدها تعمل مع `verify_jwt=false` لأنها تتحقق بنفسها من header سري ثابت التوقيت. لا تجعل webhook عاماً بلا السر.

**علامة النجاح:** بعد نشر `learning-health`، سجّل الدخول بحساب المالك وافتح `/owner/100ms/` ثم شغّل فحص الجاهزية؛ يجب أن يثبت الفحص إعداد القالب والأدوار وHLS ووجود حدث تسجيل معالج ورابط تشغيل مؤقت لتسجيل مكتمل. لا تعتبر أسماء الأسرار وحدها نجاحاً. آخر اختبار موثق للوظائف كان بلا JWT/secret وأعاد `401`؛ لم يُثبت بعد قبول جلسة مالك/مدير مصادق عليها أو نجاح webhook حقيقي. لا يوجد حالياً Webhook تنظيف لملفات التوثيق، وتحتاج أسرار 100ms و100ms webhook إلى ضبط آمن من لوحة Supabase.

## 5. إعداد 100ms Webhook

من لوحة 100ms افتح Webhooks وأضف العنوان:

```text
https://tiifakicmnwexmqoyxfq.supabase.co/functions/v1/learning-webhook
```

أضف Secret Header:

- الاسم: `x-saytara-webhook-secret`
- القيمة: **القيمة نفسها** المحفوظة في `HMS_WEBHOOK_SECRET` داخل Supabase، دون نشرها.

اشترك في الأحداث التالية:

- `session.close.success`
- `room.end.success`
- `hls.recording.success`

توصي 100ms بإعداد Secret Headers للويب هوك؛ يمكن إضافة قائمة عناوين IP الرسمية إلى جدار الحماية إذا كانت البنية لديك تسمح بذلك.

**علامة النجاح:** يصل webhook تجريبي موثّق إلى الوظيفة، ويظهر سجل حدث غير حساس في `learning_provider_events`. لا تحفظ الوظيفة رابط التسجيل الموقّع؛ تحفظ معرف الأصل فقط وتصدر رابطاً قصير الصلاحية بعد فحص الجلسة وصلاحية الحساب.

## 6. اختبار آمن محدود

1. اترك التسجيل العام مغلقاً. من `/owner/` أو بحساب مدير معتمد، أنشئ ورشة اختبار بعنوان لا يحتوي بيانات شخصية.
2. من حساب مالك/مدير ابدأ الورشة، واسمح للمتصفح بالميكروفون/الكاميرا عند الحاجة. تحقق أن زر بدء البث والتسجيل لا يظهر للعضو.
3. ادعُ حساب عضو اختباري معتمداً، وافتح الغرفة من متصفح ثانٍ. تحقّق من أن العضو يستطيع الدخول إلى الورشة المسموح بها فقط، وأنه لا يستطيع قراءة جدول معرفات الغرف أو أصول التسجيل مباشرة.
4. أنهِ الورشة، وانتظر وصول حدث `hls.recording.success` واكتمال التسجيل. يجب أن يظهر التسجيل في المكتبة بعد التحقق فقط.
5. افتح التشغيل من حساب مصرح به، ثم اختبر الرفض بحساب pending وحساب غير مسموح دوره. تحقق أن رابط التشغيل المؤقت لا يبقى صالحاً مدة طويلة.
6. راقب سجلات الوظائف بحثاً عن الأخطاء فقط؛ لا تطبع JWT أو أسرار المزود أو روابط تشغيل موقعة.

**لا تفتح التسجيل العام** قبل نجاح العزل الفعلي بحسابين أو أكثر، وبوابات حساب المالك والدعوات والبريد والحذف والتنظيف المذكورة في [التدقيق الأمني الحي](security-live-audit.md).

## حدود التحقق الحالية

نجح بناء الواجهة وفحص TypeScript، وقُبلت migration محلياً في قاعدة PostgreSQL مؤقتة ثم طُبقت على Supabase الحي، حيث تحققت الجداول وRLS للقراءة فقط. نُشرت الواجهة، واختبر المتصفح الزائر غير المسجل لمسار المركز ورابط غرفة ديناميكي؛ كلاهما انتهى بصفحة الدخول. واختُبرت الوظائف الأربع بلا JWT/secret فأعادت `401`. لم يتم إنشاء حساب أو مورد أو بث في 100ms، ولم يُختبر webhook سري أو البريد أو جلسات JWT مصادق عليها.

مصادر مرجعية: [100ms Webhooks](https://www.100ms.live/docs/server-side/v2/how-to-guides/configure-webhooks/webhook)، [تأمين Webhooks](https://www.100ms.live/docs/server-side/v2/how-to-guides/configure-webhooks/secure-webhooks)، [روابط تسجيل 100ms المؤقتة](https://www.100ms.live/docs/server-side/v2/api-reference/recording-assets/get-presigned-url)، [بحث موفري البث](streaming-provider-research.md).


## تحقق CI إضافي — 10 أكتوبر 2026

أُضيف إلى المستودع مسار مراجعة مستقل لتغييرات `supabase/**`. عند فتح طلب دمج، يفترض أن:

1. يشغّل Supabase محلياً داخل runner معزول، ثم يعيد بناء قاعدة الاختبار من migrations الموجودة في Git.
2. ينفذ `supabase db lint --local --fail-on error` ثم يشغّل اختبار pgTAP المستقل الذي لا يتطلب حسابات جاهزة: `supabase test db supabase/tests/ci_schema_security.sql`.
3. يشغّل `deno check` على كل مدخل Edge Function.

اختبارات `account_approval_smoke.sql` و`platform_owner_smoke.sql` و`rls_security_smoke.sql` هي اختبارات قبول منفصلة تحتاج تجهيز fixtures/حسابات اختبار. لا يشغّلها CI تلقائياً؛ نفّذها على بيئة اختبار معزولة بعد تجهيز متطلباتها، وليس على الإنتاج.

هذه الفحوص محلية ولا تتصل بقاعدة Supabase الإنتاجية ولا تطبّق migrations عليها. نجاحها يثبت قابلية بناء المخطط والاختبارات الموجودة، ولا يثبت نجاح المصادقة أو العزل عبر JWT حي أو إعداد البريد أو إعداد 100ms.

تم تحسين مصدر `learning-health` ليتحقق من قالب 100ms وصلاحيات الدورين ووجهة HLS الفعلية، ومن وجود حدث تسجيل HLS معالج، ومن قدرة 100ms على إصدار رابط تشغيل مؤقت لأحدث تسجيل مكتمل. **لن يصبح هذا الفحص المحسّن فعالاً في Supabase الحي بمجرد دمج الكود؛ يلزم نشر وظيفة `learning-health` عبر المسار المصرّح به ثم إعادة الاختبار بحساب المالك.** لا تُشغّل `supabase db push` أو `setup.sql` على الإنتاج لهذا التغيير؛ فهو تعديل وظيفة Edge فقط، ولا يتضمن migration قاعدة بيانات.
