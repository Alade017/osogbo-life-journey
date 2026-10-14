-- Server-authoritative housing choice and furniture placement.
alter table public.characters
  add column if not exists onboarding_step text not null default 'done'
    check (onboarding_step in ('housing', 'done'));

-- Characters created before this feature keep their existing game access.
-- New characters enter the housing step in create_character below.
create table if not exists public.house_types (
  id text primary key,
  label text not null,
  bedrooms smallint not null check (bedrooms between 1 and 10),
  kitchen_access text not null check (kitchen_access in ('shared','private')),
  bathroom_access text not null check (bathroom_access in ('shared','private')),
  monthly_rent bigint not null check (monthly_rent >= 0),
  deposit bigint not null check (deposit >= 0),
  asset_key text not null,
  slots jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order smallint not null default 0
);
alter table public.house_types enable row level security;
create policy "house types readable" on public.house_types for select to authenticated using (is_active);
grant select on public.house_types to authenticated;
grant all on public.house_types to service_role;

insert into public.house_types(id,label,bedrooms,kitchen_access,bathroom_access,monthly_rent,deposit,asset_key,slots,sort_order)
values
 ('shared-room','Shared room',1,'shared','shared',800,800,'shared-room',
  '[{"id":"bed","slot_type":"bed","x":24,"y":66},{"id":"storage","slot_type":"storage","x":78,"y":72},{"id":"decor-1","slot_type":"decor","x":18,"y":34},{"id":"decor-2","slot_type":"decor","x":83,"y":33},{"id":"light","slot_type":"light","x":57,"y":24},{"id":"seat","slot_type":"seat","x":55,"y":71},{"id":"kitchen","slot_type":"kitchen","x":72,"y":53},{"id":"plant","slot_type":"plant","x":89,"y":75},{"id":"bathroom","slot_type":"bathroom","x":92,"y":52},{"id":"device","slot_type":"device","x":40,"y":46}]',1),
 ('single-room','Private room',1,'shared','private',1500,1500,'single-room',
  '[{"id":"bed","slot_type":"bed","x":24,"y":66},{"id":"storage","slot_type":"storage","x":78,"y":72},{"id":"decor-1","slot_type":"decor","x":18,"y":34},{"id":"decor-2","slot_type":"decor","x":83,"y":33},{"id":"light","slot_type":"light","x":57,"y":24},{"id":"seat","slot_type":"seat","x":55,"y":71},{"id":"kitchen","slot_type":"kitchen","x":72,"y":53},{"id":"plant","slot_type":"plant","x":89,"y":75},{"id":"bathroom","slot_type":"bathroom","x":92,"y":52},{"id":"device","slot_type":"device","x":40,"y":46}]',2),
 ('studio-flat','Studio flat',1,'private','private',3000,3000,'studio-flat',
  '[{"id":"bed","slot_type":"bed","x":24,"y":66},{"id":"storage","slot_type":"storage","x":78,"y":72},{"id":"decor-1","slot_type":"decor","x":18,"y":34},{"id":"light","slot_type":"light","x":57,"y":24},{"id":"seat","slot_type":"seat","x":55,"y":71},{"id":"kitchen","slot_type":"kitchen","x":72,"y":53},{"id":"plant","slot_type":"plant","x":89,"y":75},{"id":"table","slot_type":"table","x":41,"y":74},{"id":"bathroom","slot_type":"bathroom","x":92,"y":52},{"id":"device","slot_type":"device","x":40,"y":46}]',3)
on conflict (id) do nothing;

create table if not exists public.player_homes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null unique references public.characters(id) on delete cascade,
  house_type_id text not null references public.house_types(id),
  moved_in_at timestamptz not null default now()
);
alter table public.player_homes enable row level security;
create policy "own player home read" on public.player_homes for select to authenticated using (user_id=auth.uid());
grant select on public.player_homes to authenticated;
grant all on public.player_homes to service_role;

create table if not exists public.home_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id text not null,
  slot_type text not null,
  slot_id text,
  x numeric not null default 50 check (x between 0 and 100),
  y numeric not null default 50 check (y between 0 and 100),
  z smallint not null default 0,
  placed boolean not null default false,
  equipped boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(character_id,item_id)
);
alter table public.home_items enable row level security;
create policy "own home items read" on public.home_items for select to authenticated using (user_id=auth.uid());
grant select on public.home_items to authenticated;
grant all on public.home_items to service_role;

create table if not exists public.housing_choice_idempotency (
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,idempotency_key)
);
alter table public.housing_choice_idempotency enable row level security;
revoke all on public.housing_choice_idempotency from public,anon,authenticated;
grant all on public.housing_choice_idempotency to service_role;

