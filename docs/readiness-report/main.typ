// Native professional report entry — مجتمع السيطرة.
#import "report-theme.typ": report-accent, report-red, report-theme

#show: report-theme.with(
  title: "تقرير قرار الجاهزية — مجتمع السيطرة",
  author: "مراجعة الإطلاق",
  rhythm: "report",
  running-header: true,
)
#set text(lang: "ar", dir: rtl)

// ---------- Cover ----------
#page(margin: (top: 2.1cm, bottom: 2.1cm, x: 2.2cm), numbering: none, header: none)[
  #set par(justify: false)
  #v(2.8cm)
  #align(center)[
    #block(fill: report-accent, inset: (x: 24pt, y: 30pt), width: 100%, radius: 8pt)[
      #text(size: 10pt, weight: "bold", fill: rgb("#E7EDF4"))[تقرير قرار الجاهزية]
      #v(1.2em)
      #text(size: 27pt, weight: "bold", fill: rgb("#FFFFFF"))[مجتمع السيطرة]
      #v(0.5em)
      #text(size: 13pt, fill: rgb("#E7EDF4"))[مجتمع مهني عربي آمن — بوابة تأكيد البريد وهرمية المالك والمدير]
      #v(1.5em)
      #line(length: 100%, stroke: 1.4pt + report-red)
      #v(1.2em)
      #text(size: 11pt, fill: rgb("#FFFFFF"))[مراجعة ما قبل فتح التسجيل العام]
    ]
    #v(1.1cm)
    #block(fill: rgb("#FFF3F4"), stroke: 1pt + report-red, inset: 15pt, width: 100%, radius: 6pt)[
      #text(size: 19pt, weight: "bold", fill: report-red)[NO-GO]
      #v(0.45em)
      #text(size: 12pt, weight: "bold", fill: report-accent)[البنية جاهزة للاختبار المحدود؛ ليس لفتح التسجيل العام]
      #v(0.45em)
  #text(size: 10.5pt, fill: report-accent)[
        المالك والبوابة ومركز التعلم منشورة؛ لكن البريد الحي، جلسات المالك والمدير، وعزل حسابين حقيقيين ووظيفة تنظيف الوثائق لم تُختبر بعد. 100ms غير مضبوط ولم يُختبر بث فعلي.
      ]
    ]
    #v(1.3cm)
    #text(size: 10pt, fill: report-accent)[4 أكتوبر 2026 · مراجعة إنتاج بعد نشر بوابة المالك]
    #v(0.35em)
    #text(size: 9pt, fill: luma(100))[القرار مبني على فحوص قراءة إنتاجية، رفض طلبات غير مصرح بها، واختبارات محلية معزولة؛ لا على دورة مستخدم مكتملة.]
  ]
]
#counter(page).update(1)
#pagebreak()

// ---------- Page 2 ----------
= الخلاصة التنفيذية

طُبّقت بوابة تأكيد البريد ثم الاعتماد، وأضيف دور مالك واحد محفوظ في قاعدة البيانات وواجهات RPC محمية. عُيّن المالك الأول بعد تأكيد البريد، وأوقف التسجيل العام في Supabase وفي بناء الموقع. نُشرت بوابة `/owner/` وأُصلح مسار التوليد الثابت حتى لا يعيد GitHub Pages صفحة 404.

#block(fill: rgb("#F4F6F9"), stroke: 0.7pt + report-accent, inset: 10pt, radius: 5pt)[
  *الحكم:* #text(fill: report-red, weight: "bold")[NO-GO لفتح التسجيل العام].
  السبب: لم تكتمل اختبارات البريد الفعلية، وجلسة المالك والمدير، وعزل البيانات بين حسابين حقيقيين، وwebhook التنظيف. إبقاء التسجيل العام مغلقاً هو الإجراء الآمن.
]

