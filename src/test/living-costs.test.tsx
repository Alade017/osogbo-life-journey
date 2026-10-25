import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const { readHome, readFood } = vi.hoisted(() => ({ readHome: vi.fn(), readFood: vi.fn() }));
vi.mock("@/tanstack/react-router", () => ({}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, onClick }: { children: ReactNode; to: string; onClick: () => void }) => (
    <a href={to} onClick={onClick}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/game", () => ({
  formatNaira: (value: number) => `₦${value.toLocaleString("en-NG")}`,
}));
vi.mock("@/lib/living-cost-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/living-cost-service")>(
    "@/lib/living-cost-service",
  );
  return {
    ...actual,
    canonicalHomeOptions: (id: string) => ({
      queryKey: ["canonicalHousingHome", id],
      queryFn: readHome,
    }),
    readFoodCost: readFood,
  };
});
import { LivingCostsSummary } from "@/components/game/LivingCostsSummary";
let client: QueryClient;
afterEach(() => {
  cleanup();
  client?.clear();
  vi.clearAllMocks();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
});
function setup() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <LivingCostsSummary characterId="c" userId="u" />
    </QueryClientProvider>,
  );
}
describe("home cost panel", () => {
  it("loads only on open, labels units, and restores keyboard focus", async () => {
    readHome.mockResolvedValue({
      propertyId: "p",
      tenure: "rented",
      weeklyRentMinor: 3500,
      status: "due",
      dueAt: "2026-10-25T12:00:00Z",
    });
    readFood.mockResolvedValue(1800);
    setup();
    expect(readHome).not.toHaveBeenCalled();
    expect(readFood).not.toHaveBeenCalled();
    const trigger = screen.getByRole("button", { name: "Living costs" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(await screen.findByText("₦3,500 per week")).toBeInTheDocument();
    expect(await screen.findByText("Menu items from ₦1,800 each.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore travel options" })).toHaveAttribute(
      "href",
      "/map",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it("keeps food available when housing fails and supports retry", async () => {
    readHome.mockRejectedValueOnce(new Error("unavailable")).mockResolvedValue(null);
    readFood.mockResolvedValue(null);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Living costs" }));
    expect(await screen.findByText("Housing unavailable.")).toBeInTheDocument();
    expect(await screen.findByText("No menu items available.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry housing" }));
    expect(await screen.findByText("No current home.")).toBeInTheDocument();
  });
  it("does not fetch or present free costs offline", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Living costs" }));
    expect(await screen.findByText("Offline. Housing unavailable.")).toBeInTheDocument();
    expect(readHome).not.toHaveBeenCalled();
    expect(readFood).not.toHaveBeenCalled();
  });
});
