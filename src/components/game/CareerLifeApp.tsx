import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { BriefcaseBusiness, GraduationCap, History, TrendingUp } from "lucide-react";
import { CareerPanel } from "@/components/game/CareerPanel";
import { Button } from "@/components/ui/button";
import { q, formatNaira } from "@/lib/game";
import { loadCareerLifeHistory, loadCareerLifeSummary } from "@/lib/career-life-service";
import { EducationPage } from "@/routes/_authenticated/_game/education";
import "./career-learning.css";

const tabs = [
  { name: "Overview", icon: TrendingUp },
  { name: "Opportunities", icon: BriefcaseBusiness },
  { name: "Work history", icon: History },
  { name: "Learning", icon: GraduationCap },
] as const;

export function CareerLifeApp({ opportunities }: { opportunities: ReactNode }) {
  const [tab, setTab] = useState<string>("Overview");
  const [offset, setOffset] = useState(0);
  const { data: character } = useQuery(q.character());
  const summary = useQuery({
    queryKey: ["careerLifeSummary", character?.id],
    queryFn: loadCareerLifeSummary,
    enabled: !!character?.id,
    retry: false,
  });
  const history = useQuery({
    queryKey: ["careerLifeHistory", character?.id, offset],
    queryFn: () => loadCareerLifeHistory(offset),
    enabled: !!character?.id && tab === "Work history",
    retry: false,
  });
  const current = summary.data?.employments.find((job) => job.current);
  return (
    <div className="career-learning-app">
      <header className="learning-hero">
        <span className="learning-kicker">YOUR NEXT CHAPTER</span>
        <h1>Career Life</h1>
        <p>Your work, your progress, your possibilities.</p>
        <div className="learning-hero-role">
          <BriefcaseBusiness size={18} />
          <span>{current?.name ?? "Build your working life"}</span>
        </div>
      </header>
      <nav className="learning-tabs" aria-label="Career Life sections">
        {tabs.map(({ name, icon: Icon }) => (
          <button
            key={name}
            type="button"
            aria-current={tab === name ? "page" : undefined}
            onClick={() => setTab(name)}
          >
            <Icon size={17} />
            {name}
          </button>
        ))}
      </nav>
      {tab === "Opportunities" ? (
        opportunities
      ) : tab === "Learning" ? (
        <EducationPage phoneMode />
      ) : (
        <>
          {summary.isPending && <p role="status">Loading your career record…</p>}
          {summary.isError && (
            <div className="learning-notice" role="alert">
              <p>
                Your career record could not be loaded. Opportunities and Learning are still
                available.
              </p>
              <Button variant="plain" onClick={() => void summary.refetch()}>
                Retry career record
              </Button>
            </div>
          )}
          {summary.data && (
            <>
              <dl className="learning-stats">
                <div>
                  <dt>Recorded earnings</dt>
                  <dd>{formatNaira(summary.data.earned)}</dd>
                </div>
                <div>
                  <dt>Completed shifts</dt>
                  <dd>{summary.data.shifts}</dd>
                </div>
                <div>
                  <dt>Workplaces</dt>
                  <dd>{summary.data.employments.length}</dd>
                </div>
              </dl>
              {tab === "Overview" ? (
                <>
                  <section className="learning-card">
                    <span className="learning-kicker">CURRENT ROLE</span>
                    <h2>{current?.name ?? "Your next role starts here"}</h2>
                    {current ? (
                      <>
                        <p>
                          {current.location ?? "Local workplace"} · Career level {current.level}
                        </p>
                        <p>
                          {current.shifts} shifts completed ·{" "}
                          {current.lastWorkedAt
                            ? `Last worked ${new Date(current.lastWorkedAt).toLocaleDateString()}`
                            : "First shift ahead"}
                        </p>
                        {current.requiredCourse && (
                          <p>Required qualification: {current.requiredCourse}</p>
                        )}
                      </>
                    ) : (
                      <p>Explore opportunities, build skills, and find your first workplace.</p>
                    )}
                    <Button className="mt-3" onClick={() => setTab("Opportunities")}>
                      {current ? "Open workplace & opportunities" : "Explore opportunities"}
                    </Button>
                  </section>
                </>
              ) : (
                <section className="learning-records" aria-label="Current and past jobs">
                  <h2>Your employment record</h2>
                  {summary.data.employments.length === 0 && <p>No jobs recorded yet.</p>}
                  {summary.data.employments.map((job) => (
                    <article className="learning-card" key={job.id}>
                      <div className="learning-card-top">
                        <h3>{job.name}</h3>
                        <span className="learning-badge">{job.current ? "Current" : "Past"}</span>
                      </div>
                      <p>
                        {job.location ?? "Local workplace"} · Level {job.level} · {job.shifts}{" "}
                        shifts
                      </p>
                      <p>
                        First hired {new Date(job.hiredAt).toLocaleDateString()}
                        {job.lastWorkedAt &&
                          ` · Last worked ${new Date(job.lastWorkedAt).toLocaleDateString()}`}
                      </p>
                      {job.requiredCourse && <p>Qualification: {job.requiredCourse}</p>}
                    </article>
                  ))}
                  <p className="learning-caption">
                    Repeated employment at the same workplace shares one record. Detailed role
                    changes are recorded from this update onward.
                  </p>
                </section>
              )}
            </>
          )}
          {tab === "Overview" && <CareerPanel mode="current" />}
          {tab === "Work history" && (
            <section className="learning-records" aria-label="Career timeline">
              <h2>Activity & pay</h2>
              {history.isPending && <p role="status">Loading activity…</p>}
              {history.isError && (
                <div role="alert">
                  <p>Activity could not be loaded.</p>
                  <Button variant="plain" onClick={() => void history.refetch()}>
                    Retry activity
                  </Button>
                </div>
              )}
              {history.data?.rows.length === 0 && <p>No activity on this page.</p>}
              <ol className="career-timeline">
                {history.data?.rows.map((row) => (
                  <li key={row.id}>
                    <div>
                      <span className="learning-kicker">
                        {row.kind === "payment" ? "SHIFT PAYMENT" : row.kind.toUpperCase()}
                      </span>
                      <p>{row.label}</p>
                      <time dateTime={row.at}>{new Date(row.at).toLocaleString()}</time>
                    </div>
                    <strong>
                      {row.amount !== null ? formatNaira(row.amount) : `Level ${row.level}`}
                    </strong>
                  </li>
                ))}
              </ol>
              <div className="learning-pagination">
                <Button
                  variant="plain"
                  disabled={offset === 0 || history.isFetching}
                  onClick={() => setOffset(Math.max(0, offset - 20))}
                >
                  Newer
                </Button>
                <span>Page {offset / 20 + 1}</span>
                <Button
                  variant="plain"
                  disabled={!history.data?.hasMore || history.isFetching}
                  onClick={() => setOffset(offset + 20)}
                >
                  Older
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
