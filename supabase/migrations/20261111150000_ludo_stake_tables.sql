-- Ludo at stake tables. Like Whot, the whole game lives in a private table that no client role can read.
-- A seated player reads the public game state through mini_game_ludo_view, which checks the seat first.
-- Dice are rolled on the server (the ludo action route), which commits each new state through
-- mini_game_ludo_commit with a version check, so a stale move is refused.

alter table public.mini_game_tables add column if not exists ludo_mode smallint
  check (ludo_mode in (1, 2));
alter table public.mini_game_tables drop constraint if exists mini_game_tables_game_check;
alter table public.mini_game_tables add constraint mini_game_tables_game_check
  check (game in ('tictactoe','whot','ludo'));

create table if not exists public.mini_game_ludo_games (
  table_id uuid primary key references public.mini_game_tables(id) on delete cascade,
  state jsonb not null,
  version integer not null default 0 check (version >= 0),
  updated_at timestamptz not null default now()
);
alter table public.mini_game_ludo_games enable row level security;
revoke all on public.mini_game_ludo_games from public, anon, authenticated;
grant all on public.mini_game_ludo_games to service_role;

-- The game's name for wallet history and stake labels.
create or replace function public._mini_game_label(p_game text)
returns text language sql immutable as $$
  select case p_game when 'whot' then 'Whot' when 'ludo' then 'Ludo' else 'Tic-Tac-Toe' end
$$;

-- Settlement names the game in the wallet history.
create or replace function public._mini_game_settle(p_table uuid, p_result text, p_winner_seat smallint)
returns void language plpgsql security definer set search_path=public as $$
declare t public.mini_game_tables%rowtype; s public.mini_game_seats%rowtype; fee bigint; payout bigint;
begin
  select * into t from public.mini_game_tables where id=p_table for update;
  if t.status <> 'playing' then raise exception 'This table is not in play'; end if;
  if p_result = 'draw' then
    for s in select * from public.mini_game_seats where table_id=p_table loop
      perform public._mini_game_credit(s.character_id, s.user_id, s.paid, p_table, 'Mini game draw refund');
    end loop;
    update public.mini_game_tables set status='finished', result='draw', finished_at=now() where id=p_table;
    return;
  end if;
  select * into s from public.mini_game_seats where table_id=p_table and seat=p_winner_seat;
  if not found then raise exception 'Winner seat not found'; end if;
  fee := floor(t.pot * t.fee_percent / 100);
  payout := t.pot - fee;
  perform public._mini_game_credit(s.character_id, s.user_id, payout, p_table,
    'Won a ' || public._mini_game_label(t.game) || ' table');
  update public.mini_game_tables
    set status='finished', result=p_result, winner_character_id=s.character_id, finished_at=now()
    where id=p_table;
end $$;

-- Joining labels the stake by game. The second stake starts the table.
create or replace function public.mini_game_join_table(p_table uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); t public.mini_game_tables%rowtype; seats int;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  select * into t from public.mini_game_tables where id=p_table for update;
  if not found then raise exception 'Table not found'; end if;
  if t.status <> 'open' then raise exception 'This table is no longer open'; end if;
  if exists (select 1 from public.mini_game_seats where table_id=p_table and character_id=cid) then
    raise exception 'You are already at this table';
  end if;
  select count(*) into seats from public.mini_game_seats where table_id=p_table;
  if seats >= 2 then raise exception 'This table is full'; end if;
  perform public._mini_game_assert_free(cid);
  perform public._mini_game_debit(cid, uid, t.stake, p_table,
    'Stake for a ' || public._mini_game_label(t.game) || ' table');
  insert into public.mini_game_seats(table_id,character_id,user_id,seat,paid) values(p_table,cid,uid,2,t.stake);
  update public.mini_game_tables
    set pot = pot + t.stake,
        status = 'playing',
        started_at = now()
    where id=p_table;
  update public.mini_game_boards set turn=1, cells='---------', version=0, updated_at=now() where table_id=p_table;
  return p_table;
end $$;

-- Opens a Ludo table. Mode 1 is single house (four seeds each); mode 2 is double house (eight each).
create or replace function public.mini_game_create_ludo_table(p_stake bigint, p_mode smallint)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); tid uuid;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_stake is null or p_stake < 100 or p_stake > 5000 then raise exception 'Stakes must be between 100 and 5000 Naira'; end if;
  if p_mode is null or p_mode not in (1, 2) then raise exception 'Choose single house or double house'; end if;
  perform public._mini_game_assert_free(cid);
  insert into public.mini_game_tables(game,stake,host_character_id,pot,ludo_mode)
    values('ludo',p_stake,cid,p_stake,p_mode)
    returning id into tid;
  perform public._mini_game_debit(cid, uid, p_stake, tid, 'Stake for a Ludo table');
  insert into public.mini_game_seats(table_id,character_id,user_id,seat,paid) values(tid,cid,uid,1,p_stake);
  return tid;
