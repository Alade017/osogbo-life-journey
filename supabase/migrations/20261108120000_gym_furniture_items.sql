-- Gym equipment for the home (duplex upstairs lounge with mini gym).
-- Prices are in naira, matching the existing furniture rows.
insert into public.content_items(id,category,slot_type,art_key,price_minor,verify,stackable)
values
  ('treadmill','furniture','fitness','treadmill',4800,true,false),
  ('multi-gym-machine','furniture','fitness','multi-gym-machine',6500,true,false),
  ('dumbbells','furniture','fitness','dumbbells',600,true,false),
  ('yoga-mat','furniture','fitness','yoga-mat',300,true,false),
  ('dumbbell-rack','furniture','fitness','dumbbell-rack',1200,true,false),
  ('full-length-gym-mirror','furniture','fitness','full-length-gym-mirror',1500,true,false),
  ('gym-bag','furniture','fitness','gym-bag',450,true,false)
on conflict(id) do nothing;
