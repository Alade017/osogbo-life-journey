-- Server-owned prices and immutable, owner-scoped request receipts for personal services.
create table public.neighborhood_personal_services (
  id text primary key, zone_id text not null, location_slug text not null,
  kind text not null check(kind in ('barber','pos')), label text not null,
  cash_price bigint not null default 0 check(cash_price>=0),
  cash_payout bigint not null default 0 check(cash_payout>=0),
  bank_fee bigint not null default 0 check(bank_fee>=0),
  hair_styles jsonb not null default '{}'::jsonb,
  hair_colors jsonb not null default '[]'::jsonb, is_active boolean not null default true,
  check ((kind='barber' and cash_payout=0 and bank_fee=0) or (kind='pos' and cash_price=0 and cash_payout>0))
);
alter table public.neighborhood_personal_services enable row level security;
revoke all on public.neighborhood_personal_services from public,anon,authenticated;
grant all on public.neighborhood_personal_services to service_role;
insert into public.neighborhood_personal_services(id,zone_id,location_slug,kind,label,cash_price,cash_payout,bank_fee,hair_styles,hair_colors) values
('barber-style','zone-shop-barber','city-centre','barber','Hair styling',1500,0,0,
'{"female":["Low bun","Natural afro","Knotless braids","Bald","Bantu knots","Locs","Short crop"],"male":["Low fade","Short afro","Cornrows","Bald","Wave cut","Locs"],"nonbinary":["Taper fade","Natural afro","Braids","Bald","Twist-out","Locs"]}',
'["#1b1410","#3b2416","#6b3d1f","#8c8c8c"]'),
('pos-cashout','zone-shop-pos','city-centre','pos','POS cash withdrawal',0,2000,100,'{}','[]');

create table public.neighborhood_service_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null, service_id text not null,
  options jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table public.neighborhood_service_receipts enable row level security;
revoke all on public.neighborhood_service_receipts from public,anon,authenticated;
grant select on public.neighborhood_service_receipts to authenticated;
grant all on public.neighborhood_service_receipts to service_role;
create policy "own personal service receipts" on public.neighborhood_service_receipts for select to authenticated using(user_id=auth.uid());

create or replace function public.my_neighborhood_personal_services(p_zone_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.characters%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  select * into c from public.characters where id=public._my_character_id() and user_id=auth.uid();
  if not found then raise exception 'NO_CHARACTER'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',s.id,'kind',s.kind,'label',s.label,'cash_price',s.cash_price,'cash_payout',s.cash_payout,'bank_fee',s.bank_fee,
    'hair_styles',coalesce(s.hair_styles->c.gender,s.hair_styles->'nonbinary','[]'::jsonb),'hair_colors',s.hair_colors,
    'available',c.inside_home_property_id is null and exists(select 1 from public.locations l where l.id=c.current_location_id and l.slug=s.location_slug and l.is_active)) order by s.id)
    from public.neighborhood_personal_services s where s.zone_id=p_zone_id and s.is_active),'[]'::jsonb);
end $$;
revoke all on function public.my_neighborhood_personal_services(text) from public,anon;
grant execute on function public.my_neighborhood_personal_services(text) to authenticated;