end $$;

-- What a seated player may see. Ludo has no hidden information, so this is the whole public game.
create or replace function public.mini_game_ludo_view(p_table uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid_char uuid:=public._my_character_id(); t public.mini_game_tables%rowtype; me public.mini_game_seats%rowtype;
  g public.mini_game_ludo_games%rowtype;
begin
  if cid_char is null then raise exception 'Sign in and create a character first'; end if;
  select * into t from public.mini_game_tables where id=p_table;
  if not found or t.game <> 'ludo' then raise exception 'This is not a Ludo table'; end if;
  select * into me from public.mini_game_seats where table_id=p_table and character_id=cid_char;
  if not found then raise exception 'You are not at this table'; end if;
  select * into g from public.mini_game_ludo_games where table_id=p_table;
  if not found then
    return jsonb_build_object('started', false, 'status', t.status, 'my_seat', me.seat,
      'mode', t.ludo_mode, 'version', -1);
  end if;
  return jsonb_build_object('started', true, 'status', t.status, 'my_seat', me.seat,
    'mode', t.ludo_mode, 'version', g.version, 'state', g.state);
end $$;

-- Server only: the full game, for the action route to apply the rules.
create or replace function public.mini_game_ludo_load(p_table uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.mini_game_tables%rowtype; g public.mini_game_ludo_games%rowtype; seats jsonb;
begin
  select * into t from public.mini_game_tables where id=p_table;
  if not found or t.game <> 'ludo' then raise exception 'This is not a Ludo table'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('character_id',character_id,'user_id',user_id,'seat',seat) order by seat),'[]'::jsonb)
    into seats from public.mini_game_seats where table_id=p_table;
  select * into g from public.mini_game_ludo_games where table_id=p_table;
  return jsonb_build_object('status', t.status, 'mode', t.ludo_mode, 'seats', seats,
    'version', coalesce(g.version, -1), 'state', g.state);
end $$;

-- Server only: starts the game once. A second call changes nothing.
create or replace function public.mini_game_ludo_init(p_table uuid, p_state jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare t public.mini_game_tables%rowtype;
begin
  select * into t from public.mini_game_tables where id=p_table for update;
  if not found or t.game <> 'ludo' or t.status <> 'playing' then raise exception 'This table is not in play'; end if;
  insert into public.mini_game_ludo_games(table_id,state,version) values(p_table,p_state,0)
    on conflict (table_id) do nothing;
end $$;

-- Server only: stores the next state if the table has not changed since the server read it.
-- A winning state settles the pot in the same transaction.
create or replace function public.mini_game_ludo_commit(
  p_table uuid, p_actor_user uuid, p_expected_version int, p_state jsonb, p_winner_seat smallint
) returns integer language plpgsql security definer set search_path=public as $$
declare t public.mini_game_tables%rowtype; g public.mini_game_ludo_games%rowtype; actor public.mini_game_seats%rowtype;
  new_version integer;
begin
  select * into t from public.mini_game_tables where id=p_table for update;
  if not found or t.game <> 'ludo' or t.status <> 'playing' then raise exception 'This table is not in play'; end if;
  select * into g from public.mini_game_ludo_games where table_id=p_table for update;
  if not found then raise exception 'The game has not started'; end if;
  if g.version <> p_expected_version then raise exception 'GAME_CHANGED: The table changed. Refresh and try again.'; end if;
  select * into actor from public.mini_game_seats where table_id=p_table and user_id=p_actor_user;
  if not found then raise exception 'NOT_SEATED: You are not at this table'; end if;
  new_version := g.version + 1;
  update public.mini_game_ludo_games set state=p_state, version=new_version, updated_at=now() where table_id=p_table;
  update public.mini_game_seats set last_active_at=now() where table_id=p_table and user_id=p_actor_user;
  if p_winner_seat is not null then
    perform public._mini_game_settle(p_table, 'win', p_winner_seat);
  end if;
  return new_version;
end $$;

revoke all on function public.mini_game_create_ludo_table(bigint, smallint), public.mini_game_ludo_view(uuid),
  public.mini_game_ludo_load(uuid), public.mini_game_ludo_init(uuid, jsonb),
  public.mini_game_ludo_commit(uuid, uuid, int, jsonb, smallint) from public, anon;
grant execute on function public.mini_game_create_ludo_table(bigint, smallint), public.mini_game_ludo_view(uuid) to authenticated;
grant execute on function public.mini_game_ludo_load(uuid), public.mini_game_ludo_init(uuid, jsonb),
  public.mini_game_ludo_commit(uuid, uuid, int, jsonb, smallint) to service_role;

notify pgrst, 'reload schema';
