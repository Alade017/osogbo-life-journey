-- Deactivates three duplicate listings. Records are kept, so the one past tenancy that points at
-- Garden Court Flat stays intact. Approved: deactivate rather than delete.
update public.game_properties
set is_active = false, updated_at = now()
where id in (
  'fc1db1b5-eb68-49c0-9044-b09e17a9c175', -- Garden Court Flat (studio duplicate)
  'ab7289ff-ce69-4cb4-a36a-73f81e437ad1', -- Family Courtyard Home (bungalow duplicate)
  '423116ab-975a-4f3d-b2f7-2d22954d3637'  -- Royal Crown Duplex (duplex duplicate)
);
