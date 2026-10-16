-- Private voice notes. Files remain private and are served through short-lived signed URLs.
alter table public.social_messages add column message_type text not null default 'text' check (message_type in ('text','voice'));
alter table public.social_messages add column voice_path text;
alter table public.social_messages add column voice_duration_ms integer;
alter table public.social_messages add column reply_to_message_id uuid references public.social_messages(id) on delete set null;
create index social_messages_reply on public.social_messages(reply_to_message_id) where reply_to_message_id is not null;
alter table public.social_messages add constraint social_message_voice_shape check (
  (message_type='text' and voice_path is null and voice_duration_ms is null)
  or (message_type='voice' and channel='private' and voice_path is not null and voice_duration_ms between 1000 and 60000)
);

create table public.social_message_stars (
  account_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references public.social_messages(id) on delete cascade,
  starred_at timestamptz not null default now(),
  primary key(account_id,message_id)
);
alter table public.social_message_stars enable row level security;
create policy social_message_stars_owner_read on public.social_message_stars for select to authenticated using(account_id=auth.uid());
grant select on public.social_message_stars to authenticated;
grant all on public.social_message_stars to service_role;

-- The API may attach a reply from the same destination. Raw reply bodies never enter inbox events.
drop function public.send_social_message_as_user(uuid,text,text,uuid,uuid,uuid);
create function public.send_social_message_as_user(
  p_user_id uuid,
  p_channel text,
  p_body text,
  p_request_id uuid,
  p_location_id uuid default null,
  p_conversation_id uuid default null,
  p_reply_to_message_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  me uuid;
  message public.social_messages%rowtype;
  reply public.social_messages%rowtype;
  conversation public.social_conversations%rowtype;
  clean_body text:=trim(coalesce(p_body,''));
begin
  select id into me from public.characters where user_id=p_user_id limit 1;
  if me is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  if char_length(clean_body)<1 or char_length(clean_body)>1000 then raise exception 'MESSAGE_LENGTH_INVALID'; end if;
  perform 1 from public.characters where id=me for update;
  select * into message from public.social_messages where sender_character_id=me and request_id=p_request_id;
  if found then return to_jsonb(message)||jsonb_build_object('duplicate',true); end if;
  if (select count(*) from public.social_messages where sender_character_id=me and created_at>now()-interval '1 minute')>=12 then
    raise exception 'MESSAGE_RATE_LIMIT';
  end if;
  if p_reply_to_message_id is not null then
    select * into reply from public.social_messages where id=p_reply_to_message_id;
    if not found or reply.channel<>p_channel
      or (p_channel='area' and reply.location_id is distinct from p_location_id)
      or (p_channel='private' and reply.conversation_id is distinct from p_conversation_id)
    then raise exception 'UNKNOWN_REPLY'; end if;
  end if;
  if p_channel='area' then
    if p_location_id is null or p_conversation_id is not null then raise exception 'INVALID_DESTINATION'; end if;
    if not exists(select 1 from public.characters where id=me and current_location_id=p_location_id) then raise exception 'NOT_IN_AREA'; end if;
    insert into public.social_messages(sender_character_id,channel,location_id,request_id,body,reply_to_message_id)
      values(me,'area',p_location_id,p_request_id,clean_body,p_reply_to_message_id) returning * into message;
  elsif p_channel='private' then
    if p_conversation_id is null or p_location_id is not null then raise exception 'INVALID_DESTINATION'; end if;
    select * into conversation from public.social_conversations where id=p_conversation_id for update;
    if not found or (conversation.first_character_id<>me and conversation.second_character_id<>me) then raise exception 'UNKNOWN_THREAD'; end if;
    if exists(select 1 from public.player_blocks where
      (blocker_character_id=me and blocked_character_id=case when conversation.first_character_id=me then conversation.second_character_id else conversation.first_character_id end)
      or (blocked_character_id=me and blocker_character_id=case when conversation.first_character_id=me then conversation.second_character_id else conversation.first_character_id end))
    then raise exception 'RECIPIENT_BLOCKED'; end if;
    if not exists(select 1 from public.player_friendships where first_character_id=conversation.first_character_id and second_character_id=conversation.second_character_id) then raise exception 'NOT_FRIENDS'; end if;
    insert into public.social_messages(sender_character_id,channel,conversation_id,request_id,body,reply_to_message_id)
      values(me,'private',p_conversation_id,p_request_id,clean_body,p_reply_to_message_id) returning * into message;
  else raise exception 'INVALID_CHANNEL'; end if;
  return to_jsonb(message)||jsonb_build_object('duplicate',false);
end
$$;
revoke all on function public.send_social_message_as_user(uuid,text,text,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.send_social_message_as_user(uuid,text,text,uuid,uuid,uuid,uuid) to service_role;

do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
      values('social-voice-notes','social-voice-notes',false,512000,array['audio/ogg','audio/webm'])
      on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
  end if;
end $$;

create or replace function public.create_voice_message_as_user(
  p_user_id uuid,p_thread_id uuid,p_path text,p_duration_ms integer,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare me uuid; other uuid; message public.social_messages%rowtype;
begin
  select c.id into me from public.characters c where c.user_id=p_user_id limit 1;
  if me is null then raise exception 'NO_CHARACTER'; end if;
  select case when t.first_character_id=me then t.second_character_id else t.first_character_id end into other
    from public.social_conversations t where t.id=p_thread_id and me in(t.first_character_id,t.second_character_id);
  if other is null then raise exception 'UNKNOWN_THREAD'; end if;
  if p_duration_ms<1000 or p_duration_ms>60000 then raise exception 'INVALID_VOICE_DURATION'; end if;
  if p_path is null or p_path not like 'voice/'||p_thread_id::text||'/%' then raise exception 'INVALID_VOICE_PATH'; end if;
  select * into message from public.social_messages where sender_character_id=me and request_id=p_request_id;
  if found then return to_jsonb(message)||jsonb_build_object('duplicate',true,'delivered',true); end if;
  if exists(select 1 from public.player_blocks where
    (blocker_character_id=me and blocked_character_id=other)
    or (blocker_character_id=other and blocked_character_id=me)) then
    return jsonb_build_object('accepted',true,'delivered',false);
  end if;
  if not exists(select 1 from public.player_friendships where first_character_id=least(me,other) and second_character_id=greatest(me,other)) then raise exception 'NOT_FRIENDS'; end if;
  insert into public.social_messages(sender_character_id,channel,conversation_id,request_id,body,message_type,voice_path,voice_duration_ms)
    values(me,'private',p_thread_id,p_request_id,'Voice note','voice',p_path,p_duration_ms) returning * into message;
  return to_jsonb(message)||jsonb_build_object('duplicate',false,'delivered',true);
end
$$;

create or replace function public.get_voice_note_as_user(p_user_id uuid,p_message_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object('path',m.voice_path,'durationMs',m.voice_duration_ms)
  from public.social_messages m join public.social_conversations t on t.id=m.conversation_id
  join public.characters c on c.user_id=p_user_id and c.id in(t.first_character_id,t.second_character_id)
  where m.id=p_message_id and m.message_type='voice'
$$;

create or replace function public.get_social_messages(p_location_id uuid default null,p_conversation_id uuid default null,p_before timestamptz default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare me uuid:=public._my_social_character_id(); result jsonb;
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
    select m.id,m.sender_character_id,c.name as sender_name,m.channel,m.location_id,m.conversation_id,m.body,m.created_at,
      m.message_type,m.voice_duration_ms,m.reply_to_message_id,
      reply.message_type as reply_message_type,reply.voice_duration_ms as reply_voice_duration_ms,
      reply.body as reply_body,reply_sender.name as reply_sender_name
    from public.social_messages m join public.characters c on c.id=m.sender_character_id
    left join public.social_messages reply on reply.id=m.reply_to_message_id
    left join public.characters reply_sender on reply_sender.id=reply.sender_character_id
    where (p_location_id is not null and m.channel='area' and m.location_id=p_location_id
      or p_conversation_id is not null and m.channel='private' and m.conversation_id=p_conversation_id)
      and (p_before is null or m.created_at<p_before)
      and (m.sender_character_id=me or not public._social_blocked(m.sender_character_id))
    order by m.created_at desc limit greatest(1,least(coalesce(p_limit,50),100))
  ) rows;
  return result;
end
$$;

-- The daily server job removes Storage objects first, then finalizes matching database rows.
create or replace function public.list_expired_voice_notes()
returns table(message_id uuid,path text) language sql stable security definer set search_path=public as $$
  select m.id,m.voice_path from public.social_messages m
  where m.message_type='voice' and m.created_at<now()-interval '30 days'
    and not exists(select 1 from public.social_message_stars s where s.message_id=m.id)
    and not exists(select 1 from public.player_reports r where r.reported_message_id=m.id)
  order by m.created_at limit 500
$$;

create or replace function public.finalize_expired_voice_notes(p_message_ids uuid[])
returns integer language plpgsql security definer set search_path=public as $$
declare removed integer;
begin
  delete from public.social_messages m where m.id=any(coalesce(p_message_ids,'{}'::uuid[]))
    and m.message_type='voice' and m.created_at<now()-interval '30 days'
    and not exists(select 1 from public.social_message_stars s where s.message_id=m.id)
    and not exists(select 1 from public.player_reports r where r.reported_message_id=m.id);
  get diagnostics removed=row_count;
  return removed;
end
$$;

revoke all on function public.create_voice_message_as_user(uuid,uuid,text,integer,uuid),
  public.get_voice_note_as_user(uuid,uuid),public.list_expired_voice_notes(),
  public.finalize_expired_voice_notes(uuid[]) from public,anon,authenticated;
grant execute on function public.create_voice_message_as_user(uuid,uuid,text,integer,uuid),
  public.get_voice_note_as_user(uuid,uuid),public.list_expired_voice_notes(),
  public.finalize_expired_voice_notes(uuid[]) to service_role;
