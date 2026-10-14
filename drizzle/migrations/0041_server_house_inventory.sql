-- Canonical server-owned house, placement, inventory and outfit state.
-- Legacy housing and inventory tables remain intact for older screens and saves.
create table if not exists public.content_items (
  id text primary key,
  category text not null check (category in ('furniture','outfit','accessory')),
  slot_type text not null,
  art_key text not null,
  price_minor bigint not null default 0 check (price_minor >= 0),
  verify boolean not null default true,
  stackable boolean not null default false,
  is_active boolean not null default true
);
alter table public.content_items enable row level security;
drop policy if exists content_items_read_active on public.content_items;
create policy content_items_read_active on public.content_items for select to authenticated using (is_active);
revoke all on public.content_items from public,anon;
revoke insert,update,delete on public.content_items from authenticated;
grant select on public.content_items to authenticated;
grant all on public.content_items to service_role;

create table if not exists public.player_houses (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  house_type_id text not null references public.house_types(id),
  rented_at timestamptz not null default now(),
  next_rent_due_at timestamptz not null,
  status text not null default 'active' check (status in ('active','overdue','ended')),
  created_at timestamptz not null default now()
);
create unique index if not exists player_houses_one_current_per_player
  on public.player_houses(player_id) where status in ('active','overdue');
create index if not exists player_houses_due_idx
  on public.player_houses(next_rent_due_at) where status in ('active','overdue');
alter table public.player_houses enable row level security;
drop policy if exists player_houses_read_own on public.player_houses;
create policy player_houses_read_own on public.player_houses for select to authenticated using (player_id=auth.uid());
revoke all on public.player_houses from public,anon;
revoke insert,update,delete on public.player_houses from authenticated;
grant select on public.player_houses to authenticated;
grant all on public.player_houses to service_role;

create table if not exists public.player_items (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.content_items(id) on delete restrict,
  acquired_at timestamptz not null default now(),
  source text not null check (source in ('purchase','reward','gift')),
  is_stackable boolean not null default false,
  quantity integer not null default 1 check (quantity>0),
  constraint player_items_stack_quantity_valid check (is_stackable or quantity=1)
);
create unique index if not exists player_items_nonstackable_unique
  on public.player_items(player_id,item_id) where not is_stackable;
create index if not exists player_items_owner_idx on public.player_items(player_id,item_id);
alter table public.player_items enable row level security;
drop policy if exists player_items_read_own on public.player_items;
create policy player_items_read_own on public.player_items for select to authenticated using (player_id=auth.uid());
revoke all on public.player_items from public,anon;
revoke insert,update,delete on public.player_items from authenticated;
grant select on public.player_items to authenticated;
grant all on public.player_items to service_role;

create table if not exists public.house_placements (
  id uuid primary key default gen_random_uuid(),
  player_house_id uuid not null references public.player_houses(id) on delete cascade,
  item_id text not null references public.content_items(id) on delete restrict,
  slot text not null,
  placed_at timestamptz not null default now(),
  unique(player_house_id,slot)
);
create index if not exists house_placements_item_idx on public.house_placements(item_id);
alter table public.house_placements enable row level security;
drop policy if exists house_placements_read_own on public.house_placements;
create policy house_placements_read_own on public.house_placements for select to authenticated using
  (exists(select 1 from public.player_houses h where h.id=player_house_id and h.player_id=auth.uid()));
revoke all on public.house_placements from public,anon;
revoke insert,update,delete on public.house_placements from authenticated;
grant select on public.house_placements to authenticated;
grant all on public.house_placements to service_role;

create table if not exists public.player_outfit (
  player_id uuid primary key references public.profiles(id) on delete cascade,
  slots jsonb not null default '{"head":null,"top":null,"bottom":null,"shoes":null,"accessory":null}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint player_outfit_slots_valid check (
    jsonb_typeof(slots)='object' and slots ?& array['head','top','bottom','shoes','accessory']
    and jsonb_typeof(slots->'head') in ('string','null')
    and jsonb_typeof(slots->'top') in ('string','null')
    and jsonb_typeof(slots->'bottom') in ('string','null')
    and jsonb_typeof(slots->'shoes') in ('string','null')
    and jsonb_typeof(slots->'accessory') in ('string','null')
  )
);
alter table public.player_outfit enable row level security;
drop policy if exists player_outfit_read_own on public.player_outfit;
create policy player_outfit_read_own on public.player_outfit for select to authenticated using (player_id=auth.uid());
revoke all on public.player_outfit from public,anon;
revoke insert,update,delete on public.player_outfit from authenticated;
grant select on public.player_outfit to authenticated;
grant all on public.player_outfit to service_role;

