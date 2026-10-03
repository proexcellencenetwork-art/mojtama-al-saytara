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
      #text(size: 13pt, fill: rgb("#E7EDF4"))[مجتمع مهني عربي آمن — بوابة تأكيد البريد وموافقة المدير]
      #v(1.5em)
      #line(length: 100%, stroke: 1.4pt + report-red)
      #v(1.2em)
      #text(size: 11pt, fill: rgb("#FFFFFF"))[مراجعة ما قبل فتح التسجيل العام]
    ]
    #v(1.1cm)
    #block(fill: rgb("#FFF3F4"), stroke: 1pt + report-red, inset: 15pt, width: 100%, radius: 6pt)[
      #text(size: 19pt, weight: "bold", fill: report-red)[NO-GO]
      #v(0.45em)
      #text(size: 12pt, weight: "bold", fill: report-accent)[غير جاهز للإطلاق العام بعد]
      #v(0.45em)
      #text(size: 10.5pt, fill: report-accent)[
        لا توجد حسابات إنتاج لاختبار البريد ودورة الموافقة وعزل بيانات عضو عن عضو؛ كما لم يُتحقق من webhook تنظيف الوثائق.
      ]
    ]
    #v(1.3cm)
    #text(size: 10pt, fill: report-accent)[3 أكتوبر 2026  ·  إصدار الإنتاج المنشور]
    #v(0.35em)
    #text(size: 9pt, fill: luma(100))[القرار مبني على فحص حي محدود، واختبارات محلية معزولة، لا على دورة مستخدم مكتملة.]
  ]
]
#counter(page).update(1)
#pagebreak()

// ---------- Page 2 ----------
= الخلاصة التنفيذية

طُبّقت على مشروع Supabase الحي بوابة الحساب التي تشترط تأكيد البريد ثم موافقة مدير، وفُصلت سياسات القراءة العامة عن دوال الصلاحية الداخلية. نُشرت نسخة GitHub Pages المحدّثة، وتأكد وجود إعداد Supabase العام الصحيح في حزمة JavaScript الحية. لم يظهر وضع التجربة.

#block(fill: rgb("#F4F6F9"), stroke: 0.7pt + report-accent, inset: 10pt, radius: 5pt)[
  *الحكم:* #text(fill: report-red, weight: "bold")[NO-GO للإطلاق العام].
  السبب المحدد: قاعدة الإنتاج تحتوي حالياً *صفراً من مستخدمي Auth والملفات الشخصية*؛ لذلك يستحيل إثبات تسليم البريد، انتقال الحساب من pending إلى approved، أو العزل الفعلي بين حسابين مستقلين.
]

#v(0.6em)
#text(size: 9.4pt)[
#table(
  columns: (1.0fr, 0.72fr, 2.2fr),
  inset: 6pt,
  stroke: 0.45pt + luma(215),
  fill: (x, y) => if y == 0 { report-accent } else { rgb("#F7F8FA") },
  align: (right, center, right),
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[المجال]],
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[الحالة]],
  [#text(fill: rgb("#FFFFFF"), weight: "bold")[الدليل وحدّ الاستنتاج]],
  [بوابة الاعتماد], [مطبّقة], [حالة `pending` ومشغّلا الإنشاء والحراسة موجودة على الإنتاج؛ لم تُختبر بحساب حقيقي.],
  [صلاحيات anon], [مشددة], [لا صلاحية تنفيذ لدوال المساعدة الحساسة المختبرة؛ عرض الكوتشات يستخدم `security_invoker`.],
  [وثائق التوثيق], [خاصة], [bucket `verification-private` أظهر `public=false`؛ لم يختبر تنزيل متبادل بجلسات JWT.],
  [وظائف Edge], [منشورة], [`ACTIVE`؛ الطلب غير المصرح أعاد `401`، ولم يُنفذ حذف. سر التنظيف وwebhook غير متحقق منهما.],
  [موقع Pages], [منشور], [الصفحات حُمّلت، والتسجيل عُرض، ومسارا الخلاصة والإدارة أعادا الزائر إلى الدخول.],
  [اختبار حي بحسابين], [غير منفذ], [عدد مستخدمي Auth والملفات الشخصية = 0 وقت الفحص.],
)
]

