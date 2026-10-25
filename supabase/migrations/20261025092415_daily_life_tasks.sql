-- Requires the existing game schema through Drizzle 0076, especially 0024/0070.
-- This dated migration is applied once after that baseline; do not mirror it in Drizzle.
begin;

create table public.daily_task_catalog (
  task_key text primary key check (task_key in ('meal', 'study', 'social')),
  action_id text not null unique check (action_id in ('eat', 'study', 'socialize')),
  title text not null check (length(title) between 1 and 100),
  reward_xp integer not null default 5 check (reward_xp between 0 and 5),
  sort_order integer not null unique,
  enabled boolean not null default true
);
insert into public.daily_task_catalog(task_key, action_id, title, sort_order) values
  ('meal', 'eat', 'Complete a meal', 1),
  ('study', 'study', 'Complete a study session', 2),
  ('social', 'socialize', 'Complete a social activity', 3);

create table public.daily_task_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lagos_date date not null,
  task_key text not null references public.daily_task_catalog(task_key),
  character_id uuid references public.characters(id) on delete set null,
  reward_xp integer not null check (reward_xp between 0 and 5),
  claimed_at timestamptz not null default clock_timestamp(),
  primary key (user_id, lagos_date, task_key)
);
create index daily_task_claims_character_idx on public.daily_task_claims(character_id);
create index simulation_receipts_daily_idx
  on public.simulation_action_receipts(character_id, action_id, completed_at);

alter table public.daily_task_catalog enable row level security;
alter table public.daily_task_claims enable row level security;
revoke all on public.daily_task_catalog, public.daily_task_claims from public, anon, authenticated;
grant select on public.daily_task_catalog, public.daily_task_claims to authenticated;
grant all on public.daily_task_catalog, public.daily_task_claims to service_role;
create policy "Read enabled daily tasks" on public.daily_task_catalog
  for select to authenticated using (enabled);
create policy "Read own daily claims" on public.daily_task_claims
  for select to authenticated using (user_id = (select auth.uid()));

-- now() is the transaction start, which can precede a wait across midnight.
-- Always stamp actual receipt insertion, including future command implementations.
create function public.stamp_simulation_receipt_completion() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.completed_at := clock_timestamp();
  return new;
end $$;
revoke all on function public.stamp_simulation_receipt_completion() from public, anon, authenticated;
create trigger stamp_simulation_receipt_completion
  before insert on public.simulation_action_receipts
  for each row execute function public.stamp_simulation_receipt_completion();

create function public.get_daily_tasks() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  stamp timestamptz;
  today date;
  starts timestamptz;
  resets timestamptz;
  tasks jsonb;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id = uid and not coalesce(u.is_anonymous, false)) then
    raise exception 'Sign in with a registered account first';
  end if;
  cid := public._my_character_id();
  if cid is null then raise exception 'Create a character first'; end if;
  stamp := clock_timestamp();
  today := (stamp at time zone 'Africa/Lagos')::date;
  starts := today::timestamp at time zone 'Africa/Lagos';
  resets := (today + 1)::timestamp at time zone 'Africa/Lagos';
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', t.task_key, 'title', t.title, 'action', t.action_id,
    'rewardXp', coalesce(c.reward_xp, t.reward_xp),
    'claimed', c.user_id is not null,
    'completed', c.user_id is not null or exists(
      select 1 from public.simulation_action_receipts r
      where r.character_id = cid and r.action_id = t.action_id
        and r.completed_at >= starts and r.completed_at < resets
        and r.completed_at <= stamp)
  ) order by t.sort_order), '[]'::jsonb) into tasks
  from public.daily_task_catalog t left join public.daily_task_claims c
    on c.task_key = t.task_key and c.user_id = uid and c.lagos_date = today
  where t.enabled;
  return jsonb_build_object('date', today, 'serverTime', stamp, 'resetsAt', resets, 'tasks', tasks);
end $$;

create function public.claim_daily_task(p_task_key text, p_date date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  stamp timestamptz;
  today date;
  task public.daily_task_catalog%rowtype;
  receipt public.daily_task_claims%rowtype;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id = uid and not coalesce(u.is_anonymous, false)) then
    raise exception 'Sign in with a registered account first';
  end if;
  -- Serialize per account as claims outlive character deletion/recreation.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('daily-tasks:' || uid::text, 0));
  cid := public._my_character_id();
  if cid is null then raise exception 'Create a character first'; end if;
  perform 1 from public.characters where id = cid and user_id = uid for update;
  if not found then raise exception 'Character not found'; end if;
  stamp := clock_timestamp();
  today := (stamp at time zone 'Africa/Lagos')::date;
  if p_date is distinct from today then
    raise exception using message = 'Daily tasks have reset. Refresh and try again.', errcode = 'PT409';
  end if;
  select * into receipt from public.daily_task_claims
    where user_id = uid and lagos_date = today and task_key = p_task_key;
  if not found then
    select * into task from public.daily_task_catalog where task_key = p_task_key and enabled;
    if not found then raise exception 'Daily task not found'; end if;
    if not exists(select 1 from public.simulation_action_receipts r
      where r.character_id = cid and r.action_id = task.action_id
        and r.completed_at >= (today::timestamp at time zone 'Africa/Lagos')
        and r.completed_at < ((today + 1)::timestamp at time zone 'Africa/Lagos')
        and r.completed_at <= stamp) then
      raise exception 'Complete this activity today before claiming';
    end if;
    insert into public.daily_task_claims(user_id, lagos_date, task_key, character_id, reward_xp, claimed_at)
      values(uid, today, task.task_key, cid, task.reward_xp, stamp) returning * into receipt;
    perform public._grant_xp(cid, receipt.reward_xp);
    perform public._recalc_missions(cid);
  end if;
  return jsonb_build_object('key', receipt.task_key, 'date', receipt.lagos_date,
    'rewardXp', receipt.reward_xp, 'claimed', true, 'claimedAt', receipt.claimed_at);
end $$;
revoke all on function public.get_daily_tasks(), public.claim_daily_task(text,date) from public, anon, authenticated;
grant execute on function public.get_daily_tasks(), public.claim_daily_task(text,date) to authenticated;
notify pgrst, 'reload schema';
commit;
