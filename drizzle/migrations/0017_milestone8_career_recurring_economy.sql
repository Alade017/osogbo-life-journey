-- Milestone 8: career progression, retry-safe purchases, and recurring rent.
-- Amounts are fictional game values in NGN; no eviction or debt penalty is applied.

alter table public.jobs
  add column if not exists skill_reward_slug text not null default 'communication',
  add column if not exists skill_reward_xp integer not null default 8
    check (skill_reward_xp between 0 and 10000),
  add column if not exists shift_start_hour smallint not null default 9
    check (shift_start_hour between 0 and 23),
  add column if not exists shift_end_hour smallint not null default 17
    check (shift_end_hour between 1 and 24);
alter table public.character_jobs
  add column if not exists career_level integer not null default 1
    check (career_level between 1 and 3);

update public.jobs set
  skill_reward_slug = case category
    when 'food_hospitality' then 'cooking'
    when 'technology' then 'technical'
    when 'design' then 'creativity'
    when 'transportation' then 'driving'
    when 'trading' then 'business_management'
    when 'retail' then 'communication'
    when 'education' then 'communication'
    when 'healthcare' then 'caregiving'
    when 'construction' then 'craftsmanship'
    else 'charisma'
  end,
  skill_reward_xp = case category
    when 'technology' then 16
    when 'healthcare' then 14
    when 'education' then 14
    when 'construction' then 12
    when 'food_hospitality' then 10
    when 'trading' then 10
    else 8
  end,
  shift_start_hour = case category
    when 'transportation' then 6
    when 'healthcare' then 7
    when 'retail' then 8
    when 'trading' then 6
    when 'food_hospitality' then 10
    else 9
  end,
  shift_end_hour = case category
    when 'food_hospitality' then 22
    when 'retail' then 18
    when 'trading' then 17
    when 'transportation' then 16
    when 'education' then 16
    when 'technology' then 18
    when 'healthcare' then 19
    else 17
  end;

create table if not exists public.economy_request_results (
  character_id uuid not null references public.characters(id) on delete cascade,
  request_id uuid not null,
  operation text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (character_id, request_id)
);
alter table public.economy_request_results enable row level security;
revoke all on public.economy_request_results from public, anon, authenticated;
grant all on public.economy_request_results to service_role;

-- Preserve the existing atomic work implementation behind a request-key wrapper.
alter function public.perform_job() rename to _perform_job_once;
revoke execute on function public._perform_job_once() from public, anon, authenticated;
create function public.perform_job(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); result jsonb; pay_bonus bigint;
  player public.characters%rowtype; cj public.character_jobs%rowtype; j public.jobs%rowtype;
begin
  if cid is null then raise exception 'No character'; end if;
  if p_request_id is null then raise exception 'Shift request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select er.result into result from public.economy_request_results er
    where er.character_id = cid and er.request_id = p_request_id and er.operation = 'job_shift';
  if found then return result; end if;
  select * into player from public.characters where id = cid and user_id = auth.uid() for update;
  select * into cj from public.character_jobs where character_id = cid and is_current for update;
  if not found then raise exception 'Select a job first'; end if;
  select * into j from public.jobs where id = cj.job_id;
  if player.game_time_hour < j.shift_start_hour or player.game_time_hour >= j.shift_end_hour then
    raise exception 'This shift runs between %:00 and %:00 in game time', j.shift_start_hour, j.shift_end_hour;
  end if;
  result := public._perform_job_once();
  pay_bonus := floor((result ->> 'earned')::numeric * greatest(0, cj.career_level - 1) * 0.10)::bigint;
  result := jsonb_set(result, '{earned}', to_jsonb((result ->> 'earned')::bigint + pay_bonus), true);
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values (cid, p_request_id, 'job_shift', result);
  return result;
end $$;
revoke execute on function public.perform_job(uuid) from public, anon;
grant execute on function public.perform_job(uuid) to authenticated;

