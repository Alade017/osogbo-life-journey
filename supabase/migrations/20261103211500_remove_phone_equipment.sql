-- The phone is a built-in game feature, not wearable equipment.
with removed as (
  delete from public.player_equipment pe
  using public.inventory_items ii
  where pe.item_id = ii.id and ii.slug = 'phone'
  returning pe.user_id, pe.character_id, pe.item_id
)
insert into public.player_inventory (user_id, character_id, item_id)
select user_id, character_id, item_id from removed;

update public.inventory_items
set equippable = false, equipment_slot = null
where slug = 'phone';