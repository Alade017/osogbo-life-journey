-- Adire recipes consume owned materials at start and grant one snapshotted output on collection.
insert into public.inventory_items(slug,name,description,category,icon,value,stackable,max_stack,usable,equippable,equipment_slot,effects,buy_price,sell_price,sellable) values
('adire_cotton','Plain cotton','Undyed cotton for Adire work.','miscellaneous','package',500,true,99,false,false,null,'{}',500,250,true),
('adire_indigo_dye','Indigo dye','A measured portion of indigo dye.','miscellaneous','package',200,true,99,false,false,null,'{}',200,100,true),
('adire_thread','Cotton thread','Thread for finishing an Adire piece.','miscellaneous','package',100,true,99,false,false,null,'{}',100,50,true),
('adire_indigo_wrapper','Indigo Adire wrapper','A finished indigo-dyed wrapper.','clothing','package',1600,true,20,false,false,null,'{}',3200,1600,true),
('adire_indigo_scarf','Indigo Adire scarf','A finished indigo-dyed scarf.','clothing','package',1000,true,20,false,false,null,'{}',2000,1000,true)
on conflict(slug) do nothing;
insert into public.shops(slug,name,location_id,category,opening_hour,closing_hour,is_open)
select 'adire-materials','Adire Materials & Finished Cloth',id,'craft',8,20,true from public.locations where slug='city-centre'
on conflict(slug) do nothing;
insert into public.shop_items(shop_id,item_id,buy_price,sell_price,stock,is_available)
select s.id,i.id,i.buy_price,i.sell_price,case when i.slug in ('adire_indigo_wrapper','adire_indigo_scarf') then 0 else null end,true
from public.shops s cross join public.inventory_items i
where s.slug='adire-materials' and i.slug in ('adire_cotton','adire_indigo_dye','adire_thread','adire_indigo_wrapper','adire_indigo_scarf')
on conflict(shop_id,item_id) do nothing;

create table public.adire_recipes(
 id text primary key,name text not null,zone_id text not null,station_name text not null,
 location_slug text not null default 'city-centre',duration_seconds integer not null check(duration_seconds between 1 and 86400),
 output_item_id uuid not null references public.inventory_items(id),output_quantity integer not null check(output_quantity>0),is_active boolean not null default true
);
create table public.adire_recipe_materials(
 recipe_id text not null references public.adire_recipes(id) on delete cascade,
 item_id uuid not null references public.inventory_items(id),quantity integer not null check(quantity>0),primary key(recipe_id,item_id)
);
create table public.adire_craft_jobs(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 character_id uuid not null references public.characters(id) on delete cascade,request_id uuid not null,
 recipe_id text not null,name text not null,zone_id text not null,station_name text not null,location_slug text not null,
 quote jsonb not null,output_item_id uuid not null references public.inventory_items(id),output_quantity integer not null check(output_quantity>0),
 started_at timestamptz not null default now(),ready_at timestamptz not null,claimed_at timestamptz,
 unique(user_id,request_id),check(ready_at>=started_at)
);
create unique index adire_one_unclaimed_job on public.adire_craft_jobs(character_id) where claimed_at is null;
create index adire_jobs_owner on public.adire_craft_jobs(user_id,started_at desc);
alter table public.adire_recipes enable row level security;
alter table public.adire_recipe_materials enable row level security;
alter table public.adire_craft_jobs enable row level security;
revoke all on public.adire_recipes,public.adire_recipe_materials,public.adire_craft_jobs from public,anon,authenticated;
grant all on public.adire_recipes,public.adire_recipe_materials,public.adire_craft_jobs to service_role;
grant select on public.adire_craft_jobs to authenticated;
create policy "own Adire jobs" on public.adire_craft_jobs for select to authenticated using(user_id=auth.uid());
insert into public.adire_recipes(id,name,zone_id,station_name,duration_seconds,output_item_id,output_quantity)
select 'adire-wrapper','Dye an Adire wrapper','zone-adire-vats','Indigo dye vats',90,id,1 from public.inventory_items where slug='adire_indigo_wrapper';
insert into public.adire_recipes(id,name,zone_id,station_name,duration_seconds,output_item_id,output_quantity)
select 'adire-scarf','Finish an Adire scarf','zone-adire-racks','Drying and folding racks',60,id,1 from public.inventory_items where slug='adire_indigo_scarf';
insert into public.adire_recipe_materials(recipe_id,item_id,quantity)
select r.id,i.id,case when r.id='adire-wrapper' and i.slug='adire_cotton' then 2 else 1 end
from public.adire_recipes r cross join public.inventory_items i where i.slug in ('adire_cotton','adire_indigo_dye','adire_thread');

