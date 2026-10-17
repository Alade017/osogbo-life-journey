-- Server-authoritative player messaging. This synchronises the live Supabase project
-- with the existing client/API contract without granting direct browser writes.
-- It assumes the original player-social schema already exists (verified: social_messages,
-- social_conversations, get_social_messages).

alter table public.social_messages
  drop constraint if exists social_messages_body_check;
alter table public.social_messages
  add constraint social_messages_body_check check (char_length(body) between 1 and 1000);

alter table public.social_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists voice_path text,
  add column if not exists voice_duration_ms integer,
  add column if not exists reply_to_message_id uuid references public.social_messages(id) on delete set null;

alter table public.social_messages
  drop constraint if exists social_messages_message_type_check,
  add constraint social_messages_message_type_check check (message_type in ('text', 'voice'));
alter table public.social_messages
  drop constraint if exists social_message_voice_shape,
  add constraint social_message_voice_shape check (
    (message_type = 'text' and voice_path is null and voice_duration_ms is null)
    or (
      message_type = 'voice'
      and channel = 'private'
      and voice_path is not null
      and voice_duration_ms between 1000 and 60000
    )
  );

create index if not exists social_messages_reply_idx
  on public.social_messages(reply_to_message_id)
  where reply_to_message_id is not null;

create table if not exists public.thread_prefs (
  account_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.social_conversations(id) on delete cascade,
  pinned_at timestamptz,
  muted_until timestamptz,
  starred_at timestamptz,
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (account_id, thread_id)
);
create index if not exists thread_prefs_pinned_idx
  on public.thread_prefs(account_id, pinned_at)
  where pinned_at is not null;

create table if not exists public.social_inbox_events (
  id bigint generated always as identity primary key,
  account_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.social_conversations(id) on delete cascade,
  last_activity timestamptz not null default now(),
  unread_delta integer not null default 0 check (unread_delta between 0 and 1)
);
create index if not exists social_inbox_events_account_idx
  on public.social_inbox_events(account_id, id desc);

alter table public.thread_prefs enable row level security;
alter table public.social_inbox_events enable row level security;
grant select on public.thread_prefs, public.social_inbox_events to authenticated;
grant all on public.thread_prefs, public.social_inbox_events to service_role;
grant usage, select on sequence public.social_inbox_events_id_seq to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'thread_prefs'
      and policyname = 'thread_prefs_owner_read'
  ) then
    create policy thread_prefs_owner_read on public.thread_prefs
      for select to authenticated using ((select auth.uid()) = account_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'social_inbox_events'
      and policyname = 'social_inbox_events_owner_read'
  ) then
    create policy social_inbox_events_owner_read on public.social_inbox_events
      for select to authenticated using ((select auth.uid()) = account_id);
  end if;
end
$$;

