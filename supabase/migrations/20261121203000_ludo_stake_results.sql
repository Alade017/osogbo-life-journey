-- Stake-table Ludo results. The multiplayer Ludo room decides the winner on the server; these functions let it
-- check who holds a seat and settle the pot. Only the service role can call them, so a player cannot choose
-- the winner or the payout. The stake-Ludo RPCs from the earlier live schema stay locked.

-- The seats of a Ludo stake table, for the room to check who may join. Service role only.
create or replace function public.ludo_stake_table_for_room(p_table uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.mini_game_tables%rowtype;
  seats jsonb;
begin
  select * into t from public.mini_game_tables where id = p_table;
  if not found or t.game <> 'ludo' then raise exception 'This is not a Ludo table'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', s.user_id, 'character_id', s.character_id, 'seat', s.seat)
           order by s.seat), '[]'::jsonb)
    into seats
    from public.mini_game_seats s
    where s.table_id = p_table;
  return jsonb_build_object('status', t.status, 'stake', t.stake, 'mode', t.ludo_mode, 'seats', seats);
end;
$$;

-- Pays the pot to the winner and records the match. The players must be exactly the seated players.
create or replace function public.ludo_stake_settle(p_table uuid, p_winner_user uuid, p_players uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.mini_game_tables%rowtype;
  winner_seat smallint;
  seated uuid[];
  match_id uuid;
begin
  select * into t from public.mini_game_tables where id = p_table for update;
  if not found or t.game <> 'ludo' then raise exception 'This is not a Ludo table'; end if;
  if t.status <> 'playing' then raise exception 'This table is not in play'; end if;

  select array_agg(s.user_id order by s.seat) into seated
    from public.mini_game_seats s
    where s.table_id = p_table;
  select s.seat into winner_seat
    from public.mini_game_seats s
    where s.table_id = p_table and s.user_id = p_winner_user;

  if winner_seat is null then raise exception 'The winner must be seated at this table'; end if;
  if (select array_agg(x order by x) from unnest(p_players) x) is distinct from (select array_agg(x order by x) from unnest(seated) x) then
    raise exception 'The players must be the seated players';
  end if;
  if cardinality(seated) not between 2 and 4 then raise exception 'A Ludo table needs two to four players'; end if;

  perform public._mini_game_settle(p_table, 'win', winner_seat);

  insert into public.matches (winner_id, player_ids) values (p_winner_user, seated) returning id into match_id;
  update public.profiles set ludo_wins = ludo_wins + 1 where id = p_winner_user;
  return match_id;
end;
$$;

revoke all on function public.ludo_stake_table_for_room(uuid) from public, anon, authenticated;
revoke all on function public.ludo_stake_settle(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.ludo_stake_table_for_room(uuid) to service_role;
grant execute on function public.ludo_stake_settle(uuid, uuid, uuid[]) to service_role;

notify pgrst, 'reload schema';
