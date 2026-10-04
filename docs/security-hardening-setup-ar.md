# إعداد الحماية من البوتات وطبقة الشبكة

## الوضع الحالي

الموقع متصل بمشروع Supabase الصحيح. فُتح التسجيل العام في Supabase Auth، مع بقاء **تأكيد البريد إلزامياً** ومراجعة الحساب قبل دخول مساحة الأعضاء. أُنشئ في Cloudflare Widget باسم `Mojtama Al-Saytara Supabase Auth` ومضيفاه المسموحان `proexcellencenetwork-art.github.io` و`localhost`؛ لكنه لم يُربط بعد بالبناء أو بإعداد Supabase. فحص لوحة Supabase أظهر أن **Enable Captcha protection متوقف**، وفحص `/login` لم يجد Widget أو script أو iframe. لذلك حماية البوتات غير فعّالة حالياً.

التسجيل العام مفتوح حالياً بطلب صاحب المشروع؛ لا تعتبر ذلك دليلاً على اكتمال الجاهزية. يلزم إضافة Sitekey العام كـGitHub Actions Variable باسم `VITE_TURNSTILE_SITE_KEY`، ثم إدخال السر الخاص مباشرةً في Supabase، وتشغيل CAPTCHA واختبار الرفض/القبول. فشل اتصال GitHub API بصلاحية `403` عند محاولة إضافة المتغير تلقائياً، لذا أضفه يدوياً من إعدادات المستودع. لا ترسل السر في المحادثة. يمكن إغلاق التسجيل بإعادة `VITE_PUBLIC_SIGNUP_ENABLED` إلى `false` وإغلاق **Allow new users to sign up** في Supabase Auth.

## تفعيل Cloudflare Turnstile لـSupabase Auth

1. افتح لوحة Cloudflare → **Turnstile** وابحث عن Widget الموجود باسم `Mojtama Al-Saytara Supabase Auth` (لا تنشئ نسخة أخرى). يجب أن يظهر المضيفان:
   - `proexcellencenetwork-art.github.io`
   - `localhost` للاختبار المحلي فقط.
2. انسخ **Sitekey** العام، ثم في GitHub افتح المستودع → **Settings → Secrets and variables → Actions → Variables → New repository variable**. أضف الاسم حرفياً `VITE_TURNSTILE_SITE_KEY` وضع فيه Sitekey. Sitekey عام وسيظهر في ملفات JavaScript المنشورة؛ لا تضع **Secret key** في GitHub أو في أي `VITE_*`.
3. في Supabase افتح المشروع → **Authentication → Bot and Abuse Protection**. يبيّن الفحص الحالي أن CAPTCHA متوقف. من لوحة Cloudflare افتح الـWidget ودوّر/أنشئ **Secret key** جديداً إن لم تستطع استرجاع القيمة التي ظهرت عند الإنشاء؛ ألصقه مباشرةً في حقل السر داخل Supabase، اختر Cloudflare Turnstile، فعّل **Enable CAPTCHA protection**، ثم احفظ. لا ترسل السر في المحادثة ولا تضعه في المستودع.
4. أعد تشغيل **Actions → Deploy to GitHub Pages → Run workflow** بعد إضافة المتغير العام. بعد النشر يجب أن يظهر تحدي Turnstile في صفحات Auth المدعومة. اختبره بموقع حي ومتصفح فعلي، ثم تحقق من نجاح التسجيل/الدخول مع التحدي ورفض طلب بلا رمز صالح.
5. إذا لم تظهر الواجهة، افحص اسم المتغير `VITE_TURNSTILE_SITE_KEY` وقيمة Sitekey العامة وسجلّ Actions؛ لا تعطّل حماية Supabase لتجاوز الخطأ.

> التسجيل العام مفتوح حالياً؛ أبقِ تأكيد البريد ومراجعة الحسابات إلزاميين. إلى أن يُفعّل CAPTCHA ويُختبر، لا تدّعِ حماية بوتات فعّالة أو جاهزية كاملة. Turnstile لا يثبت حماية DDoS ولا يعوّض WAF على نطاق مملوك.

## WAF وحماية DDoS لصفحات GitHub Pages

الرابط الحالي يستخدم النطاق المشترك `proexcellencenetwork-art.github.io`، وليس نطاقاً تملكه المنصة. فحص Cloudflare المتصل أعاد **صفر مناطق DNS**؛ لذلك لم يُفعّل Cloudflare proxy أو WAF، ولا يصح الادعاء بأن الموقع محمي منهما.

لتطبيق طبقة Cloudflare على حركة الموقع يلزم نطاق مملوك تختاره أنت وتضيفه إلى حساب Cloudflare. وفق إرشادات GitHub Pages، أضف وتحقّق من النطاق في **GitHub repository → Settings → Pages** قبل تعديل سجلات DNS. بعد ذلك يُنشأ سجل CNAME للنطاق الفرعي باتجاه `proexcellencenetwork-art.github.io`، وتُضبط إعدادات HTTPS وDNS بعناية، ثم يمكن توجيه سجل الويب عبر Cloudflare proxy وضبط قواعد WAF. لا تغيّر DNS أو اسم الموقع دون تحديد النطاق الذي تريد استخدامه؛ ذلك يغيّر الرابط الرسمي وقد يتطلب تحديث روابط Auth والبريد.

## مرجعيات رسمية

- [Supabase — Enable CAPTCHA Protection](https://supabase.com/docs/guides/auth/auth-captcha)
- [Cloudflare — Turnstile](https://developers.cloudflare.com/turnstile/)
- [GitHub — Managing a custom domain for GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Cloudflare — Proxy status](https://developers.cloudflare.com/dns/proxy-status/)
