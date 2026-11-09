-- Accounts may own multiple characters. The active-character helpers choose the
-- newest character deterministically; a per-account UNIQUE constraint contradicts
-- that supported model and prevents character selection from being exercised.
alter table public.characters
  drop constraint if exists characters_user_id_key;
