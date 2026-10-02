-- مجتمع السيطرة — فحص RLS يدوي آمن داخل معاملة تُلغى بالكامل.
-- للتجربة فقط: شغّله على مشروع اختبار بعد setup.sql، وليس على مشروع إنتاج.
-- قبل التشغيل: أنشئ 5 حسابات مخصصة وأكّد البريد: member-a, member-b, verified, moderator, manager.
-- سجّل الدخول كـ member-b وارفع ملف PDF وهمياً غير حساس وأرسل طلب توثيق معلقاً؛ لا ترفع وثيقة حقيقية.
-- استبدل عناوين البريد أدناه بعناوين حسابات الاختبار الخمسة. لا تستخدم بيانات مرضى.
-- هذا يضبط دور PostgreSQL وclaims محلية لاختبار سياسات DB، لكنه لا يغني عن اختبار الموقع/API بجلسات JWT حقيقية.

begin;

select set_config('saytara.test.member_a_email', 'member-a@example.test', true);
select set_config('saytara.test.member_b_email', 'member-b@example.test', true);
select set_config('saytara.test.verified_email', 'verified@example.test', true);
select set_config('saytara.test.moderator_email', 'moderator@example.test', true);
select set_config('saytara.test.manager_email', 'manager@example.test', true);

do $$
declare
  v_a uuid;
  v_b uuid;
  v_verified uuid;
  v_moderator uuid;
  v_manager uuid;
  v_conversation_ab uuid;
  v_conversation_bv uuid;
  v_own_request uuid;
  v_doc_path text;
begin
  select id into v_a from auth.users where lower(email)=lower(current_setting('saytara.test.member_a_email')) limit 1;
  select id into v_b from auth.users where lower(email)=lower(current_setting('saytara.test.member_b_email')) limit 1;
  select id into v_verified from auth.users where lower(email)=lower(current_setting('saytara.test.verified_email')) limit 1;
  select id into v_moderator from auth.users where lower(email)=lower(current_setting('saytara.test.moderator_email')) limit 1;
  select id into v_manager from auth.users where lower(email)=lower(current_setting('saytara.test.manager_email')) limit 1;

  if v_a is null or v_b is null or v_verified is null or v_moderator is null or v_manager is null then
    raise exception 'أوقف الفحص: لم يُعثر على كل حسابات الاختبار الخمسة. أكمل التسجيل والتأكيد أولاً.';
  end if;
  if v_a=v_b or v_a=v_verified or v_a=v_moderator or v_a=v_manager or v_b=v_verified or v_b=v_moderator or v_b=v_manager then
    raise exception 'أوقف الفحص: استخدم بريداً مختلفاً لكل حساب اختبار.';
  end if;
  if exists(select 1 from public.user_roles where user_id=v_a and role<>'member') then
    raise exception 'أوقف الفحص: member-a ليس عضواً عادياً؛ استخدم حساب اختبار جديداً.';
  end if;
  if exists(select 1 from public.messages where sender_id in (v_a,v_b) and created_at > now()-interval '24 hours') then
    raise exception 'أوقف الفحص: استخدم حسابي member-a وmember-b جديدين بلا رسائل في آخر 24 ساعة.';
  end if;

  select document_path into v_doc_path
  from public.verification_requests
  where user_id=v_b and status in ('pending','more_information')
  order by requested_at desc limit 1;
  if v_doc_path is null or not exists(
    select 1 from storage.objects where bucket_id='verification-private' and name=v_doc_path
  ) then
    raise exception 'أوقف الفحص: سجّل كـ member-b وارفع ملفاً وهمياً إلى طلب توثيق معلق قبل تشغيل السكربت.';
  end if;

  -- تجهيز بيانات اختبار مؤقتة؛ كل شيء سيُلغى عند ROLLBACK في نهاية الملف.
  insert into public.user_roles(user_id,role,granted_by) values
    (v_verified,'verified',v_verified),
    (v_moderator,'moderator',v_moderator),
    (v_manager,'manager',v_manager)
  on conflict (user_id,role) do nothing;

  insert into public.connections(requester_id,recipient_id,status,responded_at)
  values(v_a,v_b,'accepted',now()) on conflict (requester_id,recipient_id)
  do update set status='accepted',responded_at=now();
  insert into public.connections(requester_id,recipient_id,status,responded_at)
  values(v_b,v_verified,'accepted',now()) on conflict (requester_id,recipient_id)
  do update set status='accepted',responded_at=now();

  insert into public.conversations(member_a,member_b)
  values(least(v_a,v_b),greatest(v_a,v_b)) on conflict (member_a,member_b) do nothing;
  select id into v_conversation_ab from public.conversations
  where member_a=least(v_a,v_b) and member_b=greatest(v_a,v_b) limit 1;

  insert into public.conversations(member_a,member_b)
  values(least(v_b,v_verified),greatest(v_b,v_verified)) on conflict (member_a,member_b) do nothing;
  select id into v_conversation_bv from public.conversations
  where member_a=least(v_b,v_verified) and member_b=greatest(v_b,v_verified) limit 1;

  insert into public.messages(conversation_id,sender_id,recipient_id,body)
  values(v_conversation_bv,v_b,v_verified,'رسالة اختبار خصوصية مؤقتة')
  on conflict do nothing;

  insert into public.verification_requests(user_id,full_name,profession,professional_registration_no,document_path)
  values(v_a,'حساب اختبار','مهنة اختبار','RLS-SMOKE-'||substr(v_a::text,1,8),v_a::text||'/rls-smoke-metadata-only.pdf')
  returning id into v_own_request;
  perform set_config('saytara.test.member_a_id',v_a::text,true);
  perform set_config('saytara.test.member_b_id',v_b::text,true);
  perform set_config('saytara.test.verified_id',v_verified::text,true);
  perform set_config('saytara.test.moderator_id',v_moderator::text,true);
  perform set_config('saytara.test.manager_id',v_manager::text,true);
  perform set_config('saytara.test.conversation_ab',v_conversation_ab::text,true);
  perform set_config('saytara.test.conversation_bv',v_conversation_bv::text,true);
  perform set_config('saytara.test.own_request',v_own_request::text,true);
  perform set_config('saytara.test.document_path',v_doc_path,true);