drop function public.purchase_shop_item(uuid, integer);
create function public.purchase_shop_item(p_shop_item_id uuid, p_quantity integer, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); cid uuid := public._my_character_id();
  c public.characters%rowtype; w public.wallets%rowtype;
  offer public.shop_items%rowtype; shop public.shops%rowtype;
  item public.inventory_items%rowtype; owned public.player_inventory%rowtype;
  price bigint; total bigint; cash_after bigint; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Purchase request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select er.result into result from public.economy_request_results er
    where er.character_id = cid and er.request_id = p_request_id and er.operation = 'shop_purchase';
  if found then return result; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then raise exception 'Choose a quantity from 1 to 99'; end if;
  select * into c from public.characters where id = cid and user_id = uid for update;
  select * into offer from public.shop_items where id = p_shop_item_id and is_available for update;
  if not found then raise exception 'This item is no longer available'; end if;
  select * into shop from public.shops where id = offer.shop_id;
  if not found or not public._economy_shop_is_open(shop, c.game_time_hour) then raise exception 'This shop is closed'; end if;
  if c.current_location_id is distinct from shop.location_id then raise exception 'Travel to this shop before purchasing'; end if;
  select * into item from public.inventory_items where id = offer.item_id;
  price := coalesce(offer.buy_price, item.buy_price);
  if price is null or price <= 0 then raise exception 'This item is not for sale'; end if;
  if not item.stackable and p_quantity <> 1 then raise exception 'This item can only be purchased one at a time'; end if;
  if p_quantity > item.max_stack then raise exception 'That quantity exceeds the item stack limit'; end if;
  if offer.stock is not null and offer.stock < p_quantity then raise exception 'Not enough stock'; end if;
  total := price * p_quantity;
  select * into w from public.wallets where character_id = cid and user_id = uid for update;
  if not found or w.balance < total then raise exception 'Insufficient cash'; end if;
  select * into owned from public.player_inventory where character_id = cid and item_id = item.id for update;
  if found and owned.quantity + p_quantity > item.max_stack then raise exception 'Your inventory stack is full'; end if;
  cash_after := w.balance - total;
  update public.wallets set balance = cash_after, total_expenses = total_expenses + total where id = w.id;
  insert into public.player_inventory(user_id, character_id, item_id, quantity)
    values (uid, cid, item.id, p_quantity)
    on conflict (character_id, item_id) do update
      set quantity = public.player_inventory.quantity + excluded.quantity;
  if offer.stock is not null then update public.shop_items set stock = stock - p_quantity where id = offer.id; end if;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category,
    description, transaction_type, account, source, destination, balance_after, metadata)
  values (uid, w.id, cid, total, 'expense', 'purchase', 'Bought ' || item.name || ' x' || p_quantity,
    'purchase', 'cash', shop.name, 'inventory', cash_after,
    jsonb_build_object('shop_id', shop.id, 'shop_item_id', offer.id, 'item_id', item.id,
      'quantity', p_quantity, 'unit_price', price, 'request_id', p_request_id));
  perform public._advance_character_game_time(cid, greatest(2, p_quantity * 2));
  result := jsonb_build_object('item', item.name, 'quantity', p_quantity, 'unit_price', price,
    'total', total, 'cash', cash_after);
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values (cid, p_request_id, 'shop_purchase', result);
  return result;
end $$;
revoke execute on function public.purchase_shop_item(uuid, integer, uuid) from public, anon;
grant execute on function public.purchase_shop_item(uuid, integer, uuid) to authenticated;

create or replace function public._award_career_skill()
returns trigger language plpgsql security definer set search_path = public as $$
declare j public.jobs%rowtype; prior_xp integer; next_xp integer;
begin
  if new.times_performed <= old.times_performed then return new; end if;
  select * into j from public.jobs where id = new.job_id;
  if not found or j.skill_reward_xp <= 0 then return new; end if;
  select experience into prior_xp from public.player_skills
    where character_id = new.character_id and skill_slug = j.skill_reward_slug for update;
  next_xp := least(100000000, coalesce(prior_xp, 0) + j.skill_reward_xp);
  insert into public.player_skills(user_id, character_id, skill_slug, level, experience)
    values (new.user_id, new.character_id, j.skill_reward_slug,
      least(100, next_xp / 100), next_xp)
  on conflict (character_id, skill_slug) do update set
    experience = excluded.experience, level = excluded.level;
  return new;
end $$;
drop trigger if exists t_character_jobs_career_skill on public.character_jobs;
create trigger t_character_jobs_career_skill after update of times_performed on public.character_jobs
  for each row execute function public._award_career_skill();
revoke execute on function public._award_career_skill() from public, anon, authenticated;

