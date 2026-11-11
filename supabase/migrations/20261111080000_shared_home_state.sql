-- Read-only view of a shared room for its current tenant: the bed zones, the game-placed shared
-- pieces, and which bed is theirs. Returns null when the player has no active shared-room tenancy.
create or replace function public.shared_home_state(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  occ record;
  result jsonb;
begin
  select o.unit_id, o.bed_slot into occ
  from public.shared_home_occupancies o
  join public.characters c on c.id = o.character_id
  where c.user_id = p_player_id and o.ended_at is null
  limit 1;
  if not found then return null; end if;

  select jsonb_build_object(
    'unit_id', occ.unit_id,
    'my_bed_slot', occ.bed_slot,
    'zones', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'bed_slot', z.bed_slot, 'x_min', z.x_min, 'x_max', z.x_max,
        'y_min', z.y_min, 'y_max', z.y_max) order by z.bed_slot), '[]'::jsonb)
      from public.shared_home_bed_zones z where z.unit_id = occ.unit_id
    ),
    'placements', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', sp.id, 'item_id', sp.item_id, 'slot', sp.slot, 'bed_slot', sp.bed_slot,
        'x', sp.x, 'y', sp.y, 'rotation_deg', sp.rotation_deg,
        'art_key', ci.art_key, 'category', ci.category, 'slot_type', ci.slot_type)
        order by sp.slot), '[]'::jsonb)
      from public.shared_home_placements sp
      join public.content_items ci on ci.id = sp.item_id
      where sp.unit_id = occ.unit_id
    )
  ) into result;
  return result;
end $$;

revoke all on function public.shared_home_state(uuid) from public, anon, authenticated;
grant execute on function public.shared_home_state(uuid) to service_role;
