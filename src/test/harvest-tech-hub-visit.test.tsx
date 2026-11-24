import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import HarvestTechHubVenue from "@/components/game/HarvestTechHubVenue";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";

const movement = vi.hoisted(() => ({
  walk: vi.fn(),
  cancel: vi.fn(),
  positionRef: { current: [0, 0.06, 5.25] },
  position: [0, 0.06, 5.25],
}));
vi.mock("@/hooks/use-house-movement", () => ({ useHouseMovement: () => movement }));
vi.mock("@/components/3d/WorldCanvas", () => ({ WorldCanvas: () => null }));
vi.mock("@/lib/game", () => ({ q: { character: () => ({}), equipment: () => ({}) } }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({}) }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

it("offers the last requested station's service only after arrival and clears it on departure", async () => {
  const finish: ((arrived: boolean) => void)[] = [];
  movement.walk.mockImplementation(() => new Promise((resolve) => finish.push(resolve)));
  render(
    <HarvestTechHubVenue venue={getLocationVenueDesign("harvest-tech-hub", "Harvest Tech Hub")} />,
  );
  fireEvent.click(screen.getByText("Choose a station"));
  fireEvent.click(screen.getByRole("button", { name: "Worktable" }));
  fireEvent.click(screen.getByRole("button", { name: "Training table" }));
  await act(async () => finish[0]!(true));
  expect(screen.queryByRole("link")).toBeNull();
  await act(async () => finish[1]!(true));
  expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute("href", "/education");
  fireEvent.click(screen.getByRole("button", { name: "Reception desk" }));
  expect(screen.queryByRole("link")).toBeNull();
  await act(async () => finish[2]!(true));
  expect(screen.getByRole("link", { name: "Jobs & shifts" })).toHaveAttribute("href", "/jobs");
});
