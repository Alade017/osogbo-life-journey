-- Extra house accessories use the existing purchase and placement RPCs.
-- Keep published catalog rows unchanged when this migration is replayed.
insert into public.content_items(id, category, slot_type, art_key, price_minor, verify, stackable)
values
  ('quilted-bed', 'furniture', 'bed', 'bed', 2400, true, false),
  ('lounge-sofa', 'furniture', 'seat', 'sofa', 1750, true, false),
  ('two-burner-cooker', 'furniture', 'kitchen', 'stove', 1850, true, false),
  ('rain-shower', 'furniture', 'bathroom', 'shower', 1900, true, false),
  ('study-computer', 'furniture', 'device', 'computer', 2500, true, false),
  ('potted-fern', 'furniture', 'plant', 'plant', 400, true, false),
  ('wooden-wardrobe', 'furniture', 'storage', 'wardrobe', 1500, true, false),
  ('coffee-table', 'furniture', 'table', 'coffee-table', 900, true, false),
  ('wall-art', 'furniture', 'decor', 'wall-art', 500, true, false),
  ('floor-lamp', 'furniture', 'light', 'light', 650, true, false)
on conflict (id) do nothing;