#v(0.6em)
#text(size: 9.2pt)[
#table(
  columns: (1.0fr, 0.78fr, 2.2fr),
  inset: 5.5pt,
  stroke: 0.45pt + luma(215),
  fill: (x, y) => if y == 0 { report-accent } else { rgb("#F7F8FA") },
  align: (right, center, right),
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[المجال]],
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[الحالة]],
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[الدليل وحدّه]],
  [المالك], [مهيّأ حيّاً], [مالك واحد مرتبط بحساب مؤكد؛ لم يُختبر دخوله إلى اللوحة بجلسة فعلية.],
  [الأدوار], [مشددة], [كتابة `user_roles` المباشرة مرفوضة؛ وظائف المالك لا تُتاح للمدير.],
  [تأكيد البريد], [مطلوب], [`Confirm email` مفعّل؛ لم تصل رسالة تأكيد أو استعادة ضمن اختبار حي.],
  [التسجيل العام], [مغلق], [إعداد Supabase مغلق؛ صفحة التسجيل الحية تعرض «الدخول بالدعوة فقط».],
  [بوابة `/owner/`], [منشورة], [الزائر غير المسجل يُحوّل إلى `/login`؛ الصفحة الخاصة `noindex`.],
  [عزل A عن B], [غير مختبر], [لا توجد جلسات JWT حقيقية منفصلة لاختبار الرسائل والوثائق وطلبات التوثيق.],
  [Edge / التنظيف], [جزئي], [الوظائف نشطة ورفضت طلباً بلا اعتماد؛ سر التنظيف وDatabase Webhook غير متحققين.],
  [مركز التعلم], [جزئي], [المخطط و4 وظائف نشطة؛ الواجهة الخاصة منشورة ومسار الغرفة يعيد الزائر إلى الدخول؛ 100ms غير مضبوط.],
)
]

= حدّ مهم في صلاحية المدير

المالك وحده يعيّن أو يسحب أدوار الموظفين العامة مثل `manager` و`moderator` و`coach` عبر RPC المالك. أمّا المدير فيمكنه، ضمن مسار مراجعة طلب توثيق محدد، اعتماد حالة `verified`؛ هذا ليس إسناداً عاماً لدور إداري. لم يُختبر هذا المسار بجلسة JWT إنتاجية.

#pagebreak()

// ---------- Page 3 ----------
= أدلة الإنتاج والنشر

== قاعدة البيانات والهوية

سُجلت migrations بوابة الاعتماد وتضييق صلاحيات anon، ثم هرمية المالك `platform_owner_hierarchy` بالإصدار `20261004000220`. أظهر التحقق قراءة فقط في الإنتاج: مالك واحد، وحساب آخر حالته `pending`؛ لم تُدرج عناوين بريد أو معرّفات. لم يُعَد تشغيل `setup.sql` على المشروع القائم.

أزال التغيير سياسة `Managers administer roles` القديمة، وأكد الاستعلام الحي غياب صلاحيات `INSERT/UPDATE/DELETE` المباشرة عن `authenticated` على `public.user_roles`. كما لم تعد policy القديمة موجودة. جداول المالك وسجل تدقيقه لا تُقرأ مباشرة من العميل، وعمليات الدور والإعداد والتعليق تمر عبر فحوص مالك على الخادم.

== إعداد Auth والموقع

أعيد تحميل صفحة إعداد Supabase للتحقق من بقاء `Confirm email` مفعلاً و`Allow new users to sign up` مغلقاً. يعرض الموقع فعلياً دعوة فقط. المتصفح المعزول فتح `/owner/` ثم أعاد الزائر إلى `/login`، وعرض `/register/` رسالة توقف التسجيل؛ لم يسجل Console أخطاء. استجابت الصفحة الرئيسية وواجهات الدخول والتسجيل والمالك بـHTTP 200، وحُمّل CSS وJavaScript للمالك بـ200. ملف المالك ثابت وخاص بـ`noindex,nofollow`.

