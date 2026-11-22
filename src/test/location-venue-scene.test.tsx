import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationVenueScene } from "@/components/game/LocationVenueScene";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";

const sceneMock = vi.hoisted(() => ({
  renderChildren: false,
  failingKind: null as string | null,
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: import("react").ReactNode }) => (
    <div data-testid="venue-canvas">
      {sceneMock.renderChildren ? children : null}
    </div>
  ),
}));

vi.mock("@/components/3d/VenueFurniture", () => ({
  VenueFurnitureModel: ({ kind }: { kind: string }) => {
    if (kind === sceneMock.failingKind) {
      throw new Error("Furniture model unavailable");
    }
    return <div data-testid={`furniture-${kind}`} />;
  },
}));

beforeEach(() => {
  sceneMock.renderChildren = false;
  sceneMock.failingKind = null;
});
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

    expect(screen.getByText("The interior is taking longer than expected.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue without 3D" }));
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

it("keeps transit planning and fixture controls available when WebGL fails", () => {
  vi.useFakeTimers();
  render(<LocationVenueScene slug="transit-park" locationName="Transit Park" />);
  act(() => {
    vi.advanceTimersByTime(5000);
  });
  fireEvent.click(screen.getByRole("button", { name: "Ticket counter" }));
  expect(screen.getByRole("button", { name: "Ticket counter" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("link", { name: "Choose destination" })).toHaveAttribute("href", "/map");
  fireEvent.click(screen.getByText("Preferred transport"));
  fireEvent.click(screen.getByRole("button", { name: "Danfo" }));
  expect(screen.getByRole("link", { name: "Choose destination" })).toHaveAttribute(
    "href",
    "/map?transport=danfo",
  );
  vi.useRealTimers();
});

it.each([
  ["cedar-bank", "Cedar Bank", "Information screen"],
  ["meridian-bank", "Meridian Bank", "Self-service kiosk"],
])("keeps %s features and banking handoff usable without WebGL", (slug, name, feature) => {
  vi.useFakeTimers();
  const openBank = vi.fn();
  render(<LocationVenueScene slug={slug} locationName={name} onBankServices={openBank} />);
  act(() => {
    vi.advanceTimersByTime(5000);
  });
  fireEvent.click(screen.getByRole("button", { name: feature }));
  expect(screen.getByRole("button", { name: feature })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Access bank services" }));
  expect(openBank).toHaveBeenCalledTimes(1);
});

it("keeps market fixture selection and server-offer handoff available without WebGL", () => {
  vi.useFakeTimers();
  const browse = vi.fn();
  render(<LocationVenueScene slug="oja-oba" locationName="Oja-Oba" onBrowseMarket={browse} />);
  act(() => {
    vi.advanceTimersByTime(5000);
  });
  fireEvent.click(screen.getByRole("button", { name: "Household goods display" }));
  expect(screen.getByRole("button", { name: "Household goods display" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.getByText("A shared display table for practical household items."),
  ).toBeInTheDocument();
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

it("cancels the loading timer when the scene becomes ready", () => {
  vi.useFakeTimers();
  const clearTimer = vi.spyOn(window, "clearTimeout");
  const { rerender } = render(
    <LocationVenueScene slug="town-market" locationName="Town Market" />,
  );
  expect(screen.getByText("Opening the venue")).toBeInTheDocument();
  try {
    sceneMock.renderChildren = true;
    rerender(<LocationVenueScene slug="town-market" locationName="Town Market" />);
    expect(screen.queryByText("Opening the venue")).not.toBeInTheDocument();
    expect(clearTimer).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText("The interior is taking longer than expected.")).not.toBeInTheDocument();
  } finally {
    clearTimer.mockRestore();
    vi.useRealTimers();
  }
});

it("preserves manual fallback when venue details change", () => {
  const { rerender } = render(
    <LocationVenueScene slug="town-market" locationName="Town Market" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue without 3D" }));
  rerender(<LocationVenueScene slug="town-market" locationName="Updated Town Market" />);
  expect(screen.queryByTestId("venue-canvas")).not.toBeInTheDocument();
  expect(screen.queryByText("Opening the venue")).not.toBeInTheDocument();
  expect(screen.getByText(/The 3D preview did not start/)).toBeInTheDocument();
});

it("starts a fresh loading lifecycle for a different venue", () => {
  const { rerender } = render(
    <LocationVenueScene slug="town-market" locationName="Town Market" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Continue without 3D" }));
  rerender(<LocationVenueScene slug="transit-park" locationName="Transit Park" />);
  expect(screen.getByTestId("venue-canvas")).toBeInTheDocument();
  expect(screen.getByText("Opening the venue")).toBeInTheDocument();
  expect(screen.queryByText(/The 3D preview did not start/)).not.toBeInTheDocument();
});

it("isolates furniture failures without disabling the venue", () => {
  sceneMock.renderChildren = true;
  sceneMock.failingKind = "table";
  const design = {
    ...getLocationVenueDesign("unknown-location", "Test Venue"),
    fixtures: [
      {
        id: "test-table",
        kind: "table" as const,
        label: "Test table",
        detail: "Table details",
        position: [0, 0] as [number, number],
      },
      {
        id: "test-seat",
        kind: "seat" as const,
        label: "Test seat",
        detail: "Seat details",
        position: [2, 0] as [number, number],
      },
    ],
  };
  render(
    <LocationVenueScene slug="unknown-location" locationName="Test Venue" design={design} />,
  );
  expect(screen.getByTestId("venue-canvas")).toBeInTheDocument();
  expect(screen.queryByTestId("furniture-table")).not.toBeInTheDocument();
  expect(screen.getByTestId("furniture-seat")).toBeInTheDocument();
  expect(screen.queryByText("Opening the venue")).not.toBeInTheDocument();
  expect(screen.queryByText(/The 3D preview did not start/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Test table" }));
  expect(screen.getByText("Table details")).toBeInTheDocument();
});
