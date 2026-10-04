begin;

-- This is a narrow owner/manager RPC, not a change to ordinary article RLS.
-- Social derivatives are intended editorial assets and inherit the article's RLS.
alter table public.articles
  add column if not exists editorial_assets jsonb not null default '{}'::jsonb;

create or replace function public.manage_community_article(
  p_action text,
  p_article_id uuid,
  p_title text,
  p_slug text,
  p_excerpt text,
  p_body text,
  p_status text,
  p_editorial_assets jsonb default '{}'::jsonb
) returns public.articles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.articles;
  clean_title text := btrim(coalesce(p_title, ''));
  clean_slug text := btrim(coalesce(p_slug, ''));
  clean_excerpt text := coalesce(p_excerpt, '');
  clean_body text := coalesce(p_body, '');
  clean_assets jsonb := coalesce(p_editorial_assets, '{}'::jsonb);
begin
  if auth.uid() is null or not coalesce(public.can_manage_learning(), false) then
    raise exception 'Owner or manager access required';
  end if;
  if p_action not in ('create', 'update') then raise exception 'Unsupported article action'; end if;
  if p_status not in ('draft', 'published', 'archived') then raise exception 'Unsupported article status'; end if;
  if char_length(clean_title) not between 3 and 220 then raise exception 'Article title must be 3-220 characters'; end if;
  if char_length(clean_slug) not between 1 and 80 or clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Article slug must be lowercase letters, digits and single hyphens';
  end if;
  if char_length(clean_excerpt) > 500 then raise exception 'Article excerpt is too long'; end if;
  if char_length(clean_body) not between 1 and 60000 then raise exception 'Article body must be 1-60000 characters'; end if;
  if jsonb_typeof(clean_assets) <> 'object' or pg_column_size(clean_assets) > 32768 then
    raise exception 'Editorial assets must be a JSON object smaller than 32 KB';
  end if;

  if p_action = 'create' then
    if p_article_id is not null then raise exception 'Create does not accept an article ID'; end if;
    insert into public.articles(author_id, title, slug, excerpt, body, status, published_at, editorial_assets)
    values (
      auth.uid(), clean_title, clean_slug, clean_excerpt, clean_body, p_status,
      case when p_status = 'published' then now() else null end, clean_assets
    ) returning * into result;
    return result;
  end if;

  if p_article_id is null then raise exception 'Update requires an article ID'; end if;
  select * into result from public.articles where id = p_article_id for update;
  if not found then raise exception 'Article not found'; end if;
  update public.articles
  set title = clean_title,
      slug = clean_slug,
      excerpt = clean_excerpt,
      body = clean_body,
      status = p_status,
      published_at = case when p_status = 'published' then coalesce(result.published_at, now()) else null end,
      editorial_assets = clean_assets
  where id = p_article_id
  returning * into result;
  return result;
end;
$$;

revoke all on function public.manage_community_article(text, uuid, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.manage_community_article(text, uuid, text, text, text, text, text, jsonb) to authenticated;
comment on function public.manage_community_article(text, uuid, text, text, text, text, text, jsonb)
  is 'Approved platform owner/manager only; author_id is bound to the signed-in user; social assets inherit article RLS; ordinary author policies remain unchanged.';

commit;
