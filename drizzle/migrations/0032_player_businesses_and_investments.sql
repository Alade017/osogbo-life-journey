-- Simulated business ownership and investments. All balance changes are RPC-only
-- and are recorded in the existing wallet transaction ledger.

create table public.business_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  location_slug text not null,
  purchase_price bigint not null check (purchase_price between 500000 and 10000000),
  daily_customers integer not null check (daily_customers between 1 and 10000),
  service_catalog jsonb not null check (jsonb_typeof(service_catalog) = 'array'),
  active boolean not null default true
);
grant all on public.business_catalog to service_role;
alter table public.business_catalog enable row level security;

create table public.player_companies (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.business_catalog(id),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  owner_character_id uuid not null references public.characters(id) on delete cascade,
  service_prices jsonb not null default '{}'::jsonb,
  accrued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_character_id, business_id),
  check (jsonb_typeof(service_prices) = 'object')
);
create index player_companies_owner_idx on public.player_companies(owner_character_id, updated_at desc);
alter table public.player_companies add column shares_for_sale integer not null default 0
  check (shares_for_sale between 0 and 3000);
create trigger t_player_companies before update on public.player_companies
  for each row execute function public.touch_updated_at();
grant all on public.player_companies to service_role;
alter table public.player_companies enable row level security;
create policy "company owners can read their companies" on public.player_companies
  for select to authenticated using (owner_user_id = auth.uid());

create table public.player_company_shares (
  company_id uuid not null references public.player_companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  shares integer not null check (shares between 1 and 10000),
  created_at timestamptz not null default now(),
  primary key(company_id, character_id)
);
create index player_company_shares_character_idx on public.player_company_shares(character_id);
grant select on public.player_company_shares to authenticated;
grant all on public.player_company_shares to service_role;
alter table public.player_company_shares enable row level security;
create policy "own company shares readable" on public.player_company_shares
  for select to authenticated using (user_id = auth.uid());

create table public.fixed_investment_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  term_days integer not null check (term_days between 1 and 365),
  yield_bps integer not null check (yield_bps between 1 and 5000),
  minimum_amount bigint not null check (minimum_amount > 0),
  maximum_amount bigint not null check (maximum_amount >= minimum_amount),
  active boolean not null default true
);
grant all on public.fixed_investment_products to service_role;
alter table public.fixed_investment_products enable row level security;

create table public.player_fixed_investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  product_id uuid not null references public.fixed_investment_products(id),
  principal bigint not null check (principal > 0),
  yield_bps integer not null check (yield_bps between 1 and 5000),
  term_days integer not null check (term_days between 1 and 365),
  opened_at timestamptz not null default now(),
  matures_at timestamptz not null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  check (matures_at > opened_at)
);
create index player_fixed_investments_owner_idx on public.player_fixed_investments(character_id, matures_at);
grant select on public.player_fixed_investments to authenticated;
grant all on public.player_fixed_investments to service_role;
alter table public.player_fixed_investments enable row level security;
create policy "own fixed investments readable" on public.player_fixed_investments
  for select to authenticated using (user_id = auth.uid());

