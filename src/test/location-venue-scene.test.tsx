import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationVenueScene } from "@/components/game/LocationVenueScene";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
import { StrictMode } from "react";
import type { VenueFixture } from "@/lib/location-venue-designs";

const sceneMock = vi.hoisted(() => ({
  renderChildren: false,
  furnitureRender: vi.fn(),
  failingKind: null as string | null,
  pendingKind: null as string | null,
  pendingPromise: null as Promise<void> | null,
}));

vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: import("react").ReactNode }) => (
    <div data-testid="venue-canvas">{sceneMock.renderChildren ? children : null}</div>
  ),
}));

vi.mock("@/components/3d/VenueFurniture", () => ({
  VenueFurnitureModel: ({ kind }: { kind: string }) => {
    sceneMock.furnitureRender(kind);
    if (kind === sceneMock.failingKind) {
      throw new Error("Furniture model unavailable");
    }
    if (kind === sceneMock.pendingKind && sceneMock.pendingPromise) {
      throw sceneMock.pendingPromise;
    }
    return <div data-testid={`furniture-${kind}`} />;
  },
}));

beforeEach(() => {
  sceneMock.furnitureRender.mockClear();
  sceneMock.renderChildren = false;
  sceneMock.failingKind = null;
  sceneMock.pendingKind = null;
  sceneMock.pendingPromise = null;
});
vi.mock("@/components/3d/WorldScene", () => ({
  WorldCamera: () => null,
  WorldLighting: () => null,
  WorldMaterial: () => null,
}));

