-- Map actions are seeded from the reviewed fictional town catalog. Existing player state is untouched.
create table public.map_landmark_actions (
  landmark_id text not null references public.map_landmarks(id) on delete cascade,
  id text not null,
  definition jsonb not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  primary key (landmark_id, id),
  constraint map_landmark_actions_id_matches check (definition->>'id' = id)
);
create index map_landmark_actions_active_idx on public.map_landmark_actions(landmark_id, sort_order)
  where is_active;
alter table public.map_landmark_actions enable row level security;
revoke all on public.map_landmark_actions from public, anon, authenticated;
grant select on public.map_landmark_actions to service_role;

insert into public.map_landmark_actions(landmark_id, id, definition, sort_order)
select seed.landmark_id, seed.id, seed.definition, seed.sort_order
from jsonb_to_recordset($map_actions$[{"landmark_id":"town-market","id":"browse-market","definition":{"id":"browse-market","label":"Browse market stalls","description":"Explore fictional stalls and community vendors.","time_cost_minutes":12,"money_minor":{"min":0,"max":0},"mood_effect":2,"requirement":"Travel here first","open_hours":{"start":6,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"town-market","id":"ask-market-work","definition":{"id":"ask-market-work","label":"Ask about market work","description":"Learn about fictional market jobs.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":18},"verify":false},"sort_order":1},{"landmark_id":"town-market","id":"meet-market-visitors","definition":{"id":"meet-market-visitors","label":"Meet other visitors","description":"Spend time with people around the market.","time_cost_minutes":15,"money_minor":{"min":0,"max":0},"mood_effect":3,"requirement":"Travel here first","open_hours":{"start":6,"end":21},"verify":false},"sort_order":2},{"landmark_id":"town-market","id":"help-market-cleanup","definition":{"id":"help-market-cleanup","label":"Help tidy a shared aisle","description":"Take part in a small community activity.","time_cost_minutes":20,"money_minor":{"min":0,"max":0},"mood_effect":2,"requirement":"Travel here first","open_hours":{"start":7,"end":18},"verify":false},"sort_order":3},{"landmark_id":"civic-court","id":"court-ask-clerk","definition":{"id":"court-ask-clerk","label":"Speak with a public clerk","description":"Ask where to find general in-game public service information.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":0,"requirement":"Travel here first","open_hours":{"start":8,"end":17},"verify":false},"sort_order":0},{"landmark_id":"civic-court","id":"court-review-guide","definition":{"id":"court-review-guide","label":"Review the visitor guide","description":"Read a fictional guide to public counters and forms.","time_cost_minutes":12,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":8,"end":17},"verify":false},"sort_order":1},{"landmark_id":"civic-court","id":"court-organize-files","definition":{"id":"court-organize-files","label":"Help organize public files","description":"Take a short fictional records support activity.","time_cost_minutes":25,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":9,"end":16},"verify":false},"sort_order":2},{"landmark_id":"civic-court","id":"court-career-board","definition":{"id":"court-career-board","label":"Check the civic career board","description":"Browse fictional public service job opportunities.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":8,"end":17},"verify":false},"sort_order":3},{"landmark_id":"community-police","id":"police-safety-guide","definition":{"id":"police-safety-guide","label":"Read the safety guide","description":"Review general safety tips prepared for this fictional game town.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":0,"requirement":"Travel here first","open_hours":{"start":0,"end":24},"verify":false},"sort_order":0},{"landmark_id":"community-police","id":"police-ask-directions","definition":{"id":"police-ask-directions","label":"Ask for directions","description":"Get help finding a public destination in the game.","time_cost_minutes":5,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":0,"end":24},"verify":false},"sort_order":1},{"landmark_id":"community-police","id":"police-community-meeting","definition":{"id":"police-community-meeting","label":"Join a community meeting","description":"Meet fictional neighbors for a safety discussion.","time_cost_minutes":20,"money_minor":{"min":0,"max":0},"mood_effect":2,"requirement":"Travel here first","open_hours":{"start":10,"end":18},"verify":false},"sort_order":2},{"landmark_id":"community-police","id":"police-public-careers","definition":{"id":"police-public-careers","label":"Ask about public service careers","description":"Browse fictional public service career paths.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":8,"end":17},"verify":false},"sort_order":3},{"landmark_id":"cedar-bank","id":"cedar-account-info","definition":{"id":"cedar-account-info","label":"Ask about account options","description":"Learn about fictional account types.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":0,"requirement":"Travel here first","open_hours":{"start":8,"end":16},"verify":false},"sort_order":0},{"landmark_id":"cedar-bank","id":"cedar-budgeting","definition":{"id":"cedar-budgeting","label":"Review a budgeting guide","description":"Read a short personal budgeting guide.","time_cost_minutes":12,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":8,"end":16},"verify":false},"sort_order":1},{"landmark_id":"cedar-bank","id":"cedar-bank-jobs","definition":{"id":"cedar-bank-jobs","label":"Check finance jobs","description":"Browse fictional entry-level finance jobs.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":8,"end":16},"verify":false},"sort_order":2},{"landmark_id":"cedar-bank","id":"cedar-service-queue","definition":{"id":"cedar-service-queue","label":"Take a place in the service queue","description":"Wait your turn at a fictional banking counter.","time_cost_minutes":15,"money_minor":{"min":0,"max":0},"mood_effect":0,"requirement":"Travel here first","open_hours":{"start":8,"end":16},"verify":false},"sort_order":3},{"landmark_id":"meridian-bank","id":"meridian-account-info","definition":{"id":"meridian-account-info","label":"Ask about account options","description":"Learn about fictional account types.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":0,"requirement":"Travel here first","open_hours":{"start":8,"end":16},"verify":false},"sort_order":0},{"landmark_id":"meridian-bank","id":"meridian-budgeting","definition":{"id":"meridian-budgeting","label":"Review a budgeting guide","description":"Read a short personal budgeting guide.","time_cost_minutes":12,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":8,"end":16},"verify":false},"sort_order":1},{"landmark_id":"meridian-bank","id":"meridian-bank-jobs","definition":{"id":"meridian-bank-jobs","label":"Check finance jobs","description":"Browse fictional entry-level finance jobs.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":8,"end":16},"verify":false},"sort_order":2},{"landmark_id":"meridian-bank","id":"meridian-service-queue","definition":{"id":"meridian-service-queue","label":"Take a place in the service queue","description":"Wait your turn at a fictional banking counter.","time_cost_minutes":15,"money_minor":{"min":0,"max":0},"mood_effect":0,"requirement":"Travel here first","open_hours":{"start":8,"end":16},"verify":false},"sort_order":3},{"landmark_id":"lantern-club","id":"club-social","definition":{"id":"club-social","label":"Join a social hour","description":"Spend time with other adult players in this fictional venue.","time_cost_minutes":30,"money_minor":{"min":500,"max":500},"mood_effect":3,"requirement":"Travel here first","open_hours":{"start":18,"end":3},"verify":false},"sort_order":0},{"landmark_id":"lantern-club","id":"club-dance","definition":{"id":"club-dance","label":"Dance to the music","description":"Join an evening dance activity.","time_cost_minutes":25,"money_minor":{"min":300,"max":300},"mood_effect":4,"requirement":"Travel here first","open_hours":{"start":18,"end":3},"verify":false},"sort_order":1},{"landmark_id":"lantern-club","id":"club-refreshment","definition":{"id":"club-refreshment","label":"Order a refreshment","description":"Buy a fictional non-alcoholic refreshment.","time_cost_minutes":10,"money_minor":{"min":250,"max":250},"mood_effect":2,"requirement":"Travel here first","open_hours":{"start":18,"end":3},"verify":false},"sort_order":2},{"landmark_id":"lantern-club","id":"club-event-board","definition":{"id":"club-event-board","label":"Check the event board","description":"See what's happening at the club tonight.","time_cost_minutes":5,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":18,"end":3},"verify":false},"sort_order":3},{"landmark_id":"community-clinic","id":"clinic-information","definition":{"id":"clinic-information","label":"Ask for clinic information","description":"Find general information about this fictional clinic.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":0,"requirement":"Travel here first","open_hours":{"start":7,"end":20},"verify":false},"sort_order":0},{"landmark_id":"community-clinic","id":"clinic-wellness","definition":{"id":"clinic-wellness","label":"Attend a wellness session","description":"Take part in a general wellness activity in the game.","time_cost_minutes":20,"money_minor":{"min":0,"max":0},"mood_effect":2,"requirement":"Travel here first","open_hours":{"start":8,"end":17},"verify":false},"sort_order":1},{"landmark_id":"community-clinic","id":"clinic-careers","definition":{"id":"clinic-careers","label":"Check care jobs","description":"Browse fictional clinic support jobs.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":8,"end":17},"verify":false},"sort_order":2},{"landmark_id":"community-clinic","id":"clinic-waiting-area","definition":{"id":"clinic-waiting-area","label":"Rest in the waiting area","description":"Take a quiet break before your next trip.","time_cost_minutes":12,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":20},"verify":false},"sort_order":3},{"landmark_id":"transit-park","id":"transit-read-board","definition":{"id":"transit-read-board","label":"Read the route board","description":"Check fictional local travel guidance.","time_cost_minutes":5,"money_minor":{"min":0,"max":0},"mood_effect":0,"requirement":"Travel here first","open_hours":{"start":5,"end":23},"verify":false},"sort_order":0},{"landmark_id":"transit-park","id":"transit-ask-helper","definition":{"id":"transit-ask-helper","label":"Ask a travel helper","description":"Get directions to another public game location.","time_cost_minutes":5,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":5,"end":23},"verify":false},"sort_order":1},{"landmark_id":"transit-park","id":"transit-meet-travelers","definition":{"id":"transit-meet-travelers","label":"Meet other travelers","description":"Chat with people waiting at the park.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":2,"requirement":"Travel here first","open_hours":{"start":5,"end":23},"verify":false},"sort_order":2},{"landmark_id":"transit-park","id":"transit-help-point","definition":{"id":"transit-help-point","label":"Visit the help point","description":"Find assistance for navigating the fictional town.","time_cost_minutes":5,"money_minor":{"min":0,"max":0},"mood_effect":0,"requirement":"Travel here first","open_hours":{"start":5,"end":23},"verify":false},"sort_order":3},{"landmark_id":"osun-mall","id":"mall-bulk-shopping","definition":{"id":"mall-bulk-shopping","label":"Shop bulk offers","description":"Buy larger packs at server-set wholesale prices.","time_cost_minutes":20,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":8,"end":21},"verify":true},"sort_order":0},{"landmark_id":"osun-mall","id":"mall-career-board","definition":{"id":"mall-career-board","label":"Check supermarket careers","description":"Browse stock, retail and customer service career opportunities.","time_cost_minutes":8,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":8,"end":20},"verify":true},"sort_order":1},{"landmark_id":"sports-ground","id":"sport-open-training","definition":{"id":"sport-open-training","label":"Join open training","description":"Take part in a fictional community fitness session.","time_cost_minutes":30,"money_minor":{"min":0,"max":0},"mood_effect":3,"requirement":"Travel here first","open_hours":{"start":6,"end":21},"verify":false},"sort_order":0},{"landmark_id":"sports-ground","id":"sport-watch-game","definition":{"id":"sport-watch-game","label":"Watch a friendly game","description":"Enjoy a community match at the ground.","time_cost_minutes":45,"money_minor":{"min":0,"max":0},"mood_effect":3,"requirement":"Travel here first","open_hours":{"start":8,"end":20},"verify":false},"sort_order":1},{"landmark_id":"sports-ground","id":"sport-volunteer","definition":{"id":"sport-volunteer","label":"Help set up the field","description":"Volunteer during a community sports event.","time_cost_minutes":20,"money_minor":{"min":0,"max":0},"mood_effect":2,"requirement":"Travel here first","open_hours":{"start":6,"end":18},"verify":false},"sort_order":2},{"landmark_id":"sports-ground","id":"sport-check-board","definition":{"id":"sport-check-board","label":"Check the events board","description":"See upcoming fictional sports activities.","time_cost_minutes":5,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":6,"end":21},"verify":false},"sort_order":3},{"landmark_id":"riverside-food-court","id":"riverside-food-court-visit","definition":{"id":"riverside-food-court-visit","label":"Look around","description":"Spend time at Riverside Food Court.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"sunrise-health-post","id":"sunrise-health-post-visit","definition":{"id":"sunrise-health-post-visit","label":"Look around","description":"Spend time at Sunrise Health Post.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"harvest-tech-hub","id":"harvest-tech-hub-visit","definition":{"id":"harvest-tech-hub-visit","label":"Look around","description":"Spend time at Harvest Tech Hub.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"old-town-library","id":"old-town-library-visit","definition":{"id":"old-town-library-visit","label":"Look around","description":"Spend time at Old Town Library.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"garden-chapel","id":"garden-chapel-visit","definition":{"id":"garden-chapel-visit","label":"Look around","description":"Spend time at Garden Chapel.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"fish-market","id":"fish-market-visit","definition":{"id":"fish-market-visit","label":"Look around","description":"Spend time at Fish Market.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"lagoon-hotel","id":"lagoon-hotel-visit","definition":{"id":"lagoon-hotel-visit","label":"Look around","description":"Spend time at Lagoon Hotel.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"cinema-star","id":"cinema-star-visit","definition":{"id":"cinema-star-visit","label":"Look around","description":"Spend time at Cinema Star.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"fuel-and-go","id":"fuel-and-go-visit","definition":{"id":"fuel-and-go-visit","label":"Look around","description":"Spend time at Fuel and Go Station.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"youth-arts-centre","id":"youth-arts-centre-visit","definition":{"id":"youth-arts-centre-visit","label":"Look around","description":"Spend time at Youth Arts Centre.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"post-office","id":"post-office-visit","definition":{"id":"post-office-visit","label":"Look around","description":"Spend time at Post Office.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"mosque-square","id":"mosque-square-visit","definition":{"id":"mosque-square-visit","label":"Look around","description":"Spend time at Mosque Square.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"riverside-food-court","id":"riverside-food-court-visit","definition":{"id":"riverside-food-court-visit","label":"Look around","description":"Spend time at Riverside Food Court.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"sunrise-health-post","id":"sunrise-health-post-visit","definition":{"id":"sunrise-health-post-visit","label":"Look around","description":"Spend time at Sunrise Health Post.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"harvest-tech-hub","id":"harvest-tech-hub-visit","definition":{"id":"harvest-tech-hub-visit","label":"Look around","description":"Spend time at Harvest Tech Hub.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"old-town-library","id":"old-town-library-visit","definition":{"id":"old-town-library-visit","label":"Look around","description":"Spend time at Old Town Library.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"fish-market","id":"fish-market-visit","definition":{"id":"fish-market-visit","label":"Look around","description":"Spend time at Fish Market.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"lagoon-hotel","id":"lagoon-hotel-visit","definition":{"id":"lagoon-hotel-visit","label":"Look around","description":"Spend time at Lagoon Hotel.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"cinema-star","id":"cinema-star-visit","definition":{"id":"cinema-star-visit","label":"Look around","description":"Spend time at Cinema Star.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"fuel-and-go","id":"fuel-and-go-visit","definition":{"id":"fuel-and-go-visit","label":"Look around","description":"Spend time at Fuel and Go Station.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"youth-arts-centre","id":"youth-arts-centre-visit","definition":{"id":"youth-arts-centre-visit","label":"Look around","description":"Spend time at Youth Arts Centre.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0},{"landmark_id":"post-office","id":"post-office-visit","definition":{"id":"post-office-visit","label":"Look around","description":"Spend time at Post Office.","time_cost_minutes":10,"money_minor":{"min":0,"max":0},"mood_effect":1,"requirement":"Travel here first","open_hours":{"start":7,"end":21},"cooldown_game_minutes":60,"verify":false},"sort_order":0}]$map_actions$::jsonb)
  as seed(landmark_id text, id text, definition jsonb, sort_order integer)
join public.map_landmarks landmark on landmark.id = seed.landmark_id
on conflict (landmark_id, id) do nothing;

create or replace function public.map_get_landmark_details(p_user_id uuid, p_landmark_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  player public.characters%rowtype;
  destination public.map_landmarks%rowtype;
  result jsonb;
begin
  select * into player from public.characters where user_id = p_user_id;
  if not found then raise exception using message = 'NO_CHARACTER', errcode = 'P0002'; end if;
  select landmark.* into destination from public.map_landmarks landmark
    join public.locations location on location.id = landmark.location_id and location.is_active
    where landmark.id = p_landmark_id and landmark.is_available;
  if not found then raise exception using message = 'UNKNOWN_LANDMARK', errcode = 'P0002'; end if;
  if destination.min_age >= 18 and not player.is_adult then
    raise exception using message = 'AGE_RESTRICTED', errcode = '42501';
  end if;
  select jsonb_build_object(
    'landmark', jsonb_build_object('id', destination.id, 'district_id', destination.district_id,
      'location_id', destination.location_id, 'player_location_id', player.current_location_id,
      'min_age', destination.min_age,
      'name', location.name, 'description', location.description),
    'actions', coalesce((select jsonb_agg(rule.definition order by rule.sort_order, rule.id)
      from public.map_landmark_actions rule
      where rule.landmark_id = destination.id and rule.is_active), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(activity) order by activity.name)
      from public.activities activity where activity.location_id = location.id and activity.is_available), '[]'::jsonb),
    'jobs', coalesce((select jsonb_agg(to_jsonb(job) order by job.sort_order, job.name)
      from public.jobs job where job.location_id = location.id and job.is_available), '[]'::jsonb)
  ) into result
  from public.locations location where location.id = destination.location_id;
  return result;
end;
$$;

create or replace function public.perform_map_place_action(
  p_user_id uuid,
  p_landmark_id text,
  p_action_id text,
  p_request_id uuid,
  p_action_definition jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  player public.characters%rowtype;
  place public.map_landmarks%rowtype;
  location_row public.locations%rowtype;
  wallet public.wallets%rowtype;
  cached public.map_place_action_receipts%rowtype;
  action_definition jsonb;
  time_cost integer;
  mood_effect integer;
  min_money bigint;
  max_money bigint;
  money_delta bigint;
  total_minutes integer;
  action_hour integer;
  starts_at integer;
  ends_at integer;
  result jsonb;
  action_label text;
  cooldown_minutes integer;
  last_action_time integer;
  current_action_time integer;
  hunger_gain integer;
begin
  if p_user_id is null or p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  select * into player from public.characters
    where user_id = p_user_id order by created_at desc limit 1 for update;
  if not found then raise exception 'NO_CHARACTER'; end if;
  select * into cached from public.map_place_action_receipts
    where character_id = player.id and request_id = p_request_id for update;
  if found then
    if cached.landmark_id <> p_landmark_id or cached.action_id <> p_action_id then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    if cached.response is not null then return cached.response; end if;
  end if;

  select * into place from public.map_landmarks
    where id = p_landmark_id and is_available for share;
  if not found then raise exception 'UNKNOWN_LANDMARK'; end if;
  select rule.definition into action_definition
    from public.map_landmark_actions rule
    where rule.landmark_id = p_landmark_id and rule.id = p_action_id and rule.is_active;
  if not found then raise exception 'UNKNOWN_ACTION'; end if;
  select * into location_row from public.locations
    where id = place.location_id and is_active for share;
  if not found then raise exception 'UNKNOWN_LANDMARK'; end if;
  if player.current_location_id is distinct from place.location_id then raise exception 'NOT_AT_PLACE'; end if;

  starts_at := (action_definition#>>'{open_hours,start}')::integer;
  ends_at := (action_definition#>>'{open_hours,end}')::integer;
  action_hour := player.game_time_hour;
  if starts_at < 0 or starts_at > 23 or ends_at < 1 or ends_at > 24 then raise exception 'INVALID_ACTION_RULE'; end if;
  if starts_at < ends_at and not (action_hour >= starts_at and action_hour < ends_at) then raise exception 'PLACE_CLOSED'; end if;
  if starts_at > ends_at and not (action_hour >= starts_at or action_hour < ends_at) then raise exception 'PLACE_CLOSED'; end if;

  if action_definition->>'requirement' = 'Needs a market job' and not exists (
    select 1 from public.character_jobs active_job
    join public.jobs job on job.id = active_job.job_id
    where active_job.character_id = player.id and active_job.is_current
      and (job.location_id = location_row.id or job.slug ilike '%market%'
        or job.place_id in (select id from public.game_places where location_id = location_row.id))
  ) then raise exception 'REQUIREMENT_NOT_MET'; end if;
  if action_definition->>'requirement' not in ('Travel here first', 'Needs a market job') then
    raise exception 'REQUIREMENT_NOT_MET';
  end if;

  cooldown_minutes := coalesce((action_definition->>'cooldown_game_minutes')::integer, 0);
  if cooldown_minutes < 0 or cooldown_minutes > 1440 then raise exception 'INVALID_ACTION_RULE'; end if;
  if cooldown_minutes > 0 then
    current_action_time := player.game_day * 1440 + player.game_time_hour * 60 + player.game_time_minute;
    select ((response#>>'{game_time,day}')::integer * 1440)
      + ((response#>>'{game_time,hour}')::integer * 60)
      + (response#>>'{game_time,minute}')::integer
      into last_action_time
      from public.map_place_action_receipts
      where character_id = player.id and landmark_id = p_landmark_id and action_id = p_action_id
        and response is not null
      order by created_at desc limit 1;
    if last_action_time is not null and current_action_time - last_action_time < cooldown_minutes then
      raise exception 'COOLDOWN';
    end if;
  end if;

  time_cost := (action_definition->>'time_cost_minutes')::integer;
  mood_effect := (action_definition->>'mood_effect')::integer;
  hunger_gain := coalesce((action_definition#>>'{needs_effects,hunger_satisfaction}')::integer, 0);
  min_money := (action_definition#>>'{money_minor,min}')::bigint;
  max_money := (action_definition#>>'{money_minor,max}')::bigint;
  if time_cost not between 0 and 480 or mood_effect not between -20 and 20 or hunger_gain not between 0 and 50
     or min_money > max_money or min_money < -100000 or max_money > 100000 then
    raise exception 'INVALID_ACTION_RULE';
  end if;
  money_delta := min_money + floor(random() * (max_money - min_money + 1))::bigint;
  if money_delta > 0 then
    select * into wallet from public.wallets where character_id = player.id for update;
    if not found or wallet.balance < money_delta then raise exception 'INSUFFICIENT_FUNDS'; end if;
    update public.wallets set balance = balance - money_delta,
      total_expenses = total_expenses + money_delta, updated_at = now()
      where id = wallet.id returning * into wallet;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
      values (p_user_id, wallet.id, player.id, money_delta, 'expense', 'map_activity',
        coalesce(action_definition->>'label', p_action_id));
  elsif money_delta < 0 then
    select * into wallet from public.wallets where character_id = player.id for update;
    if not found then raise exception 'NO_WALLET'; end if;
    update public.wallets set balance = balance + abs(money_delta),
      total_income = total_income + abs(money_delta), updated_at = now()
      where id = wallet.id returning * into wallet;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
      values (p_user_id, wallet.id, player.id, abs(money_delta), 'income', 'map_activity',
        coalesce(action_definition->>'label', p_action_id));
  else
    select * into wallet from public.wallets where character_id = player.id for update;
  end if;

  total_minutes := player.game_time_hour * 60 + player.game_time_minute + time_cost;
  action_label := coalesce(action_definition->>'label', p_action_id);
  update public.characters set
    game_time_hour = mod(total_minutes / 60, 24),
    game_time_minute = mod(total_minutes, 60),
    game_day = game_day + total_minutes / 1440,
    game_weekday = mod(game_weekday + total_minutes / 1440, 7),
    happiness = greatest(0, least(100, happiness + mood_effect)),
    hunger = greatest(0, least(100, hunger - hunger_gain)),
    updated_at = now()
  where id = player.id returning * into player;
  result := jsonb_build_object(
    'action_id', p_action_id,
    'message', action_label || ' complete.',
    'balance', coalesce(wallet.balance, 0),
    'happiness', player.happiness,
    'hunger', player.hunger,
    'game_time', jsonb_build_object('hour', player.game_time_hour, 'minute', player.game_time_minute, 'day', player.game_day)
  );
  insert into public.map_place_action_receipts(character_id, request_id, landmark_id, action_id, response)
    values (player.id, p_request_id, p_landmark_id, p_action_id, result)
    on conflict (character_id, request_id) do update set response = excluded.response;
  return result;
end $$;

revoke all on function public.map_get_landmark_details(uuid,text) from public,anon,authenticated;
grant execute on function public.map_get_landmark_details(uuid,text) to service_role;
revoke all on function public.perform_map_place_action(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.perform_map_place_action(uuid,text,text,uuid,jsonb) to service_role;
