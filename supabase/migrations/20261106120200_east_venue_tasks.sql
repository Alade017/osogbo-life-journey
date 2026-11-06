supa-- Venue-appropriate tasks replace the placeholder activities from 20261106120000.
-- Definitions mirror src/data/osogbo-town.json. Earns are negative money values.
-- Removes the old placeholder rows so only the new task remains active.
delete from public.map_landmark_actions
where landmark_id in ('east-transit-terminal','eastside-produce-coop','adire-makers-yard','neighborhood-play-park');

insert into public.map_landmark_actions (landmark_id, id, definition, sort_order)
values
  ('east-transit-terminal', 'east-transit-terminal-porter', '{"id":"east-transit-terminal-porter","label":"Carry passengers'' bags","description":"Help travellers with their bags at the terminal for a small fee.","time_cost_minutes":40,"money_minor":{"min":-400,"max":-300},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":6,"end":20},"cooldown_game_minutes":120,"verify":false}'::jsonb, 0),
  ('eastside-produce-coop', 'eastside-produce-coop-sort', '{"id":"eastside-produce-coop-sort","label":"Sort the produce crates","description":"Sort and stack crates at the co-op for the day''s traders.","time_cost_minutes":45,"money_minor":{"min":-350,"max":-250},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":19},"cooldown_game_minutes":120,"verify":false}'::jsonb, 0),
  ('adire-makers-yard', 'adire-makers-yard-dye-class', '{"id":"adire-makers-yard-dye-class","label":"Join an adire dye class","description":"Pay for a short class and try a traditional indigo pattern.","time_cost_minutes":60,"money_minor":{"min":150,"max":150},"mood_effect":3,"requirement":"Travel here first","open_hours":{"start":9,"end":18},"cooldown_game_minutes":180,"verify":false}'::jsonb, 0),
  ('neighborhood-play-park', 'neighborhood-play-park-football', '{"id":"neighborhood-play-park-football","label":"Play football with neighbours","description":"Join a casual match with the people in the park.","time_cost_minutes":45,"money_minor":{"min":0,"max":0},"mood_effect":3,"requirement":"Travel here first","open_hours":{"start":6,"end":20},"cooldown_game_minutes":90,"verify":false}'::jsonb, 0);
