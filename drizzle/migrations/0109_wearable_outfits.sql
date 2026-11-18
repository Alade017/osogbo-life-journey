-- Wearable presentation is item metadata; purchase/equip/unequip retain existing RPCs.
insert into public.inventory_items(slug,name,description,category,icon,value,buy_price,sell_price,stackable,max_stack,usable,sellable,equippable,equipment_slot,effects) values
('city_cream_tee','City Cream Tee','A fitted cream everyday shirt.','clothing','shirt',1200,1200,600,false,1,false,true,true,'top','{"wearable":{"slot":"top","color":"#e8e0cc","cut":"tee"}}'),
('indigo_adire_shirt','Indigo Adire Shirt','An indigo resist-pattern shirt.','clothing','shirt',2400,2400,1200,false,1,false,true,true,'top','{"wearable":{"slot":"top","color":"#3b5bb5","cut":"tee","pattern":"adire"}}'),
('terracotta_long_sleeve','Terracotta Long Sleeve','A warm terracotta long-sleeved shirt.','clothing','shirt',2000,2000,1000,false,1,false,true,true,'top','{"wearable":{"slot":"top","color":"#b96643","cut":"long-sleeve"}}'),
('charcoal_trousers','Charcoal Trousers','Fitted charcoal trousers for everyday wear.','clothing','shirt',1600,1600,800,false,1,false,true,true,'bottom','{"wearable":{"slot":"bottom","color":"#30343e"}}'),
('cream_trainers','Cream Trainers','Simple cream trainers.','clothing','package',1800,1800,900,false,1,false,true,true,'shoes','{"wearable":{"slot":"shoes","color":"#eee5d5"}}')
on conflict(slug) do nothing;
insert into public.shop_items(shop_id,item_id,buy_price,sell_price,stock,is_available)
select s.id,i.id,i.buy_price,i.sell_price,null,true from public.shops s cross join public.inventory_items i
where s.category='clothing' and i.slug in ('city_cream_tee','indigo_adire_shirt','terracotta_long_sleeve','charcoal_trousers','cream_trainers')
on conflict(shop_id,item_id) do nothing;
insert into public.content_items(id,category,slot_type,art_key,price_minor,verify,stackable)
select slug,'outfit',equipment_slot,slug,buy_price,true,false from public.inventory_items
where slug in ('city_cream_tee','indigo_adire_shirt','terracotta_long_sleeve','charcoal_trousers','cream_trainers') on conflict(id) do nothing;
notify pgrst,'reload schema';