create table if not exists public.game_action_audit (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  target_id text,
  outcome text not null check (outcome in ('success','rejected','replayed')),
  error_code text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists game_action_audit_player_created_idx on public.game_action_audit(player_id,created_at desc);
alter table public.game_action_audit enable row level security;
revoke all on public.game_action_audit from public,anon,authenticated;
grant all on public.game_action_audit to service_role;

create table if not exists public.house_action_idempotency (
  player_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  action text not null,
  request_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key(player_id,idempotency_key)
);
alter table public.house_action_idempotency enable row level security;
revoke all on public.house_action_idempotency from public,anon,authenticated;
grant all on public.house_action_idempotency to service_role;

-- Preserve catalog slugs and translate old inventory/equipment/home rows into the new model.
insert into public.content_items(id,category,slot_type,art_key,price_minor,verify,stackable)
select i.slug,case when i.equipment_slot='accessory' then 'accessory' else 'outfit' end,
  coalesce(i.equipment_slot,'top'),i.slug,coalesce(i.buy_price,i.value,0),true,i.stackable
from public.inventory_items i where i.equippable and i.equipment_slot in ('head','top','bottom','shoes','accessory')
on conflict(id) do update set category=excluded.category,slot_type=excluded.slot_type,
  art_key=excluded.art_key,price_minor=excluded.price_minor,stackable=excluded.stackable;
insert into public.content_items(id,category,slot_type,art_key,price_minor,verify,stackable)
values ('bed','furniture','bed','bed',1400,true,false),('sofa','furniture','seat','sofa',900,true,false),
  ('stove','furniture','kitchen','stove',1200,true,false),('shower','furniture','bathroom','shower',1100,true,false),
  ('toilet','furniture','bathroom','toilet',750,true,false),('computer','furniture','device','computer',1800,true,false),
  ('television','furniture','device','television',1600,true,false),('plant','furniture','plant','plant',250,true,false)
on conflict(id) do nothing;
insert into public.content_items(id,category,slot_type,art_key,price_minor,verify,stackable)
select h.item_id,'furniture',h.slot_type,h.item_id,0,true,false from public.home_items h
on conflict(id) do nothing;
insert into public.content_items(id,category,slot_type,art_key,price_minor,verify,stackable)
select distinct f.item_id,'furniture',case f.item_id
  when 'bed' then 'bed' when 'sofa' then 'seat' when 'plant' then 'plant'
  when 'stove' then 'kitchen' when 'shower' then 'bathroom' when 'toilet' then 'bathroom'
  when 'computer' then 'device' when 'television' then 'device' else 'decor' end,
  f.item_id,case f.item_id when 'sofa' then 900 when 'bed' then 1400 when 'stove' then 1200
  when 'shower' then 1100 when 'toilet' then 750 when 'computer' then 1800
  when 'television' then 1600 when 'plant' then 250 else 0 end,true,false
from public.character_home_furniture f on conflict(id) do nothing;

insert into public.player_houses(player_id,house_type_id,rented_at,next_rent_due_at,status,created_at)
select distinct on (h.user_id) h.user_id,h.house_type_id,h.moved_in_at,
  coalesce(h.next_rent_at,h.moved_in_at+interval '7 days'),'active',h.moved_in_at
from public.player_homes h order by h.user_id,h.moved_in_at desc on conflict do nothing;

insert into public.player_items(player_id,item_id,acquired_at,source,is_stackable,quantity)
select pi.user_id,ii.slug,min(pi.created_at),'reward',ii.stackable,sum(pi.quantity)::integer
from public.player_inventory pi join public.inventory_items ii on ii.id=pi.item_id
join public.content_items ci on ci.id=ii.slug group by pi.user_id,ii.slug,ii.stackable
on conflict(player_id,item_id) where not is_stackable do update
  set quantity=greatest(public.player_items.quantity,excluded.quantity);
insert into public.player_items(player_id,item_id,acquired_at,source,is_stackable,quantity)
select distinct e.user_id,ii.slug,e.equipped_at,'reward',false,1
from public.player_equipment e join public.inventory_items ii on ii.id=e.item_id
join public.content_items ci on ci.id=ii.slug
on conflict(player_id,item_id) where not is_stackable do nothing;
insert into public.player_items(player_id,item_id,acquired_at,source,is_stackable,quantity)
select distinct h.user_id,h.item_id,coalesce(h.updated_at,now()),'reward',false,1
from public.home_items h join public.content_items ci on ci.id=h.item_id
on conflict(player_id,item_id) where not is_stackable do nothing;
insert into public.player_items(player_id,item_id,acquired_at,source,is_stackable,quantity)
select f.user_id,f.item_id,f.created_at,'reward',false,f.quantity
from public.character_home_furniture f join public.content_items ci on ci.id=f.item_id
on conflict(player_id,item_id) where not is_stackable do update
  set quantity=greatest(public.player_items.quantity,excluded.quantity);

insert into public.house_placements(player_house_id,item_id,slot,placed_at)
select ph.id,hi.item_id,coalesce(nullif(hi.slot_id,''),hi.item_id),hi.updated_at
from public.home_items hi join public.player_homes legacy
  on legacy.character_id=hi.character_id and legacy.user_id=hi.user_id
join public.player_houses ph on ph.player_id=legacy.user_id and ph.status='active'
join public.content_items ci on ci.id=hi.item_id where hi.placed
on conflict(player_house_id,slot) do nothing;

insert into public.player_outfit(player_id,slots)
select e.user_id,'{"head":null,"top":null,"bottom":null,"shoes":null,"accessory":null}'::jsonb
  || jsonb_object_agg(e.slot,ii.slug)
from public.player_equipment e join public.inventory_items ii on ii.id=e.item_id
join public.content_items ci on ci.id=ii.slug group by e.user_id
on conflict(player_id) do nothing;
insert into public.player_outfit(player_id) select id from public.profiles on conflict(player_id) do nothing;

create or replace function public._audit_house_action(
  p_player_id uuid,p_action text,p_target_id text,p_outcome text,p_error_code text default null,
  p_idempotency_key text default null,p_metadata jsonb default '{}'::jsonb
) returns void language sql security definer set search_path=public as $$
  insert into public.game_action_audit(player_id,action,target_id,outcome,error_code,idempotency_key,metadata)
  values(p_player_id,p_action,p_target_id,p_outcome,p_error_code,p_idempotency_key,coalesce(p_metadata,'{}'::jsonb));
$$;
revoke all on function public._audit_house_action(uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;

create or replace function public._process_player_house_status(p_player_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare ended_ids uuid[];
begin
  update public.player_houses set status='overdue'
    where player_id=p_player_id and status='active' and next_rent_due_at<=now();
  with ended as (
    update public.player_houses set status='ended'
      where player_id=p_player_id and status in ('active','overdue')
        and next_rent_due_at+interval '7 days'<=now()
      returning id
  ) select array_agg(id) into ended_ids from ended;
  if ended_ids is not null then
    delete from public.house_placements where player_house_id=any(ended_ids);
    delete from public.player_homes where user_id=p_player_id;
    update public.home_items set placed=false,slot_id=null,updated_at=now() where user_id=p_player_id;
    perform public._audit_house_action(p_player_id,'tenancy.expire',null,'success',null,null,
      jsonb_build_object('ended_house_ids',to_jsonb(ended_ids)));
  end if;
end;
$$;
revoke all on function public._process_player_house_status(uuid) from public,anon,authenticated;

create or replace function public.process_overdue_player_houses()
returns integer language plpgsql security definer set search_path=public as $$
declare player_row record; ended_count integer:=0; before_count integer; after_count integer;
begin
  for player_row in select distinct player_id from public.player_houses where status in ('active','overdue') loop
    select count(*) into before_count from public.player_houses
      where player_id=player_row.player_id and status in ('active','overdue');
    perform public._process_player_house_status(player_row.player_id);
    select count(*) into after_count from public.player_houses
      where player_id=player_row.player_id and status in ('active','overdue');
    ended_count:=ended_count+greatest(0,before_count-after_count);
  end loop;
  return ended_count;
end;
$$;
revoke all on function public.process_overdue_player_houses() from public,anon,authenticated;
grant execute on function public.process_overdue_player_houses() to service_role;

-- If Supabase pg_cron is enabled, enforce grace-period expiry hourly in the database.
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    execute $job$ select cron.schedule('player-house-expiry-hourly','0 * * * *',
      'select public.process_overdue_player_houses();') $job$;
  end if;
exception when undefined_function or insufficient_privilege then null;
end $$;

-- Mirror legacy server RPC writes until the older home and inventory screens are retired.
create or replace function public._sync_legacy_home_item()
returns trigger language plpgsql security definer set search_path=public as $$
declare house_row public.player_houses%rowtype; v_category text; v_slot text;
begin
  if tg_op='DELETE' then
    delete from public.house_placements p using public.player_houses h
      where p.player_house_id=h.id and h.player_id=old.user_id and p.item_id=old.item_id;
    if old.equipped then
      v_slot:=case old.slot_type when 'hat' then 'head' else old.slot_type end;
      update public.player_outfit set slots=jsonb_set(slots,array[v_slot],'null'::jsonb,true),updated_at=now()
        where player_id=old.user_id and slots->>v_slot=old.item_id;
    end if;
    return old;
  end if;
  v_category:=case when new.equipped and new.slot_type='accessory' then 'accessory'
    when new.equipped then 'outfit' else 'furniture' end;
  v_slot:=case when new.slot_type='hat' then 'head' else new.slot_type end;
  insert into public.content_items(id,category,slot_type,art_key,price_minor,verify)
    values(new.item_id,v_category,v_slot,new.item_id,0,true) on conflict(id) do nothing;
  insert into public.player_items(player_id,item_id,source,is_stackable,quantity)
    values(new.user_id,new.item_id,'reward',false,1)
    on conflict(player_id,item_id) where not is_stackable do nothing;
  select * into house_row from public.player_houses
    where player_id=new.user_id and status='active' limit 1;
  if house_row.id is not null then
    if new.placed then
      insert into public.house_placements(player_house_id,item_id,slot)
        values(house_row.id,new.item_id,coalesce(nullif(new.slot_id,''),new.item_id))
        on conflict(player_house_id,slot) do update set item_id=excluded.item_id,placed_at=now();
    else
      delete from public.house_placements where player_house_id=house_row.id and item_id=new.item_id;
    end if;
  end if;
  if new.equipped and v_slot in ('head','top','bottom','shoes','accessory') then
    insert into public.player_outfit(player_id) values(new.user_id) on conflict(player_id) do nothing;
    update public.player_outfit set slots=jsonb_set(slots,array[v_slot],to_jsonb(new.item_id),true),updated_at=now()
      where player_id=new.user_id;
  elsif tg_op='UPDATE' and old.equipped and v_slot in ('head','top','bottom','shoes','accessory') then
    update public.player_outfit set slots=jsonb_set(slots,array[v_slot],'null'::jsonb,true),updated_at=now()
      where player_id=new.user_id and slots->>v_slot=old.item_id;
  end if;
  return new;
end;
$$;
drop trigger if exists sync_legacy_home_item_to_authoritative on public.home_items;
create trigger sync_legacy_home_item_to_authoritative after insert or update or delete on public.home_items
  for each row execute function public._sync_legacy_home_item();
revoke all on function public._sync_legacy_home_item() from public,anon,authenticated;

create or replace function public._sync_legacy_inventory_to_items()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_player_id uuid; v_slug text; v_quantity integer; v_stackable boolean;
begin
  if tg_op='DELETE' then
    v_player_id:=old.user_id; v_quantity:=old.quantity;
    select ii.slug,ci.stackable into v_slug,v_stackable
      from public.inventory_items ii join public.content_items ci on ci.id=ii.slug where ii.id=old.item_id;
    if v_slug is null then return old; end if;
    if exists(select 1 from public.player_outfit o where o.player_id=v_player_id and o.slots::text like '%'||to_json(v_slug)::text||'%')
      or exists(select 1 from public.house_placements p join public.player_houses h on h.id=p.player_house_id
        where h.player_id=v_player_id and p.item_id=v_slug) then
      update public.player_items set quantity=greatest(1,quantity-v_quantity)
        where player_id=v_player_id and item_id=v_slug and is_stackable;
    else
      delete from public.player_items where player_id=v_player_id and item_id=v_slug;
    end if;
    return old;
  end if;
  v_player_id:=new.user_id; v_quantity:=new.quantity;
  select ii.slug,ci.stackable into v_slug,v_stackable
    from public.inventory_items ii join public.content_items ci on ci.id=ii.slug where ii.id=new.item_id;
  if v_slug is null then return new; end if;
  insert into public.player_items(player_id,item_id,source,is_stackable,quantity)
    values(v_player_id,v_slug,'reward',v_stackable,case when v_stackable then v_quantity else 1 end)
    on conflict(player_id,item_id) where not is_stackable do nothing;
  if v_stackable then
    update public.player_items set quantity=v_quantity where player_id=v_player_id and item_id=v_slug and is_stackable;
  end if;
  return new;
end;
$$;
drop trigger if exists sync_legacy_inventory_to_authoritative on public.player_inventory;
create trigger sync_legacy_inventory_to_authoritative after insert or update or delete on public.player_inventory
  for each row execute function public._sync_legacy_inventory_to_items();
revoke all on function public._sync_legacy_inventory_to_items() from public,anon,authenticated;

create or replace function public._sync_legacy_equipment_to_outfit()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_player_id uuid; v_item_id text; v_slot text; v_category text;
begin
  if tg_op='DELETE' then
    v_player_id:=old.user_id; v_slot:=old.slot;
    select slug into v_item_id from public.inventory_items where id=old.item_id;
    update public.player_outfit set slots=jsonb_set(slots,array[v_slot],'null'::jsonb,true),updated_at=now()
      where player_id=v_player_id and slots->>v_slot=v_item_id;
    return old;
  end if;
  v_player_id:=new.user_id; v_slot:=new.slot;
  select slug into v_item_id from public.inventory_items where id=new.item_id;
  if v_item_id is null then return new; end if;
  v_category:=case when v_slot='accessory' then 'accessory' else 'outfit' end;
  insert into public.content_items(id,category,slot_type,art_key,price_minor,verify)
    select v_item_id,v_category,v_slot,v_item_id,coalesce(i.buy_price,i.value,0),true
      from public.inventory_items i where i.id=new.item_id on conflict(id) do nothing;
  insert into public.player_items(player_id,item_id,source,is_stackable,quantity)
    values(v_player_id,v_item_id,'reward',false,1)
    on conflict(player_id,item_id) where not is_stackable do nothing;
  insert into public.player_outfit(player_id) values(v_player_id) on conflict(player_id) do nothing;
  update public.player_outfit set slots=jsonb_set(slots,array[v_slot],to_jsonb(v_item_id),true),updated_at=now()
    where player_id=v_player_id;
  return new;
end;
$$;
drop trigger if exists sync_legacy_equipment_to_authoritative on public.player_equipment;
create trigger sync_legacy_equipment_to_authoritative after insert or update or delete on public.player_equipment
  for each row execute function public._sync_legacy_equipment_to_outfit();
revoke all on function public._sync_legacy_equipment_to_outfit() from public,anon,authenticated;

create or replace function public.get_house_state(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare house_row public.player_houses%rowtype; outfit_slots jsonb; result jsonb;
begin
  perform public._process_player_house_status(p_player_id);
  select * into house_row from public.player_houses
    where player_id=p_player_id and status in ('active','overdue') limit 1;
  select slots into outfit_slots from public.player_outfit where player_id=p_player_id;
  select jsonb_build_object(
    'house',case when house_row.id is null then null else (
      select jsonb_build_object('id',house_row.id,'house_type_id',house_row.house_type_id,
        'rented_at',house_row.rented_at,'next_rent_due_at',house_row.next_rent_due_at,'status',house_row.status,
        'house_type',jsonb_build_object('id',ht.id,'label',ht.label,'bedrooms',ht.bedrooms,
          'asset_key',ht.asset_key,'slots',ht.slots,'weekly_rent_minor',ht.weekly_rent_minor))
      from public.house_types ht where ht.id=house_row.house_type_id
    ) end,
    'placements',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'item_id',p.item_id,
      'slot',p.slot,'placed_at',p.placed_at,'art_key',ci.art_key,'category',ci.category,'slot_type',ci.slot_type)
      order by p.slot) from public.house_placements p join public.content_items ci on ci.id=p.item_id
      where p.player_house_id=house_row.id),'[]'::jsonb),
    'outfit',coalesce(outfit_slots,'{"head":null,"top":null,"bottom":null,"shoes":null,"accessory":null}'::jsonb),
    'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',pi.id,'item_id',pi.item_id,
      'quantity',pi.quantity,'source',pi.source,'acquired_at',pi.acquired_at,'category',ci.category,
      'slot_type',ci.slot_type,'art_key',ci.art_key,'price_minor',ci.price_minor,'verify',ci.verify)
      order by pi.acquired_at,pi.item_id) from public.player_items pi
      join public.content_items ci on ci.id=pi.item_id where pi.player_id=p_player_id),'[]'::jsonb)
  ) into result;
  perform public._audit_house_action(p_player_id,'house.state',null,'success');
  return result;
