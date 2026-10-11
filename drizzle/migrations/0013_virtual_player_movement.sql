alter table public.characters
  add column virtual_latitude double precision not null default 7.7677,
  add column virtual_longitude double precision not null default 4.556,
  add column movement_state text not null default 'idle';

alter table public.characters
  add constraint characters_virtual_position_bounds_check
    check (virtual_latitude between 7.48 and 8.02 and virtual_longitude between 4.25 and 4.88),
  add constraint characters_movement_state_check
    check (movement_state in ('idle', 'walking'));

comment on column public.characters.virtual_latitude is 'Virtual in-game map position; never sourced from device GPS.';
comment on column public.characters.virtual_longitude is 'Virtual in-game map position; never sourced from device GPS.';

create or replace function public.save_player_map_position(
  p_latitude double precision,
  p_longitude double precision,
  p_movement_state text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id();
begin
  if cid is null then raise exception 'Character not found'; end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between 7.48 and 8.02
    or p_longitude not between 4.25 and 4.88 then
    raise exception 'Position is outside the playable Osogbo area';
  end if;
  if p_movement_state not in ('idle', 'walking') then
    raise exception 'Invalid movement state';
  end if;
  update public.characters
    set virtual_latitude = p_latitude,
        virtual_longitude = p_longitude,
        movement_state = p_movement_state
    where id = cid;
  return jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude, 'movement_state', p_movement_state);
end;
$$;

revoke all on function public.save_player_map_position(double precision, double precision, text) from public, anon;
grant execute on function public.save_player_map_position(double precision, double precision, text) to authenticated;
