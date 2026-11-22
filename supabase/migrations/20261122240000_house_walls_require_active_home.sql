-- Overdue homes are read-only. Walls now follow the same rule as furniture placement, rotation
-- and rearrangement (status = 'active'), instead of accepting overdue homes that the other writes reject.
create or replace function public.house_set_walls(p_player_id uuid, p_closed boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._process_player_house_status(p_player_id);
  begin
    if p_closed is null then raise exception 'INVALID_REQUEST'; end if;
    update public.player_houses set walls_closed = p_closed
      where player_id = p_player_id and status = 'active';
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