insert into public.business_catalog(slug,name,description,location_slug,purchase_price,daily_customers,service_catalog)
values
  ('oke-fia-digital-studio','Oke-Fia Digital Studio','A small creative and web-services company.','oke-fia',500000,28,
   '[{"id":"web-design","name":"Website design","defaultPrice":18000,"minPrice":8000,"maxPrice":60000,"visitorsPerDay":8},{"id":"graphics","name":"Graphic design","defaultPrice":6500,"minPrice":2500,"maxPrice":22000,"visitorsPerDay":20}]'::jsonb),
  ('oja-oba-grocery','Oja-Oba Grocery','A neighborhood grocery and provisions business.','oja-oba',1800000,150,
   '[{"id":"food-basket","name":"Food basket","defaultPrice":5500,"minPrice":2500,"maxPrice":14000,"visitorsPerDay":65},{"id":"provisions","name":"Household provisions","defaultPrice":3200,"minPrice":1200,"maxPrice":9000,"visitorsPerDay":85}]'::jsonb),
  ('isale-osun-courier','Isale-Osun Courier Service','Local parcel delivery across the city.','isale-osun',4500000,260,
   '[{"id":"local-delivery","name":"Local delivery","defaultPrice":2200,"minPrice":900,"maxPrice":6500,"visitorsPerDay":160},{"id":"express-delivery","name":"Express delivery","defaultPrice":4800,"minPrice":1800,"maxPrice":14000,"visitorsPerDay":100}]'::jsonb),
  ('city-centre-trading','City Centre Trading House','A larger trading and wholesale company.','city-centre',10000000,800,
   '[{"id":"wholesale-order","name":"Wholesale order","defaultPrice":16000,"minPrice":7000,"maxPrice":42000,"visitorsPerDay":180},{"id":"retail-order","name":"Retail order","defaultPrice":4200,"minPrice":1600,"maxPrice":12000,"visitorsPerDay":620}]'::jsonb)
on conflict (slug) do nothing;

insert into public.fixed_investment_products(slug,name,description,term_days,yield_bps,minimum_amount,maximum_amount)
values
  ('susu-7-day','7-day Susu','A short, fixed-term in-game savings product.',7,200,10000,1000000),
  ('susu-14-day','14-day Susu','A medium-term in-game savings product.',14,500,10000,2500000),
  ('susu-30-day','30-day Susu','A longer, fixed-term in-game savings product.',30,1200,10000,5000000)
on conflict (slug) do nothing;

create or replace function public._settle_player_company_earnings(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid:=public._my_character_id(); c public.player_companies%rowtype; b public.business_catalog%rowtype;
  hours numeric; gross numeric; payout bigint; owner_payout bigint; dividend bigint; h record;
  w public.wallets%rowtype; holder_wallet public.wallets%rowtype; result jsonb;
begin
  select * into c from public.player_companies where id=p_company_id for update;
  if not found then raise exception 'Company not found'; end if;
  cid:=c.owner_character_id;
  perform 1 from public.wallets where character_id in (select character_id from public.player_company_shares where company_id=c.id) order by id for update;
  select * into b from public.business_catalog where id=c.business_id;
  hours:=least(168,greatest(0,extract(epoch from (now()-c.accrued_at))/3600));
  select sum((s->>'visitorsPerDay')::numeric * (c.service_prices->>(s->>'id'))::numeric / 24)
    into gross from jsonb_array_elements(b.service_catalog) s;
  -- Catalog footfall is virtual and price changes affect server-calculated turnover.
  payout:=floor(greatest(0,gross*hours*(1.0-(select count(*) from jsonb_array_elements(b.service_catalog))*0.15)))::bigint;
  if payout<1 then
    update public.player_companies set accrued_at=now() where id=c.id;
    return jsonb_build_object('ok',true,'companyId',c.id,'earned',0);
  end if;
  owner_payout:=payout;
  for h in select * from public.player_company_shares where company_id=c.id and character_id<>cid order by character_id for update loop
    dividend:=floor(payout*h.shares/10000.0)::bigint;
    if dividend>0 then
      select * into holder_wallet from public.wallets where character_id=h.character_id and user_id=h.user_id for update;
      if not found then raise exception 'Investor wallet not found'; end if;
      update public.wallets set balance=balance+dividend,total_income=total_income+dividend where id=holder_wallet.id returning * into holder_wallet;
      insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,transaction_type,
        account,source,destination,balance_after,metadata)
      values(h.user_id,holder_wallet.id,h.character_id,dividend,'income','company_dividend','Share of earnings from '||b.name,
        'income','cash','company','wallet',holder_wallet.balance,jsonb_build_object('company_id',c.id,'shares',h.shares));
      owner_payout:=owner_payout-dividend;
    end if;
  end loop;
  select * into w from public.wallets where character_id=cid and user_id=c.owner_user_id for update;
  if not found then raise exception 'Wallet not found'; end if;
  update public.wallets set balance=balance+owner_payout,total_income=total_income+owner_payout where id=w.id returning * into w;
  update public.player_companies set accrued_at=now() where id=c.id;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(c.owner_user_id,w.id,cid,owner_payout,'income','company_income','Earnings from '||b.name,
    'income','cash','business','wallet',w.balance,jsonb_build_object('company_id',c.id,'hours',hours));
  result:=jsonb_build_object('ok',true,'companyId',c.id,'earned',owner_payout,'totalEarnings',payout,'cash',w.balance);
  return result;
