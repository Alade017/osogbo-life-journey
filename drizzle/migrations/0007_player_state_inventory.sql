-- Phase 3.10: persist player vitals, item capabilities, inventory actions and equipment.
-- Safe to apply after the existing project schema; 2.8's clock columns are ensured here too.
alter table public.characters
  add column if not exists thirst integer not null default 20,
  add column if not exists wanted_level integer not null default 0,
  add column if not exists game_time_minute smallint not null default 0,
  add column if not exists game_time_hour smallint not null default 8,
  add column if not exists game_day integer not null default 1,
  add column if not exists game_weekday smallint not null default 0;

alter table public.characters drop constraint if exists characters_thirst_range;
alter table public.characters add constraint characters_thirst_range check (thirst between 0 and 100);
alter table public.characters drop constraint if exists characters_wanted_level_range;
alter table public.characters add constraint characters_wanted_level_range check (wanted_level between 0 and 5);
alter table public.characters drop constraint if exists characters_health_range;
alter table public.characters add constraint characters_health_range check (health between 0 and 100);
alter table public.characters drop constraint if exists characters_energy_range;
alter table public.characters add constraint characters_energy_range check (energy between 0 and 100);
alter table public.characters drop constraint if exists characters_hunger_range;
alter table public.characters add constraint characters_hunger_range check (hunger between 0 and 100);
alter table public.characters drop constraint if exists characters_game_time_minute_check;
alter table public.characters add constraint characters_game_time_minute_check check (game_time_minute between 0 and 59);
alter table public.characters drop constraint if exists characters_game_time_hour_check;
alter table public.characters add constraint characters_game_time_hour_check check (game_time_hour between 0 and 23);
alter table public.characters drop constraint if exists characters_game_day_check;
alter table public.characters add constraint characters_game_day_check check (game_day >= 1);
alter table public.characters drop constraint if exists characters_game_weekday_check;
alter table public.characters add constraint characters_game_weekday_check check (game_weekday between 0 and 6);

alter table public.wallets add column if not exists bank_balance bigint not null default 0;
alter table public.wallets drop constraint if exists wallets_bank_balance_nonnegative;
alter table public.wallets add constraint wallets_bank_balance_nonnegative check (bank_balance >= 0);

alter table public.inventory_items
  add column if not exists value integer not null default 0,
  add column if not exists stackable boolean not null default false,
  add column if not exists max_stack integer not null default 1,
  add column if not exists usable boolean not null default false,
  add column if not exists equippable boolean not null default false,
  add column if not exists equipment_slot text,
  add column if not exists effects jsonb not null default '{}'::jsonb;

update public.inventory_items set
  category = case
    when slug = 'water_bottle' then 'drinks'
    when category = 'consumable' then 'food'
    when category = 'gear' then 'tools'
    when category = 'gadget' then 'electronics'
    when category in ('food','drinks','clothing','tools','electronics','miscellaneous') then category
    else 'miscellaneous'
  end,
  value = coalesce(value, 0);

update public.inventory_items set
  stackable = true, max_stack = 10, usable = true,
  effects = '{"stat_changes":{"thirst":-35},"time_minutes":1}'::jsonb
where slug = 'water_bottle';
update public.inventory_items set
  equippable = true, equipment_slot = 'top', stackable = false, max_stack = 1
where slug = 'basic_outfit';
update public.inventory_items set
  equippable = true, equipment_slot = 'accessory', stackable = false, max_stack = 1
where slug = 'backpack';

alter table public.inventory_items drop constraint if exists inventory_items_category_valid;
alter table public.inventory_items add constraint inventory_items_category_valid
  check (category in ('food','drinks','clothing','tools','electronics','miscellaneous'));
alter table public.inventory_items drop constraint if exists inventory_items_stack_valid;
alter table public.inventory_items add constraint inventory_items_stack_valid
  check (value >= 0 and max_stack between 1 and 999 and (stackable or max_stack = 1));
