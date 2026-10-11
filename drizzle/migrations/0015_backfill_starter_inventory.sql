-- Ensure existing characters receive the same basic items as newly created characters.
-- Keep this additive and idempotent so it is safe to apply after any existing inventory.
insert into public.player_inventory (user_id, character_id, item_id)
select c.user_id, c.id, i.id
from public.characters c
cross join public.inventory_items i
where i.slug in ('phone', 'backpack', 'basic_outfit', 'water_bottle')
on conflict (character_id, item_id) do nothing;
