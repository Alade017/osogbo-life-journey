import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocationVenueScene } from "@/components/game/LocationVenueScene";
import { VenueSceneBoundary } from "@/components/game/VenueSceneBoundary";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";

const sceneMock = vi.hoisted(() => ({
  failing: new Set<string>(),
}));

vi.mock("@/components/game/venue-scene-loaders", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/game/venue-scene-loaders")>();

  function loader(kind: string) {
    return async () => ({
      default: () => {
        if (sceneMock.failing.has(kind)) {
          throw new Error(`${kind} unavailable`);
        }
        return <div>{kind} scene ready</div>;
      },
    });
  }

  return {
    ...actual,
    venueSceneLoaders: {
      ...actual.venueSceneLoaders,
      mall: loader("mall"),
      clinic: loader("clinic"),
      worship: loader("worship"),
      campus: loader("campus"),
    },
  };
});

describe("specialized venue error isolation", () => {
  beforeEach(() => {
    sceneMock.failing.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const venues = [
    ["mall", "osun-mall"],
    ["clinic", "community-clinic"],
    ["worship", "osogbo-central-mosque"],
    ["campus", "student-district"],
  ] as const;

  it.each(venues)("isolates %s rendering failures", async (kind, slug) => {
    sceneMock.failing.add(kind);
    const venue = getLocationVenueDesign(slug, "Test Venue");

    render(
      <>
        <button type="button">Outside venue</button>
        <LocationVenueScene slug={slug} locationId="test-location" locationName="Test Venue" />
      </>,
    );

    expect(await screen.findByText("Venue temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByText(venue.description)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Outside venue" })).toBeEnabled();
    expect(screen.queryByText(`${kind} scene ready`)).not.toBeInTheDocument();
  });

  it("renders healthy specialized venues", async () => {
    render(<LocationVenueScene slug="community-clinic" locationName="Community Clinic" />);

    expect(await screen.findByText("clinic scene ready")).toBeInTheDocument();
    expect(screen.queryByText("Venue temporarily unavailable")).not.toBeInTheDocument();
  });

  it("resets the failed boundary when venue identity changes", async () => {
    sceneMock.failing.add("clinic");

    const { rerender } = render(
      <LocationVenueScene slug="community-clinic" locationName="Community Clinic" />,
    );

    await screen.findByText("Venue temporarily unavailable");

    rerender(<LocationVenueScene slug="student-district" locationName="School Campus" />);

    expect(await screen.findByText("campus scene ready")).toBeInTheDocument();
    expect(screen.queryByText("Venue temporarily unavailable")).not.toBeInTheDocument();
  });

  it("preserves fallback during presentation updates", async () => {
    sceneMock.failing.add("clinic");

    const { rerender } = render(
      <LocationVenueScene slug="community-clinic" locationName="Community Clinic" />,
    );

    await screen.findByText("Venue temporarily unavailable");
    sceneMock.failing.clear();

    rerender(<LocationVenueScene slug="community-clinic" locationName="Updated Clinic" />);

    expect(screen.getByText("Venue temporarily unavailable")).toBeInTheDocument();
    expect(screen.getByText("Updated Clinic")).toBeInTheDocument();
  });

  it("preserves existing boundary callback behaviour", () => {
    const onError = vi.fn();
    const onOutsideClick = vi.fn();

    function BrokenScene(): never {
      throw new Error("Scene unavailable");
    }

    render(
      <>
        <button type="button" onClick={onOutsideClick}>
          Outside control
        </button>
        <VenueSceneBoundary onError={onError}>
          <BrokenScene />
        </VenueSceneBoundary>
      </>,
    );

    expect(onError).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Outside control" }));
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it("keeps a fallback until the destination reset key changes, without requiring an error callback", () => {
    function Scene({ broken }: { broken: boolean }) {
      if (broken) throw new Error("Destination failed");
      return <div>Recovered destination</div>;
    }

    const { rerender } = render(
      <VenueSceneBoundary resetKey="clinic" fallback={<p>Destination unavailable</p>}>
        <Scene broken />
      </VenueSceneBoundary>,
    );
    expect(screen.getByText("Destination unavailable")).toBeInTheDocument();

    rerender(
      <VenueSceneBoundary resetKey="clinic" fallback={<p>Destination unavailable</p>}>
        <Scene broken={false} />
      </VenueSceneBoundary>,
    );
    expect(screen.getByText("Destination unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Recovered destination")).not.toBeInTheDocument();

    rerender(
      <VenueSceneBoundary resetKey="campus" fallback={<p>Destination unavailable</p>}>
        <Scene broken={false} />
      </VenueSceneBoundary>,
    );
    expect(screen.getByText("Recovered destination")).toBeInTheDocument();
    expect(screen.queryByText("Destination unavailable")).not.toBeInTheDocument();
  });
});
