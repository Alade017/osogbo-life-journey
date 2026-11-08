-- Raise every accessory price by 20%. Applied to each live price, so no amount is hardcoded.
-- Accessories are sold from content_items; inventory_items keeps the same price in sync.
update public.content_items
  set price_minor = round(price_minor * 1.2)
  where category = 'accessory' and price_minor > 0;

update public.inventory_items
  set buy_price = round(buy_price * 1.2)
  where equipment_slot = 'accessory' and buy_price > 0;
