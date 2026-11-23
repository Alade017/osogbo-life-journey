-- Prayer timetables. A mosque has five daily prayers, each held in a window of game time. A church
-- holds services on fixed days (Wednesday, Thursday, Friday and Sunday) at any time of day.
-- Weekdays use the game's numbering: 0 = Monday ... 6 = Sunday.
update public.worship_places set bonus_minor = 500000;

create table if not exists public.worship_prayer_times (
  place_slug text not null references public.worship_places(slug) on delete cascade,
  prayer text not null,
  weekdays integer[] not null,
  start_minute integer not null check (start_minute between 0 and 1439),
  end_minute integer not null check (end_minute > start_minute and end_minute <= 1440),
  primary key (place_slug, prayer),
  check (cardinality(weekdays) > 0 and weekdays <@ array[0, 1, 2, 3, 4, 5, 6])
);
alter table public.worship_prayer_times enable row level security;
revoke all on public.worship_prayer_times from anon, authenticated;

insert into public.worship_prayer_times(place_slug, prayer, weekdays, start_minute, end_minute) values
  ('osogbo-central-mosque', 'fajr', array[0,1,2,3,4,5,6], 300, 360),
  ('osogbo-central-mosque', 'dhuhr', array[0,1,2,3,4,5,6], 780, 840),
  ('osogbo-central-mosque', 'asr', array[0,1,2,3,4,5,6], 960, 1020),
  ('osogbo-central-mosque', 'maghrib', array[0,1,2,3,4,5,6], 1110, 1170),
  ('osogbo-central-mosque', 'isha', array[0,1,2,3,4,5,6], 1200, 1260),
  ('osogbo-grand-mosque', 'fajr', array[0,1,2,3,4,5,6], 300, 360),
  ('osogbo-grand-mosque', 'dhuhr', array[0,1,2,3,4,5,6], 780, 840),
  ('osogbo-grand-mosque', 'asr', array[0,1,2,3,4,5,6], 960, 1020),
  ('osogbo-grand-mosque', 'maghrib', array[0,1,2,3,4,5,6], 1110, 1170),
  ('osogbo-grand-mosque', 'isha', array[0,1,2,3,4,5,6], 1200, 1260),
  ('oke-fia-community-church', 'service', array[2,3,4,6], 0, 1440)
on conflict (place_slug, prayer) do nothing;

-- One prayer per prayer name per game day.
alter table public.worship_prayers add column if not exists prayer text not null default 'service';
alter table public.worship_prayers alter column prayer drop default;
alter table public.worship_prayers drop constraint if exists worship_prayers_pkey;
alter table public.worship_prayers add primary key (character_id, place_slug, game_day, prayer);

drop function if exists public.complete_worship_prayer(text, uuid);

create or replace function public.complete_worship_prayer(
  p_place_slug text, p_prayer text, p_request_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  location_id uuid;
  today integer;
  weekday integer;
  clock_minute integer;
  wallet public.wallets%rowtype;
  bonus bigint;
  cash_after bigint;
  due_weekdays integer[];
  due_start integer;
  due_end integer;
  slug_text text := btrim(coalesce(p_place_slug, ''));
  prayer_text text := btrim(coalesce(p_prayer, ''));
  result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null or slug_text = '' or prayer_text = '' then
    raise exception 'Choose a place and a prayer, and include a request ID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select er.result into result
  from public.economy_request_results er
  where er.character_id = cid and er.request_id = p_request_id and er.operation = 'worship_prayer';
  if found then return result; end if;

  select w.bonus_minor into bonus
  from public.worship_places w
  where w.slug = slug_text and w.active;
  if bonus is null then raise exception 'Prayers are not held at this place'; end if;

  select t.weekdays, t.start_minute, t.end_minute
  into due_weekdays, due_start, due_end
  from public.worship_prayer_times t
  where t.place_slug = slug_text and t.prayer = prayer_text;
  if not found then raise exception 'This prayer is not held at this place'; end if;

  select c.current_location_id, c.game_day, c.game_weekday,
         c.game_time_hour * 60 + c.game_time_minute
  into location_id, today, weekday, clock_minute
  from public.characters c
  where c.id = cid;
  if not exists (
    select 1 from public.locations l
    where l.id = location_id and l.slug = slug_text and l.is_active
  ) then
    raise exception 'Go to this place to pray';
  end if;

  if not (weekday = any(due_weekdays)) or clock_minute < due_start or clock_minute >= due_end then
    raise exception 'This prayer is not due right now';
  end if;

  if exists (
    select 1 from public.worship_prayers p
    where p.character_id = cid and p.place_slug = slug_text
      and p.game_day = today and p.prayer = prayer_text
  ) then
    raise exception 'You have already prayed this prayer today';
  end if;

  select * into wallet
  from public.wallets
  where character_id = cid and user_id = uid
  for update;
  if not found then raise exception 'No wallet found for this character'; end if;

  cash_after := wallet.balance + bonus;
  update public.wallets
  set balance = cash_after, total_income = total_income + bonus
  where id = wallet.id;

  insert into public.worship_prayers(character_id, user_id, place_slug, game_day, prayer, bonus_minor)
  values (cid, uid, slug_text, today, prayer_text, bonus);

  insert into public.transactions(
    user_id, wallet_id, character_id, amount, kind, category, description,
    transaction_type, account, source, destination, balance_after, metadata
  )
  values (
    uid, wallet.id, cid, bonus, 'income', 'community',
    'Prayer bonus at ' || slug_text || ' (' || prayer_text || ')',
    'income', 'cash', 'game', slug_text, cash_after,
    jsonb_build_object('request_id', p_request_id, 'game_day', today, 'prayer', prayer_text)
  );

  result := jsonb_build_object(
    'bonus', bonus, 'cash', cash_after, 'gameDay', today, 'prayer', prayer_text
  );
  insert into public.economy_request_results(character_id, request_id, operation, result)
  values (cid, p_request_id, 'worship_prayer', result);
  return result;
end
$$;

revoke all on function public.complete_worship_prayer(text, text, uuid) from public, anon;
grant execute on function public.complete_worship_prayer(text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