create table if not exists public.home_item_idempotency (
  user_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id,idempotency_key)
);
alter table public.home_item_idempotency enable row level security;
revoke all on public.home_item_idempotency from public,anon,authenticated;
grant all on public.home_item_idempotency to service_role;

create or replace function public._housing_monthly_income(p_character_id uuid)
returns bigint language plpgsql stable security definer set search_path=public as $$
declare monthly bigint;
begin
  select (j.salary + floor(j.salary::numeric * greatest(0,cj.career_level-1) * 0.10)::bigint) * 20
    into monthly
    from public.character_jobs cj join public.jobs j on j.id=cj.job_id
    where cj.character_id=p_character_id and cj.is_current;
  if monthly is null then
    select coalesce(j.salary,0)*20 into monthly
      from public.characters c left join public.jobs j on j.slug=c.occupation_preference
      where c.id=p_character_id;
  end if;
  return coalesce(monthly,0);
end $$;
revoke all on function public._housing_monthly_income(uuid) from public,anon,authenticated;

create or replace function public.housing_eligible_houses(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; w public.wallets%rowtype; monthly bigint; result jsonb;
begin
  select * into c from public.characters where user_id=p_user_id;
  if not found then raise exception 'NO_CHARACTER'; end if;
  select * into w from public.wallets where character_id=c.id;
  monthly := public._housing_monthly_income(c.id);
  select jsonb_build_object('monthly_income',monthly,'houses',coalesce(jsonb_agg(
    jsonb_build_object('id',h.id,'label',h.label,'bedrooms',h.bedrooms,
      'kitchen_access',h.kitchen_access,'bathroom_access',h.bathroom_access,
      'monthly_rent',h.monthly_rent,'deposit',h.deposit,'upfront_total',h.monthly_rent+h.deposit,
      'asset_key',h.asset_key,'slots',h.slots,
      'eligible',((h.monthly_rent+h.deposit)<=coalesce(w.balance,0) and h.monthly_rent<=monthly*0.35),
      'reason',case when h.monthly_rent+h.deposit>coalesce(w.balance,0) then 'You need more money for the first month and deposit.'
        when h.monthly_rent>monthly*0.35 then 'Rent is above 35% of your monthly income.' else null end)
    order by h.sort_order), '[]'::jsonb)) into result
  from public.house_types h where h.is_active;
  return result;
end $$;

create or replace function public.housing_choose(p_user_id uuid,p_house_type_id text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; w public.wallets%rowtype; h public.house_types%rowtype;
  monthly bigint; total bigint; request_hash text; prior public.housing_choice_idempotency%rowtype; response jsonb;
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 128 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash:=md5(p_house_type_id);
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||p_idempotency_key,0));
  select * into prior from public.housing_choice_idempotency where user_id=p_user_id and idempotency_key=p_idempotency_key for update;
  if found then
    if prior.request_hash<>request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return prior.response;
  end if;
  select * into c from public.characters where user_id=p_user_id for update;
  if not found then raise exception 'NO_CHARACTER'; end if;
  if c.onboarding_step<>'housing' and exists(select 1 from public.player_homes where character_id=c.id) then raise exception 'HOUSING_NOT_PENDING'; end if;
  select * into h from public.house_types where id=p_house_type_id and is_active;
  if not found then raise exception 'UNKNOWN_HOUSE'; end if;
  select * into w from public.wallets where character_id=c.id for update;
  monthly:=public._housing_monthly_income(c.id); total:=h.monthly_rent+h.deposit;
  if total>w.balance then raise exception 'INSUFFICIENT_FUNDS'; end if;
  if h.monthly_rent>monthly*0.35 then raise exception 'RENT_TOO_HIGH'; end if;
  insert into public.player_homes(user_id,character_id,house_type_id) values(p_user_id,c.id,h.id);
  update public.wallets set balance=balance-h.deposit,total_expenses=total_expenses+h.deposit,updated_at=now() where id=w.id returning * into w;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description)
  values(p_user_id,w.id,c.id,h.deposit,'expense','housing_deposit','Housing deposit: '||h.label);
  update public.wallets set balance=balance-h.monthly_rent,total_expenses=total_expenses+h.monthly_rent,updated_at=now() where id=w.id returning * into w;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description)
    values(p_user_id,w.id,c.id,h.monthly_rent,'expense','housing_rent','First month rent: '||h.label);
  update public.characters set onboarding_step='done',updated_at=now() where id=c.id;
  insert into public.home_items(user_id,character_id,item_id,slot_type,slot_id,x,y,placed)
  values(p_user_id,c.id,'starter-bed','bed','bed',24,66,true),
        (p_user_id,c.id,'starter-light','light','light',57,24,true),
        (p_user_id,c.id,'starter-seat','seat','seat',55,71,true)
  on conflict(character_id,item_id) do nothing;
  insert into public.home_items(user_id,character_id,item_id,slot_type,placed)
    select p_user_id,c.id,f.item_id||case when n=1 then '' else '-'||n::text end,
      case f.item_id when 'bed' then 'bed' when 'sofa' then 'seat' when 'plant' then 'plant'
        when 'stove' then 'kitchen' when 'shower' then 'bathroom' when 'toilet' then 'bathroom'
        when 'computer' then 'device' when 'television' then 'device' else 'decor' end,false
    from public.character_home_furniture f cross join lateral generate_series(1,f.quantity) n
    where f.character_id=c.id on conflict(character_id,item_id) do nothing;
  select jsonb_build_object('home',jsonb_build_object('id',ph.id,'house_type_id',h.id,'label',h.label,'asset_key',h.asset_key,'slots',h.slots),
    'home_items',coalesce((select jsonb_agg(to_jsonb(i)) from public.home_items i where i.character_id=c.id),'[]'::jsonb),
    'wallet_balance',w.balance,'onboarding_step','done') into response
  from public.player_homes ph where ph.character_id=c.id;
  insert into public.housing_choice_idempotency(user_id,idempotency_key,request_hash,response)
    values(p_user_id,p_idempotency_key,request_hash,response);
  return response;
