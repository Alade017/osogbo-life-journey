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

it.each([
  ["community-police", "Community police station", "Report desk", "Case submission"],
  ["civic-court", "Civic court", "Consultation desk", "does not start a service"],
])("keeps %s inspection usable when WebGL is unavailable", (slug, name, feature, detail) => {
  vi.useFakeTimers();
  render(<LocationVenueScene slug={slug} locationName={name} />);
  act(() => {
    vi.advanceTimersByTime(5000);
  });
  fireEvent.click(screen.getByRole("button", { name: feature }));
  expect(screen.getByRole("button", { name: feature })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText(new RegExp(detail))).toBeInTheDocument();
  expect(screen.queryByTestId("venue-canvas")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /submit|pay/i })).not.toBeInTheDocument();
});
