import type { ClinicVisit } from "@/lib/clinic-visit";
export function ClinicVisitControls({
  visit,
  pending,
  error,
  onCheckIn,
  onCancel,
  onRefresh,
  onNewVisit,
}: {
  visit?: ClinicVisit;
  pending: boolean;
  error: boolean;
  onCheckIn: () => void;
  onCancel: () => void;
  onRefresh: () => void;
  onNewVisit?: () => void;
}) {
  const labels = {
    not_checked_in: "Check in at reception",
    waiting: `Waiting · Queue position ${visit?.queuePosition ?? 0}`,
    examination: "Examination station reserved",
    discharged: "Visit complete · Ready to leave",
    cancelled: "Visit cancelled",
  };
  return (
    <section className="rounded-lg border border-edge p-3" aria-label="Clinic visit">
      {visit?.staff && (
        <p className="text-sm">
          {visit.staff.onDuty ? "On duty" : "Off duty"}: {visit.staff.name} · {visit.staff.role}
        </p>
      )}
      {visit?.staff?.shiftStart !== undefined && visit.staff.shiftEnd !== undefined && (
        <p className="text-sm">
          Game-time shift: {String(visit.staff.shiftStart).padStart(2, "0")}:00–
          {String(visit.staff.shiftEnd).padStart(2, "0")}:00
        </p>
      )}
      {visit?.assignedStaff && (
        <p className="text-sm">Assigned staff: {visit.assignedStaff.name}</p>
      )}
      {visit?.staffAvailable === false && (
        <p className="text-sm">
          New visits are closed. Existing visits may finish; waiting visitors can cancel.
        </p>
      )}
      <p role="status">{visit ? labels[visit.status] : error ? "Check-in is unavailable. You can still explore." : "Loading clinic visit…"}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Fictional visit flow. No treatment, health change or payment is applied.
      </p>
      {error ? (
        <>
          <p role="alert">Check-in is currently unavailable. You can still explore the clinic.</p>
          <button type="button" disabled={pending} onClick={onRefresh}>
            Retry clinic visit
          </button>
        </>
      ) : visit?.status === "not_checked_in" ? (
        <button
          type="button"
          disabled={pending || visit.staffAvailable === false}
          onClick={onCheckIn}
        >
          Check in
        </button>
      ) : null}
      {!error && visit && !["waiting", "examination"].includes(visit.status) && (
        <button type="button" disabled={pending} onClick={onRefresh}>Refresh availability</button>
      )}
      {visit && ["discharged", "cancelled"].includes(visit.status) && onNewVisit && (
        <button
          type="button"
          disabled={pending || visit.staffAvailable === false}
          onClick={onNewVisit}
        >
          Start another visit
        </button>
      )}
      {visit && ["waiting", "examination"].includes(visit.status) && (
        <button type="button" disabled={pending} onClick={onCancel}>
          Cancel visit
        </button>
      )}
    </section>
  );
}
