-- Sell the 10L emergency petrol jerrycan through the existing server-validated shop flow.
insert into public.inventory_items (
  slug,name,description,category,icon,value,stackable,max_stack,usable,equippable,
  equipment_slot,effects,buy_price,sell_price,sellable
) values (
  'fuel_jerrycan_10l',
  '10L Petrol Jerrycan',
  'A sealed yellow 10L petrol container for generator and emergency use.',
  'utility','fuel',3200,true,5,false,false,null,'{}',3200,1600,true
)
on conflict (slug) do update set
  name=excluded.name,
  description=excluded.description,
  category=excluded.category,
  icon=excluded.icon,
  value=excluded.value,
  stackable=excluded.stackable,
  max_stack=excluded.max_stack,
  usable=excluded.usable,
  equippable=excluded.equippable,
  equipment_slot=excluded.equipment_slot,
  effects=excluded.effects,
  buy_price=excluded.buy_price,
  sell_price=excluded.sell_price,
  sellable=excluded.sellable;

insert into public.shops(slug,name,location_id,category,opening_hour,closing_hour,is_open)
select 'fuel-and-go-forecourt','Fuel & Go Forecourt Shop',id,'supermarket',7,22,true
from public.locations where slug='city-centre'
on conflict (slug) do update set
  name=excluded.name,
  location_id=excluded.location_id,
  category=excluded.category,
  opening_hour=excluded.opening_hour,
  closing_hour=excluded.closing_hour,
  is_open=excluded.is_open;

insert into public.shop_items(shop_id,item_id,buy_price,sell_price,stock,is_available)
select s.id,i.id,3200,1600,null,true
from public.shops s
cross join public.inventory_items i
where s.slug='fuel-and-go-forecourt' and i.slug='fuel_jerrycan_10l'
on conflict (shop_id,item_id) do update set
  buy_price=excluded.buy_price,
  sell_price=excluded.sell_price,
  stock=excluded.stock,
  is_available=true;
