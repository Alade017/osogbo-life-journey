-- A request notification is committed in the same transaction as the request.
create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path = public as $$
declare recipient_user uuid; sender_name text;
begin
  select user_id into recipient_user from public.characters where id = new.recipient_character_id;
  select name into sender_name from public.characters where id = new.sender_character_id;
  if recipient_user is not null then
    insert into public.notifications(user_id, character_id, title, body, kind)
    values(recipient_user, new.recipient_character_id, 'Friend request',
      coalesce(sender_name, 'A player') || ' sent you a friend request.', 'friend_request');
  end if;
  return new;
end $$;
drop trigger if exists notify_friend_request_insert on public.player_friend_requests;
create trigger notify_friend_request_insert after insert on public.player_friend_requests
for each row execute function public.notify_friend_request();

create table if not exists public.player_online_presence (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now()
);
create index if not exists player_online_presence_seen_at_idx on public.player_online_presence(seen_at);
alter table public.player_online_presence enable row level security;
revoke all on public.player_online_presence from anon, authenticated;
grant select on public.player_online_presence to authenticated;
grant all on public.player_online_presence to service_role;
drop policy if exists "friends can see presence" on public.player_online_presence;
create policy "friends can see presence" on public.player_online_presence for select to authenticated
using (
  user_id = auth.uid() or exists (
    select 1 from public.characters self
    join public.player_friendships friendship on
      (friendship.first_character_id = self.id and friendship.second_character_id = player_online_presence.character_id)
      or (friendship.second_character_id = self.id and friendship.first_character_id = player_online_presence.character_id)
    where self.user_id = auth.uid()
  )
);

create or replace function public.touch_player_presence()
returns void language plpgsql security definer set search_path = public as $$
declare own_character uuid;
begin
  select id into own_character from public.characters where user_id = auth.uid() limit 1;
  if own_character is null then return; end if;
  insert into public.player_online_presence(character_id,user_id,seen_at)
  values(own_character,auth.uid(),now())
  on conflict(character_id) do update set seen_at=excluded.seen_at;
end $$;
revoke all on function public.touch_player_presence() from public, anon;
grant execute on function public.touch_player_presence() to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object or undefined_object then null; end;
  begin alter publication supabase_realtime add table public.player_online_presence;
  exception when duplicate_object or undefined_object then null; end;
end $$;
