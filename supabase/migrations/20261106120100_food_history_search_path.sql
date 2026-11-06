-- get_food_delivery_history is security definer. Pin its search path to the
-- empty path so it only resolves schema-qualified names (matching the bank functions).
alter function public.get_food_delivery_history() set search_path = '';