vi.mock("@/components/3d/VenueEnvironment", () => ({
  VenueEnvironment: () => <div data-testid="venue-environment-ready" />,
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
  Link: ({ to, children, ...props }: { to: string; children: import("react").ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
it("keeps workplace features, jobs and courses accessible when WebGL fails", () => {
  vi.useFakeTimers();
  render(<LocationVenueScene slug="harvest-tech-hub" locationName="Harvest Tech Hub" />);
  act(() => {
    vi.advanceTimersByTime(5000);
  });
  fireEvent.click(screen.getByRole("button", { name: "Training table" }));
  expect(screen.getByRole("button", { name: "Training table" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("link", { name: "Jobs & shifts" })).toHaveAttribute("href", "/jobs");
  expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute("href", "/education");
  vi.useRealTimers();
});

it("cancels the loading timer when the scene becomes ready", async () => {
  vi.useFakeTimers();
  const clearTimer = vi.spyOn(window, "clearTimeout");
  const { rerender } = render(<LocationVenueScene slug="town-market" locationName="Town Market" />);
  expect(screen.getByText("Opening the venue")).toBeInTheDocument();
  try {
    await act(async () => {
      sceneMock.renderChildren = true;
      rerender(<LocationVenueScene slug="town-market" locationName="Town Market" />);
    });
    expect(screen.getByTestId("venue-environment-ready")).toBeInTheDocument();
    expect(screen.queryByText("Opening the venue")).not.toBeInTheDocument();
    expect(clearTimer).toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(
      screen.queryByText("The interior is taking longer than expected."),
    ).not.toBeInTheDocument();
  } finally {
    clearTimer.mockRestore();
    vi.useRealTimers();
  }
});

it("preserves manual fallback when venue details change", () => {
  const { rerender } = render(<LocationVenueScene slug="town-market" locationName="Town Market" />);
  fireEvent.click(screen.getByRole("button", { name: "Continue without 3D" }));
  rerender(<LocationVenueScene slug="town-market" locationName="Updated Town Market" />);
  expect(screen.queryByTestId("venue-canvas")).not.toBeInTheDocument();
  expect(screen.queryByText("Opening the venue")).not.toBeInTheDocument();
  expect(screen.getByText(/The 3D preview did not start/)).toBeInTheDocument();
});

it("starts a fresh loading lifecycle for a different venue", () => {
  const { rerender } = render(<LocationVenueScene slug="town-market" locationName="Town Market" />);
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
  render(<LocationVenueScene slug="unknown-location" locationName="Test Venue" design={design} />);
  expect(screen.getByTestId("venue-canvas")).toBeInTheDocument();
  expect(screen.queryByTestId("furniture-table")).not.toBeInTheDocument();
  expect(screen.getByTestId("furniture-seat")).toBeInTheDocument();
  expect(screen.queryByText("Opening the venue")).not.toBeInTheDocument();
  expect(screen.queryByText(/The 3D preview did not start/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Test table" }));
  expect(screen.getByText("Table details")).toBeInTheDocument();
});

function makeFixture(id: string, kind: VenueFixture["kind"]): VenueFixture {
  return { id, kind, label: id, detail: `${id} details`, position: [0, 0] };
}

function renderVenue(fixtures: VenueFixture[]) {
  return (
    <LocationVenueScene
      slug="unknown-location"
      locationName="Test Venue"
      design={{
        ...getLocationVenueDesign("unknown-location", "Test Venue"),
        fixtures,
      }}
    />
  );
}

function suspendFurniture(kind: string) {
  let resolve!: () => void;
  sceneMock.pendingKind = kind;
  sceneMock.pendingPromise = new Promise<void>((complete) => {
    resolve = complete;
  });

  return async () => {
    await act(async () => {
      sceneMock.pendingKind = null;
      sceneMock.pendingPromise = null;
      resolve();
    });
  };
}

describe("optional furniture readiness", () => {
  const table = makeFixture("Test table", "table");
  const seat = makeFixture("Test seat", "seat");
  const planter = makeFixture("Test planter", "planter");
  const loadingMessage = "Some furnishings are still loading.";
  const failureMessage = "Some furnishings are unavailable.";

  beforeEach(() => {
    vi.useRealTimers();
    sceneMock.renderChildren = true;
  });

  it("hides optional status when all furniture is ready", () => {
    render(renderVenue([table, seat]));
    expect(screen.queryByText(loadingMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(failureMessage)).not.toBeInTheDocument();
  });

  it("keeps the venue interactive while furniture loads", async () => {
    const complete = suspendFurniture("table");
    render(renderVenue([table, seat]));
    expect(screen.getByText(loadingMessage)).toBeInTheDocument();
    expect(screen.queryByText("Opening the venue")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Test seat" }));
    expect(screen.getByRole("button", { name: "Test seat" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await complete();
    expect(screen.queryByText(loadingMessage)).not.toBeInTheDocument();
  });

  it("reports furniture failure without disabling the venue", () => {
    sceneMock.failingKind = "table";
    render(renderVenue([table, seat]));
    expect(screen.getByText(failureMessage)).toBeInTheDocument();
    expect(screen.getByTestId("furniture-seat")).toBeInTheDocument();
    expect(screen.queryByText(/The 3D preview did not start/)).not.toBeInTheDocument();
  });

  it("preserves failed readiness under Strict Mode", () => {
    sceneMock.failingKind = "table";
    render(<StrictMode>{renderVenue([table, seat])}</StrictMode>);
    expect(screen.getByText(failureMessage)).toBeInTheDocument();
    expect(screen.queryByText(loadingMessage)).not.toBeInTheDocument();
  });

  it("excludes unsupported fixtures", () => {
    render(renderVenue([planter]));
    expect(screen.queryByText(loadingMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(failureMessage)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test planter" })).toBeInTheDocument();
  });

  it("clears failure status when a fixture is removed", () => {
    sceneMock.failingKind = "table";
    const { rerender } = render(renderVenue([table, seat]));
    expect(screen.getByText(failureMessage)).toBeInTheDocument();
    rerender(renderVenue([seat]));
    expect(screen.queryByText(failureMessage)).not.toBeInTheDocument();
  });

  it("starts a fresh lifecycle for reintroduced furniture", async () => {
    const { rerender } = render(renderVenue([table, seat]));
    rerender(renderVenue([seat]));
    const complete = suspendFurniture("table");
    rerender(renderVenue([table, seat]));
    expect(screen.getByText(loadingMessage)).toBeInTheDocument();
    await complete();
    expect(screen.queryByText(loadingMessage)).not.toBeInTheDocument();
  });

  it("does not rerender unrelated furniture when selection changes", () => {
    const screenFixture = makeFixture("Test screen", "screen");

    render(renderVenue([table, seat, screenFixture]));
    sceneMock.furnitureRender.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Test seat" }));

    expect(sceneMock.furnitureRender).toHaveBeenCalledWith("table");
    expect(sceneMock.furnitureRender).toHaveBeenCalledWith("seat");
    expect(sceneMock.furnitureRender).not.toHaveBeenCalledWith("screen");
    expect(screen.getByRole("button", { name: "Test seat" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("does not rerender ready furniture when another model finishes loading", async () => {
    const complete = suspendFurniture("table");

    render(renderVenue([table, seat]));
    sceneMock.furnitureRender.mockClear();

    await complete();

    expect(screen.queryByText(loadingMessage)).not.toBeInTheDocument();
    expect(sceneMock.furnitureRender).toHaveBeenCalledWith("table");
    expect(sceneMock.furnitureRender).not.toHaveBeenCalledWith("seat");
  });

  it("hides optional status during manual fallback", () => {
    sceneMock.renderChildren = false;
    render(renderVenue([table, seat]));
    fireEvent.click(screen.getByRole("button", { name: "Continue without 3D" }));
    expect(screen.queryByText(loadingMessage)).not.toBeInTheDocument();
    expect(screen.queryByText(failureMessage)).not.toBeInTheDocument();
    expect(screen.queryByTestId("venue-canvas")).not.toBeInTheDocument();
  });
});

describe("venue scene transitions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    sceneMock.renderChildren = false;
  });

  function enterFallback() {
    fireEvent.click(screen.getByRole("button", { name: "Continue without 3D" }));
  }

  function expectFreshScene() {
    expect(screen.getByTestId("venue-canvas")).toBeInTheDocument();
    expect(screen.getByText("Opening the venue")).toBeInTheDocument();
    expect(screen.queryByText(/The 3D preview did not start/)).not.toBeInTheDocument();
  }

  it("resets fallback when switching shops", () => {
    const { rerender } = render(
      <LocationVenueScene slug="unknown-location" locationName="Test Venue" shopSlug="shop-a" />,
    );
    enterFallback();
    rerender(
      <LocationVenueScene slug="unknown-location" locationName="Test Venue" shopSlug="shop-b" />,
    );
    expectFreshScene();
  });

  it("resets fallback when the server location changes", () => {
    const { rerender } = render(
      <LocationVenueScene
        slug="unknown-location"
        locationName="Test Venue"
        locationId="location-a"
      />,
    );
    enterFallback();
    rerender(
      <LocationVenueScene
        slug="unknown-location"
        locationName="Test Venue"
        locationId="location-b"
      />,
    );
    expectFreshScene();
  });

  it("resets fallback when the scene kind changes", () => {
    const design = getLocationVenueDesign("unknown-location", "Test Venue");
    const { rerender } = render(
      <LocationVenueScene slug="unknown-location" locationName="Test Venue" design={design} />,
    );
    enterFallback();
    rerender(
      <LocationVenueScene
        slug="unknown-location"
        locationName="Test Venue"
        design={{ ...design, scene: "market" }}
      />,
    );
    expectFreshScene();
  });

  it("preserves fallback when presentation changes", () => {
    const design = getLocationVenueDesign("unknown-location", "Test Venue");
    const { rerender } = render(
      <LocationVenueScene slug="unknown-location" locationName="Test Venue" design={design} />,
    );
    enterFallback();
    rerender(
      <LocationVenueScene
        slug="unknown-location"
        locationName="Updated Venue"
        design={{ ...design, accentColor: "#ffffff" }}
      />,
    );
    expect(screen.queryByTestId("venue-canvas")).not.toBeInTheDocument();
    expect(screen.getByText(/The 3D preview did not start/)).toBeInTheDocument();
  });

  it("starts a fresh loading timeout after transition", () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(
        <LocationVenueScene slug="unknown-location" locationName="Test Venue" shopSlug="shop-a" />,
      );
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      rerender(
        <LocationVenueScene slug="unknown-location" locationName="Test Venue" shopSlug="shop-b" />,
      );
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(
        screen.queryByText("The interior is taking longer than expected."),
      ).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(screen.getByText("The interior is taking longer than expected.")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