end $$;

create or replace function public.housing_defer(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  update public.characters c set onboarding_step='housing',updated_at=now()
    where c.user_id=p_user_id and not exists(select 1 from public.player_homes h where h.character_id=c.id);
  if not found then raise exception 'HOUSING_NOT_PENDING'; end if;
  return jsonb_build_object('onboarding_step','housing','deferred',true);
end $$;

create or replace function public._sync_home_furniture_items()
returns trigger language plpgsql security definer set search_path=public as $$
declare n integer; slot_kind text;
begin
  if not exists(select 1 from public.player_homes where character_id=new.character_id) then return new; end if;
  slot_kind:=case new.item_id when 'bed' then 'bed' when 'sofa' then 'seat' when 'plant' then 'plant'
    when 'stove' then 'kitchen' when 'shower' then 'bathroom' when 'toilet' then 'bathroom'
    when 'computer' then 'device' when 'television' then 'device' else 'decor' end;
  for n in 1..new.quantity loop
    insert into public.home_items(user_id,character_id,item_id,slot_type,placed)
    values(new.user_id,new.character_id,new.item_id||case when n=1 then '' else '-'||n::text end,slot_kind,false)
    on conflict(character_id,item_id) do nothing;
  end loop;
  return new;
end $$;
create trigger sync_home_furniture_items after insert or update of quantity on public.character_home_furniture
  for each row execute function public._sync_home_furniture_items();
revoke all on function public._sync_home_furniture_items() from public,anon,authenticated;

create or replace function public.home_item_mutate(p_user_id uuid,p_action text,p_item_id text,p_slot_id text,p_idempotency_key text,p_x numeric default 50,p_y numeric default 50)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.characters%rowtype; item public.home_items%rowtype; slot jsonb;
  request_hash text; prior public.home_item_idempotency%rowtype; result jsonb;
begin
  if p_idempotency_key is null or length(p_idempotency_key) not between 16 and 128 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||p_idempotency_key,0));
  request_hash:=md5(concat_ws(':',p_action,p_item_id,coalesce(p_slot_id,'')));
  select * into prior from public.home_item_idempotency where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then
    if prior.request_hash<>request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return prior.response;
  end if;
  select * into c from public.characters where user_id=p_user_id;
  if not found then raise exception 'NO_CHARACTER'; end if;
  if not exists(select 1 from public.player_homes where character_id=c.id) then raise exception 'NO_HOME'; end if;
  select hi.* into item from public.home_items hi where hi.character_id=c.id and hi.item_id=p_item_id for update;
  if p_action='remove' then
    if not found then raise exception 'UNKNOWN_ITEM'; end if;
    update public.home_items set placed=false,equipped=false,slot_id=null,updated_at=now() where id=item.id;
  elsif p_action in ('place','equip','unequip') then
    if not found then raise exception 'NOT_OWNED'; end if;
    if p_action='place' then
      select s into slot from public.player_homes ph join public.house_types ht on ht.id=ph.house_type_id,
        jsonb_array_elements(ht.slots) s where ph.character_id=c.id and s->>'id'=p_slot_id and s->>'slot_type'=item.slot_type;
      if slot is null then raise exception 'SLOT_MISMATCH'; end if;
      update public.home_items set placed=true,slot_id=p_slot_id,
        x=coalesce((slot->>'x')::numeric,greatest(0,least(100,p_x))),
        y=coalesce((slot->>'y')::numeric,greatest(0,least(100,p_y))),updated_at=now() where id=item.id;
    elsif p_action='equip' then
      if item.slot_type not in ('body','top','bottom','hat','accessory') then raise exception 'ITEM_NOT_WEARABLE'; end if;
      update public.home_items set equipped=true,placed=false,slot_id=null,updated_at=now() where id=item.id;
    else update public.home_items set equipped=false,updated_at=now() where id=item.id; end if;
  else raise exception 'INVALID_ACTION'; end if;
  result:=coalesce((select jsonb_agg(to_jsonb(i)) from public.home_items i where i.character_id=c.id),'[]'::jsonb);
  insert into public.home_item_idempotency(user_id,idempotency_key,request_hash,response)
    values(p_user_id,p_idempotency_key,request_hash,result);
  return result;
