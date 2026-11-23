update public.game_properties
set is_active = false, updated_at = now()
where id in (
  'fc1db1b5-eb68-49c0-9044-b09e17a9c175',
  'ab7289ff-ce69-4cb4-a36a-73f81e437ad1',
  '423116ab-975a-4f3d-b2f7-2d22954d3637'
);
