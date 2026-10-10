-- Milestone 6: searchable player profiles, friends, private and area chat, blocks, and reports.
-- Character rows stay private; public profile data is exposed only through bounded RPCs.

create table public.player_friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_character_id uuid not null references public.characters(id) on delete cascade,
  recipient_character_id uuid not null references public.characters(id) on delete cascade,
  request_id uuid not null,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_character_id <> recipient_character_id),
  unique (sender_character_id, request_id)
);
create unique index player_friend_requests_one_pending_pair
  on public.player_friend_requests (least(sender_character_id, recipient_character_id), greatest(sender_character_id, recipient_character_id))
  where status = 'pending';
create index player_friend_requests_recipient_pending
  on public.player_friend_requests (recipient_character_id, created_at desc) where status = 'pending';
create index player_friend_requests_sender_history
  on public.player_friend_requests (sender_character_id, created_at desc);

create table public.player_friendships (
  first_character_id uuid not null references public.characters(id) on delete cascade,
  second_character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (first_character_id, second_character_id),
  check (first_character_id < second_character_id)
);
create index player_friendships_second_character on public.player_friendships(second_character_id, first_character_id);

create table public.player_blocks (
  blocker_character_id uuid not null references public.characters(id) on delete cascade,
  blocked_character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_character_id, blocked_character_id),
  check (blocker_character_id <> blocked_character_id)
);

create table public.social_conversations (
  id uuid primary key default gen_random_uuid(),
  first_character_id uuid not null references public.characters(id) on delete cascade,
  second_character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (first_character_id < second_character_id),
  unique (first_character_id, second_character_id)
);

create table public.social_messages (
  id uuid primary key default gen_random_uuid(),
  sender_character_id uuid not null references public.characters(id) on delete cascade,
  channel text not null check (channel in ('area','private')),
  location_id uuid references public.locations(id) on delete set null,
  conversation_id uuid references public.social_conversations(id) on delete cascade,
  request_id uuid not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (sender_character_id, request_id),
  check ((channel = 'area' and location_id is not null and conversation_id is null)
    or (channel = 'private' and location_id is null and conversation_id is not null))
);
create index social_messages_area_history on public.social_messages(location_id, created_at desc) where channel = 'area';
create index social_messages_private_history on public.social_messages(conversation_id, created_at desc) where channel = 'private';

create table public.player_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_character_id uuid not null references public.characters(id) on delete cascade,
  target_character_id uuid references public.characters(id) on delete set null,
  target_name_snapshot text not null,
  reported_message_id uuid references public.social_messages(id) on delete set null,
  category text not null check (category in ('spam','harassment','inappropriate_content','impersonation','other')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  check (target_character_id is null or reporter_character_id <> target_character_id)
);
create index player_reports_open_queue on public.player_reports(created_at) where status = 'open';

alter table public.player_friend_requests enable row level security;
alter table public.player_friendships enable row level security;
alter table public.player_blocks enable row level security;
alter table public.social_conversations enable row level security;
alter table public.social_messages enable row level security;
alter table public.player_reports enable row level security;

grant select on public.player_friend_requests, public.player_friendships, public.player_blocks,
  public.social_conversations, public.social_messages, public.player_reports to authenticated;
grant all on public.player_friend_requests, public.player_friendships, public.player_blocks,
  public.social_conversations, public.social_messages, public.player_reports to service_role;

create or replace function public._my_social_character_id() returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from public.characters c where c.user_id = auth.uid() limit 1
$$;

create or replace function public._social_blocked(p_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.player_blocks b where
    (b.blocker_character_id = public._my_social_character_id() and b.blocked_character_id = p_other)
    or (b.blocker_character_id = p_other and b.blocked_character_id = public._my_social_character_id()))
$$;

grant execute on function public._my_social_character_id(), public._social_blocked(uuid) to authenticated;
revoke all on function public._my_social_character_id(), public._social_blocked(uuid) from public;
grant execute on function public._my_social_character_id(), public._social_blocked(uuid) to authenticated;

create policy player_friend_requests_participant_read on public.player_friend_requests
  for select to authenticated using (
    sender_character_id = public._my_social_character_id()
    or recipient_character_id = public._my_social_character_id()
  );