end $$;

-- New characters are placed in the housing step; only the server can finish it.
create or replace function public.create_character(
  p_name text,p_gender text,p_appearance jsonb,p_age int,p_personality text,p_occupation text
) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid; wid uuid; appr jsonb; k text;
  b_int int:=10; b_soc int:=10; b_car int:=10; b_hap int:=70;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists(select 1 from public.characters where user_id=uid) then raise exception 'You already have a character'; end if;
  p_name:=btrim(p_name);
  if p_name is null or char_length(p_name)<2 or char_length(p_name)>24 then raise exception 'Name must be 2-24 characters'; end if;
  if p_age is null or p_age not between 16 and 60 then raise exception 'Age must be between 16 and 60'; end if;
  if p_occupation is not null and not exists(select 1 from public.jobs where slug=p_occupation) then raise exception 'Unknown occupation'; end if;
  appr:='{}'::jsonb;
  foreach k in array array['skin','hair','hairColor','outfit','bottoms','shoes','headwear'] loop
    if p_appearance?k and jsonb_typeof(p_appearance->k)='number' and (p_appearance->>k)::int between 0 and 7 then appr:=appr||jsonb_build_object(k,(p_appearance->>k)::int); else appr:=appr||jsonb_build_object(k,0); end if;
  end loop;
  case p_personality
    when 'ambitious' then b_car:=15;
    when 'creative' then b_int:=13; b_hap:=72;
    when 'social' then b_soc:=15;
    when 'studious' then b_int:=15;
    when 'easygoing' then b_hap:=75;
    else raise exception 'Unknown personality';
  end case;
  insert into public.profiles(id,display_name) values(uid,p_name) on conflict(id) do nothing;
  insert into public.characters(user_id,name,gender,appearance,age,personality,occupation_preference,intelligence,social,career,happiness,onboarding_step)
    values(uid,p_name,p_gender,appr,p_age,p_personality,p_occupation,b_int,b_soc,b_car,b_hap,'housing') returning id into cid;
  insert into public.wallets(user_id,character_id) values(uid,cid) returning id into wid;
  perform public._credit(cid,5000,'starting_grant','Welcome to Osogbo starter funds');
  insert into public.player_inventory(user_id,character_id,item_id) select uid,cid,id from public.inventory_items where slug in ('phone','backpack','basic_outfit','water_bottle');
  insert into public.player_missions(user_id,character_id,mission_id) select uid,cid,id from public.missions on conflict(character_id,mission_id) do nothing;
  perform public._notify(cid,'Welcome to Osogbo, '||p_name||'!','Choose a place to live to begin your journey.','welcome');
  return cid;
end $$;
revoke all on function public.housing_eligible_houses(uuid) from public,anon,authenticated;
revoke all on function public.housing_choose(uuid,text,text) from public,anon,authenticated;
revoke all on function public.housing_defer(uuid) from public,anon,authenticated;
revoke all on function public.home_item_mutate(uuid,text,text,text,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.housing_eligible_houses(uuid),public.housing_choose(uuid,text,text),public.housing_defer(uuid),public.home_item_mutate(uuid,text,text,text,text,numeric,numeric) to service_role;
revoke execute on function public.create_character(text,text,jsonb,int,text,text) from public,anon;
grant execute on function public.create_character(text,text,jsonb,int,text,text) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.home_items;
  exception when undefined_object or undefined_table or insufficient_privilege or duplicate_object then null; end;
end $$;
