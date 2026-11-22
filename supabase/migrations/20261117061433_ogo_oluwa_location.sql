insert into public.locations(slug, name, tagline, description, district_type, map_x, map_y, color, sort_order, travel_fare, travel_minutes, type, icon, map_coordinate_mode, interaction_radius_m, canvas_x, canvas_y, map_category, level_required, is_active)
values ('ogo-oluwa', 'Ogo-Oluwa Quarter', 'A quiet neighbourhood', 'A fictional quieter neighbourhood district. No real home or street address is represented.', 'residential', 67, 90, 'leaf', 10, 300, 10, 'residential', 'map-pin', 'virtual_game', 50, 0.67, 0.9, 'commercial', 0, true)
on conflict (slug) do nothing;

update public.map_landmarks
set location_id = (select id from public.locations where slug = 'ogo-oluwa')
where id = 'ogo-oluwa-worship';
