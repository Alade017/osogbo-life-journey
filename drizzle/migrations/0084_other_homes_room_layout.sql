-- Move items in the other homes into their rooms, using the same room blocks as the studio.
-- Four-room homes (mini flat, bungalow, duplex) get walls; single and shared rooms stay open
-- and only their items are grouped by room. The studio was done in 0083.
with studio as (
  select p.id, ci.art_key, p.placed_at
  from public.house_placements p
  join public.player_houses h on h.id = p.player_house_id
  join public.content_items ci on ci.id = p.item_id
  where h.house_type_id in ('mini-flat','bungalow','duplex','single-room','shared-room') and p.x is not null and p.y is not null
),
zoned as (
  select id, placed_at, case
    when art_key in ('sofa','coffee-table','television','computer','light','wall-art','plant') then 'sitting'
    when art_key in ('bed','wardrobe','drawer') then 'bedroom'
    when art_key in ('stove','pot','cooking-pot','fridge','microwave','deep-freezer','dining-table','dining-chair','plate-hanger') then 'kitchen'
    when art_key in ('shower','toilet') then 'bathroom'
  end as zone
  from studio
),
numbered as (
  select id, zone, (row_number() over (partition by zone order by placed_at, id) - 1) % 16 as n
  from zoned where zone is not null
),
targets as (
  select id,
    4 + (case zone when 'bedroom' then 0 when 'sitting' then 0 when 'bathroom' then 4 when 'kitchen' then 4 end
         + n % 4 + 0.5) * 11.5 as tx,
    4 + (case zone when 'bedroom' then 0 when 'bathroom' then 0 when 'sitting' then 4 when 'kitchen' then 4 end
         + n / 4 + 0.5) * 11.5 as ty
  from numbered
)
update public.house_placements hp set x = t.tx, y = t.ty
from targets t where hp.id = t.id;
