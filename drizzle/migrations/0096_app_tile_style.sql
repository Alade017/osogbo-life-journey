-- Phone app tile style, saved on the account so it follows the player to any device.
-- 'rounded' is the square tile with rounded corners (the default); 'circle' is a round tile.
alter table public.profiles
  add column if not exists app_tile_style text not null default 'rounded'
  check (app_tile_style in ('rounded', 'circle'));

create or replace function public.set_my_app_tile_style(p_style text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_style not in ('rounded', 'circle') then
    raise exception 'Tile style must be rounded or circle';
  end if;
  update public.profiles
    set app_tile_style = p_style, updated_at = now()
    where id = uid
    returning jsonb_build_object('app_tile_style', app_tile_style) into result;
  if result is null then raise exception 'Profile not found'; end if;
  return result;
end;
$$;

revoke all on function public.set_my_app_tile_style(text) from public, anon;
grant execute on function public.set_my_app_tile_style(text) to authenticated;
notify pgrst, 'reload schema';
