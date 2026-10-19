-- Party life, part 2: club pricing, club activities, and hosting from the phone.
-- Clubs charge more for drinks than event centers. Club activities are non-explicit
-- stage shows and games that lift mood. Hosting an event no longer needs the host to
-- be at the venue; the event itself still has to be at an event center.

alter table public.party_drinks add column if not exists club_price bigint check (club_price > 0);
update public.party_drinks set club_price = case slug
  when 'zobo' then 1200
  when 'chapman' then 3500
  when 'star-beer' then 2200
  else price * 3 end
where club_price is null;
alter table public.party_drinks alter column club_price set not null;

create table if not exists public.party_club_activities (
  slug text primary key,
  name text not null,
  kind text not null check (kind in ('game','stage_show')),
  description text not null,
  price bigint not null check (price > 0),
  mood_effect integer not null check (mood_effect between 1 and 20),
  is_active boolean not null default true
);

insert into public.party_club_activities(slug,name,kind,description,price,mood_effect) values
  ('dance-off','Dance-off challenge','game','Take on the club crowd in a friendly dance-off.',1500,12),
  ('pool-table','Pool table','game','A relaxed game of pool with a stranger at the next table.',800,6),
  ('stage-show','Stage show','stage_show','A choreographed show by the club''s performers. Fictional entertainment, not explicit.',4000,15)
on conflict (slug) do update set name=excluded.name,kind=excluded.kind,description=excluded.description,
  price=excluded.price,mood_effect=excluded.mood_effect,is_active=true;

alter table public.party_club_activities enable row level security;
drop policy if exists party_club_activities_read on public.party_club_activities;
create policy party_club_activities_read on public.party_club_activities for select to authenticated using (is_active);

create or replace function public.buy_drink(p_drink_slug text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  d public.party_drinks%rowtype; w public.wallets%rowtype; v public.club_visits%rowtype;
  venue public.party_venues%rowtype; price bigint; cash_after bigint; mood integer; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_buy_drink';
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into venue from public.party_venues where location_id=c.current_location_id and is_active;
  if not found then raise exception 'Drinks are sold at clubs and event centers'; end if;
  if venue.venue_kind='club' then
    v:=public._party_active_visit(cid);
    if v.id is null or v.location_id<>c.current_location_id then raise exception 'Join the club to buy a drink'; end if;
  end if;
  select * into d from public.party_drinks where slug=p_drink_slug and is_active;
  if not found then raise exception 'This drink is not on the menu'; end if;
  price:=case when venue.venue_kind='club' then d.club_price else d.price end;
  select * into w from public.wallets where character_id=cid and user_id=uid for update;
  if not found or w.balance<price then raise exception 'Insufficient cash'; end if;
  cash_after:=w.balance-price;
  update public.wallets set balance=cash_after,total_expenses=total_expenses+price where id=w.id;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,w.id,cid,price,'expense','purchase','Bought '||d.name,'purchase','cash',
    case when venue.venue_kind='club' then 'Club bar' else 'Event centre bar' end,'party',cash_after,
    jsonb_build_object('drink_slug',d.slug,'request_id',p_request_id,'venue_kind',venue.venue_kind));
  insert into public.party_drink_purchases(user_id,character_id,location_id,drink_slug,amount)
    values(uid,cid,c.current_location_id,d.slug,price);
  mood:=public.apply_party_mood(cid,uid,d.mood_effect);
  perform public._advance_character_game_time(cid,20);
  result:=jsonb_build_object('drink',d.name,'price',price,'mood',mood,'cash',cash_after);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_buy_drink',result);
  return result;
end $$;

create or replace function public.join_club_activity(p_activity_slug text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  v public.club_visits%rowtype; a public.party_club_activities%rowtype; w public.wallets%rowtype;
  cash_after bigint; mood integer; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_club_activity';
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  v:=public._party_active_visit(cid);
  if v.id is null or v.location_id<>c.current_location_id then raise exception 'Join the club first'; end if;
  select * into a from public.party_club_activities where slug=p_activity_slug and is_active;
  if not found then raise exception 'This activity is closed tonight'; end if;
  select * into w from public.wallets where character_id=cid and user_id=uid for update;
  if not found or w.balance<a.price then raise exception 'Insufficient cash'; end if;
  cash_after:=w.balance-a.price;
  update public.wallets set balance=cash_after,total_expenses=total_expenses+a.price where id=w.id;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,w.id,cid,a.price,'expense','purchase','Club: '||a.name,'purchase','cash','Club',
    'party',cash_after,jsonb_build_object('activity_slug',a.slug,'request_id',p_request_id));
  mood:=public.apply_party_mood(cid,uid,a.mood_effect);
  perform public._advance_character_game_time(cid,45);
  result:=jsonb_build_object('activity',a.name,'kind',a.kind,'price',a.price,'mood',mood,'cash',cash_after);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_club_activity',result);
  return result;
end $$;

create or replace function public.host_party_event(p_location_id uuid,p_title text,p_starts_at timestamptz,
  p_requirements jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  e public.party_events%rowtype; req jsonb; result jsonb; req_count integer;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_host_event';
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  if not public._party_is_venue(p_location_id,'event_center') then raise exception 'Choose an event center to host at'; end if;
  if char_length(coalesce(p_title,'')) not between 3 and 60 then raise exception 'Give the event a title of 3 to 60 characters'; end if;
  if p_starts_at is null or p_starts_at<=now() or p_starts_at>now()+interval '24 hours' then
    raise exception 'Events must start within the next 24 hours';
  end if;
  if jsonb_typeof(p_requirements)<>'array' then raise exception 'Requirements must be a list'; end if;
  req_count:=jsonb_array_length(p_requirements);
  if req_count<1 or req_count>5 then raise exception 'Add between 1 and 5 requirements'; end if;
  insert into public.party_events(user_id,host_character_id,location_id,title,starts_at,ends_at)
    values(uid,cid,p_location_id,trim(p_title),p_starts_at,p_starts_at+interval '3 hours')
    returning * into e;
  for req in select * from jsonb_array_elements(p_requirements) loop
    if req->>'kind' not in ('drink','guest') then raise exception 'Requirement kind must be drink or guest'; end if;
    if coalesce(req->>'item_or_role','') = '' then raise exception 'Each requirement needs an item or role'; end if;
    if req->>'kind'='drink' and not exists(select 1 from public.party_drinks d where d.slug=req->>'item_or_role' and d.is_active) then
      raise exception 'Unknown drink requirement';
    end if;
    insert into public.party_event_requirements(event_id,kind,item_or_role,quantity)
      values(e.id,req->>'kind',req->>'item_or_role',(req->>'quantity')::integer);
  end loop;
  result:=jsonb_build_object('event_id',e.id,'starts_at',e.starts_at,'ends_at',e.ends_at);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_host_event',result);
  return result;
end $$;

grant execute on function public.join_club_activity(text,uuid) to authenticated;
