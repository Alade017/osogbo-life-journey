-- Preserve migration history while updating brand copy stored in active content.
update public.game_places
set disclosure = replace(disclosure, 'OSOGBO LIFE', 'OSUN LIFE')
where disclosure like '%OSOGBO LIFE%';

comment on column public.characters.world_x is
  'Fictional OSUN LIFE world coordinate; unrelated to geography or viewport pixels.';
comment on column public.characters.world_y is
  'Fictional OSUN LIFE world coordinate; unrelated to geography or viewport pixels.';
