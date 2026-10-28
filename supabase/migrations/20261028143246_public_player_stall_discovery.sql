-- Public discovery is a projection; raw stall rows remain visible only to their owner.
-- Prerequisites: phone community baseline 0060 and stall passive income migration.
begin;
alter table public.player_stalls enable row level security;
drop policy "phone read player stalls" on public.player_stalls;
create policy "phone own player stalls" on public.player_stalls
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.player_stalls from anon;
revoke all on public.player_stalls from authenticated;
grant select on public.player_stalls to authenticated;
create index player_stalls_open_directory on public.player_stalls(id) where is_open;

create function public.get_public_player_stalls(p_after uuid default null, p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then
    raise exception 'REGISTERED_ACCOUNT_REQUIRED';
  end if;
  if not exists(select 1 from public.characters c where c.user_id=uid) then
    raise exception 'CHARACTER_REQUIRED';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then raise exception 'INVALID_PAGE_LIMIT'; end if;
  with eligible as (
    select s.id,c.name as owner_name,s.name,s.goods
    from public.player_stalls s join public.characters c on c.id=s.character_id and c.user_id=s.user_id
    where s.is_open and s.user_id<>uid and (p_after is null or s.id>p_after)
    order by s.id limit p_limit+1
  ), page as (select * from eligible order by id limit p_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'ownerName',owner_name,'name',name,'goods',goods) order by id) from page),'[]'::jsonb),
    'nextCursor',case when (select count(*) from eligible)>p_limit then (select id from page order by id desc limit 1) else null end
  ) into result;
  return result;
end $$;
revoke all on function public.get_public_player_stalls(uuid,integer) from public,anon;
grant execute on function public.get_public_player_stalls(uuid,integer) to authenticated;
commit;
