-- Studio zoning rug: a decorative floor covering that marks the studio's zones. Approved at
-- 1,500 naira. price_minor is in naira, as formatNaira reads it.
insert into public.content_items (id, category, slot_type, art_key, price_minor, verify, stackable, is_active)
values ('zoning-rug', 'furniture', 'floor', 'zoning-rug', 1500, true, false, true)
on conflict (id) do nothing;
