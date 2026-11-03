-- Match the composite cursor so long histories do not sort timestamp ties.
create index if not exists social_messages_area_cursor_idx
  on public.social_messages(location_id, created_at desc, id desc)
  where channel = 'area';
create index if not exists social_messages_private_cursor_idx
  on public.social_messages(conversation_id, created_at desc, id desc)
  where channel = 'private';

create function public.get_social_messages_v2(
  p_location_id uuid default null,
  p_conversation_id uuid default null,
  p_before timestamptz default null,
  p_limit integer default 50,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := public._my_social_character_id();
  result jsonb;
begin
  if me is null then raise exception 'Sign in to read messages'; end if;
  if (p_location_id is null) = (p_conversation_id is null) then
    raise exception 'Choose one message channel';
  end if;
  if (p_before is null) <> (p_before_id is null) then
    raise exception 'Invalid message history cursor';
  end if;
  if p_location_id is not null and not exists (
    select 1 from public.characters where id = me and current_location_id = p_location_id
  ) then
    raise exception 'Travel to this area to read its chat';
  end if;
  if p_conversation_id is not null and not exists (
    select 1
    from public.social_conversations conversation
    join public.player_friendships friendship
      on friendship.first_character_id = conversation.first_character_id
      and friendship.second_character_id = conversation.second_character_id
    where conversation.id = p_conversation_id
      and me in (conversation.first_character_id, conversation.second_character_id)
      and not public._social_blocked(
        case
          when conversation.first_character_id = me then conversation.second_character_id
          else conversation.first_character_id
        end
      )
  ) then
    raise exception 'Conversation not found';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(rows) order by rows.created_at, rows.id),
    '[]'::jsonb
  )
  into result
  from (
    select
      message.id,
      message.sender_character_id,
      sender.name as sender_name,
      message.channel,
      message.location_id,
      message.conversation_id,
      message.body,
      message.created_at,
      message.message_type,
      message.voice_duration_ms,
      message.reply_to_message_id,
      reply.message_type as reply_message_type,
      reply.voice_duration_ms as reply_voice_duration_ms,
      reply.body as reply_body,
      reply_sender.name as reply_sender_name
    from public.social_messages message
    join public.characters sender on sender.id = message.sender_character_id
    left join public.social_messages reply on reply.id = message.reply_to_message_id
    left join public.characters reply_sender on reply_sender.id = reply.sender_character_id
    where (
      (p_location_id is not null and message.channel = 'area' and message.location_id = p_location_id)
      or (
        p_conversation_id is not null
        and message.channel = 'private'
        and message.conversation_id = p_conversation_id
      )
    )
      and (
        p_before is null
        or (message.created_at, message.id) < (p_before, p_before_id)
      )
      and (
        message.sender_character_id = me
        or not public._social_blocked(message.sender_character_id)
      )
    order by message.created_at desc, message.id desc
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  ) rows;
  return result;
end
$$;

create function public.get_social_messages_with_media_v2(
  p_location_id uuid default null,
  p_conversation_id uuid default null,
  p_before timestamptz default null,
  p_limit integer default 50,
  p_before_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  history jsonb;
begin
  if p_conversation_id is not null
    and not public._social_media_thread_access(
      public._my_social_character_id(),
      p_conversation_id
    )
  then
    raise exception 'UNKNOWN_THREAD';
  end if;

  history := public.get_social_messages_v2(
    p_location_id,
    p_conversation_id,
    p_before,
    p_limit,
    p_before_id
  );
  return (
    select coalesce(
      jsonb_agg(
        item.value || jsonb_build_object(
          'attachment',
          (
            select jsonb_build_object(
              'filename', upload.filename,
              'mimeType', upload.mime_type,
              'size', upload.size_bytes
            )
            from public.social_media_uploads upload
            where upload.message_id = (item.value ->> 'id')::uuid
              and upload.completed
          )
        )
        order by item.ordinality
      ),
      '[]'::jsonb
    )
    from jsonb_array_elements(history) with ordinality item(value, ordinality)
  );
end
$$;

revoke all on function public.get_social_messages_v2(uuid, uuid, timestamptz, integer, uuid)
  from public, anon;
revoke all on function public.get_social_messages_with_media_v2(uuid, uuid, timestamptz, integer, uuid)
  from public, anon;
grant execute on function public.get_social_messages_v2(uuid, uuid, timestamptz, integer, uuid)
  to authenticated;
grant execute on function public.get_social_messages_with_media_v2(uuid, uuid, timestamptz, integer, uuid)
  to authenticated;

notify pgrst, 'reload schema';
