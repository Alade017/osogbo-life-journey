import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { toast } from "sonner";
import { GraduationCap, MapPin, Utensils } from "lucide-react";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { isPlayableDistrict } from "@/game/playable-district";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingState } from "@/components/game/ui";
import { TravelPanel } from "@/components/game/TravelPanel";
import { clearPendingDepartureFromHome, requestDepartureFromHome } from "@/lib/home-departure";
import { hasConfirmedHomeDeparture } from "@/lib/home-departure-query";
import { initialTravelState, travelReducer } from "@/lib/travel-state";
import { getDrivingRoute, hasValidCoordinates } from "@/lib/route-service";
import { checkJobEligibility } from "@/lib/job-board-service";
import { parseJobActivityRequirements } from "@/lib/job-activity-model";
import {
  estimateTrip,
  getAvailableTravelModes,
  travelAnimationDurationMs,
  validateTripRequest,
} from "@/lib/transport-service";
import { useWorldClock } from "@/hooks/use-world-clock";
import { INITIAL_GAME_TIME } from "@/lib/game-time";
import { CityEventParticipation } from "@/components/game/CityEventParticipation";
import { LocationActivities } from "@/components/game/LocationActivities";
import { PartyVenuePanel } from "@/components/game/PartyVenuePanel";
import { LocationVenueScene } from "@/components/game/LocationVenueScene";
import {
  adjustedTripMinutes,
  travelConditionAdjustment,
  weatherForDay,
} from "@/lib/world-simulation";
import { hasAuthoritativeLocationArrival } from "@/lib/location-venue-designs";

export const Route = createFileRoute("/_authenticated/_game/location/$slug")({
  head: () => pageMeta("District", "Visit a district of Osogbo."),
  component: LocationPage,
});

