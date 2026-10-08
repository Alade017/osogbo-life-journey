import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, GraduationCap, Lock, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Chip, LoadingState, PageHeader } from "@/components/game/ui";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/_game/education")({
  head: () => pageMeta("Education", "Study at Osun Tech Hub and State Polytechnic."),
  component: EducationPage,
});

function EducationPage() {
  const { data: character } = useQuery(q.character());
  const { data: wallet } = useQuery(q.wallet());
  const { data: locations } = useQuery(q.locations());
  const { data: visits } = useQuery(q.visits());
  const { data: courses, isLoading } = useQuery(q.educationCourses());
  const { data: completed } = useQuery(q.myCourses());
  const studentDistrict = locations?.find((location) => location.slug === "student-district");
  const hasVisited = visits?.some((visit) => visit.location_id === studentDistrict?.id) ?? false;
  const complete = useGameAction(rpc.completeEducationCourse, {
    onSuccess: (result) =>
      toast.success(
        `${result.course} complete · +${result.intelligence_gain} Intelligence · +${result.career_gain} Career`,
      ),
  });

  if (isLoading || !character || !courses) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Study & Skills"
        subtitle="Build practical skills for Osogbo's next career step."
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link to="/map" className="text-sm font-bold underline underline-offset-4">
          Back to the city map
        </Link>
        <span className="ml-auto text-sm font-bold">
          Balance {formatNaira(wallet?.balance)} · Energy {character.energy}
        </span>
      </div>

      {!hasVisited && studentDistrict && (
        <div className="game-panel mb-5 flex flex-col items-start gap-3 bg-sun p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">Check in at the Student District before enrolling.</p>
          <Link
            to="/location/$slug"
            params={{ slug: "student-district" }}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-edge bg-card px-4 py-2 font-display font-bold transition-transform hover:-translate-y-0.5"
          >
            <Lock className="h-4 w-4" /> Visit campus
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {courses.map((course) => {
          const isComplete = completed?.some((entry) => entry.course_id === course.id) ?? false;
          const canAfford = (wallet?.balance ?? 0) >= course.tuition;
          const hasEnergy = character.energy >= course.energy_cost;
          const disabled =
            !hasVisited || isComplete || !canAfford || !hasEnergy || complete.isPending;

          return (
            <article key={course.id} className="game-panel flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {course.provider}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{course.name}</h2>
                </div>
                {isComplete ? (
                  <Chip tone="leaf">Completed</Chip>
                ) : (
                  <Chip>
                    <BookOpen className="h-3 w-3" /> Course
                  </Chip>
                )}
              </div>
              <p className="mt-3 flex-1 text-sm text-muted-foreground">{course.description}</p>
              <dl className="mt-4 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                <div className="rounded-lg border-2 border-edge bg-primary p-2 text-primary-foreground">
                  <dt className="font-semibold">Tuition</dt>
                  <dd className="font-display text-sm font-bold">{formatNaira(course.tuition)}</dd>
                </div>
                <div className="rounded-lg border-2 border-edge bg-sun p-2">
                  <dt className="font-semibold">Energy</dt>
                  <dd className="flex items-center justify-center gap-1 font-display text-sm font-bold">
                    <Zap className="h-3 w-3" />
                    {course.energy_cost}
                  </dd>
                </div>
                <div className="rounded-lg border-2 border-edge bg-card p-2">
                  <dt className="font-semibold">Intelligence</dt>
                  <dd className="font-display text-sm font-bold">+{course.intelligence_gain}</dd>
                </div>
                <div className="rounded-lg border-2 border-edge bg-leaf p-2">
                  <dt className="font-semibold">Career</dt>
                  <dd className="font-display text-sm font-bold">+{course.career_gain}</dd>
                </div>
              </dl>
              <Button
                className="mt-4"
                variant={isComplete ? "plain" : "ink"}
                disabled={disabled}
                onClick={() => complete.mutate(course.slug)}
              >
                {isComplete ? (
                  <>
                    <GraduationCap className="h-4 w-4" /> Course completed
                  </>
                ) : !hasVisited ? (
                  "Visit campus to enroll"
                ) : !canAfford ? (
                  `Need ${formatNaira(course.tuition)}`
                ) : !hasEnergy ? (
                  `Need ${course.energy_cost} energy`
                ) : complete.isPending ? (
                  "Enrolling…"
                ) : (
                  "Enroll & complete course"
                )}
              </Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