end $$;

revoke all on function public._settle_player_company_earnings(uuid) from public,anon,authenticated;

create or replace function public.get_business_and_investment_market()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare cid uuid := public._my_character_id();
begin
  if cid is null then raise exception 'Create a character first'; end if;
  return jsonb_build_object(
    'businesses',(select coalesce(jsonb_agg(jsonb_build_object('slug',b.slug,'name',b.name,'description',b.description,
      'location',b.location_slug,'price',b.purchase_price,'dailyCustomers',b.daily_customers,'services',b.service_catalog)
      order by b.purchase_price), '[]'::jsonb) from public.business_catalog b where b.active),
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
      order by c.updated_at desc),'[]'::jsonb) from public.player_companies c join public.business_catalog b on b.id=c.business_id
      where c.owner_character_id=cid),
    'myCompanyInvestments',(select coalesce(jsonb_agg(jsonb_build_object('companyId',c.id,'name',b.name,'shares',s.shares,
      'location',b.location_slug) order by b.name),'[]'::jsonb) from public.player_company_shares s
      join public.player_companies c on c.id=s.company_id join public.business_catalog b on b.id=c.business_id
      where s.character_id=cid and c.owner_character_id<>cid),
    'myInvestments',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'product',p.name,'principal',i.principal,
      'maturesAt',i.matures_at,'claimedAt',i.claimed_at,'yieldBps',i.yield_bps)
      order by i.matures_at),'[]'::jsonb) from public.player_fixed_investments i
      join public.fixed_investment_products p on p.id=i.product_id where i.character_id=cid)
  );
end $$;

create or replace function public.buy_player_company(p_business_slug text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); b public.business_catalog%rowtype;
  w public.wallets%rowtype; company public.player_companies%rowtype; cached jsonb; initial_prices jsonb; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('osogbo-company-economy',0));
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Purchase request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into cached from public.economy_request_results er where er.character_id=cid and er.request_id=p_request_id;
  if found then
    if cached->>'operation' is distinct from 'company_purchase' then raise exception 'Request ID already used'; end if;
    if cached->>'businessSlug' is distinct from p_business_slug then raise exception 'Request ID belongs to different inputs'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'companyId',cached->>'companyId','paid',cached->'paid');
  end if;
  select * into b from public.business_catalog where slug=p_business_slug and active;
  if not found then raise exception 'Company listing is not available'; end if;
  if exists(select 1 from public.player_companies where owner_character_id=cid and business_id=b.id) then
    raise exception 'You already own this company'; end if;
  select * into w from public.wallets where character_id=cid and user_id=uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  if w.balance < b.purchase_price then raise exception 'Insufficient cash'; end if;
  select coalesce(jsonb_object_agg(service->>'id',(service->>'defaultPrice')::integer),'{}'::jsonb)
    into initial_prices from jsonb_array_elements(b.service_catalog) service;
  update public.wallets set balance=balance-b.purchase_price,total_expenses=total_expenses+b.purchase_price
    where id=w.id returning * into w;
  insert into public.player_companies(business_id,owner_user_id,owner_character_id,service_prices)
    values(b.id,uid,cid,initial_prices) returning * into company;
  insert into public.player_company_shares(company_id,user_id,character_id,shares)
    values(company.id,uid,cid,10000);
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,w.id,cid,b.purchase_price,'expense','company_purchase','Purchased '||b.name,
    'purchase','cash','wallet','business',w.balance,jsonb_build_object('company_id',company.id,'request_id',p_request_id));
  result:=jsonb_build_object('operation','company_purchase','companyId',company.id,'paid',b.purchase_price,'businessSlug',p_business_slug);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'company_purchase',result);
  return jsonb_build_object('ok',true,'duplicate',false,'companyId',company.id,'paid',b.purchase_price,'cash',w.balance);
