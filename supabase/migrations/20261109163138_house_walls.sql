-- Room walls. Closed walls are full height all round; open walls are cut away at the front and sides.
-- NULL means the home keeps its default for its type (four-room homes are closed, others are open),
-- so existing homes look exactly as before until the player changes the setting.
alter table public.player_houses add column if not exists walls_closed boolean;

create or replace function public.get_house_walls(p_player_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('walls_closed', (
    select ph.walls_closed from public.player_houses ph
      where ph.player_id = p_player_id and ph.status in ('active','overdue')
      limit 1
  ))
$$;
revoke all on function public.get_house_walls(uuid) from public, anon, authenticated;
grant execute on function public.get_house_walls(uuid) to service_role;

create or replace function public.house_set_walls(p_player_id uuid, p_closed boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  begin
    if p_closed is null then raise exception 'INVALID_REQUEST'; end if;
    update public.player_houses set walls_closed = p_closed
      where player_id = p_player_id and status in ('active','overdue');
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    perform public._audit_house_action(p_player_id, 'house.walls', case when p_closed then 'closed' else 'open' end, 'success');
    return jsonb_build_object('ok', true, 'walls_closed', p_closed);
  exception when others then
    perform public._audit_house_action(p_player_id, 'house.walls', null, 'rejected', sqlerrm);
    return public._house_error(sqlerrm);
  end;
end;
$$;
revoke all on function public.house_set_walls(uuid, boolean) from public, anon, authenticated;
grant execute on function public.house_set_walls(uuid, boolean) to service_role;
notify pgrst, 'reload schema';
