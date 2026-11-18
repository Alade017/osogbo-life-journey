-- Match the bungalow's two-bedroom layout; preserve rents, inventory and saved furniture.
update public.house_types set bedrooms = 2 where id = 'bungalow';
