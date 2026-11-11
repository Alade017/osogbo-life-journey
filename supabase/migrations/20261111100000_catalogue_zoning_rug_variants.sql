-- Two more studio zoning rugs, in decor at the same 1,500 naira price as zoning-rug.
insert into public.content_items (id, category, slot_type, art_key, price_minor, verify, stackable, is_active)
values
  ('zoning-rug-terracotta', 'furniture', 'decor', 'zoning-rug-terracotta', 1500, true, false, true),
  ('zoning-rug-indigo', 'furniture', 'decor', 'zoning-rug-indigo', 1500, true, false, true)
on conflict (id) do nothing;
