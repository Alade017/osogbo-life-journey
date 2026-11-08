-- Raise furniture and outfit prices by 20%, including the gym equipment seeded in
-- 20261108120000. Each live price is multiplied, so no amount is hardcoded.
-- Accessories were raised in 20261108153000 and are excluded here so they change once.
update public.content_items
  set price_minor = round(price_minor * 1.2)
  where category in ('furniture', 'outfit') and price_minor > 0;
