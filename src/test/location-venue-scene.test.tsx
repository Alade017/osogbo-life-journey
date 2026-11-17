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

it("keeps market fixture selection and server-offer handoff available without WebGL", () => {
  vi.useFakeTimers();
  const browse = vi.fn();
  render(<LocationVenueScene slug="oja-oba" locationName="Oja-Oba" onBrowseMarket={browse} />);
  act(() => { vi.advanceTimersByTime(5000); });
  fireEvent.click(screen.getByRole("button", { name: "Household goods display" }));
  expect(screen.getByRole("button", { name: "Household goods display" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("A shared display table for practical household items.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Browse market offers" }));
  expect(browse).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ to, children, ...props }: { to: string; children: import("react").ReactNode }) => <a href={to} {...props}>{children}</a>,
}));
it("keeps workplace features, jobs and courses accessible when WebGL fails", () => {
  vi.useFakeTimers();
  render(<LocationVenueScene slug="harvest-tech-hub" locationName="Harvest Tech Hub" />);
  act(() => { vi.advanceTimersByTime(5000); });
  fireEvent.click(screen.getByRole("button", { name: "Training table" }));
  expect(screen.getByRole("button", { name: "Training table" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("link", { name: "Jobs & shifts" })).toHaveAttribute("href", "/jobs");
  expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute("href", "/education");
  vi.useRealTimers();
});
