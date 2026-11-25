import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NestaApp } from "@/components/game/phone/NestaApp";

const state = {
  home: {
    tenure: "rented",
    name: "Ajia Court",
    district: "Olaiya",
    status: "current",
    dueAt: null,
    weeklyRentMinor: 350000,
  } as Record<string, unknown>,
  pending: false,
};
const { payHomeRent, mutate } = vi.hoisted(() => ({
  payHomeRent: vi.fn(async () => ({})),
  mutate: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey?: unknown[] }) =>
    opts?.queryKey?.[0] === "character"
      ? { data: { id: "char-1" } }
      : { data: state.home, isPending: false },
  useMutation: (opts: { mutationFn: () => unknown }) => ({
    isPending: false,
    mutate: () => {
      mutate();
      void opts.mutationFn();
    },
  }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("@/lib/game", () => ({
  q: { character: () => ({ queryKey: ["character"] }) },
  formatNaira: (minor: number) => `₦${(minor / 100).toLocaleString("en-NG")}`,
}));
vi.mock("@/lib/living-cost-service", () => ({
  canonicalHomeOptions: () => ({ queryKey: ["home"] }),
}));
vi.mock("@/lib/canonical-home", () => ({
  normalizeCanonicalHome: (value: unknown) => value,
}));
vi.mock("@/lib/home-rent-service", () => ({ payHomeRent }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("Nesta", () => {
  beforeEach(() => {
    payHomeRent.mockClear();
    mutate.mockClear();
    state.home = {
      tenure: "rented",
      name: "Ajia Court",
      district: "Olaiya",
      status: "current",
      dueAt: null,
      weeklyRentMinor: 350000,
    };
  });

  it("shows the rented home and disables payment when rent is already paid", () => {
    render(<NestaApp onOpenApp={vi.fn()} />);
    expect(screen.getByText("Ajia Court")).toBeTruthy();
    expect(screen.getByText("Paid up")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Rent is paid" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("lets the player pay overdue rent and opens the property app", () => {
    state.home = { ...state.home, status: "overdue" };
    const onOpenApp = vi.fn();
    render(<NestaApp onOpenApp={onOpenApp} />);
    expect(screen.getByText("Overdue")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pay rent" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Manage home" }));
    expect(onOpenApp).toHaveBeenCalledWith("Property");
  });
});
