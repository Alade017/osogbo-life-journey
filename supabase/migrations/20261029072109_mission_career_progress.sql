-- Extend existing character-lifetime goals; preserve catalog and reward values.
create or replace function public._recalc_missions(p_char uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v bigint;
begin
  for r in select pm.id, m.slug, m.target, m.title from public.player_missions pm
           join public.missions m on m.id = pm.mission_id
           where pm.character_id = p_char and pm.status = 'in_progress' order by pm.id for update of pm loop
    v := case r.slug
      when 'first_job' then (select count(*) from public.character_jobs where character_id = p_char)
      when 'earn_10000' then (select coalesce(sum(amount),0) from public.transactions where character_id = p_char and category in ('job','career_shift') and kind = 'income' and amount > 0)
      when 'visit_3_locations' then (select count(*) from public.location_visits where character_id = p_char)
      when 'complete_3_jobs' then (select coalesce(sum(times_performed),0) from public.character_jobs where character_id = p_char)
      when 'reach_level_2' then (select level from public.characters where id = p_char)
      when 'visit_oja_oba' then (select count(*) from public.location_visits lv join public.locations l on l.id = lv.location_id where lv.character_id = p_char and l.slug = 'oja-oba')
      when 'visit_elegance_tech_hub' then (select count(*) from public.location_visits lv join public.locations l on l.id = lv.location_id where lv.character_id = p_char and l.slug = 'student-district')
      when 'complete_first_training' then (select count(*) from public.player_courses where character_id = p_char)
      else 0 end;
    update public.player_missions
      set progress = least(v, r.target),
          status = case when v >= r.target then 'completed' else status end,
          completed_at = case when v >= r.target then now() else completed_at end
      where id = r.id;
    if v >= r.target then
      perform public._notify(p_char, 'Mission complete: ' || r.title, 'Open Missions to claim your reward.', 'mission');
    end if;
  end loop;
end $$;


revoke all on function public._recalc_missions(uuid) from public, anon, authenticated;

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

  -- Match career claim ordering: character, mission rows, then wallet.
  perform 1 from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Sign in and create a character first'; end if;
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

-- Reconcile only unfinished earnings goals. No reward or notification is paid by migration.
with earned as (
  select character_id, sum(amount) as amount from public.transactions
  where category in ('job','career_shift') and kind='income' and amount>0 group by character_id
)
update public.player_missions pm set progress=least(e.amount,m.target)::integer,
  status=case when e.amount>=m.target then 'completed' else pm.status end,
  completed_at=case when e.amount>=m.target then now() else pm.completed_at end
from public.missions m, earned e
where pm.mission_id=m.id and m.slug='earn_10000' and pm.character_id=e.character_id and pm.status='in_progress';
