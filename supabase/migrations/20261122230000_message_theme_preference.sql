-- Messenger theme is saved to the account so it is the same on every device.
-- Previously it lived only in each browser's localStorage. Forward-only; no applied migration is edited.

alter table public.profiles
  add column if not exists message_theme text not null default 'porcelain'
  check (message_theme in ('porcelain', 'leaf', 'ink', 'warm'));

create or replace function public.set_my_message_theme(p_theme text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_theme is null or p_theme not in ('porcelain', 'leaf', 'ink', 'warm') then
    raise exception 'Unknown message theme';
  end if;
  insert into public.profiles(id, message_theme) values (uid, p_theme)
    on conflict (id) do update set message_theme = excluded.message_theme, updated_at = now();
  return p_theme;
end;
$$;

revoke all on function public.set_my_message_theme(text) from public, anon;
grant execute on function public.set_my_message_theme(text) to authenticated;
