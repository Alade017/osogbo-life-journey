-- Group names are unique. Case and surrounding spaces are ignored, so "GEE BOYS" and " gee boys "
-- are the same name.
-- Existing duplicates keep the name of the oldest group. Each later copy is renamed with a number
-- (for example "GEE BOYS 2") so its members and messages are kept.

with ranked as (
  select id, row_number() over (partition by lower(btrim(name)) order by created_at, id) as copy_number
  from public.social_groups
)
update public.social_groups groups
  set name = left(btrim(groups.name), 36) || ' ' || ranked.copy_number
  from ranked
  where groups.id = ranked.id and ranked.copy_number > 1;

create unique index if not exists social_groups_name_unique
  on public.social_groups (lower(btrim(name)));

-- Same behaviour as the live definition (pg_get_functiondef, 2026-11-23), plus a named error for a
-- taken name. The unique index still decides a race between two creates.
create or replace function public.create_social_group(p_name text, p_member_character_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._my_social_character_id();
  clean_name text := trim(coalesce(p_name, ''));
  new_group_id uuid;
  candidate uuid;
begin
  if me is null then raise exception 'NO_CHARACTER'; end if;
  if char_length(clean_name) not between 1 and 40 then raise exception 'GROUP_NAME_INVALID'; end if;

  begin
    insert into public.social_groups(name, created_by_character_id)
      values (clean_name, me) returning id into new_group_id;
  exception when unique_violation then
    raise exception 'GROUP_NAME_TAKEN';
  end;
  insert into public.social_group_members(group_id, character_id) values (new_group_id, me);

  for candidate in
    select distinct u from unnest(coalesce(p_member_character_ids, '{}'::uuid[])) as u where u <> me
  loop
    if not public._group_can_admit(new_group_id, candidate) then
      raise exception 'GROUP_MEMBER_UNAVAILABLE';
    end if;
    insert into public.social_group_members(group_id, character_id) values (new_group_id, candidate);
  end loop;

  if (select count(*) from public.social_group_members where group_id = new_group_id) < 2 then
    raise exception 'GROUP_NEEDS_MEMBERS';
  end if;
  return jsonb_build_object('id', new_group_id, 'name', clean_name);
end;
$$;

notify pgrst, 'reload schema';
