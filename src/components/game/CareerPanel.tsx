import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BriefcaseBusiness, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { q, rpc, formatNaira, useGameAction } from "@/lib/game";
import { canPromoteCareer, isCareerJob, nextCareerStep } from "@/lib/career-rules";
import {
  cancelCareerShift,
  claimCareerShift,
  completeCareerStep,
  leaveCareer,
  loadCareerCatalog,
  loadCareerShifts,
  promoteCareer,
  startCareerShift,
} from "@/lib/career-service";

export function CareerPanel() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const { data: character } = useQuery(q.character());
  const { data: jobs } = useQuery(q.jobs());
  const { data: myJobs } = useQuery(q.myJobs());
  const { data: locations } = useQuery(q.locations());
  const { data: skills } = useQuery(q.playerSkills());
  const catalog = useQuery({
    queryKey: ["careerCatalog"],
    queryFn: loadCareerCatalog,
    retry: false,
  });
  const history = useQuery({ queryKey: ["careerShifts"], queryFn: loadCareerShifts, retry: false });
  const apply = useGameAction(rpc.selectJob, {
    onSuccess: () => toast.success("Career application accepted"),
  });
  const start = useGameAction(startCareerShift, {
    onSuccess: () => toast.success("Shift started"),
  });
  const step = useGameAction(completeCareerStep, {
    onSuccess: () => toast.success("Work step complete"),
  });
  const claim = useGameAction(claimCareerShift, {
    onSuccess: (response) =>
      toast.success(
        response.duplicate
          ? "Shift already paid"
          : `Shift complete · ${formatNaira(response.earned)} paid`,
      ),
  });
  const cancel = useGameAction(cancelCareerShift, {
    onSuccess: () => toast.success("Shift cancelled; no pay was awarded"),
  });
  const promote = useGameAction(promoteCareer, {
    onSuccess: (response) => toast.success(`Promoted to ${response.title}`),
  });
  const leave = useGameAction(leaveCareer, {
    onSuccess: () => toast.success("You left your career"),
  });

  if (catalog.isLoading || history.isLoading)
    return <section className="game-panel mb-5 p-4">Loading career paths…</section>;
  if (catalog.isError || history.isError)
    return (
      <section className="game-panel mb-5 p-4" role="alert">
        <h2 className="font-display text-lg font-bold">Careers are unavailable</h2>
        <p className="text-sm text-muted-foreground">
          Your existing jobs are still available. Retry when the career service is ready.
        </p>
        <Button
          variant="plain"
          className="mt-2"
          onClick={() => {
            void catalog.refetch();
            void history.refetch();
          }}
        >
          Retry careers
        </Button>
      </section>
    );
  if (!catalog.data || !history.data || !character || !jobs) return null;

  const currentEmployment = myJobs?.find((entry) => entry.is_current);
  const currentJob = jobs.find((entry) => entry.id === currentEmployment?.job_id);
  const activeCareer = currentJob && isCareerJob(currentJob.slug) ? currentJob : null;
  const careerJobs = jobs.filter((job) => isCareerJob(job.slug) && job.is_available);
  const activeShift = history.data.find((shift) => shift.status === "active");
  const currentPath = activeCareer?.slug.includes("retail") ? "retail" : "banking";
  const rank = catalog.data.ranks.find(
    (item) => item.path_slug === currentPath && item.level === currentEmployment?.career_level,
  );
  const nextRank = catalog.data.ranks.find(
    (item) =>
      item.path_slug === currentPath && item.level === (currentEmployment?.career_level ?? 0) + 1,
  );
  const skillLevel =
    skills?.find((item) => item.skill_slug === activeCareer?.skill_reward_slug)?.level ?? 0;
  const promotionReady =
    !!currentEmployment &&
    canPromoteCareer(
      currentEmployment.career_level,
      currentEmployment.times_performed,
      skillLevel,
      nextRank,
    );
  const pending =
    apply.isPending ||
    start.isPending ||
    step.isPending ||
    claim.isPending ||
    cancel.isPending ||
    promote.isPending ||
    leave.isPending;

  return (
    <section className="game-panel mb-5 space-y-4 p-4" aria-labelledby="career-title">
      <div>
        <p className="jobs-eyebrow">BUILD YOUR FUTURE</p>
        <h2 id="career-title" className="font-display text-xl font-bold">
          Career paths
        </h2>
        <p className="text-sm text-muted-foreground">
          Apply at a workplace, complete three steps per shift, then claim your pay.
        </p>
      </div>

      {activeCareer && currentEmployment && rank && (
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Your career · Level {rank.level}/3
              </p>
              <h3 className="font-display text-lg font-bold">{rank.title}</h3>
              <p className="text-sm">
                {activeCareer.name} · {formatNaira(rank.salary)} per completed shift
              </p>
              <p className="text-xs text-muted-foreground">
                {currentEmployment.times_performed} completed shifts · {skillLevel}{" "}
                {activeCareer.skill_reward_slug.replaceAll("_", " ")} skill
              </p>
            </div>
            <Button
              variant="plain"
              disabled={pending || !!activeShift}
              onClick={() => leave.mutate(undefined)}
            >
              Leave career
            </Button>
          </div>
          {nextRank && (
            <div className="text-sm">
              <p>
                Next: <strong>{nextRank.title}</strong> · {formatNaira(nextRank.salary)}/shift
              </p>
              <p className="text-muted-foreground">
                Requires {nextRank.required_shifts} completed shifts and level{" "}
                {nextRank.required_skill_level}{" "}
                {activeCareer.skill_reward_slug.replaceAll("_", " ")}.
              </p>
              <Button
                variant="plain"
                className="mt-2"
                disabled={!promotionReady || pending || !!activeShift}
                onClick={() => promote.mutate(undefined)}
              >
                {promote.isPending ? "Promoting…" : "Claim promotion"}
              </Button>
              {activeShift && (
                <p className="mt-2 text-muted-foreground">
                  Finish or cancel your active shift before promotion.
                </p>
              )}
            </div>
          )}
          {activeShift ? (
            <div className="space-y-3 rounded-xl border border-border bg-card p-3">
              <p className="font-bold">Shift in progress · {activeShift.step_count}/3 steps</p>
              <ol className="space-y-2">
                {rank.steps.map((label, index) => (
                  <li key={label} className="flex items-center gap-2 text-sm">
                    <span
                      aria-hidden="true"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted font-bold"
                    >
                      {index < activeShift.step_count ? "✓" : index + 1}
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ol>
              {nextCareerStep(activeShift.step_count) ? (
                <Button
                  disabled={
                    pending ||
                    character.current_location_id !== activeShift.location_id ||
                    now < new Date(activeShift.next_step_at).getTime()
                  }
                  onClick={() =>
                    step.mutate({ shiftId: activeShift.id, step: activeShift.step_count + 1 })
                  }
                >
                  {step.isPending ? "Saving…" : `Complete step ${activeShift.step_count + 1}`}
                </Button>
              ) : (
                <Button
                  disabled={
                    pending ||
                    character.current_location_id !== activeShift.location_id ||
                    now < new Date(activeShift.next_step_at).getTime()
                  }
                  onClick={() => claim.mutate(activeShift.id)}
                >
                  {claim.isPending ? "Confirming pay…" : "Finish shift and claim pay"}
                </Button>
              )}
              {character.current_location_id !== activeShift.location_id && (
                <p className="text-sm text-clay">Return to your workplace to continue.</p>
              )}
              {now < new Date(activeShift.next_step_at).getTime() && (
                <p className="text-xs text-muted-foreground">
                  The next step becomes ready shortly.
                </p>
              )}
              <Button
                variant="plain"
                disabled={pending}
                onClick={() => cancel.mutate(activeShift.id)}
              >
                Cancel shift
              </Button>
            </div>
          ) : (
            <Button
              disabled={pending || character.current_location_id !== activeCareer.location_id}
              onClick={() => start.mutate(undefined)}
            >
              {start.isPending ? "Starting…" : "Start career shift"}
            </Button>
          )}
          {character.current_location_id !== activeCareer.location_id && (
            <Link
              className="block text-sm font-semibold underline"
              to="/location/$slug"
              params={{
                slug:
                  locations?.find((item) => item.id === activeCareer.location_id)?.slug ??
                  "city-centre",
              }}
            >
              Travel to your workplace
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {careerJobs.map((job) => {
          const pathSlug = job.slug.includes("retail") ? "retail" : "banking";
          const path = catalog.data.paths.find((item) => item.slug === pathSlug);
          const entry = catalog.data.ranks.find(
            (item) => item.path_slug === pathSlug && item.level === 1,
          );
          const location = locations?.find((item) => item.id === job.location_id);
          const here = character.current_location_id === job.location_id;
          const alreadyEmployed = !!activeCareer && activeCareer.id !== job.id;
          return (
            <article
              key={job.id}
              className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-3"
            >
              <p className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                <MapPin size={13} /> {location?.name ?? "Workplace"}
              </p>
              <h3 className="flex items-center gap-2 font-display font-bold">
                <BriefcaseBusiness size={17} /> {path?.name ?? job.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {path?.description ?? job.description}
              </p>
              <p className="text-sm">
                <strong>{entry?.title}</strong> · {formatNaira(entry?.salary)}/shift · 3 ranks
              </p>
              {activeCareer?.id === job.id ? (
                <p className="text-sm font-bold">Your current workplace</p>
              ) : !here && location ? (
                <Button asChild variant="plain" className="w-full">
                  <Link to="/location/$slug" params={{ slug: location.slug }}>
                    Travel here to apply
                  </Link>
                </Button>
              ) : (
                <Button
                  className="w-full"
                  disabled={pending || alreadyEmployed || character.level < job.required_level}
                  onClick={() => apply.mutate(job.id)}
                >
                  {alreadyEmployed
                    ? "Leave current career first"
                    : character.level < job.required_level
                      ? `Requires level ${job.required_level}`
                      : apply.isPending
                        ? "Applying…"
                        : "Apply for career"}
                </Button>
              )}
            </article>
          );
        })}
      </div>
      <section className="text-sm">
        <h3 className="font-semibold">Shift history</h3>
        {history.data.filter((shift) => shift.status === "completed").length === 0 ? (
          <p className="mt-2 text-muted-foreground">No completed career shifts yet.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {history.data
              .filter((shift) => shift.status === "completed")
              .map((shift) => (
                <li
                  key={shift.id}
                  className="flex justify-between gap-2 border-b border-border py-1"
                >
                  <span>
                    {shift.path_slug} · Level {shift.rank_level}
                  </span>
                  <strong>{formatNaira(shift.paid_amount)}</strong>
                </li>
              ))}
          </ul>
        )}
      </section>
    </section>
  );
}