end;
$$;
revoke all on function public.get_house_state(uuid) from public,anon,authenticated;
grant execute on function public.get_house_state(uuid) to service_role;

create or replace function public._house_error(p_code text)
returns jsonb language sql immutable as $$ select jsonb_build_object('ok',false,'code',p_code); $$;

create or replace function public.house_place(p_player_id uuid,p_item_id text,p_slot text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare house_row public.player_houses%rowtype; item public.content_items%rowtype;
  character_id uuid; existing_count integer; owned_count integer;
begin
  perform public._process_player_house_status(p_player_id);
  begin
    select * into house_row from public.player_houses
      where player_id=p_player_id and status='active' for update;
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    select * into item from public.content_items where id=p_item_id and is_active;
    if not found or item.category<>'furniture' then raise exception 'UNKNOWN_ITEM'; end if;
    if not exists(select 1 from public.house_types ht,jsonb_array_elements(ht.slots) s
      where ht.id=house_row.house_type_id and s->>'id'=p_slot and s->>'slot_type'=item.slot_type)
      then raise exception 'SLOT_MISMATCH'; end if;
    perform 1 from public.player_items where player_id=p_player_id and item_id=p_item_id for update;
    select coalesce(sum(quantity),0) into owned_count from public.player_items
      where player_id=p_player_id and item_id=p_item_id;
    select count(*) into existing_count from public.house_placements
      where player_house_id=house_row.id and item_id=p_item_id;
    if owned_count<=existing_count then raise exception 'NOT_OWNED'; end if;
    insert into public.house_placements(player_house_id,item_id,slot) values(house_row.id,p_item_id,p_slot);
    select id into character_id from public.characters where user_id=p_player_id;
    if character_id is not null then
      insert into public.home_items(user_id,character_id,item_id,slot_type,slot_id,placed)
        values(p_player_id,character_id,p_item_id,item.slot_type,p_slot,true)
        on conflict(character_id,item_id) do update set slot_type=excluded.slot_type,
          slot_id=excluded.slot_id,placed=true,updated_at=now();
    end if;
    perform public._audit_house_action(p_player_id,'house.place',p_item_id,'success',null,null,jsonb_build_object('slot',p_slot));
    return jsonb_build_object('ok',true,'state',public.get_house_state(p_player_id));
  exception when unique_violation then
    perform public._audit_house_action(p_player_id,'house.place',p_item_id,'rejected','SLOT_OCCUPIED',null,jsonb_build_object('slot',p_slot));
    return public._house_error('SLOT_OCCUPIED');
  when others then
    perform public._audit_house_action(p_player_id,'house.place',p_item_id,'rejected',sqlerrm,null,jsonb_build_object('slot',p_slot));
    return public._house_error(sqlerrm);
  end;
end;
$$;

create or replace function public.house_remove(p_player_id uuid,p_slot text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare house_row public.player_houses%rowtype; placement public.house_placements%rowtype; v_character_id uuid;
begin
  perform public._process_player_house_status(p_player_id);
  begin
    select * into house_row from public.player_houses where player_id=p_player_id and status='active' for update;
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    delete from public.house_placements where player_house_id=house_row.id and slot=p_slot returning * into placement;
    if not found then raise exception 'EMPTY_SLOT'; end if;
    if not exists(select 1 from public.player_items where player_id=p_player_id and item_id=placement.item_id and quantity>0)
      then raise exception 'NOT_OWNED'; end if;
    select id into v_character_id from public.characters where user_id=p_player_id;
    if v_character_id is not null then
      update public.home_items set placed=false,slot_id=null,updated_at=now()
        where home_items.character_id=v_character_id and item_id=placement.item_id;
    end if;
    perform public._audit_house_action(p_player_id,'house.remove',placement.item_id,'success',null,null,jsonb_build_object('slot',p_slot));
    return jsonb_build_object('ok',true,'state',public.get_house_state(p_player_id));
  exception when others then
    perform public._audit_house_action(p_player_id,'house.remove',null,'rejected',sqlerrm,null,jsonb_build_object('slot',p_slot));
    return public._house_error(sqlerrm);
  end;
end;
$$;

create or replace function public.outfit_equip(p_player_id uuid,p_item_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item public.content_items%rowtype; outfit_slots jsonb; char_id uuid; inventory_id uuid; old_inventory_id uuid;
begin
  begin
    select * into item from public.content_items where id=p_item_id and is_active;
    if not found or item.category not in ('outfit','accessory')
      or item.slot_type not in ('head','top','bottom','shoes','accessory') then raise exception 'NOT_EQUIPPABLE'; end if;
    if not exists(select 1 from public.player_items where player_id=p_player_id and item_id=p_item_id and quantity>0)
      then raise exception 'NOT_OWNED'; end if;
    insert into public.player_outfit(player_id) values(p_player_id) on conflict(player_id) do nothing;
    update public.player_outfit set slots=jsonb_set(slots,array[item.slot_type],to_jsonb(p_item_id),true),updated_at=now()
      where player_id=p_player_id returning slots into outfit_slots;
    select id into char_id from public.characters where user_id=p_player_id;
    select id into inventory_id from public.inventory_items where slug=p_item_id;
    if char_id is not null then
      select pe.item_id into old_inventory_id from public.player_equipment pe
        where pe.user_id=p_player_id and pe.character_id=char_id and pe.slot=item.slot_type for update;
      if old_inventory_id is distinct from inventory_id then
        if old_inventory_id is not null then
          insert into public.player_inventory(user_id,character_id,item_id,quantity)
            values(p_player_id,char_id,old_inventory_id,1)
            on conflict(character_id,item_id) do update set quantity=public.player_inventory.quantity+1;
        end if;
        delete from public.player_equipment where user_id=p_player_id and character_id=char_id and slot=item.slot_type;
        if inventory_id is not null then
          insert into public.player_equipment(user_id,character_id,item_id,slot)
            values(p_player_id,char_id,inventory_id,item.slot_type);
        end if;
      end if;
    end if;
    perform public._audit_house_action(p_player_id,'outfit.equip',p_item_id,'success',null,null,jsonb_build_object('slot',item.slot_type));
    return jsonb_build_object('ok',true,'slots',outfit_slots,'state',public.get_house_state(p_player_id));
  exception when others then
    perform public._audit_house_action(p_player_id,'outfit.equip',p_item_id,'rejected',sqlerrm);
    return public._house_error(sqlerrm);
  end;
end;
$$;

create or replace function public.outfit_unequip(p_player_id uuid,p_slot text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare outfit_slots jsonb; char_id uuid;
begin
  begin
    if p_slot not in ('head','top','bottom','shoes','accessory') then raise exception 'INVALID_SLOT'; end if;
    insert into public.player_outfit(player_id) values(p_player_id) on conflict(player_id) do nothing;
    if coalesce((select slots->>p_slot from public.player_outfit where player_id=p_player_id),'')='' then
      raise exception 'EMPTY_SLOT';
    end if;
    update public.player_outfit set slots=jsonb_set(slots,array[p_slot],'null'::jsonb,true),updated_at=now()
      where player_id=p_player_id returning slots into outfit_slots;
    select id into char_id from public.characters where user_id=p_player_id;
    if char_id is not null then
      delete from public.player_equipment where user_id=p_player_id and character_id=char_id and slot=p_slot;
    end if;
    perform public._audit_house_action(p_player_id,'outfit.unequip',p_slot,'success');
    return jsonb_build_object('ok',true,'slots',outfit_slots,'state',public.get_house_state(p_player_id));
  exception when others then
    perform public._audit_house_action(p_player_id,'outfit.unequip',p_slot,'rejected',sqlerrm);
    return public._house_error(sqlerrm);
  end;
end;
$$;

create or replace function public.shop_buy(p_player_id uuid,p_item_id text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prior public.house_action_idempotency%rowtype; item public.content_items%rowtype;
  wallet public.wallets%rowtype; v_character_id uuid; response jsonb; request_hash text; affected integer;
begin
  begin
    if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 128 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_player_id::text||p_idempotency_key,0));
    request_hash:=md5('shop.buy:'||p_item_id);
    select * into prior from public.house_action_idempotency
      where player_id=p_player_id and idempotency_key=p_idempotency_key for update;
    if found then
      if prior.action<>'shop.buy' or prior.request_hash<>request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
      perform public._audit_house_action(p_player_id,'shop.buy',p_item_id,'replayed',null,p_idempotency_key);
      return prior.response;
    end if;
    select * into item from public.content_items where id=p_item_id and is_active;
    if not found then raise exception 'UNKNOWN_ITEM'; end if;
    select id into v_character_id from public.characters where user_id=p_player_id for update;
    if not found then raise exception 'NO_CHARACTER'; end if;
    select * into wallet from public.wallets where user_id=p_player_id and character_id=v_character_id for update;
    if not found then raise exception 'NO_WALLET'; end if;
    if wallet.balance<item.price_minor then raise exception 'INSUFFICIENT_FUNDS'; end if;
    update public.wallets set balance=balance-item.price_minor,total_expenses=total_expenses+item.price_minor,updated_at=now()
      where id=wallet.id returning * into wallet;
    if item.stackable then
      update public.player_items set quantity=quantity+1
        where player_id=p_player_id and item_id=p_item_id and is_stackable;
      get diagnostics affected=row_count;
      if affected=0 then
        insert into public.player_items(player_id,item_id,source,is_stackable,quantity)
          values(p_player_id,p_item_id,'purchase',true,1);
      end if;
    else
      insert into public.player_items(player_id,item_id,source,is_stackable,quantity)
        values(p_player_id,p_item_id,'purchase',false,1);
    end if;
    insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
      transaction_type,account,source,destination,balance_after,metadata)
    values(p_player_id,wallet.id,v_character_id,item.price_minor,'expense','purchase','Bought '||item.id,
      'purchase','cash','wallet','inventory',wallet.balance,
      jsonb_build_object('item_id',p_item_id,'idempotency_key',p_idempotency_key));
    response:=jsonb_build_object('ok',true,'item_id',p_item_id,'charged_minor',item.price_minor,
      'wallet_balance',wallet.balance,'state',public.get_house_state(p_player_id));
    insert into public.house_action_idempotency(player_id,idempotency_key,action,request_hash,response)
      values(p_player_id,p_idempotency_key,'shop.buy',request_hash,response);
    perform public._audit_house_action(p_player_id,'shop.buy',p_item_id,'success',null,p_idempotency_key,
      jsonb_build_object('charged_minor',item.price_minor));
    return response;
  exception when others then
    perform public._audit_house_action(p_player_id,'shop.buy',p_item_id,'rejected',sqlerrm,p_idempotency_key);
    return public._house_error(sqlerrm);
  end;
end;
$$;

create or replace function public.housing_rent(p_user_id uuid,p_house_type_id text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare prior public.housing_choice_idempotency%rowtype; c public.characters%rowtype;
  w public.wallets%rowtype; h public.house_types%rowtype; new_house public.player_houses%rowtype;
  listing jsonb; house_eligibility jsonb; eligibility_error text; response jsonb;
  request_hash text; paid_at timestamptz:=now();
begin
  perform public._process_player_house_status(p_user_id);
  begin
    if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 128 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||p_idempotency_key,0));
    request_hash:=md5('weekly-rent:'||p_house_type_id);
    select * into prior from public.housing_choice_idempotency
      where user_id=p_user_id and idempotency_key=p_idempotency_key for update;
    if found then
      if prior.request_hash<>request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
      perform public._audit_house_action(p_user_id,'housing.rent',p_house_type_id,'replayed',null,p_idempotency_key);
      return prior.response;
    end if;
    select * into c from public.characters where user_id=p_user_id for update;
    if not found then raise exception 'NO_CHARACTER'; end if;
    if exists(select 1 from public.player_houses where player_id=p_user_id and status in ('active','overdue'))
      then raise exception 'ALREADY_RENTING'; end if;
    select * into h from public.house_types where id=p_house_type_id and is_active for share;
    if not found then raise exception 'UNKNOWN_HOUSE'; end if;
    select * into w from public.wallets where user_id=p_user_id and character_id=c.id for update;
    if not found then raise exception 'NO_WALLET'; end if;
    listing:=public.housing_eligible_houses(p_user_id);
    select item into house_eligibility from jsonb_array_elements(listing->'houses') as entries(item)
      where item->>'id'=p_house_type_id;
    if coalesce((house_eligibility->>'eligible')::boolean,false)=false then
      eligibility_error:=coalesce(house_eligibility->>'reason_code','HOUSE_INELIGIBLE');
      raise exception '%',eligibility_error;
    end if;
    if h.weekly_rent_minor*(h.deposit_weeks+1)>w.balance then raise exception 'INSUFFICIENT_FUNDS'; end if;

    update public.wallets set balance=balance-h.weekly_rent_minor*h.deposit_weeks,
      total_expenses=total_expenses+h.weekly_rent_minor*h.deposit_weeks,updated_at=paid_at
      where id=w.id returning * into w;
    insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description)
      values(p_user_id,w.id,c.id,h.weekly_rent_minor*h.deposit_weeks,'expense','housing_deposit','Housing deposit: '||h.label);
    update public.wallets set balance=balance-h.weekly_rent_minor,
      total_expenses=total_expenses+h.weekly_rent_minor,updated_at=paid_at
      where id=w.id returning * into w;
    insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description)
      values(p_user_id,w.id,c.id,h.weekly_rent_minor,'expense','housing_rent','First week rent: '||h.label);

    insert into public.player_houses(player_id,house_type_id,rented_at,next_rent_due_at,status)
      values(p_user_id,h.id,paid_at,paid_at+interval '7 days','active') returning * into new_house;
    insert into public.player_homes(user_id,character_id,house_type_id,moved_in_at,next_rent_at)
      values(p_user_id,c.id,h.id,paid_at,paid_at+interval '7 days')
      on conflict(character_id) do update set house_type_id=excluded.house_type_id,
        moved_in_at=excluded.moved_in_at,next_rent_at=excluded.next_rent_at;
    update public.characters set onboarding_step='done',updated_at=paid_at where id=c.id;

    insert into public.content_items(id,category,slot_type,art_key,price_minor,verify,stackable)
    values('starter-bed','furniture','bed','bed',0,true,false),
      ('starter-light','furniture','light','light',0,true,false),
      ('starter-seat','furniture','seat','seat',0,true,false)
    on conflict(id) do nothing;
    insert into public.player_items(player_id,item_id,source,is_stackable,quantity)
    values(p_user_id,'starter-bed','reward',false,1),(p_user_id,'starter-light','reward',false,1),
      (p_user_id,'starter-seat','reward',false,1)
    on conflict(player_id,item_id) where not is_stackable do nothing;
    insert into public.house_placements(player_house_id,item_id,slot)
    select new_house.id,v.item_id,v.slot from (values
      ('starter-bed','bed'),('starter-light','light'),('starter-seat','seat')) v(item_id,slot)
    where exists(select 1 from jsonb_array_elements(h.slots) s where s->>'id'=v.slot and s->>'slot_type'=(
      select ci.slot_type from public.content_items ci where ci.id=v.item_id))
    on conflict(player_house_id,slot) do nothing;
    insert into public.home_items(user_id,character_id,item_id,slot_type,slot_id,placed)
    select p_user_id,c.id,v.item_id,ci.slot_type,v.slot,true
      from (values ('starter-bed','bed'),('starter-light','light'),('starter-seat','seat')) v(item_id,slot)
      join public.content_items ci on ci.id=v.item_id
    on conflict(character_id,item_id) do update set placed=true,slot_id=excluded.slot_id,updated_at=now();

    response:=jsonb_build_object('ok',true,'home',jsonb_build_object('id',new_house.id,
      'house_type_id',h.id,'rented_at',new_house.rented_at,'next_rent_due_at',new_house.next_rent_due_at,
      'status',new_house.status),'home_items',coalesce((select jsonb_agg(to_jsonb(i))
      from public.home_items i where i.character_id=c.id),'[]'::jsonb),
      'wallet_balance',w.balance,'onboarding_step','done','state',public.get_house_state(p_user_id));
    insert into public.housing_choice_idempotency(user_id,idempotency_key,request_hash,response)
      values(p_user_id,p_idempotency_key,request_hash,response);
    perform public._audit_house_action(p_user_id,'housing.rent',p_house_type_id,'success',null,p_idempotency_key);
    return response;
  exception when others then
    perform public._audit_house_action(p_user_id,'housing.rent',p_house_type_id,'rejected',sqlerrm,p_idempotency_key);
    return public._house_error(sqlerrm);
  end;
