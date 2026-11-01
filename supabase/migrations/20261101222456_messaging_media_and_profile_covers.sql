-- Requires player social, status posts, voice notes and messaging hardening.
begin;
create table public.social_media_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_character_id uuid not null references public.characters(id) on delete cascade,
  request_id uuid not null,
  purpose text not null check (purpose in ('attachment','cover')),
  conversation_id uuid references public.social_conversations(id) on delete cascade,
  filename text not null check (length(filename) between 1 and 100),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  digest text not null check (digest ~ '^[a-f0-9]{64}$'),
  storage_path text not null unique,
  message_id uuid unique references public.social_messages(id) on delete cascade,
  completed boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  unique(owner_character_id,request_id),
  check ((purpose='cover' and message_id is null) or
    (purpose='attachment' and ((completed and message_id is not null) or (not completed and message_id is null)))),
  check ((purpose='attachment' and conversation_id is not null) or
         (purpose='cover' and conversation_id is null and mime_type <> 'application/pdf'))
);
create index social_media_owner_created_idx on public.social_media_uploads(owner_character_id,created_at);
create table public.social_profile_covers (
  character_id uuid primary key references public.characters(id) on delete cascade,
  media_id uuid not null references public.social_media_uploads(id) on delete cascade
);
alter table public.social_media_uploads enable row level security;
alter table public.social_profile_covers enable row level security;
revoke all on public.social_media_uploads,public.social_profile_covers from public,anon,authenticated;
grant all on public.social_media_uploads,public.social_profile_covers to service_role;