alter table public.inventory_items drop constraint if exists inventory_items_equipment_slot_valid;
alter table public.inventory_items add constraint inventory_items_equipment_slot_valid
  check (equipment_slot is null or equipment_slot in ('head','top','bottom','shoes','accessory'));

create table if not exists public.player_equipment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id),
  slot text not null check (slot in ('head','top','bottom','shoes','accessory')),
  durability integer check (durability between 0 and 100),
  metadata jsonb not null default '{}'::jsonb,
  equipped_at timestamptz not null default now(),
  unique (character_id, slot)
);
create index if not exists player_equipment_owner_idx on public.player_equipment(user_id, character_id);
alter table public.player_equipment enable row level security;
grant select on public.player_equipment to authenticated;
grant all on public.player_equipment to service_role;
drop policy if exists "own equipment" on public.player_equipment;
create policy "own equipment" on public.player_equipment for select to authenticated using (user_id = auth.uid());

create or replace function public._advance_character_game_time(p_char uuid, p_minutes integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_time_row record;
  total_minutes integer;
  days_passed integer;
  minute_of_day integer;
  next_hour integer;
  next_minute integer;
  next_day integer;
  next_weekday integer;
begin
  if p_minutes < 0 or p_minutes > 1440 then raise exception 'Invalid game time duration'; end if;
  select game_time_hour, game_time_minute, game_day, game_weekday into current_time_row
    from public.characters where id = p_char for update;
  if not found then raise exception 'Character not found'; end if;
  total_minutes := current_time_row.game_time_hour * 60 + current_time_row.game_time_minute + p_minutes;
  days_passed := total_minutes / 1440;
  minute_of_day := mod(total_minutes, 1440);
  next_hour := minute_of_day / 60;
  next_minute := mod(minute_of_day, 60);
  next_day := current_time_row.game_day + days_passed;
  next_weekday := mod(current_time_row.game_weekday + days_passed, 7);
  update public.characters set game_time_hour = next_hour, game_time_minute = next_minute,
    game_day = next_day, game_weekday = next_weekday where id = p_char;
  return jsonb_build_object('hour', next_hour, 'minute', next_minute, 'day', next_day, 'weekday', next_weekday);
end $$;

create or replace function public.use_inventory_item(p_inventory_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  inv public.player_inventory%rowtype;
  item public.inventory_items%rowtype;
  player public.characters%rowtype;
  stat_key text;
  stat_delta integer;
  next_health integer;
  next_energy integer;
  next_hunger integer;
  next_thirst integer;
  time_cost integer;
  new_time jsonb;
begin
  if auth.uid() is null or cid is null then raise exception 'No character'; end if;
  select * into player from public.characters where id = cid and user_id = auth.uid() for update;
  select * into inv from public.player_inventory where id = p_inventory_id and character_id = cid and user_id = auth.uid() for update;
  if not found or inv.quantity < 1 then raise exception 'You do not own this item'; end if;
  select * into item from public.inventory_items where id = inv.item_id;
  if not found or not item.usable then raise exception 'This item cannot be used'; end if;
  if jsonb_typeof(item.effects -> 'stat_changes') is distinct from 'object' then raise exception 'Item effect is not configured'; end if;
  time_cost := coalesce((item.effects ->> 'time_minutes')::integer, 0);
  if time_cost < 1 or time_cost > 60 then raise exception 'Invalid item time cost'; end if;
  next_health := player.health; next_energy := player.energy;
  next_hunger := player.hunger; next_thirst := player.thirst;
  for stat_key, stat_delta in select key, value::text::integer from jsonb_each(item.effects -> 'stat_changes') loop
    if stat_delta < -100 or stat_delta > 100 then raise exception 'Invalid item effect'; end if;
    case stat_key
      when 'health' then next_health := greatest(0, least(100, next_health + stat_delta));
      when 'energy' then next_energy := greatest(0, least(100, next_energy + stat_delta));
      when 'hunger' then next_hunger := greatest(0, least(100, next_hunger + stat_delta));
      when 'thirst' then next_thirst := greatest(0, least(100, next_thirst + stat_delta));
      else raise exception 'Invalid item effect stat';
    end case;
  end loop;
  update public.characters set health = next_health, energy = next_energy,
    hunger = next_hunger, thirst = next_thirst where id = cid;
  if inv.quantity = 1 then delete from public.player_inventory where id = inv.id;
  else update public.player_inventory set quantity = quantity - 1 where id = inv.id; end if;
  new_time := public._advance_character_game_time(cid, time_cost);
  return jsonb_build_object('item', item.name, 'category', item.category, 'time_minutes', time_cost,
    'health', next_health, 'energy', next_energy, 'hunger', next_hunger, 'thirst', next_thirst, 'game_time', new_time);
end $$;

create or replace function public.discard_inventory_item(p_inventory_id uuid, p_quantity integer default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); inv public.player_inventory%rowtype; item_name text;
begin
  if auth.uid() is null or cid is null then raise exception 'No character'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Choose a valid quantity'; end if;
  perform 1 from public.characters where id = cid and user_id = auth.uid() for update;
  select * into inv from public.player_inventory where id = p_inventory_id and character_id = cid and user_id = auth.uid() for update;
  if not found or inv.quantity < p_quantity then raise exception 'You do not have enough of this item'; end if;
  select name into item_name from public.inventory_items where id = inv.item_id;
  if inv.quantity = p_quantity then delete from public.player_inventory where id = inv.id;
  else update public.player_inventory set quantity = quantity - p_quantity where id = inv.id; end if;
  return jsonb_build_object('item', item_name, 'quantity', p_quantity);
end $$;

create or replace function public.equip_inventory_item(p_inventory_id uuid, p_slot text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  inv public.player_inventory%rowtype;
  item public.inventory_items%rowtype;
  old_equipment public.player_equipment%rowtype;
  new_time jsonb;
begin
  if auth.uid() is null or cid is null then raise exception 'No character'; end if;
  if p_slot not in ('head','top','bottom','shoes','accessory') then raise exception 'Invalid equipment slot'; end if;
  perform 1 from public.characters where id = cid and user_id = auth.uid() for update;
  select * into inv from public.player_inventory where id = p_inventory_id and character_id = cid and user_id = auth.uid() for update;
  if not found or inv.quantity < 1 then raise exception 'You do not own this item'; end if;
  select * into item from public.inventory_items where id = inv.item_id;
  if not found or not item.equippable or item.equipment_slot <> p_slot then raise exception 'This item cannot be equipped in that slot'; end if;
  if inv.quantity = 1 then delete from public.player_inventory where id = inv.id;
  else update public.player_inventory set quantity = quantity - 1 where id = inv.id; end if;
  select * into old_equipment from public.player_equipment where character_id = cid and slot = p_slot for update;
  if found then
    insert into public.player_inventory(user_id, character_id, item_id, quantity)
      values (auth.uid(), cid, old_equipment.item_id, 1)
      on conflict (character_id, item_id) do update set quantity = public.player_inventory.quantity + 1;
    delete from public.player_equipment where id = old_equipment.id;
  end if;
  insert into public.player_equipment(user_id, character_id, item_id, slot, durability)
    values (auth.uid(), cid, item.id, p_slot, 100);
  new_time := public._advance_character_game_time(cid, 2);
  return jsonb_build_object('item', item.name, 'slot', p_slot, 'game_time', new_time);
end $$;

create or replace function public.unequip_item(p_slot text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); equipped public.player_equipment%rowtype; item_name text; new_time jsonb;
begin
  if auth.uid() is null or cid is null then raise exception 'No character'; end if;
  if p_slot not in ('head','top','bottom','shoes','accessory') then raise exception 'Invalid equipment slot'; end if;
  perform 1 from public.characters where id = cid and user_id = auth.uid() for update;
  select * into equipped from public.player_equipment where character_id = cid and user_id = auth.uid() and slot = p_slot for update;
  if not found then raise exception 'There is no item equipped in that slot'; end if;
  select name into item_name from public.inventory_items where id = equipped.item_id;
  insert into public.player_inventory(user_id, character_id, item_id, quantity)
    values (auth.uid(), cid, equipped.item_id, 1)
    on conflict (character_id, item_id) do update set quantity = public.player_inventory.quantity + 1;
  delete from public.player_equipment where id = equipped.id;
  new_time := public._advance_character_game_time(cid, 2);
  return jsonb_build_object('item', item_name, 'slot', p_slot, 'game_time', new_time);
end $$;

revoke execute on function public._advance_character_game_time(uuid, integer) from public, anon, authenticated;
revoke execute on function public.use_inventory_item(uuid) from public, anon;
revoke execute on function public.discard_inventory_item(uuid, integer) from public, anon;
revoke execute on function public.equip_inventory_item(uuid, text) from public, anon;
revoke execute on function public.unequip_item(text) from public, anon;
grant execute on function public.use_inventory_item(uuid) to authenticated;
grant execute on function public.discard_inventory_item(uuid, integer) to authenticated;
grant execute on function public.equip_inventory_item(uuid, text) to authenticated;
grant execute on function public.unequip_item(text) to authenticated;

-- Keep travel's game clock synchronized even when the older phase 2.8 migration
-- has not been recorded in a linked database's migration ledger.
create or replace function public.travel_to_location(p_location_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id(); player public.characters%rowtype;
  destination public.locations%rowtype; payment public.wallets%rowtype; first_visit boolean;
  total_game_minutes integer; days_passed integer; minute_of_day integer;
  new_game_hour integer; new_game_minute integer; new_game_day integer; new_game_weekday integer;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into player from public.characters where id = cid for update;
  select * into destination from public.locations where id = p_location_id;
  if not found then raise exception 'Location not found'; end if;
  if player.current_location_id = destination.id then raise exception 'You are already in this district'; end if;
  if destination.travel_fare > 0 then
    update public.wallets set balance = balance - destination.travel_fare,
      total_expenses = total_expenses + destination.travel_fare
      where character_id = cid and balance >= destination.travel_fare returning * into payment;
    if not found then raise exception 'Not enough in-game Naira for this fare (need %)', destination.travel_fare; end if;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
      values (auth.uid(), payment.id, cid, destination.travel_fare, 'expense', 'travel', 'Travel to ' || destination.name);
    update public.characters set wealth = least(100, 10 + (payment.balance / 10000)::int) where id = cid;
  end if;
  total_game_minutes := player.game_time_hour * 60 + player.game_time_minute + destination.travel_minutes;
  days_passed := total_game_minutes / 1440; minute_of_day := mod(total_game_minutes, 1440);
  new_game_hour := minute_of_day / 60; new_game_minute := mod(minute_of_day, 60);
  new_game_day := player.game_day + days_passed; new_game_weekday := mod(player.game_weekday + days_passed, 7);
  first_visit := not exists (select 1 from public.location_visits where character_id = cid and location_id = destination.id);
  update public.characters set current_location_id = destination.id, game_time_hour = new_game_hour,
    game_time_minute = new_game_minute, game_day = new_game_day, game_weekday = new_game_weekday,
    stress = least(100, stress + case when destination.travel_minutes >= 10 then 2 else 1 end) where id = cid;
  insert into public.location_visits(user_id, character_id, location_id) values (auth.uid(), cid, destination.id)
    on conflict (character_id, location_id) do update set visit_count = location_visits.visit_count + 1, last_visited_at = now();
  if first_visit then
    perform public._grant_xp(cid, 10);
    perform public._notify(cid, 'Discovered ' || destination.name, '+10 XP for exploring a new district.', 'explore');
  end if;
  perform public._recalc_missions(cid);
  return jsonb_build_object('location', destination.name, 'fare', destination.travel_fare,
    'travel_minutes', destination.travel_minutes, 'first_visit', first_visit,
    'game_time', jsonb_build_object('minute', new_game_minute, 'hour', new_game_hour, 'day', new_game_day, 'weekday', new_game_weekday));
end $$;
revoke execute on function public.travel_to_location(uuid) from public, anon;
grant execute on function public.travel_to_location(uuid) to authenticated;
