-- Playable landmarks are public orientation points; interactions remain fictional.
update public.map_landmarks set is_available = false
where id not in (
  'oja-oba-market', 'ataoja-police-station', 'ataoja-palace',
  'oke-baale-local-government-hq', 'osogbo-school-of-art',
  'osogbo-township-stadium', 'aleku-wodo-road-network', 'oke-fia-flyover'
);

insert into public.map_landmarks (id, district_id, location_id, is_available)
select seed.id, seed.district_id, location.id, true
from (values
  ('oja-oba-market', 'oja-oba', 'oja-oba'),
  ('ataoja-police-station', 'ataoja', 'government-area'),
  ('ataoja-palace', 'ataoja', 'government-area'),
  ('oke-baale-local-government-hq', 'oke-baale', 'oke-baale'),
  ('osogbo-school-of-art', 'oke-baale', 'student-district'),
  ('osogbo-township-stadium', 'ogo-oluwa', 'stadium'),
  ('aleku-wodo-road-network', 'aleku-wodo', 'residential'),
  ('oke-fia-flyover', 'oke-fia', 'oke-fia')
) as seed(id, district_id, location_slug)
join public.locations location on location.slug = seed.location_slug and location.is_active
on conflict (id) do update set district_id = excluded.district_id,
  location_id = excluded.location_id, is_available = true;

create table public.map_place_action_receipts (
  character_id uuid not null references public.characters(id) on delete cascade,
  request_id uuid not null,
  landmark_id text not null references public.map_landmarks(id),
  action_id text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (character_id, request_id)
);
alter table public.map_place_action_receipts enable row level security;
revoke all on public.map_place_action_receipts from public, anon, authenticated;
grant all on public.map_place_action_receipts to service_role;

