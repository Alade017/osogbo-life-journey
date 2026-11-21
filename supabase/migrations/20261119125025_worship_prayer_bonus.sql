-- Worship places: a visitor can pray once per game day at each of these places and receive a
-- cash bonus. Prayer has no mood or other effects.
create table if not exists public.worship_places (
  slug text primary key,
  bonus_minor bigint not null check (bonus_minor > 0),
  active boolean not null default true
);
insert into public.worship_places(slug, bonus_minor) values
  ('osogbo-central-mosque', 2000),
  ('osogbo-grand-mosque', 2000),
  ('oke-fia-community-church', 2000)
on conflict (slug) do nothing;
alter table public.worship_places enable row level security;
revoke all on public.worship_places from anon, authenticated;

create table if not exists public.worship_prayers (
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null,
  place_slug text not null,
  game_day integer not null,
  bonus_minor bigint not null,
  created_at timestamptz not null default now(),
  primary key (character_id, place_slug, game_day)
);
alter table public.worship_prayers enable row level security;
revoke all on public.worship_prayers from anon, authenticated;

create or replace function public.complete_worship_prayer(p_place_slug text, p_request_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  location_id uuid;
  today integer;
  wallet public.wallets%rowtype;
  bonus bigint;
  cash_after bigint;
  slug_text text := btrim(coalesce(p_place_slug, ''));
  result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null or slug_text = '' then
    raise exception 'Choose a place to pray and include a request ID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select er.result into result
  from public.economy_request_results er
  where er.character_id = cid and er.request_id = p_request_id and er.operation = 'worship_prayer';
  if found then return result; end if;

  select w.bonus_minor into bonus
  from public.worship_places w
  where w.slug = slug_text and w.active;
  if bonus is null then
    raise exception 'Prayers are not held at this place';
  end if;

  select c.current_location_id, c.game_day into location_id, today
  from public.characters c
  where c.id = cid;
  if not exists (
    select 1 from public.locations l
    where l.id = location_id and l.slug = slug_text and l.is_active
  ) then
    raise exception 'Go to this place to pray';
  end if;

  if exists (
    select 1 from public.worship_prayers p
    where p.character_id = cid and p.place_slug = slug_text and p.game_day = today
  ) then
    raise exception 'You have already prayed here today';
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

  insert into public.worship_prayers(character_id, user_id, place_slug, game_day, bonus_minor)
  values (cid, uid, slug_text, today, bonus);

  insert into public.transactions(
    user_id, wallet_id, character_id, amount, kind, category, description,
    transaction_type, account, source, destination, balance_after, metadata
  )
  values (
    uid, wallet.id, cid, bonus, 'income', 'community',
    'Prayer bonus at ' || slug_text, 'income', 'cash', 'game', slug_text, cash_after,
    jsonb_build_object('request_id', p_request_id, 'game_day', today)
  );

  result := jsonb_build_object('bonus', bonus, 'cash', cash_after, 'gameDay', today);
  insert into public.economy_request_results(character_id, request_id, operation, result)
  values (cid, p_request_id, 'worship_prayer', result);
  return result;
end
$$;

revoke all on function public.complete_worship_prayer(text, uuid) from public, anon;
grant execute on function public.complete_worship_prayer(text, uuid) to authenticated;

notify pgrst, 'reload schema';
