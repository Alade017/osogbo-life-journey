import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";

vi.mock("@/components/game/OsogboMap", () => ({
  OsogboMap: () => <div>Live city atlas</div>,
}));
describe("city map overview", () => {
  it("prioritizes the full map and preserves the playable neighborhood switch", () => {
    render(
      <CityMapDashboard>
        <div>Playable neighborhood</div>
      </CityMapDashboard>,
    );

    expect(screen.getByText("Live city atlas")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Explore Osogbo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Find work" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Go home" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "3D neighborhood" }));
    expect(screen.getByText("Playable neighborhood")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "City atlas" }));
    expect(screen.getByText("Live city atlas")).toBeInTheDocument();
  });
});
