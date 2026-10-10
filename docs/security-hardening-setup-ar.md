# إعداد الحماية من البوتات وطبقة الشبكة

## الوضع الحالي

الموقع متصل بمشروع Supabase الصحيح. التسجيل العام **موقوف حالياً في بناء Pages** إلى أن تكتمل بوابات UAT، مع بقاء **تأكيد البريد إلزامياً** ومراجعة الحساب قبل دخول مساحة الأعضاء. أُنشئ في Cloudflare Widget باسم `Mojtama Al-Saytara Supabase Auth` ومضيفاه المسموحان `proexcellencenetwork-art.github.io` و`localhost`؛ لكنه لم يُربط بعد بالبناء أو بإعداد Supabase. فحص لوحة Supabase أظهر أن **Enable Captcha protection متوقف**، وفحص `/login` لم يجد Widget أو script أو iframe. لذلك حماية البوتات غير فعّالة حالياً.

التسجيل العام موقوف حالياً في بناء Pages؛ لا تعتبر ذلك دليلاً على اكتمال الجاهزية. يلزم إضافة Sitekey العام كـGitHub Actions Variable باسم `VITE_TURNSTILE_SITE_KEY`، ثم إدخال السر الخاص مباشرةً في Supabase، وتشغيل CAPTCHA واختبار الرفض/القبول. فشل اتصال GitHub API بصلاحية `403` عند محاولة إضافة المتغير تلقائياً، لذا أضفه يدوياً من إعدادات المستودع. لا ترسل السر في المحادثة. يجب إبقاء `VITE_PUBLIC_SIGNUP_ENABLED` على `false` وإبقاء **Allow new users to sign up** مغلقاً في Supabase Auth حتى اجتياز اختبارات القبول.


## حماية كلمات المرور المسرّبة — قيد الخطة الحالية

أظهر Supabase Security Advisor في تدقيق 10 أكتوبر 2026 أن حماية كلمات المرور المسرّبة معطّلة، كما أن خطة المؤسسة الحالية `Free`. تنص وثائق Supabase الحالية على أن ميزة Leaked Password Protection متاحة في خطة `Pro` وما فوق: [Password security — Supabase Docs](https://supabase.com/docs/guides/auth/password-security).

- **لا تتم ترقية الخطة آلياً**؛ فهي قرار مالي لصاحب المشروع.
- إذا استمر المشروع على الخطة المجانية، اعتبر فحص كلمات المرور المسرّبة خطراً متبقياً لا تستطيع هذه الخطة سدّه بهذه الميزة. شدّد بقية الضوابط: طول كلمة المرور إلى 12 حرفاً على الأقل إذا كانت إعدادات Auth المتاحة تسمح، وتأكيد البريد، وCAPTCHA بعد تفعيله واختباره، ومراجعة الحساب قبل دخول مساحة الأعضاء.
- هذه الضوابط لا تُعد بديلاً مكافئاً عن فحص كلمات المرور المسرّبة. لا تدّعِ اكتمال هذا الضابط ما لم يظهر مفعّلاً ويختفِ التحذير من Security Advisor.


## تفعيل Cloudflare Turnstile لـSupabase Auth

1. افتح لوحة Cloudflare → **Turnstile** وابحث عن Widget الموجود باسم `Mojtama Al-Saytara Supabase Auth` (لا تنشئ نسخة أخرى). يجب أن يظهر المضيفان:
   - `proexcellencenetwork-art.github.io`
   - `localhost` للاختبار المحلي فقط.
2. انسخ **Sitekey** العام، ثم في GitHub افتح المستودع → **Settings → Secrets and variables → Actions → Variables → New repository variable**. أضف الاسم حرفياً `VITE_TURNSTILE_SITE_KEY` وضع فيه Sitekey. Sitekey عام وسيظهر في ملفات JavaScript المنشورة؛ لا تضع **Secret key** في GitHub أو في أي `VITE_*`.
3. في Supabase افتح المشروع → **Authentication → Bot and Abuse Protection**. يبيّن الفحص الحالي أن CAPTCHA متوقف. من لوحة Cloudflare افتح الـWidget ودوّر/أنشئ **Secret key** جديداً إن لم تستطع استرجاع القيمة التي ظهرت عند الإنشاء؛ ألصقه مباشرةً في حقل السر داخل Supabase، اختر Cloudflare Turnstile، فعّل **Enable CAPTCHA protection**، ثم احفظ. لا ترسل السر في المحادثة ولا تضعه في المستودع.
4. أعد تشغيل **Actions → Deploy to GitHub Pages → Run workflow** بعد إضافة المتغير العام. بعد النشر يجب أن يظهر تحدي Turnstile في صفحات Auth المدعومة. اختبره بموقع حي ومتصفح فعلي، ثم تحقق من نجاح التسجيل/الدخول مع التحدي ورفض طلب بلا رمز صالح.
5. إذا لم تظهر الواجهة، افحص اسم المتغير `VITE_TURNSTILE_SITE_KEY` وقيمة Sitekey العامة وسجلّ Actions؛ لا تعطّل حماية Supabase لتجاوز الخطأ.

> التسجيل العام موقوف حالياً؛ أبقِ تأكيد البريد ومراجعة الحسابات إلزاميين. إلى أن يُفعّل CAPTCHA ويُختبر، لا تدّعِ حماية بوتات فعّالة أو جاهزية كاملة. WAF/DDoS مصنف **Future Hardening** وليس مانع إطلاق حالياً؛ Turnstile وحده لا يثبت حماية DDoS.

## WAF وحماية DDoS — Future Hardening (ليست مانع إطلاق)

الرابط الحالي يستخدم النطاق المشترك `proexcellencenetwork-art.github.io`، وليس نطاقاً تملكه المنصة. فحص Cloudflare المتصل أعاد **صفر مناطق DNS**؛ لذلك لم يُفعّل Cloudflare proxy أو WAF. لا يوجد في الفحص الحالي دليل على تهديد نشط يجعل هذه الطبقة مانع إطلاق حرجاً؛ تبقى **Future Hardening**. لا تغيّر DNS ولا تشترِ نطاقاً لهذا الغرض دون حاجة واضحة.

إذا اختير نطاق مملوك لاحقاً، وفق إرشادات GitHub Pages أضفه وتحقّق منه في **GitHub repository → Settings → Pages** قبل تعديل سجلات DNS. بعدها يمكن إنشاء CNAME باتجاه `proexcellencenetwork-art.github.io`، وضبط HTTPS وDNS، ثم توجيه سجل الويب عبر Cloudflare proxy وإضافة قواعد WAF. لا تغيّر DNS أو اسم الموقع الآن؛ قد يتغير الرابط الرسمي وتتطلب Auth والبريد تحديثاً.

## مرجعيات رسمية

- [Supabase — Enable CAPTCHA Protection](https://supabase.com/docs/guides/auth/auth-captcha)
- [Cloudflare — Turnstile](https://developers.cloudflare.com/turnstile/)
- [GitHub — Managing a custom domain for GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Cloudflare — Proxy status](https://developers.cloudflare.com/dns/proxy-status/)
