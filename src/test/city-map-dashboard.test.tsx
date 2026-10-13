import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/game/OsogboMap", () => ({
  OsogboMap: () => <div>Live city atlas</div>,
}));
describe("city map overview", () => {
  it("shows the live city atlas by default and preserves the playable neighborhood", () => {
    render(
      <CityMapDashboard>
        <div>Playable neighborhood</div>
      </CityMapDashboard>,
    );

    expect(screen.getByRole("heading", { name: "Explore Osogbo" })).toBeInTheDocument();
    expect(screen.getByText("Live city atlas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find work" })).toHaveAttribute("href", "/jobs");
    expect(screen.getByRole("link", { name: "Meet people" })).toHaveAttribute("href", "/social");

    fireEvent.click(screen.getByRole("button", { name: "3D neighborhood" }));
    expect(screen.getByText("Playable neighborhood")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "City atlas" }));
    expect(screen.getByText("Live city atlas")).toBeInTheDocument();
  });
});