create or replace function public.perform_map_place_action(
  p_user_id uuid,
  p_landmark_id text,
  p_action_id text,
  p_request_id uuid,
  p_action_definition jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  player public.characters%rowtype;
  place public.map_landmarks%rowtype;
  location_row public.locations%rowtype;
  wallet public.wallets%rowtype;
  cached public.map_place_action_receipts%rowtype;
  time_cost integer;
  mood_effect integer;
  min_money bigint;
  max_money bigint;
  money_delta bigint;
  total_minutes integer;
  action_hour integer;
  starts_at integer;
  ends_at integer;
  result jsonb;
  action_label text;
  cooldown_minutes integer;
  last_action_time integer;
  current_action_time integer;
  hunger_gain integer;
begin
  if p_user_id is null or p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  select * into player from public.characters
    where user_id = p_user_id order by created_at desc limit 1 for update;
  if not found then raise exception 'NO_CHARACTER'; end if;
  select * into cached from public.map_place_action_receipts
    where character_id = player.id and request_id = p_request_id for update;
  if found then
    if cached.landmark_id <> p_landmark_id or cached.action_id <> p_action_id then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    if cached.response is not null then return cached.response; end if;
  end if;

  select * into place from public.map_landmarks
    where id = p_landmark_id and is_available for share;
  if not found or p_action_definition->>'id' is distinct from p_action_id then
    raise exception 'UNKNOWN_LANDMARK';
  end if;
  select * into location_row from public.locations
    where id = place.location_id and is_active for share;
  if not found then raise exception 'UNKNOWN_LANDMARK'; end if;
  if player.current_location_id is distinct from place.location_id then raise exception 'NOT_AT_PLACE'; end if;

  starts_at := (p_action_definition#>>'{open_hours,start}')::integer;
  ends_at := (p_action_definition#>>'{open_hours,end}')::integer;
  action_hour := player.game_time_hour;
  if starts_at < 0 or starts_at > 23 or ends_at < 1 or ends_at > 24 then raise exception 'INVALID_ACTION_RULE'; end if;
  if starts_at < ends_at and not (action_hour >= starts_at and action_hour < ends_at) then raise exception 'PLACE_CLOSED'; end if;
  if starts_at > ends_at and not (action_hour >= starts_at or action_hour < ends_at) then raise exception 'PLACE_CLOSED'; end if;

  if p_action_definition->>'requirement' = 'Needs a market job' and not exists (
    select 1 from public.character_jobs active_job
    join public.jobs job on job.id = active_job.job_id
    where active_job.character_id = player.id and active_job.is_current
      and (job.location_id = location_row.id or job.slug ilike '%market%'
        or job.place_id in (select id from public.game_places where location_id = location_row.id))
  ) then raise exception 'REQUIREMENT_NOT_MET'; end if;
  if p_action_definition->>'requirement' not in ('Travel here first', 'Needs a market job') then
    raise exception 'REQUIREMENT_NOT_MET';
  end if;

  cooldown_minutes := coalesce((p_action_definition->>'cooldown_game_minutes')::integer, 0);
  if cooldown_minutes < 0 or cooldown_minutes > 1440 then raise exception 'INVALID_ACTION_RULE'; end if;
  if cooldown_minutes > 0 then
    current_action_time := player.game_day * 1440 + player.game_time_hour * 60 + player.game_time_minute;
    select ((response#>>'{game_time,day}')::integer * 1440)
      + ((response#>>'{game_time,hour}')::integer * 60)
      + (response#>>'{game_time,minute}')::integer
      into last_action_time
      from public.map_place_action_receipts
      where character_id = player.id and landmark_id = p_landmark_id and action_id = p_action_id
        and response is not null
      order by created_at desc limit 1;
    if last_action_time is not null and current_action_time - last_action_time < cooldown_minutes then
      raise exception 'COOLDOWN';
    end if;
  end if;

  time_cost := (p_action_definition->>'time_cost_minutes')::integer;
  mood_effect := (p_action_definition->>'mood_effect')::integer;
  hunger_gain := coalesce((p_action_definition#>>'{needs_effects,hunger_satisfaction}')::integer, 0);
  min_money := (p_action_definition#>>'{money_minor,min}')::bigint;
  max_money := (p_action_definition#>>'{money_minor,max}')::bigint;
  if time_cost not between 0 and 480 or mood_effect not between -20 and 20 or hunger_gain not between 0 and 50
     or min_money > max_money or min_money < -100000 or max_money > 100000 then
    raise exception 'INVALID_ACTION_RULE';
  end if;
  money_delta := min_money + floor(random() * (max_money - min_money + 1))::bigint;
  if money_delta > 0 then
    select * into wallet from public.wallets where character_id = player.id for update;
    if not found or wallet.balance < money_delta then raise exception 'INSUFFICIENT_FUNDS'; end if;
    update public.wallets set balance = balance - money_delta,
      total_expenses = total_expenses + money_delta, updated_at = now()
      where id = wallet.id returning * into wallet;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
      values (p_user_id, wallet.id, player.id, money_delta, 'expense', 'map_activity',
        coalesce(p_action_definition->>'label', p_action_id));
  elsif money_delta < 0 then
    select * into wallet from public.wallets where character_id = player.id for update;
    if not found then raise exception 'NO_WALLET'; end if;
    update public.wallets set balance = balance + abs(money_delta),
      total_income = total_income + abs(money_delta), updated_at = now()
      where id = wallet.id returning * into wallet;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
      values (p_user_id, wallet.id, player.id, abs(money_delta), 'income', 'map_activity',
        coalesce(p_action_definition->>'label', p_action_id));
  else
    select * into wallet from public.wallets where character_id = player.id for update;
  end if;

  total_minutes := player.game_time_hour * 60 + player.game_time_minute + time_cost;
  action_label := coalesce(p_action_definition->>'label', p_action_id);
  update public.characters set
    game_time_hour = mod(total_minutes / 60, 24),
    game_time_minute = mod(total_minutes, 60),
    game_day = game_day + total_minutes / 1440,
    game_weekday = mod(game_weekday + total_minutes / 1440, 7),
    happiness = greatest(0, least(100, happiness + mood_effect)),
    hunger = greatest(0, least(100, hunger - hunger_gain)),
    updated_at = now()
  where id = player.id returning * into player;
  result := jsonb_build_object(
    'action_id', p_action_id,
    'message', action_label || ' complete.',
    'balance', coalesce(wallet.balance, 0),
    'happiness', player.happiness,
    'hunger', player.hunger,
    'game_time', jsonb_build_object('hour', player.game_time_hour, 'minute', player.game_time_minute, 'day', player.game_day)
  );
  insert into public.map_place_action_receipts(character_id, request_id, landmark_id, action_id, response)
    values (player.id, p_request_id, p_landmark_id, p_action_id, result)
    on conflict (character_id, request_id) do update set response = excluded.response;
  return result;
end $$;

revoke all on function public.perform_map_place_action(uuid,text,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.perform_map_place_action(uuid,text,text,uuid,jsonb) to service_role;