= الأثر على الإطلاق

النسخة الحالية مناسبة لاستكمال اختبار محدود، لكنها لا تبرر فتح التسجيل للجمهور. لا يُعاد تشغيل `supabase/setup.sql` على المشروع القائم؛ ترحيلَا الاعتماد وتضييق anon سُجّلا بالفعل. Google OAuth اختياري ومؤجل، وليس سبب قرار NO-GO.

#pagebreak()

// ---------- Page 3 ----------
= أدلة التحقق على الإنتاج

== قاعدة البيانات والصلاحيات

سُجلت migration `account_approval_gate_20261003` بالإصدار `20261003200940`، ثم `anon_policy_scoping_20261003` بالإصدار `20261003201627`. قيمة `profiles.account_status` الافتراضية `pending` وغير قابلة لـNULL. تأكد وجود trigger لإنشاء ملف جديد وtrigger يحرس حقول الاعتماد. حُصر قرار المدير في RPC يتحقق من دور المدير وتأكيد بريد الحساب المستهدف، ويكتب القرار في سجل المراجعة.

لـ`anon` صلاحية `EXECUTE=false` على `is_account_approved`, `is_staff`, `is_active_group_member`, و`is_group_owner`. عرض `public_coaches` مضبوط بخياري `security_barrier=true` و`security_invoker=true`، ويعيد فقط الكوتشات العامة المعتمدة. bucket `verification-private` خاص (`public=false`).

أعاد Supabase Advisor صفراً من تحذيرات `SECURITY DEFINER` المتاحة لـ`anon` بعد التغيير. بقيت عشرة تحذيرات للدور `authenticated`؛ تشمل دوالاً تستعملها سياسات RLS أو RPCs الإشراف. راجعت الشيفرة للتحقق من ربطها بهوية المستدعي/الدور، لكن يبقى هذا تنبيهاً قابلاً للمراجعة، وليس ادعاءً بصفر تحذيرات أمنية.

== واجهة الموقع والنشر

