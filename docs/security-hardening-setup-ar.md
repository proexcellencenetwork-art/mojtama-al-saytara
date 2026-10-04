# إعداد الحماية من البوتات وطبقة الشبكة

## الوضع الحالي

الموقع متصل بمشروع Supabase الصحيح. فُتح التسجيل العام في Supabase Auth، مع بقاء **تأكيد البريد إلزامياً**؛ ويظل ملف الحساب الجديد قيد المراجعة حتى موافقة المالك أو المدير. أُضيف في الواجهة دعم اختياري لـCloudflare Turnstile على تسجيل الدخول، إنشاء الحساب، إعادة إرسال التأكيد، وطلب رابط الاستعادة. لم يُظهر `/login` أي Widget أو script أو iframe لـTurnstile؛ لذلك **لم يثبت أن تحدي المتصفح فعّال**. إعداد CAPTCHA/السر داخل Supabase لم يُفعّل أو يُتحقق منه.

التسجيل العام مفتوح حالياً بطلب صاحب المشروع؛ لا تعتبر ذلك دليلاً على اكتمال الجاهزية. أسرع ما يلزم لإكمال الحماية هو ضبط Turnstile واختبار البريد وعزل الحسابات. يمكن إغلاق واجهة التسجيل بإعادة `VITE_PUBLIC_SIGNUP_ENABLED` إلى `false` وإغلاق **Allow new users to sign up** في Supabase Auth.

## تفعيل Cloudflare Turnstile لـSupabase Auth

1. افتح لوحة Cloudflare، ثم **Turnstile → Add widget**. أنشئ Widget باسم واضح، وضع المضيفين المسموحين:
   - `proexcellencenetwork-art.github.io`
   - `localhost` للاختبار المحلي فقط.
2. انسخ **Sitekey** العام، ثم في GitHub افتح المستودع → **Settings → Secrets and variables → Actions → Variables → New repository variable**. أضف الاسم حرفياً `VITE_TURNSTILE_SITE_KEY` وضع فيه Sitekey. هذا المفتاح عام وسيظهر في ملفات JavaScript المنشورة؛ لا تضع **Secret key** في GitHub Variables أو في أي `VITE_*`.
3. في Supabase افتح المشروع → **Authentication → Bot and Abuse Protection**، فعّل **Enable CAPTCHA protection**، واختر **Cloudflare Turnstile**، والصق **Secret key** في حقل السر داخل Supabase، ثم احفظ. لا ترسل السر في المحادثة ولا تضعه في المستودع.
4. أعد تشغيل **Actions → Deploy to GitHub Pages → Run workflow**. بعد النشر يجب أن يظهر تحدي Turnstile في صفحات Auth المدعومة. اختبره بموقع حي ومتصفح فعلي، ثم تحقق من نجاح تسجيل الدخول/طلب الاستعادة مع التحدي، ومن رفض إرسال طلب بلا رمز صالح إذا كان إعداد Supabase يفرض CAPTCHA.
5. إذا لم تظهر الواجهة، افحص اسم المتغير `VITE_TURNSTILE_SITE_KEY` وقيمة Sitekey العامة وسجلّ Actions؛ لا تعطّل حماية Supabase لتجاوز الخطأ.

> التسجيل العام مفتوح حالياً؛ إلى أن يكتمل اختبار الصلاحيات وعزل الحسابات والدعوات والبريد، أبقِ تأكيد البريد ومراجعة الحسابات إلزاميين، ولا تدّعِ جاهزية كاملة. تركيب Turnstile وحده لا يثبت حماية DDoS ولا يعوّض WAF على نطاق مملوك.

## WAF وحماية DDoS لصفحات GitHub Pages

الرابط الحالي يستخدم النطاق المشترك `proexcellencenetwork-art.github.io`، وليس نطاقاً تملكه المنصة. فحص Cloudflare المتصل أعاد **صفر مناطق DNS**؛ لذلك لم يُفعّل Cloudflare proxy أو WAF، ولا يصح الادعاء بأن الموقع محمي منهما.

لتطبيق طبقة Cloudflare على حركة الموقع يلزم نطاق مملوك تختاره أنت وتضيفه إلى حساب Cloudflare. وفق إرشادات GitHub Pages، أضف وتحقّق من النطاق في **GitHub repository → Settings → Pages** قبل تعديل سجلات DNS. بعد ذلك يُنشأ سجل CNAME للنطاق الفرعي باتجاه `proexcellencenetwork-art.github.io`، وتُضبط إعدادات HTTPS وDNS بعناية، ثم يمكن توجيه سجل الويب عبر Cloudflare proxy وضبط قواعد WAF. لا تغيّر DNS أو اسم الموقع دون تحديد النطاق الذي تريد استخدامه؛ ذلك يغيّر الرابط الرسمي وقد يتطلب تحديث روابط Auth والبريد.

## مرجعيات رسمية

- [Supabase — Enable CAPTCHA Protection](https://supabase.com/docs/guides/auth/auth-captcha)
- [Cloudflare — Turnstile](https://developers.cloudflare.com/turnstile/)
- [GitHub — Managing a custom domain for GitHub Pages](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [Cloudflare — Proxy status](https://developers.cloudflare.com/dns/proxy-status/)
