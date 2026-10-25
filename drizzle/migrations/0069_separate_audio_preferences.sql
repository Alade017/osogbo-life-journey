-- Preserve each player's current combined audio preference before splitting it.
alter table public.profiles
  add column if not exists music_enabled boolean,
  add column if not exists effects_enabled boolean;

update public.profiles
set music_enabled = coalesce(music_enabled, sound_enabled),
    effects_enabled = coalesce(effects_enabled, sound_enabled)
where music_enabled is null or effects_enabled is null;

alter table public.profiles
  alter column music_enabled set default true,
  alter column music_enabled set not null,
  alter column effects_enabled set default true,
  alter column effects_enabled set not null;

-- Existing own-profile SELECT and UPDATE policies also cover these columns.