-- The HTTP API authenticates the bearer token, then calls this service-role-only
-- function. The browser has no direct INSERT permission on social_messages.
drop function if exists public.send_social_message_as_user(uuid, text, text, uuid, uuid, uuid);
drop function if exists public.send_social_message_as_user(uuid, text, text, uuid, uuid, uuid, uuid);
create function public.send_social_message_as_user(
  p_user_id uuid,
  p_channel text,
  p_body text,
  p_request_id uuid,
  p_location_id uuid default null,
  p_conversation_id uuid default null,
  p_reply_to_message_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid;
  message public.social_messages%rowtype;
  reply_message public.social_messages%rowtype;
  conversation public.social_conversations%rowtype;
  clean_body text := trim(coalesce(p_body, ''));
  other_character_id uuid;
begin
  select id into me from public.characters where user_id = p_user_id limit 1;
  if me is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  if char_length(clean_body) not between 1 and 1000 then
    raise exception 'MESSAGE_LENGTH_INVALID';
  end if;

  perform 1 from public.characters where id = me for update;
  select * into message
    from public.social_messages
    where sender_character_id = me and request_id = p_request_id;
  if found then
    return to_jsonb(message) || jsonb_build_object('duplicate', true);
  end if;

  if (
    select count(*)
    from public.social_messages
    where sender_character_id = me and created_at > now() - interval '1 minute'
  ) >= 12 then
    raise exception 'MESSAGE_RATE_LIMIT';
  end if;

  if p_reply_to_message_id is not null then
    select * into reply_message from public.social_messages where id = p_reply_to_message_id;
    if not found
      or reply_message.channel <> p_channel
      or (p_channel = 'area' and reply_message.location_id is distinct from p_location_id)
      or (p_channel = 'private' and reply_message.conversation_id is distinct from p_conversation_id)
    then
      raise exception 'UNKNOWN_REPLY';
    end if;
  end if;

  if p_channel = 'area' then
    if p_location_id is null or p_conversation_id is not null then
      raise exception 'INVALID_DESTINATION';
    end if;
    if not exists (
      select 1 from public.characters where id = me and current_location_id = p_location_id
    ) then
      raise exception 'NOT_IN_AREA';
    end if;
    insert into public.social_messages(
      sender_character_id, channel, location_id, request_id, body, reply_to_message_id
    ) values (me, 'area', p_location_id, p_request_id, clean_body, p_reply_to_message_id)
    returning * into message;
  elsif p_channel = 'private' then
    if p_conversation_id is null or p_location_id is not null then
      raise exception 'INVALID_DESTINATION';
    end if;
    select * into conversation
      from public.social_conversations
      where id = p_conversation_id
      for update;
    if not found or (conversation.first_character_id <> me and conversation.second_character_id <> me) then
      raise exception 'UNKNOWN_THREAD';
    end if;

    other_character_id := case
      when conversation.first_character_id = me then conversation.second_character_id
      else conversation.first_character_id
    end;
    if exists (
      select 1 from public.player_blocks
      where (blocker_character_id = me and blocked_character_id = other_character_id)
         or (blocker_character_id = other_character_id and blocked_character_id = me)
    ) then
      raise exception 'RECIPIENT_BLOCKED';
    end if;
    if not exists (
      select 1 from public.player_friendships
      where first_character_id = least(me, other_character_id)
        and second_character_id = greatest(me, other_character_id)
    ) then
      raise exception 'NOT_FRIENDS';
    end if;

    insert into public.social_messages(
      sender_character_id, channel, conversation_id, request_id, body, reply_to_message_id
    ) values (me, 'private', p_conversation_id, p_request_id, clean_body, p_reply_to_message_id)
    returning * into message;
  else
    raise exception 'INVALID_CHANNEL';
  end if;

  return to_jsonb(message) || jsonb_build_object('duplicate', false);
end
$$;

create or replace function public.get_social_thread_summaries_as_user(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select id from public.characters where user_id = p_user_id limit 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', thread.id,
    'character_id', other_character.id,
    'player_name', other_character.name,
    'gender', other_character.gender,
    'appearance', other_character.appearance,
    'level', other_character.level,
    'created_at', thread.created_at,
    'last_activity', coalesce(last_message.created_at, thread.created_at),
    'preview', coalesce(last_message.body, ''),
    'unread_count', (
      select count(*)
      from public.social_messages unread
      where unread.conversation_id = thread.id
        and unread.sender_character_id <> me.id
        and unread.created_at > coalesce(pref.last_read_at, 'epoch'::timestamptz)
    ),
    'pinned_at', pref.pinned_at,
    'muted_until', pref.muted_until,
    'starred_at', pref.starred_at
  ) order by
    (pref.pinned_at is not null) desc,
    pref.pinned_at asc,
    coalesce(last_message.created_at, thread.created_at) desc), '[]'::jsonb)
  from me
  join public.social_conversations thread
    on me.id in (thread.first_character_id, thread.second_character_id)
  join public.characters other_character
    on other_character.id = case
      when thread.first_character_id = me.id then thread.second_character_id
      else thread.first_character_id
    end
  left join public.thread_prefs pref
    on pref.account_id = p_user_id and pref.thread_id = thread.id
  left join lateral (
    select body, created_at
    from public.social_messages
    where conversation_id = thread.id
    order by created_at desc
    limit 1
  ) last_message on true
  where not exists (
    select 1 from public.player_blocks blocked
    where (blocked.blocker_character_id = me.id and blocked.blocked_character_id = other_character.id)
       or (blocked.blocker_character_id = other_character.id and blocked.blocked_character_id = me.id)
  )
$$;

