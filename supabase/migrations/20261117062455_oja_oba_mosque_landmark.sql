insert into public.map_landmarks(id, district_id, location_id, is_available) values
  ('mosque-square','oja-oba','a69bb608-eee1-4c80-a005-67888efbe390',true)
on conflict (id) do update set location_id = excluded.location_id, district_id = excluded.district_id, is_available = true;
