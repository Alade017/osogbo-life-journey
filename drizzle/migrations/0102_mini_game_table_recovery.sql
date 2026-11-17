-- Table recovery for stake tables. A player can always find the table they are seated at, and a table
-- that has been abandoned settles itself: an open table with no heartbeat for 10 minutes is cancelled and
-- refunded, and a playing table where everyone has been away for 10 minutes refunds both stakes as a draw.
-- Only the caller's own tables are swept, so a player is never blocked by someone else's abandoned table.

create or replace function public._mini_game_sweep_mine(p_cid uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r record;
begin
  for r in
    select t.id, t.pot, s.user_id, s.paid
    from public.mini_game_tables t
    join public.mini_game_seats s on s.table_id = t.id and s.character_id = p_cid
    where t.status = 'open' and s.last_active_at < now() - interval '10 minutes'
    for update of t
  loop
    perform public._mini_game_credit(p_cid, r.user_id, r.paid, r.id, 'Mini game table refund');
    delete from public.mini_game_seats where table_id = r.id and character_id = p_cid;
    update public.mini_game_tables set pot = pot - r.paid where id = r.id;
    if not exists (select 1 from public.mini_game_seats where table_id = r.id) then
      update public.mini_game_tables set status = 'cancelled', finished_at = now() where id = r.id;
    end if;
  end loop;

  for r in
    select t.id
    from public.mini_game_tables t
    join public.mini_game_seats s on s.table_id = t.id and s.character_id = p_cid
    where t.status = 'playing'
      and not exists (
        select 1 from public.mini_game_seats o
        where o.table_id = t.id and o.last_active_at > now() - interval '10 minutes'
      )
    for update of t
  loop
    perform public._mini_game_settle(r.id, 'draw', null);
  end loop;
end $$;

-- Every stake check runs the sweep for the caller first, so a stale table cannot block a new one.
create or replace function public._mini_game_assert_free(p_cid uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  perform public._mini_game_sweep_mine(p_cid);
  if exists (
    select 1 from public.mini_game_seats s join public.mini_game_tables t on t.id = s.table_id
    where s.character_id = p_cid and t.status in ('open','playing')
  ) then raise exception 'You are already at a table'; end if;
end $$;

-- The table the caller is seated at right now, so the lobby can send them back to it or let them leave.
create or replace function public.mini_game_my_table()
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid:=public._my_character_id(); r record;
begin
  if cid is null then return null; end if;
  perform public._mini_game_sweep_mine(cid);
  select t.id, t.game, t.status, t.stake, t.pot, s.seat into r
  from public.mini_game_tables t
  join public.mini_game_seats s on s.table_id = t.id and s.character_id = cid
  where t.status in ('open','playing')
  order by t.created_at desc
  limit 1;
  if not found then return null; end if;
  return jsonb_build_object('table_id', r.id, 'game', r.game, 'status', r.status,
    'stake', r.stake, 'pot', r.pot, 'seat', r.seat);
end $$;

revoke all on function public._mini_game_sweep_mine(uuid) from public, anon, authenticated;
revoke all on function public.mini_game_my_table() from public, anon;
grant execute on function public.mini_game_my_table() to authenticated;

notify pgrst, 'reload schema';
