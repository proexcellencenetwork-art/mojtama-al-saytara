# ورشة الجندي الخفي — البيانات وPower BI

## صفحة الورشة
تظهر الورشة داخل مركز التعلّم: `/learning`، تحت عنوان «الجندي الخفي: من الإنجاز إلى التأثير».

## مصدر البيانات
- Supabase project: `tiifakicmnwexmqoyxfq`
- Table: `public.workshop_submissions`
- Workshop slug: `hidden-soldier`
- REST resource: `https://tiifakicmnwexmqoyxfq.supabase.co/rest/v1/workshop_submissions`
- الحفظ يتم من خلال Supabase Data API باستخدام جلسة المستخدم المسجل.
- RLS: المشارك يقرأ ويحدّث سجله فقط؛ الكوتش/المدير/مالك المنصة المعتمد يستطيع قراءة مشاركات الورشة. لا توجد صلاحية anon على الجدول.

## أعمدة التحليل
`user_id`, `problem`, `desired_outcome`, `personal_contribution`, `evidence`, `improvement_proposal`, `responsibility_request`, `baseline_value`, `result_value`, `metric_unit`, `status`, `submitted_at`.

يتم جلب الاسم والمهنة والتخصص من `public.profiles` عند توفر صلاحية القراءة. لا يتم تصدير البريد الإلكتروني أو الرسائل الخاصة.

## استيراد Power BI
1. سجّل الدخول إلى مركز التعلّم بحساب مقدّم الورشة (كوتش/مدير/مالك).
2. من لوحة الورشة اختر «تصدير Power BI CSV».
3. في Power BI Desktop اختر Get data → Text/CSV، ثم افتح الملف `hidden-soldier-power-bi.csv`.
4. اجعل `تاريخ الإرسال` من نوع Date/Time، وأبقِ النصوص كما هي.
5. بعد الاستيراد أنشئ مؤشرات DAX التالية:

```DAX
Participants = DISTINCTCOUNT('hidden-soldier-power-bi'[اسم المشارك])

Submissions = COUNTROWS('hidden-soldier-power-bi')

Evidence Filled =
CALCULATE(
    COUNTROWS('hidden-soldier-power-bi'),
    FILTER(
        'hidden-soldier-power-bi',
        LEN('hidden-soldier-power-bi'[الدليل]) > 0
    )
)

Evidence Coverage % =
DIVIDE([Evidence Filled], [Submissions], 0)
```

## حدود الربط المباشر والتضمين
ملف CSV يتيح تحليلاً حقيقياً في Power BI Desktop، لكنه ليس تحديثاً تلقائياً. النشر في Power BI Service، وجدولة التحديث أو تضمين التقرير داخل الموقع يتطلب مساحة عمل Power BI، صلاحية نشر، وطريقة مصادقة/تضمين معتمدة من حساب Microsoft الخاص بالمجتمع. لا تُضمّن مفاتيح Supabase السرية في المتصفح ولا تجعل بيانات المشاركين عامة.
