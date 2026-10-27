-- Requires existing game/wallet helpers and 0060_phone_community_apps.sql.
begin;
create table public.stall_income_policy (
  version integer primary key check(version=1),
  activated_at timestamptz not null default clock_timestamp(),
  seconds_per_naira integer not null default 360 check(seconds_per_naira=360),
  daily_cap integer not null default 100 check(daily_cap=100),
  retained_dates integer not null default 7 check(retained_dates=7)
);
insert into public.stall_income_policy(version) values(1);
create table public.stall_income_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  policy_version integer not null default 1 references public.stall_income_policy(version),
  -- Deliberately no character/stall FK: recreation must not erase account caps.
  stall_id uuid,
  is_open boolean not null default false,
  settled_at timestamptz not null,
  check(stall_id is not null or not is_open)
);
create table public.stall_income_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  earning_date date not null,
  policy_version integer not null default 1 references public.stall_income_policy(version),
  open_microseconds bigint not null check(open_microseconds between 0 and 36000000000),
  paid integer not null default 0 check(paid between 0 and 100),
  primary key(user_id,earning_date),
  check(paid::bigint*360000000<=open_microseconds)
);
create table public.stall_income_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  character_id uuid references public.characters(id) on delete set null,
  transaction_id uuid references public.transactions(id) on delete set null,
  claimed_at timestamptz not null,
  result jsonb not null,
  primary key(user_id,request_id)
);
create index stall_income_receipt_history on public.stall_income_receipts(user_id,claimed_at desc,request_id desc);
create index stall_income_receipt_character on public.stall_income_receipts(character_id);
create index stall_income_receipt_transaction on public.stall_income_receipts(transaction_id);
alter table public.stall_income_policy enable row level security;
alter table public.stall_income_state enable row level security;
alter table public.stall_income_days enable row level security;
alter table public.stall_income_receipts enable row level security;
revoke all on public.stall_income_policy,public.stall_income_state,public.stall_income_days,public.stall_income_receipts from public,anon,authenticated;
grant select on public.stall_income_state,public.stall_income_days,public.stall_income_receipts to authenticated;
grant all on public.stall_income_policy,public.stall_income_state,public.stall_income_days,public.stall_income_receipts to service_role;
create policy stall_state_owner on public.stall_income_state for select to authenticated using(user_id=(select auth.uid()));
create policy stall_days_owner on public.stall_income_days for select to authenticated using(user_id=(select auth.uid()));
create policy stall_receipts_owner on public.stall_income_receipts for select to authenticated using(user_id=(select auth.uid()));

-- Pure bounded preview. Microseconds are accumulated before whole-Naira rounding.
create function public._stall_income_preview(p_user uuid,p_stamp timestamptz)
returns table(earning_date date,open_microseconds bigint,paid integer)
language plpgsql stable security definer set search_path='' as $$
declare s public.stall_income_state%rowtype; policy public.stall_income_policy%rowtype;
  stamp timestamptz; target_day date; day_start timestamptz; day_end timestamptz; extra bigint; n integer; can_earn boolean;
begin
  select * into policy from public.stall_income_policy where version=1;
  if not found then raise exception 'STALL_POLICY_UNAVAILABLE'; end if;
  select * into s from public.stall_income_state where user_id=p_user;
  stamp:=greatest(p_stamp,s.settled_at,policy.activated_at);
  can_earn:=coalesce(s.is_open,false) and exists(select 1 from public.player_stalls t
    join public.characters c on c.id=t.character_id and c.user_id=p_user
    where t.id=s.stall_id and t.user_id=p_user and t.is_open);
  for n in 0..6 loop
    earning_date:=(stamp at time zone 'Africa/Lagos')::date-n;
    target_day:=earning_date;
    day_start:=earning_date::timestamp at time zone 'Africa/Lagos';
    day_end:=(earning_date+1)::timestamp at time zone 'Africa/Lagos';
    select d.open_microseconds,d.paid into open_microseconds,paid from public.stall_income_days d
      where d.user_id=p_user and d.earning_date=target_day;
    open_microseconds:=coalesce(open_microseconds,0); paid:=coalesce(paid,0); extra:=0;
    if can_earn then
      extra:=(greatest(0,extract(epoch from (least(stamp,day_end)-greatest(s.settled_at,day_start,policy.activated_at))))*1000000)::bigint;
    end if;
    open_microseconds:=least(policy.daily_cap::bigint*policy.seconds_per_naira*1000000,open_microseconds+extra);
    return next;
  end loop;
