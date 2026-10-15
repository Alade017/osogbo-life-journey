-- Shared NPC encounters and explicit, server-authoritative cancellation actions.

create table if not exists public.npc_public_encounters (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  npc_id text not null references public.npc_definitions(id) on delete cascade,
  action text not null,
  player_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists npc_public_encounters_area_idx
  on public.npc_public_encounters(location_id, created_at desc);
alter table public.npc_public_encounters enable row level security;
create policy npc_public_encounters_current_area_read on public.npc_public_encounters
  for select to authenticated using (
    exists (select 1 from public.characters c
      where c.user_id=auth.uid() and c.current_location_id=npc_public_encounters.location_id)
  );
revoke insert, update, delete on public.npc_public_encounters from public, anon, authenticated;
grant select on public.npc_public_encounters to authenticated;
grant all on public.npc_public_encounters to service_role;
do $$ begin
  alter publication supabase_realtime add table public.npc_public_encounters;
exception when duplicate_object or undefined_object then null;
end $$;

create or replace function public.publish_npc_encounter(p_npc_id text, p_action text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); loc uuid; player_name text;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_action not in ('greet','work','events','interests','joke','compliment','help','invite','romance','end') then
    raise exception 'Unknown NPC action';
  end if;
  if not exists (select 1 from public.npc_interaction_events e
    where e.user_id=uid and e.character_id=cid and e.npc_id=p_npc_id and e.action=p_action
      and e.accepted and e.created_at>now()-interval '2 minutes') then
    raise exception 'Complete the NPC conversation action first';
  end if;
  select c.current_location_id,c.name into loc,player_name from public.characters c where c.id=cid;
  if loc is null then raise exception 'Travel to the NPC location first'; end if;
  insert into public.npc_public_encounters(player_id,character_id,location_id,npc_id,action,player_name)
    values(uid,cid,loc,p_npc_id,p_action,player_name);
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.cancel_player_house(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare h public.player_houses%rowtype;
begin
  if auth.uid() is null or auth.uid()<>p_user_id then raise exception 'Sign in to cancel your tenancy'; end if;
  perform public._process_player_house_status(p_user_id);
  select * into h from public.player_houses where player_id=p_user_id and status in ('active','overdue')
    order by created_at desc limit 1 for update;
  if not found then raise exception 'There is no active tenancy to cancel'; end if;
  update public.player_houses set status='ended' where id=h.id;
  delete from public.house_placements where player_house_id=h.id;
  delete from public.player_homes where user_id=p_user_id;
  update public.home_items set placed=false,slot_id=null,updated_at=now() where user_id=p_user_id;
  perform public._audit_house_action(p_user_id,'tenancy.cancel',h.id::text,'success',null,null,
    jsonb_build_object('refund_minor',0,'items_returned_to_inventory',true));
  return jsonb_build_object('ok',true,'houseId',h.id,'status','ended','refundMinor',0);
end $$;

alter table public.player_fixed_investments
  add column if not exists cancelled_at timestamptz;

create or replace function public.get_business_and_investment_market()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare cid uuid:=public._my_character_id();
begin
  if cid is null then raise exception 'Create a character first'; end if;
  return jsonb_build_object(
    'businesses',(select coalesce(jsonb_agg(jsonb_build_object('slug',b.slug,'name',b.name,'description',b.description,
      'location',b.location_slug,'price',b.purchase_price,'dailyCustomers',b.daily_customers,'services',b.service_catalog)
      order by b.purchase_price),'[]'::jsonb) from public.business_catalog b where b.active),
    'companies',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',b.name,'description',b.description,
      'location',b.location_slug,'prices',c.service_prices,'owner',ch.name,'sharesForSale',c.shares_for_sale,
      'pricePerShare',greatest(1,floor(b.purchase_price/10000.0)),'isOwner',c.owner_character_id=cid)
      order by c.updated_at desc),'[]'::jsonb) from public.player_companies c
      join public.business_catalog b on b.id=c.business_id join public.characters ch on ch.id=c.owner_character_id),
    'products',(select coalesce(jsonb_agg(jsonb_build_object('slug',p.slug,'name',p.name,'description',p.description,
      'termDays',p.term_days,'yieldBps',p.yield_bps,'minAmount',p.minimum_amount,'maxAmount',p.maximum_amount)
      order by p.term_days),'[]'::jsonb) from public.fixed_investment_products p where p.active),
    'myCompanies',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'slug',b.slug,'name',b.name,
      'location',b.location_slug,'purchasePrice',b.purchase_price,'dailyCustomers',b.daily_customers,
      'services',b.service_catalog,'prices',c.service_prices,'accruedAt',c.accrued_at,'sharesForSale',c.shares_for_sale)
      order by c.updated_at desc),'[]'::jsonb) from public.player_companies c
      join public.business_catalog b on b.id=c.business_id where c.owner_character_id=cid),
    'myCompanyInvestments',(select coalesce(jsonb_agg(jsonb_build_object('companyId',c.id,'name',b.name,'shares',s.shares,
      'location',b.location_slug) order by b.name),'[]'::jsonb) from public.player_company_shares s
      join public.player_companies c on c.id=s.company_id join public.business_catalog b on b.id=c.business_id
      where s.character_id=cid and c.owner_character_id<>cid),
    'myInvestments',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'product',p.name,'principal',i.principal,
      'maturesAt',i.matures_at,'claimedAt',i.claimed_at,'cancelledAt',i.cancelled_at,'yieldBps',i.yield_bps)
      order by i.matures_at),'[]'::jsonb) from public.player_fixed_investments i
      join public.fixed_investment_products p on p.id=i.product_id where i.character_id=cid)
  );