create or replace function public.use_neighborhood_personal_service(
  p_service_id text,p_request_id uuid,p_hair integer,p_hair_color integer,p_quote jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  uid uuid:=auth.uid(); c public.characters%rowtype; w public.wallets%rowtype;
  s public.neighborhood_personal_services%rowtype; receipt public.neighborhood_service_receipts%rowtype;
  options jsonb; result jsonb; cash_after bigint; bank_after bigint; styles jsonb;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  -- Same lock order as the existing economy RPCs; serializes concurrent retries for this player.
  select * into c from public.characters where id=public._my_character_id() and user_id=uid for update;
  if not found then raise exception 'NO_CHARACTER'; end if;
  options:=jsonb_build_object('hair',p_hair,'hair_color',p_hair_color,'quote',p_quote);
  select * into receipt from public.neighborhood_service_receipts where user_id=uid and request_id=p_request_id;
  if found then
    if receipt.service_id<>p_service_id or receipt.options is distinct from options then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return receipt.result;
  end if;
  select * into s from public.neighborhood_personal_services where id=p_service_id and is_active for share;
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;
  if c.inside_home_property_id is not null or not exists(select 1 from public.locations l where l.id=c.current_location_id and l.slug=s.location_slug and l.is_active) then raise exception 'VISIT_SERVICE_LOCATION'; end if;
  if p_quote is distinct from jsonb_build_object('cash_price',s.cash_price,'cash_payout',s.cash_payout,'bank_fee',s.bank_fee) then raise exception 'QUOTE_CHANGED'; end if;
  select * into w from public.wallets where user_id=uid and character_id=c.id for update;
  if not found then raise exception 'NO_WALLET'; end if;
  cash_after:=w.balance; bank_after:=w.bank_balance;
  if s.kind='barber' then
    styles:=coalesce(s.hair_styles->c.gender,s.hair_styles->'nonbinary','[]'::jsonb);
    if p_hair is null or p_hair_color is null or p_hair<0 or p_hair>=jsonb_array_length(styles)
      or p_hair_color<0 or p_hair_color>=jsonb_array_length(s.hair_colors) then raise exception 'INVALID_APPEARANCE'; end if;
    if w.balance<s.cash_price then raise exception 'INSUFFICIENT_CASH'; end if;
    if c.appearance @> jsonb_build_object('hair',p_hair,'hairColor',p_hair_color) then raise exception 'STYLE_ALREADY_SELECTED'; end if;
    cash_after:=w.balance-s.cash_price;
    update public.characters set appearance=coalesce(appearance,'{}'::jsonb)||jsonb_build_object('hair',p_hair,'hairColor',p_hair_color) where id=c.id;
    update public.wallets set balance=cash_after,total_expenses=total_expenses+s.cash_price where id=w.id;
    insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,transaction_type,account,source,destination,balance_after,metadata)
      values(uid,w.id,c.id,s.cash_price,'expense','grooming','Barber hair styling','expense','cash','cash','barber',cash_after,jsonb_build_object('service_id',s.id,'request_id',p_request_id));
  else
    if p_hair is not null or p_hair_color is not null then raise exception 'INVALID_REQUEST'; end if;
    perform public._require_open_bank_account(c.id);
    if w.bank_balance<s.cash_payout+s.bank_fee then raise exception 'INSUFFICIENT_SAVINGS'; end if;
    cash_after:=w.balance+s.cash_payout; bank_after:=w.bank_balance-s.cash_payout-s.bank_fee;
    update public.wallets set balance=cash_after,bank_balance=bank_after,total_expenses=total_expenses+s.bank_fee where id=w.id;
    insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,transaction_type,account,source,destination,balance_after,metadata)
      values(uid,w.id,c.id,s.cash_payout,'expense','withdrawal','POS cash withdrawal','withdrawal','cash','bank','cash',cash_after,jsonb_build_object('bank_balance_after',bank_after,'service_id',s.id,'request_id',p_request_id));
    if s.bank_fee>0 then
      insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,transaction_type,account,source,destination,balance_after,metadata)
        values(uid,w.id,c.id,s.bank_fee,'expense','service_fee','POS convenience fee','expense','bank','bank','pos-agent',bank_after,jsonb_build_object('service_id',s.id,'request_id',p_request_id));
    end if;
  end if;
  result:=jsonb_build_object('ok',true,'service_id',s.id,'cash',cash_after,'bank',bank_after,'hair',p_hair,'hair_color',p_hair_color);
  insert into public.neighborhood_service_receipts(user_id,request_id,service_id,options,result) values(uid,p_request_id,s.id,options,result);
  return result;
end $$;
revoke all on function public.use_neighborhood_personal_service(text,uuid,integer,integer,jsonb) from public,anon;
grant execute on function public.use_neighborhood_personal_service(text,uuid,integer,integer,jsonb) to authenticated;
notify pgrst, 'reload schema';