create or replace function public.thread_pref_action_as_user(
  p_user_id uuid,
  p_thread_id uuid,
  p_action text,
  p_duration text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pref public.thread_prefs%rowtype;
  pin_count integer;
  until_value timestamptz;
begin
  if not exists (
    select 1
    from public.social_conversations thread
    join public.characters me on me.user_id = p_user_id
    where thread.id = p_thread_id
      and me.id in (thread.first_character_id, thread.second_character_id)
  ) then
    raise exception 'UNKNOWN_THREAD';
  end if;

  perform 1 from auth.users where id = p_user_id for update;
  insert into public.thread_prefs(account_id, thread_id)
  values (p_user_id, p_thread_id)
  on conflict do nothing;
  select * into pref
    from public.thread_prefs
    where account_id = p_user_id and thread_id = p_thread_id
    for update;

  if p_action = 'pin' then
    if pref.pinned_at is null then
      select count(*) into pin_count
      from public.thread_prefs
      where account_id = p_user_id and pinned_at is not null;
      if pin_count >= 3 then raise exception 'PIN_LIMIT_REACHED'; end if;
      update public.thread_prefs
      set pinned_at = now(), updated_at = now()
      where account_id = p_user_id and thread_id = p_thread_id
      returning * into pref;
    end if;
  elsif p_action = 'unpin' then
    update public.thread_prefs
    set pinned_at = null, updated_at = now()
    where account_id = p_user_id and thread_id = p_thread_id
    returning * into pref;
  elsif p_action = 'mute' then
    if p_duration = '8h' then until_value := now() + interval '8 hours';
    elsif p_duration = '1w' then until_value := now() + interval '1 week';
    elsif p_duration = 'always' then until_value := 'infinity'::timestamptz;
    else raise exception 'INVALID_MUTE_DURATION';
    end if;
    update public.thread_prefs
    set muted_until = until_value, updated_at = now()
    where account_id = p_user_id and thread_id = p_thread_id
    returning * into pref;
  elsif p_action = 'unmute' then
    update public.thread_prefs
    set muted_until = null, updated_at = now()
    where account_id = p_user_id and thread_id = p_thread_id
    returning * into pref;
  elsif p_action = 'read' then
    update public.thread_prefs
    set last_read_at = now(), updated_at = now()
    where account_id = p_user_id and thread_id = p_thread_id
    returning * into pref;
  elsif p_action = 'star' then
    update public.thread_prefs
    set starred_at = coalesce(starred_at, now()), updated_at = now()
    where account_id = p_user_id and thread_id = p_thread_id
    returning * into pref;
  elsif p_action = 'unstar' then
    update public.thread_prefs
    set starred_at = null, updated_at = now()
    where account_id = p_user_id and thread_id = p_thread_id
    returning * into pref;
  else
    raise exception 'UNKNOWN_THREAD_ACTION';
  end if;

  return jsonb_build_object(
    'threadId', pref.thread_id,
    'pinnedAt', pref.pinned_at,
    'mutedUntil', pref.muted_until,
    'starredAt', pref.starred_at,
    'lastReadAt', pref.last_read_at
  );
end
$$;

create or replace function public._publish_social_inbox_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_account uuid;
  second_account uuid;
  sender_account uuid;
begin
  if new.channel <> 'private' then return new; end if;

  select first_character.user_id, second_character.user_id, sender_character.user_id
    into first_account, second_account, sender_account
  from public.social_conversations thread
  join public.characters first_character on first_character.id = thread.first_character_id
  join public.characters second_character on second_character.id = thread.second_character_id
  join public.characters sender_character on sender_character.id = new.sender_character_id
  where thread.id = new.conversation_id;

  insert into public.social_inbox_events(account_id, thread_id, last_activity, unread_delta)
  values
    (first_account, new.conversation_id, new.created_at, case when first_account = sender_account then 0 else 1 end),
    (second_account, new.conversation_id, new.created_at, case when second_account = sender_account then 0 else 1 end);
  return new;
end
$$;

drop trigger if exists social_message_inbox_event on public.social_messages;
create trigger social_message_inbox_event
  after insert on public.social_messages
  for each row execute function public._publish_social_inbox_event();

-- Player status is part of the phone social experience and is stored server-side.
create table if not exists public.player_status_posts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  owner_character_id uuid not null references public.characters(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 280),
  theme text not null check (theme in ('porcelain', 'leaf', 'ink', 'sunset')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  check (expires_at > created_at)
);
create index if not exists player_status_posts_active_idx
  on public.player_status_posts(owner_character_id, created_at desc)
  where expires_at > created_at;
alter table public.player_status_posts enable row level security;
grant select on public.player_status_posts to authenticated;
grant all on public.player_status_posts to service_role;
revoke insert, update, delete on public.player_status_posts from authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'player_status_posts'
      and policyname = 'player_status_friends_read'
  ) then
    create policy player_status_friends_read on public.player_status_posts
      for select to authenticated
      using (
        owner_user_id = (select auth.uid())
        or exists (
          select 1
          from public.characters me
          join public.player_friendships friendship
            on friendship.first_character_id = least(me.id, player_status_posts.owner_character_id)
           and friendship.second_character_id = greatest(me.id, player_status_posts.owner_character_id)
          where me.user_id = (select auth.uid())
        )
      );
  end if;
