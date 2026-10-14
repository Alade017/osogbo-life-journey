-- Private per-player notifications include placement DELETEs, which Postgres Changes cannot row-filter.
drop policy if exists player_house_state_broadcast_read on realtime.messages;
create policy player_house_state_broadcast_read
  on realtime.messages for select to authenticated
  using (realtime.topic() = 'house-state:' || auth.uid()::text);

create or replace function public.broadcast_player_house_placement_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_house_id uuid;
  owner_id uuid;
begin
  changed_house_id := coalesce(new.player_house_id, old.player_house_id);
  select player_id into owner_id from public.player_houses where id = changed_house_id;
  if owner_id is not null then
    perform realtime.broadcast_changes(
      'house-state:' || owner_id::text,
      'house-state-change',
      tg_op,
      tg_table_name,
      tg_table_schema,
      new,
      old
    );
  end if;
  return null;
end;
$$;
revoke all on function public.broadcast_player_house_placement_change() from public, anon, authenticated;

drop trigger if exists broadcast_player_house_placement_change on public.house_placements;
create trigger broadcast_player_house_placement_change
  after insert or update or delete on public.house_placements
  for each row execute function public.broadcast_player_house_placement_change();