نجح workflow التطبيق [#link("https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions/runs/37164428472")[37164428472]] ونشر Pages [#link("https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions/runs/37164428191")[37164428191]] بعد الإصلاح النهائي للمسار، على commit `f2d8ee4`. لم يُدخل أي مفتاح إداري إلى متصفح المستخدم؛ الحزمة تستخدم إعدادات Supabase العامة فقط.

== الوظائف والاستشارات الأمنية

`owner-invite` (v1) و`delete-account` (v2) و`cleanup-verification-files` (v1) نشطة. دعوة المالك والحذف يتطلبان JWT، والتنظيف يفرض `x-cleanup-secret` مع `verify_jwt=false`. أعاد POST بلا JWT إلى الدعوة والحذف `401` دون إرسال بريد أو حذف حساب. لم يُجر تنفيذ مصادق، ولم يُتحقق من السر البعيد أو webhook التنظيف.

أظهر Supabase Security Advisor ثلاث ملاحظات `INFO` عن جداول داخلية عليها RLS بلا سياسات، وتحذيراً لـ`is_staff` المتاحة لـ`anon`، و18 تحذيراً لدوال `SECURITY DEFINER` المتاحة لـ`authenticated`، وتحذيراً بأن حماية كلمات المرور المسرّبة غير مفعّلة. لم يُختبر كل RPC بجلسة JWT حية؛ يجب مراجعة هذه النقاط وتفعيل حماية كلمات المرور المسرّبة إن كانت متاحة قبل أي فتح عام.

== الاختبارات المحلية

نجح `npm run typecheck` و`npm run lint` بلا أخطاء و`npm run build`، وأثبت البناء وجود shell خاص للمالك. اجتازت مسارات مركز التعلم فحص SEO؛ وقُبلت migration `20261004020648` على قاعدة PostgreSQL مؤقتة مع stubs محدودة، ثم طُبقت على الإنتاج. تحقق فحص قراءة إنتاجي من الجداول الأربعة وRLS ومنع العميل من قراءة معرفات الغرف وأصول التسجيل مباشرة. نُشرت وظائف Edge الأربع واختُبرت طلبات POST بلا JWT/secret؛ كلها أعادت `401`. نُشرت الواجهة الخاصة `noindex`، وأكد متصفح Sandbox أن `/learning/` ورابط غرفة ديناميكي يحوّلان الزائر غير المسجل إلى `/login`. لم يُختبر دخول مصادق أو بث، و100ms غير مضبوط. نجح أيضاً `platform_owner_smoke.sql` في قاعدة مؤقتة: bootstrap، عمليات RPC للمالك، رفض المدير لمسارات المالك، ومنع الكتابة المباشرة وإقرار الحساب المعلق لنفسه، ونجح `account_approval_smoke.sql`. هذه لا تثبت جلسات REST/JWT أو بثاً حياً.

#pagebreak()

// ---------- Page 4 ----------
= البوابات المتبقية قبل READY

+ سجّل دخول المالك يدوياً بعد استخدام استعادة كلمة المرور إذا لزم، وافتح [#link("https://proexcellencenetwork-art.github.io/mojtama-al-saytara/owner/")[بوابة المالك]]. تحقّق من دعوة حساب اختبار، عرض سجل التدقيق، والتعليق/الاستعادة دون استخدام بيانات حقيقية.
+ اضبط أسرار 100ms وsecret header للأحداث؛ الواجهة والوظائف منشورة والمخطط موجود، فلا تعِد تطبيق migration أو نشر الوظائف. اختبر بثاً وتسجيلًا خاصاً بحسابات اصطناعية فقط. دليل الخطوات في `docs/learning-center-deployment-ar.md`.
+ أنشئ مديراً وحسابي اختبار `A` و`B` عبر الدعوة. اختبر التأكيد وإعادة إرسال الرسالة واستعادة كلمة المرور، وتأكد من بقاء الحساب المدعو `pending` حتى الموافقة.
+ اختبر بجلسات JWT منفصلة وطلبات الموقع/API أن `A` لا يقرأ رسائل أو طلبات توثيق أو ملفات `B`، ولا يغير دوره أو حالة اعتماده؛ واختبر منع العضو من النشر العام وحد الرسائل اليومي.
+ اختبر حد المدير عملياً: لا يعيّن أدوار الموظفين ولا يقرأ بيانات المالك؛ ويمكنه فقط معالجة طلب توثيق محدد وفق الصلاحية. سجّل النتيجة دون الخلط بين `verified` ودور إداري.
+ اضبط SMTP موثوقاً وأثبت وصول رسائل التأكيد والاستعادة فعلياً. راجع تحذير كلمات المرور المسرّبة وفَعّله إن كان متاحاً في الخطة.
+ أضف `CLEANUP_WEBHOOK_SECRET` من لوحة Supabase وأنشئ Database Webhook على `public.verification_requests` مع header `x-cleanup-secret`؛ اختبره بمرفق اصطناعي فقط.
+ اختبر `delete-account` بحساب تطوير مؤقت وفارغ، ثم تحقق من تنظيف ملفه؛ لا تستخدم حساب المالك ولا تحذف بيانات حقيقية.

#block(fill: rgb("#FFF3F4"), stroke: 1pt + report-red, inset: 11pt, radius: 5pt)[
  #text(size: 12pt, weight: "bold", fill: report-red)[قرار الإطلاق: NO-GO حتى اجتياز البوابات أعلاه وتوثيق نتائجها.]
  #v(0.4em)
  لا يُفتح التسجيل العام اعتماداً على نجاح البناء أو وجود مالك فقط؛ يلزم إثبات البريد، الصلاحيات الحية، عزل حسابين، ووظائف التنظيف والحذف.
]

= تنبيه أمني

كلمة مرور ظهرت سابقاً في نص المحادثة وتُعامل على أنها مكشوفة؛ لا تُستخدم مجدداً. غيّرها لدى مزود البريد، وغيّر كلمة مرور حساب الموقع إن كانت نفسها، من خلال مسار الاستعادة الرسمي. لم تُدرج في هذا التقرير أي كلمة مرور أو مفتاح أو بريد.

#v(0.5em)
#text(size: 8.3pt, fill: luma(95))[
الموقع: [#link("https://proexcellencenetwork-art.github.io/mojtama-al-saytara/")[الصفحة العامة]] · [#link("https://proexcellencenetwork-art.github.io/mojtama-al-saytara/owner/")[بوابة المالك]] · المراجع التشغيلية: [#link("https://github.com/proexcellencenetwork-art/mojtama-al-saytara/blob/main/docs/security-live-audit.md")[التدقيق الأمني]] و[#link("https://github.com/proexcellencenetwork-art/mojtama-al-saytara/blob/main/README.md")[دليل الإعداد]]. تاريخ الفحص: 4 أكتوبر 2026.
]


#pagebreak()
= تحديث التحقق الحي — 4 أكتوبر 2026

#text(size: 9pt, fill: report-accent)[هذا الملحق أحدث من سجل الفحص السابق، ويحل محل أي تعداد سابق للإعدادات أو تنبيهات Security Advisor لا يتوافق مع النتائج التالية.]

#v(0.45em)
#text(size: 8.6pt)[
#table(
  columns: (0.92fr, 1.85fr, 1.35fr),
  inset: 4.5pt,
  stroke: 0.45pt + luma(215),
  fill: (x, y) => if y == 0 { report-accent } else { rgb("#F7F8FA") },
  align: (right, right, right),
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[المجال]],
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[الدليل الحي]],
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[الحد المتبقي]],
  [إعداد Auth], [`disable_signup=true` و`mailer_autoconfirm=false`؛ التسجيل العام مغلق وتأكيد البريد مطلوب.], [لم ينهِ المالك استعادة كلمة المرور أو تسجيل الدخول.],
  [رسائل البريد], [عُثر على رسالة استعادة كلمة المرور ضمن بيانات صندوق البريد.], [لم يكتمل تدفق الاستعادة، ولم تُرسل دعوة اختبار لتأكيد التسليم.],
  [Storage], [Bucket `verification-private` حي وخاص (`public=false`)، وسياسات الأجسام تحدد الرفع والقراءة والحذف.], [لا اختبار مستند فعلي بين حسابين.],
  [صلاحية `is_staff`], [Migration `20261004031524` سُجلت في الإنتاج؛ `anon_execute=false` و`authenticated_execute=true`، ولا سياسة `anon` تستدعيها.], [بقية RPCs تحتاج اختبار جلسات JWT حقيقية.],
  [Edge Functions], [الوظائف السبع أعادت `401` لطلبات POST بلا JWT أو بسر تنظيف غير صالح.], [رفض فقط؛ لم يُختبر التنفيذ المصرح أو بريد الدعوة أو الحذف.],
  [Webhook التنظيف], [لا يوجد trigger خارجي على `verification_requests`؛ يوجد trigger لطابور التنظيف فقط.], [السر وDatabase Webhook غير مضبوطين/متحققين.],
  [Security Advisor], [6 ملاحظات `INFO` لجداول مقفلة، و23 تحذيراً لدوال `SECURITY DEFINER` المتاحة لـ`authenticated`، وتحذير حماية كلمة مرور مسرّبة.], [لم تُختبر كل الوظائف بجلسة مصرح بها؛ حماية التسريب غير مفعّلة.],
  [البث والتسجيل], [واجهة التعلم ووظائفها منشورة ومقيدة؛ مسارات الزوار تعيدهم إلى الدخول.], [100ms وأسراره غير مهيأة؛ لا بث أو تسجيل أو مكتبة VOD فعلية.],
)
]

