import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocationVenueScene } from "@/components/game/LocationVenueScene";

vi.mock("@react-three/fiber", () => ({
  Canvas: () => <div data-testid="venue-canvas" />,
}));
vi.mock("@/components/3d/WorldScene", () => ({
  WorldCamera: () => null,
  WorldLighting: () => null,
  WorldMaterial: () => null,
}));

describe("location venue scene", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ends its single loading indicator and keeps room controls interactive on fallback", () => {
    vi.useFakeTimers();
    render(<LocationVenueScene slug="town-market" locationName="Town Market" />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByText("Opening the venue")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.queryByText("Opening the venue")).not.toBeInTheDocument();
    expect(screen.getByText(/The 3D preview did not start/)).toBeInTheDocument();
    expect(screen.queryByTestId("venue-canvas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Market table" }));
    expect(screen.getByRole("button", { name: "Market table" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("A central display table.")).toBeInTheDocument();
  });
});