end $$;
revoke all on function public._stall_income_preview(uuid,timestamptz) from public,anon,authenticated;

-- Caller holds character -> account -> state -> stall locks.
create function public._settle_stall_income(p_user uuid,p_stamp timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare r record;
begin
  for r in select * from public._stall_income_preview(p_user,p_stamp) order by earning_date loop
    if r.open_microseconds>0 then
      insert into public.stall_income_days(user_id,earning_date,open_microseconds,paid)
        values(p_user,r.earning_date,r.open_microseconds,r.paid)
        on conflict(user_id,earning_date) do update set open_microseconds=greatest(stall_income_days.open_microseconds,excluded.open_microseconds);
    end if;
  end loop;
  update public.stall_income_state set settled_at=greatest(settled_at,p_stamp) where user_id=p_user;
end $$;
revoke all on function public._settle_stall_income(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.save_player_stall(p_name text,p_goods text,p_is_open boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; stamp timestamptz; tid uuid; activation timestamptz;
  clean_name text:=btrim(coalesce(p_name,'')); clean_goods text:=btrim(coalesce(p_goods,''));
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if length(clean_name) not between 2 and 64 or length(clean_goods) not between 2 and 200 then raise exception 'Use a stall name of 2 to 64 characters and goods of 2 to 200 characters'; end if;
  select id into cid from public.characters where user_id=uid for update;
  if not found then raise exception 'Create a character first'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stall-income:'||uid::text,0));
  select activated_at into activation from public.stall_income_policy where version=1;
  if not found then raise exception 'STALL_POLICY_UNAVAILABLE'; end if;
  stamp:=greatest(clock_timestamp(),activation);
  insert into public.stall_income_state(user_id,settled_at) values(uid,stamp) on conflict(user_id) do nothing;
  perform 1 from public.stall_income_state where user_id=uid for update;
  perform 1 from public.player_stalls where user_id=uid for update;
  stamp:=greatest(clock_timestamp(),activation,(select settled_at from public.stall_income_state where user_id=uid));
  perform public._settle_stall_income(uid,stamp);
  insert into public.player_stalls(user_id,character_id,name,goods,is_open)
    values(uid,cid,clean_name,clean_goods,coalesce(p_is_open,false))
    on conflict(user_id) do update set character_id=excluded.character_id,name=excluded.name,goods=excluded.goods,is_open=excluded.is_open,updated_at=stamp returning id into tid;
  update public.stall_income_state set stall_id=tid,is_open=coalesce(p_is_open,false),settled_at=stamp where user_id=uid;
  return jsonb_build_object('ok',true,'isOpen',coalesce(p_is_open,false));
end $$;
revoke all on function public.save_player_stall(text,text,boolean) from public,anon;
grant execute on function public.save_player_stall(text,text,boolean) to authenticated;

create function public.get_stall_income() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); stamp timestamptz:=statement_timestamp(); s public.stall_income_state%rowtype;
  t public.player_stalls%rowtype; total bigint; today_earned bigint; today_paid bigint; recent jsonb; as_of timestamptz;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  select * into s from public.stall_income_state where user_id=uid;
  select * into t from public.player_stalls where user_id=uid;
  as_of:=greatest(stamp,s.settled_at,(select activated_at from public.stall_income_policy where version=1));
  select coalesce(sum(p.open_microseconds/360000000-p.paid),0),
    coalesce(max(p.open_microseconds/360000000) filter(where p.earning_date=(as_of at time zone 'Africa/Lagos')::date),0),
    coalesce(max(p.paid) filter(where p.earning_date=(as_of at time zone 'Africa/Lagos')::date),0)
    into total,today_earned,today_paid from public._stall_income_preview(uid,stamp) p;
  select r.result into recent from public.stall_income_receipts r where r.user_id=uid order by r.claimed_at desc,r.request_id desc limit 1;
  return jsonb_build_object('serverTime',stamp,'asOf',as_of,'date',(as_of at time zone 'Africa/Lagos')::date,
    'ratePerHour',10,'dailyCap',100,'retainedDates',7,'policyVersion',1,
    'hasStall',t.id is not null,'enrolled',coalesce(s.stall_id=t.id,false),
    'isOpen',coalesce(s.stall_id=t.id and s.is_open and t.is_open,false),
    'claimable',total,'todayEarned',today_earned,'todayPaid',today_paid,'lastReceipt',recent);
end $$;
revoke all on function public.get_stall_income() from public,anon;
grant execute on function public.get_stall_income() to authenticated;

create function public.claim_stall_income(p_request_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; stamp timestamptz; amount bigint; result jsonb; tx uuid; cash bigint; activation timestamptz;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  select r.result into result from public.stall_income_receipts r where r.user_id=uid and r.request_id=p_request_id;
  if found then return result||jsonb_build_object('duplicate',true); end if;
  select id into cid from public.characters where user_id=uid for update;
  if not found then raise exception 'Create a character first'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stall-income:'||uid::text,0));
  select r.result into result from public.stall_income_receipts r where r.user_id=uid and r.request_id=p_request_id;
  if found then return result||jsonb_build_object('duplicate',true); end if;
  select activated_at into activation from public.stall_income_policy where version=1;
  if not found then raise exception 'STALL_POLICY_UNAVAILABLE'; end if;
  stamp:=greatest(clock_timestamp(),activation);
  insert into public.stall_income_state(user_id,settled_at) values(uid,stamp) on conflict(user_id) do nothing;
  perform 1 from public.stall_income_state where user_id=uid for update;
  perform 1 from public.player_stalls where user_id=uid for update;
  stamp:=greatest(clock_timestamp(),activation,(select settled_at from public.stall_income_state where user_id=uid));
  perform public._settle_stall_income(uid,stamp);
  select coalesce(sum(p.open_microseconds/360000000-p.paid),0) into amount from public._stall_income_preview(uid,stamp) p;
  if amount>0 then
    perform public._credit(cid,amount,'stall_income','Stall income '||p_request_id::text);
    select id into tx from public.transactions where character_id=cid and category='stall_income' and description='Stall income '||p_request_id::text order by created_at desc limit 1;
    if tx is null then raise exception 'STALL_PAYMENT_NOT_RECORDED'; end if;
    update public.stall_income_days d set paid=(d.open_microseconds/360000000)::integer
      where d.user_id=uid and d.earning_date between (stamp at time zone 'Africa/Lagos')::date-6 and (stamp at time zone 'Africa/Lagos')::date;
  end if;
  select balance into cash from public.wallets where character_id=cid and user_id=uid;
  if not found then raise exception 'WALLET_UNAVAILABLE'; end if;
  result:=jsonb_build_object('requestId',p_request_id,'amount',amount,'cash',cash,'transactionId',tx,'claimedAt',stamp,'policyVersion',1);
  insert into public.stall_income_receipts(user_id,request_id,character_id,transaction_id,claimed_at,result) values(uid,p_request_id,cid,tx,stamp,result);
  return result||jsonb_build_object('duplicate',false);
end $$;
revoke all on function public.claim_stall_income(uuid) from public,anon;
grant execute on function public.claim_stall_income(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
