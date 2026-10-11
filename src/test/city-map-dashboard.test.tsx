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
describe("city map overview", () => {
  it("keeps quick links alongside the playable map", () => {
    render(
      <CityMapDashboard>
        <div>Playable neighborhood</div>
      </CityMapDashboard>,
    );

    expect(screen.getByRole("heading", { name: "Explore Osogbo" })).toBeInTheDocument();
    expect(screen.getByText("Playable neighborhood")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find work" })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: "Meet people" })).toHaveAttribute("href", "/social");
  });
});
