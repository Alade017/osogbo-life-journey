-- Milestone 10: add account-owned, revisioned home layouts. Other durable game
-- systems already live in normalized RLS-protected tables and transactional RPCs.
create table public.character_home_saves (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  schema_version smallint not null default 1 check (schema_version = 1),
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  check (pg_column_size(payload) <= 65536)
);
alter table public.character_home_saves enable row level security;
create policy "Players can read their own home save" on public.character_home_saves
  for select to authenticated using (user_id = auth.uid());
grant select on public.character_home_saves to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.character_home_saves from public, anon, authenticated;
grant all on public.character_home_saves to service_role;

create or replace function public._valid_home_save(p jsonb)
returns boolean language plpgsql immutable set search_path=public as $$
declare
  layout_id text; room_id text; room_width int; room_height int;
  entry jsonb; prior_entry jsonb; item_id text; item_room text; item_width int; item_height int;
  prior_item text; prior_width int; prior_height int; prior_x int; prior_y int; prior_rotation int;
  room_w int; room_h int; x int; y int; rotation int; seen text[] := '{}'; prior_entries jsonb[] := '{}';
  n jsonb; key text;
begin
  if jsonb_typeof(p) <> 'object' or pg_column_size(p) > 65536 then return false; end if;
  layout_id := p->>'layoutId'; room_id := p->>'room';
  if layout_id not in ('courtyard-room','garden-flat','family-courtyard') then return false; end if;
  room_width := case layout_id when 'courtyard-room' then 6 when 'garden-flat' then
    case room_id when 'lounge' then 7 when 'kitchen' then 4 when 'bedroom' then 5 else 0 end
    else case room_id when 'lounge' then 8 when 'dining' then 5 when 'study' then 4
      when 'bedroom' then 6 when 'kitchen' then 5 when 'bathroom' then 4 else 0 end end;
  room_height := case layout_id when 'courtyard-room' then 5 when 'garden-flat' then
    case room_id when 'lounge' then 6 when 'kitchen' then 4 when 'bedroom' then 5 else 0 end
    else case room_id when 'lounge' then 7 when 'dining' then 5 when 'study' then 4
      when 'bedroom' then 6 when 'kitchen' then 5 when 'bathroom' then 4 else 0 end end;
  if room_width=0 or room_height=0 or jsonb_typeof(p->'x') is distinct from 'number' or jsonb_typeof(p->'y') is distinct from 'number'
    or (p->>'x')::numeric <> trunc((p->>'x')::numeric) or (p->>'y')::numeric <> trunc((p->>'y')::numeric)
    or (p->>'x')::int < 0 or (p->>'x')::int >= room_width
    or (p->>'y')::int < 0 or (p->>'y')::int >= room_height then return false; end if;
  if jsonb_typeof(p->'furniture') is distinct from 'array' or jsonb_array_length(p->'furniture') > 100
    or jsonb_typeof(p->'storage') is distinct from 'array' or jsonb_array_length(p->'storage') > 100
    or jsonb_typeof(p->'upgrades') is distinct from 'array' or jsonb_array_length(p->'upgrades') > 100
    or jsonb_typeof(p->'needs') is distinct from 'object' then return false; end if;
  for entry in select value from jsonb_array_elements(p->'furniture') loop
    item_id := entry->>'itemId'; item_room := entry->>'room';
    if entry->>'id' is null or char_length(entry->>'id') not between 1 and 100
      or entry->>'id'=any(seen) or item_id is null or item_id not in ('sofa','bed','stove','shower','toilet','computer','television','plant')
      or entry->>'rotation' is null or entry->>'rotation' not in ('0','90','180','270') then return false; end if;
    seen := array_append(seen,entry->>'id');
    if item_room not in ('lounge','bedroom','kitchen','bathroom','study','dining') then return false; end if;
    room_w := case layout_id when 'courtyard-room' then case item_room when 'lounge' then 6 else 0 end
      when 'garden-flat' then case item_room when 'lounge' then 7 when 'kitchen' then 4 when 'bedroom' then 5 else 0 end
      else case item_room when 'lounge' then 8 when 'dining' then 5 when 'study' then 4 when 'bedroom' then 6 when 'kitchen' then 5 when 'bathroom' then 4 else 0 end end;
    room_h := case layout_id when 'courtyard-room' then case item_room when 'lounge' then 5 else 0 end
      when 'garden-flat' then case item_room when 'lounge' then 6 when 'kitchen' then 4 when 'bedroom' then 5 else 0 end
      else case item_room when 'lounge' then 7 when 'dining' then 5 when 'study' then 4 when 'bedroom' then 6 when 'kitchen' then 5 when 'bathroom' then 4 else 0 end end;
    if room_w=0 or jsonb_typeof(entry->'x') is distinct from 'number' or jsonb_typeof(entry->'y') is distinct from 'number'
      or (entry->>'x')::numeric <> trunc((entry->>'x')::numeric) or (entry->>'y')::numeric <> trunc((entry->>'y')::numeric) then return false; end if;
    x := (entry->>'x')::int; y := (entry->>'y')::int; rotation := (entry->>'rotation')::int;
    item_width := case item_id when 'sofa' then 2 when 'bed' then 2 when 'stove' then 2 when 'shower' then 1 when 'toilet' then 1 else 2 end;
    item_height := case item_id when 'bed' then 2 when 'shower' then 2 else 1 end;
    if rotation in (90,270) then item_width := item_width + item_height; item_height := item_width - item_height; item_width := item_width - item_height; end if;
    if x<0 or y<0 or x+item_width>room_w or y+item_height>room_h then return false; end if;
    foreach prior_entry in array prior_entries loop
      if prior_entry->>'room'=item_room then
        prior_item := prior_entry->>'itemId'; prior_x := (prior_entry->>'x')::int;
        prior_y := (prior_entry->>'y')::int; prior_rotation := (prior_entry->>'rotation')::int;
        prior_width := case prior_item when 'sofa' then 2 when 'bed' then 2 when 'stove' then 2 when 'shower' then 1 when 'toilet' then 1 else 2 end;
        prior_height := case prior_item when 'bed' then 2 when 'shower' then 2 else 1 end;
        if prior_rotation in (90,270) then prior_width := prior_width + prior_height; prior_height := prior_width - prior_height; prior_width := prior_width - prior_height; end if;
        if x<prior_x+prior_width and x+item_width>prior_x and y<prior_y+prior_height and y+item_height>prior_y then return false; end if;
      end if;
    end loop;
    prior_entries := array_append(prior_entries,entry);
  end loop;
  for entry in select value from jsonb_array_elements(p->'storage') loop
    if jsonb_typeof(entry) is distinct from 'string' or entry#>>'{}' not in ('sofa','bed','stove','shower','toilet','computer','television','plant') then return false; end if;
  end loop;
  for entry in select value from jsonb_array_elements(p->'upgrades') loop
    if jsonb_typeof(entry) is distinct from 'string' or entry#>>'{}' not in ('storage','finish','lighting','appliance') then return false; end if;
  end loop;
  n := p->'needs';
  foreach key in array array['energy','fun','hygiene','bladder','hunger','skill'] loop
    if jsonb_typeof(n->key) is distinct from 'number' or (n->>key)::numeric<0 or (n->>key)::numeric>100 then return false; end if;
  end loop;
  if p->'exterior' is not null and p->'exterior'<>'null'::jsonb then
    if jsonb_typeof(p->'exterior') is distinct from 'object' or jsonb_typeof(p->'exterior'->'lat') is distinct from 'number'
      or jsonb_typeof(p->'exterior'->'lng') is distinct from 'number'
      or (p->'exterior'->>'lat')::numeric not between 7.48 and 8.02
      or (p->'exterior'->>'lng')::numeric not between 4.25 and 4.88 then return false; end if;
  end if;
  return true;