create or replace function public.promote_current_job()
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); cj public.character_jobs%rowtype;
  j public.jobs%rowtype; skill_level integer; needed_shifts integer; needed_skill integer;
  next_level integer;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into cj from public.character_jobs where character_id = cid and is_current for update;
  if not found then raise exception 'Select a current job first'; end if;
  if cj.career_level >= 3 then raise exception 'You have reached the highest career level for this role'; end if;
  select * into j from public.jobs where id = cj.job_id;
  next_level := cj.career_level + 1;
  needed_shifts := case next_level when 2 then 5 else 15 end;
  needed_skill := case next_level when 2 then 1 else 3 end;
  select coalesce((select ps.level from public.player_skills ps
    where ps.character_id = cid and ps.skill_slug = j.skill_reward_slug), 0) into skill_level;
  if cj.times_performed < needed_shifts then
    raise exception 'Complete % shifts to qualify for promotion', needed_shifts;
  end if;
  if skill_level < needed_skill then
    raise exception 'Reach level % in % to qualify for promotion', needed_skill, j.skill_reward_slug;
  end if;
  update public.character_jobs set career_level = next_level where id = cj.id;
  perform public._notify(cid, 'Career promotion', 'You advanced to career level ' || next_level || ' as ' || j.name || '.', 'career');
  return jsonb_build_object('career_level', next_level, 'job', j.name,
    'skill', j.skill_reward_slug, 'skill_level', skill_level, 'shifts', cj.times_performed);
end $$;
revoke execute on function public.promote_current_job() from public, anon;
grant execute on function public.promote_current_job() to authenticated;

create or replace function public._apply_career_pay_bonus()
returns trigger language plpgsql security definer set search_path = public as $$
declare career_level integer; bonus bigint; new_balance bigint;
begin
  if new.kind <> 'income' or new.category <> 'job' then return new; end if;
  select cj.career_level into career_level from public.character_jobs cj
    where cj.character_id = new.character_id and cj.is_current;
  bonus := floor(new.amount * greatest(0, coalesce(career_level, 1) - 1) * 0.10)::bigint;
  if bonus <= 0 then return new; end if;
  update public.wallets set balance = balance + bonus, total_income = total_income + bonus
    where id = new.wallet_id returning balance into new_balance;
  update public.transactions set amount = amount + bonus, balance_after = new_balance,
    description = description || ' (career level ' || career_level || ' bonus)'
    where id = new.id;
  return new;
end $$;
drop trigger if exists t_career_pay_bonus on public.transactions;
create trigger t_career_pay_bonus after insert on public.transactions
  for each row execute function public._apply_career_pay_bonus();
revoke execute on function public._apply_career_pay_bonus() from public, anon, authenticated;

alter table public.player_properties
  add column if not exists rent_amount bigint,
  add column if not exists rent_period_days integer,
  add column if not exists next_rent_due_at timestamptz;
create table if not exists public.property_rent_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  player_property_id uuid not null references public.player_properties(id) on delete cascade,
  due_at timestamptz not null,
  amount bigint not null check (amount > 0),
  status text not null check (status in ('due','paid')) default 'due',
  paid_at timestamptz,
  unique (player_property_id, due_at),
  check ((status = 'paid' and paid_at is not null) or status = 'due')
);
create index if not exists property_rent_due_idx
  on public.property_rent_ledger(character_id, due_at) where status = 'due';
alter table public.property_rent_ledger enable row level security;
grant select on public.property_rent_ledger to authenticated;
grant all on public.property_rent_ledger to service_role;
create policy "own property rent ledger" on public.property_rent_ledger
  for select to authenticated using (user_id = auth.uid());

create or replace function public._initialize_property_rent()
returns trigger language plpgsql security definer set search_path = public as $$
declare listing public.game_properties%rowtype;
begin
  if new.tenure = 'rented' then
    select * into listing from public.game_properties where id = new.property_id;
    new.rent_amount := listing.rent_price;
    new.rent_period_days := listing.rent_period_days;
    new.next_rent_due_at := coalesce(new.acquired_at, now()) + make_interval(days => listing.rent_period_days);
  else
    new.rent_amount := null;
    new.rent_period_days := null;
    new.next_rent_due_at := null;
  end if;
  return new;
end $$;
drop trigger if exists t_initialize_property_rent on public.player_properties;
create trigger t_initialize_property_rent before insert or update of tenure, property_id
  on public.player_properties for each row execute function public._initialize_property_rent();
