-- Room light switch. The switch state is stored per home, so it survives a reload.
-- A missing or legacy home reads as lit.
alter table public.player_houses add column if not exists light_on boolean not null default true;

create or replace function public.get_house_light(p_player_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object('light_on', coalesce((
    select ph.light_on from public.player_houses ph
      where ph.player_id = p_player_id and ph.status in ('active','overdue')
      limit 1
  ), true))
$$;
revoke all on function public.get_house_light(uuid) from public, anon, authenticated;
grant execute on function public.get_house_light(uuid) to service_role;

create or replace function public.house_set_light(p_player_id uuid, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  begin
    if p_on is null then raise exception 'INVALID_REQUEST'; end if;
    update public.player_houses set light_on = p_on
      where player_id = p_player_id and status in ('active','overdue');
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    perform public._audit_house_action(p_player_id, 'house.light', case when p_on then 'on' else 'off' end, 'success');
    return jsonb_build_object('ok', true, 'light_on', p_on);
  exception when others then
    perform public._audit_house_action(p_player_id, 'house.light', null, 'rejected', sqlerrm);
    return public._house_error(sqlerrm);
  end;
end;
$$;
revoke all on function public.house_set_light(uuid, boolean) from public, anon, authenticated;
grant execute on function public.house_set_light(uuid, boolean) to service_role;
