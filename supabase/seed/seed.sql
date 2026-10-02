-- للتجربة فقط — بيانات وحسابات اصطناعية للتطوير المحلي، ولا تُشغّل هذا الملف على مشروع إنتاج.
-- كل كلمة مرور عشوائية ولا تصلح لتسجيل الدخول؛ الغرض اختبار السياسات والواجهات فقط.
-- لا يحتوي الملف على بيانات مستخدمين حقيقيين ولا يندمج في supabase/setup.sql.
begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('d0000000-0000-4000-8000-000000000001','authenticated','authenticated','member.demo@saytara.local',crypt(encode(gen_random_bytes(32),'hex'),gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"display_name":"نورة العبدالله"}',now(),now()),
 ('d0000000-0000-4000-8000-000000000002','authenticated','authenticated','verified.demo@saytara.local',crypt(encode(gen_random_bytes(32),'hex'),gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"display_name":"د. ليان الحربي"}',now(),now()),
 ('d0000000-0000-4000-8000-000000000003','authenticated','authenticated','coach.demo@saytara.local',crypt(encode(gen_random_bytes(32),'hex'),gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"display_name":"أ. عمر السبيعي"}',now(),now()),
 ('d0000000-0000-4000-8000-000000000004','authenticated','authenticated','moderator.demo@saytara.local',crypt(encode(gen_random_bytes(32),'hex'),gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"display_name":"مشرف تجريبي"}',now(),now()),
 ('d0000000-0000-4000-8000-000000000005','authenticated','authenticated','manager.demo@saytara.local',crypt(encode(gen_random_bytes(32),'hex'),gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"display_name":"مدير تجريبي"}',now(),now())
on conflict (id) do nothing;

insert into public.profiles(user_id,display_name,headline,profession,specialty,workplace,bio,experience_years,interests,goals,city)
values
 ('d0000000-0000-4000-8000-000000000001','نورة العبدالله','ممرضة صحة مجتمع','ممرضة','صحة المجتمع','مركز الرعاية الأولية','أؤمن أن الرعاية تبدأ بالإنصات، وأن النمو المهني رحلة نتعلمها معاً.',8,array['التوازن المهني','الصحة المجتمعية'],array['القيادة والتمكين'],'الرياض'),
 ('d0000000-0000-4000-8000-000000000002','د. ليان الحربي','طبيبة أسرة','طبيبة','طب الأسرة','مركز صحي','أشارك خبرة عملية في بناء مسار مهني متوازن.',11,array['التطوير المهني','العناية بالذات'],array['التعليم والإرشاد'],'الرياض'),
 ('d0000000-0000-4000-8000-000000000003','أ. عمر السبيعي','كوتش مهني وصيدلي إكلينيكي','صيدلي','صيدلة إكلينيكية','مستشفى جامعي','كوتشنج مهني في وضوح المسار واتخاذ القرار.',14,array['الكوتشنج','التوجيه المهني'],array['دعم الممارسين'],'جدة'),
 ('d0000000-0000-4000-8000-000000000004','مشرف تجريبي','فريق الإشراف','مشرف','المجتمع','مجتمع السيطرة','حساب اختباري لأدوات مراجعة البلاغات.',0,array[]::text[],array[]::text[],'السعودية'),
 ('d0000000-0000-4000-8000-000000000005','مدير تجريبي','إدارة المنصة','مدير','إدارة المجتمع','مجتمع السيطرة','حساب اختبار محلي لإدارة الأدوار.',0,array[]::text[],array[]::text[],'السعودية')
on conflict (user_id) do update set display_name=excluded.display_name,headline=excluded.headline,profession=excluded.profession,specialty=excluded.specialty,workplace=excluded.workplace,bio=excluded.bio,experience_years=excluded.experience_years,interests=excluded.interests,goals=excluded.goals,city=excluded.city;

insert into public.user_roles(user_id,role) values
 ('d0000000-0000-4000-8000-000000000001','member'),
 ('d0000000-0000-4000-8000-000000000002','verified'),
 ('d0000000-0000-4000-8000-000000000003','verified'),
 ('d0000000-0000-4000-8000-000000000003','coach'),
 ('d0000000-0000-4000-8000-000000000004','moderator'),
 ('d0000000-0000-4000-8000-000000000005','manager')
on conflict (user_id,role) do nothing;

insert into public.coach_profiles(user_id,public_bio,coaching_topics,booking_enabled)
values ('d0000000-0000-4000-8000-000000000003','كوتشنج مهني للممارسين الصحيين في وضوح المسار وإدارة التغيير.',array['تطوير المسار','اتخاذ القرار','التوازن المهني'],true)
on conflict (user_id) do update set booking_enabled=excluded.booking_enabled;

insert into public.posts(id,author_id,body,visibility) values
 ('d1000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','في نهاية المناوبة، أحياناً يكون ألطف قرار مهني هو أن نمنح أنفسنا استراحة قصيرة قبل أن نجيب عن كل شيء. ما الطقس الصغير الذي يساعدكم على استعادة تركيزكم؟','members'),
 ('d1000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000003','مساحة التفكير الهادئة تساعدنا على رؤية خياراتنا المهنية. ما السؤال الذي ساعدك على اتخاذ قرار مهني مهم؟','members')
on conflict (id) do nothing;

insert into public.groups(id,name,description,topic,is_public,owner_id)
values ('d2000000-0000-4000-8000-000000000001','توازن الممارس الصحي','مجموعة للحوار حول عادات مهنية أكثر توازناً.','التوازن المهني',true,'d0000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;
insert into public.group_memberships(group_id,user_id,status) values
 ('d2000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','active'),
 ('d2000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','active')
on conflict do nothing;

insert into public.membership_plans(code,name,benefits,price_sar,is_active)
values ('premium','العضوية المميزة',array['محتوى حصري','فعاليات خاصة','خصم على جلسات الكوتشنج'],null,false)
on conflict (code) do nothing;
commit;

-- More development records to exercise the main member flows.
begin;
insert into public.connections(id,requester_id,recipient_id,status,responded_at)
values ('d3000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','accepted',now())
on conflict (requester_id,recipient_id) do nothing;
insert into public.conversations(id,member_a,member_b)
values ('d4000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002')
on conflict (member_a,member_b) do nothing;
insert into public.messages(id,conversation_id,sender_id,recipient_id,body)
values ('d5000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001','أهلاً نورة، يسعدني تواصلك المهني.')
on conflict (id) do nothing;
insert into public.articles(id,author_id,title,slug,excerpt,body,status,published_at)
values ('d6000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','حدود صحية في بيئة العمل','healthy-work-boundaries','تأملات قصيرة حول الحدود المهنية.','ضع حدوداً مهنية تتناسب مع دورك، واطلب الدعم عند الحاجة. هذا محتوى توعوي وليس نصيحة طبية أو نفسية.','published',now())
on conflict (id) do nothing;
insert into public.events(id,organizer_id,title,description,starts_at,ends_at,location)
values ('d7000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003','وضوح المسار المهني','جلسة حوار تجريبية حول خطوات التطور المهني. لا تشارك معلومات أو صور مرضى.','2026-10-15 16:30:00+00','2026-10-15 17:30:00+00','افتراضي')
on conflict (id) do nothing;
insert into public.event_rsvps(event_id,user_id,status)
values ('d7000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','going')
on conflict (event_id,user_id) do nothing;
insert into public.notifications(id,recipient_id,actor_id,kind,entity_type,entity_id,body)
values ('d8000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000002','connection','connection','d3000000-0000-4000-8000-000000000001','قبل د. ليان طلب اتصالك.')
on conflict (id) do nothing;
insert into public.reports(id,reporter_id,target_type,target_id,reason,details)
values ('d9000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','post','d1000000-0000-4000-8000-000000000001','other','بلاغ تجريبي للمشرف؛ احذفه بعد الاختبار.')
on conflict (id) do nothing;
insert into public.coach_availability(id,coach_id,starts_at,ends_at,is_available)
values ('db000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003','2026-10-20 16:00:00+00','2026-10-20 16:30:00+00',true)
on conflict (id) do nothing;
insert into public.coaching_bookings(id,coach_id,member_id,availability_id,starts_at,minutes,member_note,status)
values ('da000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','db000000-0000-4000-8000-000000000001','2026-10-20 16:00:00+00',30,'طلب تجريبي لمناقشة الأهداف المهنية.','requested')
on conflict (id) do nothing;
commit;
