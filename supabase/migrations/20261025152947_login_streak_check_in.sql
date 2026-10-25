-- Additive to the canonical game baseline; no historical login backfill.
begin;
create table public.login_streak_settings (
  singleton boolean primary key default true check(singleton),
  reward_xp integer not null default 5 check(reward_xp between 0 and 5)
);
insert into public.login_streak_settings values(true,5);
create table public.login_streak_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_check_in date not null,
  streak integer not null check(streak>=1)
);
create table public.login_streak_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  lagos_date date not null,
  streak integer not null check(streak>=1),
  reward_xp integer not null check(reward_xp between 0 and 5),
  character_id uuid references public.characters(id) on delete set null,
  claimed_at timestamptz not null,
  primary key(user_id,lagos_date)
);
create index login_streak_claims_character_idx on public.login_streak_claims(character_id);
alter table public.login_streak_settings enable row level security;
alter table public.login_streak_state enable row level security;
alter table public.login_streak_claims enable row level security;
revoke all on public.login_streak_settings,public.login_streak_state,public.login_streak_claims from public,anon,authenticated;
grant select on public.login_streak_settings,public.login_streak_state,public.login_streak_claims to authenticated;
grant all on public.login_streak_settings,public.login_streak_state,public.login_streak_claims to service_role;
create policy "Read check-in reward" on public.login_streak_settings for select to authenticated using(true);
create policy "Read own streak" on public.login_streak_state for select to authenticated using(user_id=(select auth.uid()));
create policy "Read own check-ins" on public.login_streak_claims for select to authenticated using(user_id=(select auth.uid()));

create function public.get_login_streak() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); stamp timestamptz; today date;
  state public.login_streak_state%rowtype; receipt public.login_streak_claims%rowtype; xp integer;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and not coalesce(is_anonymous,false)) then
    raise exception 'Sign in with a registered account first';
  end if;
  if public._my_character_id() is null then raise exception 'Create a character first'; end if;
  stamp:=clock_timestamp(); today:=(stamp at time zone 'Africa/Lagos')::date;
  select * into state from public.login_streak_state where user_id=uid;
  select * into receipt from public.login_streak_claims where user_id=uid and lagos_date=today;
  select reward_xp into xp from public.login_streak_settings where singleton;
  return jsonb_build_object('date',today,'serverTime',stamp,
    'resetsAt',(today+1)::timestamp at time zone 'Africa/Lagos',
    'streak',case when receipt.user_id is not null then receipt.streak when state.last_check_in>=today-1 then state.streak else 0 end,
    'todayClaimed',receipt.user_id is not null,'rewardXp',coalesce(receipt.reward_xp,xp));
end $$;

create function public.check_in_login(p_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; stamp timestamptz; today date; count integer; xp integer;
  state public.login_streak_state%rowtype; receipt public.login_streak_claims%rowtype; awarded boolean:=false;
begin
  if uid is null or not exists(select 1 from auth.users where id=uid and not coalesce(is_anonymous,false)) then
    raise exception 'Sign in with a registered account first';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('login-streak:'||uid::text,0));
  cid:=public._my_character_id();
  if cid is null then raise exception 'Create a character first'; end if;
  perform 1 from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  stamp:=clock_timestamp(); today:=(stamp at time zone 'Africa/Lagos')::date;
  if p_date is distinct from today then
    raise exception using message='The check-in day has changed. Refresh and try again.',errcode='PT409';
  end if;
  select * into receipt from public.login_streak_claims where user_id=uid and lagos_date=today;
  if not found then
    select * into state from public.login_streak_state where user_id=uid;
    count:=case when state.last_check_in=today-1 then state.streak+1 else 1 end;
    select reward_xp into xp from public.login_streak_settings where singleton;
    if xp is null then raise exception 'Daily check-in is unavailable'; end if;
    insert into public.login_streak_claims(user_id,lagos_date,streak,reward_xp,character_id,claimed_at)
      values(uid,today,count,xp,cid,stamp) returning * into receipt;
    insert into public.login_streak_state(user_id,last_check_in,streak) values(uid,today,count)
      on conflict(user_id) do update set last_check_in=excluded.last_check_in,streak=excluded.streak;
    perform public._grant_xp(cid,xp);
    perform public._recalc_missions(cid);
    awarded:=true;
  end if;
  return jsonb_build_object('date',receipt.lagos_date,'streak',receipt.streak,
    'rewardXp',receipt.reward_xp,'claimedAt',receipt.claimed_at,'newlyAwarded',awarded);
end $$;
revoke all on function public.get_login_streak(),public.check_in_login(date) from public,anon,authenticated;
grant execute on function public.get_login_streak(),public.check_in_login(date) to authenticated;
notify pgrst,'reload schema';
commit;
