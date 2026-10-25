-- The simulation's relax_sofa action validates the placed item's art_key.
-- Starter seats are the basic sofa supplied with each home.
update public.content_items
set art_key = 'sofa'
where id = 'starter-seat' and art_key = 'seat';
