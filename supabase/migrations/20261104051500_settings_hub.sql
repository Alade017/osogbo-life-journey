-- Settings hub: one validated RPC for profile preferences and a server-side account summary.

create or replace function public.update_my_settings(
  p_display_name text default null,
  p_music_enabled boolean default null,
  p_effects_enabled boolean default null,
  p_reduced_motion boolean default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_name text := null;
  result jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;

  if p_display_name is not null then
    v_name := btrim(p_display_name);
    if char_length(v_name) < 1 or char_length(v_name) > 40 then
      raise exception 'Display name must be 1-40 characters';
    end if;
  end if;

  update public.profiles p
  set display_name     = coalesce(v_name, p.display_name),
      music_enabled    = coalesce(p_music_enabled, p.music_enabled),
      effects_enabled  = coalesce(p_effects_enabled, p.effects_enabled),
      reduced_motion   = coalesce(p_reduced_motion, p.reduced_motion),
      -- Kept in step until sound_enabled is retired.
      sound_enabled    = coalesce(p_music_enabled, p.music_enabled)
                      or coalesce(p_effects_enabled, p.effects_enabled),
      updated_at       = now()
  where p.id = uid
  returning to_jsonb(p) into result;

  if result is null then raise exception 'Profile not found'; end if;
  return result;
end;
$$;

create or replace function public.my_account_summary()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'email', u.email,
    'is_guest', coalesce(u.is_anonymous, false),
    'account_type', case
      when coalesce(u.is_anonymous, false) then 'guest'
      when u.email like '%@example.com' then 'username'
      else 'email'
    end
  )
  from auth.users u
  where u.id = auth.uid();
$$;

revoke all on function public.update_my_settings(text, boolean, boolean, boolean) from public, anon;
grant execute on function public.update_my_settings(text, boolean, boolean, boolean) to authenticated;

revoke all on function public.my_account_summary() from public, anon;
grant execute on function public.my_account_summary() to authenticated;

-- Later, after grepping for other direct writes to profiles, you can close the gap:
-- revoke update on public.profiles from authenticated;
-- grant update (<only the columns the app still writes directly>) on public.profiles to authenticated;