end $$;

create or replace function public.offer_player_company_shares(p_company_id uuid,p_shares integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid:=public._my_character_id(); owned integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('osogbo-company-economy',0));
  if cid is null then raise exception 'Create a character first'; end if;
  if p_shares is null or p_shares<0 or p_shares>3000 then raise exception 'Offer between 0 and 3,000 shares'; end if;
  perform 1 from public.player_companies where id=p_company_id and owner_character_id=cid for update;
  if not found then raise exception 'Only the company owner can list shares'; end if;
  select shares into owned from public.player_company_shares where company_id=p_company_id and character_id=cid for update;
  if not found then raise exception 'Company ownership record is invalid'; end if;
  if owned-p_shares<7000 then raise exception 'You must keep at least 70 percent of the company'; end if;
  update public.player_companies set shares_for_sale=p_shares where id=p_company_id;
  return jsonb_build_object('ok',true,'sharesForSale',p_shares);
end $$;

create or replace function public.invest_in_player_company(p_company_id uuid,p_shares integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.player_companies%rowtype;
  b public.business_catalog%rowtype; owner_holding public.player_company_shares%rowtype;
  investor_holding public.player_company_shares%rowtype; buyer_wallet public.wallets%rowtype;
  seller_wallet public.wallets%rowtype; price bigint; cached jsonb; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('osogbo-company-economy',0));
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Investment request ID is required'; end if;
  if p_shares is null or p_shares<1 or p_shares>3000 then raise exception 'Choose 1 to 3,000 shares'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into cached from public.economy_request_results er where er.character_id=cid and er.request_id=p_request_id;
  if found then
    if cached->>'operation' is distinct from 'company_investment' then raise exception 'Request ID already used'; end if;
    if cached->>'companyId' is distinct from p_company_id::text or (cached->>'shares')::integer is distinct from p_shares then raise exception 'Request ID belongs to different inputs'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'companyId',cached->>'companyId','shares',cached->'shares','paid',cached->'paid');
  end if;
  select * into c from public.player_companies where id=p_company_id for update;
  if not found or c.shares_for_sale<p_shares then raise exception 'That company does not have enough shares available'; end if;
  if c.owner_character_id=cid then raise exception 'You cannot invest in your own company'; end if;
  select * into b from public.business_catalog where id=c.business_id;
  select * into owner_holding from public.player_company_shares where company_id=c.id and character_id=c.owner_character_id for update;
  if not found then raise exception 'Company ownership record is invalid'; end if;
  price:=greatest(1,floor(b.purchase_price/10000.0))*p_shares;
  select * into buyer_wallet from public.wallets where character_id=cid and user_id=uid;
  if not found or buyer_wallet.balance<price then raise exception 'Insufficient cash'; end if;
  select * into seller_wallet from public.wallets where character_id=owner_holding.character_id and user_id=owner_holding.user_id;
  if not found then raise exception 'Company owner wallet not found'; end if;
  -- All company operations share an advisory lock. Lock these wallet rows in stable order.
  perform 1 from public.wallets where id in (buyer_wallet.id,seller_wallet.id) order by id for update;
  perform public._settle_player_company_earnings(c.id);
  select * into seller_wallet from public.wallets where id=seller_wallet.id;
  select * into buyer_wallet from public.wallets where id=buyer_wallet.id;
  if buyer_wallet.balance<price then raise exception 'Insufficient cash'; end if;
  update public.wallets set balance=balance-price,total_expenses=total_expenses+price where id=buyer_wallet.id returning * into buyer_wallet;
  update public.wallets set balance=balance+price,total_income=total_income+price where id=seller_wallet.id returning * into seller_wallet;
  update public.player_company_shares set shares=shares-p_shares where company_id=c.id and character_id=c.owner_character_id;
  insert into public.player_company_shares(company_id,user_id,character_id,shares) values(c.id,uid,cid,p_shares)
    on conflict(company_id,character_id) do update set shares=public.player_company_shares.shares+excluded.shares returning * into investor_holding;
  update public.player_companies set shares_for_sale=shares_for_sale-p_shares where id=c.id;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,transaction_type,
    account,source,destination,balance_after,metadata)
  values(uid,buyer_wallet.id,cid,price,'expense','company_investment','Invested in '||b.name,'purchase','cash','wallet','company',buyer_wallet.balance,
    jsonb_build_object('company_id',c.id,'shares',p_shares,'request_id',p_request_id)),
    (owner_holding.user_id,seller_wallet.id,owner_holding.character_id,price,'income','company_share_sale','Company shares sold: '||b.name,
    'income','cash','company','wallet',seller_wallet.balance,jsonb_build_object('company_id',c.id,'shares',p_shares));
  result:=jsonb_build_object('operation','company_investment','companyId',c.id,'shares',p_shares,'paid',price);
  insert into public.economy_request_results(character_id,request_id,operation,result) values(cid,p_request_id,'company_investment',result);
  return jsonb_build_object('ok',true,'duplicate',false,'companyId',c.id,'shares',p_shares,'paid',price,'cash',buyer_wallet.balance);
