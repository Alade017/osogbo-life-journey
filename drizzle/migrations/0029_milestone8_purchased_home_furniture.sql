-- M8: purchases add durable furniture ownership and a stored item atomically.
-- Home edits can rearrange owned pieces but cannot mint additional furniture.

create table public.character_home_furniture (
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (item_id in
    ('sofa','bed','stove','shower','toilet','computer','television','plant')),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (character_id,item_id)
);
alter table public.character_home_furniture enable row level security;
revoke all on public.character_home_furniture from public, anon, authenticated;
grant all on public.character_home_furniture to service_role;

-- Preserve existing saved furniture and storage as owned items when upgrading.
insert into public.character_home_furniture(character_id,user_id,item_id,quantity)
select character_id,user_id,item_id,count(*)::integer
from (
  select h.character_id,h.user_id,f.value->>'itemId' as item_id
  from public.character_home_saves h
  cross join lateral jsonb_array_elements(h.payload->'furniture') f(value)
  where public._valid_home_save(h.payload)
  union all
  select h.character_id,h.user_id,s.value as item_id
  from public.character_home_saves h
  cross join lateral jsonb_array_elements_text(h.payload->'storage') s(value)
  where public._valid_home_save(h.payload)
) owned
group by character_id,user_id,item_id
on conflict(character_id,item_id) do update
set quantity=excluded.quantity,updated_at=now();

create or replace function public._home_furniture_within_owned(
  p_payload jsonb,p_character_id uuid,p_user_id uuid
)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_item_id text; v_used integer; v_owned integer;
begin
  for v_item_id,v_used in
    select items.item_id,count(*)::integer
    from (
      select f.value->>'itemId' as item_id
      from jsonb_array_elements(p_payload->'furniture') f(value)
      union all
      select s.value as item_id
      from jsonb_array_elements_text(p_payload->'storage') s(value)
    ) items
    group by items.item_id
  loop
    select coalesce(i.quantity,0) into v_owned
    from (select 1) seed
    left join public.character_home_furniture i
      on i.character_id=p_character_id and i.user_id=p_user_id and i.item_id=v_item_id;
    if v_used>v_owned then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;
revoke all on function public._home_furniture_within_owned(jsonb,uuid,uuid) from public,anon,authenticated;

create or replace function public.save_my_home(p_payload jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); cid uuid := public._my_character_id(); saved public.character_home_saves%rowtype;
  has_home boolean;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid home save revision'; end if;
  if not public._valid_home_save(p_payload) then raise exception 'Home save failed validation'; end if;
  perform 1 from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into saved from public.character_home_saves where character_id=cid for update;
  has_home := found;
  if has_home and saved.user_id<>uid then raise exception 'Unauthorized'; end if;
  if not has_home then
    if p_expected_revision<>0 then
      return jsonb_build_object('ok',false,'conflict',true,'revision',0,'payload',null);
    end if;
    if not public._home_furniture_within_owned(p_payload,cid,uid) then
      raise exception 'Home save contains furniture you do not own';
    end if;
    insert into public.character_home_saves(character_id,user_id,payload,revision)
      values(cid,uid,p_payload,1) returning * into saved;
  else
    if saved.revision<>p_expected_revision then
      return jsonb_build_object('ok',false,'conflict',true,'revision',saved.revision,
        'payload',saved.payload,'saved_at',saved.updated_at);
    end if;
    if not public._home_furniture_within_owned(p_payload,cid,uid) then
      raise exception 'Home save contains furniture you do not own';
    end if;
    update public.character_home_saves set payload=p_payload,revision=revision+1,updated_at=now()
      where character_id=cid returning * into saved;
  end if;
  return jsonb_build_object('ok',true,'conflict',false,'revision',saved.revision,
    'payload',saved.payload,'saved_at',saved.updated_at);
end $$;
revoke all on function public.save_my_home(jsonb,bigint) from public,anon;
grant execute on function public.save_my_home(jsonb,bigint) to authenticated;

create or replace function public.purchase_home_furniture(
  p_item_id text,p_expected_revision bigint,p_request_id uuid
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid(); cid uuid := public._my_character_id();
  home public.character_home_saves%rowtype; wallet public.wallets%rowtype;
  result jsonb; price bigint;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Furniture purchase request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id;
  if found then
    if result->>'operation' is distinct from 'home_furniture' then
      raise exception 'Request ID was already used for another operation';
    end if;
    select * into home from public.character_home_saves where character_id=cid and user_id=uid;
    select * into wallet from public.wallets where character_id=cid and user_id=uid;
    if not found then raise exception 'Wallet not found'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'item_id',result->'item_id',
      'cash',wallet.balance,'payload',home.payload,'revision',home.revision,'saved_at',home.updated_at);
  end if;
  price := case p_item_id
    when 'sofa' then 900 when 'bed' then 1400 when 'stove' then 1200
    when 'shower' then 1100 when 'toilet' then 750 when 'computer' then 1800
    when 'television' then 1600 when 'plant' then 250 else null end;
  if price is null then raise exception 'That furniture is not available'; end if;
  if p_expected_revision is null or p_expected_revision<1 then
    raise exception 'Save your home before buying furniture';
  end if;
  perform 1 from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into home from public.character_home_saves where character_id=cid and user_id=uid for update;
  if not found then raise exception 'Save your home before buying furniture'; end if;
  if home.revision<>p_expected_revision then
    return jsonb_build_object('ok',false,'conflict',true,'revision',home.revision,
      'payload',home.payload,'saved_at',home.updated_at);
  end if;
  if not public._valid_home_save(home.payload) or not public._home_furniture_within_owned(home.payload,cid,uid) then
    raise exception 'The saved home data is invalid';
  end if;
  if jsonb_array_length(home.payload->'storage')>=100 then raise exception 'Home storage is full'; end if;
  select * into wallet from public.wallets where character_id=cid and user_id=uid for update;
  if not found or wallet.balance<price then raise exception 'Insufficient cash'; end if;
  update public.wallets set balance=balance-price,total_expenses=total_expenses+price
    where id=wallet.id returning * into wallet;
  insert into public.character_home_furniture(character_id,user_id,item_id,quantity)
    values(cid,uid,p_item_id,1)
    on conflict(character_id,item_id) do update
      set quantity=public.character_home_furniture.quantity+1,updated_at=now();
  update public.character_home_saves
    set payload=jsonb_set(home.payload,'{storage}',(home.payload->'storage') || to_jsonb(p_item_id)),
        revision=revision+1,updated_at=now()
    where character_id=cid and user_id=uid returning * into home;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,wallet.id,cid,price,'expense','home_furniture','Bought home furniture: ' || p_item_id,
    'purchase','cash','wallet','home',wallet.balance,
    jsonb_build_object('item_id',p_item_id,'unit_price',price,'request_id',p_request_id));
  result := jsonb_build_object('operation','home_furniture','item_id',p_item_id,
    'amount',price,'revision',home.revision);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'home_furniture',result);
  return jsonb_build_object('ok',true,'duplicate',false,'item_id',p_item_id,'cash',wallet.balance,
    'payload',home.payload,'revision',home.revision,'saved_at',home.updated_at);
end $$;
revoke all on function public.purchase_home_furniture(text,bigint,uuid) from public,anon;
grant execute on function public.purchase_home_furniture(text,bigint,uuid) to authenticated;
