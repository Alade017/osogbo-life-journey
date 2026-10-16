-- Safe formatted text remains raw in storage; message writes now enter through the Node API.
alter table public.social_messages drop constraint if exists social_messages_body_check;
alter table public.social_messages
  add constraint social_messages_body_check check (char_length(body) between 1 and 1000);

create or replace function public.send_social_message_as_user(
  p_user_id uuid,
  p_channel text,
  p_body text,
  p_request_id uuid,
  p_location_id uuid default null,
  p_conversation_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid;
  message public.social_messages%rowtype;
  conversation public.social_conversations%rowtype;
  clean_body text := trim(coalesce(p_body,''));
begin
  select id into me from public.characters where user_id=p_user_id limit 1;
  if me is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  if char_length(clean_body)<1 or char_length(clean_body)>1000 then raise exception 'MESSAGE_LENGTH_INVALID'; end if;
  perform 1 from public.characters where id=me for update;
  select * into message from public.social_messages where sender_character_id=me and request_id=p_request_id;
  if found then return to_jsonb(message) || jsonb_build_object('duplicate',true); end if;
  if (select count(*) from public.social_messages where sender_character_id=me and created_at>now()-interval '1 minute')>=12 then
    raise exception 'MESSAGE_RATE_LIMIT';
  end if;
  if p_channel='area' then
    if p_location_id is null or p_conversation_id is not null then raise exception 'INVALID_DESTINATION'; end if;
    if not exists(select 1 from public.characters where id=me and current_location_id=p_location_id) then raise exception 'NOT_IN_AREA'; end if;
    insert into public.social_messages(sender_character_id,channel,location_id,request_id,body)
      values(me,'area',p_location_id,p_request_id,clean_body) returning * into message;
  elsif p_channel='private' then
    if p_conversation_id is null or p_location_id is not null then raise exception 'INVALID_DESTINATION'; end if;
    select * into conversation from public.social_conversations where id=p_conversation_id for update;
    if not found or (conversation.first_character_id<>me and conversation.second_character_id<>me) then raise exception 'UNKNOWN_THREAD'; end if;
    if exists(select 1 from public.player_blocks where
      (blocker_character_id=me and blocked_character_id=case when conversation.first_character_id=me then conversation.second_character_id else conversation.first_character_id end)
      or (blocked_character_id=me and blocker_character_id=case when conversation.first_character_id=me then conversation.second_character_id else conversation.first_character_id end))
      then raise exception 'RECIPIENT_BLOCKED'; end if;
    if not exists(select 1 from public.player_friendships where first_character_id=conversation.first_character_id and second_character_id=conversation.second_character_id) then raise exception 'NOT_FRIENDS'; end if;
    insert into public.social_messages(sender_character_id,channel,conversation_id,request_id,body)
      values(me,'private',p_conversation_id,p_request_id,clean_body) returning * into message;
  else
    raise exception 'INVALID_CHANNEL';
  end if;
  return to_jsonb(message) || jsonb_build_object('duplicate',false);
end
$$;

revoke all on function public.send_social_message(text,text,uuid,uuid,uuid) from authenticated;
revoke all on function public.send_social_message_as_user(uuid,text,text,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.send_social_message_as_user(uuid,text,text,uuid,uuid,uuid) to service_role;
