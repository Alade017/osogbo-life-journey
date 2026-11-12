-- Group chats: voice notes and pictures, emoji reactions (one per member per message),
-- and per-member pinning and muting. Media rows keep their storage path private; clients get a
-- short-lived signed link from the server only after a membership check.

alter table public.social_group_messages alter column body drop not null;
alter table public.social_group_messages drop constraint if exists social_group_messages_body_check;
alter table public.social_group_messages
  add column if not exists kind text not null default 'text' check (kind in ('text', 'voice', 'image')),
  add column if not exists media_path text,
  add column if not exists duration_ms integer;
alter table public.social_group_messages add constraint social_group_messages_shape check (
  (kind = 'text' and body is not null and char_length(body) between 1 and 500
     and media_path is null and duration_ms is null)
  or (kind = 'voice' and body is null and media_path is not null
     and duration_ms between 1000 and 60000)
  or (kind = 'image' and body is null and media_path is not null and duration_ms is null)
);

create table public.social_group_reactions (
  message_id uuid not null references public.social_group_messages(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮', '🙏')),
  created_at timestamptz not null default now(),
  primary key (message_id, character_id)
);

create table public.social_group_prefs (
  group_id uuid not null references public.social_groups(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  pinned_at timestamptz,
  muted boolean not null default false,
  primary key (group_id, character_id)
);

alter table public.social_group_reactions enable row level security;
alter table public.social_group_prefs enable row level security;
revoke all on public.social_group_reactions, public.social_group_prefs from public, anon, authenticated;

-- Messages a member can read. Storage paths are never returned to clients.
create or replace function public.get_social_group_messages(p_group_id uuid, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
begin
  if not public._is_group_member(p_group_id) then raise exception 'NOT_IN_GROUP'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(recent) order by recent.created_at)
    from (
      select m.id, m.body, m.kind, m.duration_ms, m.created_at, m.sender_character_id,
        c.name as sender_name,
        (select coalesce(jsonb_agg(jsonb_build_object('emoji', r.emoji, 'count', r.n, 'mine', r.mine)
                  order by r.emoji), '[]'::jsonb)
           from (
             select rx.emoji, count(*)::integer as n, bool_or(rx.character_id = me) as mine
             from public.social_group_reactions rx
             where rx.message_id = m.id
             group by rx.emoji
           ) r) as reactions
      from public.social_group_messages m
      join public.characters c on c.id = m.sender_character_id
      where m.group_id = p_group_id
      order by m.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) recent
  ), '[]'::jsonb);
end;
$$;

-- Groups I belong to: pinned first, muted last, then most recent. Includes my pin and mute state.
create or replace function public.get_social_groups_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
begin
  if me is null then raise exception 'NO_CHARACTER'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(g) order by g.muted, (g.pinned_at is null), g.pinned_at, g.last_message_at desc)
    from (
      select sg.id, sg.name, sg.created_at, sg.last_message_at,
        p.pinned_at, coalesce(p.muted, false) as muted,
        (select count(*)::integer from public.social_group_members x where x.group_id = sg.id) as member_count,
        (select jsonb_agg(c.name order by c.name)
           from public.social_group_members x join public.characters c on c.id = x.character_id
           where x.group_id = sg.id) as member_names,
        (select case lm.kind when 'text' then left(lm.body, 80) when 'voice' then 'Voice note' else 'Picture' end
           from public.social_group_messages lm
           where lm.group_id = sg.id order by lm.created_at desc limit 1) as last_body
      from public.social_groups sg
      join public.social_group_members mine on mine.group_id = sg.id and mine.character_id = me
      left join public.social_group_prefs p on p.group_id = sg.id and p.character_id = me
    ) g
  ), '[]'::jsonb);
end;
$$;