#v(0.55em)
#block(fill: rgb("#FFF3F4"), stroke: 1pt + report-red, inset: 10pt, radius: 5pt)[
  #text(size: 12pt, weight: "bold", fill: report-red)[FINAL STATUS: NO-GO]
  #v(0.3em)
  يبقى التسجيل العام مغلقاً. لم تكتمل جلسة المالك، والدعوات والموافقة، وعزل حسابين فعليين، واختبار webhook والحذف الآمن، أو إعداد بث مسجل خاص في الإنتاج؛ لذلك لم يتحقق معيار `READY`.
]

#v(0.45em)
#text(size: 8.5pt, fill: report-accent)[آخر نشر Pages ناجح: workflow 37173875652 على commit المصدر afba3e7؛ يتضمن رابطاً خاصاً مباشراً لتبويب مكتبة التسجيلات.]


#pagebreak()
= تحديث التحقق الموسّع — 4 أكتوبر 2026

#text(size: 9pt, fill: report-accent)[فحص الإنتاج والـCI عند 04:08 UTC بعد commit `9905b21`؛ يحدّث هذا الملحق حالة Auth والوظائف والحماية الشبكية.]

#v(0.45em)
#text(size: 8.2pt)[
#table(
  columns: (0.95fr, 1.85fr, 1.32fr),
  inset: 4pt,
  stroke: 0.45pt + luma(215),
  fill: (x, y) => if y == 0 { report-accent } else { rgb("#F7F8FA") },
  align: (right, right, right),
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[المجال]],
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[الدليل الأحدث]],
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[الحد أو المطلوب]],
  [Auth الحي], [HTTP `200` من إعدادات المشروع الصحيح؛ `disable_signup=true` و`mailer_autoconfirm=false`.], [لم يُكمل المالك الدخول أو الاستعادة؛ التسجيل العام يبقى مغلقاً.],
  [رفض Edge], [كل الوظائف السبع أعادت `401` لطلبات بلا JWT/سر webhook بالـmethod الصحيح.], [لم يُنفّذ بريد دعوة أو حذف أو تنظيف؛ سر التنظيف وDatabase Webhook غير متحقق منهما.],
  [Turnstile], [دعم العميل منشور؛ فحص `/login` لم يجد widget أو script أو iframe.], [إعداد CAPTCHA/السر في Supabase غير ظاهر في الإعداد العام؛ لا إثبات لتحدٍ فعّال.],
  [Cloudflare], [الحساب المتصل يحوي صفر مناطق DNS؛ الموقع على مضيف GitHub Pages مشترك.], [لا WAF/DDoS عبر Cloudflare حتى اختيار نطاق مملوك وربطه والتحقق من HTTPS.],
  [النشر الحي], [Pages run `37175894886` وCodeQL run `37175894849` نجحا على `9905b21`؛ الموارد العامة `200` والمسارات المحمية تعيد الزائر إلى login.], [صفحة التسجيل تعرض توقف الحسابات العامة؛ لم تحدث أخطاء Console أثناء فحص المتصفح.],
  [أمان GitHub], [Vulnerability alerts وDependabot fixes وsecret scanning وpush protection مفعّلة؛ CodeQL workflow نجح.], [قائمة CodeQL alerts غير متاحة عبر API الحالي؛ لا أدعي أن عدد التنبيهات صفر.],
  [التحقق المحلي], [`typecheck`, `lint`, `test:seo-fixtures`, `build` ناجحة؛ `npm audit` أعاد صفر ثغرات.], [تحذيران lint سابقان وتحذير حجم bundle غير حاجب.],
  [البث والتسجيل], [الواجهة والوظائف منشورة، لكن لم تُرسل بيانات أو موارد بث.], [100ms والأسرار غير مضبوطة؛ لا جلسة بث أو HLS/VOD أو اختبار صلاحية تشغيل حي.],
)
]

#v(0.55em)
#block(fill: rgb("#FFF3F4"), stroke: 1pt + report-red, inset: 10pt, radius: 5pt)[
  #text(size: 12pt, weight: "bold", fill: report-red)[FINAL STATUS: NO-GO]
  #v(0.3em)
  لا توجد جلسة مالك مؤكدة أو دورة اختبار مصادق عليها للمالك والمدير وحسابين مستقلين. كما لم يُتحقق من البريد أو webhook التنظيف أو الحذف الآمن، ولم يُختبر تحدي Turnstile أو إعداد 100ms أو نطاق Cloudflare. لذلك لا يحقق الإنتاج معيار `READY`، ويظل التسجيل العام مغلقاً.
]

#v(0.4em)
#text(size: 8.5pt, fill: report-accent)[مرجع الإعداد اليدوي: `docs/security-hardening-setup-ar.md`. Pages deployment run 37175894886؛ CodeQL run 37175894849. لا تضع أي Secret في المتصفح أو GitHub Variables.]
