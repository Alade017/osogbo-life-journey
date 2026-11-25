import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GigWorkApp } from "@/components/game/phone/GigWorkApp";

const { relief } = vi.hoisted(() => ({
  relief: { hustles: [] as Array<Record<string, unknown>> },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey?: unknown[] }) =>
    opts?.queryKey?.[0] === "character"
      ? { data: { id: "char-1" } }
      : { data: relief, isPending: false },
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/game", () => ({
  q: { character: () => ({ queryKey: ["character"] }) },
  formatNaira: (minor: number) => `₦${(minor / 100).toLocaleString("en-NG")}`,
}));
vi.mock("@/lib/housing-relief-client", () => ({
  getHousingReliefState: vi.fn(),
  housingReliefQueryKey: () => ["housingRelief"],
  submitHousingReliefAction: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("Gig Work", () => {
  beforeEach(() => {
    relief.hustles = [];
  });

  it("explains there is no gig work when no job is active", () => {
    render(<GigWorkApp />);
    expect(screen.getByText(/No gig work right now/)).toBeTruthy();
  });

  it("shows shift progress and enables Work shift when a shift is ready", () => {
    relief.hustles = [
      {
        id: "h1",
        title: "Okada rider",
        shiftPayMinor: 500000,
        shiftsTotal: 5,
        shiftsCompleted: 2,
        nextShiftAt: "2026-11-25T10:00:00Z",
        canWorkNow: true,
        rentPaid: false,
        keepConfirmedAt: null,
      },
    ];
    render(<GigWorkApp />);
    expect(screen.getByText("Okada rider")).toBeTruthy();
    expect(screen.getByText("2 of 5")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Work shift" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
});
