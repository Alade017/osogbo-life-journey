-- Display-only plot coordinates for the reusable housing listings. Tenancy and
-- rent state stay in player_properties and property_rent_cycles.
update public.game_properties listing
set metadata = jsonb_set(
  listing.metadata,
  '{mapPlot}',
  jsonb_build_object('x', plot.grid_x, 'z', plot.grid_z, 'model', plot.model_key),
  true
)
from (values
  ('shared-room', 1, 1, 'compound'),
  ('single-room', 3, 2, 'compound'),
  ('studio-flat', 7, 1, 'flat'),
  ('mini-flat', 11, 2, 'flat'),
  ('bungalow', 2, 6, 'compound'),
  ('duplex', 10, 6, 'compound')
) as plot(house_type_id, grid_x, grid_z, model_key)
where listing.slug = 'housing-' || plot.house_type_id
  and listing.house_type_id = plot.house_type_id;

create or replace function public.housing_map_properties(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_character_id uuid; v_result jsonb;
begin
  select id into v_character_id from public.characters where user_id = p_user_id;
  if v_character_id is null then raise exception 'NO_CHARACTER'; end if;
  perform public._advance_property_rent_cycles();

  select coalesce(jsonb_agg(jsonb_build_object(
    'propertyId', listing.id,
    'houseTypeId', house.id,
    'label', house.label,
    'model', listing.metadata #>> '{mapPlot,model}',
    'gridX', (listing.metadata #>> '{mapPlot,x}')::integer,
    'gridZ', (listing.metadata #>> '{mapPlot,z}')::integer,
    'tier', case accessories.band when 'premium' then 3 when 'comfortable' then 2 else 1 end,
    'status', case
      when tenancy.id is null then 'vacant'
      when tenancy.tenure = 'owned' then 'owned'
      when cycle.status in ('rescue') then 'overdue'
      when cycle.status in ('due', 'grace') then 'rent_due'
      when cycle.status = 'current' then 'current'
      else 'vacant'
    end
  ) order by house.sort_order), '[]'::jsonb) into v_result
  from public.game_properties listing
  join public.house_types house on house.id = listing.house_type_id and house.is_active
  left join public.player_properties tenancy on tenancy.property_id = listing.id
    and tenancy.character_id = v_character_id and tenancy.is_active
  left join lateral (
    select rent.status from public.property_rent_cycles rent
    where rent.player_property_id = tenancy.id
      and rent.status in ('current', 'due', 'grace', 'rescue')
    order by rent.due_at desc limit 1
  ) cycle on true
  left join public.player_home_accessory_sets accessories
    on accessories.player_property_id = tenancy.id
  where listing.is_active and listing.slug = 'housing-' || house.id
    and listing.metadata ? 'mapPlot';
  return v_result;
end $$;
revoke all on function public.housing_map_properties(uuid) from public, anon, authenticated;
grant execute on function public.housing_map_properties(uuid) to service_role;
