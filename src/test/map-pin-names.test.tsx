import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { MapPin3D } from "@/components/map/MapPin3D";

vi.mock("@/components/3d/SceneHtml", () => ({
  SceneHtml: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/map/map-marker-registry", () => ({ useMapMarkerLayout: vi.fn() }));
afterEach(cleanup);

it("shows a destination name when Names is enabled without requiring hover", () => {
  const { rerender } = render(
    <MapPin3D position={[0, 0, 0]} label="General Hospital" category="health" />,
  );
  expect(screen.queryByText("General Hospital")).toBeNull();
  rerender(
    <MapPin3D position={[0, 0, 0]} label="General Hospital" category="health" showName />,
  );
  expect(screen.getByText("General Hospital")).toBeVisible();
  rerender(
    <MapPin3D position={[0, 0, 0]} label="General Hospital" category="health" isSelected />,
  );
  expect(screen.getByText("General Hospital")).toBeVisible();
});