exception when others then return false;
end $$;
revoke all on function public._valid_home_save(jsonb) from public, anon, authenticated;

create or replace function public.my_home_save()
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); cid uuid := public._my_character_id(); saved public.character_home_saves%rowtype;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  select * into saved from public.character_home_saves where character_id=cid and user_id=uid;
  if not found then return jsonb_build_object('payload',null,'revision',0,'saved_at',null); end if;
  if not public._valid_home_save(saved.payload) then raise exception 'The saved home data is invalid'; end if;
  return jsonb_build_object('payload',saved.payload,'revision',saved.revision,'saved_at',saved.updated_at);
end $$;

create or replace function public.save_my_home(p_payload jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); cid uuid := public._my_character_id(); saved public.character_home_saves%rowtype;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid home save revision'; end if;
  if not public._valid_home_save(p_payload) then raise exception 'Home save failed validation'; end if;
  perform 1 from public.characters where id=cid and user_id=uid for update;
  select * into saved from public.character_home_saves where character_id=cid for update;
  if not found then
    if p_expected_revision<>0 then return jsonb_build_object('ok',false,'conflict',true,'revision',0,'payload',null); end if;
    insert into public.character_home_saves(character_id,user_id,payload,revision)
      values(cid,uid,p_payload,1) returning * into saved;
  else
    if saved.user_id<>uid then raise exception 'Unauthorized'; end if;
    if saved.revision<>p_expected_revision then
      return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,'payload',saved.payload,'saved_at',saved.updated_at);
    end if;
    update public.character_home_saves set payload=p_payload,revision=revision+1,updated_at=now()
      where character_id=cid returning * into saved;
  end if;
  return jsonb_build_object('ok',true,'conflict',false,'revision',saved.revision,'payload',saved.payload,'saved_at',saved.updated_at);
end $$;
revoke all on function public.my_home_save() from public, anon;
revoke all on function public.save_my_home(jsonb,bigint) from public, anon;
grant execute on function public.my_home_save() to authenticated;
grant execute on function public.save_my_home(jsonb,bigint) to authenticated;
