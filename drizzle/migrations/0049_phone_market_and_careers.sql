-- Phone social, editable billboard creatives, and the Osun Mall wholesale venue.

alter table public.player_advertisements
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.update_player_advertisement(
  p_advertisement_id uuid,
  p_advertiser_name text,
  p_title text,
  p_description text,
  p_creative_theme text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  uid uuid:=auth.uid(); cid uuid:=public._my_character_id();
  ad public.player_advertisements%rowtype;
  safe_advertiser text:=btrim(coalesce(p_advertiser_name,''));
  safe_title text:=btrim(coalesce(p_title,''));
  safe_description text:=btrim(coalesce(p_description,''));
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if length(safe_advertiser) not between 2 and 48 then raise exception 'Advertiser name must be 2 to 48 characters'; end if;
  if length(safe_title) not between 3 and 72 then raise exception 'Ad title must be 3 to 72 characters'; end if;
  if length(safe_description) not between 3 and 180 then raise exception 'Ad description must be 3 to 180 characters'; end if;
  if p_creative_theme not in ('green','ink','sun','clay') then raise exception 'Choose a supported ad theme'; end if;
  select * into ad from public.player_advertisements
    where id=p_advertisement_id and owner_user_id=uid and owner_character_id=cid for update;
  if not found then raise exception 'Campaign not found'; end if;
  if ad.status<>'active' or ad.ends_at<=now() then raise exception 'Only a live campaign can be edited'; end if;
  update public.player_advertisements set
    advertiser_name=safe_advertiser,title=safe_title,description=safe_description,
    creative_theme=p_creative_theme,updated_at=now()
    where id=ad.id;
  return jsonb_build_object('ok',true,'advertisementId',ad.id,'updatedAt',now());
end $$;
revoke all on function public.update_player_advertisement(uuid,text,text,text,text) from public,anon;
grant execute on function public.update_player_advertisement(uuid,text,text,text,text) to authenticated;

create table public.player_status_posts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  owner_character_id uuid not null references public.characters(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 280),
  theme text not null check (theme in ('porcelain','leaf','ink','sunset')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),
  check (expires_at>created_at)
);
create index player_status_posts_active_idx on public.player_status_posts(owner_character_id,created_at desc)
  where expires_at>created_at;
alter table public.player_status_posts enable row level security;
grant select on public.player_status_posts to authenticated;
grant all on public.player_status_posts to service_role;
create policy player_status_friends_read on public.player_status_posts for select to authenticated using (
  owner_user_id=auth.uid() or exists (
    select 1 from public.characters me join public.player_friendships f
      on f.first_character_id=least(me.id,player_status_posts.owner_character_id)
     and f.second_character_id=greatest(me.id,player_status_posts.owner_character_id)
    where me.user_id=auth.uid()
  )
);
revoke insert,update,delete on public.player_status_posts from authenticated;
do $$ begin alter publication supabase_realtime add table public.player_status_posts;
exception when duplicate_object or undefined_object then null; end $$;

create or replace function public.get_friend_status_posts()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'characterId',s.owner_character_id,'playerName',c.name,'appearance',c.appearance,
    'gender',c.gender,'body',s.body,'theme',s.theme,'createdAt',s.created_at,'expiresAt',s.expires_at,
    'isOwn',s.owner_user_id=auth.uid()) order by s.created_at desc),'[]'::jsonb)
  from public.player_status_posts s join public.characters c on c.id=s.owner_character_id
  where s.expires_at>now() and (s.owner_user_id=auth.uid() or exists (
    select 1 from public.characters me join public.player_friendships f
      on f.first_character_id=least(me.id,s.owner_character_id)
     and f.second_character_id=greatest(me.id,s.owner_character_id)
    where me.user_id=auth.uid()))
$$;

create or replace function public.create_player_status(p_body text,p_theme text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); clean text:=btrim(coalesce(p_body,'')); row_id uuid;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if length(clean) not between 1 and 280 then raise exception 'Status must be 1 to 280 characters'; end if;
  if p_theme not in ('porcelain','leaf','ink','sunset') then raise exception 'Choose a supported status theme'; end if;
  insert into public.player_status_posts(owner_user_id,owner_character_id,body,theme)
    values(uid,cid,clean,p_theme) returning id into row_id;
  return jsonb_build_object('ok',true,'id',row_id);
end $$;

