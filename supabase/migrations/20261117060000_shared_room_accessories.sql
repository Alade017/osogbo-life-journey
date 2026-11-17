-- Shared room accessories from the housing blueprint: a rug, an ottoman, a shoe rack,
-- a welcome mat and a bedside lamp. Each is a floor item placed freely in the room.
-- Prices are starting values and can be tuned later.

insert into public.content_items(id,category,slot_type,art_key,price_minor,verify,stackable)
values
  ('rug-teal','furniture','floor','rug',1200,true,false),
  ('ottoman-basic','furniture','floor','ottoman',900,true,false),
  ('shoe-rack','furniture','floor','shoe-rack',600,true,false),
  ('welcome-mat','furniture','floor','welcome-mat',150,true,false),
  ('bedside-lamp','furniture','light','lamp',480,true,false)
on conflict(id) do nothing;
