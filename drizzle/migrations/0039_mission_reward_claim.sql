-- Recalculate mission progress at claim time so a stale status cannot block a
-- reward that is already earned. The row lock and claimed status keep payouts
-- single-claim and atomic with the wallet and XP updates.
create or replace function public.claim_mission(p_player_mission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  pm public.player_missions%rowtype;
  m public.missions%rowtype;
begin
  if uid is null or cid is null then
    raise exception 'Sign in and create a character first';
  end if;

  perform public._recalc_missions(cid);

  select * into pm
  from public.player_missions
  where id = p_player_mission_id
    and user_id = uid
    and character_id = cid
  for update;

  if not found then
    raise exception 'Mission not found';
  end if;
  if pm.status = 'claimed' then
    raise exception 'Mission reward already claimed';
  end if;
  if pm.status <> 'completed' then
    raise exception 'Mission not ready to claim';
  end if;

  select * into m from public.missions where id = pm.mission_id;
  if not found then
    raise exception 'Mission definition not found';
  end if;

  update public.player_missions
  set status = 'claimed', claimed_at = now()
  where id = pm.id;

  if m.reward_money > 0 then
    perform public._credit(cid, m.reward_money, 'mission_reward', 'Mission reward: ' || m.title);
  end if;
  if m.reward_xp > 0 then
    perform public._grant_xp(cid, m.reward_xp);
  end if;

  perform public._recalc_missions(cid);
  return jsonb_build_object('money', m.reward_money, 'xp', m.reward_xp);
end;
$$;

revoke execute on function public.claim_mission(uuid) from public, anon;
grant execute on function public.claim_mission(uuid) to authenticated;
