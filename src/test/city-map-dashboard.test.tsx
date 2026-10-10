import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/game/GameTimeProvider", () => ({
  useGameTime: () => ({
    simulation: {
      needs: { hunger: 45, energy: 78, hygiene: 82, bladder: 60, fun: 70, social: 20 },
    },
  }),
}));

describe("city map overview", () => {
  it("shows current needs and quick links without replacing the playable map", () => {
    render(
      <CityMapDashboard>
        <div>Playable neighborhood</div>
      </CityMapDashboard>,
    );

    expect(screen.getByRole("heading", { name: "Explore Osogbo" })).toBeInTheDocument();
    expect(screen.getByText("Playable neighborhood")).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Hunger" })).toHaveAttribute("aria-valuenow", "45");
    expect(screen.getByRole("link", { name: "Find work" })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: "Meet people" })).toHaveAttribute("href", "/social");
  });
});
