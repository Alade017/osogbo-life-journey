import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Lock, Star, Zap } from "lucide-react";
import { q, rpc, formatNaira, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { Chip, LoadingBricks, PageHeader } from "@/components/game/ui";
import { cn } from "@/lib/utils";

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
  const { data: c } = useQuery(q.character());
  const { data: jobs, isLoading } = useQuery(q.jobs());
  const { data: myJobs } = useQuery(q.myJobs());
  const { data: courses } = useQuery(q.educationCourses());
  const { data: myCourses } = useQuery(q.myCourses());
  const select = useGameAction(rpc.selectJob, { onSuccess: () => toast.success("You got the job!") });
  const work = useGameAction(rpc.performJob, {
    onSuccess: (r) => toast.success(`Shift done! +${formatNaira(r.earned)} · +${r.xp} XP`),
  });

  if (isLoading || !c || !jobs) return <LoadingBricks />;
  const current = myJobs?.find((j) => j.is_current);
  const currentJob = jobs.find((j) => j.id === current?.job_id);
  const currentRequirement = currentJob?.required_course_slug
    ? courses?.find((course) => course.slug === currentJob.required_course_slug)
    : undefined;
  const currentQualified = !currentJob?.required_course_slug ||
    myCourses?.some((course) => course.course_id === currentRequirement?.id);
  const readyAt = current?.last_performed_at && currentJob
    ? new Date(current.last_performed_at).getTime() + currentJob.cooldown_minutes * 60_000
    : 0;
  const cooling = readyAt > now;

  return (
    <div>
      <PageHeader title="Jobs Board" subtitle="Pay is in-game Naira. Energy regenerates 1 point every 2 minutes." />

      {currentJob && (
        <div className="brick pop-in mb-6 grid gap-4 bg-sun p-5 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider">Current job</p>
            <h2 className="text-3xl font-bold">{currentJob.name}</h2>
            <p className="text-sm">Shifts completed: {current?.times_performed ?? 0}</p>
          </div>
          <Button variant="brick" size="lg" disabled={!currentQualified || cooling || work.isPending || c.energy < currentJob.energy_cost} onClick={() => work.mutate(undefined)}>
            {!currentQualified ? `Complete ${currentRequirement?.name ?? "required course"}` : cooling ? <>Next shift in {fmt(readyAt - now)}</> : c.energy < currentJob.energy_cost ? `Need ${currentJob.energy_cost} energy` : work.isPending ? "Working…" : `Work shift · ${formatNaira(currentJob.salary)}`}
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((j) => {
          const requiredCourse = j.required_course_slug
            ? courses?.find((course) => course.slug === j.required_course_slug)
            : undefined;
          const hasCourse = !j.required_course_slug ||
            myCourses?.some((course) => course.course_id === requiredCourse?.id);
          const locked = c.level < j.required_level || !hasCourse;
          const lockReason = c.level < j.required_level
            ? `Reach level ${j.required_level}`
            : `Complete ${requiredCourse?.name ?? "required course"}`;
          const isCurrent = j.id === currentJob?.id;
          const dream = c.occupation_preference === j.slug;
          return (
            <div key={j.id} className={cn("brick flex flex-col p-5", locked && "opacity-75")}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xl font-bold">{j.name}</h3>
                {isCurrent ? <Chip tone="primary">Current</Chip> : locked ? <Chip><Lock className="h-3 w-3" /> {c.level < j.required_level ? `Lv ${j.required_level}` : "Course"}</Chip> : <Chip tone="leaf">Open</Chip>}
              </div>
              {dream && <p className="mt-1 flex items-center gap-1 text-xs font-bold text-clay"><Star className="h-3 w-3" /> Your dream job</p>}
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{j.description}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg border-2 border-edge bg-primary p-2 text-primary-foreground"><dt className="font-semibold">Pay</dt><dd className="font-display text-sm font-bold">{formatNaira(j.salary)}</dd></div>
                <div className="rounded-lg border-2 border-edge bg-sun p-2"><dt className="flex items-center justify-center gap-0.5 font-semibold"><Zap className="h-3 w-3" />Energy</dt><dd className="font-display text-sm font-bold">{j.energy_cost}</dd></div>
                <div className="rounded-lg border-2 border-edge bg-card p-2"><dt className="flex items-center justify-center gap-0.5 font-semibold"><Clock className="h-3 w-3" />Cooldown</dt><dd className="font-display text-sm font-bold">{j.cooldown_minutes}m</dd></div>
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">+{j.xp_reward} XP · boosts {j.stat_bonus} & career</p>
              {!isCurrent && (
                <Button variant={locked ? "plain" : "ink"} className="mt-4" disabled={locked || select.isPending} onClick={() => select.mutate(j.id)}>
                  {locked ? lockReason : currentJob ? "Switch to this job" : "Take this job"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