end $$;

create or replace function public.configure_player_company(p_company_id uuid,p_prices jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid:=public._my_character_id(); c public.player_companies%rowtype; b public.business_catalog%rowtype;
  item jsonb; service_id text; price integer; allowed boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('osogbo-company-economy',0));
  if cid is null then raise exception 'Create a character first'; end if;
  if jsonb_typeof(p_prices) is distinct from 'object' or p_prices='{}'::jsonb then raise exception 'Set at least one service price'; end if;
  select * into c from public.player_companies where id=p_company_id and owner_character_id=cid for update;
  if not found then raise exception 'Company not found'; end if;
  select * into b from public.business_catalog where id=c.business_id;
  for service_id,item in select key,value from jsonb_each(p_prices) loop
    select exists(select 1 from jsonb_array_elements(b.service_catalog) s where s->>'id'=service_id
      and jsonb_typeof(item)='number'
      and (item #>> '{}') ~ '^[0-9]+$'
      and (item #>> '{}')::integer between (s->>'minPrice')::integer and (s->>'maxPrice')::integer) into allowed;
    if not allowed then raise exception 'A service price is outside the company limits'; end if;
  end loop;
  if (select count(*) from jsonb_object_keys(p_prices))<>(select count(*) from jsonb_array_elements(b.service_catalog)) then
    raise exception 'Set a price for every company service'; end if;
  if c.service_prices=p_prices then
    return jsonb_build_object('ok',true,'companyId',c.id,'prices',p_prices);
  end if;
  perform public._settle_player_company_earnings(c.id);
  update public.player_companies set service_prices=p_prices where id=c.id;
  return jsonb_build_object('ok',true,'companyId',c.id,'prices',p_prices);
end $$;

create or replace function public.claim_player_company_earnings(p_company_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid:=public._my_character_id(); c public.player_companies%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('osogbo-company-economy',0));
  select * into c from public.player_companies where id=p_company_id and owner_character_id=cid for update;
  if not found then raise exception 'Company not found'; end if;
  if now()<c.accrued_at+interval '1 hour' then raise exception 'Company earnings are not ready yet'; end if;
  return public._settle_player_company_earnings(p_company_id);
end $$;

create or replace function public.create_fixed_term_investment(p_product_slug text,p_amount bigint,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); p public.fixed_investment_products%rowtype;
  w public.wallets%rowtype; i public.player_fixed_investments%rowtype; cached jsonb; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Investment request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into cached from public.economy_request_results er where er.character_id=cid and er.request_id=p_request_id;
  if found then
    if cached->>'operation' is distinct from 'fixed_investment' then raise exception 'Request ID already used'; end if;
    if cached->>'productSlug' is distinct from p_product_slug or (cached->>'principal')::bigint is distinct from p_amount then raise exception 'Request ID belongs to different inputs'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'investmentId',cached->>'investmentId');
  end if;
  select * into p from public.fixed_investment_products where slug=p_product_slug and active;
  if not found then raise exception 'Investment product is unavailable'; end if;
  if p_amount is null or p_amount<p.minimum_amount or p_amount>p.maximum_amount then raise exception 'Amount is outside product limits'; end if;
  select * into w from public.wallets where character_id=cid and user_id=uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  if w.balance<p_amount then raise exception 'Insufficient cash'; end if;
  update public.wallets set balance=balance-p_amount,total_expenses=total_expenses+p_amount where id=w.id returning * into w;
  insert into public.player_fixed_investments(user_id,character_id,product_id,principal,yield_bps,term_days,matures_at)
  values(uid,cid,p.id,p_amount,p.yield_bps,p.term_days,now()+make_interval(days=>p.term_days)) returning * into i;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,w.id,cid,p_amount,'expense','investment_opened','Started '||p.name,
    'purchase','cash','wallet','fixed_investment',w.balance,jsonb_build_object('investment_id',i.id,'request_id',p_request_id));
  result:=jsonb_build_object('operation','fixed_investment','investmentId',i.id,'principal',p_amount,'productSlug',p_product_slug);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'fixed_investment',result);
  return jsonb_build_object('ok',true,'duplicate',false,'investmentId',i.id,'principal',p_amount,'maturesAt',i.matures_at,'cash',w.balance);
