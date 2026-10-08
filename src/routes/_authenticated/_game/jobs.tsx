import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Lock, MapPin, Search, Star, Zap } from "lucide-react";
import { q, rpc, formatNaira, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Chip, LoadingState, PageHeader } from "@/components/game/ui";
import { cn } from "@/lib/utils";
import {
  JOB_CATEGORIES,
  JOB_CATEGORY_LABELS,
  parseJobActivityRequirements,
  resolveJobCategory,
} from "@/lib/job-activity-model";
import { checkJobEligibility, filterJobListings } from "@/lib/job-board-service";
import { formatGameTime } from "@/lib/game-time";

export const Route = createFileRoute("/_authenticated/_game/jobs")({
  head: () => pageMeta("Jobs", "Take a job in Osogbo and work shifts to earn in-game Naira."),
  component: JobsPage,
});

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function JobsPage() {
  const now = useNow();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [workSessionOpen, setWorkSessionOpen] = useState(false);
  const { data: c } = useQuery(q.character());
  const { data: jobs, isLoading } = useQuery(q.jobs());
  const { data: myJobs } = useQuery(q.myJobs());
  const { data: locations } = useQuery(q.locations());
  const { data: places } = useQuery(q.places());
  const { data: courses } = useQuery(q.educationCourses());
  const { data: myCourses } = useQuery(q.myCourses());
  const hasSkillRequirements =
    jobs?.some(
      (job) => (parseJobActivityRequirements(job.requirements ?? {}).skills?.length ?? 0) > 0,
    ) ?? false;
  const { data: playerSkills } = useQuery({
    ...q.playerSkills(),
    enabled: !!c && hasSkillRequirements,
  });
  const select = useGameAction(rpc.selectJob, {
    onSuccess: () => toast.success("You got the job!"),
  });
  const work = useGameAction(rpc.performJob, {
    onSuccess: (r) => {
      setWorkSessionOpen(false);
      toast.success(
        `Shift done! +${formatNaira(r.earned)} · +${r.xp} XP · ${r.duration_minutes} min · ${formatGameTime(r.game_time)}`,
      );
    },
  });
  const filteredJobs = useMemo(() => {
    const searchableJobs = (jobs ?? []).map((job) => ({
      ...job,
      searchText: [
        locations?.find((location) => location.id === job.location_id)?.name,
        places?.find((place) => place.id === job.place_id)?.name,
      ]
        .filter(Boolean)
        .join(" "),
    }));
    return filterJobListings(searchableJobs, search, category);
  }, [jobs, locations, places, search, category]);

  if (isLoading || !c || !jobs) return <LoadingState />;
  const current = myJobs?.find((j) => j.is_current);
  const currentJob = jobs.find((j) => j.id === current?.job_id);
  const currentJobLocation = locations?.find((location) => location.id === currentJob?.location_id);
  const canWorkHere = !currentJob?.location_id || c.current_location_id === currentJob.location_id;
  const currentRequirement = currentJob?.required_course_slug
    ? courses?.find((course) => course.slug === currentJob.required_course_slug)
    : undefined;
  const currentCourseCompleted =
    !currentJob?.required_course_slug ||
    !!myCourses?.some((course) => course.course_id === currentRequirement?.id);
  const currentEligibility = currentJob
    ? checkJobEligibility(
        currentJob,
        { level: c.level, skills: playerSkills ?? [] },
        {
          required: !!currentJob.required_course_slug,
          completed: currentCourseCompleted,
          ...(currentRequirement?.name ? { name: currentRequirement.name } : {}),
        },
      )
    : { eligible: true, reasons: [] as string[] };
  const currentQualified = currentEligibility.eligible;
  const readyAt =
    current?.last_performed_at && currentJob
      ? new Date(current.last_performed_at).getTime() + currentJob.cooldown_minutes * 60_000
      : 0;
  const cooling = readyAt > now;

  return (
    <div>
      <PageHeader
        title="Jobs Around Osogbo"
        subtitle={`You are in ${locations?.find((location) => location.id === c.current_location_id)?.name ?? "City Centre"}. Apply and work shifts at the listed district.`}
      />

      {currentJob && (
        <Dialog open={workSessionOpen} onOpenChange={setWorkSessionOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start your shift</DialogTitle>
              <DialogDescription>
                Confirm the shift at {currentJobLocation?.name ?? "your current district"}. The game
                server will validate your job and player state before completing it.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-edge bg-card p-3">
                <p className="text-muted-foreground">Role</p>
                <p className="font-bold">{currentJob.name}</p>
              </div>
              <div className="rounded-lg border border-edge bg-card p-3">
                <p className="text-muted-foreground">Shift length</p>
                <p className="font-bold">{currentJob.duration_minutes} minutes</p>
              </div>
              <div className="rounded-lg border border-edge bg-card p-3">
                <p className="text-muted-foreground">Energy</p>
                <p className="font-bold">−{currentJob.energy_cost}</p>
              </div>
              <div className="rounded-lg border border-edge bg-card p-3">
                <p className="text-muted-foreground">Needs</p>
                <p className="font-bold">
                  Hunger +{currentJob.hunger_cost} · Thirst +{currentJob.thirst_cost}
                </p>
              </div>
              <div className="rounded-lg border border-edge bg-card p-3">
                <p className="text-muted-foreground">Expected pay · XP</p>
                <p className="font-bold">
                  {formatNaira(currentJob.salary)} · +{currentJob.xp_reward} XP
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="plain" onClick={() => setWorkSessionOpen(false)}>
                Cancel
              </Button>
              <Button disabled={work.isPending} onClick={() => work.mutate(undefined)}>
                {work.isPending ? "Completing shift…" : "Confirm and work"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {currentJob && (
        <div className="game-panel pop-in mb-6 grid gap-4 bg-sun p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Current job</p>
            <h2 className="text-3xl font-bold">{currentJob.name}</h2>
            <p className="text-sm">Shifts completed: {current?.times_performed ?? 0}</p>
          </div>
          {!canWorkHere && currentJobLocation ? (
            <Button asChild variant="default" size="lg">
              <Link to="/location/$slug" params={{ slug: currentJobLocation.slug }}>
                Travel to {currentJobLocation.name} to work
              </Link>
            </Button>
          ) : (
            <Button
              variant="default"
              size="lg"
              disabled={
                !currentQualified || cooling || work.isPending || c.energy < currentJob.energy_cost
              }
              onClick={() => setWorkSessionOpen(true)}
            >
              {!currentQualified ? (
                (currentEligibility.reasons[0] ??
                `Complete ${currentRequirement?.name ?? "required course"}`)
              ) : cooling ? (
                <>Next shift in {fmt(readyAt - now)}</>
              ) : c.energy < currentJob.energy_cost ? (
                `Need ${currentJob.energy_cost} energy`
              ) : work.isPending ? (
                "Working…"
              ) : (
                `Start shift · ${formatNaira(currentJob.salary)}`
              )}
            </Button>
          )}
        </div>
      )}

      <details className="game-panel mb-5 p-4">
        <summary className="cursor-pointer font-display font-bold">
          Find a job{" "}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            ({filteredJobs.length} available)
          </span>
        </summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="grid gap-1 text-sm font-semibold" htmlFor="job-search">
            Search jobs
            <span className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="job-search"
                type="search"
                className="w-full rounded-lg border-2 border-edge bg-background py-2 pl-9 pr-3 font-normal"
                placeholder="Role, business, or district"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
          </label>
          <label className="grid gap-1 text-sm font-semibold" htmlFor="job-category">
            Category
            <select
              id="job-category"
              className="w-full rounded-lg border-2 border-edge bg-background px-3 py-2 font-normal"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">All categories</option>
              {JOB_CATEGORIES.map((jobCategory) => (
                <option key={jobCategory} value={jobCategory}>
                  {JOB_CATEGORY_LABELS[jobCategory]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredJobs.map((j) => {
          const requiredCourse = j.required_course_slug
            ? courses?.find((course) => course.slug === j.required_course_slug)
            : undefined;
          const hasCourse =
            !j.required_course_slug ||
            !!myCourses?.some((course) => course.course_id === requiredCourse?.id);
          const jobLocation = locations?.find((location) => location.id === j.location_id);
          const workplace = places?.find((place) => place.id === j.place_id);
          const isAtLocation = !j.location_id || c.current_location_id === j.location_id;
          const eligibility = checkJobEligibility(
            j,
            { level: c.level, skills: playerSkills ?? [] },
            {
              required: !!j.required_course_slug,
              completed: hasCourse,
              ...(requiredCourse?.name ? { name: requiredCourse.name } : {}),
            },
          );
          const locked = !eligibility.eligible;
          const isCurrent = j.id === currentJob?.id;
          const dream = c.occupation_preference === j.slug;
          const jobCategory = resolveJobCategory(j.category, j.slug, j.name);
          const durationMinutes =
            Number.isInteger(j.duration_minutes) && j.duration_minutes > 0
              ? j.duration_minutes
              : 30;
          return (
            <div key={j.id} className={cn("game-panel flex flex-col p-5", locked && "opacity-75")}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {workplace?.name ?? "City-wide"} · {jobLocation?.name ?? "Osogbo"}
                  </p>
                  <h3 className="mt-1 text-xl font-bold">{j.name}</h3>
                  <span className="mt-2 inline-flex">
                    <Chip>{JOB_CATEGORY_LABELS[jobCategory]}</Chip>
                  </span>
                </div>
                {isCurrent ? (
                  <Chip tone="primary">Current</Chip>
                ) : locked ? (
                  <Chip>
                    <Lock className="h-3 w-3" /> Locked
                  </Chip>
                ) : (
                  <Chip tone="leaf">Open</Chip>
                )}
              </div>
              {dream && (
                <p className="mt-1 flex items-center gap-1 text-xs font-bold text-clay">
                  <Star className="h-3 w-3" /> Your dream job
                </p>
              )}
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{j.description}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border-2 border-edge bg-primary p-2 text-primary-foreground">
                  <dt className="font-semibold">Pay</dt>
                  <dd className="font-display text-sm font-bold">{formatNaira(j.salary)}</dd>
                </div>
                <div className="rounded-lg border-2 border-edge bg-sun p-2">
                  <dt className="flex items-center justify-center gap-0.5 font-semibold">
                    <Zap className="h-3 w-3" />
                    Energy
                  </dt>
                  <dd className="font-display text-sm font-bold">{j.energy_cost}</dd>
                </div>
                <div className="rounded-lg border-2 border-edge bg-card p-2">
                  <dt className="flex items-center justify-center gap-0.5 font-semibold">
                    <Clock className="h-3 w-3" />
                    Shift
                  </dt>
                  <dd className="font-display text-sm font-bold">{durationMinutes}m</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">
                +{j.xp_reward} XP · boosts {j.stat_bonus} & career
              </p>
              <div className="mt-3 rounded-lg border border-border bg-muted/60 p-3 text-xs">
                <p className="font-bold">Requirements</p>
                {eligibility.reasons.length ? (
                  <ul className="mt-1 list-inside list-disc text-clay">
                    {eligibility.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-muted-foreground">You meet this job’s requirements.</p>
                )}
              </div>
              {!isCurrent &&
                (!isAtLocation && jobLocation ? (
                  <Button asChild variant="plain" className="mt-4">
                    <Link to="/location/$slug" params={{ slug: jobLocation.slug }}>
                      Travel here to apply
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant={locked ? "plain" : "ink"}
                    className="mt-4"
                    disabled={locked || select.isPending}
                    onClick={() => select.mutate(j.id)}
                  >
                    {locked
                      ? (eligibility.reasons[0] ?? "Requirements not met")
                      : currentJob
                        ? "Switch to this job"
                        : "Take this job"}
                  </Button>
                ))}
            </div>
          );
        })}
      </div>
      {filteredJobs.length === 0 && (
        <div className="game-panel mt-4 p-6 text-center">
          <p className="font-display text-lg font-bold">No jobs match those filters</p>
          <p className="mt-1 text-sm text-muted-foreground">Try another category or search term.</p>
          <Button
            className="mt-3"
            variant="plain"
            onClick={() => {
              setSearch("");
              setCategory("all");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
