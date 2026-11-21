-- Seats used to be readable by every signed-in player for every table. Now a seat is visible
-- while its table is open (so players can see who is waiting), and once a table is in play
-- only the players seated at it can see the seats. The helper is security definer so the
-- policy does not re-enter the seats table's own RLS.

create or replace function public.mini_game_seated_here(p_table uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mini_game_seats s
    where s.table_id = p_table
      and s.character_id = public._my_character_id()
  );
$$;

revoke all on function public.mini_game_seated_here(uuid) from public, anon;
grant execute on function public.mini_game_seated_here(uuid) to authenticated, service_role;

drop policy if exists mini_game_seats_read on public.mini_game_seats;
create policy mini_game_seats_read on public.mini_game_seats
  for select to authenticated
  using (
    exists (
      select 1
      from public.mini_game_tables t
      where t.id = mini_game_seats.table_id and t.status = 'open'
    )
    or public.mini_game_seated_here(mini_game_seats.table_id)
  );