create policy player_friendships_participant_read on public.player_friendships
  for select to authenticated using (
    first_character_id = public._my_social_character_id()
    or second_character_id = public._my_social_character_id()
  );
create policy player_blocks_owner_read on public.player_blocks
  for select to authenticated using (blocker_character_id = public._my_social_character_id());
create policy social_conversations_participant_read on public.social_conversations
  for select to authenticated using (
    (first_character_id = public._my_social_character_id() or second_character_id = public._my_social_character_id())
    and not public._social_blocked(case when first_character_id=public._my_social_character_id() then second_character_id else first_character_id end)
  );
create policy social_messages_authorized_read on public.social_messages
  for select to authenticated using (
    (
      channel = 'area'
      and location_id = (select c.current_location_id from public.characters c where c.id = public._my_social_character_id())
      and not public._social_blocked(sender_character_id)
    )
    or (
      channel = 'private'
      and exists (
        select 1 from public.social_conversations c
        where c.id = conversation_id
          and (c.first_character_id = public._my_social_character_id() or c.second_character_id = public._my_social_character_id())
          and not public._social_blocked(case when c.first_character_id=public._my_social_character_id() then c.second_character_id else c.first_character_id end)
      )
    )
  );
create policy player_reports_reporter_read on public.player_reports
  for select to authenticated using (reporter_character_id = public._my_social_character_id());

create or replace function public.search_player_profiles(p_query text, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
  needle text := lower(trim(coalesce(p_query, '')));
  result jsonb;
begin
  if me is null then raise exception 'Create a character before searching for players'; end if;
  if char_length(needle) < 2 or char_length(needle) > 24 then raise exception 'Search must be 2 to 24 characters'; end if;
  select coalesce(jsonb_agg(to_jsonb(matches) order by matches.player_name, matches.character_id), '[]'::jsonb) into result
  from (
    select c.id as character_id, c.name as player_name, c.gender, c.appearance, c.level,
      case when f.first_character_id is not null then 'friends'
        when r.sender_character_id = me then 'request_sent'
        when r.recipient_character_id = me then 'request_received'
        else 'none' end as relationship,
      r.id as request_id
    from public.characters c
    left join public.player_friendships f on f.first_character_id = least(me,c.id) and f.second_character_id = greatest(me,c.id)
    left join lateral (
      select fr.* from public.player_friend_requests fr
      where fr.status = 'pending'
        and least(fr.sender_character_id,fr.recipient_character_id) = least(me,c.id)
        and greatest(fr.sender_character_id,fr.recipient_character_id) = greatest(me,c.id)
      limit 1
    ) r on true
    where c.id <> me and position(needle in lower(c.name)) > 0
      and not public._social_blocked(c.id)
      and not exists(select 1 from public.player_blocks b where b.blocker_character_id=c.id and b.blocked_character_id=me)
    order by c.name, c.id
    limit greatest(1,least(coalesce(p_limit,20),20))
  ) matches;
  return result;
end
$$;

create or replace function public.get_player_profile(p_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
  result jsonb;
begin
  if me is null then raise exception 'Create a character before viewing player profiles'; end if;
  if p_character_id = me then raise exception 'This is your own profile'; end if;
  if public._social_blocked(p_character_id)
    or exists(select 1 from public.player_blocks b where b.blocker_character_id=p_character_id and b.blocked_character_id=me) then
    raise exception 'This player profile is unavailable';
  end if;
  select jsonb_build_object('character_id',c.id,'player_name',c.name,'gender',c.gender,
      'appearance',c.appearance,'level',c.level,
      'relationship',case when f.first_character_id is not null then 'friends'
        when r.sender_character_id=me then 'request_sent'
        when r.recipient_character_id=me then 'request_received' else 'none' end,
      'request_id',r.id)
    into result
  from public.characters c
  left join public.player_friendships f on f.first_character_id=least(me,c.id) and f.second_character_id=greatest(me,c.id)
  left join lateral (
    select fr.* from public.player_friend_requests fr
    where fr.status='pending' and least(fr.sender_character_id,fr.recipient_character_id)=least(me,c.id)
      and greatest(fr.sender_character_id,fr.recipient_character_id)=greatest(me,c.id) limit 1
  ) r on true
  where c.id=p_character_id;
  if result is null then raise exception 'Player profile not found'; end if;
  return result;
end
$$;

create or replace function public.get_player_social_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
begin
  if me is null then raise exception 'Create a character to use player social features'; end if;
  return jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('character_id',c.id,'player_name',c.name,'gender',c.gender,'appearance',c.appearance,'level',c.level,'created_at',f.created_at) order by c.name)
      from public.player_friendships f join public.characters c on c.id=case when f.first_character_id=me then f.second_character_id else f.first_character_id end
      where (f.first_character_id=me or f.second_character_id=me) and not public._social_blocked(c.id)), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'character_id',c.id,'player_name',c.name,'gender',c.gender,'appearance',c.appearance,'level',c.level,'created_at',r.created_at) order by r.created_at desc)
      from public.player_friend_requests r join public.characters c on c.id=r.sender_character_id
      where r.recipient_character_id=me and r.status='pending' and not public._social_blocked(c.id)), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'character_id',c.id,'player_name',c.name,'gender',c.gender,'appearance',c.appearance,'level',c.level,'created_at',r.created_at) order by r.created_at desc)
      from public.player_friend_requests r join public.characters c on c.id=r.recipient_character_id
      where r.sender_character_id=me and r.status='pending' and not public._social_blocked(c.id)), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('character_id',c.id,'player_name',c.name,'created_at',b.created_at) order by c.name)
      from public.player_blocks b join public.characters c on c.id=b.blocked_character_id where b.blocker_character_id=me), '[]'::jsonb),
    'conversations', coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'character_id',c.id,'player_name',c.name,'gender',c.gender,'appearance',c.appearance,'level',c.level,'created_at',v.created_at) order by v.created_at desc)
      from public.social_conversations v join public.characters c on c.id=case when v.first_character_id=me then v.second_character_id else v.first_character_id end
      where (v.first_character_id=me or v.second_character_id=me) and not public._social_blocked(c.id)), '[]'::jsonb)
  );
