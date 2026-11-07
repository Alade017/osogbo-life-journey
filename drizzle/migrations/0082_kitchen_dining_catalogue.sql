-- Kitchen and dining furniture. Chairs are stackable so a home can own several.
insert into public.content_items(id, category, slot_type, art_key, price_minor, verify, stackable)
values
  ('round-dining-table', 'furniture', 'table', 'dining-table', 1400, true, false),
  ('dining-chair', 'furniture', 'seat', 'dining-chair', 500, true, true),
  ('fridge', 'furniture', 'kitchen', 'fridge', 1800, true, false),
  ('microwave', 'furniture', 'kitchen', 'microwave', 700, true, false),
  ('deep-freezer', 'furniture', 'kitchen', 'deep-freezer', 2200, true, false),
  ('plate-hanger', 'furniture', 'decor', 'plate-hanger', 300, true, false)
on conflict (id) do nothing;
