-- Group chats. Members must be friends with the person adding them, and nobody who has blocked
-- a member (or been blocked by one) can join. Tables are reachable only through the RPCs below.
create table public.social_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  created_by_character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.social_group_members (
  group_id uuid not null references public.social_groups(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, character_id)
);
create index social_group_members_character on public.social_group_members(character_id);

create table public.social_group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.social_groups(id) on delete cascade,
  sender_character_id uuid not null references public.characters(id) on delete cascade,
  request_id uuid not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (sender_character_id, request_id)
);
create index social_group_messages_history on public.social_group_messages(group_id, created_at desc);

alter table public.social_groups enable row level security;
alter table public.social_group_members enable row level security;
alter table public.social_group_messages enable row level security;
revoke all on public.social_groups, public.social_group_members, public.social_group_messages
  from public, anon, authenticated;

-- Caller is a member of the group.
create or replace function public._is_group_member(p_group_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.social_group_members m
    where m.group_id = p_group_id and m.character_id = public._my_social_character_id()
  )
$$;

-- Candidate may join: a friend of the caller, not already in the group, not blocked either way
-- with any current member, and the group has room (8 members).
create or replace function public._group_can_admit(p_group_id uuid, p_candidate uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
begin
  if me is null or p_candidate is null or p_candidate = me then return false; end if;
  if not exists (
    select 1 from public.player_friendships f
    where f.first_character_id = least(me, p_candidate)
      and f.second_character_id = greatest(me, p_candidate)
  ) then return false; end if;
  if (select count(*) from public.social_group_members where group_id = p_group_id) >= 8 then
    return false;
  end if;
  if exists (select 1 from public.social_group_members where group_id = p_group_id and character_id = p_candidate) then
    return false;
  end if;
  return not exists (
    select 1 from public.player_blocks b
    join public.social_group_members m on m.group_id = p_group_id
    where (b.blocker_character_id = p_candidate and b.blocked_character_id = m.character_id)
       or (b.blocker_character_id = m.character_id and b.blocked_character_id = p_candidate)
  );
end;
$$;

create or replace function public.create_social_group(p_name text, p_member_character_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
  clean_name text := trim(coalesce(p_name, ''));
  new_group_id uuid;
  candidate uuid;
begin
  if me is null then raise exception 'NO_CHARACTER'; end if;
  if char_length(clean_name) not between 1 and 40 then raise exception 'GROUP_NAME_INVALID'; end if;

  insert into public.social_groups(name, created_by_character_id)
    values (clean_name, me) returning id into new_group_id;
  insert into public.social_group_members(group_id, character_id) values (new_group_id, me);

  for candidate in
    select distinct u from unnest(coalesce(p_member_character_ids, '{}'::uuid[])) as u where u <> me
  loop
    if not public._group_can_admit(new_group_id, candidate) then
      raise exception 'GROUP_MEMBER_UNAVAILABLE';
    end if;
    insert into public.social_group_members(group_id, character_id) values (new_group_id, candidate);
  end loop;

  if (select count(*) from public.social_group_members where group_id = new_group_id) < 2 then
    raise exception 'GROUP_NEEDS_MEMBERS';
  end if;
  return jsonb_build_object('id', new_group_id, 'name', clean_name);
end;
$$;

create or replace function public.add_social_group_member(p_group_id uuid, p_character_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._is_group_member(p_group_id) then raise exception 'NOT_IN_GROUP'; end if;
  if not public._group_can_admit(p_group_id, p_character_id) then
    raise exception 'GROUP_MEMBER_UNAVAILABLE';
  end if;
  insert into public.social_group_members(group_id, character_id) values (p_group_id, p_character_id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.leave_social_group(p_group_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._is_group_member(p_group_id) then raise exception 'NOT_IN_GROUP'; end if;
  delete from public.social_group_members
    where group_id = p_group_id and character_id = public._my_social_character_id();
  -- The last member leaving removes the group and its history.
  if not exists (select 1 from public.social_group_members where group_id = p_group_id) then
    delete from public.social_groups where id = p_group_id;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.send_social_group_message(
  p_group_id uuid, p_body text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
  clean_body text := trim(coalesce(p_body, ''));
  message public.social_group_messages%rowtype;
  send_at timestamptz := clock_timestamp();
begin
  if me is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  if not public._is_group_member(p_group_id) then raise exception 'NOT_IN_GROUP'; end if;
  if char_length(clean_body) not between 1 and 500 then raise exception 'MESSAGE_LENGTH_INVALID'; end if;

  select * into message from public.social_group_messages
    where sender_character_id = me and request_id = p_request_id;
  if found then return to_jsonb(message) || jsonb_build_object('duplicate', true); end if;

  if (select count(*) from public.social_group_messages
      where sender_character_id = me and created_at > send_at - interval '1 minute') >= 12 then
    raise exception 'MESSAGE_RATE_LIMIT';
  end if;

  insert into public.social_group_messages(group_id, sender_character_id, request_id, body, created_at)
    values (p_group_id, me, p_request_id, clean_body, send_at)
    returning * into message;
  update public.social_groups set last_message_at = send_at where id = p_group_id;
  return to_jsonb(message) || jsonb_build_object('duplicate', false);
end;
$$;

create or replace function public.get_social_group_messages(p_group_id uuid, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_group_member(p_group_id) then raise exception 'NOT_IN_GROUP'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(recent) order by recent.created_at)
    from (
      select m.id, m.body, m.created_at, m.sender_character_id,
        c.name as sender_name
      from public.social_group_messages m
      join public.characters c on c.id = m.sender_character_id
      where m.group_id = p_group_id
      order by m.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)
    ) recent
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_social_groups_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
begin
  if me is null then raise exception 'NO_CHARACTER'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(g) order by g.last_message_at desc)
    from (
      select sg.id, sg.name, sg.created_at, sg.last_message_at,
        (select count(*)::integer from public.social_group_members x where x.group_id = sg.id) as member_count,
        (select jsonb_agg(c.name order by c.name)
           from public.social_group_members x join public.characters c on c.id = x.character_id
           where x.group_id = sg.id) as member_names,
        (select left(lm.body, 80) from public.social_group_messages lm
           where lm.group_id = sg.id order by lm.created_at desc limit 1) as last_body
      from public.social_groups sg
      join public.social_group_members mine on mine.group_id = sg.id and mine.character_id = me
    ) g
  ), '[]'::jsonb);
end;
$$;

-- Only signed-in players can call these; the functions check membership themselves.
revoke all on function public._is_group_member(uuid) from public, anon, authenticated;
revoke all on function public._group_can_admit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_social_group(text, uuid[]) from public, anon;
revoke all on function public.add_social_group_member(uuid, uuid) from public, anon;
revoke all on function public.leave_social_group(uuid) from public, anon;
revoke all on function public.send_social_group_message(uuid, text, uuid) from public, anon;
revoke all on function public.get_social_group_messages(uuid, integer) from public, anon;
revoke all on function public.get_social_groups_overview() from public, anon;
grant execute on function public.create_social_group(text, uuid[]) to authenticated;
grant execute on function public.add_social_group_member(uuid, uuid) to authenticated;
grant execute on function public.leave_social_group(uuid) to authenticated;
grant execute on function public.send_social_group_message(uuid, text, uuid) to authenticated;
grant execute on function public.get_social_group_messages(uuid, integer) to authenticated;
grant execute on function public.get_social_groups_overview() to authenticated;
notify pgrst, 'reload schema';