end
$$;

create or replace function public.send_player_friend_request(p_target_character_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
  existing public.player_friend_requests%rowtype;
  low_id uuid; high_id uuid;
begin
  if me is null then raise exception 'Create a character before adding friends'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  if p_target_character_id is null or p_target_character_id=me then raise exception 'Choose another player'; end if;
  perform 1 from public.characters where id=p_target_character_id;
  if not found then raise exception 'Player not found'; end if;
  if public._social_blocked(p_target_character_id)
    or exists(select 1 from public.player_blocks b where b.blocker_character_id=p_target_character_id and b.blocked_character_id=me) then
    raise exception 'This player is unavailable';
  end if;
  low_id:=least(me,p_target_character_id); high_id:=greatest(me,p_target_character_id);
  perform c.id from public.characters c where c.id in (low_id,high_id) order by c.id for update;
  if public._social_blocked(p_target_character_id)
    or exists(select 1 from public.player_blocks b where b.blocker_character_id=p_target_character_id and b.blocked_character_id=me) then
    raise exception 'This player is unavailable';
  end if;
  if exists(select 1 from public.player_friendships where first_character_id=low_id and second_character_id=high_id) then
    return jsonb_build_object('status','friends','duplicate',true);
  end if;
  select * into existing from public.player_friend_requests where sender_character_id=me and request_id=p_request_id;
  if found then return jsonb_build_object('status',existing.status,'request_id',existing.id,'duplicate',true); end if;
  if (select count(*) from public.player_friend_requests where sender_character_id=me and created_at>now()-interval '1 hour')>=20 then
    raise exception 'You have sent too many friend requests. Try again later';
  end if;
  select * into existing from public.player_friend_requests where status='pending'
    and least(sender_character_id,recipient_character_id)=low_id and greatest(sender_character_id,recipient_character_id)=high_id for update;
  if found then
    if existing.recipient_character_id=me then
      update public.player_friend_requests set status='accepted',responded_at=now() where id=existing.id;
      insert into public.player_friendships(first_character_id,second_character_id) values(low_id,high_id) on conflict do nothing;
      return jsonb_build_object('status','friends','request_id',existing.id,'duplicate',false,'accepted_reciprocal',true);
    end if;
    return jsonb_build_object('status','request_sent','request_id',existing.id,'duplicate',true);
  end if;
  insert into public.player_friend_requests(sender_character_id,recipient_character_id,request_id)
    values(me,p_target_character_id,p_request_id) returning * into existing;
  return jsonb_build_object('status','request_sent','request_id',existing.id,'duplicate',false);
end
$$;

create or replace function public.respond_player_friend_request(p_request_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._my_social_character_id(); r public.player_friend_requests%rowtype;
begin
  if me is null then raise exception 'Create a character before responding to friend requests'; end if;
  select * into r from public.player_friend_requests where id=p_request_id for update;
  if not found or r.recipient_character_id<>me then raise exception 'Friend request not found'; end if;
  if r.status<>'pending' then return jsonb_build_object('status',r.status,'duplicate',true); end if;
  if public._social_blocked(r.sender_character_id) then raise exception 'This player is unavailable'; end if;
  if p_accept then
    update public.player_friend_requests set status='accepted',responded_at=now() where id=r.id;
    insert into public.player_friendships(first_character_id,second_character_id)
      values(least(me,r.sender_character_id),greatest(me,r.sender_character_id)) on conflict do nothing;
    return jsonb_build_object('status','friends','duplicate',false);
  end if;
  update public.player_friend_requests set status='rejected',responded_at=now() where id=r.id;
  return jsonb_build_object('status','rejected','duplicate',false);
end
$$;

create or replace function public.cancel_player_friend_request(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._my_social_character_id(); r public.player_friend_requests%rowtype;
begin
  if me is null then raise exception 'Sign in to cancel friend requests'; end if;
  select * into r from public.player_friend_requests where id=p_request_id for update;
  if not found or r.sender_character_id<>me then raise exception 'Outgoing friend request not found'; end if;
  if r.status='pending' then update public.player_friend_requests set status='cancelled',responded_at=now() where id=r.id; end if;
  return jsonb_build_object('status','cancelled','duplicate',r.status<>'pending');
end
$$;

create or replace function public.remove_player_friend(p_target_character_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._my_social_character_id();
begin
  if me is null then raise exception 'Sign in to manage friends'; end if;
  delete from public.player_friendships where first_character_id=least(me,p_target_character_id) and second_character_id=greatest(me,p_target_character_id);
  return jsonb_build_object('removed',found);
end
$$;

create or replace function public.block_player(p_target_character_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._my_social_character_id(); low_id uuid; high_id uuid;
begin
  if me is null then raise exception 'Sign in to block players'; end if;
  if p_target_character_id is null or p_target_character_id=me then raise exception 'Choose another player'; end if;
  perform 1 from public.characters where id=p_target_character_id;
  if not found then raise exception 'Player not found'; end if;
  low_id:=least(me,p_target_character_id); high_id:=greatest(me,p_target_character_id);
  perform c.id from public.characters c where c.id in (low_id,high_id) order by c.id for update;
  insert into public.player_blocks(blocker_character_id,blocked_character_id) values(me,p_target_character_id) on conflict do nothing;
  delete from public.player_friendships where first_character_id=least(me,p_target_character_id) and second_character_id=greatest(me,p_target_character_id);
  update public.player_friend_requests set status='cancelled',responded_at=now()
    where status='pending' and (sender_character_id=me and recipient_character_id=p_target_character_id
      or sender_character_id=p_target_character_id and recipient_character_id=me);
  return jsonb_build_object('blocked',true);
end
$$;

create or replace function public.unblock_player(p_target_character_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._my_social_character_id();
begin
  if me is null then raise exception 'Sign in to manage blocked players'; end if;
  delete from public.player_blocks where blocker_character_id=me and blocked_character_id=p_target_character_id;
  return jsonb_build_object('unblocked',found);
end
$$;

create or replace function public.get_or_create_player_conversation(p_target_character_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._my_social_character_id(); low_id uuid; high_id uuid; conversation public.social_conversations%rowtype;
begin
  if me is null then raise exception 'Sign in to message players'; end if;
  if me=p_target_character_id or p_target_character_id is null then raise exception 'Choose another player'; end if;
  if public._social_blocked(p_target_character_id)
    or exists(select 1 from public.player_blocks b where b.blocker_character_id=p_target_character_id and b.blocked_character_id=me) then raise exception 'This player is unavailable'; end if;
  low_id:=least(me,p_target_character_id); high_id:=greatest(me,p_target_character_id);
  if not exists(select 1 from public.player_friendships where first_character_id=low_id and second_character_id=high_id) then raise exception 'Become friends before starting a private conversation'; end if;
  insert into public.social_conversations(first_character_id,second_character_id) values(low_id,high_id)
    on conflict(first_character_id,second_character_id) do update set first_character_id=excluded.first_character_id returning * into conversation;
  return jsonb_build_object('id',conversation.id,'created_at',conversation.created_at);
end
$$;

create or replace function public.send_social_message(
  p_channel text, p_body text, p_request_id uuid, p_location_id uuid default null, p_conversation_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
  message public.social_messages%rowtype;
  conversation public.social_conversations%rowtype;
  clean_body text := trim(coalesce(p_body,''));
begin
  if me is null then raise exception 'Sign in to send messages'; end if;
  if p_request_id is null then raise exception 'Message request ID is required'; end if;
  if char_length(clean_body)<1 or char_length(clean_body)>500 then raise exception 'Messages must be 1 to 500 characters'; end if;
  perform 1 from public.characters where id=me for update;
  select * into message from public.social_messages where sender_character_id=me and request_id=p_request_id;
  if found then return to_jsonb(message) || jsonb_build_object('duplicate',true); end if;
  if (select count(*) from public.social_messages where sender_character_id=me and created_at>now()-interval '1 minute')>=12 then
    raise exception 'You are sending messages too quickly. Try again in a moment';
  end if;
  if p_channel='area' then
    if p_location_id is null or p_conversation_id is not null then raise exception 'Choose a valid area chat'; end if;
    if not exists(select 1 from public.characters where id=me and current_location_id=p_location_id) then raise exception 'Travel to this area before chatting here'; end if;
    insert into public.social_messages(sender_character_id,channel,location_id,request_id,body)
      values(me,'area',p_location_id,p_request_id,clean_body) returning * into message;
  elsif p_channel='private' then
    if p_conversation_id is null or p_location_id is not null then raise exception 'Choose a valid private conversation'; end if;
    select * into conversation from public.social_conversations where id=p_conversation_id for update;
    if not found or (conversation.first_character_id<>me and conversation.second_character_id<>me) then raise exception 'Conversation not found'; end if;
    if public._social_blocked(case when conversation.first_character_id=me then conversation.second_character_id else conversation.first_character_id end) then raise exception 'This conversation is unavailable'; end if;
    if not exists(select 1 from public.player_friendships where first_character_id=conversation.first_character_id and second_character_id=conversation.second_character_id) then raise exception 'Become friends before sending private messages'; end if;
    insert into public.social_messages(sender_character_id,channel,conversation_id,request_id,body)
      values(me,'private',p_conversation_id,p_request_id,clean_body) returning * into message;
  else raise exception 'Unknown message channel'; end if;
  return to_jsonb(message) || jsonb_build_object('duplicate',false);
end
$$;

create or replace function public.get_social_messages(p_location_id uuid default null, p_conversation_id uuid default null, p_before timestamptz default null, p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := public._my_social_character_id(); result jsonb;
begin
  if me is null then raise exception 'Sign in to read messages'; end if;
  if (p_location_id is null)=(p_conversation_id is null) then raise exception 'Choose one message channel'; end if;
  if p_location_id is not null and not exists(select 1 from public.characters where id=me and current_location_id=p_location_id) then raise exception 'Travel to this area to read its chat'; end if;
  if p_conversation_id is not null and not exists(
    select 1 from public.social_conversations c join public.player_friendships f on f.first_character_id=c.first_character_id and f.second_character_id=c.second_character_id
    where c.id=p_conversation_id and (c.first_character_id=me or c.second_character_id=me)
      and not public._social_blocked(case when c.first_character_id=me then c.second_character_id else c.first_character_id end)
  ) then raise exception 'Conversation not found'; end if;
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.created_at),'[]'::jsonb) into result from (
    select m.id,m.sender_character_id,c.name as sender_name,m.channel,m.location_id,m.conversation_id,m.body,m.created_at
    from public.social_messages m join public.characters c on c.id=m.sender_character_id
    where (p_location_id is not null and m.channel='area' and m.location_id=p_location_id
      or p_conversation_id is not null and m.channel='private' and m.conversation_id=p_conversation_id)
      and (p_before is null or m.created_at<p_before)
      and (m.sender_character_id=me or not public._social_blocked(m.sender_character_id))
    order by m.created_at desc limit greatest(1,least(coalesce(p_limit,50),100))
  ) rows;
  return result;
end
$$;

create or replace function public.report_player(p_target_character_id uuid, p_category text, p_details text default '', p_message_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := public._my_social_character_id(); target_name text; message public.social_messages%rowtype; report_id uuid;
begin
  if me is null then raise exception 'Sign in to report a player'; end if;
  perform 1 from public.characters where id=me for update;
  if p_target_character_id is null or p_target_character_id=me then raise exception 'Choose another player'; end if;
  if p_category not in ('spam','harassment','inappropriate_content','impersonation','other') then raise exception 'Choose a report reason'; end if;
  if char_length(trim(coalesce(p_details,'')))>1000 then raise exception 'Report details must be at most 1000 characters'; end if;
  select name into target_name from public.characters where id=p_target_character_id;
  if target_name is null then raise exception 'Player not found'; end if;
  if p_message_id is not null then
    select * into message from public.social_messages where id=p_message_id;
    if not found or message.sender_character_id<>p_target_character_id then raise exception 'Choose a message from this player'; end if;
    if message.channel='private' and not exists(select 1 from public.social_conversations c where c.id=message.conversation_id and (c.first_character_id=me or c.second_character_id=me)) then raise exception 'Message not found'; end if;
    if message.channel='area' and not exists(select 1 from public.characters where id=me and current_location_id=message.location_id) then raise exception 'Message not found'; end if;
  end if;
  if (select count(*) from public.player_reports where reporter_character_id=me and created_at>now()-interval '1 hour')>=3 then
    raise exception 'You have sent too many reports. Try again later';
  end if;
  insert into public.player_reports(reporter_character_id,target_character_id,target_name_snapshot,reported_message_id,category,details)
    values(me,p_target_character_id,target_name,p_message_id,p_category,trim(coalesce(p_details,''))) returning id into report_id;
  return jsonb_build_object('report_id',report_id,'status','open');
end
$$;

revoke all on function public.search_player_profiles(text,integer), public.get_player_profile(uuid),
  public.get_player_social_overview(), public.send_player_friend_request(uuid,uuid),
  public.respond_player_friend_request(uuid,boolean), public.cancel_player_friend_request(uuid),
  public.remove_player_friend(uuid), public.block_player(uuid), public.unblock_player(uuid),
  public.get_or_create_player_conversation(uuid), public.send_social_message(text,text,uuid,uuid,uuid),
  public.get_social_messages(uuid,uuid,timestamptz,integer), public.report_player(uuid,text,text,uuid) from public;
grant execute on function public.search_player_profiles(text,integer), public.get_player_profile(uuid),
  public.get_player_social_overview(), public.send_player_friend_request(uuid,uuid),
  public.respond_player_friend_request(uuid,boolean), public.cancel_player_friend_request(uuid),
  public.remove_player_friend(uuid), public.block_player(uuid), public.unblock_player(uuid),
  public.get_or_create_player_conversation(uuid), public.send_social_message(text,text,uuid,uuid,uuid),
  public.get_social_messages(uuid,uuid,timestamptz,integer), public.report_player(uuid,text,text,uuid) to authenticated;

-- Realtime provides low-latency delivery; table RLS still filters each subscriber's rows.
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.social_messages';
  exception when undefined_object or undefined_table or insufficient_privilege or duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.player_friend_requests';
  exception when undefined_object or undefined_table or insufficient_privilege or duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.player_friendships';
  exception when undefined_object or undefined_table or insufficient_privilege or duplicate_object then null; end;
end $$;
