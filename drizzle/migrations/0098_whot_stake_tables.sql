-- Whot at stake tables. The whole game (both hands, the stock and the discard pile) lives in a private
-- table that no client role can read. A player reads only their own hand and the public facts through
-- mini_game_whot_view. The rules run on the server (the whot action route), which commits each new state
-- through mini_game_whot_commit with a version check, so a stale move is refused.

alter table public.mini_game_tables drop constraint if exists mini_game_tables_game_check;
alter table public.mini_game_tables add constraint mini_game_tables_game_check check (game in ('tictactoe','whot'));

create table if not exists public.mini_game_whot_games (
  table_id uuid primary key references public.mini_game_tables(id) on delete cascade,
  state jsonb not null,
  version integer not null default 0 check (version >= 0),
  updated_at timestamptz not null default now()
);
alter table public.mini_game_whot_games enable row level security;
revoke all on public.mini_game_whot_games from public, anon, authenticated;
grant all on public.mini_game_whot_games to service_role;

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
    'Won a ' || case when t.game = 'whot' then 'Whot' else 'Tic-Tac-Toe' end || ' table');
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
    'Stake for a ' || case when t.game = 'whot' then 'Whot' else 'Tic-Tac-Toe' end || ' table');
  insert into public.mini_game_seats(table_id,character_id,user_id,seat,paid) values(p_table,cid,uid,2,t.stake);
  update public.mini_game_tables
    set pot = pot + t.stake,
        status = 'playing',
        started_at = now()
    where id=p_table;
  update public.mini_game_boards set turn=1, cells='---------', version=0, updated_at=now() where table_id=p_table;
  return p_table;
end $$;

-- Moves on a Tic-Tac-Toe table only.
create or replace function public.mini_game_play_move(p_table uuid, p_cell int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid:=public._my_character_id(); t public.mini_game_tables%rowtype; me public.mini_game_seats%rowtype;
  b public.mini_game_boards%rowtype; mark text; v_cells text; winner text;
begin
  if cid is null then raise exception 'Sign in and create a character first'; end if;
  select * into t from public.mini_game_tables where id=p_table for update;
  if not found or t.status <> 'playing' then raise exception 'This table is not in play'; end if;
  if t.game <> 'tictactoe' then raise exception 'This is not a Tic-Tac-Toe table'; end if;
  select * into me from public.mini_game_seats where table_id=p_table and character_id=cid;
  if not found then raise exception 'You are not at this table'; end if;
  select * into b from public.mini_game_boards where table_id=p_table for update;
  if b.turn <> me.seat then raise exception 'It is not your turn'; end if;
  if p_cell is null or p_cell < 0 or p_cell > 8 then raise exception 'That square does not exist'; end if;
  if substr(b.cells, p_cell + 1, 1) <> '-' then raise exception 'That square is taken'; end if;
  mark := case when me.seat = 1 then 'X' else 'O' end;
  v_cells := overlay(b.cells placing mark from p_cell + 1 for 1);
  winner := public._mini_game_line_winner(v_cells);
  update public.mini_game_boards
    set cells = v_cells, turn = case when b.turn = 1 then 2 else 1 end, version = version + 1, updated_at = now()
    where table_id = p_table;
  update public.mini_game_seats set last_active_at = now() where table_id = p_table and character_id = cid;
  if winner is not null then
    perform public._mini_game_settle(p_table, 'win', me.seat);
  elsif position('-' in v_cells) = 0 then
    perform public._mini_game_settle(p_table, 'draw', null);
  end if;
  return jsonb_build_object('cells', v_cells, 'winner', winner);
end $$;

create or replace function public.mini_game_create_whot_table(p_stake bigint)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); tid uuid;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_stake is null or p_stake < 100 or p_stake > 5000 then raise exception 'Stakes must be between 100 and 5000 Naira'; end if;
  perform public._mini_game_assert_free(cid);
  insert into public.mini_game_tables(game,stake,host_character_id,pot) values('whot',p_stake,cid,p_stake)
    returning id into tid;
  perform public._mini_game_debit(cid, uid, p_stake, tid, 'Stake for a Whot table');
  insert into public.mini_game_seats(table_id,character_id,user_id,seat,paid) values(tid,cid,uid,1,p_stake);
  return tid;
end $$;

