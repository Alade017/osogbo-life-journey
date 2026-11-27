import { useEffect, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WorldSceneProvider, WorldSceneViewport } from "@/components/3d/WorldSceneHost";
import { ResidentialCompoundVenue } from "@/components/game/ResidentialCompoundVenue";
import { SchoolCampusVenue } from "@/components/game/SchoolCampusVenue";
import { ClinicVenue } from "@/components/game/ClinicVenue";

const state = vi.hoisted(() => ({
  mounts: 0,
  broken: "",
  cameras: [] as unknown[],
  walkTo: vi.fn(),
  cancel: vi.fn(),
  character: { name: "Malik", gender: "male", appearance: {} },
  equipment: [],
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQuery: (options: { queryKey: readonly unknown[] }) => ({
    data: options.queryKey[0] === "character" ? state.character : state.equipment,
  }),
}));
vi.mock("@/components/3d/WorldCharacter", () => ({
  WorldCharacter: ({ name }: { name?: string }) => (
    <div data-testid="saved-player-character" data-name={name ?? ""} />
  ),
}));
vi.mock("@react-three/fiber", async (original) => ({
  ...(await original<typeof import("@react-three/fiber")>()),
  Canvas: ({ children, camera }: { children: ReactNode; camera: unknown }) => {
    useEffect(() => {
      state.mounts++;
    }, []);
    state.cameras.push(camera);
    // Deliberately never call onCreated: a retained Canvas does not recreate per venue.
    return <div data-testid="renderer">{children}</div>;
  },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/3d/WorldScene", () => ({
  WorldCamera: () => null,
  WorldLighting: () => null,
}));
vi.mock("@/components/3d/VenueVisitor", () => ({ VenueVisitor: () => null }));
vi.mock("@/components/game/ClinicVisitPanel", () => ({
  ClinicVisitPanel: () => <button>Clinic services</button>,
}));
vi.mock("@/hooks/use-campus-walkthrough", () => ({
  useCampusWalkthrough: () => ({
    area: "courtyard",
    entering: false,
    position: [0, 0.06, 0],
    facing: "south",
    walking: false,
    message: "Ready",
    selectArea: vi.fn(),
    walkTo: state.walkTo,
  }),
}));
vi.mock("@/hooks/use-clinic-walkthrough", () => ({
  useClinicWalkthrough: () => ({
    position: [0, 0.06, 0],
    facing: "south",
    walking: false,
    message: "Ready",
    cancel: state.cancel,
    walkTo: state.walkTo,
  }),
}));
vi.mock("@/components/3d/ResidentialCompoundScene", () => ({
  ResidentialCompoundScene: () => {
    if (state.broken === "compound") throw new Error("Compound failed");
    return <span>Compound content</span>;
  },
}));
vi.mock("@/components/3d/SchoolCampusScene", () => ({
  SchoolCampusScene: () => {
    if (state.broken === "campus") throw new Error("Campus failed");
    return <span>Campus content</span>;
  },
}));
vi.mock("@/components/3d/TierOneClinicScene", () => ({
  TierOneClinicScene: () => {
    if (state.broken === "clinic") throw new Error("Clinic failed");
    return <span>Clinic content</span>;
  },
}));

function Game({ venue, enter = () => {} }: { venue: string; enter?: () => void }) {
  return (
    <WorldSceneProvider>
      <WorldSceneViewport />
      {venue === "compound" ? (
        <ResidentialCompoundVenue homeTypeId="duplex" onEnterHome={enter} />
      ) : venue === "campus" ? (
        <SchoolCampusVenue slug="student-district" locationName="Campus" />
      ) : (
        <ClinicVenue slug="community-clinic" locationName="Clinic" />
      )}
    </WorldSceneProvider>
  );
}
beforeEach(() => {
  state.mounts = 0;
  state.broken = "";
  state.cameras = [];
  state.walkTo.mockClear();
  state.cancel.mockClear();
  state.character = { name: "Malik", gender: "male", appearance: {} };
  state.equipment = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("marks each venue ready without recreating Canvas and isolates its camera", async () => {
  const view = render(<Game venue="compound" />);
  const renderer = await screen.findByTestId("renderer");
  expect(screen.getByText("Compound content")).toBeVisible();
  expect(screen.queryByText("Opening the compound")).toBeNull();
  const compoundCamera = state.cameras.at(-1);
  view.rerender(<Game venue="campus" />);
  expect(await screen.findByText("Campus content")).toBeVisible();
  expect(screen.getByTestId("saved-player-character")).toHaveAttribute("data-name", "Malik");
  expect(screen.queryByText("Opening the campus")).toBeNull();
  const campusCamera = state.cameras.at(-1);
  expect(campusCamera).not.toBe(compoundCamera);
  view.rerender(<Game venue="clinic" />);
  expect(await screen.findByText("Clinic content")).toBeVisible();
  expect(screen.getByTestId("saved-player-character")).toHaveAttribute("data-name", "Malik");
  expect(screen.queryByText("Opening the clinic")).toBeNull();
  expect(state.cameras.at(-1)).not.toBe(campusCamera);
  vi.useFakeTimers();
  act(() => {
    vi.advanceTimersByTime(6000);
  });
  expect(screen.queryByText(/The 3D scene is unavailable/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Clinic grounds" }));
  expect(state.cancel).toHaveBeenCalled();
  expect(screen.getByTestId("renderer")).toBe(renderer);
  expect(state.mounts).toBe(1);
});

it.each(["compound", "campus", "clinic"])(
  "preserves %s controls after a portalled scene failure",
  async (venue) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.broken = venue;
    const enter = vi.fn();
    const view = render(<Game venue={venue} enter={enter} />);
    expect(await screen.findByText(/The 3D scene is unavailable/)).toBeVisible();
    if (venue === "compound") {
      fireEvent.click(screen.getByRole("button", { name: "Enter my home" }));
      expect(enter).toHaveBeenCalledOnce();
    } else if (venue === "campus") {
      expect(screen.getByRole("link", { name: "View courses" })).toHaveAttribute(
        "href",
        "/education",
      );
    } else {
      expect(screen.getByRole("button", { name: "Clinic services" })).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: "Clinic grounds" }));
      expect(state.cancel).toHaveBeenCalled();
    }
    state.broken = "";
    view.rerender(<Game venue={venue === "compound" ? "campus" : "compound"} />);
    expect(
      await screen.findByText(venue === "compound" ? "Campus content" : "Compound content"),
    ).toBeVisible();
    expect(state.mounts).toBe(1);
  },
);
