import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CityMapDashboard } from "@/components/game/CityMapDashboard";

vi.mock("@/components/game/OsogboMap", () => ({
  OsogboMap: () => <div>Living Osogbo map</div>,
}));
describe("city map overview", () => {
  it("shows one full-page map without the retired 3D map mode", async () => {
    render(<CityMapDashboard />);
    expect(await screen.findByText("Living Osogbo map")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "3D neighborhood" })).not.toBeInTheDocument();
  });
});