-- What a seated player may see: their own hand, the public pile facts and the opponent's card count.
create or replace function public.mini_game_whot_view(p_table uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid:=public._my_character_id(); t public.mini_game_tables%rowtype; me public.mini_game_seats%rowtype;
  g public.mini_game_whot_games%rowtype; st jsonb; my_index int; other_index int;
begin
  if cid is null then raise exception 'Sign in and create a character first'; end if;
  select * into t from public.mini_game_tables where id=p_table;
  if not found or t.game <> 'whot' then raise exception 'This is not a Whot table'; end if;
  select * into me from public.mini_game_seats where table_id=p_table and character_id=cid;
  if not found then raise exception 'You are not at this table'; end if;
  my_index := me.seat - 1;
  other_index := 1 - my_index;
  select * into g from public.mini_game_whot_games where table_id=p_table;
  if not found then
    return jsonb_build_object('started', false, 'status', t.status, 'my_seat', me.seat, 'version', -1);
  end if;
  st := g.state;
  return jsonb_build_object(
    'started', true,
    'status', t.status,
    'version', g.version,
    'my_seat', me.seat,
    'turn_seat', (st->>'turn')::int + 1,
    'shape', st->>'shape',
    'top', st->'discard'->-1,
    'discard_count', jsonb_array_length(st->'discard'),
    'stock_count', jsonb_array_length(st->'stock'),
    'pending_draw', (st->>'pendingDraw')::int,
    'pending_rank', st->'pendingRank',
    'winner_seat', case when st->>'winner' is null then null else (st->>'winner')::int + 1 end,
    'my_hand', st->'hands'->my_index,
    'opponent_count', jsonb_array_length(st->'hands'->other_index)
  );
end $$;

-- Server only: the full game, for the action route to apply the rules.
create or replace function public.mini_game_whot_load(p_table uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.mini_game_tables%rowtype; g public.mini_game_whot_games%rowtype; seats jsonb;
begin
  select * into t from public.mini_game_tables where id=p_table;
  if not found or t.game <> 'whot' then raise exception 'This is not a Whot table'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('character_id',character_id,'user_id',user_id,'seat',seat) order by seat),'[]'::jsonb)
    into seats from public.mini_game_seats where table_id=p_table;
  select * into g from public.mini_game_whot_games where table_id=p_table;
  return jsonb_build_object('status', t.status, 'seats', seats,
    'version', coalesce(g.version, -1), 'state', g.state);
end $$;

-- Server only: starts the game once. A second call changes nothing.
create or replace function public.mini_game_whot_init(p_table uuid, p_state jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare t public.mini_game_tables%rowtype;
begin
  select * into t from public.mini_game_tables where id=p_table for update;
  if not found or t.game <> 'whot' or t.status <> 'playing' then raise exception 'This table is not in play'; end if;
  insert into public.mini_game_whot_games(table_id,state,version) values(p_table,p_state,0)
    on conflict (table_id) do nothing;
end $$;

-- Server only: stores the next state if the table has not changed since the server read it.
-- A winning state settles the pot in the same transaction.
create or replace function public.mini_game_whot_commit(
  p_table uuid, p_actor_user uuid, p_expected_version int, p_state jsonb, p_winner_seat smallint
) returns integer language plpgsql security definer set search_path=public as $$
declare t public.mini_game_tables%rowtype; g public.mini_game_whot_games%rowtype; actor public.mini_game_seats%rowtype;
  new_version integer;
begin
  select * into t from public.mini_game_tables where id=p_table for update;
  if not found or t.game <> 'whot' or t.status <> 'playing' then raise exception 'This table is not in play'; end if;
  select * into g from public.mini_game_whot_games where table_id=p_table for update;
  if not found then raise exception 'The game has not started'; end if;
  if g.version <> p_expected_version then raise exception 'GAME_CHANGED: The table changed. Refresh and try again.'; end if;
  select * into actor from public.mini_game_seats where table_id=p_table and user_id=p_actor_user;
  if not found then raise exception 'NOT_SEATED: You are not at this table'; end if;
  new_version := g.version + 1;
  update public.mini_game_whot_games set state=p_state, version=new_version, updated_at=now() where table_id=p_table;
  update public.mini_game_seats set last_active_at=now() where table_id=p_table and user_id=p_actor_user;
  if p_winner_seat is not null then
    perform public._mini_game_settle(p_table, 'win', p_winner_seat);
  end if;
  return new_version;
end $$;

revoke all on function public.mini_game_create_whot_table(bigint), public.mini_game_whot_view(uuid),
  public.mini_game_whot_load(uuid), public.mini_game_whot_init(uuid, jsonb),
  public.mini_game_whot_commit(uuid, uuid, int, jsonb, smallint) from public, anon;
grant execute on function public.mini_game_create_whot_table(bigint), public.mini_game_whot_view(uuid) to authenticated;
grant execute on function public.mini_game_whot_load(uuid), public.mini_game_whot_init(uuid, jsonb),
  public.mini_game_whot_commit(uuid, uuid, int, jsonb, smallint) to service_role;

notify pgrst, 'reload schema';
