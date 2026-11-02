import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookOpen, GraduationCap, Search, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatNaira, q, rpc, useGameAction } from "@/lib/game";
import { loadSavedCourses, setSavedCourse } from "@/lib/career-life-service";
import { pageMeta } from "@/lib/seo";
import "@/components/game/career-learning.css";

export const Route = createFileRoute("/_authenticated/_game/education")({
  head: () => pageMeta("Education", "Build skills and save courses for your next career step."),
  component: EducationPage,
});

export function EducationPage({ phoneMode = false }: { phoneMode?: boolean }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const characterQuery = useQuery(q.character());
  const character = characterQuery.data;
  const wallet = useQuery(q.wallet());
  const locations = useQuery(q.locations());
  const visits = useQuery(q.visits());
  const courses = useQuery(q.educationCourses());
  const completed = useQuery(q.myCourses());
  const plans = useQuery({
    queryKey: ["phoneCoursePlans", character?.id],
    enabled: !!character?.id,
    queryFn: () => loadSavedCourses(character!.id),
    retry: false,
  });
  const savePlan = useMutation({
    mutationFn: setSavedCourse,
    onSuccess: (_, args) =>
      toast.success(args.saved ? "Course saved." : "Course removed from saved."),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["phoneCoursePlans"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const studentDistrict = locations.data?.find((location) => location.slug === "student-district");
  const hasVisited =
    visits.data?.some((visit) => visit.location_id === studentDistrict?.id) ?? false;
  const complete = useGameAction(rpc.completeEducationCourse, {
    onSuccess: (result) =>
      toast.success(
        `${result.course} complete · +${result.intelligence_gain} Intelligence · +${result.career_gain} Career`,
      ),
  });
  const completedIds = new Set(
    completed.data
      ?.filter((entry) => entry.character_id === character?.id)
      .map((entry) => entry.course_id),
  );
  const savedIds = new Set(plans.data?.map((entry) => entry.course_id));
  const visible = courses.data?.filter(
    (course) =>
      (filter === "All" ||
        (filter === "Saved" ? savedIds.has(course.id) : completedIds.has(course.id))) &&
      `${course.name} ${course.provider} ${course.description}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  if (courses.isError || characterQuery.isError)
    return (
      <section role="alert" className="learning-notice">
        <p>Education could not be loaded.</p>
        <Button
          onClick={() => {
            void courses.refetch();
            void characterQuery.refetch();
          }}
        >
          Retry education
        </Button>
      </section>
    );
  if (courses.isPending || characterQuery.isPending) return <p role="status">Loading education…</p>;
  if (!character) return <p>Create a character to explore your education.</p>;
  return (
    <div className="career-learning-app" data-phone-mode={phoneMode || undefined}>
      <header className="learning-hero education-hero">
        <span className="learning-kicker">INVEST IN YOURSELF</span>
        <GraduationCap className="learning-hero-icon" size={40} />
        <h1>
          Learn something
          <br />
          that takes you further.
        </h1>
        <p>Practical skills. New opportunities. Your own pace.</p>
      </header>
      <dl className="learning-stats">
        <div>
          <dt>Completed</dt>
          <dd>{completed.isError ? "—" : completed.isPending ? "…" : completedIds.size}</dd>
        </div>
        <div>
          <dt>Saved for later</dt>
          <dd>{plans.isError ? "—" : plans.isPending ? "…" : savedIds.size}</dd>
        </div>
        <div>
          <dt>Study energy</dt>
          <dd>
            {character.energy}
            <Zap size={15} />
          </dd>
        </div>
      </dl>
      <div className="learning-search">
        <Search size={18} />
        <input
          aria-label="Search courses"
          placeholder="Find a course or provider"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <nav className="learning-tabs" aria-label="Course collections">
        {["All", "Saved", "Completed"].map((name) => (
          <button
            key={name}
            type="button"
            aria-current={filter === name ? "page" : undefined}
            onClick={() => setFilter(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      {(plans.isError || completed.isError) && (
        <div role="alert" className="learning-notice">
          <p>
            {plans.isError
              ? "Saved courses are unavailable."
              : "Your completion record is unavailable."}{" "}
            Retry to refresh your learning record.
          </p>
          <Button
            variant="plain"
            onClick={() => {
              void plans.refetch();
              void completed.refetch();
            }}
          >
            Retry learning record
          </Button>
        </div>
      )}
      {!hasVisited && (
        <div className="learning-notice">
          <BookOpen size={20} />
          <div>
            <strong>Your campus connection</strong>
            <p>
              {visits.isError
                ? "Campus visits could not be checked."
                : "Visit the Student District before completing a course. You can save courses now."}
            </p>
            <Link to="/location/$slug" params={{ slug: "student-district" }}>
              Visit campus →
            </Link>
          </div>
        </div>
      )}
      <div className="learning-balance">
        Study budget{" "}
        <strong>
          {wallet.isError
            ? "Unavailable"
            : wallet.isPending
              ? "Loading…"
              : formatNaira(wallet.data?.balance)}
        </strong>
      </div>
      <div className="learning-course-grid">
        {visible?.map((course) => {
          const record = completed.data?.find(
            (entry) => entry.character_id === character.id && entry.course_id === course.id,
          );
          const isComplete = completedIds.has(course.id);
          const isSaved = savedIds.has(course.id);
          const canAfford =
            !wallet.isError && !!wallet.data && wallet.data.balance >= course.tuition;
          const hasEnergy = character.energy >= course.energy_cost;
          const recordsUnavailable =
            completed.isPending || completed.isError || visits.isPending || visits.isError;
          return (
            <article key={course.id} className="learning-card learning-course">
              <div className="learning-card-top">
                <span className="learning-course-icon">
                  <GraduationCap size={23} />
                </span>
                <button
                  type="button"
                  className="learning-save"
                  aria-label={`${isSaved ? "Unsave" : "Save"} ${course.name}`}
                  aria-pressed={isSaved}
                  disabled={plans.isPending || plans.isError || savePlan.isPending}
                  onClick={() => savePlan.mutate({ slug: course.slug, saved: !isSaved })}
                >
                  <Bookmark size={21} fill={isSaved ? "currentColor" : "none"} />
                </button>
              </div>
              <span className="learning-kicker">{course.provider}</span>
              <h2>{course.name}</h2>
              <p>{course.description}</p>
              {isComplete && (
                <span className="learning-badge">
                  Completed
                  {record?.completed_at
                    ? ` · ${new Date(record.completed_at).toLocaleDateString()}`
                    : ""}
                </span>
              )}
              <div className="learning-rewards">
                <span>+{course.intelligence_gain} intelligence</span>
                <span>+{course.career_gain} career</span>
              </div>
              <div className="learning-course-cost">
                <strong>{formatNaira(course.tuition)}</strong>
                <span>
                  <Zap size={14} />
                  {course.energy_cost} energy
                </span>
              </div>
              <Button
                variant={isComplete ? "plain" : "ink"}
                disabled={
                  isComplete ||
                  recordsUnavailable ||
                  !hasVisited ||
                  !canAfford ||
                  !hasEnergy ||
                  complete.isPending
                }
                onClick={() => complete.mutate(course.slug)}
              >
                {isComplete
                  ? "Course completed"
                  : recordsUnavailable
                    ? "Learning record unavailable"
                    : !hasVisited
                      ? "Visit campus to study"
                      : !canAfford
                        ? "Insufficient study budget"
                        : !hasEnergy
                          ? `Need ${course.energy_cost} energy`
                          : complete.isPending
                            ? "Completing…"
                            : "Enroll & complete"}
              </Button>
            </article>
          );
        })}
      </div>
      {visible?.length === 0 &&
        !(filter === "Saved" && (plans.isError || plans.isPending)) &&
        !(filter === "Completed" && (completed.isError || completed.isPending)) && (
          <div className="learning-empty">
            <BookOpen size={28} />
            <h2>
              {search
                ? "No matching courses"
                : filter === "Saved"
                  ? "Your next chapter is waiting"
                  : filter === "Completed"
                    ? "Your achievements start here"
                    : "No courses available"}
            </h2>
            <p>
              {filter === "Saved"
                ? "Tap the bookmark on a course to keep it here."
                : "Explore the course collection to find your next skill."}
            </p>
            <Button
              variant="plain"
              onClick={() => {
                setFilter("All");
                setSearch("");
              }}
            >
              Explore all courses
            </Button>
          </div>
        )}
    </div>
  );
}
