import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ResidentialCompoundVenue } from "@/components/game/ResidentialCompoundVenue";
import { compoundFeatures, residentialHomePresentation } from "@/game/residential-compound";
vi.mock("@react-three/fiber", () => ({ Canvas: () => null }));
vi.mock("@/components/3d/WorldScene", () => ({
  WorldCamera: () => null,
  WorldLighting: () => null,
}));
vi.mock("@/components/3d/ResidentialCompoundScene", () => ({
  ResidentialCompoundScene: () => null,
}));
afterEach(cleanup);
it("uses the housing catalog and rejects unknown home types", () => {
  expect(residentialHomePresentation("unknown")).toBeNull();
  expect(residentialHomePresentation(null)).toBeNull();
  expect(residentialHomePresentation("duplex")?.floors).toBe(2);
  expect(
    compoundFeatures(residentialHomePresentation("shared-room")?.sharedFacilities).some(
      (item) => item.id === "wash",
    ),
  ).toBe(true);
  expect(
    compoundFeatures(residentialHomePresentation("studio-flat")?.sharedFacilities).some(
      (item) => item.id === "wash",
    ),
  ).toBe(false);
});
it("does not offer a home entry for an unconfirmed home or a public tour", () => {
  const { rerender } = render(<ResidentialCompoundVenue onEnterHome={vi.fn()} />);
  expect(screen.queryByRole("button", { name: "Enter my home" })).toBeNull();
  rerender(<ResidentialCompoundVenue homeTypeId="duplex" />);
  expect(screen.queryByRole("button", { name: "Enter my home" })).toBeNull();
});
it("delegates confirmed entry to the existing parent action and blocks repeat entry while pending", () => {
  const enter = vi.fn();
  const { rerender } = render(
    <ResidentialCompoundVenue homeTypeId="shared-room" onEnterHome={enter} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Enter my home" }));
  expect(enter).toHaveBeenCalledTimes(1);
  rerender(<ResidentialCompoundVenue homeTypeId="shared-room" onEnterHome={enter} enteringHome />);
  const pending = screen.getByRole("button", { name: "Heading home…" });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  expect(enter).toHaveBeenCalledTimes(1);
});
