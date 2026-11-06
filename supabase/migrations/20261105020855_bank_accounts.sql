create sequence public.bank_account_number_seq
  as bigint
  start with 1000000000
  minvalue 1000000000
  maxvalue 9999999999;

do $$
begin
  if to_regclass('public.map_landmark_actions') is not null then
    update public.map_landmark_actions
    set is_active = false
    where landmark_id in ('cedar-bank', 'meridian-bank');
  end if;
end;
$$;

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null unique references public.characters(id) on delete cascade,
  branch_location_id uuid not null references public.locations(id),
  account_number text not null unique check (account_number ~ '^[0-9]{10}$'),
  opened_at timestamptz not null default now()
);

alter table public.bank_accounts enable row level security;
revoke all on public.bank_accounts from public, anon, authenticated;
grant all on public.bank_accounts to service_role;
revoke all on sequence public.bank_account_number_seq from public, anon, authenticated;

create or replace function public.open_bank_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_player public.characters%rowtype;
  v_account public.bank_accounts%rowtype;
  v_branch_id uuid;
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_player
  from public.characters
  where user_id = v_user_id
  order by created_at desc
  limit 1
  for update;
  if not found then raise exception 'NO_CHARACTER'; end if;

  select location.id into v_branch_id
  from public.locations location
  where location.id = v_player.current_location_id
    and location.type = 'bank'
    and location.is_active;
  if v_branch_id is null then raise exception 'VISIT_BANK_BRANCH'; end if;

  insert into public.bank_accounts (character_id, branch_location_id, account_number)
  values (
    v_player.id,
    v_branch_id,
    lpad(nextval('public.bank_account_number_seq')::text, 10, '0')
  )
  on conflict (character_id) do nothing;

  select * into v_account
  from public.bank_accounts
  where character_id = v_player.id;

  return jsonb_build_object(
    'id', v_account.id,
    'account_number', v_account.account_number,
    'branch_location_id', v_account.branch_location_id,
    'branch_name', (
      select location.name
      from public.locations location
      where location.id = v_account.branch_location_id
    ),
    'opened_at', v_account.opened_at
  );
end;
$$;

create or replace function public.my_bank_account()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_character_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then raise exception 'UNAUTHORIZED'; end if;

  select character.id into v_character_id
  from public.characters character
  where character.user_id = v_user_id
  order by character.created_at desc
  limit 1;
  if v_character_id is null then return null; end if;

  select jsonb_build_object(
    'id', account.id,
    'account_number', account.account_number,
    'branch_location_id', account.branch_location_id,
    'branch_name', location.name,
    'opened_at', account.opened_at
  ) into v_result
  from public.bank_accounts account
  join public.locations location on location.id = account.branch_location_id
  where account.character_id = v_character_id;

  return v_result;
end;
$$;

create or replace function public._require_open_bank_account(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.bank_accounts account
    where account.character_id = p_character_id
  ) then
    raise exception 'BANK_ACCOUNT_REQUIRED';
  end if;
end;
$$;

create or replace function public._require_bank_location(p_char uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.characters character
    where character.id = p_char
      and (
        exists (
          select 1
          from public.game_places place
          where place.location_id = character.current_location_id
            and place.category in ('bank', 'atm')
        )
        or exists (
          select 1
          from public.locations location
          where location.id = character.current_location_id
            and location.type = 'bank'
            and location.is_active
        )
      )
  ) then
    raise exception 'Visit a bank or ATM before using bank services';
  end if;
end;
$$;

create or replace function public.bank_deposit_cash(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_character_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  v_character_id := public._my_character_id();
  if v_character_id is null then raise exception 'NO_CHARACTER'; end if;
  perform public._require_open_bank_account(v_character_id);
  return public.deposit_cash(p_amount);
end;
$$;

create or replace function public.bank_withdraw_cash(p_amount bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_character_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
  v_character_id := public._my_character_id();
  if v_character_id is null then raise exception 'NO_CHARACTER'; end if;
  perform public._require_open_bank_account(v_character_id);
  return public.withdraw_cash(p_amount);
end;
$$;

revoke all on function public.open_bank_account() from public, anon;
revoke all on function public.my_bank_account() from public, anon;
revoke all on function public._require_open_bank_account(uuid) from public, anon, authenticated;
revoke all on function public._require_bank_location(uuid) from public, anon, authenticated;
revoke all on function public.deposit_cash(bigint) from public, anon, authenticated;
revoke all on function public.withdraw_cash(bigint) from public, anon, authenticated;
revoke all on function public.bank_deposit_cash(bigint) from public, anon;
revoke all on function public.bank_withdraw_cash(bigint) from public, anon;
grant execute on function public.open_bank_account() to authenticated;
grant execute on function public.my_bank_account() to authenticated;
grant execute on function public.bank_deposit_cash(bigint) to authenticated;
grant execute on function public.bank_withdraw_cash(bigint) to authenticated;