end $$;

create or replace function public.claim_fixed_term_investment(p_investment_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid:=public._my_character_id(); uid uuid:=auth.uid(); i public.player_fixed_investments%rowtype;
  p public.fixed_investment_products%rowtype; w public.wallets%rowtype; payout bigint;
begin
  if cid is null then raise exception 'Create a character first'; end if;
  select * into i from public.player_fixed_investments where id=p_investment_id and character_id=cid and user_id=uid for update;
  if not found then raise exception 'Investment not found'; end if;
  if i.claimed_at is not null then raise exception 'Investment has already been claimed'; end if;
  if now()<i.matures_at then raise exception 'Investment has not matured yet'; end if;
  select * into p from public.fixed_investment_products where id=i.product_id;
  payout:=i.principal+floor(i.principal*i.yield_bps/10000.0)::bigint;
  select * into w from public.wallets where character_id=cid and user_id=uid for update;
  update public.wallets set balance=balance+payout,total_income=total_income+payout where id=w.id returning * into w;
  update public.player_fixed_investments set claimed_at=now() where id=i.id;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,w.id,cid,payout,'income','investment_return','Matured '||p.name,
    'income','cash','fixed_investment','wallet',w.balance,jsonb_build_object('investment_id',i.id,'principal',i.principal));
  return jsonb_build_object('ok',true,'investmentId',i.id,'paid',payout,'cash',w.balance);
end $$;

revoke all on function public.get_business_and_investment_market() from public,anon;
revoke all on function public.buy_player_company(text,uuid) from public,anon;
revoke all on function public.configure_player_company(uuid,jsonb) from public,anon;
revoke all on function public.claim_player_company_earnings(uuid) from public,anon;
revoke all on function public.offer_player_company_shares(uuid,integer) from public,anon;
revoke all on function public.invest_in_player_company(uuid,integer,uuid) from public,anon;
revoke all on function public.create_fixed_term_investment(text,bigint,uuid) from public,anon;
revoke all on function public.claim_fixed_term_investment(uuid) from public,anon;
grant execute on function public.get_business_and_investment_market() to authenticated;
grant execute on function public.buy_player_company(text,uuid) to authenticated;
grant execute on function public.configure_player_company(uuid,jsonb) to authenticated;
grant execute on function public.claim_player_company_earnings(uuid) to authenticated;
grant execute on function public.offer_player_company_shares(uuid,integer) to authenticated;
grant execute on function public.invest_in_player_company(uuid,integer,uuid) to authenticated;
grant execute on function public.create_fixed_term_investment(text,bigint,uuid) to authenticated;
grant execute on function public.claim_fixed_term_investment(uuid) to authenticated;