-- Service-role only: the server has already stored the file and authenticated the user.
create or replace function public.send_social_group_media_as_user(
  p_user_id uuid, p_group_id uuid, p_kind text, p_path text, p_duration_ms integer, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid;
  message public.social_group_messages%rowtype;
  send_at timestamptz := clock_timestamp();
begin
  select id into me from public.characters where user_id = p_user_id limit 1;
  if me is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  perform 1 from public.characters where id = me for update;

  select * into message from public.social_group_messages
    where sender_character_id = me and request_id = p_request_id;
  if found then return to_jsonb(message) || jsonb_build_object('duplicate', true); end if;

  if not exists (
    select 1 from public.social_group_members where group_id = p_group_id and character_id = me
  ) then raise exception 'NOT_IN_GROUP'; end if;
  if p_kind not in ('voice', 'image') then raise exception 'MEDIA_KIND_INVALID'; end if;
  -- The path must be exactly this group, this request, and an allowed extension.
  if p_path is null
    or p_path not like 'group/' || p_group_id::text || '/' || p_request_id::text || '.%'
    or not ((p_kind = 'voice' and p_path like '%.ogg')
         or (p_kind = 'image' and (p_path like '%.jpg' or p_path like '%.png' or p_path like '%.webp')))
  then raise exception 'MEDIA_PATH_INVALID'; end if;
  if p_kind = 'voice' and (p_duration_ms is null or p_duration_ms not between 1000 and 60000) then
    raise exception 'VOICE_DURATION_INVALID';
  end if;

  if (select count(*) from public.social_group_messages
      where sender_character_id = me and created_at > send_at - interval '1 minute') >= 12 then
    raise exception 'MESSAGE_RATE_LIMIT';
  end if;

  insert into public.social_group_messages(
    group_id, sender_character_id, request_id, kind, media_path, duration_ms, created_at
  ) values (p_group_id, me, p_request_id, p_kind, p_path,
    case when p_kind = 'voice' then p_duration_ms else null end, send_at)
  returning * into message;
  update public.social_groups set last_message_at = send_at where id = p_group_id;
  return to_jsonb(message) || jsonb_build_object('duplicate', false);
end;
$$;

-- Service-role only: returns the storage path for a member, so the server can sign a link.
create or replace function public.get_social_group_media_as_user(p_user_id uuid, p_message_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid;
  message public.social_group_messages%rowtype;
begin
  select id into me from public.characters where user_id = p_user_id limit 1;
  if me is null then raise exception 'NO_CHARACTER'; end if;
  select * into message from public.social_group_messages where id = p_message_id;
  if not found or message.media_path is null then raise exception 'MEDIA_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.social_group_members
    where group_id = message.group_id and character_id = me
  ) then raise exception 'NOT_IN_GROUP'; end if;
  return jsonb_build_object('kind', message.kind, 'path', message.media_path);
end;
$$;

create or replace function public.toggle_social_group_reaction(p_message_id uuid, p_emoji text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
  group_id_value uuid;
  existing text;
begin
  if me is null then raise exception 'NO_CHARACTER'; end if;
  if p_emoji not in ('👍', '❤️', '😂', '😮', '🙏') then raise exception 'REACTION_INVALID'; end if;
  select group_id into group_id_value from public.social_group_messages where id = p_message_id;
  if group_id_value is null or not public._is_group_member(group_id_value) then
    raise exception 'NOT_IN_GROUP';
  end if;

  select emoji into existing from public.social_group_reactions
    where message_id = p_message_id and character_id = me;
  if existing = p_emoji then
    delete from public.social_group_reactions where message_id = p_message_id and character_id = me;
    return jsonb_build_object('emoji', null);
  end if;
  insert into public.social_group_reactions(message_id, character_id, emoji)
    values (p_message_id, me, p_emoji)
    on conflict (message_id, character_id) do update set emoji = excluded.emoji, created_at = now();
  return jsonb_build_object('emoji', p_emoji);
end;
$$;

create or replace function public.set_social_group_prefs(p_group_id uuid, p_pinned boolean, p_muted boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
begin
  if me is null then raise exception 'NO_CHARACTER'; end if;
  if not public._is_group_member(p_group_id) then raise exception 'NOT_IN_GROUP'; end if;
  insert into public.social_group_prefs(group_id, character_id, pinned_at, muted)
    values (p_group_id, me, case when p_pinned then now() else null end, coalesce(p_muted, false))
    on conflict (group_id, character_id) do update set
      pinned_at = case
        when not p_pinned then null
        else coalesce(public.social_group_prefs.pinned_at, now()) end,
      muted = coalesce(p_muted, false);
  return jsonb_build_object('pinned', p_pinned, 'muted', coalesce(p_muted, false));
end;
$$;

revoke all on function public.send_social_group_media_as_user(uuid, uuid, text, text, integer, uuid)
  from public, anon, authenticated;
revoke all on function public.get_social_group_media_as_user(uuid, uuid) from public, anon, authenticated;
grant execute on function public.send_social_group_media_as_user(uuid, uuid, text, text, integer, uuid)
  to service_role;
grant execute on function public.get_social_group_media_as_user(uuid, uuid) to service_role;

revoke all on function public.toggle_social_group_reaction(uuid, text) from public, anon;
revoke all on function public.set_social_group_prefs(uuid, boolean, boolean) from public, anon;
grant execute on function public.toggle_social_group_reaction(uuid, text) to authenticated;
grant execute on function public.set_social_group_prefs(uuid, boolean, boolean) to authenticated;
notify pgrst, 'reload schema';
