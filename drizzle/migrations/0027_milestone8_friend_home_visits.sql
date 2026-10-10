-- Milestone 8: let owners explicitly share a saved home layout with friends.
-- Guests receive a sanitized, read-only snapshot through a friendship-checked RPC.

alter table public.character_home_saves
  add column allow_friend_visits boolean not null default false;

create or replace function public.my_home_visit_policy()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  saved public.character_home_saves%rowtype;
begin
  if cid is null then raise exception 'Create a character before changing home access'; end if;
  select * into saved from public.character_home_saves where character_id=cid;
  return jsonb_build_object(
    'has_home_save', saved.character_id is not null,
    'allow_friend_visits', coalesce(saved.allow_friend_visits, false)
  );
end
$$;

create or replace function public.set_my_home_visit_access(p_allow_friends boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  saved public.character_home_saves%rowtype;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_allow_friends is null then raise exception 'Choose whether friends may visit'; end if;
  perform 1 from public.characters where id=cid and user_id=uid for update;
  select * into saved from public.character_home_saves where character_id=cid for update;
  if not found then raise exception 'Save your home before allowing visits'; end if;
  update public.character_home_saves
    set allow_friend_visits=p_allow_friends
    where character_id=cid and user_id=uid;
  return jsonb_build_object('allow_friend_visits',p_allow_friends);
end
$$;

create or replace function public.get_friend_home_for_visit(p_target_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public._my_character_id();
  owner public.characters%rowtype;
  saved public.character_home_saves%rowtype;
  visitor_payload jsonb;
  room_width integer;
  room_height integer;
begin
  if me is null then raise exception 'Sign in before visiting a home'; end if;
  if p_target_character_id is null or p_target_character_id=me then
    raise exception 'Choose a friend home to visit';
  end if;
  if not exists (
    select 1 from public.player_friendships f
    where (f.first_character_id=me and f.second_character_id=p_target_character_id)
       or (f.first_character_id=p_target_character_id and f.second_character_id=me)
  ) then raise exception 'This home is not open to you'; end if;
  if exists (
    select 1 from public.player_blocks b
    where (b.blocker_character_id=me and b.blocked_character_id=p_target_character_id)
      or (b.blocker_character_id=p_target_character_id and b.blocked_character_id=me)
  ) then raise exception 'This home is not open to you'; end if;

  select * into owner from public.characters where id=p_target_character_id;
  select * into saved from public.character_home_saves
    where character_id=p_target_character_id and allow_friend_visits;
  if owner.id is null or saved.character_id is null then
    raise exception 'This home is not open to you';
  end if;
  if not public._valid_home_save(saved.payload) then raise exception 'The saved home data is invalid'; end if;

  room_width := case saved.payload->>'layoutId'
    when 'courtyard-room' then 6
    when 'garden-flat' then 7
    else 8
  end;
  room_height := case saved.payload->>'layoutId'
    when 'courtyard-room' then 5
    when 'garden-flat' then 6
    else 7
  end;
  visitor_payload := jsonb_set(saved.payload,'{room}','"lounge"'::jsonb);
  visitor_payload := jsonb_set(visitor_payload,'{x}',to_jsonb(room_width/2));
  visitor_payload := jsonb_set(visitor_payload,'{y}',to_jsonb(room_height/2));
  visitor_payload := jsonb_set(visitor_payload,'{exterior}','null'::jsonb);
  visitor_payload := jsonb_set(visitor_payload,'{needs}',
    '{"energy":70,"fun":50,"hygiene":70,"bladder":30,"hunger":60,"skill":0}'::jsonb);

  return jsonb_build_object(
    'character_id',owner.id,
    'player_name',owner.name,
    'payload',visitor_payload,
    'revision',saved.revision,
    'saved_at',saved.updated_at
  );
end
$$;

revoke all on function public.my_home_visit_policy() from public, anon;
revoke all on function public.set_my_home_visit_access(boolean) from public, anon;
revoke all on function public.get_friend_home_for_visit(uuid) from public, anon;
grant execute on function public.my_home_visit_policy() to authenticated;
grant execute on function public.set_my_home_visit_access(boolean) to authenticated;
grant execute on function public.get_friend_home_for_visit(uuid) to authenticated;