create or replace function public.delete_player_status(p_status_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  delete from public.player_status_posts where id=p_status_id and owner_user_id=auth.uid();
  if not found then raise exception 'Status not found'; end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.get_friend_status_posts() from public,anon;
revoke all on function public.create_player_status(text,text) from public,anon;
revoke all on function public.delete_player_status(uuid) from public,anon;
grant execute on function public.get_friend_status_posts() to authenticated;
grant execute on function public.create_player_status(text,text) to authenticated;
grant execute on function public.delete_player_status(uuid) to authenticated;

-- Public landmark name supplied by the product owner. No address or coordinates are claimed.
insert into public.locations
  (slug,name,tagline,description,district_type,map_x,map_y,color,planned_features,sort_order,
   type,latitude,longitude,icon,is_active,level_required,metadata,map_coordinate_mode,
   travel_fare,travel_minutes,canvas_x,canvas_y,map_category,neighbor_slugs,job_contract_slugs,entry_loops)
values ('osun-mall','Osun Mall','Bulk supermarket shopping',
  'A game supermarket for buying household goods and food in larger packs at lower per-item prices.',
  'commercial',78,42,'amber',array['wholesale shopping','career jobs'],69,'market',null,null,'shopping-bag',true,0,
  '{"origin":"public-name","verify":true,"map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,
  0.78,0.42,'commercial',array['cedar-bank','lantern-club'],array['osun_mall_stock_associate'],array['shop','work'])
on conflict (slug) do update set name=excluded.name,tagline=excluded.tagline,description=excluded.description,
  latitude=null,longitude=null,is_active=true,metadata=excluded.metadata,map_coordinate_mode='virtual_game',
  canvas_x=excluded.canvas_x,canvas_y=excluded.canvas_y,map_category=excluded.map_category;

insert into public.game_places(slug,location_id,name,category,description,origin,disclosure,sort_order)
select 'osun-mall-supermarket',id,'Osun Mall supermarket','supermarket',
  'Buy food and household goods in bulk packs with server-set wholesale prices.','real-world-inspired',
  'Independent game depiction; OSOGBO LIFE is not affiliated with this venue.',1
from public.locations where slug='osun-mall'
on conflict (slug) do update set location_id=excluded.location_id,name=excluded.name,description=excluded.description;

insert into public.map_landmarks(id,district_id,location_id,min_age,is_available)
select 'osun-mall','commerce-quarter',id,0,true from public.locations where slug='osun-mall'
on conflict (id) do update set district_id=excluded.district_id,location_id=excluded.location_id,is_available=true;
insert into public.map_location_districts(location_id,district_id)
select id,'commerce-quarter' from public.locations where slug='osun-mall'
on conflict (location_id) do update set district_id=excluded.district_id;

insert into public.shops(slug,name,location_id,game_place_id,category,opening_hour,closing_hour)
select 'osun-mall-wholesale','Osun Mall wholesale',l.id,g.id,'supermarket',8,21
from public.locations l join public.game_places g on g.location_id=l.id and g.slug='osun-mall-supermarket'
where l.slug='osun-mall'
on conflict (slug) do update set location_id=excluded.location_id,game_place_id=excluded.game_place_id,is_open=true;

alter table public.shop_items add column if not exists minimum_quantity integer not null default 1
  check (minimum_quantity between 1 and 99);
insert into public.shop_items(shop_id,item_id,buy_price,minimum_quantity)
select s.id,i.id,greatest(1,floor(i.buy_price*0.8)::bigint),
  case when i.stackable then least(5,i.max_stack) else 1 end
from public.shops s cross join public.inventory_items i
where s.slug='osun-mall-wholesale' and i.slug in ('water_bottle','meat_pie','jollof_rice')
on conflict (shop_id,item_id) do update set buy_price=excluded.buy_price,
  minimum_quantity=excluded.minimum_quantity,is_available=true;

create or replace function public._validate_shop_minimum(p_offer public.shop_items,p_quantity integer)
returns void language plpgsql stable security definer set search_path=public as $$
begin
  if p_quantity<p_offer.minimum_quantity then
    raise exception 'Buy at least % items for this wholesale price',p_offer.minimum_quantity;
  end if;
end $$;
revoke all on function public._validate_shop_minimum(public.shop_items,integer) from public,anon,authenticated;

create or replace function public.purchase_shop_item(p_shop_item_id uuid,p_quantity integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  w public.wallets%rowtype; offer public.shop_items%rowtype; shop public.shops%rowtype;
  item public.inventory_items%rowtype; owned public.player_inventory%rowtype;
  price bigint; total bigint; cash_after bigint; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Purchase request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='shop_purchase';
  if found then return result; end if;
  if p_quantity is null or p_quantity<1 or p_quantity>99 then raise exception 'Choose a quantity from 1 to 99'; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into offer from public.shop_items where id=p_shop_item_id and is_available for update;
  if not found then raise exception 'This item is no longer available'; end if;
  perform public._validate_shop_minimum(offer,p_quantity);
  select * into shop from public.shops where id=offer.shop_id;
  if not found or not public._economy_shop_is_open(shop,c.game_time_hour) then raise exception 'This shop is closed'; end if;
  if c.current_location_id is distinct from shop.location_id then raise exception 'Travel to this shop before purchasing'; end if;
  select * into item from public.inventory_items where id=offer.item_id;
  if not found then raise exception 'Item not found'; end if;
  price:=coalesce(offer.buy_price,item.buy_price);
  if price is null or price<=0 then raise exception 'This item is not for sale'; end if;
  if not item.stackable and p_quantity<>1 then raise exception 'This item can only be purchased one at a time'; end if;
  if p_quantity>item.max_stack then raise exception 'That quantity exceeds the item stack limit'; end if;
  if offer.stock is not null and offer.stock<p_quantity then raise exception 'Not enough stock'; end if;
  total:=price*p_quantity;
  select * into w from public.wallets where character_id=cid and user_id=uid for update;
  if not found or w.balance<total then raise exception 'Insufficient cash'; end if;
  select * into owned from public.player_inventory where character_id=cid and item_id=item.id for update;
  if found and owned.quantity+p_quantity>item.max_stack then raise exception 'Your inventory stack is full'; end if;
  cash_after:=w.balance-total;
  update public.wallets set balance=cash_after,total_expenses=total_expenses+total where id=w.id;
  insert into public.player_inventory(user_id,character_id,item_id,quantity) values(uid,cid,item.id,p_quantity)
    on conflict(character_id,item_id) do update set quantity=public.player_inventory.quantity+excluded.quantity;
  if offer.stock is not null then update public.shop_items set stock=stock-p_quantity where id=offer.id; end if;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,w.id,cid,total,'expense','purchase','Bought '||item.name||' x'||p_quantity,'purchase','cash',
    shop.name,'inventory',cash_after,jsonb_build_object('shop_id',shop.id,'shop_item_id',offer.id,
    'item_id',item.id,'quantity',p_quantity,'unit_price',price,'request_id',p_request_id,
    'minimum_quantity',offer.minimum_quantity));
  perform public._advance_character_game_time(cid,greatest(2,p_quantity*2));
  result:=jsonb_build_object('item',item.name,'quantity',p_quantity,'unit_price',price,'total',total,
    'cash',cash_after,'minimum_quantity',offer.minimum_quantity);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'shop_purchase',result);
  return result;
