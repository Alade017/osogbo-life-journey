-- Activities for the four east-side venues added in 20261105090000.
-- Without these rows the server rejects every action there (UNKNOWN_ACTION).
-- Definitions mirror src/data/osogbo-town.json; keep the two in step.
insert into public.map_landmark_actions (landmark_id, id, definition, sort_order)
values
  ('east-transit-terminal', 'east-transit-terminal-wait', '{"id":"east-transit-terminal-wait","label":"Check the route board","description":"Read the fictional passenger route board at the terminal.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":6,"end":21},"cooldown_game_minutes":60,"verify":false}'::jsonb, 0),
  ('eastside-produce-coop', 'eastside-produce-coop-browse', '{"id":"eastside-produce-coop-browse","label":"Browse produce displays","description":"Look over the shared produce displays at the co-op.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":19},"cooldown_game_minutes":60,"verify":false}'::jsonb, 0),
  ('adire-makers-yard', 'adire-makers-yard-workshop', '{"id":"adire-makers-yard-workshop","label":"Watch the maker tables","description":"Watch fictional makers work at the shared textile tables.","time_cost_minutes":15,"money_minor":{"min":0,"max":0},"mood_effect":2,"requirement":"Travel here first","open_hours":{"start":9,"end":18},"cooldown_game_minutes":60,"verify":false}'::jsonb, 0),
  ('neighborhood-play-park', 'neighborhood-play-park-rest', '{"id":"neighborhood-play-park-rest","label":"Rest on the park benches","description":"Sit and rest in the fictional neighbourhood park.","time_cost_minutes":15,"money_minor":{"min":0,"max":0},"mood_effect":2,"requirement":"Travel here first","open_hours":{"start":6,"end":20},"cooldown_game_minutes":60,"verify":false}'::jsonb, 0)
on conflict (landmark_id, id) do nothing;
