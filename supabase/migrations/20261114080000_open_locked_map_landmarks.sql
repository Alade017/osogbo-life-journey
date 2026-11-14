-- Opens the map landmarks that were flagged unavailable. Data only: no schema change.
-- Every affected row already belongs to an active location with no level requirement.
update public.map_landmarks
set is_available = true
where is_available = false;