end $$;

insert into public.jobs
 (slug,name,description,salary,energy_cost,required_level,cooldown_minutes,xp_reward,stat_bonus,icon,
  sort_order,category,duration_minutes,hunger_cost,thirst_cost,location_id,is_available,income_band,
  requirements,skill_reward_slug,skill_reward_xp,shift_start_hour,shift_end_hour)
select seed.slug,seed.name,seed.description,seed.salary,seed.energy,seed.level,45,18,'career',seed.icon,
 seed.ordering,seed.category,240,7,4,l.id,true,seed.band,seed.requirements::jsonb,seed.skill,24,8,17
from (values
 ('osun_mall_stock_associate','Wholesale Stock Associate','Manage bulk stock and prepare customer orders.',5200,18,1,'package-open',230,'retail','entry','{}','customer_service'),
 ('junior_software_support','Junior Software Support','Help a fictional city office resolve everyday computer issues.',7600,20,3,'laptop',231,'technology','medium','{"skills":{"digital_literacy":1}}','digital_literacy'),
 ('community_health_assistant','Community Health Assistant','Support visitors and records at the fictional community clinic.',7200,22,3,'heart-pulse',232,'healthcare','medium','{"skills":{"healthcare":1}}','healthcare'),
 ('finance_operations_assistant','Finance Operations Assistant','Process fictional account records at a city finance desk.',8200,20,4,'landmark',233,'services','medium','{"skills":{"financial_literacy":2}}','financial_literacy'),
 ('logistics_coordinator','Logistics Coordinator','Coordinate deliveries and routes across the game town.',8800,24,4,'truck',234,'transportation','high','{"skills":{"customer_service":2}}','customer_service'),
 ('public_service_officer','Public Service Officer','Guide visitors through fictional civic services and records.',9000,21,5,'briefcase-business',235,'services','high','{"skills":{"communication":2}}','communication')
) as seed(slug,name,description,salary,energy,level,icon,ordering,category,band,requirements,skill)
left join public.locations l on l.slug=case when seed.slug='osun_mall_stock_associate' then 'osun-mall'
  when seed.slug='community_health_assistant' then 'community-clinic'
  when seed.slug='finance_operations_assistant' then 'cedar-bank'
  when seed.slug='logistics_coordinator' then 'transit-park'
  when seed.slug='public_service_officer' then 'civic-court' else 'town-market' end
on conflict (slug) do update set name=excluded.name,description=excluded.description,salary=excluded.salary,
  category=excluded.category,location_id=excluded.location_id,is_available=true,income_band=excluded.income_band,
  requirements=excluded.requirements,skill_reward_slug=excluded.skill_reward_slug;

notify pgrst,'reload schema';