create or replace function public._adire_recipe_quote(p_recipe_id text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('duration_seconds',r.duration_seconds,'output_item_id',r.output_item_id,'output_quantity',r.output_quantity,
 'materials',(select coalesce(jsonb_agg(jsonb_build_object('item_id',m.item_id,'quantity',m.quantity) order by m.item_id),'[]'::jsonb) from public.adire_recipe_materials m where m.recipe_id=r.id))
 from public.adire_recipes r where r.id=p_recipe_id
$$;
revoke all on function public._adire_recipe_quote(text) from public,anon,authenticated;

create or replace function public.my_adire_crafting(p_zone_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.characters%rowtype; recipes jsonb;jobs jsonb;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 select * into c from public.characters where id=public._my_character_id() and user_id=auth.uid();
 if not found then raise exception 'NO_CHARACTER';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'station_name',r.station_name,'zone_id',r.zone_id,
 'duration_seconds',r.duration_seconds,'output_name',i.name,'output_quantity',r.output_quantity,'quote',public._adire_recipe_quote(r.id),
 'available',c.inside_home_property_id is null and exists(select 1 from public.locations l where l.id=c.current_location_id and l.slug=r.location_slug and l.is_active),
 'materials',(select coalesce(jsonb_agg(jsonb_build_object('name',mi.name,'quantity',m.quantity,'owned',coalesce(p.quantity,0)) order by m.item_id),'[]'::jsonb)
 from public.adire_recipe_materials m join public.inventory_items mi on mi.id=m.item_id left join public.player_inventory p on p.item_id=m.item_id and p.character_id=c.id and p.user_id=auth.uid() where m.recipe_id=r.id)) order by r.id),'[]'::jsonb)
 into recipes from public.adire_recipes r join public.inventory_items i on i.id=r.output_item_id where r.zone_id=p_zone_id and r.is_active;
 select coalesce(jsonb_agg(to_jsonb(j) order by j.started_at desc),'[]'::jsonb) into jobs from (
 select j.id,j.request_id,j.name,j.zone_id,j.station_name,j.ready_at,j.claimed_at,i.name as output_name,j.output_quantity,j.started_at
 from public.adire_craft_jobs j join public.inventory_items i on i.id=j.output_item_id where j.user_id=auth.uid() and j.character_id=c.id order by j.started_at desc limit 5) j;
 return jsonb_build_object('server_now',clock_timestamp(),'recipes',recipes,'jobs',jobs);
end $$;
revoke all on function public.my_adire_crafting(text) from public,anon;
grant execute on function public.my_adire_crafting(text) to authenticated;