-- Private bucket: browser roles receive no direct storage policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('social-media-v1','social-media-v1',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- Even broad pre-existing permissive storage policies cannot expose this bucket.
create policy social_media_server_only on storage.objects as restrictive for all to anon,authenticated
  using (bucket_id <> 'social-media-v1') with check (bucket_id <> 'social-media-v1');

create function public._social_media_thread_access(p_me uuid,p_thread uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.social_conversations t
    join public.player_friendships f on f.first_character_id=t.first_character_id and f.second_character_id=t.second_character_id
    where t.id=p_thread and p_me in (t.first_character_id,t.second_character_id)
    and not exists (select 1 from public.player_blocks b
      where (b.blocker_character_id=t.first_character_id and b.blocked_character_id=t.second_character_id)
         or (b.blocker_character_id=t.second_character_id and b.blocked_character_id=t.first_character_id))
  )
$$;

create function public.prepare_social_media_as_user(
  p_user_id uuid,p_request_id uuid,p_purpose text,p_thread_id uuid,
  p_filename text,p_mime_type text,p_size integer,p_digest text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid; upload public.social_media_uploads%rowtype; path text; ext text;
begin
  select id into me from public.characters where user_id=p_user_id;
  if me is null then raise exception 'NO_CHARACTER'; end if;
  perform 1 from public.characters where id=me for update;
  if p_purpose not in ('attachment','cover') or p_request_id is null
    or p_digest is null or p_digest !~ '^[a-f0-9]{64}$'
    or p_filename is null or length(p_filename) not between 1 and 100
    or p_size is null or p_size not between 1 and 10485760
    or p_mime_type is null or p_mime_type not in ('image/jpeg','image/png','image/webp','application/pdf')
    or (p_purpose='cover' and (p_thread_id is not null or p_mime_type='application/pdf'))
  then raise exception 'INVALID_MEDIA'; end if;
  if p_purpose='attachment' and not public._social_media_thread_access(me,p_thread_id) then raise exception 'UNKNOWN_THREAD'; end if;
  select * into upload from public.social_media_uploads where owner_character_id=me and request_id=p_request_id;
  if found then
    if upload.digest<>p_digest or upload.purpose<>p_purpose or upload.conversation_id is distinct from p_thread_id
      or upload.filename<>p_filename or upload.mime_type<>p_mime_type or upload.size_bytes<>p_size
    then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return to_jsonb(upload);
  end if;
  if (select count(*) from public.social_media_uploads where owner_character_id=me and created_at>clock_timestamp()-interval '1 hour') >= 20
    then raise exception 'MEDIA_RATE_LIMIT'; end if;
  ext:=case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' else 'pdf' end;
  path:=me::text||'/'||p_request_id::text||'/'||p_digest||'.'||ext;
  insert into public.social_media_uploads(owner_character_id,request_id,purpose,conversation_id,filename,mime_type,size_bytes,digest,storage_path)
    values(me,p_request_id,p_purpose,p_thread_id,p_filename,p_mime_type,p_size,p_digest,path) returning * into upload;
  return to_jsonb(upload);
end $$;

create function public.finish_social_media_as_user(p_user_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me uuid; upload public.social_media_uploads%rowtype; result jsonb;
begin
  select id into me from public.characters where user_id=p_user_id;
  if me is null then raise exception 'NO_CHARACTER'; end if;
  perform 1 from public.characters where id=me for update;
  select * into upload from public.social_media_uploads where owner_character_id=me and request_id=p_request_id for update;
  if not found then raise exception 'MEDIA_NOT_FOUND'; end if;
  if upload.purpose='attachment' and not public._social_media_thread_access(me,upload.conversation_id) then raise exception 'UNKNOWN_THREAD'; end if;
  if upload.completed then return jsonb_build_object('ok',true,'messageId',upload.message_id,'duplicate',true); end if;
  if upload.purpose='attachment' then
    if exists(select 1 from public.social_messages where sender_character_id=me and request_id=p_request_id) then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    result:=public.send_social_message_as_user(p_user_id,'private','[Attachment] '||upload.filename,p_request_id,null,upload.conversation_id,null);
    if result->>'id' is null then raise exception 'MESSAGE_NOT_DELIVERED'; end if;
    update public.social_media_uploads set message_id=(result->>'id')::uuid,completed=true where id=upload.id;
  else
    insert into public.social_profile_covers(character_id,media_id) values(me,upload.id)
      on conflict(character_id) do update set media_id=excluded.media_id;
    update public.social_media_uploads set completed=true where id=upload.id;
  end if;
  return jsonb_build_object('ok',true,'messageId',result->>'id','duplicate',false);
end $$;

create function public.get_social_media_as_user(p_user_id uuid,p_message_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid; result jsonb;
begin
  select id into me from public.characters where user_id=p_user_id;
  select jsonb_build_object('path',u.storage_path,'filename',u.filename,'mimeType',u.mime_type,'size',u.size_bytes)
    into result from public.social_media_uploads u
    where u.message_id=p_message_id and u.completed and public._social_media_thread_access(me,u.conversation_id);
  if result is null then raise exception 'MEDIA_NOT_FOUND'; end if;
  return result;
end $$;

-- Existing history authorizes the channel and applies its current block policy first.
create function public.get_social_messages_with_media(p_location_id uuid default null,p_conversation_id uuid default null,p_before timestamptz default null,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare history jsonb;
begin
  if p_conversation_id is not null and not public._social_media_thread_access(public._my_social_character_id(),p_conversation_id) then raise exception 'UNKNOWN_THREAD'; end if;
  history:=public.get_social_messages(p_location_id,p_conversation_id,p_before,p_limit);
  return (select coalesce(jsonb_agg(item.value || jsonb_build_object('attachment',
    (select jsonb_build_object('filename',u.filename,'mimeType',u.mime_type,'size',u.size_bytes)
      from public.social_media_uploads u where u.message_id=(item.value->>'id')::uuid and u.completed)) order by item.ordinality),'[]'::jsonb)
    from jsonb_array_elements(history) with ordinality item(value,ordinality));
end $$;

create function public.get_social_profile_card_as_user(p_user_id uuid,p_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare me uuid; target public.characters%rowtype; friends boolean; cover text; status jsonb;
begin
  select id into me from public.characters where user_id=p_user_id;
  if me is null then raise exception 'NO_CHARACTER'; end if;
  if exists(select 1 from public.player_blocks where
    (blocker_character_id=me and blocked_character_id=p_character_id) or
    (blocker_character_id=p_character_id and blocked_character_id=me)) then raise exception 'PROFILE_UNAVAILABLE'; end if;
  select * into target from public.characters where id=p_character_id;
  if not found then raise exception 'PROFILE_UNAVAILABLE'; end if;
  friends:=me=p_character_id or exists(select 1 from public.player_friendships where first_character_id=least(me,p_character_id) and second_character_id=greatest(me,p_character_id));
  if friends then
    select u.storage_path into cover from public.social_profile_covers c join public.social_media_uploads u on u.id=c.media_id where c.character_id=p_character_id and u.completed;
    select jsonb_build_object('body',s.body,'theme',s.theme,'expiresAt',s.expires_at) into status
      from public.player_status_posts s where s.owner_character_id=p_character_id and s.expires_at>now() order by s.created_at desc limit 1;
  end if;
  return jsonb_build_object('characterId',target.id,'name',target.name,'gender',target.gender,'appearance',target.appearance,'level',target.level,
    'isOwn',me=p_character_id,'isFriend',friends and me<>p_character_id,'coverPath',cover,'status',status);
end $$;

create function public.clear_social_profile_cover_as_user(p_user_id uuid,p_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.characters where user_id=p_user_id and id=p_character_id for update;
  if not found then raise exception 'PROFILE_UNAVAILABLE'; end if;
  delete from public.social_profile_covers where character_id=p_character_id;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.clear_social_profile_cover_as_user(uuid,uuid) from public,anon,authenticated;
grant execute on function public.clear_social_profile_cover_as_user(uuid,uuid) to service_role;
revoke all on function public._social_media_thread_access(uuid,uuid) from public,anon,authenticated;
revoke all on function public.prepare_social_media_as_user(uuid,uuid,text,uuid,text,text,integer,text) from public,anon,authenticated;
revoke all on function public.finish_social_media_as_user(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_social_media_as_user(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_social_profile_card_as_user(uuid,uuid) from public,anon,authenticated;
revoke all on function public.get_social_messages_with_media(uuid,uuid,timestamptz,integer) from public,anon;
grant execute on function public.prepare_social_media_as_user(uuid,uuid,text,uuid,text,text,integer,text),public.finish_social_media_as_user(uuid,uuid),
  public.get_social_media_as_user(uuid,uuid),public.get_social_profile_card_as_user(uuid,uuid) to service_role;
grant execute on function public.get_social_messages_with_media(uuid,uuid,timestamptz,integer) to authenticated;
commit;
