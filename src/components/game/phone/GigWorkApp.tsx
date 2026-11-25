import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";
import { formatNaira, q } from "@/lib/game";
import {
  getHousingReliefState,
  housingReliefQueryKey,
  submitHousingReliefAction,
} from "@/lib/housing-relief-client";
import "./vitalstat-nesta-app.css";

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "later"
    : new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      }).format(date);
}

/** Gig jobs you took to cover overdue rent: shifts, pay and the next shift. */
export function GigWorkApp() {
  const client = useQueryClient();
  const character = useQuery(q.character()).data;
  const characterId = character?.id ?? "";
  const relief = useQuery({
    queryKey: housingReliefQueryKey(characterId, "home"),
    queryFn: () => getHousingReliefState("home"),
    enabled: !!characterId,
    retry: false,
  });
  const work = useMutation({
    mutationFn: (hustleId: string) => submitHousingReliefAction("complete", hustleId, "home"),
    onSuccess: async () => {
      toast.success("Shift completed. Your earnings were added to your wallet.");
      await client.invalidateQueries({ queryKey: housingReliefQueryKey(characterId, "home") });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const jobs = relief.data?.hustles ?? [];

  return (
    <section className="nesta-app gig-app" aria-label="Gig Work">
      <header className="nesta-hero">
        <span className="nesta-mark" aria-hidden="true">
          <BriefcaseBusiness size={20} />
        </span>
        <div>
          <h2>Gig Work</h2>
          <p>Jobs you took to cover overdue rent.</p>
        </div>
      </header>

      {relief.isPending && characterId ? <p className="nesta-note">Loading your gigs…</p> : null}

      {!relief.isPending && jobs.length === 0 ? (
        <div className="nesta-card">
          <p>No gig work right now. Gig jobs appear here when your home rent is overdue.</p>
        </div>
      ) : null}

      {jobs.map((job) => (
        <div className="nesta-card" key={job.id}>
          <h3>{job.title}</h3>
          <dl className="nesta-facts">
            <div>
              <dt>Shifts</dt>
              <dd>
                {job.shiftsCompleted} of {job.shiftsTotal}
              </dd>
            </div>
            <div>
              <dt>Pay per shift</dt>
              <dd>{formatNaira(job.shiftPayMinor)}</dd>
            </div>
            <div>
              <dt>{job.canWorkNow ? "Ready" : "Next shift"}</dt>
              <dd>{job.canWorkNow ? "Now" : dateLabel(job.nextShiftAt)}</dd>
            </div>
          </dl>
          <button
            type="button"
            className="nesta-button"
            disabled={!job.canWorkNow || work.isPending}
            onClick={() => work.mutate(job.id)}
          >
            {job.canWorkNow ? "Work shift" : "Not yet"}
          </button>
        </div>
      ))}
    </section>
  );
}
