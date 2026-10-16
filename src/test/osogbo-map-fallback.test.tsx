import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OsogboMap } from "@/components/game/OsogboMap";
import { isWebGlAvailable, preflightMapStyle } from "@/lib/map-load-health";

vi.mock("maplibre-gl", () => ({
  Map: vi.fn(),
  NavigationControl: vi.fn(),
  FullscreenControl: vi.fn(),
  AttributionControl: vi.fn(),
  setWorkerUrl: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: null }) }));
vi.mock("@/lib/game", () => ({
  q: { character: () => ({}), locationById: () => ({}) },
  rpc: { savePlayerMapPosition: vi.fn() },
}));
vi.mock("@/hooks/use-nearby-locations", () => ({
  useNearbyLocations: () => ({ nearbyLocations: [] }),
}));
vi.mock("@/components/game/LocationMarker", () => ({ LocationMarker: () => null }));
vi.mock("@/components/game/PlayerMarker", () => ({ PlayerMarker: () => null }));
vi.mock("@/components/game/MapControls", () => ({ MapControls: () => null }));
vi.mock("@/components/game/PlayerMovementControls", () => ({
  PlayerMovementControls: () => null,
}));
vi.mock("@/components/game/NearbyLocationPrompt", () => ({
  NearbyLocationPrompt: () => null,
}));
vi.mock("@/lib/map-load-health", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/map-load-health")>();
  return {
    ...original,
    isWebGlAvailable: vi.fn(),
    preflightMapStyle: vi.fn(),
  };
});

const webGlAvailable = vi.mocked(isWebGlAvailable);
const preflight = vi.mocked(preflightMapStyle);

describe("Osogbo street map fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webGlAvailable.mockReturnValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the playable SVG and notice when WebGL is unavailable", async () => {
    const onSelectDistrict = vi.fn();
    const { container } = render(<OsogboMap onSelectDistrict={onSelectDistrict} />);

    expect(
      await screen.findByText(
        "Street map unavailable on this connection. Showing the simplified map.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry street map" })).toBeInTheDocument();
    expect(container.querySelector(".osogbo-map-svg")).toBeInTheDocument();

    const district = container.querySelector<SVGGElement>("[data-district-id]");
    expect(district).not.toBeNull();
    fireEvent.click(district!);
    expect(onSelectDistrict).toHaveBeenCalledOnce();
  });

  it("falls back when the style loads but its source preflight fails", async () => {
    webGlAvailable.mockReturnValue(true);
    preflight.mockResolvedValue({ ok: false, reason: "source-unavailable" });
    render(<OsogboMap />);

    expect(
      await screen.findByText(
        "Street map unavailable on this connection. Showing the simplified map.",
      ),
    ).toBeInTheDocument();
    expect(preflight).toHaveBeenCalledOnce();
  });

  it("starts a fresh attempt when the player retries", async () => {
    render(<OsogboMap />);
    fireEvent.click(await screen.findByRole("button", { name: "Retry street map" }));
    await waitFor(() => expect(webGlAvailable).toHaveBeenCalledTimes(2));
  });

  it("falls back on the watchdog when the provider never reports an error", async () => {
    vi.useFakeTimers();
    webGlAvailable.mockReturnValue(true);
    preflight.mockImplementation(() => new Promise(() => {}));
    render(<OsogboMap />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(
      screen.getByText("Street map unavailable on this connection. Showing the simplified map."),
    ).toBeInTheDocument();
  });
});
