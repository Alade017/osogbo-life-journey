import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeInterior } from "@/components/game/HomeInterior";

vi.mock("@/components/game/housing/HouseScene", () => ({
  HouseScene: () => <div data-testid="house-scene" />,
}));

describe("walkable home experience", () => {
  beforeEach(() => window.localStorage.clear());

  it("enters home, selects connected rooms and exits", async () => {
    render(<HomeInterior />);
    fireEvent.click(screen.getByRole("button", { name: /family courtyard home/i }));
    fireEvent.click(screen.getByRole("button", { name: /enter home/i }));
    expect(await screen.findByLabelText(/walkable floor/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kitchen" }));
    await waitFor(() => expect(screen.getByText("Kitchen")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /leave home/i }));
    expect(screen.getByRole("button", { name: /enter home/i })).toBeInTheDocument();
  }, 15_000);

  it("restores the selected starter layout after refresh", () => {
    const { unmount } = render(<HomeInterior />);
    fireEvent.click(screen.getByRole("button", { name: /courtyard room/i }));
    expect(window.localStorage.getItem("osogbo-life-housing-v1")).toContain("courtyard-room");
    unmount();
    render(<HomeInterior />);
    expect(screen.getByRole("heading", { name: "Courtyard Room" })).toBeInTheDocument();
  });
});
