-- Multiplayer stake tables for mini games. Tic-Tac-Toe is the first game. Stakes are whole Naira in the
-- wallet. The pot is held in the table. The winner receives the pot minus the house fee. Every write goes
-- through the security definer RPCs below, which validate turns, cells, stakes and payouts on the server.

create table if not exists public.mini_game_tables (
  id uuid primary key default gen_random_uuid(),
  game text not null check (game in ('tictactoe')),
  stake bigint not null check (stake between 100 and 5000),
  fee_percent integer not null default 5 check (fee_percent between 0 and 20),
  status text not null default 'open' check (status in ('open','playing','finished','cancelled')),
  result text check (result in ('win','draw','forfeit')),
  pot bigint not null default 0,
  host_character_id uuid not null,
  winner_character_id uuid,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.mini_game_seats (
  table_id uuid not null references public.mini_game_tables(id) on delete cascade,
  character_id uuid not null,
  user_id uuid not null,
  seat smallint not null check (seat in (1,2)),
  paid bigint not null,
  last_active_at timestamptz not null default now(),
  primary key (table_id, character_id),
  unique (table_id, seat)
);

create table if not exists public.mini_game_boards (
  table_id uuid primary key references public.mini_game_tables(id) on delete cascade,
  cells text not null default '---------' check (char_length(cells) = 9),
  turn smallint not null default 1 check (turn in (1,2)),
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.mini_game_tables enable row level security;
alter table public.mini_game_seats enable row level security;
alter table public.mini_game_boards enable row level security;
grant select on public.mini_game_tables, public.mini_game_seats, public.mini_game_boards to authenticated;
grant all on public.mini_game_tables, public.mini_game_seats, public.mini_game_boards to service_role;
create policy mini_game_tables_read on public.mini_game_tables for select to authenticated using (true);
create policy mini_game_seats_read on public.mini_game_seats for select to authenticated using (true);
create policy mini_game_boards_read on public.mini_game_boards for select to authenticated using (true);

create or replace function public._mini_game_debit(p_cid uuid, p_uid uuid, p_amount bigint, p_table uuid, p_label text)
returns void language plpgsql security definer set search_path=public as $$
declare w public.wallets%rowtype; after_balance bigint;
begin
  select * into w from public.wallets where character_id=p_cid and user_id=p_uid for update;
  if not found or w.balance < p_amount then raise exception 'Not enough cash for this stake'; end if;
  after_balance := w.balance - p_amount;
  update public.wallets set balance=after_balance, total_expenses=total_expenses+p_amount, updated_at=now() where id=w.id;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(p_uid,w.id,p_cid,p_amount,'expense','game',p_label,'game','cash','wallet','mini_game',after_balance,
    jsonb_build_object('table_id',p_table));
end $$;

create or replace function public._mini_game_credit(p_cid uuid, p_uid uuid, p_amount bigint, p_table uuid, p_label text)
returns void language plpgsql security definer set search_path=public as $$
declare w public.wallets%rowtype; after_balance bigint;
begin
  select * into w from public.wallets where character_id=p_cid and user_id=p_uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  after_balance := w.balance + p_amount;
  update public.wallets set balance=after_balance, total_income=total_income+p_amount, updated_at=now() where id=w.id;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(p_uid,w.id,p_cid,p_amount,'income','game',p_label,'game','cash','mini_game','wallet',after_balance,
    jsonb_build_object('table_id',p_table));
end $$;

create or replace function public._mini_game_assert_free(p_cid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if exists (
    select 1 from public.mini_game_seats s join public.mini_game_tables t on t.id=s.table_id
    where s.character_id=p_cid and t.status in ('open','playing')
  ) then raise exception 'You are already at a table'; end if;
end $$;

create or replace function public._mini_game_line_winner(p_cells text)
returns text language plpgsql immutable as $$
declare lines int[][] := array[[1,2,3],[4,5,6],[7,8,9],[1,4,7],[2,5,8],[3,6,9],[1,5,9],[3,5,7]];
  i int; a text; b text; c text;
begin
  for i in 1..8 loop
    a := substr(p_cells, lines[i][1], 1);
    b := substr(p_cells, lines[i][2], 1);
    c := substr(p_cells, lines[i][3], 1);
    if a <> '-' and a = b and b = c then return a; end if;
  end loop;
  return null;
end $$;

-- Pays out a finished table. A draw refunds every stake without a fee. A win or forfeit pays the pot minus the fee.
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
  perform public._mini_game_credit(s.character_id, s.user_id, payout, p_table, 'Won a Tic-Tac-Toe table');
  update public.mini_game_tables
    set status='finished', result=p_result, winner_character_id=s.character_id, finished_at=now()
    where id=p_table;
end $$;

create or replace function public.mini_game_create_table(p_stake bigint)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); tid uuid;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_stake is null or p_stake < 100 or p_stake > 5000 then raise exception 'Stakes must be between 100 and 5000 Naira'; end if;
  perform public._mini_game_assert_free(cid);
  insert into public.mini_game_tables(game,stake,host_character_id,pot) values('tictactoe',p_stake,cid,p_stake)
    returning id into tid;
  perform public._mini_game_debit(cid, uid, p_stake, tid, 'Stake for a Tic-Tac-Toe table');
  insert into public.mini_game_seats(table_id,character_id,user_id,seat,paid) values(tid,cid,uid,1,p_stake);
  insert into public.mini_game_boards(table_id) values(tid);
  return tid;
end $$;

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
  perform public._mini_game_debit(cid, uid, t.stake, p_table, 'Stake for a Tic-Tac-Toe table');
  insert into public.mini_game_seats(table_id,character_id,user_id,seat,paid) values(p_table,cid,uid,2,t.stake);
  update public.mini_game_tables
    set pot = pot + t.stake,
        status = 'playing',
        started_at = now()
    where id=p_table;
  update public.mini_game_boards set turn=1, cells='---------', version=0, updated_at=now() where table_id=p_table;
  return p_table;
end $$;

create or replace function public.mini_game_leave_table(p_table uuid)
returns void language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); t public.mini_game_tables%rowtype; me public.mini_game_seats%rowtype;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  select * into t from public.mini_game_tables where id=p_table for update;
  if not found or t.status <> 'open' then raise exception 'You can only leave a table before it starts'; end if;
  select * into me from public.mini_game_seats where table_id=p_table and character_id=cid;
  if not found then raise exception 'You are not at this table'; end if;
  perform public._mini_game_credit(cid, uid, me.paid, p_table, 'Mini game table refund');
  delete from public.mini_game_seats where table_id=p_table and character_id=cid;
  update public.mini_game_tables set pot = pot - me.paid where id=p_table;
  if not exists (select 1 from public.mini_game_seats where table_id=p_table) then
    update public.mini_game_tables set status='cancelled', finished_at=now() where id=p_table;
  end if;
end $$;

create or replace function public.mini_game_play_move(p_table uuid, p_cell int)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid:=public._my_character_id(); t public.mini_game_tables%rowtype; me public.mini_game_seats%rowtype;
  b public.mini_game_boards%rowtype; mark text; v_cells text; winner text;
begin
  if cid is null then raise exception 'Sign in and create a character first'; end if;
  select * into t from public.mini_game_tables where id=p_table for update;
  if not found or t.status <> 'playing' then raise exception 'This table is not in play'; end if;
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

create or replace function public.mini_game_heartbeat(p_table uuid)
returns void language plpgsql security definer set search_path=public as $$
declare cid uuid:=public._my_character_id();
begin
  if cid is null then raise exception 'Sign in and create a character first'; end if;
  update public.mini_game_seats set last_active_at = now() where table_id = p_table and character_id = cid;
end $$;

-- A seated player may claim the table when the other player has been away for two minutes.
create or replace function public.mini_game_claim_forfeit(p_table uuid)
returns void language plpgsql security definer set search_path=public as $$
declare cid uuid:=public._my_character_id(); me public.mini_game_seats%rowtype; other public.mini_game_seats%rowtype;
begin
  if cid is null then raise exception 'Sign in and create a character first'; end if;
  perform 1 from public.mini_game_tables where id=p_table and status='playing' for update;
  if not found then raise exception 'This table is not in play'; end if;
  select * into me from public.mini_game_seats where table_id=p_table and character_id=cid;
  if not found then raise exception 'You are not at this table'; end if;
  select * into other from public.mini_game_seats where table_id=p_table and character_id<>cid;
  if not found then raise exception 'The other player is missing'; end if;
  if other.last_active_at > now() - interval '2 minutes' then
    raise exception 'The other player has been active recently';
  end if;
  update public.mini_game_boards set updated_at=now() where table_id=p_table;
  perform public._mini_game_settle(p_table, 'forfeit', me.seat);
end $$;

revoke all on function public.mini_game_create_table(bigint) from public;
revoke all on function public.mini_game_join_table(uuid) from public;
revoke all on function public.mini_game_leave_table(uuid) from public;
revoke all on function public.mini_game_play_move(uuid, int) from public;
revoke all on function public.mini_game_heartbeat(uuid) from public;
revoke all on function public.mini_game_claim_forfeit(uuid) from public;
grant execute on function public.mini_game_create_table(bigint) to authenticated;
grant execute on function public.mini_game_join_table(uuid) to authenticated;
grant execute on function public.mini_game_leave_table(uuid) to authenticated;
grant execute on function public.mini_game_play_move(uuid, int) to authenticated;
grant execute on function public.mini_game_heartbeat(uuid) to authenticated;
grant execute on function public.mini_game_claim_forfeit(uuid) to authenticated;