نجح workflow التطبيق [#link("https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions/runs/37151383910")[37151383910]]، ونجح نشر Pages [#link("https://github.com/proexcellencenetwork-art/mojtama-al-saytara/actions/runs/37151400542")[37151400542]]. أعادت `/`, `/login/`, `/register/`, `/feed/`, و`/admin/` استجابة HTTP 200. في المتصفح ظهر نموذج التسجيل؛ وعند فتح `/feed/` أو `/admin/` دون تسجيل، عاد الزائر إلى `/login`.

فحص الحزمة الحية أكد وجود عنوان مشروع Supabase والمفتاح العام اللذين قدمهما المالك، دون إدراج أي قيمة في هذا التقرير. أعاد فحص Console في متصفح Sandbox «لا يوجد إخراج». `gh variable list/set` رُفض بـ403، لكن ذلك لا ينفي الإعداد: الحزمة المنشورة نفسها تثبت القيم المستخدمة.

== وظائف Edge

الوظيفتان `delete-account` و`cleanup-verification-files` في حالة `ACTIVE` (الإصدار 1). الحذف يتطلب JWT (`verify_jwt=true`)؛ وظيفة التنظيف تستخدم تحققاً مخصصاً من `x-cleanup-secret` (`verify_jwt=false`). أُرسل POST غير مصرح به فقط، وأعادت كل وظيفة `401`. لم تُرسل طلبات مصادقة أو عملية حذف. لم يُتحقق من وجود `CLEANUP_WEBHOOK_SECRET` في البيئة البعيدة أو من إعداد Database Webhook.

= ما اجتاز محلياً

نجحت أوامر `npm run build`, `npm run typecheck`, و`npm run lint`. طُبق `setup.sql` واختبار `account_approval_smoke.sql` في قاعدة PostgreSQL مؤقتة ومعزولة؛ تحقق الاختبار من بداية الحساب `pending` بدور `member` فقط، ومنع الحساب pending من بيانات الأعضاء والتصعيد الذاتي، وقصر قائمة المراجعة على المدير المؤهل، وتسجيل قرار المدير، وسحب التنفيذ المباشر من دوال المحفزات. انتهى الاختبار بـ`ROLLBACK`، ثم حُذفت قاعدة الاختبار. هذا اختبار محلي، وليس اختبار JWT/HTTP لخدمة الإنتاج.

#pagebreak()

// ---------- Page 4 ----------
= بوابات الإطلاق المتبقية

+ أنشئ حساب المالك ببريد يملكه صاحبه، أكّد البريد، ثم عيّن أول مدير من SQL Editor باستخدام #link("https://github.com/proexcellencenetwork-art/mojtama-al-saytara/blob/main/README.md")[دليل الإعداد]. لا تُشارك كلمة المرور أو JWT.
+ جهّز حسابي اختبار عاديين ببريدين تملكهما. أكّد كليهما، وتحقق أن حالتهما تبقى `pending` وأن صفحة المراجعة وحدها متاحة قبل موافقة المدير.
+ بعد اعتماد حساب اختبار، اختبر بجلسات JWT منفصلة أن العضو لا يقرأ رسائل أو طلبات توثيق أو وثائق الحساب الآخر، ولا يعدل دوره أو حالة اعتماده. اختبر أيضاً منع النشر العام وحد الرسائل اليومي.
+ اضبط SMTP موثوقاً واختبر رسالتي التأكيد والاستعادة فعلياً؛ قراءة إعداد Confirm Email لا تثبت وصول البريد.
+ اضبط `CLEANUP_WEBHOOK_SECRET` من لوحة Supabase وأنشئ Database Webhook لجدول `public.verification_requests` مع header اسمه `x-cleanup-secret`. اختبره بملف اصطناعي فقط.
+ اختبر `delete-account` بحساب تطوير مؤقت لا يحتوي بيانات حقيقية؛ لا تستخدم حساب المالك.
+ أبقِ Google OAuth مؤجلاً حسب القرار الحالي؛ ليس شرطاً لمسار البريد.

#block(fill: rgb("#FFF3F4"), stroke: 1pt + report-red, inset: 11pt, radius: 5pt)[
  #text(size: 12pt, weight: "bold", fill: report-red)[قرار الإطلاق: NO-GO حتى إغلاق البوابات 1–6.]
  #v(0.4em)
  الموافقة على فتح التسجيل تتطلب دليلاً مرئياً على البريد والتأكيد والمراجعة، واختبار عزل حي بحسابين؛ لا يكفي نجاح البناء أو PostgreSQL المحلي.
]

= تنبيه أمني

وردت كلمة مرور لبريد في نص المحادثة السابق؛ ينبغي تغييرها مباشرة لدى مزود البريد وعدم إعادة استخدامها. لم تُدرج أي كلمة مرور أو مفتاح في هذا التقرير. لم تُجر عمليات حذف على الإنتاج، ولم تُستخدم بيانات صحية أو وثائق حقيقية.

#v(0.7em)
#text(size: 8.5pt, fill: luma(95))[
المصادر الداخلية: [#link("https://github.com/proexcellencenetwork-art/mojtama-al-saytara/blob/main/docs/security-live-audit.md")[تقرير التدقيق الأمني]]، [#link("https://github.com/proexcellencenetwork-art/mojtama-al-saytara/blob/main/docs/performance-phase2.md")[تقرير الأداء]]، وسجلات GitHub Actions أعلاه. تاريخ الفحص: 3 أكتوبر 2026.
]
