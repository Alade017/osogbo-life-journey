-- Switching homes: renting or buying a different home ends the current rental
-- and refunds its deposit. Owned homes are never switched out automatically.
-- Owned homes already skip weekly rent because buying creates no rent cycle.

-- Ends the character's active rental (never an owned home) and refunds the
-- deposit. Runs inside the caller's transaction, so a failed purchase also rolls
-- back the refund. Returns the amount refunded (0 when nothing was switched).
create function public._end_rented_home_with_refund(
  p_character_id uuid,
  p_user_id uuid,
  p_keep_property_id uuid
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  tenancy public.player_properties%rowtype;
  listing public.game_properties%rowtype;
  house public.house_types%rowtype;
  refund bigint := 0;
  wallet public.wallets%rowtype;
begin
  select * into tenancy from public.player_properties
    where character_id = p_character_id and is_active and tenure = 'rented'
      and (p_keep_property_id is null or property_id <> p_keep_property_id)
    for update;
  if not found then return 0; end if;

  -- Overdue rent must be settled first, otherwise the switch would waive it.
  if exists (
    select 1 from public.property_rent_cycles
    where player_property_id = tenancy.id and status in ('due', 'grace', 'rescue')
  ) then
    raise exception 'PAY_OVERDUE_RENT_FIRST';
  end if;

  select * into listing from public.game_properties where id = tenancy.property_id;
  if listing.house_type_id is not null then
    select * into house from public.house_types where id = listing.house_type_id;
    refund := house.weekly_rent_minor * house.deposit_weeks;
  end if;

  if refund > 0 then
    update public.wallets
      set balance = balance + refund,
          total_expenses = greatest(0, total_expenses - refund),
          updated_at = now()
      where character_id = p_character_id
      returning * into wallet;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
      values (p_user_id, wallet.id, p_character_id, refund, 'income', 'housing_deposit_refund',
        'Deposit refund for ' || listing.name || ' (moved out)');
  end if;

  -- Rent for the current period was already paid; nothing is charged or waived here.
  update public.property_rent_cycles set status = 'paid', paid_at = now()
    where player_property_id = tenancy.id and status = 'current';
  -- The rental trigger mirrors each rental into a legacy room and home row
  -- (see 0059). End those too, or the legacy checks would still see a home.
  -- Rooms are kept, not deleted, so the furniture stays for a later return.
  update public.player_houses set status = 'ended'
    where player_id = p_user_id and status in ('active', 'overdue')
      and (player_property_id = tenancy.id or player_property_id is null)
      and house_type_id = listing.house_type_id;
  delete from public.player_homes
    where character_id = p_character_id and house_type_id = listing.house_type_id;
  update public.player_properties set is_active = false, is_home = false, updated_at = now()
    where id = tenancy.id;

  return refund;
end $$;
revoke all on function public._end_rented_home_with_refund(uuid, uuid, uuid) from public, anon, authenticated;

-- Rent: switch out of the current rental first, then run the original rent function.
alter function public.housing_rent_property(uuid, uuid, uuid) rename to _housing_rent_property_original;
revoke all on function public._housing_rent_property_original(uuid, uuid, uuid) from public, anon, authenticated;

create function public.housing_rent_property(p_user_id uuid, p_property_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if p_request_id is null or p_property_id is null then
    return public._housing_rent_property_original(p_user_id, p_property_id, p_request_id);
  end if;
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  -- Same lock as the original, so a retry cannot refund twice.
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  if not exists (
    select 1 from public.economy_request_results
    where character_id = cid and request_id = p_request_id
  ) then
    perform public._end_rented_home_with_refund(cid, p_user_id, p_property_id);
  end if;
  return public._housing_rent_property_original(p_user_id, p_property_id, p_request_id);
end $$;
revoke all on function public.housing_rent_property(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.housing_rent_property(uuid, uuid, uuid) to service_role;

-- Buy: switch out of a current rental of a different home, then run the buy path.
alter function public.acquire_game_property(uuid, text) rename to _acquire_game_property_before_switch;
revoke all on function public._acquire_game_property_before_switch(uuid, text) from public, anon, authenticated;

create function public.acquire_game_property(p_property_id uuid, p_tenure text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id();
begin
  if cid is not null and p_tenure in ('owned', 'rented') then
    perform 1 from public.characters where id = cid for update;
    perform public._end_rented_home_with_refund(cid, auth.uid(), p_property_id);
  end if;
  return public._acquire_game_property_before_switch(p_property_id, p_tenure);
end $$;
revoke all on function public.acquire_game_property(uuid, text) from public, anon;
grant execute on function public.acquire_game_property(uuid, text) to authenticated;
