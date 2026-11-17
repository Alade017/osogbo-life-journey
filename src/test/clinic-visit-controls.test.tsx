import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { ClinicVisitControls } from "@/components/game/ClinicVisitControls";
afterEach(cleanup);
it("separates check-in, cancellation and starting a new completed visit", () => {
  const check = vi.fn(),
    cancel = vi.fn(),
    fresh = vi.fn();
  const props = {
    pending: false,
    error: false,
    onCheckIn: check,
    onCancel: cancel,
    onRefresh: vi.fn(),
    onNewVisit: fresh,
  };
  const { rerender } = render(
    <ClinicVisitControls
      {...props}
      visit={{ id: null, status: "not_checked_in", queuePosition: 0, examEndsAt: null }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Check in" }));
  expect(check).toHaveBeenCalledOnce();
  rerender(
    <ClinicVisitControls
      {...props}
      visit={{ id: "visit", status: "waiting", queuePosition: 2, examEndsAt: null }}
    />,
  );
  expect(screen.getByText("Waiting · Queue position 2")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel visit" }));
  expect(cancel).toHaveBeenCalledOnce();
  rerender(
    <ClinicVisitControls
      {...props}
      visit={{ id: "visit", status: "discharged", queuePosition: 0, examEndsAt: null }}
    />,
  );
  expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Start another visit" }));
  expect(fresh).toHaveBeenCalledOnce();
});

it("shows staffing availability and disables new visits while preserving cancellation", () => {
  const props = {
    pending: false,
    error: false,
    onCheckIn: vi.fn(),
    onCancel: vi.fn(),
    onRefresh: vi.fn(),
  };
  const visit = {
    id: null,
    status: "not_checked_in" as const,
    queuePosition: 0,
    examEndsAt: null,
    staffAvailable: false,
    staff: { id: "staff", name: "Sade Akinola", role: "Clinic care officer", onDuty: false },
  };
  const { rerender } = render(<ClinicVisitControls {...props} visit={visit} />);
  expect(screen.getByRole("button", { name: "Check in" })).toBeDisabled();
  expect(screen.getByText(/Off duty: Sade/)).toBeInTheDocument();
  rerender(<ClinicVisitControls {...props} visit={{ ...visit, id: "visit", status: "waiting" }} />);
  expect(screen.getByRole("button", { name: "Cancel visit" })).toBeEnabled();
});