end
$$;

create or replace function public.get_friend_status_posts()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', status.id,
    'characterId', status.owner_character_id,
    'playerName', character.name,
    'appearance', character.appearance,
    'gender', character.gender,
    'body', status.body,
    'theme', status.theme,
    'createdAt', status.created_at,
    'expiresAt', status.expires_at,
    'isOwn', status.owner_user_id = auth.uid()
  ) order by status.created_at desc), '[]'::jsonb)
  from public.player_status_posts status
  join public.characters character on character.id = status.owner_character_id
  where status.expires_at > now()
    and (
      status.owner_user_id = auth.uid()
      or exists (
        select 1
        from public.characters me
        join public.player_friendships friendship
          on friendship.first_character_id = least(me.id, status.owner_character_id)
         and friendship.second_character_id = greatest(me.id, status.owner_character_id)
        where me.user_id = auth.uid()
      )
    )
$$;

create or replace function public.create_player_status(p_body text, p_theme text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_character_id uuid;
  clean_body text := btrim(coalesce(p_body, ''));
  row_id uuid;
begin
  select id into current_character_id
  from public.characters
  where user_id = current_user_id
  limit 1;
  if current_user_id is null or current_character_id is null then
    raise exception 'NO_CHARACTER';
  end if;
  if length(clean_body) not between 1 and 280 then raise exception 'STATUS_LENGTH_INVALID'; end if;
  if p_theme not in ('porcelain', 'leaf', 'ink', 'sunset') then raise exception 'INVALID_STATUS_THEME'; end if;
  insert into public.player_status_posts(owner_user_id, owner_character_id, body, theme)
  values (current_user_id, current_character_id, clean_body, p_theme)
  returning id into row_id;
  return jsonb_build_object('ok', true, 'id', row_id);
end
$$;

create or replace function public.delete_player_status(p_status_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.player_status_posts
  where id = p_status_id and owner_user_id = auth.uid();
  if not found then raise exception 'STATUS_NOT_FOUND'; end if;
  return jsonb_build_object('ok', true);
end
$$;

revoke all on function public.send_social_message_as_user(uuid, text, text, uuid, uuid, uuid, uuid),
  public.get_social_thread_summaries_as_user(uuid),
  public.thread_pref_action_as_user(uuid, uuid, text, text),
  public._publish_social_inbox_event()
  from public, anon, authenticated;
grant execute on function public.send_social_message_as_user(uuid, text, text, uuid, uuid, uuid, uuid),
  public.get_social_thread_summaries_as_user(uuid),
  public.thread_pref_action_as_user(uuid, uuid, text, text)
  to service_role;

revoke all on function public.get_friend_status_posts(),
  public.create_player_status(text, text),
  public.delete_player_status(uuid)
  from public, anon;
grant execute on function public.get_friend_status_posts(),
  public.create_player_status(text, text),
  public.delete_player_status(uuid)
  to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.social_messages;
  exception when duplicate_object or undefined_object or insufficient_privilege then null;
  end;
  begin
    alter publication supabase_realtime add table public.social_inbox_events;
  exception when duplicate_object or undefined_object or insufficient_privilege then null;
  end;
  begin
    alter publication supabase_realtime add table public.player_status_posts;
  exception when duplicate_object or undefined_object or insufficient_privilege then null;
  end;
end
$$;
