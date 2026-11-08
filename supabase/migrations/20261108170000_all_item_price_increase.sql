-- Raise every remaining purchasable item price by 20%. Each live price is multiplied, so no
-- amount is hardcoded. Already raised earlier, so not touched here:
--   content_items (furniture, outfit, accessory)  -> 20261108153000 and 20261108160000
--   inventory_items accessories                    -> 20261108153000
-- Shop offers (shop_items) hold their own price and are raised for every shop.
update public.inventory_items
  set buy_price = round(buy_price * 1.2)
  where buy_price > 0 and equipment_slot is distinct from 'accessory';

update public.shop_items
  set buy_price = round(buy_price * 1.2)
  where buy_price > 0;