function LocationPage() {
  const navigate = useNavigate();
  const { data: worldTime } = useWorldClock();
  const gameTime = worldTime ?? INITIAL_GAME_TIME;
  const weather = weatherForDay(gameTime.day);
  const { slug } = Route.useParams();
  const [travelState, dispatchTravel] = useReducer(travelReducer, initialTravelState);
  const travelStartTimer = useRef<number | null>(null);
  const travelPreflight = useRef<object | null>(null);
  const queryClient = useQueryClient();
  const { data: locations, isLoading } = useQuery(q.locations());
  const { data: character } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: places } = useQuery(q.places());
  const { data: jobs } = useQuery(q.jobs());
  const { data: myJobs } = useQuery(q.myJobs());
  const { data: courses } = useQuery(q.educationCourses());
  const { data: myCourses } = useQuery(q.myCourses());
  const hasSkillRequirements =
    jobs?.some(
      (job) => (parseJobActivityRequirements(job.requirements ?? {}).skills?.length ?? 0) > 0,
    ) ?? false;
  const { data: playerSkills } = useQuery({
    ...q.playerSkills(),
    enabled: !!character && hasSkillRequirements,
  });
  const loc = locations?.find((l) => l.slug === slug);
  const availableModes = useMemo(() => (loc ? getAvailableTravelModes(loc.metadata) : []), [loc]);
  const origin = locations?.find((location) => location.id === character?.current_location_id);
  const savedPlayerCoordinates =
    character &&
    hasValidCoordinates({
      latitude: character.virtual_latitude,
      longitude: character.virtual_longitude,
    })
      ? { latitude: character.virtual_latitude, longitude: character.virtual_longitude }
      : null;
  const routeOrigin =
    savedPlayerCoordinates ??
    (hasValidCoordinates(origin)
      ? { latitude: origin.latitude, longitude: origin.longitude }
      : null);
  const routeDestination = hasValidCoordinates(loc)
    ? { latitude: loc.latitude, longitude: loc.longitude }
    : null;
  const routeQueryKey = [
    "travelRoute",
    origin?.id,
    loc?.id,
    routeOrigin?.latitude,
    routeOrigin?.longitude,
    routeDestination?.latitude,
    routeDestination?.longitude,
  ] as const;
  const routeQuery = useQuery({
    queryKey: routeQueryKey,
    queryFn: ({ signal }) => {
      if (!routeOrigin || !routeDestination) throw new Error("Mapped coordinates are required.");
      return getDrivingRoute(routeOrigin, routeDestination, signal);
    },
    enabled:
      travelState.status === "selecting_destination" &&
      routeOrigin !== null &&
      routeDestination !== null,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const routeMessage =
    routeQuery.data !== undefined
      ? null
      : !routeOrigin || !routeDestination
        ? "A street route needs mapped coordinates for your current district and destination. The saved travel-time estimate is shown."
        : routeQuery.isFetching
          ? "Calculating a street route…"
          : routeQuery.isError
            ? "A street route could not be calculated. The saved travel-time estimate is shown."
            : null;
  const conditions = travelConditionAdjustment(travelState.mode, gameTime, weather);
  const travelMessage = [routeMessage, conditions.explanation].filter(Boolean).join(" ") || null;
  const isHere = hasAuthoritativeLocationArrival(character?.current_location_id, loc?.id);
  const meetsLevelRequirement = !!character && !!loc && character.level >= loc.level_required;
  const localPlaces = places?.filter((place) => place.location_id === loc?.id) ?? [];
  const localJobs = jobs?.filter((job) => job.location_id === loc?.id && job.is_available) ?? [];
  const currentJob = myJobs?.find((job) => job.is_current);
  const visitAction = useGameAction(rpc.visitLocation, {
    onSuccess: (r) =>
      toast.success(
        r.first_visit ? `Discovered ${loc?.name}! +10 XP` : `You spent time in ${loc?.name}.`,
      ),
  });
  const travel = useGameAction(rpc.travelToLocation, {
    onSuccess: (r) => {
      dispatchTravel({ type: "arrive", estimatedMinutes: r.travel_minutes });
      const gameTime = r.game_time;
      if (gameTime) {
        queryClient.setQueryData(q.character().queryKey, (current) =>
          current
            ? {
                ...current,
                game_time_minute: gameTime.minute,
                game_time_hour: gameTime.hour,
                game_day: gameTime.day,
                game_weekday: gameTime.weekday,
              }
            : current,
        );
      }
      toast.success(
        r.first_visit
          ? `Arrived in ${r.location} · ${r.mode} · −${formatNaira(r.fare)} · +10 XP`
          : `Arrived in ${r.location} · ${r.mode} · −${formatNaira(r.fare)}`,
      );
      if (loc?.type === "bank") {
        void navigate({ to: "/bank/$slug", params: { slug: loc.slug } });
      }
    },
    onError: (error) => dispatchTravel({ type: "fail", message: error.message }),
  });
  const selectJob = useGameAction(rpc.selectJob, {
    onSuccess: () => toast.success("You got the job!"),
  });
  const eat = useGameAction(rpc.eatAtPlace, {
    onSuccess: (result) =>
      toast.success(
        `${result.venue} · −${formatNaira(result.cost)} · Hunger −${result.hunger_restored} · Happiness +${result.happiness_gained}`,
      ),
  });

  useEffect(() => {
    if (travelStartTimer.current !== null) window.clearTimeout(travelStartTimer.current);
    travelStartTimer.current = null;
    travelPreflight.current = null;
    dispatchTravel({ type: "reset" });
  }, [slug]);

  useEffect(
    () => () => {
      travelPreflight.current = null;
      if (travelStartTimer.current !== null) window.clearTimeout(travelStartTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!loc || !character || loc.type !== "bank" || isHere || travelState.status !== "idle")
      return;
    const mode = availableModes.includes("danfo") ? "danfo" : availableModes[0];
    if (!mode) return;
    const estimate = estimateTrip(mode, loc.travel_fare, loc.travel_minutes);
    dispatchTravel({
      type: "select_destination",
      originId: character?.current_location_id ?? null,
      destinationId: loc.id,
      destinationName: loc.name,
      fare: estimate.fare,
      estimatedMinutes: adjustedTripMinutes(estimate.minutes, mode, gameTime),
      mode,
    });
  }, [
    availableModes,
    character,
    character?.current_location_id,
    gameTime,
    isHere,
    loc,
    travelState.status,
  ]);

  function selectDestination() {
    travelPreflight.current = null;
    if (!loc) return;
    const mode = availableModes.includes("danfo") ? "danfo" : availableModes[0];
    if (!mode) return;
    const estimate = estimateTrip(mode, loc.travel_fare, loc.travel_minutes);
    dispatchTravel({
      type: "select_destination",
      originId: character?.current_location_id ?? null,
      destinationId: loc.id,
      destinationName: loc.name,
      fare: estimate.fare,
      estimatedMinutes: adjustedTripMinutes(estimate.minutes, mode, gameTime),
      mode,
    });
  }

  async function startTravel() {
    if (
      travelPreflight.current !== null ||
      travelStartTimer.current !== null ||
      !loc ||
      travelState.status !== "selecting_destination" ||
      travelState.destinationId !== loc.id
    )
      return;
    const validationError = validateTripRequest({
      destinationId: loc.id,
      currentLocationId: character?.current_location_id ?? null,
      mode: travelState.mode,
      availableModes,
      balance: Number(wallet?.balance ?? 0),
      fare: travelState.fare ?? 0,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }
    const check = {};
    travelPreflight.current = check;
    let departing = false;
    try {
      departing = !!character && (await hasConfirmedHomeDeparture(queryClient, character));
    } catch {
      if (travelPreflight.current === check)
        toast.error("Your home status could not be checked. Try again; travel has not started.");
      if (travelPreflight.current === check) travelPreflight.current = null;
      return;
    }
    if (travelPreflight.current !== check) return;
    travelPreflight.current = null;
    if (departing) {
      const departure = requestDepartureFromHome({ locationId: loc.id, mode: travelState.mode });
      void navigate({ to: "/house" }).catch(() => clearPendingDepartureFromHome(departure));
      return;
    }
    dispatchTravel({ type: "start" });
    travelStartTimer.current = window.setTimeout(
      () => {
        travelStartTimer.current = null;
        travel.mutate({ locationId: loc.id, mode: travelState.mode });
      },
      travelAnimationDurationMs(travelState.estimatedMinutes ?? 1),
    );
  }

  function changeTravelMode(mode: (typeof availableModes)[number]) {
    travelPreflight.current = null;
    if (!loc) return;
    const estimate = estimateTrip(mode, loc.travel_fare, loc.travel_minutes);
    dispatchTravel({
      type: "set_mode",
      mode,
      fare: estimate.fare,
      estimatedMinutes: adjustedTripMinutes(estimate.minutes, mode, gameTime),
    });
  }

  function cancelDestination() {
    travelPreflight.current = null;
    void queryClient.cancelQueries({ queryKey: routeQueryKey, exact: true });
    dispatchTravel({ type: "cancel" });
  }

  if (isLoading || !character) return <LoadingState />;
  if (!loc) return <EmptyState title="District not found" body="That place isn't on the map." />;

  // Once the visitor is inside a walkable venue, go straight to the scene: no preview cards.
  if (isHere && loc.slug === "osun-mall") {
    return (
      <div className="-mx-3 px-3 md:-mx-4 md:px-4">
        <LocationVenueScene
          key={loc.id}
          slug={loc.slug}
          locationName={loc.name}
          locationId={loc.id}
        />
      </div>
    );
  }

  const jobOptions = localJobs
    .filter((job) => currentJob?.job_id !== job.id)
    .map((job) => {
      const requiredCourse = job.required_course_slug
        ? courses?.find((course) => course.slug === job.required_course_slug)
        : undefined;
      const courseCompleted =
        !job.required_course_slug ||
        !!myCourses?.some((course) => course.course_id === requiredCourse?.id);
      const eligibility = checkJobEligibility(
        job,
        { level: character.level, skills: playerSkills ?? [] },
        {
          required: !!job.required_course_slug,
          completed: courseCompleted,
          ...(requiredCourse?.name ? { name: requiredCourse.name } : {}),
        },
      );
      return { job, eligibility };
    });
  const hasBankService = localPlaces.some((place) => ["bank", "atm"].includes(place.category));
  const hasShops = localPlaces.some((place) =>
    ["market", "supermarket", "food-market", "electronics", "phone-store", "clothing"].includes(
      place.category,
    ),
  );

  return (
    <div className="-mx-3 space-y-4 px-3 py-4 md:-mx-4 md:px-4">
      <h1 className="sr-only">{loc.name}</h1>
      {isHere ? (
        <LocationVenueScene
          key={loc.id}
          slug={loc.slug}
          locationName={loc.name}
          locationId={loc.id}
        />
      ) : (
        <section className="game-panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-lg font-bold">{loc.name}</p>
            <p className="text-sm text-muted-foreground">{loc.tagline}</p>
          </div>
          {!meetsLevelRequirement ? (
            <p className="travel-state-error" role="status">
              Reach level {loc.level_required} to unlock this destination.
            </p>
          ) : availableModes.length === 0 ? (
            <p className="travel-state-error" role="status">
              Travel options have not been configured for this destination yet.
            </p>
          ) : (
            <Button
              variant="default"
              className={travelState.status === "idle" ? undefined : "hidden"}
              onClick={selectDestination}
              disabled={travel.isPending}
            >
              Choose destination
            </Button>
          )}
        </section>
      )}

      {travelState.status !== "idle" && (
        <TravelPanel
          state={travelState}
          currentBalance={wallet?.balance ?? 0}
          originName={origin?.name ?? "Current player position"}
          isPending={travel.isPending}
          isRouteLoading={routeQuery.isFetching}
          route={routeQuery.data ?? null}
          routeMessage={travelMessage}
          onSelect={selectDestination}
          availableModes={availableModes}
          onModeChange={changeTravelMode}
          onStart={startTravel}
          onCancel={cancelDestination}
          onReset={() => {
            travelPreflight.current = null;
            dispatchTravel({ type: "reset" });
          }}
        />
      )}

      {isHere && (
        <nav aria-label={`${loc.name} actions`} className="flex flex-wrap gap-2">
          {loc.type !== "bank" && (
            <Button
              variant="plain"
              onClick={() => visitAction.mutate(loc.id)}
              disabled={visitAction.isPending}
            >
              <MapPin /> {visitAction.isPending ? "Checking in…" : "Spend time here"}
            </Button>
          )}
          {hasBankService && (
            <Button asChild variant="plain">
              <Link to="/bank/$slug" params={{ slug }}>
                Enter bank lobby
              </Link>
            </Button>
          )}
          {hasShops && (
            <Button asChild variant="plain">
              <Link to="/market">Browse local shops</Link>
            </Button>
          )}
          {loc.slug === "student-district" && (
            <Button asChild variant="plain">
              <Link to="/education">
                <GraduationCap /> Explore technology courses
              </Link>
            </Button>
          )}
          {isPlayableDistrict(loc.slug) && (
            <Button asChild variant="plain">
              <Link to="/neighborhood">
                Walk{" "}
                {loc.slug === "city-centre"
                  ? "Olaiya"
                  : loc.slug === "oja-oba"
                    ? "Oja-Oba Market"
                    : loc.name}
              </Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/social" search={{ playerId: undefined }}>
              Meet neighbours
            </Link>
          </Button>
          {localPlaces
            .filter((place) => place.meal_price !== null)
            .map((place) => {
              const price = place.meal_price ?? 0;
              return (
                <Button
                  key={place.id}
                  variant="plain"
                  disabled={eat.isPending || (wallet?.balance ?? 0) < price}
                  onClick={() => eat.mutate(place.id)}
                >
                  <Utensils />
                  {eat.isPending
                    ? "Ordering…"
                    : (wallet?.balance ?? 0) < price
                      ? `Need ${formatNaira(price)}`
                      : `Eat at ${place.name} · ${formatNaira(price)}`}
                </Button>
              );
            })}
          {jobOptions.map(({ job, eligibility }) => (
            <Button
              key={job.id}
              variant="ink"
              disabled={!eligibility.eligible || selectJob.isPending}
              onClick={() => selectJob.mutate(job.id)}
            >
              {!eligibility.eligible
                ? (eligibility.reasons[0] ?? "Requirements not met")
                : selectJob.isPending
                  ? "Applying…"
                  : `Apply: ${job.name}`}
            </Button>
          ))}
        </nav>
      )}

      {loc.type !== "bank" && (
        <LocationActivities locationId={loc.id} slug={slug} isHere={isHere} />
      )}
      <CityEventParticipation slug={slug} isHere={isHere} />
      <PartyVenuePanel locationId={loc.id} />
    </div>
  );
}
