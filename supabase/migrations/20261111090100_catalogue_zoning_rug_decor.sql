-- The zoning rug is decor, so it appears in the catalogue's Styles rail without a new category.
update public.content_items set slot_type = 'decor' where id = 'zoning-rug' and slot_type = 'floor';