end;
$$;

revoke all on function public._house_error(text) from public,anon,authenticated;
revoke all on function public.house_place(uuid,text,text) from public,anon,authenticated;
revoke all on function public.house_remove(uuid,text) from public,anon,authenticated;
revoke all on function public.outfit_equip(uuid,text) from public,anon,authenticated;
revoke all on function public.outfit_unequip(uuid,text) from public,anon,authenticated;
revoke all on function public.shop_buy(uuid,text,text) from public,anon,authenticated;
revoke all on function public.housing_rent(uuid,text,text) from public,anon,authenticated;
grant execute on function public.house_place(uuid,text,text),public.house_remove(uuid,text),
  public.outfit_equip(uuid,text),public.outfit_unequip(uuid,text),public.shop_buy(uuid,text,text),
  public.housing_rent(uuid,text,text) to service_role;

do $$ begin
  begin alter publication supabase_realtime add table public.player_houses;
  exception when undefined_object or undefined_table or insufficient_privilege or duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.house_placements;
  exception when undefined_object or undefined_table or insufficient_privilege or duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.player_items;
  exception when undefined_object or undefined_table or insufficient_privilege or duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.player_outfit;
  exception when undefined_object or undefined_table or insufficient_privilege or duplicate_object then null; end;
end $$;
