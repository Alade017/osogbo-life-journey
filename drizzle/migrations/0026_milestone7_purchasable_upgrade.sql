-- Milestone 7: add a durable, useful inventory upgrade through existing shop RPCs.
-- The premium flask restores more thirst than the starter water bottle. It uses
-- the existing catalog, purchase idempotency, inventory ownership, and item-use rules.

insert into public.inventory_items (
  slug, name, description, category, icon, value, stackable, max_stack,
  usable, equippable, equipment_slot, effects, buy_price, sell_price, sellable
)
values (
  'insulated_flask',
  'Insulated Flask',
  'A reusable flask that keeps you hydrated through a long day around town.',
  'drinks',
  'glass-water',
  1500,
  true,
  5,
  true,
  false,
  null,
  '{"stat_changes":{"thirst":-70},"time_minutes":1}'::jsonb,
  1500,
  750,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  icon = excluded.icon,
  value = excluded.value,
  stackable = excluded.stackable,
  max_stack = excluded.max_stack,
  usable = excluded.usable,
  equippable = excluded.equippable,
  equipment_slot = excluded.equipment_slot,
  effects = excluded.effects,
  buy_price = excluded.buy_price,
  sell_price = excluded.sell_price,
  sellable = excluded.sellable;

insert into public.shop_items (shop_id, item_id, buy_price, sell_price)
select s.id, i.id, i.buy_price, i.sell_price
from public.shops s
cross join public.inventory_items i
where i.slug = 'insulated_flask'
  and s.category in ('market', 'supermarket', 'food-market')
on conflict (shop_id, item_id) do update set
  buy_price = excluded.buy_price,
  sell_price = excluded.sell_price,
  is_available = true;
