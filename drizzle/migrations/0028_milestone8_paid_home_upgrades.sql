-- Milestone 8: make the existing room-upgrade controls persistent and atomic
-- with their simulated cash debit. Client-supplied upgrade prices are never used.

create or replace function public.purchase_home_upgrade(
  p_room_id text,
  p_upgrade_id text,
  p_expected_revision bigint,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  home public.character_home_saves%rowtype;
  wallet public.wallets%rowtype;
  character public.characters%rowtype;
  result jsonb;
  layout_id text;
  price bigint := 500;
  next_revision bigint;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Upgrade request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));

  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id;
  if found then
    if result->>'operation' is distinct from 'home_upgrade' then
      raise exception 'Request ID was already used for another operation';
    end if;
    select * into home from public.character_home_saves where character_id=cid and user_id=uid;
    select * into wallet from public.wallets where character_id=cid and user_id=uid;
    if not found then raise exception 'Wallet not found'; end if;
    return jsonb_build_object('ok',true,'duplicate',true,'upgrade',result->'upgrade',
      'cash',wallet.balance,'payload',home.payload,'revision',home.revision,'saved_at',home.updated_at);
  end if;

  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Save your home before purchasing an upgrade';
  end if;
  select * into character from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into home from public.character_home_saves where character_id=cid and user_id=uid for update;
  if not found then raise exception 'Save your home before purchasing an upgrade'; end if;
  if home.revision <> p_expected_revision then
    return jsonb_build_object('ok',false,'conflict',true,'revision',home.revision,
      'payload',home.payload,'saved_at',home.updated_at);
  end if;
  if not public._valid_home_save(home.payload) then raise exception 'The saved home data is invalid'; end if;

  layout_id := home.payload->>'layoutId';
  if not (
    (layout_id='courtyard-room' and p_room_id='lounge' and p_upgrade_id in ('storage','finish'))
    or (layout_id='garden-flat' and (
      (p_room_id='lounge' and p_upgrade_id in ('finish','lighting'))
      or (p_room_id='kitchen' and p_upgrade_id='appliance')
      or (p_room_id='bedroom' and p_upgrade_id='storage')
    ))
    or (layout_id='family-courtyard' and (
      (p_room_id='lounge' and p_upgrade_id in ('finish','lighting'))
      or (p_room_id='dining' and p_upgrade_id='finish')
      or (p_room_id='kitchen' and p_upgrade_id='appliance')
      or (p_room_id='bedroom' and p_upgrade_id='storage')
      or (p_room_id='bathroom' and p_upgrade_id='appliance')
      or (p_room_id='study' and p_upgrade_id='lighting')
    ))
  ) then raise exception 'That upgrade is not available in this room'; end if;
  if home.payload->'upgrades' ? p_upgrade_id then
    raise exception 'This home upgrade is already owned';
  end if;

  select * into wallet from public.wallets where character_id=cid and user_id=uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  if wallet.balance < price then raise exception 'Insufficient cash'; end if;

  update public.wallets set balance=balance-price,total_expenses=total_expenses+price where id=wallet.id
    returning * into wallet;
  update public.character_home_saves
    set payload=jsonb_set(home.payload,'{upgrades}',(home.payload->'upgrades') || to_jsonb(p_upgrade_id)),
        revision=revision+1,updated_at=now()
    where character_id=cid and user_id=uid
    returning * into home;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,wallet.id,cid,price,'expense','home_upgrade',
    'Home upgrade: ' || p_upgrade_id,'purchase','cash','wallet','home',wallet.balance,
    jsonb_build_object('room',p_room_id,'upgrade',p_upgrade_id,'request_id',p_request_id));
  next_revision := home.revision;
  result := jsonb_build_object('operation','home_upgrade','upgrade',p_upgrade_id,
    'room',p_room_id,'amount',price,'revision',next_revision);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'home_upgrade',result);
  return jsonb_build_object('ok',true,'duplicate',false,'upgrade',p_upgrade_id,
    'cash',wallet.balance,'payload',home.payload,'revision',home.revision,'saved_at',home.updated_at);
end
$$;

revoke all on function public.purchase_home_upgrade(text,text,bigint,uuid) from public, anon;
grant execute on function public.purchase_home_upgrade(text,text,bigint,uuid) to authenticated;