end;
$$;

set local role authenticated;

do $$
declare
  v_a uuid := current_setting('saytara.test.member_a_id')::uuid;
  v_b uuid := current_setting('saytara.test.member_b_id')::uuid;
  v_verified uuid := current_setting('saytara.test.verified_id')::uuid;
  v_moderator uuid := current_setting('saytara.test.moderator_id')::uuid;
  v_manager uuid := current_setting('saytara.test.manager_id')::uuid;
  v_conversation_ab uuid := current_setting('saytara.test.conversation_ab')::uuid;
  v_conversation_bv uuid := current_setting('saytara.test.conversation_bv')::uuid;
  v_own_request uuid := current_setting('saytara.test.own_request')::uuid;
  v_doc_path text := current_setting('saytara.test.document_path');
  v_count integer;
  v_rows integer;
  v_denied boolean;
  v_i integer;
begin
  -- Member A is not a participant in the private conversation between B and the verified test account.
  perform set_config('request.jwt.claim.sub',v_a::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a::text,'role','authenticated')::text,true);
  select count(*) into v_count from public.messages where conversation_id=v_conversation_bv;
  if v_count<>0 then raise exception 'FAIL: عضو عادي قرأ رسائل محادثة ليس طرفاً فيها.'; end if;

  select count(*) into v_count from public.verification_requests where user_id=v_b;
  if v_count<>0 then raise exception 'FAIL: عضو عادي قرأ طلب توثيق عضو آخر.'; end if;
  select count(*) into v_count from storage.objects where bucket_id='verification-private' and name=v_doc_path;
  if v_count<>0 then raise exception 'FAIL: عضو عادي قرأ بيانات ملف توثيق عضو آخر.'; end if;

  -- RLS can silently filter unauthorized UPDATE to zero rows; check the final role as well.
  update public.user_roles set role='manager' where user_id=v_a and role='member';
  get diagnostics v_rows = row_count;
  if v_rows<>0 or exists(select 1 from public.user_roles where user_id=v_a and role in ('manager','moderator','verified','coach')) then
    raise exception 'FAIL: عضو عادي غيّر دوره أو منح نفسه دوراً.';
  end if;

  v_denied := false;
  begin
    update public.verification_requests set status='approved',reviewer_id=v_a where id=v_own_request;
    get diagnostics v_rows = row_count;
    v_denied := v_rows=0;
  exception when others then
    v_denied := true;
  end;
  if not v_denied or exists(select 1 from public.verification_requests where id=v_own_request and (status<>'pending' or reviewer_id is not null)) then
    raise exception 'FAIL: عضو عادي غيّر حالة طلب توثيقه أو اعتمده بنفسه.';
  end if;

  v_denied := false;
  begin
    insert into public.posts(author_id,body,visibility) values(v_a,'منشور اختبار مؤقت','public');
  exception when others then
    v_denied := true;
  end;
  if not v_denied then raise exception 'FAIL: عضو عادي نشر منشوراً عاماً.'; end if;

  -- Moderator and manager can read the private object; members cannot.
  perform set_config('request.jwt.claim.sub',v_moderator::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_moderator::text,'role','authenticated')::text,true);
  select count(*) into v_count from storage.objects where bucket_id='verification-private' and name=v_doc_path;
  if v_count<>1 then raise exception 'FAIL: المشرف لا يرى وثيقة الاختبار الخاصة.'; end if;

  perform set_config('request.jwt.claim.sub',v_manager::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_manager::text,'role','authenticated')::text,true);
  select count(*) into v_count from storage.objects where bucket_id='verification-private' and name=v_doc_path;
  if v_count<>1 then raise exception 'FAIL: المدير لا يرى وثيقة الاختبار الخاصة.'; end if;

  -- Verify the rolling 24-hour limit on a fresh ordinary member: 15 allowed, the 16th denied.
  perform set_config('request.jwt.claim.sub',v_a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a::text,'role','authenticated')::text,true);
  for v_i in 1..15 loop
    insert into public.messages(conversation_id,sender_id,recipient_id,body)
    values(v_conversation_ab,v_a,v_b,'رسالة اختبار حد المعدل '||v_i::text);
  end loop;
  v_denied := false;
  begin
    insert into public.messages(conversation_id,sender_id,recipient_id,body)
    values(v_conversation_ab,v_a,v_b,'الرسالة السادسة عشرة للاختبار');
  exception when others then
    v_denied := true;
  end;
  if not v_denied then raise exception 'FAIL: قُبلت الرسالة رقم 16 خلال 24 ساعة.'; end if;
end;
$$;

reset role;
rollback;
select 'نجاح: لم يستطع العضو النشر العام أو قراءة بيانات خاصة أو تغيير الأدوار/التوثيق، ونجح حد 15 رسالة؛ أُلغيت كل بيانات الاختبار.' as نتيجة;