create or replace function public.start_adire_craft(p_recipe_id text,p_request_id uuid,p_quote jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.characters%rowtype;r public.adire_recipes%rowtype;j public.adire_craft_jobs%rowtype;m record;out_item public.inventory_items%rowtype;owned integer;q jsonb;started timestamptz;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 if p_request_id is null then raise exception 'INVALID_REQUEST';end if;
 select * into c from public.characters where id=public._my_character_id() and user_id=auth.uid() for update;
 if not found then raise exception 'NO_CHARACTER';end if;
 select * into j from public.adire_craft_jobs where user_id=auth.uid() and request_id=p_request_id;
 if found then
  if j.character_id<>c.id or j.recipe_id is distinct from p_recipe_id or j.quote is distinct from p_quote then raise exception 'IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('ok',true,'job_id',j.id);
 end if;
 select * into r from public.adire_recipes where id=p_recipe_id and is_active for share;
 if not found then raise exception 'RECIPE_UNAVAILABLE';end if;
 if c.inside_home_property_id is not null or not exists(select 1 from public.locations l where l.id=c.current_location_id and l.slug=r.location_slug and l.is_active) then raise exception 'VISIT_CRAFT_STATION';end if;
 if exists(select 1 from public.adire_craft_jobs where character_id=c.id and claimed_at is null) then raise exception 'CRAFT_IN_PROGRESS';end if;
 perform 1 from public.adire_recipe_materials where recipe_id=r.id order by item_id for share;
 q:=public._adire_recipe_quote(r.id);
 if p_quote is distinct from q or jsonb_array_length(q->'materials')=0 then raise exception 'RECIPE_CHANGED';end if;
 select * into out_item from public.inventory_items where id=r.output_item_id for share;
 select quantity into owned from public.player_inventory where character_id=c.id and user_id=auth.uid() and item_id=r.output_item_id for update;
 if coalesce(owned,0)+r.output_quantity>out_item.max_stack then raise exception 'OUTPUT_STACK_FULL';end if;
 -- Lock all inputs in a stable order before checking and consuming any units.
 perform 1 from public.player_inventory p join public.adire_recipe_materials inputs on inputs.item_id=p.item_id
 where p.character_id=c.id and p.user_id=auth.uid() and inputs.recipe_id=r.id order by p.item_id for update of p;
 for m in select * from public.adire_recipe_materials where recipe_id=r.id order by item_id loop
  select quantity into owned from public.player_inventory where character_id=c.id and user_id=auth.uid() and item_id=m.item_id;
  if coalesce(owned,0)<m.quantity then raise exception 'MISSING_MATERIALS';end if;
 end loop;
 for m in select * from public.adire_recipe_materials where recipe_id=r.id order by item_id loop
  update public.player_inventory set quantity=quantity-m.quantity where character_id=c.id and user_id=auth.uid() and item_id=m.item_id;
  delete from public.player_inventory where character_id=c.id and user_id=auth.uid() and item_id=m.item_id and quantity=0;
 end loop;
 started:=clock_timestamp();
 insert into public.adire_craft_jobs(user_id,character_id,request_id,recipe_id,name,zone_id,station_name,location_slug,quote,output_item_id,output_quantity,started_at,ready_at)
 values(auth.uid(),c.id,p_request_id,r.id,r.name,r.zone_id,r.station_name,r.location_slug,q,r.output_item_id,r.output_quantity,started,started+make_interval(secs=>r.duration_seconds)) returning * into j;
 return jsonb_build_object('ok',true,'job_id',j.id);
end $$;
revoke all on function public.start_adire_craft(text,uuid,jsonb) from public,anon;
grant execute on function public.start_adire_craft(text,uuid,jsonb) to authenticated;

create or replace function public.collect_adire_craft(p_job_id uuid,p_zone_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.characters%rowtype;j public.adire_craft_jobs%rowtype;i public.inventory_items%rowtype;owned integer;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 select * into c from public.characters where id=public._my_character_id() and user_id=auth.uid() for update;
 if not found then raise exception 'NO_CHARACTER';end if;
 select * into j from public.adire_craft_jobs where id=p_job_id and user_id=auth.uid() and character_id=c.id for update;
 if not found then raise exception 'CRAFT_NOT_FOUND';end if;
 if j.claimed_at is not null then return jsonb_build_object('ok',true,'job_id',j.id);end if;
 if p_zone_id is distinct from j.zone_id or c.inside_home_property_id is not null or not exists(select 1 from public.locations l where l.id=c.current_location_id and l.slug=j.location_slug and l.is_active) then raise exception 'VISIT_CRAFT_STATION';end if;
 if clock_timestamp()<j.ready_at then raise exception 'CRAFT_NOT_READY';end if;
 select * into i from public.inventory_items where id=j.output_item_id for share;
 select quantity into owned from public.player_inventory where character_id=c.id and user_id=auth.uid() and item_id=i.id for update;
 if coalesce(owned,0)+j.output_quantity>i.max_stack then raise exception 'OUTPUT_STACK_FULL';end if;
 insert into public.player_inventory(user_id,character_id,item_id,quantity) values(auth.uid(),c.id,i.id,j.output_quantity)
 on conflict(character_id,item_id) do update set quantity=public.player_inventory.quantity+excluded.quantity;
 update public.adire_craft_jobs set claimed_at=clock_timestamp() where id=j.id;
 return jsonb_build_object('ok',true,'job_id',j.id);
end $$;
revoke all on function public.collect_adire_craft(uuid,text) from public,anon;
grant execute on function public.collect_adire_craft(uuid,text) to authenticated;
notify pgrst,'reload schema';
