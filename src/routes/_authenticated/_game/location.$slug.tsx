import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer } from "react";
import { toast } from "sonner";
import { ArrowLeft, Briefcase, GraduationCap, MapPin, Store, Utensils } from "lucide-react";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { CityBillboards } from "@/components/game/CityBillboards";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Chip, ComingSoon, EmptyState, LoadingState } from "@/components/game/ui";
import { TONE_BG } from "@/components/game/CityBoard";
import { cn } from "@/lib/utils";
import { TravelPanel } from "@/components/game/TravelPanel";
import { initialTravelState, travelReducer } from "@/lib/travel-state";
import { getDrivingRoute, hasValidCoordinates } from "@/lib/route-service";

export const Route = createFileRoute("/_authenticated/_game/location/$slug")({
  head: () => pageMeta("District", "Visit a district of Osogbo."),
  component: LocationPage,
});

function LocationPage() {
  const { slug } = Route.useParams();
  const [travelState, dispatchTravel] = useReducer(travelReducer, initialTravelState);
  const queryClient = useQueryClient();
  const { data: locations, isLoading } = useQuery(q.locations());
  const { data: visits } = useQuery(q.visits());
  const { data: character } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: places } = useQuery(q.places());
  const { data: jobs } = useQuery(q.jobs());
  const { data: myJobs } = useQuery(q.myJobs());
  const { data: courses } = useQuery(q.educationCourses());
  const { data: myCourses } = useQuery(q.myCourses());
  const loc = locations?.find((l) => l.slug === slug);
  const origin = locations?.find((location) => location.id === character?.current_location_id);
  const routeOrigin = hasValidCoordinates(origin)
    ? { latitude: origin.latitude, longitude: origin.longitude }
    : null;
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
  const visit = visits?.find((v) => v.location_id === loc?.id);
  const isHere = character?.current_location_id === loc?.id;
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
          ? `Arrived in ${r.location} · −${formatNaira(r.fare)} · +10 XP`
          : `Arrived in ${r.location} · −${formatNaira(r.fare)}`,
      );
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
    dispatchTravel({ type: "reset" });
  }, [slug]);

  function selectDestination() {
    if (!loc) return;
    dispatchTravel({
      type: "select_destination",
      originId: character?.current_location_id ?? null,
      destinationId: loc.id,
      destinationName: loc.name,
      fare: loc.travel_fare,
      estimatedMinutes: loc.travel_minutes,
    });
  }

  function startTravel() {
    if (
      !loc ||
      travelState.status !== "selecting_destination" ||
      travelState.destinationId !== loc.id
    )
      return;
    dispatchTravel({ type: "start" });
    travel.mutate(loc.id);
  }

  function cancelDestination() {
    void queryClient.cancelQueries({ queryKey: routeQueryKey, exact: true });
    dispatchTravel({ type: "cancel" });
  }

  if (isLoading || !character) return <LoadingState />;
  if (!loc) return <EmptyState title="District not found" body="That place isn't on the map." />;

  return (
    <div className="-mx-3 space-y-5 px-3 py-5 md:-mx-4 md:px-4 md:py-8">
      <Link to="/map" className="inline-flex items-center gap-1 text-sm font-bold">
        <ArrowLeft className="h-4 w-4" /> Back to map
      </Link>
      <div className={cn("game-panel game-panel-accent p-6 md:p-10")}>
        <span
          className={cn(
            "inline-block rounded-lg border-2 border-edge px-3 py-1 font-display text-sm font-bold",
            TONE_BG[loc.color],
          )}
        >
          {loc.district_type}
        </span>
        <h1 className="mt-3 text-4xl font-bold md:text-5xl">{loc.name}</h1>
        <p className="mt-1 text-lg font-semibold">{loc.tagline}</p>
      </div>
      <div className="game-panel p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p>{loc.description}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {visit
                ? `Explored ${visit.visit_count} time${visit.visit_count === 1 ? "" : "s"}.`
                : "Your first visit discovers this district and awards 10 XP."}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-card px-3 py-1 text-xs font-bold">
            <MapPin className="h-3.5 w-3.5" />
            {isHere ? "You are here" : "Not your current district"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!isHere ? (
            <Button
              variant="default"
              className={travelState.status === "idle" ? undefined : "hidden"}
              onClick={selectDestination}
              disabled={travel.isPending}
            >
              Choose destination
            </Button>
          ) : (
            <Button
              variant="plain"
              onClick={() => visitAction.mutate(loc.id)}
              disabled={visitAction.isPending}
            >
              <MapPin /> {visitAction.isPending ? "Checking in…" : "Spend time here"}
            </Button>
          )}
          {isHere && loc.slug === "student-district" && (
            <Link
              to="/education"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold"
            >
              <GraduationCap className="h-4 w-4" />
              Explore technology courses
            </Link>
          )}
        </div>
        {travelState.status !== "idle" && (
          <TravelPanel
            state={travelState}
            currentBalance={wallet?.balance ?? 0}
            isPending={travel.isPending}
            isRouteLoading={routeQuery.isFetching}
            route={routeQuery.data ?? null}
            routeMessage={routeMessage}
            onSelect={selectDestination}
            onStart={startTravel}
            onCancel={cancelDestination}
            onReset={() => dispatchTravel({ type: "reset" })}
          />
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Fares and estimated travel minutes come from this district's game data. Successful
          server-confirmed travel advances the game clock by the returned journey time.
        </p>
      </div>

      {isHere && <CityBillboards locationId={loc.id} />}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">Places in {loc.name}</h2>
        </div>
        {localPlaces.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {localPlaces.map((place) => {
              const placeJobs = localJobs.filter((job) => job.place_id === place.id);
              return (
                <article key={place.id} className="game-panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Chip tone="primary">{place.category}</Chip>
                    <Chip>
                      {place.origin === "fictional"
                        ? "Fictional game business"
                        : "Real-world inspired"}
                    </Chip>
                  </div>
                  <h3 className="mt-3 text-lg font-bold">{place.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{place.description}</p>
                  {place.disclosure && (
                    <p className="mt-2 border-l-2 border-clay pl-2 text-xs text-muted-foreground">
                      {place.disclosure}
                    </p>
                  )}
                  {place.slug === "elegance-tech-hub" && (
                    <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                      <Chip>Technology training</Chip>
                      <Chip>Phones & laptops</Chip>
                      <Chip>Device repairs</Chip>
                    </div>
                  )}
                  {place.slug !== "elegance-tech-hub" && placeJobs.length > 0 && (
                    <p className="mt-3 text-xs font-semibold text-muted-foreground">
                      Hiring: {placeJobs.map((job) => job.name).join(" · ")}
                    </p>
                  )}
                  {place.meal_price !== null &&
                    (isHere ? (
                      <Button
                        className="mt-4 w-full"
                        variant="plain"
                        disabled={eat.isPending || (wallet?.balance ?? 0) < place.meal_price}
                        onClick={() => eat.mutate(place.id)}
                      >
                        <Utensils />
                        {eat.isPending
                          ? "Ordering…"
                          : (wallet?.balance ?? 0) < place.meal_price
                            ? `Need ${formatNaira(place.meal_price)}`
                            : `Eat · ${formatNaira(place.meal_price)}`}
                      </Button>
                    ) : (
                      <p className="mt-4 text-xs font-semibold text-muted-foreground">
                        Travel here to eat · {formatNaira(place.meal_price)}
                      </p>
                    ))}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="game-panel p-5">
            <p className="text-sm text-muted-foreground">
              Venue listings for this district are being added.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold">Local jobs</h2>
          </div>
          <Chip>{localJobs.length} opportunities</Chip>
        </div>
        {localJobs.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {localJobs.map((job) => {
              const isCurrentJob = currentJob?.job_id === job.id;
              const place = localPlaces.find((item) => item.id === job.place_id);
              const requiredCourse = job.required_course_slug
                ? courses?.find((course) => course.slug === job.required_course_slug)
                : undefined;
              const qualified =
                character.level >= job.required_level &&
                (!job.required_course_slug ||
                  myCourses?.some((course) => course.course_id === requiredCourse?.id));
              return (
                <article key={job.id} className="game-panel flex flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {place?.name ?? loc.name}
                      </p>
                      <h3 className="mt-1 text-lg font-bold">{job.name}</h3>
                    </div>
                    {isCurrentJob ? (
                      <Chip tone="primary">Your job</Chip>
                    ) : (
                      <Chip tone={qualified ? "leaf" : "plain"}>
                        {qualified ? "Open" : "Requirements"}
                      </Chip>
                    )}
                  </div>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{job.description}</p>
                  <p className="mt-3 text-xs font-semibold">
                    ₦{job.salary.toLocaleString("en-NG")} · {job.energy_cost} energy · +
                    {job.xp_reward} XP
                  </p>
                  {!isCurrentJob && (
                    <Button
                      className="mt-3"
                      variant="ink"
                      disabled={!isHere || !qualified || selectJob.isPending}
                      onClick={() => selectJob.mutate(job.id)}
                    >
                      {!isHere
                        ? "Travel here to apply"
                        : !qualified
                          ? requiredCourse && character.level >= job.required_level
                            ? `Complete ${requiredCourse.name}`
                            : `Reach level ${job.required_level}`
                          : selectJob.isPending
                            ? "Applying…"
                            : "Apply for job"}
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="game-panel p-5">
            <p className="text-sm text-muted-foreground">
              No jobs are listed in this district yet.
            </p>
          </div>
        )}
      </section>

      {loc.planned_features.length > 0 && (
        <div className="game-panel p-5">
          <h2 className="text-lg font-bold">More district features</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {loc.planned_features.map((feature) => (
              <li
                key={feature}
                className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border p-3"
              >
                <span className="text-sm font-semibold">{feature}</span>
                <ComingSoon />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