revoke execute on function public._initialize_property_rent() from public, anon, authenticated;
update public.player_properties p set
  rent_amount = gp.rent_price,
  rent_period_days = gp.rent_period_days,
  next_rent_due_at = now() + make_interval(days => gp.rent_period_days)
from public.game_properties gp
where p.property_id = gp.id and p.tenure = 'rented'
  and (p.rent_amount is null or p.rent_period_days is null or p.next_rent_due_at is null);

create or replace function public.process_my_property_rent()
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); uid uuid := auth.uid();
  p public.player_properties%rowtype; w public.wallets%rowtype; total_paid bigint := 0;
  paid_periods integer := 0; bill public.property_rent_ledger%rowtype;
begin
  if cid is null or uid is null then raise exception 'Sign in and create a character first'; end if;
  select * into w from public.wallets where character_id = cid and user_id = uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  for p in select * from public.player_properties
      where character_id = cid and user_id = uid and is_active and tenure = 'rented'
        and next_rent_due_at <= now() order by next_rent_due_at limit 24 for update
  loop
    insert into public.property_rent_ledger(user_id, character_id, player_property_id, due_at, amount)
      values (uid, cid, p.id, p.next_rent_due_at, p.rent_amount)
      on conflict (player_property_id, due_at) do nothing;
    update public.player_properties set next_rent_due_at = next_rent_due_at +
      make_interval(days => rent_period_days) where id = p.id;
  end loop;
  -- Retry previously unpaid bills first. No interest, eviction, or negative wallet balance.
  for bill in select * from public.property_rent_ledger
      where character_id = cid and status = 'due' order by due_at limit 24 for update
  loop
    exit when w.balance < bill.amount;
    update public.wallets set balance = balance - bill.amount,
      total_expenses = total_expenses + bill.amount where id = w.id returning * into w;
    update public.property_rent_ledger set status = 'paid', paid_at = now() where id = bill.id;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category,
      description, transaction_type, account, source, destination, balance_after, metadata)
    values (uid, w.id, cid, bill.amount, 'expense', 'property_rent', 'Recurring property rent',
      'expense', 'cash', 'wallet', 'property', w.balance,
      jsonb_build_object('player_property_id', bill.player_property_id, 'due_at', bill.due_at));
    total_paid := total_paid + bill.amount;
    paid_periods := paid_periods + 1;
  end loop;
  return jsonb_build_object('paid', total_paid, 'periods_paid', paid_periods,
    'cash', w.balance, 'unpaid_periods', (select count(*) from public.property_rent_ledger
      where character_id = cid and status = 'due'));
end $$;
revoke execute on function public.process_my_property_rent() from public, anon;
grant execute on function public.process_my_property_rent() to authenticated;

create or replace function public.my_property_rent_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id();
begin
  if cid is null then raise exception 'No character'; end if;
  return jsonb_build_object(
    'next_due_at', (select min(next_rent_due_at) from public.player_properties
      where character_id = cid and is_active and tenure = 'rented'),
    'next_amount', (select rent_amount from public.player_properties
      where character_id = cid and is_active and tenure = 'rented' limit 1),
    'unpaid_total', coalesce((select sum(amount) from public.property_rent_ledger
      where character_id = cid and status = 'due'), 0),
    'unpaid_periods', (select count(*) from public.property_rent_ledger
      where character_id = cid and status = 'due')
  );
end $$;
revoke execute on function public.my_property_rent_status() from public, anon;
grant execute on function public.my_property_rent_status() to authenticated;

create or replace function public.my_game_property_listings()
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); result jsonb;
begin
  if cid is null then raise exception 'No character'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', gp.id, 'name', gp.name, 'description', gp.description,
    'property_type', gp.property_type, 'purchase_price', gp.purchase_price,
    'rent_price', gp.rent_price, 'rent_period_days', gp.rent_period_days,
    'level_required', gp.level_required, 'active_tenure', pp.tenure,
    'is_current', coalesce(pp.is_active, false)
  ) order by gp.purchase_price nulls first, gp.rent_price), '[]'::jsonb)
  into result
  from public.game_properties gp
  left join public.player_properties pp on pp.property_id = gp.id
    and pp.character_id = cid and pp.is_active
  where gp.is_active;
  return result;
end $$;
revoke execute on function public.my_game_property_listings() from public, anon;
grant execute on function public.my_game_property_listings() to authenticated;
