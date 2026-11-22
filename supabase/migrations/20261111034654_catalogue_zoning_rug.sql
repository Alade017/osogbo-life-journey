insert into public.content_items (id, category, slot_type, art_key, price_minor, verify, stackable, is_active)
values ('zoning-rug', 'furniture', 'floor', 'zoning-rug', 1500, true, false, true)
on conflict (id) do nothing;