end $$;

create or replace function public.cancel_fixed_term_investment(p_investment_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); i public.player_fixed_investments%rowtype;
  w public.wallets%rowtype; cached jsonb; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Cancellation request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into cached from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id;
  if found then
    if cached->>'operation' is distinct from 'fixed_investment_cancel'
      or cached->>'investmentId' is distinct from p_investment_id::text then
      raise exception 'Request ID already used for another action';
    end if;
    return jsonb_build_object('ok',true,'duplicate',true,'investmentId',p_investment_id,
      'principalReturned',(cached->>'principalReturned')::bigint);
  end if;
  select * into i from public.player_fixed_investments
    where id=p_investment_id and user_id=uid and character_id=cid for update;
  if not found then raise exception 'Investment not found'; end if;
  if i.cancelled_at is not null then raise exception 'Investment is already cancelled'; end if;
  if i.claimed_at is not null then raise exception 'A claimed investment cannot be cancelled'; end if;
  if now()>=i.matures_at then raise exception 'This investment has matured and can be claimed instead'; end if;
  select * into w from public.wallets where character_id=cid and user_id=uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  update public.wallets set balance=balance+i.principal,total_income=total_income+i.principal
    where id=w.id returning * into w;
  update public.player_fixed_investments set cancelled_at=now() where id=i.id;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,w.id,cid,i.principal,'income','investment_cancelled','Returned principal from cancelled fixed-term investment',
    'income','cash','fixed_investment','wallet',w.balance,
    jsonb_build_object('investment_id',i.id,'request_id',p_request_id,'yield_forfeited',true));
  result:=jsonb_build_object('operation','fixed_investment_cancel','investmentId',i.id,'principalReturned',i.principal);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'fixed_investment_cancel',result);
  return jsonb_build_object('ok',true,'duplicate',false,'investmentId',i.id,
    'principalReturned',i.principal,'yieldForfeited',true,'cash',w.balance);
end $$;

create or replace function public.get_nearby_npc_encounters()
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare loc uuid;
begin
  select c.current_location_id into loc from public.characters c where c.user_id=auth.uid();
  if loc is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'npcId',e.npc_id,'action',e.action,
      'playerName',e.player_name,'createdAt',e.created_at) order by e.created_at desc)
    from public.npc_public_encounters e where e.location_id=loc and e.created_at>now()-interval '2 hours'), '[]'::jsonb);
end $$;

revoke all on function public.publish_npc_encounter(text,text) from public,anon;
revoke all on function public.get_nearby_npc_encounters() from public,anon;
revoke all on function public.cancel_player_house(uuid) from public,anon;
revoke all on function public.cancel_fixed_term_investment(uuid,uuid) from public,anon;
grant execute on function public.publish_npc_encounter(text,text) to authenticated;
grant execute on function public.get_nearby_npc_encounters() to authenticated;
grant execute on function public.cancel_player_house(uuid) to authenticated;
grant execute on function public.cancel_fixed_term_investment(uuid,uuid) to authenticated;
