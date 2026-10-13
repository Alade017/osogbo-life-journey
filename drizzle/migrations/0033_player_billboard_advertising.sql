-- Player billboard campaigns are virtual purchases, settled by this RPC only.
create table public.player_advertisements (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  owner_character_id uuid not null references public.characters(id) on delete cascade,
  billboard_id uuid not null references public.game_billboards(id) on delete restrict,
  request_id uuid not null,
  advertiser_name text not null check (length(btrim(advertiser_name)) between 2 and 48),
  title text not null check (length(btrim(title)) between 3 and 72),
  description text not null check (length(btrim(description)) between 3 and 180),
  creative_theme text not null check (creative_theme in ('green','ink','sun','clay')),
  duration_days integer not null check (duration_days in (7,14,30)),
  amount_paid bigint not null check (amount_paid > 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active','expired')),
  created_at timestamptz not null default now(),
  unique(owner_character_id, request_id),
  check (ends_at > starts_at)
);
create index player_advertisements_board_active_idx
  on public.player_advertisements(billboard_id, starts_at desc)
  where status = 'active';
create index player_advertisements_owner_idx
  on public.player_advertisements(owner_character_id, created_at desc);
alter table public.player_advertisements enable row level security;
grant select on public.player_advertisements to authenticated;
grant all on public.player_advertisements to service_role;
create policy "owners and current billboard ads readable" on public.player_advertisements
  for select to authenticated using (
    owner_user_id = auth.uid()
    or (status = 'active' and starts_at <= now() and ends_at > now())
  );

create or replace function public.get_player_advertising_market()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); uid uuid := auth.uid();
begin
  if cid is null or uid is null then raise exception 'Sign in and create a character first'; end if;
  return jsonb_build_object(
    'billboards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',b.id,'name',b.name,'placement',b.placement,'sizeType',b.size_type,
        'location',l.name,'locationId',b.location_id,
        'dailyPrice',case b.size_type when 'small' then 1000 when 'medium' then 2500 else 5000 end
      ) order by l.name,b.name)
      from public.game_billboards b join public.locations l on l.id=b.location_id
      where b.status='active'
    ),'[]'::jsonb),
    'myAds', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'billboardId',a.billboard_id,'billboardName',b.name,
        'advertiserName',a.advertiser_name,'title',a.title,'description',a.description,
        'creativeTheme',a.creative_theme,'durationDays',a.duration_days,
        'amountPaid',a.amount_paid,'startsAt',a.starts_at,'endsAt',a.ends_at,
        'status',case when a.ends_at<=now() then 'expired' else a.status end
      ) order by a.created_at desc)
      from public.player_advertisements a join public.game_billboards b on b.id=a.billboard_id
      where a.owner_character_id=cid and a.owner_user_id=uid
    ),'[]'::jsonb)
  );
end $$;

create or replace function public.purchase_player_advertisement(
  p_billboard_id uuid,p_advertiser_name text,p_title text,p_description text,
  p_creative_theme text,p_duration_days integer,p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id();
  b public.game_billboards%rowtype; w public.wallets%rowtype; cached jsonb;
  safe_advertiser text:=btrim(coalesce(p_advertiser_name,''));
  safe_title text:=btrim(coalesce(p_title,'')); safe_description text:=btrim(coalesce(p_description,''));
  price_per_day integer; total_price bigint; ad public.player_advertisements%rowtype; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Purchase request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('player-ad:'||cid::text||p_request_id::text,0));
  select er.result into cached from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id;
  if found then
    if cached->>'operation' is distinct from 'player_advertisement' then raise exception 'Request ID already used'; end if;
    if cached->>'billboardId' is distinct from p_billboard_id::text
      or cached->>'advertiserName' is distinct from safe_advertiser
      or cached->>'title' is distinct from safe_title
      or cached->>'description' is distinct from safe_description
      or cached->>'creativeTheme' is distinct from p_creative_theme
      or (cached->>'durationDays')::integer is distinct from p_duration_days
    then raise exception 'Request ID belongs to different inputs'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'advertisementId',cached->>'advertisementId',
      'paid',(cached->>'paid')::bigint,'endsAt',cached->>'endsAt');
  end if;
  if length(safe_advertiser) not between 2 and 48 then raise exception 'Advertiser name must be 2 to 48 characters'; end if;
  if length(safe_title) not between 3 and 72 then raise exception 'Ad title must be 3 to 72 characters'; end if;
  if length(safe_description) not between 3 and 180 then raise exception 'Ad description must be 3 to 180 characters'; end if;
  if p_creative_theme not in ('green','ink','sun','clay') then raise exception 'Choose a supported ad theme'; end if;
  if p_duration_days not in (7,14,30) then raise exception 'Choose a 7, 14 or 30 day campaign'; end if;
  select * into b from public.game_billboards where id=p_billboard_id and status='active' for share;
  if not found then raise exception 'Billboard is unavailable'; end if;
  price_per_day:=case b.size_type when 'small' then 1000 when 'medium' then 2500 else 5000 end;
  total_price:=price_per_day*p_duration_days;
  select * into w from public.wallets where character_id=cid and user_id=uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  if w.balance<total_price then raise exception 'Insufficient cash for this campaign'; end if;
  update public.wallets set balance=balance-total_price,total_expenses=total_expenses+total_price
    where id=w.id returning * into w;
  insert into public.player_advertisements(owner_user_id,owner_character_id,billboard_id,request_id,
    advertiser_name,title,description,creative_theme,duration_days,amount_paid,starts_at,ends_at)
  values(uid,cid,b.id,p_request_id,safe_advertiser,safe_title,safe_description,p_creative_theme,
    p_duration_days,total_price,now(),now()+make_interval(days=>p_duration_days)) returning * into ad;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,w.id,cid,total_price,'expense','advertising','Purchased a '||p_duration_days||'-day billboard campaign',
    'purchase','cash','wallet','advertising',w.balance,
    jsonb_build_object('advertisement_id',ad.id,'billboard_id',b.id,'request_id',p_request_id));
  result:=jsonb_build_object('operation','player_advertisement','advertisementId',ad.id,
    'billboardId',b.id,'advertiserName',safe_advertiser,'title',safe_title,'description',safe_description,
    'creativeTheme',p_creative_theme,'durationDays',p_duration_days,'paid',total_price,'endsAt',ad.ends_at);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'player_advertisement',result);
  return jsonb_build_object('ok',true,'duplicate',false,'advertisementId',ad.id,
    'paid',total_price,'endsAt',ad.ends_at,'cash',w.balance);
end $$;

revoke all on function public.get_player_advertising_market() from public,anon;
revoke all on function public.purchase_player_advertisement(uuid,text,text,text,text,integer,uuid) from public,anon;
grant execute on function public.get_player_advertising_market() to authenticated;
grant execute on function public.purchase_player_advertisement(uuid,text,text,text,text,integer,uuid) to authenticated;
