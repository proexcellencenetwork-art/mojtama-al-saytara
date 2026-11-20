-- Run only in a dedicated Supabase test project after creating two approved test accounts.
-- Set the two emails below to accounts you control. Both profiles must be approved and public.
-- This test creates temporary portfolio rows and rolls them back; it does not alter persistent member data.
begin;

select set_config('saytara.portfolio_test.owner_a_email', 'portfolio-a@example.test', true);
select set_config('saytara.portfolio_test.owner_b_email', 'portfolio-b@example.test', true);

do $$
declare
  v_a uuid;
  v_b uuid;
  v_public_id uuid;
  v_private_id uuid;
  v_b_private_id uuid;
  v_count integer;
  v_rows integer;
  v_denied boolean;
begin
  select id into v_a from auth.users where lower(email)=lower(current_setting('saytara.portfolio_test.owner_a_email')) limit 1;
  select id into v_b from auth.users where lower(email)=lower(current_setting('saytara.portfolio_test.owner_b_email')) limit 1;

  if v_a is null or v_b is null or v_a = v_b then
    raise exception 'أوقف الاختبار: أنشئ حسابي اختبار مختلفين واكتب بريديهما في أعلى الملف.';
  end if;
  if not exists(select 1 from public.profiles where user_id=v_a and account_status='approved' and visibility='public')
     or not exists(select 1 from public.profiles where user_id=v_b and account_status='approved' and visibility='public') then
    raise exception 'أوقف الاختبار: يجب أن يكون ملفا حسابي الاختبار معتمدين وعامين.';
  end if;

  insert into public.professional_portfolio_items(user_id,item_type,title,description,visibility)
  values(v_a,'project','مشروع اختبار عام','وصف عام مؤقت للاختبار','public')
  returning id into v_public_id;

  insert into public.professional_portfolio_items(user_id,item_type,title,description,visibility)
  values(v_a,'solved_problem','مشكلة اختبار خاصة','وصف خاص مؤقت للاختبار','private')
  returning id into v_private_id;

  insert into public.professional_portfolio_items(user_id,item_type,title,description,visibility)
  values(v_b,'skill','مهارة اختبار خاصة','وصف خاص مؤقت للاختبار','private')
  returning id into v_b_private_id;

  perform set_config('saytara.portfolio_test.owner_a_id',v_a::text,true);
  perform set_config('saytara.portfolio_test.owner_b_id',v_b::text,true);
  perform set_config('saytara.portfolio_test.public_id',v_public_id::text,true);
  perform set_config('saytara.portfolio_test.private_id',v_private_id::text,true);
  perform set_config('saytara.portfolio_test.b_private_id',v_b_private_id::text,true);
end;
$$;

set local role authenticated;

do $$
declare
  v_a uuid := current_setting('saytara.portfolio_test.owner_a_id')::uuid;
  v_b uuid := current_setting('saytara.portfolio_test.owner_b_id')::uuid;
  v_public_id uuid := current_setting('saytara.portfolio_test.public_id')::uuid;
  v_private_id uuid := current_setting('saytara.portfolio_test.private_id')::uuid;
  v_b_private_id uuid := current_setting('saytara.portfolio_test.b_private_id')::uuid;
  v_count integer;
  v_rows integer;
  v_denied boolean;
begin
  perform set_config('request.jwt.claim.sub',v_a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_a::text,'role','authenticated')::text,true);
  select count(*) into v_count from public.professional_portfolio_items where id=v_private_id;
  if v_count <> 1 then raise exception 'FAIL: لم يستطع العضو قراءة بطاقته الخاصة.'; end if;

  perform set_config('request.jwt.claim.sub',v_b::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_b::text,'role','authenticated')::text,true);
  select count(*) into v_count from public.professional_portfolio_items where id=v_private_id;
  if v_count <> 0 then raise exception 'FAIL: قرأ عضو بطاقة خاصة لعضو آخر.'; end if;

  select count(*) into v_count from public.professional_portfolio_items where id=v_public_id;
  if v_count <> 1 then raise exception 'FAIL: لم تظهر البطاقة العامة لعضو آخر.'; end if;

  update public.professional_portfolio_items set title='محاولة تعديل غير مصرح بها' where id=v_public_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'FAIL: عدّل عضو بطاقة عامة يملكها شخص آخر.'; end if;

  v_denied := false;
  begin
    insert into public.professional_portfolio_items(user_id,item_type,title,description)
    values(v_a,'skill','محاولة انتحال الملكية','يجب رفض هذا السجل');
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then raise exception 'FAIL: قُبل إدخال بطاقة باسم عضو آخر.'; end if;

  delete from public.professional_portfolio_items where id=v_b_private_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'FAIL: لم يستطع العضو حذف بطاقته الخاصة.'; end if;
end;
$$;

reset role;
set local role anon;
do $$
declare
  v_public_id uuid := current_setting('saytara.portfolio_test.public_id')::uuid;
  v_private_id uuid := current_setting('saytara.portfolio_test.private_id')::uuid;
  v_count integer;
begin
  select count(*) into v_count from public.professional_portfolio_items where id=v_public_id;
  if v_count <> 1 then raise exception 'FAIL: لم يستطع الزائر قراءة البطاقة العامة.'; end if;
  select count(*) into v_count from public.professional_portfolio_items where id=v_private_id;
  if v_count <> 0 then raise exception 'FAIL: ظهرت بطاقة خاصة للزائر.'; end if;
end;
$$;

reset role;
rollback;
select 'نجاح: ملكية السجلات والعرض العام/الخاص وتقييد التعديل والحذف تم اختبارها، وأُلغيت بيانات الاختبار.' as نتيجة;
