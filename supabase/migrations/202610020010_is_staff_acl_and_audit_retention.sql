-- مجتمع السيطرة — preserve moderation audit rows when a moderator deletes their account.
begin;

-- Keep moderation history if its author later deletes their account; preserve the row,
-- but remove the deleted account reference instead of blocking auth.admin.deleteUser().
alter table public.moderation_actions
  alter column moderator_id drop not null;
alter table public.moderation_actions
  drop constraint if exists moderation_actions_moderator_id_fkey;
alter table public.moderation_actions
  add constraint moderation_actions_moderator_id_fkey
  foreign key (moderator_id) references auth.users(id) on delete set null;

commit;
