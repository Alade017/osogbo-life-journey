import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatNaira, q } from "@/lib/game";
import {
  getHousingReliefState,
  housingReliefQueryKey,
  resolveHousingOverdue,
  submitHousingReliefAction,
} from "@/lib/housing-relief-client";
import "./housing-relief.css";

type Props = {
  characterId: string;
  rentStatus: string;
  graceEndsAt: string | null;
  rescueEndsAt: string | null;
  offline: boolean;
  paying: boolean;
  onPayRent: () => void;
};

function dateLabel(value: string | null) {
  if (!value) return "the deadline";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "the deadline"
    : new Intl.DateTimeFormat("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      }).format(date);
}

export function HousingReliefPanel({
  characterId,
  rentStatus,
  graceEndsAt,
  rescueEndsAt,
  offline,
  paying,
  onPayRent,
}: Props) {
  const queryClient = useQueryClient();
  const relief = useQuery({
    queryKey: housingReliefQueryKey(characterId),
    queryFn: getHousingReliefState,
    enabled: !offline,
    retry: false,
    refetchInterval: (query) =>
      !offline &&
      (rentStatus === "rescue" || query.state.data?.hustles.some((job) => !job.canWorkNow))
        ? 30_000
        : false,
  });
  const action = useMutation({
    mutationFn: async ({
      kind,
      hustleId,
    }: {
      kind: "loan" | "job" | "complete" | "keep" | "drop";
      hustleId?: string;
    }) =>
      kind === "loan" || kind === "job"
        ? resolveHousingOverdue(kind)
        : submitHousingReliefAction(kind, hustleId),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: housingReliefQueryKey(characterId) }),
        queryClient.invalidateQueries({ queryKey: ["canonicalHousingHome"] }),
        queryClient.invalidateQueries({ queryKey: ["authoritativeHouseState"] }),
        queryClient.invalidateQueries({ queryKey: ["housingMapProperties"] }),
        queryClient.invalidateQueries({ queryKey: q.wallet().queryKey }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      ]);
      toast.success(
        variables.kind === "loan"
          ? "The server applied the rent rescue loan. Your rent is current."
          : variables.kind === "job"
            ? "Your rent relief job is ready. Work shifts, then pay rent from your wallet."
            : variables.kind === "complete"
              ? "Shift completed. Your earnings were added to your wallet."
              : variables.kind === "keep"
                ? "You chose to keep this job."
                : "You stopped this job.",
      );
    },
    onError: (error: Error) => toast.error(error.message.replaceAll("_", " ")),
  });
  const offers = relief.data;
  const inGrace = rentStatus === "grace";
  const inRescue = rentStatus === "rescue";
  const hasJobs = !!offers?.hustles.length;
  if (!inGrace && !inRescue && !hasJobs) return null;

  return (
    <section className="housing-relief-panel" aria-label="Rent relief">
      {(inGrace || inRescue) && (
        <>
          <p className="house-eyebrow">Keep your home</p>
          <h2>
            {inGrace ? "Rent is in its grace period" : "Choose how to clear your overdue rent"}
          </h2>
          <p>
            {inGrace
              ? `Pay by ${dateLabel(graceEndsAt)}. If it remains unpaid, a rescue loan or a rent relief job becomes available.`
              : `Respond by ${dateLabel(rescueEndsAt)}. If you do not respond, the server ends the tenancy and moves your character to the streets.`}
          </p>
          <div className="housing-relief-actions">
            <button
              type="button"
              className="house-pay-button"
              disabled={offline || paying || action.isPending}
              onClick={onPayRent}
            >
              {paying ? "Paying…" : "Pay now"}
            </button>
            {inRescue && (
              <>
                <button
                  type="button"
                  className="house-secondary-button"
                  disabled={offline || action.isPending || !offers?.loanOffer}
                  onClick={() => action.mutate({ kind: "loan" })}
                >
                  Take rescue loan
                </button>
                <button
                  type="button"
                  className="house-secondary-button"
                  disabled={offline || action.isPending || !offers?.jobOffer}
                  onClick={() => action.mutate({ kind: "job" })}
                >
                  Take rent relief job
                </button>
              </>
            )}
          </div>
          {inRescue && offers?.loanOffer && (
            <p className="housing-relief-detail">
              Loan: {formatNaira(offers.loanOffer.principalMinor)} over{" "}
              {offers.loanOffer.instalmentsTotal} instalments of{" "}
              {formatNaira(offers.loanOffer.instalmentMinor)}. The server applies the loan directly
              to this rent.
            </p>
          )}
          {inRescue && offers?.jobOffer && (
            <p className="housing-relief-detail">
              Job: {offers.jobOffer.shiftsTotal} shifts, about{" "}
              {formatNaira(offers.jobOffer.shiftPayMinor)} per shift. Earnings go to your wallet;
              use Pay now to settle rent.
            </p>
          )}
          {relief.isError && (
            <p role="alert">Rent relief options could not load. Try refreshing this page.</p>
          )}
          {action.isPending && <p role="status">Saving your choice…</p>}
        </>
      )}
      {hasJobs && (
        <div className="housing-relief-jobs">
          <h2>Your rent relief jobs</h2>
          {offers!.hustles.map((job) => (
            <article className="housing-relief-job" key={job.id}>
              <strong>{job.title}</strong>
              <p>
                {job.shiftsCompleted} of {job.shiftsTotal} shifts · {formatNaira(job.shiftPayMinor)}{" "}
                per shift
              </p>
              {!job.rentPaid && (
                <p>Job earnings go to your wallet. Pay rent before the rescue deadline.</p>
              )}
              {job.rentPaid && !job.keepConfirmedAt && (
                <p>Rent is paid. Choose whether to keep working this job.</p>
              )}
              {job.keepConfirmedAt && <p>Kept after rent was paid.</p>}
              <div className="housing-relief-actions">
                <button
                  type="button"
                  className="house-pay-button"
                  disabled={offline || action.isPending || !job.canWorkNow}
                  onClick={() => action.mutate({ kind: "complete", hustleId: job.id })}
                >
                  {job.canWorkNow ? "Work shift" : `Next shift ${dateLabel(job.nextShiftAt)}`}
                </button>
                {job.rentPaid && !job.keepConfirmedAt && (
                  <>
                    <button
                      type="button"
                      className="house-secondary-button"
                      disabled={offline || action.isPending}
                      onClick={() => action.mutate({ kind: "keep", hustleId: job.id })}
                    >
                      Keep job
                    </button>
                    <button
                      type="button"
                      className="house-secondary-button"
                      disabled={offline || action.isPending}
                      onClick={() => action.mutate({ kind: "drop", hustleId: job.id })}
                    >
                      Stop job
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
