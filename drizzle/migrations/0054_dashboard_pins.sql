alter table public.profiles
  add column if not exists dashboard_pins jsonb not null
  default '["jobs", "bank", "map", "social", "missions"]'::jsonb;

create or replace function public.save_dashboard_pins(p_pins jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  pin_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(p_pins) <> 'array' then
    raise exception 'Shortcuts must be an array';
  end if;

  pin_count := jsonb_array_length(p_pins);
  if pin_count < 1 or pin_count > 5 then
    raise exception 'Choose between one and five shortcuts';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(p_pins) as pin(value)
    where pin.value not in ('jobs', 'bank', 'map', 'social', 'missions', 'messages')
  ) then
    raise exception 'Unknown shortcut';
  end if;

  if (
    select count(distinct pin.value)
    from jsonb_array_elements_text(p_pins) as pin(value)
  ) <> pin_count then
    raise exception 'Shortcuts must be unique';
  end if;

  update public.profiles
  set dashboard_pins = p_pins,
      updated_at = now()
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  return p_pins;
end;
$$;

revoke all on function public.save_dashboard_pins(jsonb) from public;
grant execute on function public.save_dashboard_pins(jsonb) to authenticated;
